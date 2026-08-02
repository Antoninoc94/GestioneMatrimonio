import { useEffect, useState, useRef } from 'react';
import { Upload, Trash2, Download, FolderOpen, X, Eye } from 'lucide-react';
import api from '../api';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const toUtc = s => s && !s.endsWith('Z') ? s.replace(' ', 'T') + 'Z' : s;

const CATEGORIE = ['Contratto', 'Preventivo', 'Ricevuta', 'Certificato', 'Permesso', 'Foto ispirazione', 'Altro'];

const empty = { titolo: '', categoria: 'Contratto', fornitore_id: '', note: '' };

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
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [preview, setPreview] = useState(null); // { doc, url, ext }
  const [loadingPreview, setLoadingPreview] = useState(false);
  const fileRef = useRef();

  const load = () => {
    api.get('/documenti').then(r => setItems(r.data));
    api.get('/fornitori').then(r => setFornitori(r.data));
  };
  useEffect(() => { load(); }, []);

  const openUpload = () => { setForm(empty); setFile(null); setModal(true); };

  const save = async e => {
    e.preventDefault();
    if (!file) return alert('Seleziona un file');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('titolo', form.titolo || file.name);
      fd.append('categoria', form.categoria);
      if (form.fornitore_id) fd.append('fornitore_id', form.fornitore_id);
      if (form.note) fd.append('note', form.note);
      await api.post('/documenti', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setModal(false);
      load();
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
    !filtro || i.titolo.toLowerCase().includes(filtro.toLowerCase()) || i.categoria.toLowerCase().includes(filtro.toLowerCase())
  );

  const byCategoria = CATEGORIE.filter(c => filtered.some(i => i.categoria === c));

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
                    <div className="flex items-center gap-2 text-xs text-gray-300 mt-0.5">
                      {d.dimensione && <span>{formatSize(d.dimensione)}</span>}
                      <span>{format(parseISO(toUtc(d.created_at)), 'd MMM yyyy', { locale: it })}</span>
                    </div>
                    {d.note && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{d.note}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500" onClick={() => download(d)} title="Scarica"><Download size={14} /></button>
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
        <div className="modal-overlay" onClick={closePreview}>
          <div
            className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ width: '90vw', maxWidth: '900px', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              {preview && <span className="text-xl">{iconExt(preview.ext)}</span>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{preview?.doc?.titolo}</p>
                <p className="text-xs text-gray-400 truncate">{preview?.doc?.nome_file}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {preview?.doc && (
                  <button
                    className="btn-secondary py-1 px-3 text-sm flex items-center gap-1"
                    onClick={() => download(preview.doc)}
                  >
                    <Download size={13} /> Scarica
                  </button>
                )}
                <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" onClick={closePreview}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Contenuto */}
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 p-4" style={{ minHeight: '300px' }}>
              {loadingPreview && !preview && (
                <p className="text-gray-400 text-sm">Caricamento anteprima…</p>
              )}
              {preview?.url && preview.ext === 'pdf' && (
                <iframe
                  src={preview.url}
                  title={preview.doc.titolo}
                  className="w-full rounded"
                  style={{ height: '75vh', border: 'none' }}
                />
              )}
              {preview?.url && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(preview.ext) && (
                <img
                  src={preview.url}
                  alt={preview.doc.titolo}
                  className="max-w-full max-h-full object-contain rounded shadow"
                  style={{ maxHeight: '75vh' }}
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">Carica Documento</h2>
            <form onSubmit={save} className="space-y-3">
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
              <div>
                <label className="form-label">Titolo</label>
                <input className="form-input" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} placeholder="es. Contratto fotografo" />
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
              <div>
                <label className="form-label">Note</label>
                <textarea className="form-input" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Caricamento...' : 'Carica'}</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
