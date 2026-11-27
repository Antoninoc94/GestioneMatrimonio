import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Search, X, ChevronRight, ChevronLeft, ArrowRight, Map as MapIcon, List, Heart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { TEMI, GRAZIE_PREDEFINITO } from '../temiWedding';
import Sala from './trovaTavolo/Sala';
import { piazza, ruotaSala, confini, inquadraPosto, adattaProporzioni, numeriTavoli } from './trovaTavolo/geometria';
import './trovaTavolo/TrovaTavolo.css';

// Pagina per gli invitati, raggiunta dal QR all'ingresso della sala. Tre passi:
// la copertina con la ricerca, il proprio posto con il tavolo da vicino, e la
// sala a schermo intero con la propria sedia accesa.
// Usa axios e non `api`: `api` porta al login su un 401, qui non c'è login.

// La pagina non ricorda chi è stato cercato: ogni apertura riparte dalla
// ricerca, così chi cerca dal telefono di un altro non gli lascia il suo nome.
// Una versione di prova lo salvava: si cancella quel che è rimasto.
try { localStorage.removeItem('trova-tavolo-scelta'); } catch { /* storage bloccato */ }

const nomeCompleto = o => [o.nome, o.cognome].filter(Boolean).join(' ');
const iniziali = o => [o.nome, o.cognome].filter(Boolean).map(s => [...s.trim()][0] || '').join('').toUpperCase();
const daRisultato = o => ({ id: o.id, nome: nomeCompleto(o), primo: o.nome, tavolo: o.tavolo, posto: o.posto });

// Font della pagina: gli stessi della pagina Wedding più un sans per i testi.
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

// Solo qui: lo schermo intero arriva fino ai bordi (notch, barra in basso) e
// i margini li gestisce il CSS con env(safe-area-inset-*). Il resto dell'app
// non li gestisce, quindi all'uscita si rimette com'era.
function useSchermoIntero() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const prima = meta.getAttribute('content');
    meta.setAttribute('content', `${prima}, viewport-fit=cover`);
    return () => meta.setAttribute('content', prima);
  }, []);
}

// Telefono tenuto in verticale. Un tablet ha spazio anche così.
const QUERY_VERTICALE = '(orientation: portrait) and (max-width: 640px)';
function useVerticale() {
  const [v, setV] = useState(() => window.matchMedia?.(QUERY_VERTICALE).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY_VERTICALE);
    if (!mq) return;
    const cambia = e => setV(e.matches);
    mq.addEventListener('change', cambia);
    return () => mq.removeEventListener('change', cambia);
  }, []);
  return v;
}

