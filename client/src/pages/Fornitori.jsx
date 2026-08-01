import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Phone, Mail, User } from 'lucide-react';
import api from '../api';

const CATEGORIE = ['Fotografo', 'Videomaker', 'Catering', 'Fiorista', 'Musica', 'Auto', 'Abito sposa', 'Abito sposo', 'Parrucchiere', 'Makeup', 'Pasticceria', 'Altro'];
const STATI = ['da_contattare', 'contattato', 'preventivo_ricevuto', 'confermato', 'escluso'];
const statoColor = { da_contattare: 'bg-gray-100 text-gray-600', contattato: 'bg-blue-100 text-blue-600', preventivo_ricevuto: 'bg-yellow-100 text-yellow-700', confermato: 'bg-green-100 text-green-700', escluso: 'bg-red-100 text-red-600' };
const statoLabel = { da_contattare: 'Da contattare', contattato: 'Contattato', preventivo_ricevuto: 'Preventivo ricevuto', confermato: 'Confermato', escluso: 'Escluso' };

const empty = { categoria: 'Fotografo', nome: '', contatto: '', telefono: '', email: '', note: '', stato: 'da_contattare' };

export default function Fornitori() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filtro, setFiltro] = useState('');

  const load = () => api.get('/fornitori').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = f => { setForm({ ...f }); setEditId(f.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    if (editId) await api.put(`/fornitori/${editId}`, form);
    else await api.post('/fornitori', form);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo fornitore?')) return;
    await api.delete(`/fornitori/${id}`);
    load();
  };

  const filtered = items.filter(i =>
    !filtro || i.nome.toLowerCase().includes(filtro.toLowerCase()) || i.categoria.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Fornitori</h1>
          <p className="page-subtitle">{items.length} fornitori registrati</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuovo Fornitore</button>
      </div>

      <div className="card mb-4">
        <input
          className="form-input"
          placeholder="Cerca per nome o categoria..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(f => (
          <div key={f.id} className="card group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{f.categoria}</span>
                <h3 className="font-bold text-gray-900 mt-0.5">{f.nome}</h3>
              </div>
              <span className={`badge ${statoColor[f.stato]}`}>{statoLabel[f.stato]}</span>
            </div>
            {f.contatto && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                <User size={13} /> {f.contatto}
              </div>
            )}
            {f.telefono && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                <Phone size={13} /> <a href={`tel:${f.telefono}`} className="hover:text-rose-500">{f.telefono}</a>
              </div>
            )}
            {f.email && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                <Mail size={13} /> <a href={`mailto:${f.email}`} className="hover:text-rose-500">{f.email}</a>
              </div>
            )}
            {f.note && <p className="text-xs text-gray-400 mt-2 italic">{f.note}</p>}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button className="btn-secondary text-xs py-1 px-3" onClick={() => openEdit(f)}><Pencil size={13} /> Modifica</button>
              <button className="btn-danger text-xs py-1 px-3" onClick={() => del(f.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <User size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nessun fornitore trovato</p>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Categoria *</label>
                  <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} required>
                    {CATEGORIE.map(c => <option key={c}>{c}</option>)}
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
                <label className="form-label">Nome Azienda / Professionista *</label>
                <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Referente</label>
                  <input className="form-input" value={form.contatto} onChange={e => setForm({ ...form, contatto: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Telefono</label>
                  <input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
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
