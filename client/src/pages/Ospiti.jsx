import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Download, Check, X, Clock } from 'lucide-react';
import api from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const LATO = ['sposo1', 'sposo2', 'comune'];
const RSVP = ['attesa', 'confermato', 'declinato'];
const rsvpColor = { confermato: 'bg-green-100 text-green-700', declinato: 'bg-red-100 text-red-600', attesa: 'bg-yellow-100 text-yellow-700' };
const rsvpLabel = { confermato: 'Confermato', declinato: 'Declinato', attesa: 'In attesa' };
const rsvpIcon = { confermato: Check, declinato: X, attesa: Clock };
const latoLabel = { sposo1: 'Sposo', sposo2: 'Sposa', comune: 'Comune' };

const empty = { nome: '', cognome: '', lato: 'comune', tipo: 'adulto', rsvp: 'attesa', tavolo_id: '', email: '', telefono: '', intolleranze: '', note: '' };

export default function Ospiti() {
  const [items, setItems] = useState([]);
  const [tavoli, setTavoli] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filtroRsvp, setFiltroRsvp] = useState('');
  const [filtroLato, setFiltroLato] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = () => {
    api.get('/ospiti').then(r => setItems(r.data));
    api.get('/tavoli').then(r => setTavoli(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = o => { setForm({ ...o, tavolo_id: o.tavolo_id || '' }); setEditId(o.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    const payload = { ...form, tavolo_id: form.tavolo_id || null };
    if (editId) await api.put(`/ospiti/${editId}`, payload);
    else await api.post('/ospiti', payload);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo ospite?')) return;
    await api.delete(`/ospiti/${id}`);
    load();
  };

  const filtered = items.filter(i =>
    (!filtroRsvp || i.rsvp === filtroRsvp) &&
    (!filtroLato || i.lato === filtroLato)
  );

  const totale = items.length;
  const confermati = items.filter(i => i.rsvp === 'confermato').length;
  const declinati = items.filter(i => i.rsvp === 'declinato').length;
  const adulti = items.filter(i => i.tipo === 'adulto' && i.rsvp === 'confermato').length;
  const bambini = items.filter(i => i.tipo === 'bambino' && i.rsvp === 'confermato').length;

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
      doc.text('Lista Ospiti', 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const subtitle = `${totale} invitati · ${confermati} confermati · ${declinati} declinati · ${items.filter(i => i.rsvp === 'attesa').length} in attesa`;
      doc.text(subtitle, 14, 20);

      // Stats box
      const statsY = 34;
      [[`${adulti}`, 'Adulti conf.'], [`${bambini}`, 'Bambini conf.'], [`${items.filter(i => i.lato === 'sposo1').length}`, 'Lato Sposo'], [`${items.filter(i => i.lato === 'sposo2').length}`, 'Lato Sposa']].forEach(([val, lbl], i) => {
        const x = 14 + i * 47;
        doc.setFillColor(255, 245, 247);
        doc.roundedRect(x, statsY, 43, 14, 2, 2, 'F');
        doc.setTextColor(...rose);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(val, x + 21.5, statsY + 7, { align: 'center' });
        doc.setTextColor(...gray);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(lbl, x + 21.5, statsY + 12, { align: 'center' });
      });

      // Table
      const rsvpText = { confermato: 'Confermato', declinato: 'Declinato', attesa: 'In attesa' };
      const rows = (filtered.length > 0 ? filtered : items).map(o => [
        o.cognome ? `${o.cognome} ${o.nome}` : o.nome,
        latoLabel[o.lato] || o.lato,
        o.tipo === 'bambino' ? 'Bambino' : 'Adulto',
        rsvpText[o.rsvp] || o.rsvp,
        o.tavolo_nome || '-',
        o.intolleranze || '-',
      ]);

      autoTable(doc, {
        startY: statsY + 20,
        head: [['Nome', 'Lato', 'Tipo', 'RSVP', 'Tavolo', 'Intolleranze']],
        body: rows,
        headStyles: { fillColor: rose, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: [55, 65, 81] },
        alternateRowStyles: { fillColor: [255, 251, 252] },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 22 },
          2: { cellWidth: 18 },
          3: { cellWidth: 32 },
          4: { cellWidth: 28 },
          5: { cellWidth: 'auto' },
        },
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 3) {
            const v = data.cell.raw;
            if (v === 'Confermato') data.cell.styles.textColor = [22, 163, 74];
            else if (v === 'Declinato') data.cell.styles.textColor = [220, 38, 38];
            else data.cell.styles.textColor = [161, 98, 7];
          }
        },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text(`Pagina ${i} di ${pageCount}`, 196, 290, { align: 'right' });
        doc.text(`Lista Ospiti - ${new Date().toLocaleDateString('it-IT')}`, 14, 290);
      }

      doc.save('lista-ospiti.pdf');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Lista Ospiti</h1>
          <p className="page-subtitle">{totale} invitati · {confermati} confermati · {declinati} declinati</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'PDF'}
          </button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> Aggiungi Ospite</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Totale invitati', value: totale, color: 'text-gray-700' },
          { label: 'Confermati', value: confermati, color: 'text-green-600' },
          { label: 'In attesa', value: items.filter(i => i.rsvp === 'attesa').length, color: 'text-yellow-600' },
          { label: 'Declinati', value: declinati, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div className="card mb-4 flex flex-wrap gap-2">
        <button className={`badge px-3 py-1.5 cursor-pointer ${!filtroRsvp ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setFiltroRsvp('')}>Tutti</button>
        {RSVP.map(r => (
          <button key={r} className={`badge px-3 py-1.5 cursor-pointer ${filtroRsvp === r ? 'bg-rose-500 text-white' : rsvpColor[r]}`} onClick={() => setFiltroRsvp(r === filtroRsvp ? '' : r)}>
            {rsvpLabel[r]}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {LATO.map(l => (
          <button key={l} className={`badge px-3 py-1.5 cursor-pointer ${filtroLato === l ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setFiltroLato(l === filtroLato ? '' : l)}>
            {latoLabel[l]}
          </button>
        ))}
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {confermati > 0 && (
          <div className="text-xs text-gray-400 px-1">Confermati: {adulti} adulti + {bambini} bambini</div>
        )}
        {filtered.length === 0 && (
          <div className="card text-center py-10 text-gray-400">Nessun ospite</div>
        )}
        {filtered.map(o => {
          const Icon = rsvpIcon[o.rsvp];
          return (
            <div key={o.id} className="card p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className={`badge text-xs flex items-center gap-1 ${rsvpColor[o.rsvp]}`}><Icon size={11} />{rsvpLabel[o.rsvp]}</span>
                    <span className="badge bg-gray-100 text-gray-600 text-xs">{latoLabel[o.lato]}</span>
                    {o.tipo === 'bambino' && <span className="badge bg-purple-100 text-purple-600 text-xs">Bambino</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-500 mb-2">
                {o.tavolo_nome && <div><span className="text-gray-400">Tavolo:</span> {o.tavolo_nome}</div>}
                {o.intolleranze && <div className="truncate"><span className="text-gray-400">Intoll.:</span> {o.intolleranze}</div>}
              </div>
              <div className="flex gap-1 justify-end border-t border-gray-100 pt-2">
                <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => openEdit(o)}><Pencil size={14} /></button>
                <button className="p-1.5 rounded hover:bg-red-50 text-red-400" onClick={() => del(o.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="card hidden sm:block">
        {confermati > 0 && (
          <div className="text-xs text-gray-400 mb-3">
            Confermati: {adulti} adulti + {bambini} bambini
          </div>
        )}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Lato</th>
                <th>Tipo</th>
                <th>RSVP</th>
                <th>Tavolo</th>
                <th>Intolleranze</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nessun ospite</td></tr>
              )}
              {filtered.map(o => {
                const Icon = rsvpIcon[o.rsvp];
                return (
                  <tr key={o.id}>
                    <td className="font-medium text-gray-900">{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</td>
                    <td className="text-gray-500 text-sm">{latoLabel[o.lato]}</td>
                    <td className="text-gray-500 text-sm capitalize">{o.tipo}</td>
                    <td>
                      <span className={`badge flex items-center gap-1 w-fit ${rsvpColor[o.rsvp]}`}>
                        <Icon size={11} />{rsvpLabel[o.rsvp]}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">{o.tavolo_nome || '—'}</td>
                    <td className="text-gray-400 text-xs max-w-32 truncate">{o.intolleranze || '—'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => openEdit(o)}><Pencil size={14} /></button>
                        <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => del(o.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Ospite' : 'Nuovo Ospite'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Nome *</label>
                  <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Cognome</label>
                  <input className="form-input" value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Lato</label>
                  <select className="form-input" value={form.lato} onChange={e => setForm({ ...form, lato: e.target.value })}>
                    {LATO.map(l => <option key={l} value={l}>{latoLabel[l]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    <option value="adulto">Adulto</option>
                    <option value="bambino">Bambino</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">RSVP</label>
                  <select className="form-input" value={form.rsvp} onChange={e => setForm({ ...form, rsvp: e.target.value })}>
                    {RSVP.map(r => <option key={r} value={r}>{rsvpLabel[r]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Telefono</label>
                  <input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Tavolo</label>
                <select className="form-input" value={form.tavolo_id} onChange={e => setForm({ ...form, tavolo_id: e.target.value })}>
                  <option value="">— Nessun tavolo —</option>
                  {tavoli.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.ospiti?.length || 0}/{t.capienza})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Intolleranze alimentari</label>
                <input className="form-input" value={form.intolleranze} onChange={e => setForm({ ...form, intolleranze: e.target.value })} placeholder="Es. celiaco, vegano…" />
              </div>
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
    </div>
  );
}
