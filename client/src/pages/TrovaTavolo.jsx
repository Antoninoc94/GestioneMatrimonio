import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Search, MapPin, Armchair, X, Smartphone } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { TEMI } from '../temiWedding';
import { PIANTA_W, PIANTA_H, misure, ruotabile, posti, posizioneTavolo } from './tavoli/util';
import TavoloDaVicino, { TestoTavolo } from './tavoli/TavoloDaVicino';

// Pagina per gli invitati, raggiunta dal QR all'ingresso della sala: si scrive
// il proprio nome, si vede il tavolo e lo si ritrova evidenziato sulla pianta.
// Usa axios e non `api`: `api` porta al login su un 401, qui non c'è login.

const SERIF = '"Playfair Display", Georgia, serif';
const CHIAVE_SCELTA = 'trova-tavolo-scelta';

const leggiScelta = () => {
  try { return JSON.parse(localStorage.getItem(CHIAVE_SCELTA)) || null; } catch { return null; }
};
const salvaScelta = v => {
  try {
    if (v) localStorage.setItem(CHIAVE_SCELTA, JSON.stringify(v));
    else localStorage.removeItem(CHIAVE_SCELTA);
  } catch { /* navigazione privata: si ricomincia dalla ricerca */ }
};

const nomeCompleto = o => [o.nome, o.cognome].filter(Boolean).join(' ');

