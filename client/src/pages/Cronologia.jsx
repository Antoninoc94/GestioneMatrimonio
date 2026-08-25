import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Clock, Download } from 'lucide-react';
import api from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TIPI = ['cerimonia', 'ricevimento', 'foto', 'viaggio', 'preparativi', 'altro'];
const tipoColor = {
  cerimonia: 'bg-rose-100 text-rose-700 border-rose-200',
  ricevimento: 'bg-purple-100 text-purple-700 border-purple-200',
  foto: 'bg-blue-100 text-blue-700 border-blue-200',
  viaggio: 'bg-green-100 text-green-700 border-green-200',
  preparativi: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  altro: 'bg-gray-100 text-gray-600 border-gray-200',
};
const tipoLabel = {
  cerimonia: '💍 Cerimonia', ricevimento: '🥂 Ricevimento', foto: '📷 Foto',
  viaggio: '🚗 Viaggio', preparativi: '💄 Preparativi', altro: '📌 Altro',
};
// jsPDF/helvetica non rende le emoji — versione solo testo per il PDF
const tipoLabelPdf = {
  cerimonia: 'Cerimonia', ricevimento: 'Ricevimento', foto: 'Foto',
  viaggio: 'Viaggio', preparativi: 'Preparativi', altro: 'Altro',
};

const empty = { ora: '', titolo: '', descrizione: '', luogo: '', durata: '', tipo: 'altro' };

export default function Cronologia() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = () => api.get('/cronologia').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = i => { setForm({ ...i, durata: i.durata?.toString() || '' }); setEditId(i.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    const payload = { ...form, durata: form.durata ? parseInt(form.durata) : null };
    if (editId) await api.put(`/cronologia/${editId}`, payload);
    else await api.post('/cronologia', payload);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo evento?')) return;
    await api.delete(`/cronologia/${id}`);
    load();
  };

  const exportPDF = () => {
    if (items.length === 0) return alert('Nessun evento da esportare.');
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
      doc.text('Cronologia del Giorno', 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${items.length} eventi · ${new Date().toLocaleDateString('it-IT')}`, 14, 20);

      const sorted = [...items].sort((a, b) => (a.ora || '').localeCompare(b.ora || ''));

      autoTable(doc, {
        startY: 34,
        head: [['Ora', 'Evento', 'Tipo', 'Durata']],
        body: sorted.map(ev => {
          const lines = [ev.titolo];
          if (ev.luogo) lines.push(`Luogo: ${ev.luogo}`);
          if (ev.descrizione) lines.push(ev.descrizione);
          return [
            ev.ora || '-',
            lines.join('\n'),
            tipoLabelPdf[ev.tipo] || ev.tipo,
            ev.durata ? `${ev.durata} min` : '-',
          ];
        }),
        headStyles: { fillColor: rose, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [55, 65, 81] },
        alternateRowStyles: { fillColor: [255, 251, 252] },
        columnStyles: {
          0: { cellWidth: 20, fontStyle: 'bold' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 32 },
          3: { cellWidth: 24, halign: 'center' },
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
        doc.text(`Cronologia del Giorno - ${new Date().toLocaleDateString('it-IT')}`, 14, 290);
      }

      doc.save('cronologia-matrimonio.pdf');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Cronologia del Giorno</h1>
          <p className="page-subtitle">{items.length} eventi in programma</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportPDF} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Esporto…' : 'PDF'}
          </button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> Aggiungi Evento</button>
        </div>
      </div>

      <div className="relative">
        {items.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <Clock size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nessun evento. Inizia a costruire la tua giornata!</p>
          </div>
        ) : (
          <div className="relative pl-8">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-rose-100" />
            <div className="space-y-4">
              {items.map((ev, idx) => (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-8 w-6 h-6 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div className={`card border ${tipoColor[ev.tipo]} ml-2`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-lg font-bold text-gray-900">{ev.ora}</span>
                          {ev.durata && <span className="text-xs text-gray-400">({ev.durata} min)</span>}
                          <span className={`badge text-xs ${tipoColor[ev.tipo]}`}>{tipoLabel[ev.tipo]}</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{ev.titolo}</h3>
                        {ev.luogo && <p className="text-sm text-gray-500 mt-0.5">📍 {ev.luogo}</p>}
                        {ev.descrizione && <p className="text-sm text-gray-500 mt-1">{ev.descrizione}</p>}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button className="p-1.5 rounded hover:bg-white/60" onClick={() => openEdit(ev)}><Pencil size={13} className="text-gray-400" /></button>
                        <button className="p-1.5 rounded hover:bg-white/60" onClick={() => del(ev.id)}><Trash2 size={13} className="text-red-400" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Evento' : 'Nuovo Evento'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Ora *</label>
                  <input type="time" className="form-input" value={form.ora} onChange={e => setForm({ ...form, ora: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Durata (minuti)</label>
                  <input type="number" min={1} className="form-input" value={form.durata} onChange={e => setForm({ ...form, durata: e.target.value })} placeholder="60" />
                </div>
              </div>
              <div>
                <label className="form-label">Titolo *</label>
                <input className="form-input" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} required placeholder="Es. Cerimonia in chiesa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {TIPI.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Luogo</label>
                  <input className="form-input" value={form.luogo} onChange={e => setForm({ ...form, luogo: e.target.value })} placeholder="Es. Chiesa San Marco" />
                </div>
              </div>
              <div>
                <label className="form-label">Descrizione</label>
                <textarea className="form-input" rows={2} value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} />
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
