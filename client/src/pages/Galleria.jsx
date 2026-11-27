import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Trash2, Download, X, Check, AlertTriangle, Camera, ChevronLeft, ChevronRight, FileArchive } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import api from '../api';

// Le foto dell'invitato (pagina pubblica /foto). Qui gli sposi le vedono tutte,
// nascoste comprese, e le gestiscono. Miniature e download passano da un gettone
// breve nell'URL (<img> e link non possono mandare l'header di login).

const peso = b => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const quando = iso => { try { return format(parseISO(iso.replace(' ', 'T') + 'Z'), "d MMM yyyy 'alle' HH:mm", { locale: it }); } catch { return ''; } };

export default function Galleria() {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState('');
  const [filtro, setFiltro] = useState('tutte'); // tutte | visibili | nascoste
  const [autore, setAutore] = useState('');
  const [selezione, setSelezione] = useState(() => new Set());
  const [aperta, setAperta] = useState(null); // id della foto nel visore
  const [occupato, setOccupato] = useState(false);
  const ultimoRicarico = useRef(0);

  const carica = useCallback(() => {
    ultimoRicarico.current = Date.now();
    return api.get('/galleria/admin/foto')
      .then(r => { setDati(r.data); setErrore(''); })
      .catch(e => setErrore(e.response?.data?.error || 'Non riesco a caricare la galleria.'));
  }, []);
  useEffect(() => { carica(); }, [carica]);

  // Il gettone dura due ore: a pagina rimasta aperta, le miniature smettono di
  // caricarsi e basta rileggere l'elenco per averne uno nuovo.
  const gettoneScaduto = () => { if (Date.now() - ultimoRicarico.current > 10000) carica(); };

  const foto = useMemo(() => dati?.foto || [], [dati]);
  const autori = useMemo(() => dati?.autori || [], [dati]);
  const inLista = useMemo(() => new Map(autori.map(a => [a.nome, a.in_lista])), [autori]);
  const mostrate = useMemo(() => foto.filter(f =>
    (filtro === 'tutte' || (filtro === 'nascoste') === (f.nascosta === 1)) &&
    (!autore || (autore === '__nessuno' ? !f.autore : f.autore === autore))), [foto, filtro, autore]);
  const nascoste = foto.filter(f => f.nascosta === 1).length;
  const pesoTotale = foto.reduce((s, f) => s + (f.peso || 0), 0);

  const url = (tipo, f, extra = '') => `/api/galleria/privato/${tipo}/${f.codice}?t=${encodeURIComponent(dati.gettone)}${extra}`;

  const esegui = async (ids, azione) => {
    if (!ids.length || occupato) return;
    setOccupato(true);
    try {
      await api.post('/galleria/admin/azioni', { ids, azione });
      setSelezione(new Set());
      await carica();
    } catch (e) {
      setErrore(e.response?.data?.error || 'Operazione non riuscita.');
    } finally {
      setOccupato(false);
    }
  };
  const elimina = async ids => {
    if (!window.confirm(`Eliminare ${ids.length === 1 ? 'questa foto' : `${ids.length} foto`}? Spariscono dalla galleria e dalla NAS, anche l'originale: non si può annullare.`)) return;
    await esegui(ids, 'elimina');
    setAperta(null);
  };

  const commuta = id => setSelezione(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const tocca = f => (selezione.size ? commuta(f.id) : setAperta(f.id));
  const seleziona = (e, f) => { e.stopPropagation(); commuta(f.id); };

  // Frecce e Esc nel visore.
  const indiceAperta = mostrate.findIndex(f => f.id === aperta);
  useEffect(() => {
    if (aperta == null) return;
    const tasto = e => {
      if (e.key === 'Escape') setAperta(null);
      else if (e.key === 'ArrowLeft' && indiceAperta > 0) setAperta(mostrate[indiceAperta - 1].id);
      else if (e.key === 'ArrowRight' && indiceAperta < mostrate.length - 1) setAperta(mostrate[indiceAperta + 1].id);
    };
    window.addEventListener('keydown', tasto);
    return () => window.removeEventListener('keydown', tasto);
  }, [aperta, indiceAperta, mostrate]);

  if (!dati) return <div className="p-8 text-gray-400">{errore || 'Caricamento…'}</div>;

  const { stato } = dati;
  const corrente = indiceAperta >= 0 ? mostrate[indiceAperta] : null;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Galleria foto</h1>
          <p className="page-subtitle">
            {foto.length} foto{nascoste > 0 && ` · ${nascoste} nascoste`}{foto.length > 0 && ` · ${peso(pesoTotale)} di originali`}
          </p>
        </div>
        {foto.length > 0 && (
          <a className="btn-primary justify-center" href={`/api/galleria/zip?t=${encodeURIComponent(dati.gettone)}`}
            title="Tutti gli originali, nascoste comprese">
            <FileArchive size={16} /> Scarica tutto (ZIP)
          </a>
        )}
      </div>

      {errore && <div className="card mb-4 border-red-200 bg-red-50 text-sm text-red-700">{errore}</div>}
      {stato.nas && !stato.pronta && (
        <div className="card mb-4 border-amber-300 bg-amber-50 text-sm text-amber-800 flex gap-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span><strong>La NAS non risponde.</strong> Manca la cartella delle foto (o il file <code>.galleria-nas</code>): i nuovi caricamenti sono sospesi e le foto già salvate potrebbero non vedersi. Controlla che la NAS sia accesa e montata sul server.</span>
        </div>
      )}
      {!stato.abilitata && (
        <div className="card mb-4 text-sm text-gray-600 flex gap-2">
          <Camera size={18} className="shrink-0 mt-0.5 text-gray-400" />
          <span>La galleria è <strong>spenta</strong>: gli invitati non vedono la pagina. Accendila, e stampa il QR, da <strong>Pagina Wedding → QR Code</strong>.</span>
        </div>
      )}

      {foto.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Camera size={40} className="mx-auto mb-3 opacity-40" />
          <p>Ancora nessuna foto. Appariranno qui man mano che gli invitati le caricano.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select className="input w-auto text-sm" value={filtro} onChange={e => setFiltro(e.target.value)}>
              <option value="tutte">Tutte le foto</option>
              <option value="visibili">Solo visibili</option>
              <option value="nascoste">Solo nascoste</option>
            </select>
            <select className="input w-auto text-sm" value={autore} onChange={e => setAutore(e.target.value)}>
              <option value="">Tutti gli autori</option>
              {autori.map(a => <option key={a.nome} value={a.nome}>{a.nome} ({a.foto}){a.in_lista ? '' : ' · non in lista ospiti'}</option>)}
              <option value="__nessuno">Senza nome</option>
            </select>
            <span className="text-xs text-gray-400 ml-auto">Tocca una foto per aprirla, o il cerchio per selezionarne più d'una.</span>
          </div>

          {selezione.size > 0 && (
            <div className="card mb-4 flex flex-wrap items-center gap-2 sticky top-2 z-10 shadow-md">
              <strong className="text-sm mr-2">{selezione.size} selezionate</strong>
              <button className="btn-secondary text-sm" disabled={occupato} onClick={() => esegui([...selezione], 'nascondi')}><EyeOff size={14} /> Nascondi</button>
              <button className="btn-secondary text-sm" disabled={occupato} onClick={() => esegui([...selezione], 'mostra')}><Eye size={14} /> Mostra</button>
              <button className="btn-danger text-sm inline-flex items-center gap-1.5 whitespace-nowrap" disabled={occupato} onClick={() => elimina([...selezione])}><Trash2 size={14} /> Elimina</button>
              <button className="btn-secondary text-sm ml-auto" onClick={() => setSelezione(new Set(mostrate.map(f => f.id)))}>Seleziona le {mostrate.length} mostrate</button>
              <button className="text-sm text-gray-500 hover:text-gray-800 px-2" onClick={() => setSelezione(new Set())}>Annulla</button>
            </div>
          )}

          {mostrate.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Nessuna foto con questi filtri.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
              {mostrate.map(f => {
                const scelta = selezione.has(f.id);
                return (
                  <div key={f.id} className={`relative aspect-square overflow-hidden rounded-md bg-gray-100 cursor-pointer ${scelta ? 'ring-4 ring-rose-500' : ''}`}
                    onClick={() => tocca(f)}>
                    <img src={url('mini', f)} alt="" loading="lazy" onError={gettoneScaduto}
                      className={`w-full h-full object-cover ${f.nascosta ? 'opacity-40 grayscale' : ''}`} />
                    <button type="button" aria-label={scelta ? 'Deseleziona' : 'Seleziona'} onClick={e => seleziona(e, f)}
                      className={`absolute top-1 left-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${scelta ? 'bg-rose-500 border-rose-500 text-white' : 'bg-black/30 border-white text-transparent hover:text-white'}`}>
                      <Check size={14} />
                    </button>
                    {f.nascosta === 1 && <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white rounded px-1.5 py-0.5 flex items-center gap-1"><EyeOff size={10} /> nascosta</span>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {corrente && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={e => e.target === e.currentTarget && setAperta(null)}>
          <div className="flex flex-wrap items-center gap-2 p-3 text-white text-sm">
            <span className="flex-1 min-w-40">
              {corrente.autore ? `Foto di ${corrente.autore}` : 'Senza nome'}
              {corrente.autore && !inLista.get(corrente.autore) && <em className="not-italic text-amber-300"> (non in lista ospiti)</em>}
              {' · '}{quando(corrente.created_at)} · {peso(corrente.peso || 0)}
              {corrente.nascosta === 1 && ' · nascosta'}
            </span>
            <button className="btn-secondary text-sm inline-flex items-center gap-1.5 whitespace-nowrap" disabled={occupato} onClick={() => esegui([corrente.id], corrente.nascosta ? 'mostra' : 'nascondi')}>
              {corrente.nascosta ? <><Eye size={14} /> Mostra</> : <><EyeOff size={14} /> Nascondi</>}
            </button>
            <a className="btn-secondary text-sm inline-flex items-center gap-1.5 whitespace-nowrap" href={url('originale', corrente, '&scarica=1')}><Download size={14} /> Originale</a>
            <button className="btn-danger text-sm inline-flex items-center gap-1.5 whitespace-nowrap" disabled={occupato} onClick={() => elimina([corrente.id])}><Trash2 size={14} /> Elimina</button>
            <button className="p-2 rounded-full bg-white/10 hover:bg-white/20" onClick={() => setAperta(null)} aria-label="Chiudi"><X size={18} /></button>
          </div>
          <div className="relative flex-1 min-h-0 flex items-center justify-center px-12" onClick={e => e.target === e.currentTarget && setAperta(null)}>
            <img key={corrente.id} src={url('grande', corrente)} alt="" className="max-w-full max-h-full object-contain" />
            {indiceAperta > 0 && (
              <button className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Precedente"
                onClick={() => setAperta(mostrate[indiceAperta - 1].id)}><ChevronLeft size={22} /></button>
            )}
            {indiceAperta < mostrate.length - 1 && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Successiva"
                onClick={() => setAperta(mostrate[indiceAperta + 1].id)}><ChevronRight size={22} /></button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
