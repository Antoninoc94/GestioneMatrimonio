import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle, Circle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

  const togglePagato = async item => {
    await api.put(`/costi/${item.id}`, { ...item, pagato: !item.pagato });
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

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Budget & Costi</h1>
          <p className="page-subtitle">{items.length} voci di spesa</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuova Voce</button>
      </div>

      {/* Totali */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => formatEuro(v)} />
              <Legend />
              <Bar dataKey="Preventivato" fill="#93c5fd" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Effettivo" fill="#e11d48" radius={[3, 3, 0, 0]} />
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

      <div className="card">
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}
