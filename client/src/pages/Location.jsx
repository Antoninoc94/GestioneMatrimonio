import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Globe, Phone, Mail, Users, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';

const TIPI = ['Ricevimento', 'Chiesa', 'Municipio', 'Cerimonia civile', 'Altro'];
const STATI = ['in_valutazione', 'visitato', 'confermato', 'escluso'];
const statoColor = { in_valutazione: 'bg-gray-100 text-gray-600', visitato: 'bg-blue-100 text-blue-600', confermato: 'bg-green-100 text-green-700', escluso: 'bg-red-100 text-red-600' };
const statoLabel = { in_valutazione: 'In valutazione', visitato: 'Visitato', confermato: 'Confermato', escluso: 'Escluso' };

const empty = { tipo: 'Ricevimento', nome: '', indirizzo: '', contatto: '', telefono: '', email: '', sito_web: '', capienza: '', costo: '', stato: 'in_valutazione', note: '', prezzo_adulto: '', fasce: [] };

const formatEuro = n => n ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n) : null;
// Come formatEuro ma mostra anche lo zero ("gratis" nelle stime è un'informazione)
const eur = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);
const pct = (parte, tot) => tot > 0 ? `${Math.round((parte / tot) * 100)}%` : '—';

const tariffaLabel = f => f.tipo === 'fisso' ? eur(f.valore) : f.valore === 0 ? 'gratis' : `${f.valore}%`;

