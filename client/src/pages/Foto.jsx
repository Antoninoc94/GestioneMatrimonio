import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Camera, X, ChevronLeft, ChevronRight, Download, Check, RotateCw, AlertCircle, ImagePlus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { TEMI } from '../temiWedding';
import { preparaFoto } from './foto/ridimensiona';
import './trovaTavolo/TrovaTavolo.css';
import './foto/Foto.css';

// Galleria per gli invitati, raggiunta dal QR in sala o dalla pagina Wedding.
// Le foto si vedono subito; gli sposi possono nasconderle dalla loro pagina.
// La pagina è prima di tutto la galleria: per aggiungere foto c'è un pulsante
// fisso che apre un pannello (nome e cognome, scelta delle foto, avanzamento).
// Usa axios e non `api`: `api` porta al login su un 401, qui non c'è login.

const MAX_ORIGINALE = 25 * 1024 * 1024;
const IN_PARALLELO = 2;
const AGGIORNA_OGNI = 30000;
const CHIAVE_NOME = 'galleria-nome';
const CHIAVE_COGNOME = 'galleria-cognome';

// Nome e cognome si ricordano su questo telefono (non sono dati riservati, e a
// ogni foto sarebbero una fatica): a differenza di "Trova il tuo tavolo", dove
// si cerca anche dal telefono di altri, qui si carica dal proprio.
const leggi = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const salva = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage bloccato */ } };

// Stesso controllo del server: almeno due parole, solo lettere (apostrofo,
// trattino e punto ammessi). Il server ripete la verifica, qui serve a non far
// partire il caricamento di foto che verrebbero rifiutate.
const PAROLA_NOME = /^\p{L}[\p{L}'’.-]+$/u;
const nomeValido = (nome, cognome) => {
  const parole = `${nome} ${cognome}`.trim().split(/\s+/).filter(Boolean);
  return parole.length >= 2 && parole.join(' ').length <= 60 && parole.every(w => PAROLA_NOME.test(w));
};

function useFont() {
  useEffect(() => {
    if (document.getElementById('trova-fonts')) return;
    const link = document.createElement('link');
    link.id = 'trova-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Great+Vibes&family=Montserrat:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
}

// Lightbox e pannello arrivano fino ai bordi (notch, barra in basso): i margini
// li gestisce il CSS con env(safe-area-inset-*). Si rimette il viewport com'era
// all'uscita.
function useSchermoIntero() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const prima = meta.getAttribute('content');
    meta.setAttribute('content', `${prima}, viewport-fit=cover`);
    return () => meta.setAttribute('content', prima);
  }, []);
}

// Unisce due elenchi senza doppioni, dal più recente.
const unisci = (a, b) => {
  const per = new Map();
  for (const f of [...a, ...b]) per.set(f.id, f);
  return [...per.values()].sort((x, y) => y.id - x.id);
};

// Proporzione della foto per le righe della galleria. Un panorama o una
// striscia verticale estrema si ritaglia un po' invece di spezzare la riga.
const rapporto = f => Math.min(2.2, Math.max(0.5, (f.larghezza || 1) / (f.altezza || 1)));

