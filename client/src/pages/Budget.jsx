import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle, Circle, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api';

const CATEGORIE = ['Fotografo', 'Videomaker', 'Catering', 'Fiorista', 'Musica', 'Auto', 'Abito sposa', 'Abito sposo', 'Parrucchiere', 'Makeup', 'Pasticceria', 'Location', 'Chiesa', 'Viaggio di nozze', 'Inviti', 'Bomboniere', 'Decorazioni', 'Altro'];

const empty = { categoria: 'Catering', descrizione: '', importo_preventivo: '', importo_effettivo: '', pagato: false, data_pagamento: '', fornitore_id: '', note: '' };

const formatEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);

export default function Budget() {
  const [items, setItems] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [exporting, setExporting] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [payImporto, setPayImporto] = useState('');
  const [payData, setPayData] = useState('');

  const load = () => {
    api.get('/costi').then(r => setItems(r.data));
    api.get('/fornitori').then(r => setFornitori(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = c => { setForm({ ...c, importo_preventivo: c.importo_preventivo?.toString(), importo_effettivo: c.importo_effettivo?.toString(), pagato: !!c.pagato, data_pagamento: c.data_pagamento || '' }); setEditId(c.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    const payload = { ...form, importo_preventivo: parseFloat(form.importo_preventivo) || 0, importo_effettivo: parseFloat(form.importo_effettivo) || 0 };
    if (editId) await api.put(`/costi/${editId}`, payload);
    else await api.post('/costi', payload);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questa voce?')) return;
    await api.delete(`/costi/${id}`);
    load();
  };

  const togglePagato = item => {
    if (item.pagato) {
      api.put(`/costi/${item.id}`, { ...item, pagato: false }).then(load);
    } else {
      setPayImporto(item.importo_preventivo > 0 ? item.importo_preventivo.toString() : '');
      setPayData(new Date().toISOString().split('T')[0]);
      setPayModal(item);
    }
  };

  const confirmPay = async () => {
    await api.put(`/costi/${payModal.id}`, {
      ...payModal,
      pagato: true,
      importo_effettivo: parseFloat(payImporto) || 0,
      data_pagamento: payData,
    });
    setPayModal(null);
    load();
  };

  const totalePrev = items.reduce((s, i) => s + i.importo_preventivo, 0);
  const totaleEff = items.reduce((s, i) => s + i.importo_effettivo, 0);
  const totalePagato = items.filter(i => i.pagato).reduce((s, i) => s + i.importo_effettivo, 0);

  const categorie = [...new Set(items.map(i => i.categoria))];

  const chartData = categorie.map(c => ({
    name: c,
    Preventivato: items.filter(i => i.categoria === c).reduce((s, i) => s + i.importo_preventivo, 0),
    Effettivo: items.filter(i => i.categoria === c).reduce((s, i) => s + i.importo_effettivo, 0),
  }));

  const filtered = filtroCategoria ? items.filter(i => i.categoria === filtroCategoria) : items;

  const exportPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const rose = [225, 29, 72];
      const gray = [107, 114, 128];

      // Header
      doc.setFillColor(...rose);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Budget & Costi', 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${items.length} voci · ${new Date().toLocaleDateString('it-IT')}`, 14, 20);

      // Stats boxes
      const statsY = 34;
      [
        [formatEuro(totalePrev), 'Preventivato', [59, 130, 246]],
        [formatEuro(totaleEff), 'Speso', [249, 115, 22]],
        [formatEuro(totalePagato), 'Pagato', [34, 197, 94]],
      ].forEach(([val, label, color], i) => {
        const x = 14 + i * 62;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, statsY, 58, 16, 2, 2, 'F');
        doc.setTextColor(...color);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(val, x + 29, statsY + 7, { align: 'center' });
        doc.setTextColor(...gray);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text(label, x + 29, statsY + 13, { align: 'center' });
      });

      // Category breakdown
      const catRows = categorie.map(c => {
        const prev = items.filter(i => i.categoria === c).reduce((s, i) => s + i.importo_preventivo, 0);
        const eff = items.filter(i => i.categoria === c).reduce((s, i) => s + i.importo_effettivo, 0);
        return [c, prev, eff, eff - prev];
      });

      const sec1Y = statsY + 22;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('RIEPILOGO PER CATEGORIA', 14, sec1Y);

      autoTable(doc, {
        startY: sec1Y + 3,
        head: [['Categoria', 'Preventivato', 'Effettivo', 'Differenza']],
        body: catRows.map(r => [r[0], formatEuro(r[1]), formatEuro(r[2]), formatEuro(r[3])]),
        headStyles: { fillColor: rose, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [55, 65, 81] },
        alternateRowStyles: { fillColor: [255, 251, 252] },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { cellWidth: 38, halign: 'right' },
          2: { cellWidth: 38, halign: 'right' },
          3: { cellWidth: 38, halign: 'right' },
        },
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 3) {
            const diff = catRows[data.row.index]?.[3];
            if (diff > 0) data.cell.styles.textColor = [220, 38, 38];
            else if (diff < 0) data.cell.styles.textColor = [22, 163, 74];
          }
        },
        margin: { left: 14, right: 14 },
      });

      // Detail table
      const sec2Y = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('DETTAGLIO VOCI DI SPESA', 14, sec2Y);

      autoTable(doc, {
        startY: sec2Y + 3,
        head: [['Categoria', 'Descrizione', 'Preventivato', 'Effettivo', 'Pagato']],
        body: items.map(c => [
          c.categoria,
          c.descrizione,
          formatEuro(c.importo_preventivo),
          formatEuro(c.importo_effettivo),
          c.pagato ? (c.data_pagamento ? `✓ ${c.data_pagamento}` : '✓') : '—',
        ]),
        headStyles: { fillColor: rose, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [55, 65, 81] },
        alternateRowStyles: { fillColor: [255, 251, 252] },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 28, halign: 'right' },
          3: { cellWidth: 28, halign: 'right' },
          4: { cellWidth: 26, halign: 'center' },
        },
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 3) {
            const item = items[data.row.index];
            if (item && item.importo_effettivo > item.importo_preventivo)
              data.cell.styles.textColor = [220, 38, 38];
          }
          if (data.section === 'body' && data.column.index === 4 && String(data.cell.raw).startsWith('✓'))
            data.cell.styles.textColor = [22, 163, 74];
        },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text(`Pagina ${p} di ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`Budget & Costi — ${new Date().toLocaleDateString('it-IT')}`, 14, 290);
      }

      doc.save('budget-riepilogo.pdf');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Budget & Costi</h1>
          <p className="page-subtitle">{items.length} voci di spesa</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'PDF'}
          </button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuova Voce</button>
        </div>
      </div>

      {/* Totali */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Preventivato', value: formatEuro(totalePrev), color: 'text-blue-600' },
          { label: 'Speso', value: formatEuro(totaleEff), color: 'text-orange-600' },
          { label: 'Pagato', value: formatEuro(totalePagato), color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Grafico */}
      {chartData.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Preventivato vs Effettivo per Categoria</h2>
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 34)}>
            <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => formatEuro(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={112} />
              <Tooltip formatter={v => formatEuro(v)} />
              <Legend />
              <Bar dataKey="Preventivato" fill="#93c5fd" radius={[0, 3, 3, 0]} maxBarSize={14} />
              <Bar dataKey="Effettivo" fill="#e11d48" radius={[0, 3, 3, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filtro */}
      <div className="card mb-4">
        <select className="form-input" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {categorie.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="card text-center py-10 text-gray-400">Nessuna voce di spesa</div>
        )}
        {filtered.map(c => (
          <div key={c.id} className="card p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{c.descrizione}</div>
                <span className="badge bg-gray-100 text-gray-600 text-xs mt-0.5">{c.categoria}</span>
              </div>
              <button onClick={() => togglePagato(c)} className="flex-shrink-0 mt-0.5">
                {c.pagato ? <CheckCircle size={22} className="text-green-500" /> : <Circle size={22} className="text-gray-300" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
              <div>
                <div className="text-xs text-gray-400">Preventivato</div>
                <div className="font-medium text-blue-600">{formatEuro(c.importo_preventivo)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Effettivo</div>
                <div className={`font-bold ${c.importo_effettivo > c.importo_preventivo ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatEuro(c.importo_effettivo)}
                </div>
              </div>
            </div>
            {c.data_pagamento && <div className="text-xs text-gray-400 mb-2">Pagato il {c.data_pagamento}</div>}
            <div className="flex gap-1 justify-end border-t border-gray-100 pt-2">
              <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => openEdit(c)}><Pencil size={14} /></button>
              <button className="p-1.5 rounded hover:bg-red-50 text-red-400" onClick={() => del(c.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card hidden sm:block">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pagato</th>
                <th>Categoria</th>
                <th>Descrizione</th>
                <th>Preventivato</th>
                <th>Effettivo</th>
                <th>Data Pag.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nessuna voce di spesa</td></tr>
              )}
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <button onClick={() => togglePagato(c)} className="text-gray-400 hover:text-green-500">
                      {c.pagato ? <CheckCircle size={18} className="text-green-500" /> : <Circle size={18} />}
                    </button>
                  </td>
                  <td><span className="badge bg-gray-100 text-gray-600">{c.categoria}</span></td>
                  <td className="font-medium text-gray-900">{c.descrizione}</td>
                  <td className="text-blue-600 font-medium">{formatEuro(c.importo_preventivo)}</td>
                  <td className={`font-bold ${c.importo_effettivo > c.importo_preventivo ? 'text-red-600' : 'text-gray-900'}`}>{formatEuro(c.importo_effettivo)}</td>
                  <td className="text-gray-400 text-sm">{c.data_pagamento || '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded hover:bg-gray-100" onClick={() => openEdit(c)}><Pencil size={14} /></button>
                      <button className="p-1.5 rounded hover:bg-red-50 text-red-400" onClick={() => del(c.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Voce' : 'Nuova Voce di Spesa'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Categoria *</label>
                  <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {CATEGORIE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Fornitore</label>
                  <select className="form-input" value={form.fornitore_id} onChange={e => setForm({ ...form, fornitore_id: e.target.value })}>
                    <option value="">-- Nessuno --</option>
                    {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Descrizione *</label>
                <input className="form-input" value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Importo Preventivo (€)</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.importo_preventivo} onChange={e => setForm({ ...form, importo_preventivo: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Importo Effettivo (€)</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.importo_effettivo} onChange={e => setForm({ ...form, importo_effettivo: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="pagato" checked={form.pagato} onChange={e => setForm({ ...form, pagato: e.target.checked })} className="w-4 h-4 accent-rose-500" />
                <label htmlFor="pagato" className="form-label mb-0">Già pagato</label>
              </div>
              {form.pagato && (
                <div>
                  <label className="form-label">Data Pagamento</label>
                  <input type="date" className="form-input" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} />
                </div>
              )}
              <div>
                <label className="form-label">Note</label>
                <textarea className="form-input" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary">Salva</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPayModal(null)}>
          <div className="modal max-w-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Conferma pagamento</h2>
            <p className="text-sm text-gray-500 mb-4 truncate">{payModal.descrizione} · <span className="text-gray-400">{payModal.categoria}</span></p>
            <div className="space-y-3">
              <div>
                <label className="form-label">Importo pagato (€) *</label>
                <input
                  type="number" step="0.01" min="0"
                  className="form-input text-lg font-semibold"
                  value={payImporto}
                  onChange={e => setPayImporto(e.target.value)}
                  autoFocus
                />
                {payModal.importo_preventivo > 0 && (
                  <button
                    type="button"
                    className="mt-2 w-full text-sm border border-rose-200 text-rose-600 font-medium rounded-lg py-2 hover:bg-rose-50 transition-colors"
                    onClick={() => setPayImporto(payModal.importo_preventivo.toString())}
                  >
                    Usa importo preventivato — {formatEuro(payModal.importo_preventivo)}
                  </button>
                )}
              </div>
              <div>
                <label className="form-label">Data pagamento</label>
                <input
                  type="date" className="form-input"
                  value={payData}
                  onChange={e => setPayData(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button className="btn-primary flex-1" onClick={confirmPay} disabled={!payImporto}>
                ✓ Conferma pagamento
              </button>
              <button className="btn-secondary" onClick={() => setPayModal(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
