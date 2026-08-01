import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Users, Download, Check, X, Clock } from 'lucide-react';
import api from '../api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const LATO = ['sposo1', 'sposo2', 'comune'];
const RSVP = ['attesa', 'confermato', 'declinato'];
const rsvpColor = { confermato: 'bg-green-100 text-green-700', declinato: 'bg-red-100 text-red-600', attesa: 'bg-yellow-100 text-yellow-700' };
const rsvpLabel = { confermato: 'Confermato', declinato: 'Declinato', attesa: 'In attesa' };
const rsvpIcon = { confermato: Check, declinato: X, attesa: Clock };
const latoLabel = { sposo1: 'Sposo 1', sposo2: 'Sposo 2', comune: 'Comune' };

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
  const printRef = useRef();

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

  const exportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = 210, h = (canvas.height * w) / canvas.width;
    let y = 0;
    while (y < h) {
      if (y > 0) pdf.addPage();
      pdf.addImage(img, 'PNG', 0, -y, w, h);
      y += 297;
    }
    pdf.save('lista-ospiti.pdf');
    setExporting(false);
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

      {/* Tabella */}
      <div ref={printRef} className="card">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Nome *</label>
                  <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Cognome</label>
                  <input className="form-input" value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
