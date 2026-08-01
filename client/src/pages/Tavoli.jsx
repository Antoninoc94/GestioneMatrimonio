import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, UserCheck, UserX } from 'lucide-react';
import api from '../api';

const rsvpColor = { confermato: 'text-green-600', declinato: 'text-red-400', attesa: 'text-yellow-500' };
const empty = { nome: '', capienza: 8, note: '' };

export default function Tavoli() {
  const [tavoli, setTavoli] = useState([]);
  const [ospiti, setOspiti] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [assignModal, setAssignModal] = useState(null);

  const load = () => {
    api.get('/tavoli').then(r => setTavoli(r.data));
    api.get('/ospiti').then(r => setOspiti(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = t => { setForm({ nome: t.nome, capienza: t.capienza, note: t.note || '' }); setEditId(t.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    if (editId) await api.put(`/tavoli/${editId}`, form);
    else await api.post('/tavoli', form);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo tavolo? Gli ospiti assegnati verranno scollegati.')) return;
    await api.delete(`/tavoli/${id}`);
    load();
  };

  const assignGuest = async (ospitoId, tavoloId) => {
    await api.put(`/ospiti/${ospitoId}`, { ...ospiti.find(o => o.id === ospitoId), tavolo_id: tavoloId });
    load();
  };

  const senzaTavolo = ospiti.filter(o => !o.tavolo_id);
  const totaleAssegnati = ospiti.filter(o => o.tavolo_id).length;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Disposizione Tavoli</h1>
          <p className="page-subtitle">{tavoli.length} tavoli · {totaleAssegnati}/{ospiti.length} ospiti assegnati</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuovo Tavolo</button>
      </div>

      {senzaTavolo.length > 0 && (
        <div className="card mb-5 border-yellow-200 bg-yellow-50/40">
          <div className="flex items-center gap-2 mb-3">
            <UserX size={16} className="text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-700">{senzaTavolo.length} ospiti senza tavolo</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {senzaTavolo.map(o => (
              <div key={o.id} className="flex items-center gap-1 bg-white border border-yellow-200 rounded-lg px-2 py-1">
                <span className="text-sm text-gray-700">{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</span>
                <select
                  className="text-xs border-0 bg-transparent text-rose-500 font-semibold"
                  value=""
                  onChange={e => e.target.value && assignGuest(o.id, parseInt(e.target.value))}
                >
                  <option value="">Assegna…</option>
                  {tavoli.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tavoli.map(t => {
          const pct = Math.round((t.ospiti.length / t.capienza) * 100);
          const pieno = t.ospiti.length >= t.capienza;
          return (
            <div key={t.id} className={`card ${pieno ? 'border-orange-200' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-gray-900">{t.nome}</h3>
                  <div className="text-xs text-gray-400">Capienza: {t.capienza} posti</div>
                </div>
                <div className="flex gap-1">
                  <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400" onClick={() => openEdit(t)}><Pencil size={13} /></button>
                  <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => del(t.id)}><Trash2 size={13} /></button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: pieno ? '#f97316' : '#34d399' }} />
                </div>
                <span className={`text-xs font-bold ${pieno ? 'text-orange-500' : 'text-gray-500'}`}>{t.ospiti.length}/{t.capienza}</span>
              </div>

              {t.note && <p className="text-xs text-gray-400 mb-2 italic">{t.note}</p>}

              <div className="space-y-1">
                {t.ospiti.map(o => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</span>
                    <button
                      className="text-xs text-gray-300 hover:text-red-400"
                      title="Rimuovi dal tavolo"
                      onClick={() => assignGuest(o.id, null)}
                    >✕</button>
                  </div>
                ))}
                {!pieno && (
                  <select
                    className="text-xs text-rose-500 font-semibold border-0 bg-transparent mt-1"
                    value=""
                    onChange={e => e.target.value && assignGuest(parseInt(e.target.value), t.id)}
                  >
                    <option value="">+ Aggiungi ospite…</option>
                    {senzaTavolo.map(o => <option key={o.id} value={o.id}>{o.cognome ? `${o.cognome} ${o.nome}` : o.nome}</option>)}
                  </select>
                )}
              </div>
            </div>
          );
        })}

        {tavoli.length === 0 && (
          <div className="col-span-full card text-center py-12 text-gray-400">
            <Users size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nessun tavolo ancora. Creane uno!</p>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Tavolo' : 'Nuovo Tavolo'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Nome tavolo *</label>
                  <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Es. Tavolo degli Sposi" required />
                </div>
                <div>
                  <label className="form-label">Capienza</label>
                  <div className="flex items-center gap-2">
                    <button type="button" className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-100 flex-shrink-0"
                      onClick={() => setForm({ ...form, capienza: Math.max(1, (form.capienza || 1) - 1) })}>−</button>
                    <input type="number" min={1} inputMode="numeric" className="form-input text-center font-bold text-lg" value={form.capienza}
                      onChange={e => setForm({ ...form, capienza: parseInt(e.target.value) || 1 })} />
                    <button type="button" className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-100 flex-shrink-0"
                      onClick={() => setForm({ ...form, capienza: (form.capienza || 1) + 1 })}>+</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="form-label">Note</label>
                <input className="form-input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
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
