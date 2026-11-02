import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Paperclip, Eye, X, Download, MapPin, FileText } from 'lucide-react';
import api from '../api';
import PdfViewer from '../components/PdfViewer';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const CATEGORIE = ['Fotografo', 'Videomaker', 'Catering', 'Fiorista', 'Musica', 'Animazione', 'Auto', 'Abito sposa', 'Abito sposo', 'Parrucchiere', 'Makeup', 'Pasticceria', 'Location', 'Chiesa', 'Viaggio di nozze', 'Inviti', 'Bomboniere', 'Decorazioni', 'Altro'];
const STATI = ['in_attesa', 'in_valutazione', 'accettato', 'rifiutato'];
const statoColor = { in_attesa: 'bg-gray-100 text-gray-600', in_valutazione: 'bg-yellow-100 text-yellow-700', accettato: 'bg-green-100 text-green-700', rifiutato: 'bg-red-100 text-red-600' };
const statoLabel = { in_attesa: 'In attesa', in_valutazione: 'In valutazione', accettato: 'Accettato', rifiutato: 'Rifiutato' };
const PREVIEWABLE = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

const empty = { fornitore_id: '', fornitore_nome: '', location_id: '', categoria: 'Fotografo', descrizione: '', importo: '', stato: 'in_attesa', data_scadenza: '', note: '', rate: [] };
const rataVuota = () => ({ id: null, descrizione: '', importo: '', data_scadenza: '', pagata: false, data_pagamento: '' });

const oggi = () => new Date().toISOString().split('T')[0];
const fatturaVuota = { file: null, numero: '', data: '', importo: '' };

const formatEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);

