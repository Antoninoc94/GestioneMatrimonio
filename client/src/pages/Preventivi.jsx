import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import api from '../api';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const CATEGORIE = ['Fotografo', 'Videomaker', 'Catering', 'Fiorista', 'Musica', 'Auto', 'Abito sposa', 'Abito sposo', 'Parrucchiere', 'Makeup', 'Pasticceria', 'Location', 'Chiesa', 'Viaggio di nozze', 'Altro'];
const STATI = ['in_attesa', 'in_valutazione', 'accettato', 'rifiutato'];
const statoColor = { in_attesa: 'bg-gray-100 text-gray-600', in_valutazione: 'bg-yellow-100 text-yellow-700', accettato: 'bg-green-100 text-green-700', rifiutato: 'bg-red-100 text-red-600' };
const statoLabel = { in_attesa: 'In attesa', in_valutazione: 'In valutazione', accettato: 'Accettato', rifiutato: 'Rifiutato' };

const empty = { fornitore_id: '', fornitore_nome: '', categoria: 'Fotografo', descrizione: '', importo: '', stato: 'in_attesa', data_scadenza: '', note: '' };

const formatEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);

export default function Preventivi() {
  const [items, setItems] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filtroStato, setFiltroStato] = useState('');

  const load = () => {
    api.get('/preventivi').then(r => setItems(r.data));
    api.get('/fornitori').then(r => setFornitori(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = p => { setForm({ ...p, importo: p.importo?.toString(), data_scadenza: p.data_scadenza || '' }); setEditId(p.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    const payload = { ...form, importo: parseFloat(form.importo) };
    if (editId) await api.put(`/preventivi/${editId}`, payload);
    else await api.post('/preventivi', payload);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo preventivo?')) return;
    await api.delete(`/preventivi/${id}`);
    load();
  };

  const filtered = filtroStato ? items.filter(i => i.stato === filtroStato) : items;
  const totaleAccettati = items.filter(i => i.stato === 'accettato').reduce((s, i) => s + i.importo, 0);

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Preventivi</h1>
          <p className="page-subtitle">{items.length} preventivi · Accettati: {formatEuro(totaleAccettati)}</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuovo Preventivo</button>
      </div>

      <div className="card mb-4">
        <div className="flex gap-2 flex-wrap">
          <button className={`badge cursor-pointer px-3 py-1.5 ${!filtroStato ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setFiltroStato('')}>Tutti ({items.length})</button>
          {STATI.map(s => (
            <button key={s} className={`badge cursor-pointer px-3 py-1.5 ${filtroStato === s ? 'bg-rose-500 text-white' : statoColor[s]}`} onClick={() => setFiltroStato(s === filtroStato ? '' : s)}>
              {statoLabel[s]} ({items.filter(i => i.stato === s).length})
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fornitore</th>
                <th>Categoria</th>
                <th>Descrizione</th>
                <th>Importo</th>
                <th>Stato</th>
                <th>Scadenza</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nessun preventivo</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="font-medium text-gray-900">{p.fornitore_nome || '—'}</td>
                  <td className="text-gray-500">{p.categoria}</td>
                  <td className="text-gray-600 max-w-xs truncate">{p.descrizione || '—'}</td>
                  <td className="font-bold text-gray-900">{formatEuro(p.importo)}</td>
                  <td><span className={`badge ${statoColor[p.stato]}`}>{statoLabel[p.stato]}</span></td>
                  <td className="text-gray-500 text-sm">{p.data_scadenza ? format(parseISO(p.data_scadenza), 'd MMM yyyy', { locale: it }) : '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700" onClick={() => openEdit(p)}><Pencil size={14} /></button>
                      <button className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600" onClick={() => del(p.id)}><Trash2 size={14} /></button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Preventivo' : 'Nuovo Preventivo'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Categoria *</label>
                  <select className="form-input" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} required>
                    {CATEGORIE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Fornitore (opzionale)</label>
                  <select className="form-input" value={form.fornitore_id} onChange={e => {
                    const f = fornitori.find(f => f.id === parseInt(e.target.value));
                    setForm({ ...form, fornitore_id: e.target.value, fornitore_nome: f?.nome || form.fornitore_nome });
                  }}>
                    <option value="">-- Seleziona --</option>
                    {fornitori.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Nome Fornitore (se non in lista)</label>
                <input className="form-input" value={form.fornitore_nome} onChange={e => setForm({ ...form, fornitore_nome: e.target.value })} placeholder="Nome azienda..." />
              </div>
              <div>
                <label className="form-label">Descrizione</label>
                <input className="form-input" value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Importo (€) *</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.importo} onChange={e => setForm({ ...form, importo: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Stato</label>
                  <select className="form-input" value={form.stato} onChange={e => setForm({ ...form, stato: e.target.value })}>
                    {STATI.map(s => <option key={s} value={s}>{statoLabel[s]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Scadenza preventivo</label>
                <input type="date" className="form-input" value={form.data_scadenza} onChange={e => setForm({ ...form, data_scadenza: e.target.value })} />
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
