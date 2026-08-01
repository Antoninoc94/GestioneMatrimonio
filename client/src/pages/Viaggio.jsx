import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Plane } from 'lucide-react';
import api from '../api';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const TIPI = ['volo', 'hotel', 'escursione', 'trasporto', 'ristorante', 'altro'];
const STATI = ['da_prenotare', 'prenotato', 'pagato', 'completato'];
const tipoEmoji = { volo: '✈️', hotel: '🏨', escursione: '🗺️', trasporto: '🚗', ristorante: '🍽️', altro: '📌' };
const tipoLabel = { volo: 'Volo', hotel: 'Hotel', escursione: 'Escursione', trasporto: 'Trasporto', ristorante: 'Ristorante', altro: 'Altro' };
const statoColor = { da_prenotare: 'bg-gray-100 text-gray-600', prenotato: 'bg-blue-100 text-blue-700', pagato: 'bg-green-100 text-green-700', completato: 'bg-purple-100 text-purple-700' };
const statoLabel = { da_prenotare: 'Da prenotare', prenotato: 'Prenotato', pagato: 'Pagato', completato: 'Completato' };

const formatEuro = n => n ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n) : null;
const fmtDate = d => d ? format(parseISO(d), 'd MMM yyyy', { locale: it }) : null;

const empty = { tipo: 'volo', titolo: '', luogo: '', data_inizio: '', data_fine: '', costo: '', numero_prenotazione: '', stato: 'da_prenotare', note: '' };

export default function Viaggio() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get('/viaggio').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setModal(true); };
  const openEdit = i => { setForm({ ...i, costo: i.costo?.toString() || '', data_inizio: i.data_inizio || '', data_fine: i.data_fine || '' }); setEditId(i.id); setModal(true); };

  const save = async e => {
    e.preventDefault();
    const payload = { ...form, costo: form.costo ? parseFloat(form.costo) : null };
    if (editId) await api.put(`/viaggio/${editId}`, payload);
    else await api.post('/viaggio', payload);
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo elemento?')) return;
    await api.delete(`/viaggio/${id}`);
    load();
  };

  const totaleCosto = items.reduce((s, i) => s + (i.costo || 0), 0);
  const byTipo = TIPI.filter(t => items.some(i => i.tipo === t));

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Viaggio di Nozze</h1>
          <p className="page-subtitle">{items.length} elementi · Budget: {formatEuro(totaleCosto) || '€0'}</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Aggiungi</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {STATI.map(s => (
          <div key={s} className="card text-center py-3">
            <div className="text-xl font-bold text-gray-800">{items.filter(i => i.stato === s).length}</div>
            <div className="text-xs text-gray-400 mt-0.5">{statoLabel[s]}</div>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Plane size={40} className="mx-auto mb-2 opacity-30" />
          <p>Nessun elemento. Inizia a pianificare il tuo viaggio!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {TIPI.map(tipo => {
            const gruppo = items.filter(i => i.tipo === tipo);
            if (gruppo.length === 0) return null;
            return (
              <div key={tipo}>
                <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">
                  {tipoEmoji[tipo]} {tipoLabel[tipo]}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {gruppo.map(item => (
                    <div key={item.id} className="card group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{item.titolo}</h3>
                          {item.luogo && <p className="text-sm text-gray-500">📍 {item.luogo}</p>}
                        </div>
                        <span className={`badge ${statoColor[item.stato]}`}>{statoLabel[item.stato]}</span>
                      </div>

                      {(item.data_inizio || item.data_fine) && (
                        <div className="text-sm text-gray-500 mb-1">
                          📅 {fmtDate(item.data_inizio)}{item.data_fine && item.data_fine !== item.data_inizio ? ` → ${fmtDate(item.data_fine)}` : ''}
                        </div>
                      )}
                      {item.costo && (
                        <div className="text-sm font-semibold text-gray-700 mb-1">{formatEuro(item.costo)}</div>
                      )}
                      {item.numero_prenotazione && (
                        <div className="text-xs text-gray-400 font-mono bg-gray-50 rounded px-2 py-1 mb-1">
                          Prenotazione: {item.numero_prenotazione}
                        </div>
                      )}
                      {item.note && <p className="text-xs text-gray-400 italic mt-1">{item.note}</p>}

                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button className="btn-secondary text-xs py-1 px-3" onClick={() => openEdit(item)}><Pencil size={13} /> Modifica</button>
                        <button className="btn-danger text-xs py-1 px-3" onClick={() => del(item.id)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Elemento' : 'Nuovo Elemento'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {TIPI.map(t => <option key={t} value={t}>{tipoEmoji[t]} {tipoLabel[t]}</option>)}
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
                <label className="form-label">Titolo *</label>
                <input className="form-input" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} required placeholder="Es. Volo Napoli → Maldive" />
              </div>
              <div>
                <label className="form-label">Luogo / Destinazione</label>
                <input className="form-input" value={form.luogo} onChange={e => setForm({ ...form, luogo: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Data inizio</label>
                  <input type="date" className="form-input" value={form.data_inizio} onChange={e => setForm({ ...form, data_inizio: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Data fine</label>
                  <input type="date" className="form-input" value={form.data_fine} onChange={e => setForm({ ...form, data_fine: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Costo (€)</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.costo} onChange={e => setForm({ ...form, costo: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">N° Prenotazione</label>
                  <input className="form-input" value={form.numero_prenotazione} onChange={e => setForm({ ...form, numero_prenotazione: e.target.value })} />
                </div>
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
