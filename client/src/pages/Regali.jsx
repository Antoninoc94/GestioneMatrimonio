import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Gift, CheckCircle, Circle } from 'lucide-react';
import api from '../api';

const TIPI = ['busta', 'oggetto', 'lista_nozze', 'altro'];
const tipoLabel = { busta: '💰 Busta', oggetto: '🎁 Oggetto', lista_nozze: '📋 Lista nozze', altro: '🎀 Altro' };
const tipoColor = { busta: 'bg-green-100 text-green-700', oggetto: 'bg-blue-100 text-blue-700', lista_nozze: 'bg-purple-100 text-purple-700', altro: 'bg-gray-100 text-gray-600' };

const formatEuro = n => n ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n) : '—';

const empty = { ospite_id: '', mittente: '', descrizione: '', tipo: 'altro', valore_stimato: '', ringraziamento_inviato: false, note: '' };

export default function Regali() {
  const [items, setItems] = useState([]);
  const [ospiti, setOspiti] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');

  const load = () => {
    api.get('/regali').then(r => setItems(r.data));
    api.get('/ospiti').then(r => setOspiti(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = r => { setForm({ ...r, valore_stimato: r.valore_stimato?.toString() || '', ospite_id: r.ospite_id || '' }); setEditId(r.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    const payload = { ...form, valore_stimato: form.valore_stimato ? parseFloat(form.valore_stimato) : null, ospite_id: form.ospite_id || null };
    if (editId) await api.put(`/regali/${editId}`, payload);
    else await api.post('/regali', payload);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo regalo?')) return;
    await api.delete(`/regali/${id}`);
    load();
  };

  const toggleRingraziamento = async item => {
    await api.put(`/regali/${item.id}`, { ...item, ringraziamento_inviato: !item.ringraziamento_inviato });
    load();
  };

  const filtered = filtroTipo ? items.filter(i => i.tipo === filtroTipo) : items;
  const totaleValore = items.reduce((s, i) => s + (i.valore_stimato || 0), 0);
  const daRingraziare = items.filter(i => !i.ringraziamento_inviato).length;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Regali Ricevuti</h1>
          <p className="page-subtitle">{items.length} regali · Valore: {formatEuro(totaleValore)} · {daRingraziare} ringraziamenti da inviare</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Aggiungi Regalo</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {TIPI.map(t => {
          const count = items.filter(i => i.tipo === t).length;
          return (
            <div key={t} className="card text-center py-3">
              <div className="text-xl font-bold text-gray-800">{count}</div>
              <div className="text-xs text-gray-400 mt-0.5">{tipoLabel[t]}</div>
            </div>
          );
        })}
      </div>

      <div className="card mb-4 flex flex-wrap gap-2">
        <button className={`badge px-3 py-1.5 cursor-pointer ${!filtroTipo ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setFiltroTipo('')}>Tutti ({items.length})</button>
        {TIPI.map(t => (
          <button key={t} className={`badge px-3 py-1.5 cursor-pointer ${filtroTipo === t ? 'bg-rose-500 text-white' : tipoColor[t]}`} onClick={() => setFiltroTipo(t === filtroTipo ? '' : t)}>
            {tipoLabel[t]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Mittente</th>
                <th>Descrizione</th>
                <th>Tipo</th>
                <th>Valore</th>
                <th>Ringraziamento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Nessun regalo registrato</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="font-medium text-gray-900">
                    {r.ospite_nome ? `${r.ospite_cognome ? r.ospite_cognome + ' ' : ''}${r.ospite_nome}` : r.mittente || '—'}
                  </td>
                  <td className="text-gray-600">{r.descrizione}</td>
                  <td><span className={`badge ${tipoColor[r.tipo]}`}>{tipoLabel[r.tipo]}</span></td>
                  <td className="font-semibold text-gray-700">{formatEuro(r.valore_stimato)}</td>
                  <td>
                    <button onClick={() => toggleRingraziamento(r)} className="flex items-center gap-1 text-sm">
                      {r.ringraziamento_inviato
                        ? <CheckCircle size={16} className="text-green-500" />
                        : <Circle size={16} className="text-gray-300" />}
                      <span className={r.ringraziamento_inviato ? 'text-green-600' : 'text-gray-400'}>
                        {r.ringraziamento_inviato ? 'Inviato' : 'Da inviare'}
                      </span>
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                      <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => del(r.id)}><Trash2 size={14} /></button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Regalo' : 'Nuovo Regalo'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Ospite (dalla lista)</label>
                  <select className="form-input" value={form.ospite_id} onChange={e => setForm({ ...form, ospite_id: e.target.value })}>
                    <option value="">— Libero —</option>
                    {ospiti.map(o => <option key={o.id} value={o.id}>{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Mittente (testo libero)</label>
                  <input className="form-input" value={form.mittente} onChange={e => setForm({ ...form, mittente: e.target.value })} placeholder="Se non in lista ospiti" />
                </div>
              </div>
              <div>
                <label className="form-label">Descrizione *</label>
                <input className="form-input" value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} required placeholder="Es. Busta con 200€, Set pentole…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {TIPI.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Valore stimato (€)</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.valore_stimato} onChange={e => setForm({ ...form, valore_stimato: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ring" className="w-4 h-4 accent-rose-500" checked={form.ringraziamento_inviato} onChange={e => setForm({ ...form, ringraziamento_inviato: e.target.checked })} />
                <label htmlFor="ring" className="text-sm text-gray-700">Ringraziamento già inviato</label>
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