export default function TrovaTavolo() {
  const [info, setInfo] = useState(null);
  const [scheda, setScheda] = useState('cerca');
  const [q, setQ] = useState('');
  const [esito, setEsito] = useState(null); // { risultati, altri } | null
  const [cercando, setCercando] = useState(false);
  const [errore, setErrore] = useState('');
  // { id, nome, tavolo: { id, nome }, posto }: resta dopo una ricarica della
  // pagina, così chi riapre il link dal telefono trova subito il suo tavolo.
  const [scelta, setScelta] = useState(leggiScelta);
  const [tavoli, setTavoli] = useState(null);
  const richiesta = useRef(0);

  useEffect(() => {
    if (!document.getElementById('wedding-fonts')) {
      const link = document.createElement('link');
      link.id = 'wedding-fonts';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Great+Vibes&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    axios.get('/api/tavolo/info').then(r => setInfo(r.data)).catch(() => setInfo({ abilitata: 0 }));
  }, []);

  useEffect(() => {
    if (info?.abilitata !== 1) return;
    axios.get('/api/tavolo/pianta').then(r => setTavoli(r.data)).catch(() => setTavoli([]));
  }, [info]);

  // Si cerca mentre si scrive, con una breve pausa. Il contatore scarta le
  // risposte arrivate fuori ordine: su una rete lenta "Ma" può rispondere dopo "Mar".
  useEffect(() => {
    const testo = q.trim();
    if (testo.replace(/\s/g, '').length < 2) { richiesta.current++; setEsito(null); setErrore(''); setCercando(false); return; }
    const n = ++richiesta.current;
    setCercando(true);
    const timer = setTimeout(() => {
      axios.get('/api/tavolo/cerca', { params: { q: testo } })
        .then(r => { if (n === richiesta.current) { setEsito(r.data); setErrore(''); } })
        .catch(err => { if (n === richiesta.current) setErrore(err.response?.data?.error || 'Connessione assente: riprova tra un attimo.'); })
        .finally(() => { if (n === richiesta.current) setCercando(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  // Riaprendo la pagina, la scelta salvata si aggiorna: nel frattempo gli
  // sposi possono aver cambiato tavolo o sedia. Si rifà la ricerca col nome e
  // si riprende la stessa persona per id; sparita dai risultati, si dimentica.
  useEffect(() => {
    if (info?.abilitata !== 1) return;
    const salvata = leggiScelta();
    if (!salvata?.id) return;
    axios.get('/api/tavolo/cerca', { params: { q: salvata.nome } }).then(r => {
      const o = r.data.risultati.find(x => x.id === salvata.id);
      const v = o ? { id: o.id, nome: nomeCompleto(o), tavolo: o.tavolo, posto: o.posto } : null;
      setScelta(v);
      salvaScelta(v);
    }).catch(() => { /* offline: resta quella salvata */ });
  }, [info]);

  const scegli = o => {
    const v = { id: o.id, nome: nomeCompleto(o), tavolo: o.tavolo, posto: o.posto };
    setScelta(v);
    salvaScelta(v);
    setQ('');
    setEsito(null);
  };
  const dimentica = () => { setScelta(null); salvaScelta(null); };

  if (!info) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf7f4', fontSize: '2.5rem' }}>💍</div>;
  }

  const tema = TEMI[info.landing_tema] || TEMI.rose;
  const bg = tema.bg || '#faf7f4';
  const sposi = [info.nome_sposo1, info.nome_sposo2].filter(Boolean).join(' & ');
  const data = info.data_matrimonio ? format(parseISO(info.data_matrimonio), 'd MMMM yyyy', { locale: it }) : '';

  const intestazione = (
    <header style={{ textAlign: 'center', padding: '2.25rem 1rem 1.25rem', background: `linear-gradient(135deg, ${tema.dark} 0%, ${tema.primary} 65%, ${tema.mid} 100%)`, color: '#fff' }}>
      <p style={{ fontFamily: '"Great Vibes", cursive', fontSize: '2.6rem', lineHeight: 1.1, margin: 0 }}>{sposi || 'Benvenuti'}</p>
      {data && <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.95rem', opacity: 0.85, margin: '0.35rem 0 0' }}>{data}</p>}
    </header>
  );

  if (info.abilitata !== 1) {
    return (
      <div style={{ minHeight: '100vh', background: bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {intestazione}
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center' }}>
          <Armchair size={40} color={tema.mid} style={{ margin: '0 auto 1rem' }} />
          <h1 style={{ fontFamily: SERIF, color: tema.dark, fontSize: '1.5rem', fontWeight: 400, margin: '0 0 0.75rem' }}>Ci vediamo presto!</h1>
          <p style={{ color: '#6b7280', lineHeight: 1.6 }}>La disposizione dei tavoli sarà disponibile qui il giorno del matrimonio.</p>
        </div>
      </div>
    );
  }

  const schede = [
    { id: 'cerca', label: 'Il tuo tavolo', icon: Search },
    { id: 'pianta', label: 'Pianta della sala', icon: MapPin },
  ];

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1f2937' }}>
      {intestazione}

      <nav role="tablist" style={{ display: 'flex', gap: '0.375rem', maxWidth: 480, margin: '-1.1rem auto 0', padding: '0.3rem', background: '#fff', borderRadius: '2rem', boxShadow: '0 6px 18px -8px rgba(0,0,0,0.25)', position: 'relative', width: 'calc(100% - 2rem)' }}>
        {schede.map(({ id, label, icon: Icon }) => {
          const attiva = scheda === id;
          return (
            <button key={id} role="tab" aria-selected={attiva} onClick={() => setScheda(id)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem 0.5rem', border: 0, borderRadius: '2rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, background: attiva ? tema.primary : 'transparent', color: attiva ? '#fff' : tema.text }}>
              <Icon size={15} /> {label}
            </button>
          );
        })}
      </nav>

      <main style={{ maxWidth: scheda === 'pianta' ? 960 : 480, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        {scheda === 'cerca' ? (
          <>
            {scelta && (
              <div style={{ background: '#fff', border: `1px solid ${tema.border}`, borderRadius: '1.25rem', padding: '1.5rem 1.25rem', textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
                <button onClick={dimentica} aria-label="Cerca un altro nome"
                  style={{ position: 'absolute', top: 10, right: 10, border: 0, background: 'transparent', color: '#9ca3af', cursor: 'pointer', padding: 6 }}>
                  <X size={18} />
                </button>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>{scelta.nome}, siedi al</p>
                <p style={{ fontFamily: SERIF, fontSize: '2rem', color: tema.dark, margin: '0.25rem 0 0.5rem', lineHeight: 1.2 }}>{tavoli?.find(t => t.id === scelta.tavolo.id)?.nome || scelta.tavolo.nome}</p>
                <SediaDaVicino tavolo={tavoli?.find(t => t.id === scelta.tavolo.id)} posto={scelta.posto} tema={tema} />
                <button onClick={() => setScheda('pianta')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: tema.primary, color: '#fff', border: 0, borderRadius: '2rem', padding: '0.7rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                  <MapPin size={16} /> Vedi sulla pianta
                </button>
              </div>
            )}

            <label htmlFor="cerca-nome" style={{ display: 'block', fontFamily: SERIF, fontSize: '1.2rem', color: tema.dark, textAlign: 'center', marginBottom: '0.75rem' }}>
              {scelta ? 'Cerca un altro nome' : 'Scrivi il tuo nome'}
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input id="cerca-nome" type="search" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" autoCapitalize="words"
                placeholder="Nome o cognome" autoFocus={!scelta}
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.85rem 1rem 0.85rem 2.6rem', fontSize: '1rem', border: `1px solid ${tema.border}`, borderRadius: '0.9rem', background: '#fff', outline: 'none' }} />
            </div>

            <div aria-live="polite" style={{ marginTop: '0.75rem' }}>
              {errore && <p style={{ color: '#dc2626', fontSize: '0.875rem', textAlign: 'center' }}>{errore}</p>}
              {!errore && esito && esito.risultati.length === 0 && !cercando && (
                <p style={{ color: '#6b7280', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6, padding: '0.5rem 0.5rem 0' }}>
                  Nessun posto a questo nome. Prova col cognome, oppure chiedi al personale di sala.
                </p>
              )}
              {esito?.risultati.length > 0 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: '#fff', border: `1px solid ${tema.border}`, borderRadius: '0.9rem', overflow: 'hidden' }}>
                  {esito.risultati.map((o, i) => (
                    <li key={o.id} style={{ borderTop: i ? `1px solid ${tema.light}` : 0 }}>
                      <button onClick={() => scegli(o)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 1rem', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: '0.95rem', color: '#1f2937' }}>
                        <span style={{ fontWeight: 500 }}>{nomeCompleto(o)}</span>
                        <span style={{ fontFamily: SERIF, fontStyle: 'italic', color: tema.text, whiteSpace: 'nowrap' }}>{o.tavolo.nome}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {esito?.altri && <p style={{ color: '#9ca3af', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.5rem' }}>Ci sono altri nomi simili: aggiungi il cognome.</p>}
            </div>
          </>
        ) : (
          <Pianta tavoli={tavoli} evidenziato={scelta?.tavolo.id} posto={scelta?.posto} tema={tema} onCerca={() => setScheda('cerca')} haScelta={!!scelta} />
        )}
      </main>
    </div>
  );
}

// Telefono tenuto in verticale: la sala (3:2, più larga che alta) ci sta
// stretta. Un tablet o un computer in verticale ha spazio a sufficienza.
const QUERY_VERTICALE = '(orientation: portrait) and (max-width: 640px)';
function useVerticale() {
  const [verticale, setVerticale] = useState(() => window.matchMedia?.(QUERY_VERTICALE).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY_VERTICALE);
    if (!mq) return;
    const cambia = e => setVerticale(e.matches);
    mq.addEventListener('change', cambia);
    return () => mq.removeEventListener('change', cambia);
  }, []);
  return verticale;
}

// Il proprio tavolo ingrandito, con la propria sedia illuminata. Le sedie vere
// non hanno numeri, quindi qui non ce ne sono: conta la posizione.
function SediaDaVicino({ tavolo, posto, tema }) {
  if (!tavolo || posto == null) return <div style={{ height: '0.5rem' }} />;
  return (
    <>
      <TavoloDaVicino t={tavolo} style={{ display: 'block', width: '100%', maxWidth: 230, margin: '0 auto' }}
        coloreTavolo={{ fill: tema.light, stroke: tema.border }} fontFamily={SERIF} coloreTesto={tema.dark}
        sedia={i => (i === posto
          ? { fill: tema.primary, stroke: tema.dark, evidenzia: true }
          : { fill: '#ffffff', stroke: '#d1d5db' })} />
      <p style={{ margin: '0.25rem 0 1rem', color: '#6b7280', fontSize: '0.85rem' }}>Il tuo posto è quello illuminato.</p>
    </>
  );
}

// Sola lettura e niente ospiti: solo dove sta ogni tavolo, col proprio in evidenza.
function Pianta({ tavoli, evidenziato, posto, tema, onCerca, haScelta }) {
  const scrollRef = useRef(null);
  const verticale = useVerticale();
  const [avvisoChiuso, setAvvisoChiuso] = useState(false);
  const mio = tavoli?.find(t => t.id === evidenziato);

  // Sul telefono la pianta è più larga dello schermo: si porta il proprio
  // tavolo al centro invece di lasciarlo magari fuori vista a destra.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !mio) return;
    const { x } = posizioneTavolo(mio, tavoli);
    const larghezza = box.scrollWidth;
    box.scrollLeft = (x / PIANTA_W) * larghezza - box.clientWidth / 2;
  }, [mio, tavoli]);

  if (!tavoli) return <p style={{ textAlign: 'center', color: '#9ca3af' }}>Carico la pianta…</p>;
  if (tavoli.length === 0) return <p style={{ textAlign: 'center', color: '#6b7280' }}>La pianta della sala non è ancora pronta.</p>;

  return (
    <>
      {verticale && !avvisoChiuso && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: tema.light, border: `1px solid ${tema.border}`, borderRadius: '0.9rem', padding: '0.75rem 0.85rem', marginBottom: '1rem' }}>
          <Smartphone size={26} color={tema.primary} style={{ flexShrink: 0, animation: 'ruota-telefono 2.4s ease-in-out infinite' }} />
          <p style={{ margin: 0, fontSize: '0.875rem', color: tema.text, lineHeight: 1.4, flex: 1 }}>
            <strong>Ruota il telefono in orizzontale</strong> per vedere meglio la sala.
          </p>
          <button onClick={() => setAvvisoChiuso(true)} aria-label="Chiudi l'avviso"
            style={{ border: 0, background: 'transparent', color: '#9ca3af', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <X size={16} />
          </button>
          <style>{'@keyframes ruota-telefono { 0%, 25% { transform: rotate(0deg); } 50%, 75% { transform: rotate(-90deg); } 100% { transform: rotate(0deg); } }'}</style>
        </div>
      )}
      <p style={{ textAlign: 'center', color: '#4b5563', fontSize: '0.95rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
        {mio
          ? <>Il tuo tavolo è <strong style={{ color: tema.dark }}>{mio.nome}</strong>{posto != null ? ': il tuo posto è illuminato.' : ', evidenziato qui sotto.'}</>
          : haScelta ? 'Il tuo tavolo non è sulla pianta: chiedi al personale di sala.'
          : <>Cerca il tuo nome per vedere dove siedi. <button onClick={onCerca} style={{ border: 0, background: 'none', color: tema.primary, fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>Cerca</button></>}
      </p>
      <div ref={scrollRef} style={{ overflowX: 'auto', borderRadius: '1rem', border: `1px solid ${tema.border}`, background: '#fff', WebkitOverflowScrolling: 'touch' }}>
        <svg viewBox={`0 0 ${PIANTA_W} ${PIANTA_H}`} style={{ display: 'block', width: '100%', minWidth: 720 }} role="img" aria-label="Pianta della sala">
          <rect width={PIANTA_W} height={PIANTA_H} fill={tema.light} opacity="0.5" />
          {tavoli.map(t => {
            const { x, y } = posizioneTavolo(t, tavoli);
            const m = misure(t);
            const suo = t.id === evidenziato;
            const conSedia = suo && posto != null;
            // Con la sedia nota, il tavolo resta chiaro e si illumina la sedia;
            // senza, si colora il tavolo intero.
            const fill = suo && !conSedia ? tema.primary : suo || t.tipo === 'sposi' ? tema.light : '#ffffff';
            const stroke = suo ? tema.primary : tema.border;
            return (
              <g key={t.id} transform={`translate(${x} ${y})`}>
                <g transform={`rotate(${ruotabile(t) ? t.rotazione || 0 : 0})`}>
                  {t.forma === 'rettangolare'
                    ? <rect x={-m.w / 2} y={-m.h / 2} width={m.w} height={m.h} rx="8" fill={fill} stroke={stroke} strokeWidth={suo ? 4 : 2} />
                    : <circle r={m.r} fill={fill} stroke={stroke} strokeWidth={suo ? 4 : 2} />}
                  {posti(t).map((p, i) => {
                    const mia = conSedia && i === posto;
                    return (
                      <g key={i} transform={`translate(${p.x} ${p.y})`}>
                        {mia && (
                          <circle r="22" fill="none" stroke={tema.primary} strokeWidth="4">
                            <animate attributeName="opacity" values="0.9;0.15;0.9" dur="1.6s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <circle r={mia ? 13 : 8} fill={mia ? tema.primary : suo && !conSedia ? tema.mid : '#ffffff'}
                          stroke={mia ? tema.dark : suo && !conSedia ? tema.dark : '#d1d5db'} strokeWidth={mia ? 3 : 1.5} />
                      </g>
                    );
                  })}
                </g>
                {suo && !conSedia && (
                  <circle r={Math.max(m.w, m.h) / 2 + 34} fill="none" stroke={tema.primary} strokeWidth="4" opacity="0.6">
                    <animate attributeName="opacity" values="0.7;0.1;0.7" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
                <TestoTavolo t={t} testo={t.tipo === 'sposi' ? `💍 ${t.nome}` : t.nome} max={28} fontFamily={SERIF}
                  fill={suo && !conSedia ? '#ffffff' : suo ? tema.dark : '#374151'} />
              </g>
            );
          })}
        </svg>
      </div>
      {verticale && <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.6rem' }}>Scorri di lato per vedere tutta la sala.</p>}
    </>
  );
}
