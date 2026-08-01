import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Clock, Download } from 'lucide-react';
import api from '../api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

const empty = { ora: '', titolo: '', descrizione: '', luogo: '', durata: '', tipo: 'altro' };

export default function Cronologia() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef();

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

  const exportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(printRef.current, { scale: 2 });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = 210, h = (canvas.height * w) / canvas.width;
    let y = 0;
    while (y < h) {
      if (y > 0) pdf.addPage();
      pdf.addImage(img, 'PNG', 0, -y, w, h);
      y += 297;
    }
    pdf.save('cronologia-matrimonio.pdf');
    setExporting(false);
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

      <div ref={printRef} className="relative">
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