export default function Foto() {
  useFont();
  useSchermoIntero();
  const [params, setParams] = useSearchParams();
  const [info, setInfo] = useState(null);
  const [foto, setFoto] = useState([]);
  const [altre, setAltre] = useState(false);
  const [totale, setTotale] = useState(0);
  const [caricata, setCaricata] = useState(false);
  const [errore, setErrore] = useState('');
  const [nome, setNome] = useState(() => leggi(CHIAVE_NOME));
  const [cognome, setCognome] = useState(() => leggi(CHIAVE_COGNOME));
  const [coda, setCoda] = useState([]);
  const fileRef = useRef(null);
  const attiviRef = useRef(0);
  const inAttesaRef = useRef([]);
  const autoreRef = useRef('');
  autoreRef.current = `${nome.trim()} ${cognome.trim()}`;
  const caricataRef = useRef(false);
  const daQui = useRef({});

  useEffect(() => {
    axios.get('/api/galleria/info').then(r => setInfo(r.data)).catch(() => setInfo({ abilitata: 0 }));
  }, []);

  const abilitata = info?.abilitata === 1;

  const carica = useCallback(async (prima) => {
    try {
      const r = await axios.get('/api/galleria/foto', { params: prima ? { prima } : {} });
      setFoto(attuali => unisci(attuali, r.data.foto));
      setTotale(r.data.totale);
      if (prima || !caricataRef.current) setAltre(r.data.altre);
      setErrore('');
    } catch (e) {
      setErrore(e.response?.data?.error || 'Connessione assente: riprova tra un attimo.');
    } finally {
      setCaricata(true);
      caricataRef.current = true;
    }
  }, []);

  useEffect(() => { if (abilitata) carica(); }, [abilitata, carica]);

  // Le foto nuove di altri invitati compaiono da sole, senza ricaricare la
  // pagina: ogni 30 secondi, e subito quando si torna sulla scheda (sul telefono
  // i timer in background si fermano).
  useEffect(() => {
    if (!abilitata) return;
    const t = setInterval(() => { if (!document.hidden) carica(); }, AGGIORNA_OGNI);
    const torna = () => { if (!document.hidden) carica(); };
    document.addEventListener('visibilitychange', torna);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', torna); };
  }, [abilitata, carica]);

  // ── Caricamento ───────────────────────────────────────────────
  const aggiorna = (key, patch) => setCoda(c => c.map(v => (v.key === key ? { ...v, ...patch } : v)));

  const invia = useCallback(async (voce) => {
    aggiorna(voce.key, { stato: 'prepara', errore: '', progresso: 0 });
    try {
      const { grande, mini, larghezza, altezza } = await preparaFoto(voce.file);
      aggiorna(voce.key, { stato: 'invio' });
      const fd = new FormData();
      fd.append('autore', autoreRef.current);
      fd.append('larghezza', larghezza);
      fd.append('altezza', altezza);
      fd.append('originale', voce.file, voce.file.name);
      fd.append('grande', grande, 'grande.jpg');
      fd.append('mini', mini, 'mini.jpg');
      const r = await axios.post('/api/galleria/carica', fd, {
        onUploadProgress: e => { if (e.total) aggiorna(voce.key, { progresso: e.loaded / e.total }); },
      });
      aggiorna(voce.key, { stato: 'ok', progresso: 1 });
      setFoto(attuali => unisci(attuali, [{ id: r.data.id, codice: r.data.codice, autore: autoreRef.current, larghezza, altezza }]));
      setTotale(t => t + 1);
    } catch (e) {
      const msg = e.response?.data?.error
        || (e.response ? 'Non siamo riusciti a caricarla.' : e.request ? 'Connessione assente: riprova.' : 'Formato non supportato: prova con una foto JPEG.');
      aggiorna(voce.key, { stato: 'errore', errore: msg });
    }
  }, []);

  const pompa = useCallback(() => {
    while (attiviRef.current < IN_PARALLELO && inAttesaRef.current.length) {
      const voce = inAttesaRef.current.shift();
      attiviRef.current++;
      invia(voce).finally(() => { attiviRef.current--; pompa(); });
    }
  }, [invia]);

  const accoda = files => {
    const nuove = [...files].map((file, i) => {
      const base = { key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`, file, nome: file.name, progresso: 0 };
      if (file.type && !file.type.startsWith('image/')) return { ...base, stato: 'errore', errore: 'Si possono caricare solo foto.' };
      if (file.size > MAX_ORIGINALE) return { ...base, stato: 'errore', errore: 'È troppo pesante: il limite è 25 MB.' };
      return { ...base, stato: 'attesa' };
    });
    if (!nuove.length) return;
    setCoda(c => [...nuove, ...c]);
    inAttesaRef.current.push(...nuove.filter(v => v.stato === 'attesa'));
    pompa();
  };

  const riprova = voce => { inAttesaRef.current.push(voce); aggiorna(voce.key, { stato: 'attesa', errore: '' }); pompa(); };
  const chiudiVoce = key => setCoda(c => c.filter(v => v.key !== key));

  const scelti = e => {
    if (e.target.files?.length) accoda(e.target.files);
    e.target.value = '';
  };

  // ── Pannello e lightbox: l'URL porta ciò che è aperto, così "indietro" lo chiude ──
  const apri = (chiave, valore) => {
    daQui.current[chiave] = true;
    const p = new URLSearchParams(params);
    p.set(chiave, valore);
    setParams(p);
  };
  const chiudi = chiave => {
    if (daQui.current[chiave]) { daQui.current[chiave] = false; window.history.back(); return; }
    const p = new URLSearchParams(params);
    p.delete(chiave);
    setParams(p, { replace: true });
  };

  const pannelloAperto = params.get('carica') === '1' && info?.caricamenti === 1;
  const apertaId = parseInt(params.get('foto'), 10) || null;
  const indice = useMemo(() => foto.findIndex(f => f.id === apertaId), [foto, apertaId]);
  const vai = useCallback(verso => {
    const n = indice + verso;
    if (n < 0 || n >= foto.length) return;
    setParams({ foto: String(foto[n].id) }, { replace: true });
    if (n >= foto.length - 6 && altre) carica(foto[foto.length - 1].id);
  }, [indice, foto, altre, carica, setParams]);

  // Dietro il pannello la pagina non deve scorrere.
  useEffect(() => {
    if (!pannelloAperto) return;
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prima; };
  }, [pannelloAperto]);

  if (!info) return <div className="tt ft" style={{ display: 'grid', placeItems: 'center' }}><div className="tt-attesa" style={{ position: 'static', margin: 0 }} /></div>;

  const tema = TEMI[info.landing_tema] || TEMI.rose;
  const vars = { '--tt-primary': tema.primary, '--tt-dark': tema.dark, '--tt-light': tema.light, '--tt-mid': tema.mid, '--tt-border': tema.border };
  const sposi = [info.nome_sposo1, info.nome_sposo2].filter(Boolean).join(' & ');
  const data = info.data_matrimonio ? format(parseISO(info.data_matrimonio), 'd MMMM yyyy', { locale: it }) : '';
  const attive = coda.filter(v => v.stato === 'attesa' || v.stato === 'prepara' || v.stato === 'invio');
  const finite = coda.filter(v => v.stato === 'ok').length;
  const valido = nomeValido(nome, cognome);
  const puoCaricare = info.caricamenti === 1;
  const tuttoChiuso = indice < 0 && !pannelloAperto;

  return (
    <div className="tt ft" style={vars}>
      <header className="tt-hero tt-compatta">
        {info.landing_foto ? <div className="tt-hero-foto" style={{ backgroundImage: `url(/uploads/landing/${encodeURIComponent(info.landing_foto)})` }} /> : <div className="tt-hero-ornato" />}
        <div className="tt-hero-testo">
          <h1 className="tt-nomi">{sposi || 'Le nostre foto'}</h1>
          {data && (
            <>
              <div className="tt-fregio" aria-hidden="true"><span /><i /><span /></div>
              <p className="tt-data">{data}</p>
            </>
          )}
        </div>
      </header>

      <div className="ft-colonna">
        {!abilitata ? (
          <div className="tt-carta ft-carta">
            <div className="tt-esito">
              <p className="tt-etichetta">Le foto della festa</p>
              <h2 className="tt-tavolo-nome" style={{ fontSize: '2rem' }}>Ci vediamo presto</h2>
              <p className="tt-sottotitolo" style={{ marginBottom: 0 }}>Qui potrai guardare e condividere le foto del matrimonio, appena sarà il momento.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="ft-testa">
              <h2 className="ft-titolo">Le foto della festa</h2>
              <p className="ft-conteggio">
                {totale === 0 ? 'Ancora nessuna foto' : totale === 1 ? '1 foto' : `${totale} foto`}
                {!puoCaricare && ' · caricamenti chiusi'}
              </p>
            </div>

            {errore && !foto.length && <p className="ft-vuoto">{errore}</p>}
            {caricata && !errore && !foto.length && (
              <div className="ft-vuoto">
                <ImagePlus size={30} />
                <p>{puoCaricare ? 'Nessuno ha ancora condiviso una foto: aggiungi la prima!' : 'Non ci sono ancora foto.'}</p>
                {puoCaricare && <button type="button" className="ft-principale ft-piccolo" onClick={() => apri('carica', '1')}><Camera size={18} /> Aggiungi foto</button>}
              </div>
            )}
            {foto.length > 0 && (
              <>
                <div className="ft-griglia">
                  {foto.map(f => {
                    const r = rapporto(f);
                    return (
                      <button key={f.id} type="button" className="ft-tessera" onClick={() => apri('foto', String(f.id))}
                        style={{ flexGrow: r * 100, flexBasis: `calc(var(--riga) * ${r})` }}
                        aria-label={f.autore ? `Foto di ${f.autore}` : 'Apri la foto'}>
                        <i style={{ paddingBottom: `${100 / r}%` }} />
                        <img src={`/api/galleria/file/mini/${f.codice}`} alt="" loading="lazy" decoding="async" />
                      </button>
                    );
                  })}
                </div>
                {altre && (
                  <button type="button" className="tt-secondaria ft-altre" onClick={() => carica(foto[foto.length - 1].id)}>Mostra altre foto</button>
                )}
              </>
            )}
          </>
        )}
        {sposi && <div className="tt-piede"><p>{sposi}</p></div>}
      </div>

      {/* Pulsante fisso: sempre a portata di pollice. Durante un caricamento diventa l'avanzamento. */}
      {abilitata && puoCaricare && tuttoChiuso && (
        <button type="button" className={`ft-fab${attive.length ? ' ft-fab-attivo' : ''}`} onClick={() => apri('carica', '1')}>
          {attive.length
            ? <><span className="tt-attesa ft-fab-giro" aria-hidden="true" /> Carico {attive.length === 1 ? '1 foto' : `${attive.length} foto`}…</>
            : <><Camera size={20} /> Aggiungi foto</>}
        </button>
      )}

      {pannelloAperto && (
        <div className="ft-velo" onClick={e => e.target === e.currentTarget && chiudi('carica')}>
          <div className="ft-pannello" role="dialog" aria-modal="true" aria-label="Condividi le tue foto">
            <button type="button" className="ft-pannello-chiudi" onClick={() => chiudi('carica')} aria-label="Chiudi"><X size={20} /></button>
            <h2 className="tt-titolo">Condividi le tue foto</h2>
            <p className="tt-sottotitolo">Aggiungi gli scatti della giornata: li vedranno tutti.</p>

            <div className="ft-due">
              <label>
                <span className="ft-etichetta">Nome</span>
                <input className="tt-input ft-campo-testo" value={nome} maxLength={30} autoComplete="given-name" autoCapitalize="words"
                  placeholder="Luca" onChange={e => { setNome(e.target.value); salva(CHIAVE_NOME, e.target.value); }} />
              </label>
              <label>
                <span className="ft-etichetta">Cognome</span>
                <input className="tt-input ft-campo-testo" value={cognome} maxLength={30} autoComplete="family-name" autoCapitalize="words"
                  placeholder="Rossi" onChange={e => { setCognome(e.target.value); salva(CHIAVE_COGNOME, e.target.value); }} />
              </label>
            </div>
            <p className={`ft-nota${!valido && (nome || cognome) ? ' ft-nota-errore' : ''}`}>
              {!valido && (nome || cognome) ? 'Scrivi il tuo nome e il tuo cognome per continuare.' : 'Ci serve per ringraziarti: sotto ogni foto comparirà il tuo nome.'}
            </p>

            <button type="button" className="ft-principale" disabled={!valido} onClick={() => fileRef.current?.click()}>
              <Camera size={20} /> Scegli le foto
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={scelti} />
            <p className="ft-nota">Puoi sceglierne più di una dalla galleria del telefono o scattarne una nuova.</p>

            {coda.length > 0 && (
              <ul className="ft-coda">
                {attive.length > 0 && <li className="ft-coda-testa">Caricamento in corso… non chiudere la pagina</li>}
                {!attive.length && finite > 0 && <li className="ft-coda-testa ft-ok"><Check size={15} /> {finite === 1 ? 'Foto caricata, grazie!' : `${finite} foto caricate, grazie!`}</li>}
                {coda.map(v => (
                  <li key={v.key} className={`ft-voce ft-${v.stato}`}>
                    <span className="ft-voce-nome">{v.nome}</span>
                    {v.stato === 'errore' ? (
                      <span className="ft-voce-esito">
                        <AlertCircle size={14} /> {v.errore}
                        {v.file.size <= MAX_ORIGINALE && (!v.file.type || v.file.type.startsWith('image/')) && (
                          <button type="button" onClick={() => riprova(v)} aria-label="Riprova"><RotateCw size={14} /></button>
                        )}
                        <button type="button" onClick={() => chiudiVoce(v.key)} aria-label="Nascondi"><X size={14} /></button>
                      </span>
                    ) : v.stato === 'ok' ? (
                      <span className="ft-voce-esito"><Check size={14} /></span>
                    ) : (
                      <span className="ft-barra" role="progressbar" aria-valuenow={Math.round(v.progresso * 100)}>
                        <i style={{ width: `${v.stato === 'invio' ? Math.max(4, v.progresso * 100) : 4}%` }} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!attive.length && finite > 0 && (
              <button type="button" className="tt-secondaria ft-vedi" onClick={() => chiudi('carica')}>Guarda la galleria</button>
            )}
          </div>
        </div>
      )}

      {indice >= 0 && (
        <Lightbox foto={foto[indice]} haPrima={indice > 0} haDopo={indice < foto.length - 1}
          onVai={vai} onChiudi={() => chiudi('foto')} vicine={[foto[indice - 1], foto[indice + 1]].filter(Boolean)} />
      )}
    </div>
  );
}

function Lightbox({ foto, haPrima, haDopo, onVai, onChiudi, vicine }) {
  const inizio = useRef(null);
  const [caricataId, setCaricataId] = useState(null);
  const caricata = caricataId === foto.id;

  useEffect(() => {
    const tasto = e => {
      if (e.key === 'Escape') onChiudi();
      else if (e.key === 'ArrowLeft') onVai(-1);
      else if (e.key === 'ArrowRight') onVai(1);
    };
    window.addEventListener('keydown', tasto);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tasto); document.body.style.overflow = overflow; };
  }, [onVai, onChiudi]);

  // Scorrimento col dito: un gesto orizzontale deciso cambia foto.
  const giu = e => { inizio.current = { x: e.clientX, y: e.clientY }; };
  const su = e => {
    const i = inizio.current;
    inizio.current = null;
    if (!i) return;
    const dx = e.clientX - i.x, dy = e.clientY - i.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onVai(dx < 0 ? 1 : -1);
  };

  return (
    <div className="ft-luce" role="dialog" aria-modal="true" aria-label="Foto a schermo intero">
      <div className="ft-luce-barra">
        <span>{foto.autore ? `Foto di ${foto.autore}` : ''}</span>
        <a className="ft-icona" href={`/api/galleria/file/grande/${foto.codice}?scarica=1`} download aria-label="Scarica la foto"><Download size={20} /></a>
        <button type="button" className="ft-icona" onClick={onChiudi} aria-label="Chiudi"><X size={22} /></button>
      </div>
      <div className="ft-luce-scena" onPointerDown={giu} onPointerUp={su} onPointerCancel={() => { inizio.current = null; }}>
        {!caricata && <span className="tt-attesa ft-luce-attesa" aria-hidden="true" />}
        <img key={foto.id} src={`/api/galleria/file/grande/${foto.codice}`} alt={foto.autore ? `Foto di ${foto.autore}` : 'Foto'}
          className={caricata ? 'ft-pronta' : ''} onLoad={() => setCaricataId(foto.id)} draggable={false} />
      </div>
      {haPrima && <button type="button" className="ft-freccia ft-sx" onClick={() => onVai(-1)} aria-label="Foto precedente"><ChevronLeft size={26} /></button>}
      {haDopo && <button type="button" className="ft-freccia ft-dx" onClick={() => onVai(1)} aria-label="Foto successiva"><ChevronRight size={26} /></button>}
      {/* Le due foto vicine si scaricano in anticipo: scorrere è immediato. */}
      {vicine.map(v => <link key={v.id} rel="prefetch" as="image" href={`/api/galleria/file/grande/${v.codice}`} />)}
    </div>
  );
}