export default function Location() {
  const [items, setItems] = useState([]);
  const [preventivi, setPreventivi] = useState([]);
  const [stime, setStime] = useState([]);
  const [dettaglio, setDettaglio] = useState(null); // stima aperta nel modale
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [errore, setErrore] = useState('');

  const load = () => {
    api.get('/location').then(r => setItems(r.data));
    api.get('/preventivi').then(r => setPreventivi(r.data));
    api.get('/location/stime').then(r => setStime(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setErrore(''); setModal(true); };
  const openEdit = l => {
    setForm({
      ...l,
      capienza: l.capienza?.toString() || '',
      costo: l.costo?.toString() || '',
      prezzo_adulto: l.prezzo_adulto?.toString() || '',
      fasce: (l.fasce || []).map(f => ({ eta_da: f.eta_da.toString(), eta_a: f.eta_a.toString(), tipo: f.tipo, valore: f.valore.toString() })),
    });
    setEditId(l.id); setErrore(''); setModal(true);
  };

  const save = async e => {
    e.preventDefault();
    setErrore('');
    const payload = { ...form, capienza: form.capienza ? parseInt(form.capienza) : null, costo: form.costo ? parseFloat(form.costo) : null, prezzo_adulto: form.prezzo_adulto ? parseFloat(form.prezzo_adulto) : null };
    try {
      if (editId) await api.put(`/location/${editId}`, payload);
      else await api.post('/location', payload);
    } catch (err) {
      setErrore(err.response?.data?.error || 'Salvataggio fallito. Riprova.');
      return;
    }
    setModal(false);
    load();
  };

  const setFascia = (i, campi) => setForm(f => ({ ...f, fasce: f.fasce.map((x, j) => j === i ? { ...x, ...campi } : x) }));
  const nuovaFascia = () => setForm(f => {
    // La nuova fascia parte dove finisce l'ultima: è il caso tipico (0-4, 5-8, ...)
    const ultima = f.fasce[f.fasce.length - 1];
    const da = ultima ? (parseInt(ultima.eta_a) || 0) + 1 : 0;
    return { ...f, fasce: [...f.fasce, { eta_da: da.toString(), eta_a: (da + 3).toString(), tipo: 'percentuale', valore: '50' }] };
  });

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

      {stime.length >= 2 && (
        <div className="card mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Confronto location sulla vostra lista ospiti</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>A persona</th>
                  <th>Invitati</th>
                  <th>Confermati</th>
                  <th>Di cui bambini</th>
                </tr>
              </thead>
              <tbody>
                {[...stime].sort((a, b) => a.invitati.totale - b.invitati.totale).map(s => (
                  <tr key={s.location_id} className="cursor-pointer hover:bg-rose-50" onClick={() => setDettaglio(s)}>
                    <td className="font-medium text-gray-900">{s.nome}</td>
                    <td className="text-gray-500">{eur(s.prezzo_adulto)}</td>
                    <td className="font-bold text-gray-900">{eur(s.invitati.totale)}</td>
                    <td className="text-gray-700">{eur(s.confermati.totale)}</td>
                    <td className="text-gray-500">{eur(s.invitati.totale_bambini)} <span className="text-xs">({pct(s.invitati.totale_bambini, s.invitati.totale)})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  {(() => {
                    const s = stime.find(x => x.location_id === l.id);
                    if (!s) return null;
                    return (
                      <button type="button" onClick={() => setDettaglio(s)} className="w-full text-left text-xs my-2 px-2 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-gray-600">
                        <div className="flex justify-between"><span>Stima ({eur(s.prezzo_adulto)} a persona)</span><span className="text-rose-500 font-semibold">Dettaglio →</span></div>
                        <div className="mt-0.5">
                          Invitati: <strong className="text-gray-800">{eur(s.invitati.totale)}</strong> · Confermati: <strong className="text-gray-800">{eur(s.confermati.totale)}</strong>
                        </div>
                      </button>
                    );
                  })()}
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
                  {preventivi.filter(p => p.location_id === l.id).map(p => (
                    <Link key={p.id} to="/preventivi" className="flex items-center gap-1.5 text-xs mt-2 px-2 py-1.5 rounded bg-gray-50 hover:bg-rose-50 text-gray-600">
                      <FileText size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate flex-1">{p.descrizione || p.categoria}</span>
                      <span className="font-semibold text-gray-700">{formatEuro(p.importo)}</span>
                      {p.rate.length > 0 && <span className="text-gray-400">· resta {formatEuro(p.residuo) || '0 €'}</span>}
                    </Link>
                  ))}
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

      {dettaglio && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDettaglio(null)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900">{dettaglio.nome}</h2>
            <p className="text-sm text-gray-500 mb-4">Stima del costo a persona: {eur(dettaglio.prezzo_adulto)} per adulto</p>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Tariffa</th>
                    <th className="text-right">Invitati</th>
                    <th className="text-right">Confermati</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium">Adulti</td>
                    <td className="text-gray-500">{eur(dettaglio.prezzo_adulto)}</td>
                    {[dettaglio.invitati, dettaglio.confermati].map((g, k) => (
                      <td key={k} className="text-right">{g.adulti} · <strong>{eur(g.adulti * dettaglio.prezzo_adulto)}</strong></td>
                    ))}
                  </tr>
                  {dettaglio.invitati.fasce.map((f, i) => (
                    <tr key={i}>
                      <td className="font-medium">{f.eta_da}–{f.eta_a} anni</td>
                      <td className="text-gray-500">{tariffaLabel(f)}</td>
                      {[dettaglio.invitati, dettaglio.confermati].map((g, k) => (
                        <td key={k} className="text-right">{g.fasce[i].n} · <strong>{eur(g.fasce[i].totale)}</strong></td>
                      ))}
                    </tr>
                  ))}
                  {(dettaglio.invitati.senza_eta > 0 || dettaglio.confermati.senza_eta > 0) && (
                    <tr className="text-amber-700">
                      <td className="font-medium">⚠️ Bambini senza età</td>
                      <td className="text-xs">contati da adulto</td>
                      {[dettaglio.invitati, dettaglio.confermati].map((g, k) => (
                        <td key={k} className="text-right">{g.senza_eta} · <strong>{eur(g.senza_eta * dettaglio.prezzo_adulto)}</strong></td>
                      ))}
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-200">
                    <td className="font-bold">Totale</td>
                    <td></td>
                    {[dettaglio.invitati, dettaglio.confermati].map((g, k) => (
                      <td key={k} className="text-right">{g.persone} · <strong className="text-rose-600">{eur(g.totale)}</strong></td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {dettaglio.invitati.fasce.length > 0 && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 space-y-1">
                <p>
                  Sugli invitati i bambini vi costano <strong>{eur(dettaglio.invitati.totale_bambini)}</strong> ({pct(dettaglio.invitati.totale_bambini, dettaglio.invitati.totale)} del totale);
                  se pagassero come adulti sarebbero <strong>{eur(dettaglio.invitati.bambini_come_adulti)}</strong>.
                </p>
                {dettaglio.invitati.senza_eta > 0 && (
                  <p className="text-amber-700">
                    {dettaglio.invitati.senza_eta} {dettaglio.invitati.senza_eta === 1 ? 'bambino non ha' : 'bambini non hanno'} l'età in Lista Ospiti: inseritela per una stima più precisa.
                  </p>
                )}
              </div>
            )}
            {dettaglio.invitati.fasce.length === 0 && (
              <p className="mt-4 text-sm text-gray-500">Questa location non ha fasce bambini: tutti pagano da adulto. Aggiungile da "Modifica".</p>
            )}
            <p className="mt-3 text-xs text-gray-400">Invitati = tutta la lista esclusi quelli che hanno declinato. Solo la parte a persona: costi fissi ed extra restano nel preventivo.</p>
            <div className="flex pt-4">
              <button type="button" className="btn-secondary" onClick={() => setDettaglio(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

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
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
                <div>
                  <label className="form-label">Prezzo a persona, adulto (€)</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.prezzo_adulto} onChange={e => setForm({ ...form, prezzo_adulto: e.target.value })} placeholder="es. 95" />
                  <p className="text-xs text-gray-400 mt-1">Serve a stimare il costo sulla vostra lista ospiti</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="form-label mb-0">Fasce bambini</span>
                  <button type="button" className="text-xs text-rose-500 hover:underline flex items-center gap-1" onClick={nuovaFascia}><Plus size={12} /> Aggiungi fascia</button>
                </div>
                {form.fasce.length === 0 && <p className="text-xs text-gray-400">Nessuna fascia: tutti pagano da adulto.</p>}
                {form.fasce.map((f, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="text-gray-500">da</span>
                    <input type="number" min="0" className="form-input w-16 py-1" value={f.eta_da} onChange={e => setFascia(i, { eta_da: e.target.value })} required />
                    <span className="text-gray-500">a</span>
                    <input type="number" min="0" className="form-input w-16 py-1" value={f.eta_a} onChange={e => setFascia(i, { eta_a: e.target.value })} required />
                    <span className="text-gray-500">anni:</span>
                    <input type="number" step="0.01" min="0" className="form-input w-20 py-1" value={f.valore} onChange={e => setFascia(i, { valore: e.target.value })} required />
                    <select className="form-input w-auto py-1" value={f.tipo} onChange={e => setFascia(i, { tipo: e.target.value })}>
                      <option value="percentuale">% del prezzo</option>
                      <option value="fisso">€ fissi</option>
                    </select>
                    <button type="button" className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => setForm(x => ({ ...x, fasce: x.fasce.filter((_, j) => j !== i) }))} title="Rimuovi fascia"><Trash2 size={14} /></button>
                  </div>
                ))}
                {form.fasce.length > 0 && <p className="text-xs text-gray-400">Gratis = 0%. Chi non rientra in nessuna fascia paga da adulto.</p>}
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
              {errore && <p className="text-sm text-red-500">{errore}</p>}
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
