import { useEffect, useState, useRef } from 'react';
import { Upload, Trash2, Download, FolderOpen, X, Pencil } from 'lucide-react';
import api from '../api';
import PdfViewer from '../components/PdfViewer';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const toUtc = s => s && !s.endsWith('Z') ? s.replace(' ', 'T') + 'Z' : s;

const CATEGORIE = ['Contratto', 'Preventivo', 'Fattura', 'Ricevuta', 'Certificato', 'Permesso', 'Foto ispirazione', 'Altro'];

const empty = { titolo: '', categoria: 'Contratto', fornitore_id: '', note: '', numero_fattura: '', data_fattura: '', importo_fattura: '', rate_ids: [] };

const formatEuro = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);

const iconExt = ext => {
  if (['pdf'].includes(ext)) return '📄';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  return '📎';
};

const formatSize = bytes => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const PREVIEWABLE = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

export default function Documenti() {
  const [items, setItems] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [preventivi, setPreventivi] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errore, setErrore] = useState('');
  const [filtro, setFiltro] = useState('');
  const [preview, setPreview] = useState(null); // { doc, url, ext }
  const [loadingPreview, setLoadingPreview] = useState(false);
  const fileRef = useRef();

  const load = () => {
    api.get('/documenti').then(r => setItems(r.data));
    api.get('/fornitori').then(r => setFornitori(r.data));
    api.get('/preventivi').then(r => setPreventivi(r.data));
  };
  useEffect(() => { load(); }, []);

  const openUpload = () => { setForm(empty); setEditId(null); setFile(null); setErrore(''); setModal(true); };
  const openEdit = d => {
    setForm({
      titolo: d.titolo, categoria: d.categoria, fornitore_id: d.fornitore_id || '', note: d.note || '',
      numero_fattura: d.numero_fattura || '', data_fattura: d.data_fattura || '',
      importo_fattura: d.importo_fattura?.toString() || '', rate_ids: d.rate.map(r => r.id),
    });
    setEditId(d.id); setFile(null); setErrore(''); setModal(true);
  };

  const save = async e => {
    e.preventDefault();
    if (!editId && !file) return alert('Seleziona un file');
    setUploading(true);
    setErrore('');
    // Numero, data, importo e rate collegate hanno senso solo per le fatture.
    const fattura = form.categoria === 'Fattura';
    const campiFattura = {
      numero_fattura: fattura ? form.numero_fattura : '',
      data_fattura: fattura ? form.data_fattura : '',
      importo_fattura: fattura ? form.importo_fattura : '',
      rate_ids: fattura ? form.rate_ids : [],
    };
    try {
      if (editId) {
        await api.put(`/documenti/${editId}`, { titolo: form.titolo, categoria: form.categoria, fornitore_id: form.fornitore_id || null, note: form.note, ...campiFattura });
        setModal(false);
        load();
        return;
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('titolo', form.titolo || file.name);
      fd.append('categoria', form.categoria);
      if (form.fornitore_id) fd.append('fornitore_id', form.fornitore_id);
      if (form.note) fd.append('note', form.note);
      fd.append('numero_fattura', campiFattura.numero_fattura);
      fd.append('data_fattura', campiFattura.data_fattura);
      fd.append('importo_fattura', campiFattura.importo_fattura);
      fd.append('rate_ids', JSON.stringify(campiFattura.rate_ids));
      await api.post('/documenti', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setModal(false);
      load();
    } catch (err) {
      // Senza questo il modale resta aperto senza spiegazioni: il messaggio del
      // server (es. "File troppo grande") non arriverebbe mai all'utente.
      setErrore(err.response?.data?.error || 'Caricamento fallito. Riprova.');
    } finally {
      setUploading(false);
    }
  };

  const del = async id => {
    if (!confirm('Eliminare questo documento?')) return;
    await api.delete(`/documenti/${id}`);
    load();
  };

  const download = async doc => {
    const response = await api.get(`/documenti/download/${doc.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url; a.download = doc.nome_file; a.click();
    URL.revokeObjectURL(url);
  };

  const openPreview = async (d) => {
    const ext = d.nome_file.split('.').pop().toLowerCase();
    if (!PREVIEWABLE.includes(ext)) {
      setPreview({ doc: d, url: null, ext });
      return;
    }
    setLoadingPreview(true);
    try {
      const response = await api.get(`/documenti/download/${d.id}`, { responseType: 'blob' });
      const mime = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const blob = new Blob([response.data], { type: mime });
      setPreview({ doc: d, url: URL.createObjectURL(blob), ext });
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const filtered = items.filter(i =>
    !filtro || [i.titolo, i.categoria, i.fornitore_nome, i.numero_fattura].some(v => v?.toLowerCase().includes(filtro.toLowerCase()))
  );

  const byCategoria = CATEGORIE.filter(c => filtered.some(i => i.categoria === c));

  // Rate dei preventivi accettati a cui può corrispondere una fattura; se è scelto
  // un fornitore si mostrano solo le sue. Quelle già collegate restano sempre in
  // lista, così si possono anche scollegare.
  const rateCollegabili = preventivi
    .flatMap(p => p.rate.map(r => ({ ...r, preventivo: p, chi: p.location_nome || p.fornitore_nome || p.categoria })))
    .filter(r => form.rate_ids.includes(r.id) ||
      (r.preventivo.stato === 'accettato' && (!form.fornitore_id || r.preventivo.fornitore_id === parseInt(form.fornitore_id))));
  const toggleRata = id => setForm(f => ({ ...f, rate_ids: f.rate_ids.includes(id) ? f.rate_ids.filter(x => x !== id) : [...f.rate_ids, id] }));

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Documenti</h1>
          <p className="page-subtitle">{items.length} documenti caricati</p>
        </div>
        <button className="btn-primary" onClick={openUpload}><Upload size={16} /> Carica Documento</button>
      </div>

      <div className="card mb-4">
        <input className="form-input" placeholder="Cerca documento..." value={filtro} onChange={e => setFiltro(e.target.value)} />
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-12 text-gray-400">
          <FolderOpen size={40} className="mx-auto mb-2 opacity-30" />
          <p>Nessun documento. Carica il primo!</p>
        </div>
      )}

      {byCategoria.map(cat => (
        <div key={cat} className="mb-6">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">{cat}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.filter(i => i.categoria === cat).map(d => {
              const ext = d.nome_file.split('.').pop().toLowerCase();
              return (
                <div
                  key={d.id}
                  className="card flex items-center gap-3 group py-3 cursor-pointer hover:border-rose-200 hover:shadow-sm transition-all"
                  onClick={() => openPreview(d)}
                >
                  <div className="text-2xl flex-shrink-0">{iconExt(ext)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{d.titolo}</p>
                    <p className="text-xs text-gray-400 truncate">{d.nome_file}</p>
                    {d.fornitore_nome && <p className="text-xs text-gray-500 truncate">{d.fornitore_nome}</p>}
                    {(d.numero_fattura || d.data_fattura || d.importo_fattura) && (
                      <p className="text-xs text-gray-500 truncate">
                        Fattura{d.numero_fattura ? ` n. ${d.numero_fattura}` : ''}{d.data_fattura ? ` del ${format(parseISO(d.data_fattura), 'd MMM yyyy', { locale: it })}` : ''}{d.importo_fattura ? ` · ${formatEuro(d.importo_fattura)}` : ''}
                      </p>
                    )}
                    {d.rate.length > 0 && (
                      <p className="text-xs text-rose-500 truncate" title={d.rate.map(r => `${r.descrizione || 'Rata'} – ${r.preventivo_nome}`).join('\n')}>
                        Per: {d.rate.map(r => `${r.descrizione || 'Rata'} (${formatEuro(r.importo)})`).join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-300 mt-0.5">
                      {d.dimensione && <span>{formatSize(d.dimensione)}</span>}
                      <span>{format(parseISO(toUtc(d.created_at)), 'd MMM yyyy', { locale: it })}</span>
                    </div>
                    {d.note && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{d.note}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500" onClick={() => download(d)} title="Scarica"><Download size={14} /></button>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700" onClick={() => openEdit(d)} title="Modifica"><Pencil size={14} /></button>
                    <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => del(d.id)} title="Elimina"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Modal anteprima */}
      {(preview || loadingPreview) && (
        <div className="modal-overlay modal-overlay-top" onClick={closePreview}>
          <div
            className="modal-preview bg-white shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
              {preview && <span className="text-xl">{iconExt(preview.ext)}</span>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{preview?.doc?.titolo}</p>
                <p className="text-xs text-gray-400 truncate">{preview?.doc?.nome_file}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {preview?.doc && (
                  <button
                    className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                    onClick={() => download(preview.doc)}
                    title="Scarica"
                  >
                    <Download size={18} />
                  </button>
                )}
                <button className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700" onClick={closePreview} title="Chiudi">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Contenuto */}
            <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center bg-gray-50 p-4">
              {loadingPreview && !preview && (
                <p className="text-gray-400 text-sm">Caricamento anteprima…</p>
              )}
              {preview?.url && preview.ext === 'pdf' && (
                <PdfViewer url={preview.url} />
              )}
              {preview?.url && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(preview.ext) && (
                <img
                  src={preview.url}
                  alt={preview.doc.titolo}
                  className="max-w-full max-h-full object-contain rounded shadow"
                />
              )}
              {preview && !preview.url && !loadingPreview && (
                <div className="text-center py-12">
                  <span className="text-6xl block mb-4">{iconExt(preview.ext)}</span>
                  <p className="text-gray-500 font-medium mb-1">{preview.doc.titolo}</p>
                  <p className="text-gray-400 text-sm mb-5">Anteprima non disponibile per i file .{preview.ext}</p>
                  <button className="btn-primary" onClick={() => download(preview.doc)}>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Modifica Documento' : 'Carica Documento'}</h2>
            <form onSubmit={save} className="space-y-3">
              {!editId && (
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-rose-300 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); }}
                >
                  <Upload size={24} className="mx-auto text-gray-300 mb-2" />
                  {file ? (
                    <p className="text-sm font-medium text-gray-700">{file.name} ({formatSize(file.size)})</p>
                  ) : (
                    <p className="text-sm text-gray-400">Clicca o trascina un file qui<br /><span className="text-xs">PDF, Word, Excel, Immagini (max 10 MB)</span></p>
                  )}
                  <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
                </div>
              )}
              <div>
                <label className="form-label">Titolo{editId && ' *'}</label>
                <input className="form-input" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} placeholder="es. Contratto fotografo" required={!!editId} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Categoria</label>
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
              {form.categoria === 'Fattura' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="form-label">Numero fattura</label>
                      <input className="form-input" value={form.numero_fattura} onChange={e => setForm({ ...form, numero_fattura: e.target.value })} placeholder="es. 12/2026" />
                    </div>
                    <div>
                      <label className="form-label">Data fattura</label>
                      <input type="date" className="form-input" value={form.data_fattura} onChange={e => setForm({ ...form, data_fattura: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Importo (€)</label>
                      <input type="number" step="0.01" min="0" className="form-input" value={form.importo_fattura} onChange={e => setForm({ ...form, importo_fattura: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">A cosa corrisponde (opzionale)</label>
                    {rateCollegabili.length === 0 ? (
                      <p className="text-xs text-gray-400">Nessuna rata di preventivi accettati{form.fornitore_id ? ' per questo fornitore' : ''}. Puoi descrivere la fattura nelle note.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-gray-100 p-2">
                        {rateCollegabili.map(r => (
                          <label key={r.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={form.rate_ids.includes(r.id)} onChange={() => toggleRata(r.id)} />
                            <span className="truncate">{r.chi} – {r.descrizione || 'Rata'} ({formatEuro(r.importo)})</span>
                            <span className={`ml-auto text-xs flex-shrink-0 ${r.pagata ? 'text-green-600' : 'text-gray-400'}`}>{r.pagata ? 'pagata' : 'da pagare'}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Una fattura può coprire più rate, oppure nessuna (es. un extra).</p>
                  </div>
                </>
              )}
              <div>
                <label className="form-label">Note</label>
                <textarea className="form-input" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              {errore && <p className="text-sm text-red-500">{errore}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Salvataggio...' : editId ? 'Salva' : 'Carica'}</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