export default function Preventivi() {
  const [items, setItems] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [locations, setLocations] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filtroStato, setFiltroStato] = useState('');
  const [file, setFile] = useState(null);
  const [rimuoviAllegato, setRimuoviAllegato] = useState(false);
  const [preview, setPreview] = useState(null); // { item, url, ext }
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [errore, setErrore] = useState('');
  const [fatturaRata, setFatturaRata] = useState(null); // rata a cui si sta allegando la fattura
  const [fatturaForm, setFatturaForm] = useState(fatturaVuota);
  const [fatturaErrore, setFatturaErrore] = useState('');
  const [fatturaUpload, setFatturaUpload] = useState(false);

  const load = () => {
    api.get('/preventivi').then(r => setItems(r.data));
    api.get('/fornitori').then(r => setFornitori(r.data));
    api.get('/location').then(r => setLocations(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setFile(null); setRimuoviAllegato(false); setErrore(''); setModal(true); };
  const openEdit = p => { setForm({ ...p, fornitore_id: p.fornitore_id || '', location_id: p.location_id || '', importo: p.importo?.toString(), data_scadenza: p.data_scadenza || '', rate: (p.rate || []).map(r => ({ ...r, descrizione: r.descrizione || '', importo: r.importo.toString(), data_scadenza: r.data_scadenza || '', pagata: !!r.pagata, data_pagamento: r.data_pagamento || '' })) }); setEditId(p.id); setFile(null); setRimuoviAllegato(false); setErrore(''); setModal(true); };

  const save = async e => {
    e.preventDefault();
    setErrore('');
    const fd = new FormData();
    fd.append('fornitore_id', form.fornitore_id || '');
    fd.append('fornitore_nome', form.fornitore_nome || '');
    fd.append('categoria', form.categoria);
    fd.append('descrizione', form.descrizione || '');
    fd.append('importo', form.importo);
    fd.append('stato', form.stato);
    fd.append('data_scadenza', form.data_scadenza || '');
    fd.append('note', form.note || '');
    fd.append('location_id', form.location_id || '');
    fd.append('rate', JSON.stringify(form.rate));
    if (file) fd.append('allegato', file);
    else if (rimuoviAllegato) fd.append('rimuovi_allegato', 'true');
    try {
      if (editId) await api.put(`/preventivi/${editId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      else await api.post('/preventivi', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    } catch (err) {
      // Senza catch il modale resterebbe aperto senza spiegazioni e l'errore
      // finirebbe solo in console (es. allegato oltre i 10 MB).
      setErrore(err.response?.data?.error || 'Salvataggio fallito. Riprova.');
      return;
    }
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo preventivo?')) return;
    await api.delete(`/preventivi/${id}`);
    load();
  };

  // L'allegato del preventivo e le fatture delle rate (che sono documenti)
  // passano dallo stesso visualizzatore: cambia solo l'URL di download.
  const urlAllegato = p => p.rata_id ? `/documenti/download/${p.id}` : `/preventivi/download/${p.id}`;

  const scaricaAllegato = async p => {
    const response = await api.get(urlAllegato(p), { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url; a.download = p.nome_file; a.click();
    URL.revokeObjectURL(url);
  };

  const openPreview = async p => {
    const ext = p.nome_file.split('.').pop().toLowerCase();
    if (!PREVIEWABLE.includes(ext)) { setPreview({ item: p, url: null, ext }); return; }
    setLoadingPreview(true);
    try {
      const response = await api.get(urlAllegato(p), { responseType: 'blob' });
      const mime = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const blob = new Blob([response.data], { type: mime });
      setPreview({ item: p, url: URL.createObjectURL(blob), ext });
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const filtered = filtroStato ? items.filter(i => i.stato === filtroStato) : items;
  const accettati = items.filter(i => i.stato === 'accettato');
  const totaleAccettati = accettati.reduce((s, i) => s + i.importo, 0);
  const totalePagato = accettati.reduce((s, i) => s + i.totale_pagato, 0);

  const apriFattura = r => { setFatturaRata(r); setFatturaForm({ ...fatturaVuota, data: oggi(), importo: r.importo }); setFatturaErrore(''); };

  // La fattura si carica subito come documento (categoria Fattura) del fornitore,
  // collegato a questa rata, senza aspettare il salvataggio del preventivo: per questo serve una rata
  // già salvata. Le modifiche in corso nel form del preventivo restano intatte.
  const salvaFattura = async e => {
    e.preventDefault();
    if (!fatturaForm.file) { setFatturaErrore('Seleziona il file della fattura'); return; }
    const r = fatturaRata;
    const chi = nome(form) !== '—' ? nome(form) : '';
    const titolo = ['Fattura', fatturaForm.numero && `n. ${fatturaForm.numero}`, r.descrizione && `– ${r.descrizione}`, chi && `– ${chi}`].filter(Boolean).join(' ');
    const fd = new FormData();
    fd.append('file', fatturaForm.file);
    fd.append('titolo', titolo);
    fd.append('categoria', 'Fattura');
    fd.append('rate_ids', JSON.stringify([r.id]));
    fd.append('numero_fattura', fatturaForm.numero);
    fd.append('data_fattura', fatturaForm.data);
    fd.append('importo_fattura', fatturaForm.importo);
    if (form.fornitore_id) fd.append('fornitore_id', form.fornitore_id);
    setFatturaUpload(true);
    setFatturaErrore('');
    try {
      const { data } = await api.post('/documenti', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, rate: f.rate.map(x => x.id === r.id ? { ...x, fatture: [...(x.fatture || []), { ...data, rata_id: r.id }] } : x) }));
      setFatturaRata(null);
      load();
    } catch (err) {
      setFatturaErrore(err.response?.data?.error || 'Caricamento fallito. Riprova.');
    } finally {
      setFatturaUpload(false);
    }
  };

  // Una fattura non corrisponde per forza a una rata: qui si mostra solo quanto
  // risulta fatturato; a quali rate corrisponde si decide in Documenti.
  const fatturato = p => p.n_fatture > 0 && <span> · Fatturato {formatEuro(p.totale_fatturato)}</span>;

  const setRata = (i, campi) => setForm(f => ({ ...f, rate: f.rate.map((r, j) => j === i ? { ...r, ...campi } : r) }));
  const sommaRate = form.rate.reduce((s, r) => s + (parseFloat(r.importo) || 0), 0);
  const sommaPagata = form.rate.filter(r => r.pagata).reduce((s, r) => s + (parseFloat(r.importo) || 0), 0);
  const nome = p => p.location_nome || p.fornitore_nome || '—';

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Preventivi</h1>
          <p className="page-subtitle">{items.length} preventivi · Accettati: {formatEuro(totaleAccettati)} · Pagato: {formatEuro(totalePagato)} · Da pagare: {formatEuro(totaleAccettati - totalePagato)}</p>
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

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="card text-center py-10 text-gray-400">Nessun preventivo</div>
        )}
        {filtered.map(p => (
          <div key={p.id} className="card p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate flex items-center gap-1">{p.location_id && <MapPin size={13} className="text-rose-400 flex-shrink-0" />}{nome(p)}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="badge bg-gray-100 text-gray-600 text-xs">{p.categoria}</span>
                  <span className={`badge text-xs ${statoColor[p.stato]}`}>{statoLabel[p.stato]}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-gray-900 text-sm">{formatEuro(p.importo)}</div>
                {p.rate.length > 0 && <div className="text-xs text-gray-400">Pagato {formatEuro(p.totale_pagato)} · Resta {formatEuro(p.residuo)}{fatturato(p)}</div>}
              </div>
            </div>
            {p.descrizione && <div className="text-xs text-gray-500 mb-2 truncate">{p.descrizione}</div>}
            {p.data_scadenza && (
              <div className="text-xs text-gray-400 mb-2">Scade il {format(parseISO(p.data_scadenza), 'd MMM yyyy', { locale: it })}</div>
            )}
            <div className="flex gap-1 justify-end border-t border-gray-100 pt-2">
              {p.nome_file && <button className="p-1.5 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600" onClick={() => openPreview(p)} title="Visualizza allegato"><Paperclip size={14} /></button>}
              <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => openEdit(p)}><Pencil size={14} /></button>
              <button className="p-1.5 rounded hover:bg-red-50 text-red-400" onClick={() => del(p.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card hidden sm:block">
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
                  <td className="font-medium text-gray-900"><span className="flex items-center gap-1">{p.location_id && <MapPin size={13} className="text-rose-400 flex-shrink-0" />}{nome(p)}</span></td>
                  <td className="text-gray-500">{p.categoria}</td>
                  <td className="text-gray-600 max-w-xs truncate">{p.descrizione || '—'}</td>
                  <td className="font-bold text-gray-900">
                    {formatEuro(p.importo)}
                    {p.rate.length > 0 && <div className="text-xs font-normal text-gray-400">Pagato {formatEuro(p.totale_pagato)} · Resta {formatEuro(p.residuo)}{fatturato(p)}</div>}
                  </td>
                  <td><span className={`badge ${statoColor[p.stato]}`}>{statoLabel[p.stato]}</span></td>
                  <td className="text-gray-500 text-sm">{p.data_scadenza ? format(parseISO(p.data_scadenza), 'd MMM yyyy', { locale: it }) : '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      {p.nome_file && <button className="p-1.5 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600" onClick={() => openPreview(p)} title="Visualizza allegato"><Paperclip size={14} /></button>}
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

      {/* Modal anteprima allegato */}
      {(preview || loadingPreview) && (
        <div className="modal-overlay modal-overlay-top" onClick={closePreview}>
          <div
            className="modal-preview bg-white shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{preview?.item ? (preview.item.titolo || nome(preview.item)) : 'Allegato'}</p>
                <p className="text-xs text-gray-400 truncate">{preview?.item?.nome_file}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {preview?.item && (
                  <button className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600" onClick={() => scaricaAllegato(preview.item)} title="Scarica">
                    <Download size={18} />
                  </button>
                )}
                <button className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700" onClick={closePreview} title="Chiudi">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center bg-gray-50 p-4">
              {loadingPreview && !preview && (
                <p className="text-gray-400 text-sm">Caricamento anteprima…</p>
              )}
              {preview?.url && preview.ext === 'pdf' && (
                <PdfViewer url={preview.url} />
              )}
              {preview?.url && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(preview.ext) && (
                <img src={preview.url} alt={preview.item.nome_file} className="max-w-full max-h-full object-contain rounded shadow" />
              )}
              {preview && !preview.url && !loadingPreview && (
                <div className="text-center py-12">
                  <p className="text-gray-500 font-medium mb-1">{preview.item.nome_file}</p>
                  <p className="text-gray-400 text-sm mb-5">Anteprima non disponibile per i file .{preview.ext}</p>
                  <button className="btn-primary" onClick={() => scaricaAllegato(preview.item)}>
                    <Download size={14} /> Scarica il file
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Preventivo' : 'Nuovo Preventivo'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Categoria *</label>
                  <select className="form-input" value={form.categoria} onChange={e => {
                    const cat = e.target.value;
                    const stillValid = fornitori.find(f => f.id === parseInt(form.fornitore_id) && f.categoria === cat);
                    setForm({ ...form, categoria: cat, fornitore_id: stillValid ? form.fornitore_id : '', fornitore_nome: stillValid ? form.fornitore_nome : '' });
                  }} required>
                    {CATEGORIE.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Fornitore (opzionale)</label>
                  {(() => {
                    const filt = fornitori.filter(f => f.categoria === form.categoria);
                    return (
                      <select className="form-input" value={form.fornitore_id} onChange={e => {
                        const f = fornitori.find(f => f.id === parseInt(e.target.value));
                        setForm({ ...form, fornitore_id: e.target.value, fornitore_nome: f?.nome || form.fornitore_nome });
                      }}>
                        <option value="">-- Seleziona --</option>
                        {filt.length === 0
                          ? <option disabled>Nessun fornitore per questa categoria</option>
                          : filt.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)
                        }
                      </select>
                    );
                  })()}
                </div>
              </div>
              <div>
                <label className="form-label">Nome Fornitore (se non in lista)</label>
                <input className="form-input" value={form.fornitore_nome} onChange={e => setForm({ ...form, fornitore_nome: e.target.value })} placeholder="Nome azienda..." />
              </div>
              <div>
                <label className="form-label">Location (opzionale)</label>
                <select className="form-input" value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value })}>
                  <option value="">-- Nessuna --</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.tipo})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Descrizione</label>
                <input className="form-input" value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label mb-0">Piano di pagamento</label>
                  <button type="button" className="text-xs text-rose-500 hover:underline flex items-center gap-1" onClick={() => setForm(f => ({ ...f, rate: [...f.rate, rataVuota()] }))}>
                    <Plus size={12} /> Aggiungi rata
                  </button>
                </div>
                {form.rate.length === 0 ? (
                  <p className="text-xs text-gray-400">Nessuna rata. Aggiungi caparra, tranche e saldo per tenere traccia dei pagamenti.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="hidden sm:grid grid-cols-4 gap-2 px-2 text-xs text-gray-400">
                      <span className="col-span-2">Descrizione</span><span>Importo (€)</span><span>Scadenza</span>
                    </div>
                    {form.rate.map((r, i) => (
                      <div key={i} className={`rounded-lg border p-2 ${r.pagata ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <input className="form-input col-span-2" placeholder="es. Caparra, Saldo..." value={r.descrizione} onChange={e => setRata(i, { descrizione: e.target.value })} />
                          <input type="number" step="0.01" min="0.01" className="form-input" placeholder="€" value={r.importo} onChange={e => setRata(i, { importo: e.target.value })} required />
                          <input type="date" className="form-input" title="Scadenza" value={r.data_scadenza} onChange={e => setRata(i, { data_scadenza: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={r.pagata} onChange={e => setRata(i, { pagata: e.target.checked, data_pagamento: e.target.checked ? (r.data_pagamento || new Date().toISOString().split('T')[0]) : '' })} />
                            Pagata
                          </label>
                          {r.pagata && (
                            <input type="date" className="form-input py-1 w-auto" title="Data pagamento" value={r.data_pagamento} onChange={e => setRata(i, { data_pagamento: e.target.value })} />
                          )}
                          <button type="button" className="ml-auto p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => setForm(f => ({ ...f, rate: f.rate.filter((_, j) => j !== i) }))} title="Rimuovi rata">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                          {(r.fatture || []).map(d => (
                            <span key={d.id} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
                              <FileText size={12} className="text-rose-400" />
                              <button type="button" className="hover:text-blue-600 hover:underline" onClick={() => openPreview(d)} title={d.nome_file}>
                                Fattura{d.numero_fattura ? ` n. ${d.numero_fattura}` : ''}{d.data_fattura ? ` del ${format(parseISO(d.data_fattura), 'd/M/yyyy')}` : ''}
                              </button>
                            </span>
                          ))}
                          {r.id ? (
                            <button type="button" className="text-rose-500 hover:underline flex items-center gap-1" onClick={() => apriFattura(r)}>
                              <Paperclip size={12} /> Allega fattura
                            </button>
                          ) : (
                            <span className="text-gray-400">Salva il preventivo per poter allegare la fattura di questa rata.</span>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500">
                      Pagato {formatEuro(sommaPagata)} · Resta {formatEuro((parseFloat(form.importo) || 0) - sommaPagata)}
                    </p>
                    {form.importo && Math.abs(sommaRate - parseFloat(form.importo)) > 0.009 && (
                      <p className="text-xs text-amber-600">Le rate sommano {formatEuro(sommaRate)}, mentre il preventivo è di {formatEuro(parseFloat(form.importo))}.</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">Allegato (es. PDF del preventivo)</label>
                {form.nome_file && !rimuoviAllegato && !file ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <Paperclip size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate flex-1">{form.nome_file}</span>
                    <button type="button" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-500" onClick={() => openPreview(form)} title="Visualizza"><Eye size={14} /></button>
                    <button type="button" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-500" onClick={() => setRimuoviAllegato(true)} title="Rimuovi"><X size={14} /></button>
                  </div>
                ) : (
                  <div>
                    <input type="file" accept="application/pdf,image/*" className="form-input" onChange={e => { setFile(e.target.files[0]); setRimuoviAllegato(false); }} />
                    {rimuoviAllegato && !file && <p className="text-xs text-gray-400 mt-1">L'allegato verrà rimosso al salvataggio.</p>}
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">Note</label>
                <textarea className="form-input" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              {errore && <p className="text-sm text-red-500">{errore}</p>}
              <div className="flex gap-2 pt-3 -mx-4 sm:-mx-6 px-4 sm:px-6 sticky bottom-0 bg-white border-t border-gray-100">
                <button type="submit" className="btn-primary">Salva</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {fatturaRata && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setFatturaRata(null)}>
          <div className="modal">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Allega fattura</h2>
            <p className="text-sm text-gray-500 mb-4">{fatturaRata.descrizione || 'Rata'} · {formatEuro(parseFloat(fatturaRata.importo))}{nome(form) !== '—' && ` · ${nome(form)}`}</p>
            <form onSubmit={salvaFattura} className="space-y-3">
              <div>
                <label className="form-label">File della fattura *</label>
                <input type="file" accept="application/pdf,image/*,.xml,.p7m" className="form-input" onChange={e => setFatturaForm({ ...fatturaForm, file: e.target.files[0] })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Numero fattura</label>
                  <input className="form-input" value={fatturaForm.numero} onChange={e => setFatturaForm({ ...fatturaForm, numero: e.target.value })} placeholder="es. 12/2026" />
                </div>
                <div>
                  <label className="form-label">Data fattura</label>
                  <input type="date" className="form-input" value={fatturaForm.data} onChange={e => setFatturaForm({ ...fatturaForm, data: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Importo (€)</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={fatturaForm.importo} onChange={e => setFatturaForm({ ...fatturaForm, importo: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-gray-400">La fattura viene salvata subito e la trovi in Documenti, nella categoria Fattura: da lì puoi cambiare a quali rate corrisponde.</p>
              {fatturaErrore && <p className="text-sm text-red-500">{fatturaErrore}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary" disabled={fatturaUpload}>{fatturaUpload ? 'Caricamento...' : 'Allega'}</button>
                <button type="button" className="btn-secondary" onClick={() => setFatturaRata(null)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