export default function TrovaTavolo() {
  useFont();
  useSchermoIntero();
  const [params, setParams] = useSearchParams();
  const [info, setInfo] = useState(null);
  const [tavoli, setTavoli] = useState(null);
  // { id, nome, primo, tavolo: { id, nome }, posto }: solo in memoria.
  const [scelta, setScelta] = useState(null);
  // Il biglietto di ringraziamento esce una volta per ricerca, non a ogni
  // apertura della sala.
  const [grazieVisto, setGrazieVisto] = useState(false);
  const segnaGrazieVisto = useCallback(() => setGrazieVisto(true), []);
  // La sala sta nell'URL: il tasto indietro del telefono la chiude invece di
  // uscire dalla pagina.
  const salaAperta = params.get('vista') === 'sala';
  const apertaDaQui = useRef(false);

  useEffect(() => {
    axios.get('/api/tavolo/info').then(r => setInfo(r.data)).catch(() => setInfo({ abilitata: 0 }));
  }, []);

  useEffect(() => {
    if (info?.abilitata !== 1) return;
    axios.get('/api/tavolo/pianta').then(r => setTavoli(r.data)).catch(() => setTavoli([]));
  }, [info]);

  const scegli = o => {
    setScelta(daRisultato(o));
    setGrazieVisto(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // "Non sei tu?" cancella del tutto la scelta, non la mette da parte: altrimenti
  // la pianta continuava a mostrare la sedia illuminata di un'altra persona, e
  // chi sceglie dal telefono di un altro gli lasciava il proprio posto.
  const nonSeiTu = () => {
    setScelta(null);
    setGrazieVisto(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const apriSala = () => { apertaDaQui.current = true; setParams({ vista: 'sala' }); };
  const chiudiSala = () => {
    if (apertaDaQui.current) { apertaDaQui.current = false; window.history.back(); }
    else setParams({}, { replace: true });
  };

  if (!info) return <div className="tt" style={{ display: 'grid', placeItems: 'center' }}><div className="tt-attesa" style={{ position: 'static', margin: 0 }} /></div>;

  const tema = TEMI[info.landing_tema] || TEMI.rose;
  const vars = {
    '--tt-primary': tema.primary, '--tt-dark': tema.dark, '--tt-light': tema.light,
    '--tt-mid': tema.mid, '--tt-border': tema.border,
  };
  const sposi = [info.nome_sposo1, info.nome_sposo2].filter(Boolean).join(' & ');
  const data = info.data_matrimonio ? format(parseISO(info.data_matrimonio), 'd MMMM yyyy', { locale: it }) : '';
  const mioTavolo = tavoli?.find(t => t.id === scelta?.tavolo.id);
  const mostraEsito = !!scelta;

  return (
    <div className="tt" style={vars}>
      <Copertina sposi={sposi} data={data} foto={info.landing_foto} compatta={!!mostraEsito} />
      <div className="tt-colonna">
        <div className="tt-carta">
          {info.abilitata !== 1 ? (
            <div className="tt-esito">
              <p className="tt-etichetta">Il giorno del matrimonio</p>
              <h1 className="tt-tavolo-nome" style={{ fontSize: '2rem' }}>Ci vediamo presto</h1>
              <p className="tt-sottotitolo" style={{ marginBottom: 0 }}>Qui troverai il tuo tavolo e il tuo posto in sala, appena sarà tutto pronto.</p>
            </div>
          ) : mostraEsito ? (
            <Esito scelta={scelta} tavolo={mioTavolo} tema={tema} onSala={apriSala} onAltro={nonSeiTu} />
          ) : (
            <Ricerca onScegli={scegli} />
          )}
        </div>
        {info.abilitata === 1 && !mostraEsito && tavoli?.length > 0 && (
          <button className="tt-secondaria" onClick={apriSala}><MapIcon size={17} /> Guarda la pianta della sala</button>
        )}
        {sposi && <div className="tt-piede"><p>{sposi}</p></div>}
      </div>

      {salaAperta && info.abilitata === 1 && tavoli && (
        <VistaSala tavoli={tavoli} scelta={mioTavolo ? scelta : null} tema={tema} onChiudi={chiudiSala}
          grazie={grazieVisto ? null : info.grazie} sposi={sposi} onGrazieVisto={segnaGrazieVisto} />
      )}
    </div>
  );
}

function Copertina({ sposi, data, foto, compatta }) {
  return (
    <header className={`tt-hero${compatta ? ' tt-compatta' : ''}`}>
      {foto ? <div className="tt-hero-foto" style={{ backgroundImage: `url(/uploads/landing/${encodeURIComponent(foto)})` }} /> : <div className="tt-hero-ornato" />}
      <div className="tt-hero-testo">
        <p className="tt-occhiello">Benvenuti al matrimonio di</p>
        <h1 className="tt-nomi">{sposi || 'Benvenuti'}</h1>
        {data && (
          <>
            <div className="tt-fregio" aria-hidden="true"><span /><i /><span /></div>
            <p className="tt-data">{data}</p>
          </>
        )}
      </div>
    </header>
  );
}

function Ricerca({ onScegli }) {
  const [q, setQ] = useState('');
  const [esito, setEsito] = useState(null);
  const [cercando, setCercando] = useState(false);
  const [errore, setErrore] = useState('');
  const richiesta = useRef(0);

  // Si cerca mentre si scrive, con una breve pausa. Il contatore scarta le
  // risposte arrivate fuori ordine: su una rete lenta "Ma" può rispondere dopo "Mar".
  useEffect(() => {
    const testo = q.trim();
    const n = ++richiesta.current;
    if (testo.replace(/\s/g, '').length < 2) { setEsito(null); setErrore(''); setCercando(false); return; }
    setCercando(true);
    const timer = setTimeout(() => {
      axios.get('/api/tavolo/cerca', { params: { q: testo } })
        .then(r => { if (n === richiesta.current) { setEsito(r.data); setErrore(''); } })
        .catch(err => { if (n === richiesta.current) setErrore(err.response?.data?.error || 'Connessione assente: riprova tra un attimo.'); })
        .finally(() => { if (n === richiesta.current) setCercando(false); });
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <>
      <h2 className="tt-titolo">Trova il tuo posto</h2>
      <p className="tt-sottotitolo">Scrivi il tuo nome o il tuo cognome</p>
      <div className="tt-campo">
        <Search size={20} className="tt-lente" />
        <input className="tt-input" type="search" inputMode="search" enterKeyHint="search" value={q}
          onChange={e => setQ(e.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false}
          placeholder="Es. Maria Rossi" aria-label="Il tuo nome" />
        {cercando ? <span className="tt-attesa" aria-hidden="true" />
          : q && <button className="tt-svuota" onClick={() => setQ('')} aria-label="Cancella"><X size={18} /></button>}
      </div>

      <div aria-live="polite">
        {errore && <p className="tt-errore">{errore}</p>}
        {!errore && esito && esito.risultati.length === 0 && !cercando && (
          <div className="tt-vuoto">
            <strong>Non troviamo questo nome</strong>
            Prova con il solo cognome, oppure chiedi al personale di sala: ti accompagneranno loro.
          </div>
        )}
        {esito?.risultati.length > 0 && (
          <ul className="tt-risultati">
            {esito.risultati.map((o, i) => (
              <li key={o.id}>
                <button className="tt-risultato" style={{ animationDelay: `${i * 40}ms` }} onClick={() => onScegli(o)}>
                  <span className="tt-iniziali" aria-hidden="true">{iniziali(o)}</span>
                  <span className="tt-chi"><strong>{nomeCompleto(o)}</strong><span>{o.tavolo.nome}</span></span>
                  <ChevronRight size={20} className="tt-freccia" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {esito?.altri && <p className="tt-nota">Ci sono altri nomi simili: aggiungi il cognome.</p>}
      </div>
    </>
  );
}

function Esito({ scelta, tavolo, tema, onSala, onAltro }) {
  const box = useMemo(() => {
    if (!tavolo) return null;
    const [t] = piazza([tavolo]);
    // Il riquadro prende la forma del tavolo: quadrato per un tondo, largo e
    // basso per un tavolo lungo, alto per uno girato in verticale. Entro dei
    // limiti, perché non spinga il bottone fuori dallo schermo.
    const vb = confini([t], 22);
    const aspetto = Math.min(2.6, Math.max(0.75, vb.w / vb.h));
    return { t, vb: adattaProporzioni(vb, aspetto), aspetto };
  }, [tavolo]);
  return (
    <div className="tt-esito">
      <p className="tt-saluto">Ciao {scelta.primo || scelta.nome.split(' ')[0]},</p>
      <p className="tt-etichetta">Il tuo tavolo</p>
      <h2 className="tt-tavolo-nome">{tavolo?.nome || scelta.tavolo.nome}</h2>
      {box && scelta.posto != null ? (
        <>
          <Sala tema={tema} tavoli={[box.t]} mioId={box.t.id} posto={scelta.posto} viewBox={box.vb} pavimento={false} nomi={false} className="tt-vicino"
            style={{ aspectRatio: box.aspetto, maxWidth: Math.min(420, Math.round(250 * Math.sqrt(box.aspetto))) }} />
          <p className="tt-didascalia"><i /> <span>Posto <strong>{scelta.posto + 1}</strong>, quello illuminato</span></p>
        </>
      ) : <div style={{ height: '1.5rem' }} />}
      {tavolo && <button className="tt-azione" onClick={onSala}>Vedi dove si trova in sala <ArrowRight size={18} /></button>}
      <div><button className="tt-link" onClick={onAltro}>Non sei tu? Cerca un altro nome</button></div>
    </div>
  );
}

// Zoom morbido tra un'inquadratura e l'altra, animando il viewBox.
function useViewBox(target) {
  const [vb, setVb] = useState(target);
  const corrente = useRef(target);
  useEffect(() => {
    if (!target) return;
    const da = corrente.current;
    const ridotto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (ridotto || !da) { corrente.current = target; setVb(target); return; }
    const durata = 750;
    const t0 = performance.now();
    let id;
    const passo = ora => {
      const k = Math.min(1, (ora - t0) / durata);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const v = { x: da.x + (target.x - da.x) * e, y: da.y + (target.y - da.y) * e, w: da.w + (target.w - da.w) * e, h: da.h + (target.h - da.h) * e };
      corrente.current = v;
      setVb(v);
      if (k < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [target]);
  return vb;
}

// Il biglietto che esce quando lo zoom arriva sulla sedia.
function Grazie({ testo, nome, sposi, onChiudi }) {
  const conNome = (testo || GRAZIE_PREDEFINITO).includes('{nome}');
  const corpo = (testo || GRAZIE_PREDEFINITO).replaceAll('{nome}', nome);
  return (
    <div className="tt-grazie" role="status">
      <button className="tt-grazie-chiudi" onClick={onChiudi} aria-label="Chiudi"><X size={16} /></button>
      <p className="tt-grazie-titolo">{conNome ? 'Grazie di cuore' : `Grazie, ${nome}`}</p>
      <p className="tt-grazie-testo">{corpo}</p>
      {sposi && <p className="tt-grazie-firma">{sposi}</p>}
    </div>
  );
}

// `grazie`: testo del biglietto ('' = predefinito), null se non va mostrato.
function VistaSala({ tavoli, scelta, tema, onChiudi, grazie = null, sposi, onGrazieVisto }) {
  const verticale = useVerticale();
  const [forzaVerticale, setForzaVerticale] = useState(false);
  // 'sala', 'mio' (il proprio posto) o 'tavolo' (uno scelto dalla legenda, `fuoco`).
  const [vista, setVista] = useState('sala');
  const [fuoco, setFuoco] = useState(null);
  // La legenda: aperta da sé solo dove c'è spazio per tenerla di fianco.
  const [elenco, setElenco] = useState(() => window.matchMedia?.('(min-width: 1000px)').matches ?? false);
  const [aspetto, setAspetto] = useState(null);
  // Il testo del biglietto mentre è aperto (null = chiuso): si tiene da parte
  // perché, una volta visto, `grazie` torna null.
  const [biglietto, setBiglietto] = useState(null);
  const palco = useRef(null);
  // In verticale con la rotazione bloccata, la sala si gira da sola.
  const girata = verticale && forzaVerticale;
  const chiediRotazione = verticale && !forzaVerticale;

  // Niente scorrimento della pagina sotto la sala.
  useEffect(() => {
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prima; };
  }, []);

  useLayoutEffect(() => {
    const el = palco.current;
    if (!el) return;
    const misura = () => { const r = el.getBoundingClientRect(); if (r.width && r.height) setAspetto(r.width / r.height); };
    misura();
    const ro = new ResizeObserver(misura);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chiediRotazione]);

  const disposti = useMemo(() => { const p = piazza(tavoli); return girata ? ruotaSala(p) : p; }, [tavoli, girata]);
  const mio = scelta ? disposti.find(t => t.id === scelta.tavolo.id) : null;
  const mioId = mio?.id;
  const numeri = useMemo(() => numeriTavoli(tavoli), [tavoli]);
  const legenda = useMemo(() => [...tavoli].sort((a, b) => (numeri.get(a.id) ?? 0) - (numeri.get(b.id) ?? 0)), [tavoli, numeri]);
  const scelto = vista === 'tavolo' ? disposti.find(t => t.id === fuoco) : null;
  const guarda = t => {
    if (t.id === mioId) setVista('mio');
    else { setFuoco(t.id); setVista('tavolo'); }
    // Sul telefono la legenda copre la sala: si chiude per mostrare il tavolo.
    if (!window.matchMedia?.('(min-width: 1000px)').matches) setElenco(false);
  };

  // Si apre su tutta la sala, poi lo zoom va da sé sul proprio tavolo.
  useEffect(() => {
    if (!mioId || chiediRotazione) return;
    setVista('sala');
    const t = setTimeout(() => setVista('mio'), 900);
    return () => clearTimeout(t);
  }, [mioId, chiediRotazione, girata]);

  // Il biglietto arriva dopo lo zoom sulla sedia (750 ms), non durante.
  const daMostrare = grazie !== null && !!scelta && vista === 'mio';
  useEffect(() => {
    if (!daMostrare) return;
    const testo = grazie;
    const t = setTimeout(() => { setBiglietto(testo); onGrazieVisto?.(); }, 950);
    return () => clearTimeout(t);
  }, [daMostrare, grazie, onGrazieVisto]);

  const target = useMemo(() => {
    if (!aspetto) return null;
    if (vista === 'mio' && mio) return inquadraPosto(mio, scelta.posto, aspetto);
    if (scelto) return inquadraPosto(scelto, null, aspetto);
    return adattaProporzioni(confini(disposti), aspetto);
  }, [aspetto, vista, mio, scelto, disposti, scelta]);
  const vb = useViewBox(target);

  if (chiediRotazione) {
    return (
      <div className="tt-ruota" role="dialog" aria-modal="true" aria-label="Ruota il telefono">
        <button className="tt-tondo" onClick={onChiudi} aria-label="Indietro"><ChevronLeft size={22} /></button>
        <svg className="tt-telefono" viewBox="0 0 120 120" aria-hidden="true">
          <path d="M22 60 A38 38 0 0 1 60 22" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 6" />
          <path d="M55 17 L61 22 L55 27" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <g className="tt-corpo">
            <rect x="42" y="28" width="36" height="64" rx="8" fill="rgba(255,255,255,.12)" stroke="#fff" strokeWidth="2.5" />
            <rect x="54" y="33" width="12" height="2.5" rx="1.25" fill="#fff" opacity=".8" />
            <rect x="47" y="40" width="26" height="44" rx="3" fill="rgba(255,255,255,.18)" />
          </g>
        </svg>
        <h2>Ruota il telefono</h2>
        <p>In orizzontale la sala si vede per intero{scelta ? ' e trovi subito il tuo posto' : ''}.</p>
        <button className="tt-ruota-salta" onClick={() => setForzaVerticale(true)}>Ho la rotazione bloccata</button>
      </div>
    );
  }

  return (
    <div className="tt-sala" role="dialog" aria-modal="true" aria-label="Pianta della sala">
      <div className="tt-barra">
        <button className="tt-tondo" onClick={onChiudi} aria-label="Indietro"><ChevronLeft size={22} /></button>
        <div className="tt-barra-testo">
          <small>{scelto ? 'Tavolo' : mio ? 'Il tuo tavolo' : 'La sala'}</small>
          <strong>{scelto ? scelto.nome : mio ? mio.nome : 'Pianta dei tavoli'}</strong>
        </div>
        {mio && (
          <div className="tt-interruttore" role="group" aria-label="Inquadratura">
            <button aria-pressed={vista === 'sala'} onClick={() => setVista('sala')}>Sala</button>
            <button aria-pressed={vista === 'mio'} onClick={() => setVista('mio')}>Il mio posto</button>
          </div>
        )}
        {!mio && scelto && (
          <div className="tt-interruttore"><button onClick={() => setVista('sala')}>Sala</button></div>
        )}
        <button className={`tt-tondo tt-tondo-elenco${elenco ? ' attivo' : ''}`} onClick={() => setElenco(v => !v)}
          aria-label="Elenco dei tavoli" aria-expanded={elenco}><List size={20} /></button>
      </div>
      <div className="tt-vano">
        <div className="tt-palco" ref={palco}>
          {vb && <Sala tema={tema} tavoli={disposti} mioId={mioId} posto={scelta?.posto} viewBox={vb} numeri={numeri} evidenziaId={scelto?.id} />}
          {mio && scelta.posto != null && !elenco && biglietto === null && <div className="tt-legenda"><i /> Il tuo posto</div>}
          {biglietto !== null && <Grazie testo={biglietto} nome={scelta?.primo || ''} sposi={sposi} onChiudi={() => setBiglietto(null)} />}
        </div>
        {elenco && (
          <aside className="tt-elenco" aria-label="Tavoli">
            <p className="tt-elenco-titolo">I tavoli</p>
            <ul>
              {legenda.map(t => {
                const n = numeri.get(t.id);
                const attivo = t.id === (scelto?.id ?? (vista === 'mio' ? mioId : null));
                return (
                  <li key={t.id}>
                    <button onClick={() => guarda(t)} aria-current={attivo || undefined}
                      className={`${t.id === mioId ? 'mio' : ''}${attivo ? ' attivo' : ''}`}>
                      <span className="tt-numero">{n == null ? <Heart size={13} fill="currentColor" /> : n}</span>
                      <span className="tt-elenco-nome">{t.nome}</span>
                      {t.id === mioId && <small>il tuo</small>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
