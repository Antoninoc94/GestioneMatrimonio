import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Globe, Phone, Mail, Users } from 'lucide-react';
import api from '../api';

const TIPI = ['Ricevimento', 'Chiesa', 'Municipio', 'Cerimonia civile', 'Altro'];
const STATI = ['in_valutazione', 'visitato', 'confermato', 'escluso'];
const statoColor = { in_valutazione: 'bg-gray-100 text-gray-600', visitato: 'bg-blue-100 text-blue-600', confermato: 'bg-green-100 text-green-700', escluso: 'bg-red-100 text-red-600' };
const statoLabel = { in_valutazione: 'In valutazione', visitato: 'Visitato', confermato: 'Confermato', escluso: 'Escluso' };

const empty = { tipo: 'Ricevimento', nome: '', indirizzo: '', contatto: '', telefono: '', email: '', sito_web: '', capienza: '', costo: '', stato: 'in_valutazione', note: '' };

const formatEuro = n => n ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n) : null;

export default function Location() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get('/location').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = l => { setForm({ ...l, capienza: l.capienza?.toString() || '', costo: l.costo?.toString() || '' }); setEditId(l.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    const payload = { ...form, capienza: form.capienza ? parseInt(form.capienza) : null, costo: form.costo ? parseFloat(form.costo) : null };
    if (editId) await api.put(`/location/${editId}`, payload);
    else await api.post('/location', payload);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questa location?')) return;
    await api.delete(`/location/${id}`);
    load();
  };

  const byTipo = TIPI.filter(t => items.some(i => i.tipo === t));

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Location & Chiesa</h1>
          <p className="page-subtitle">{items.length} location registrate</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Aggiungi Location</button>
      </div>

      {byTipo.length === 0 && (
        <div className="card text-center py-12 text-gray-400">
          <MapPin size={40} className="mx-auto mb-2 opacity-30" />
          <p>Nessuna location ancora. Aggiungine una!</p>
        </div>
      )}

      {TIPI.map(tipo => {
        const gruppo = items.filter(i => i.tipo === tipo);
        if (gruppo.length === 0) return null;
        return (
          <div key={tipo} className="mb-8">
            <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-rose-400" /> {tipo}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {gruppo.map(l => (
                <div key={l.id} className={`card ${l.stato === 'confermato' ? 'border-green-200 bg-green-50/30' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900">{l.nome}</h3>
                    <span className={`badge ${statoColor[l.stato]}`}>{statoLabel[l.stato]}</span>
                  </div>
                  {l.indirizzo && (
                    <div className="flex items-start gap-1.5 text-sm text-gray-500 mb-1">
                      <MapPin size={13} className="mt-0.5 flex-shrink-0" /> {l.indirizzo}
                    </div>
                  )}
                  {l.capienza && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                      <Users size={13} /> Capienza: {l.capienza} persone
                    </div>
                  )}
                  {l.costo && (
                    <div className="text-sm font-semibold text-gray-700 mb-1">{formatEuro(l.costo)}</div>
                  )}
                  {l.contatto && (
                    <div className="text-xs text-gray-400">Ref: {l.contatto}</div>
                  )}
                  {l.telefono && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Phone size={11} /> <a href={`tel:${l.telefono}`} className="hover:text-rose-500">{l.telefono}</a>
                    </div>
                  )}
                  {l.email && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Mail size={11} /> <a href={`mailto:${l.email}`} className="hover:text-rose-500">{l.email}</a>
                    </div>
                  )}
                  {l.sito_web && (
                    <div className="flex items-center gap-1 text-xs mt-0.5">
                      <Globe size={11} className="text-gray-400" />
                      <a href={l.sito_web} target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:underline truncate">{l.sito_web}</a>
                    </div>
                  )}
                  {l.note && <p className="text-xs text-gray-400 mt-2 italic">{l.note}</p>}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button className="btn-secondary text-xs py-1 px-3" onClick={() => openEdit(l)}><Pencil size={13} /> Modifica</button>
                    <button className="btn-danger text-xs py-1 px-3" onClick={() => del(l.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Location' : 'Nuova Location'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Tipo *</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {TIPI.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Stato</label>
                  <select className="form-input" value={form.stato} onChange={e => setForm({ ...form, stato: e.target.value })}>
                    {STATI.map(s => <option key={s} value={s}>{statoLabel[s]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Nome *</label>
                <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Indirizzo</label>
                <input className="form-input" value={form.indirizzo} onChange={e => setForm({ ...form, indirizzo: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Capienza</label>
                  <input type="number" className="form-input" value={form.capienza} onChange={e => setForm({ ...form, capienza: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Costo (€)</label>
                  <input type="number" step="0.01" className="form-input" value={form.costo} onChange={e => setForm({ ...form, costo: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Referente</label>
                  <input className="form-input" value={form.contatto} onChange={e => setForm({ ...form, contatto: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Telefono</label>
                  <input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Sito Web</label>
                  <input className="form-input" value={form.sito_web} onChange={e => setForm({ ...form, sito_web: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Note</label>
                <textarea className="form-input" rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
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
