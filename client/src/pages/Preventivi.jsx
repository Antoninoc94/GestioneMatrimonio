import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Paperclip, Eye, X, Download } from 'lucide-react';
import api from '../api';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const CATEGORIE = ['Fotografo', 'Videomaker', 'Catering', 'Fiorista', 'Musica', 'Animazione', 'Auto', 'Abito sposa', 'Abito sposo', 'Parrucchiere', 'Makeup', 'Pasticceria', 'Location', 'Chiesa', 'Viaggio di nozze', 'Inviti', 'Bomboniere', 'Decorazioni', 'Altro'];
const STATI = ['in_attesa', 'in_valutazione', 'accettato', 'rifiutato'];
const statoColor = { in_attesa: 'bg-gray-100 text-gray-600', in_valutazione: 'bg-yellow-100 text-yellow-700', accettato: 'bg-green-100 text-green-700', rifiutato: 'bg-red-100 text-red-600' };
const statoLabel = { in_attesa: 'In attesa', in_valutazione: 'In valutazione', accettato: 'Accettato', rifiutato: 'Rifiutato' };
const PREVIEWABLE = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

const empty = { fornitore_id: '', fornitore_nome: '', categoria: 'Fotografo', descrizione: '', importo: '', stato: 'in_attesa', data_scadenza: '', note: '', anticipo: '', data_anticipo: '' };

const formatEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);

export default function Preventivi() {
  const [items, setItems] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [filtroStato, setFiltroStato] = useState('');
  const [file, setFile] = useState(null);
  const [rimuoviAllegato, setRimuoviAllegato] = useState(false);
  const [preview, setPreview] = useState(null); // { item, url, ext }
  const [loadingPreview, setLoadingPreview] = useState(false);

  const load = () => {
    api.get('/preventivi').then(r => setItems(r.data));
    api.get('/fornitori').then(r => setFornitori(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setFile(null); setRimuoviAllegato(false); setModal(true); };
  const openEdit = p => { setForm({ ...p, fornitore_id: p.fornitore_id || '', importo: p.importo?.toString(), data_scadenza: p.data_scadenza || '', anticipo: p.anticipo != null ? p.anticipo.toString() : '', data_anticipo: p.data_anticipo || '' }); setEditId(p.id); setFile(null); setRimuoviAllegato(false); setModal(true); };

  const save = async e => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('fornitore_id', form.fornitore_id || '');
    fd.append('fornitore_nome', form.fornitore_nome || '');
    fd.append('categoria', form.categoria);
    fd.append('descrizione', form.descrizione || '');
    fd.append('importo', form.importo);
    fd.append('stato', form.stato);
    fd.append('data_scadenza', form.data_scadenza || '');
    fd.append('note', form.note || '');
    fd.append('anticipo', form.anticipo || '');
    fd.append('data_anticipo', form.data_anticipo || '');
    if (file) fd.append('allegato', file);
    else if (rimuoviAllegato) fd.append('rimuovi_allegato', 'true');
    if (editId) await api.put(`/preventivi/${editId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    else await api.post('/preventivi', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setModal(false);
    load();
  };

  const del = async id => {
    if (!confirm('Eliminare questo preventivo?')) return;
    await api.delete(`/preventivi/${id}`);
    load();
  };

  const scaricaAllegato = async p => {
    const response = await api.get(`/preventivi/download/${p.id}`, { responseType: 'blob' });
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
      const response = await api.get(`/preventivi/download/${p.id}`, { responseType: 'blob' });
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

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="card text-center py-10 text-gray-400">Nessun preventivo</div>
        )}
        {filtered.map(p => (
          <div key={p.id} className="card p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{p.fornitore_nome || '—'}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="badge bg-gray-100 text-gray-600 text-xs">{p.categoria}</span>
                  <span className={`badge text-xs ${statoColor[p.stato]}`}>{statoLabel[p.stato]}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-gray-900 text-sm">{formatEuro(p.importo)}</div>
                {p.anticipo > 0 && <div className="text-xs text-gray-400">Anticipo {formatEuro(p.anticipo)}</div>}
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
                  <td className="font-medium text-gray-900">{p.fornitore_nome || '—'}</td>
                  <td className="text-gray-500">{p.categoria}</td>
                  <td className="text-gray-600 max-w-xs truncate">{p.descrizione || '—'}</td>
                  <td className="font-bold text-gray-900">
                    {formatEuro(p.importo)}
                    {p.anticipo > 0 && <div className="text-xs font-normal text-gray-400">Anticipo {formatEuro(p.anticipo)}</div>}
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
        <div className="modal-overlay" onClick={closePreview}>
          <div
            className="modal-preview bg-white shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{preview?.item?.fornitore_nome || 'Allegato'}</p>
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
                <iframe src={preview.url} title={preview.item.nome_file} className="w-full h-full rounded" style={{ border: 'none' }} />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Anticipo versato (€)</label>
                  <input type="number" step="0.01" min="0" className="form-input" value={form.anticipo} onChange={e => setForm({ ...form, anticipo: e.target.value })} />
                  {form.anticipo && form.importo && (
                    <p className="text-xs text-gray-400 mt-1">Saldo residuo: {formatEuro(parseFloat(form.importo) - parseFloat(form.anticipo))}</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Data anticipo</label>
                  <input type="date" className="form-input" value={form.data_anticipo} onChange={e => setForm({ ...form, data_anticipo: e.target.value })} />
                </div>
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
