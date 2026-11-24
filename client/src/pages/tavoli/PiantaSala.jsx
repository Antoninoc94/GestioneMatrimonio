import { useRef, useState } from 'react';
import { RotateCw, LayoutGrid, MousePointerClick, ZoomIn, ZoomOut, Maximize2, Magnet } from 'lucide-react';
import { PIANTA_W, PIANTA_H, PASSO_GRIGLIA, misure, ingombro, sovrapposizioni, posizioneDefault, nomeOspite, tipoTavolo, formaTavolo, ellePosti, contornoElle, postiElle } from './util';

const COLORI = {
  normale: { fill: '#ffffff', stroke: '#d1d5db' },
  sposi: { fill: '#ffe4e6', stroke: '#fb7185' },
  bambini: { fill: '#f3e8ff', stroke: '#c084fc' },
};

// Si ruota ciò che non è simmetrico: il rettangolare, e il tavolo sposi
// anche tondo, perché le sue sedie stanno su un lato solo. Le sedie sono
// disegnate dentro lo stesso gruppo ruotato, quindi girano col tavolo; i
// quattro versi servono a scegliere verso dove guardano.
// Anche la L, che ha l'angolo da portare dal lato giusto.
const ruotabile = t => t.forma === 'rettangolare' || t.forma === 'elle' || t.tipo === 'sposi';
// Per il tavolo sposi: dove stanno le sedie e quindi verso dove guardano
// gli sposi (oltre il tavolo, cioè dal lato opposto). rotate() in SVG gira
// in senso orario: le sedie partono in alto e passano a destra, in basso, a sinistra.
const ORIENTAMENTO = {
  0: 'Sedie sul lato in alto: gli sposi guardano verso il basso.',
  90: 'Sedie sul lato destro: gli sposi guardano verso sinistra.',
  180: "Sedie sul lato in basso: gli sposi guardano verso l'alto.",
  270: 'Sedie sul lato sinistro: gli sposi guardano verso destra.',
};

// Posti attorno al tavolo, in coordinate locali (prima della rotazione).
function posti(t) {
  if (t.forma === 'elle') return postiElle(t);
  const n = Math.max(1, t.capienza || 1);
  const m = misure(t);
  // Tavolo sposi: tutti sullo stesso lato, mai uno di fronte all'altro. Le
  // sedie partono dal lato in alto, così gli sposi guardano verso il basso
  // della pianta; con "Ruota" si sceglie il lato.
  if (t.tipo === 'sposi') {
    if (t.forma === 'rettangolare') {
      return Array.from({ length: n }, (_, j) => ({ x: -m.w / 2 + (j + 0.5) * (m.w / n), y: -m.h / 2 - 15 }));
    }
    const passo = Math.min(0.55, Math.PI / Math.max(1, n - 1));
    return Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * passo;
      return { x: Math.cos(a) * (m.r + 15), y: Math.sin(a) * (m.r + 15) };
    });
  }
  if (t.forma === 'rettangolare') {
    const sopra = Math.ceil(n / 2), sotto = n - sopra;
    return [
      ...Array.from({ length: sopra }, (_, j) => ({ x: -m.w / 2 + (j + 0.5) * (m.w / sopra), y: -m.h / 2 - 15 })),
      ...Array.from({ length: sotto }, (_, j) => ({ x: -m.w / 2 + (j + 0.5) * (m.w / Math.max(1, sotto)), y: m.h / 2 + 15 })),
    ];
  }
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: Math.cos(a) * (m.r + 15), y: Math.sin(a) * (m.r + 15) };
  });
}

export default function PiantaSala({ tavoli, salvaPosizioni, salvaTavolo }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null); // { id, dx, dy, x, y, mosso }
  const [selId, setSelId] = useState(null);
  // Con la calamita il centro del tavolo si aggancia alla griglia mentre lo si trascina: sul telefono è l'unico modo di allinearli bene.
  const [calamita, setCalamita] = useState(true);
  // Telecamera: zoom (1 = tutta la sala) e angolo in alto a sinistra della
  // parte visibile, in unità della pianta. Su un telefono la sala intera è
  // piccola: si ingrandisce con due dita o con i bottoni.
  const [cam, setCam] = useState({ x: 0, y: 0, z: 1 });
  const ptrs = useRef(new Map()); // dita attualmente sullo schermo (coordinate schermo)
  const gesto = useRef(null);

  const nonPiazzati = tavoli.filter(t => t.pos_x == null || t.pos_y == null);
  const sovrapposti = new Set(sovrapposizioni(tavoli).flat().map(t => t.id));
  const posizione = t => {
    if (drag?.id === t.id) return { x: drag.x, y: drag.y };
    if (t.pos_x != null && t.pos_y != null) return { x: t.pos_x, y: t.pos_y };
    const p = posizioneDefault(tavoli.indexOf(t), tavoli.length);
    return limita(t, p.x, p.y);
  };

  const puntoSvg = e => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const vincola = (x, y, z) => {
    const zz = Math.min(4, Math.max(1, z));
    const w = PIANTA_W / zz, h = PIANTA_H / zz;
    return { z: zz, x: Math.min(Math.max(x, 0), PIANTA_W - w), y: Math.min(Math.max(y, 0), PIANTA_H - h) };
  };
  // Zoom attorno al centro della parte visibile (bottoni +/−).
  const zoomCentro = fattore => setCam(c => {
    const z = Math.min(4, Math.max(1, c.z * fattore));
    return vincola(c.x + (PIANTA_W / c.z - PIANTA_W / z) / 2, c.y + (PIANTA_H / c.z - PIANTA_H / z) / 2, z);
  });
  const dita = () => [...ptrs.current.values()];
  const inizioGesto = e => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      // Il secondo dito trasforma qualunque trascinamento in uno zoom.
      setDrag(null);
      const [a, b] = dita();
      const rect = svgRef.current.getBoundingClientRect();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const upp = PIANTA_W / cam.z / rect.width;
      gesto.current = {
        tipo: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: cam.z,
        px: cam.x + (mx - rect.left) * upp, py: cam.y + (my - rect.top) * upp,
      };
    } else if (ptrs.current.size === 1 && !e.target.closest('[data-tavolo]')) {
      // Sfondo: con un dito si sposta la pianta (se ingrandita).
      e.currentTarget.setPointerCapture(e.pointerId);
      gesto.current = { tipo: 'pan', sx: e.clientX, sy: e.clientY, cam0: cam };
    }
  };
  const movimentoGesto = e => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (!g) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (g.tipo === 'pinch' && ptrs.current.size === 2) {
      const [a, b] = dita();
      const z = Math.min(4, Math.max(1, g.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / g.d0)));
      const upp = PIANTA_W / z / rect.width;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      setCam(vincola(g.px - (mx - rect.left) * upp, g.py - (my - rect.top) * upp, z));
    } else if (g.tipo === 'pan') {
      const upp = PIANTA_W / g.cam0.z / rect.width;
      setCam(vincola(g.cam0.x - (e.clientX - g.sx) * upp, g.cam0.y - (e.clientY - g.sy) * upp, g.cam0.z));
    }
  };
  const fineGesto = e => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) gesto.current = null;
  };

  const limita = (t, x, y) => {
    const { w, h } = ingombro(t);
    const mw = w / 2 + 26, mh = h / 2 + 26; // posti compresi
    return {
      x: Math.round(Math.min(Math.max(x, mw), PIANTA_W - mw)),
      y: Math.round(Math.min(Math.max(y, mh), PIANTA_H - mh)),
    };
  };

  const onPointerDown = (e, t) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (ptrs.current.size > 0) return; // un secondo dito è uno zoom, non un trascinamento
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = puntoSvg(e);
    const cur = posizione(t);
    setDrag({ id: t.id, dx: p.x - cur.x, dy: p.y - cur.y, x: cur.x, y: cur.y, mosso: false });
  };
  const onPointerMove = (e, t) => {
    if (drag?.id !== t.id) return;
    const p = puntoSvg(e);
    const aggancia = v => (calamita ? Math.round(v / PASSO_GRIGLIA) * PASSO_GRIGLIA : v);
    const n = limita(t, aggancia(p.x - drag.dx), aggancia(p.y - drag.dy));
    // Qualche unità di tolleranza: un tocco col dito non deve diventare uno spostamento.
    const mosso = drag.mosso || Math.hypot(n.x - drag.x, n.y - drag.y) > 3;
    setDrag(d => ({ ...d, ...(mosso ? n : {}), mosso }));
  };
  const onPointerUp = t => {
    if (drag?.id !== t.id) return;
    if (drag.mosso) salvaPosizioni([{ id: t.id, x: drag.x, y: drag.y }]);
    else setSelId(s => (s === t.id ? null : t.id));
    setDrag(null);
  };

  const disponiInGriglia = () => {
    if (tavoli.length > nonPiazzati.length && !confirm('Riposizionare tutti i tavoli in griglia? Le posizioni attuali andranno perse.')) return;
    salvaPosizioni(tavoli.map((t, i) => {
      const p = posizioneDefault(i, tavoli.length);
      return { id: t.id, ...limita(t, p.x, p.y) };
    }));
  };

  const sel = tavoli.find(t => t.id === selId);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px] items-start">
      <div className="card p-2 sm:p-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2 px-1">
          <p className="text-xs text-gray-500 mr-auto flex items-center gap-1">
            <MousePointerClick size={13} className="flex-shrink-0" /> Trascina i tavoli · tocca per i dettagli · due dita per ingrandire
          </p>
          <div className="flex items-center gap-1">
            <button className="btn-secondary px-2.5 py-2 sm:py-1" aria-label="Rimpicciolisci" onClick={() => zoomCentro(1 / 1.5)} disabled={cam.z <= 1}><ZoomOut size={15} /></button>
            <button className="btn-secondary px-2.5 py-2 sm:py-1" aria-label="Ingrandisci" onClick={() => zoomCentro(1.5)} disabled={cam.z >= 4}><ZoomIn size={15} /></button>
            <button className="btn-secondary px-2.5 py-2 sm:py-1" aria-label="Mostra tutta la sala" onClick={() => setCam({ x: 0, y: 0, z: 1 })} disabled={cam.z === 1}><Maximize2 size={15} /></button>
          </div>
          <button className={`btn-secondary text-xs py-2 sm:py-1 ${calamita ? 'ring-2 ring-rose-300 text-rose-700' : ''}`} aria-pressed={calamita}
            title="Aggancia i tavoli alla griglia mentre li trascini" onClick={() => setCalamita(v => !v)}>
            <Magnet size={13} /> Calamita
          </button>
          <button className="btn-secondary text-xs py-2 sm:py-1" onClick={disponiInGriglia} disabled={tavoli.length === 0}>
            <LayoutGrid size={13} /> Disponi in griglia
          </button>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-100">
          <svg ref={svgRef} viewBox={`${cam.x} ${cam.y} ${PIANTA_W / cam.z} ${PIANTA_H / cam.z}`}
            style={{ touchAction: 'none' }}
            onPointerDown={inizioGesto} onPointerMove={movimentoGesto} onPointerUp={fineGesto} onPointerCancel={fineGesto}
            className="w-full block select-none bg-gray-50" role="img" aria-label="Pianta della sala">
            <defs>
              <pattern id="griglia-sala" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#eceef1" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={PIANTA_W} height={PIANTA_H} fill="url(#griglia-sala)" stroke="#d1d5db" strokeWidth="2" />
            {tavoli.length === 0 && (
              <text x={PIANTA_W / 2} y={PIANTA_H / 2} textAnchor="middle" fill="#9ca3af" fontSize="22">Nessun tavolo: creane uno da "Gestisci"</text>
            )}
            {tavoli.map(t => {
              const { x, y } = posizione(t);
              const m = misure(t);
              const c = COLORI[t.tipo] || COLORI.normale;
              const occupati = t.ospiti.length;
              // Posti colorati: prima gli adulti, poi i bambini in viola come nella legenda.
              const adulti = t.ospiti.filter(o => o.tipo !== 'bambino').length;
              const oltre = occupati > t.capienza;
              const piazzato = t.pos_x != null && t.pos_y != null;
              const selezionato = selId === t.id;
              const { w: larghezza } = ingombro(t);
              const maxCar = Math.max(12, Math.floor(larghezza / 9.5));
              const nome = t.nome.length > maxCar ? `${t.nome.slice(0, maxCar - 1)}…` : t.nome;
              const stroke = selezionato ? '#e11d48' : oltre ? '#ef4444' : sovrapposti.has(t.id) ? '#f59e0b' : c.stroke;
              // Etichetta: al centro del riquadro. La L ha lì il suo incavo, dove non
              // ci sono sedie solo se siedono fuori; altrimenti va sull'angolo (ruotato
              // con il tavolo, il testo no) e il nome si accorcia.
              let ax = 0, ay = 0, nomeMax = maxCar, fsNome = 17;
              if (t.forma === 'elle' && t.tipo !== 'sposi' && t.elle_posti !== 'esterno') {
                const rad = ((t.rotazione || 0) * Math.PI) / 180;
                const lx = -m.S / 2 + m.T / 2, ly = m.S / 2 - m.T / 2;
                ax = lx * Math.cos(rad) - ly * Math.sin(rad);
                ay = lx * Math.sin(rad) + ly * Math.cos(rad);
                nomeMax = 7;
                fsNome = 14;
              }
              const nomeVisibile = t.nome.length > nomeMax ? `${t.nome.slice(0, nomeMax - 1)}…` : t.nome;
              const emoji = tipoTavolo[t.tipo]?.emoji;
              return (
                <g key={t.id} data-tavolo transform={`translate(${x} ${y})`}
                  style={{ touchAction: 'none', cursor: drag?.id === t.id ? 'grabbing' : 'grab' }}
                  className="cursor-grab"
                  onPointerDown={e => onPointerDown(e, t)}
                  onPointerMove={e => onPointerMove(e, t)}
                  onPointerUp={() => onPointerUp(t)}
                  onPointerCancel={() => setDrag(null)}>
                  <g transform={`rotate(${ruotabile(t) ? t.rotazione || 0 : 0})`}>
                    {posti(t).map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="9"
                        fill={i < adulti ? '#fb7185' : i < occupati ? '#c084fc' : '#ffffff'}
                        stroke={i < adulti ? '#e11d48' : i < occupati ? '#9333ea' : '#d1d5db'} strokeWidth="1.5" />
                    ))}
                    {t.forma === 'elle'
                      ? <polygon points={contornoElle(m.S, m.T).map(p => p.join(',')).join(' ')} fill={c.fill} stroke={stroke}
                          strokeLinejoin="round" strokeWidth={selezionato ? 3 : 2} strokeDasharray={piazzato ? undefined : '6 4'} />
                      : t.forma === 'rettangolare'
                      ? <rect x={-m.w / 2} y={-m.h / 2} width={m.w} height={m.h} rx="8" fill={c.fill} stroke={stroke}
                          strokeWidth={selezionato ? 3 : 2} strokeDasharray={piazzato ? undefined : '6 4'} />
                      : <circle r={m.r} fill={c.fill} stroke={stroke} strokeWidth={selezionato ? 3 : 2} strokeDasharray={piazzato ? undefined : '6 4'} />}
                  </g>
                  <g transform={`translate(${ax} ${ay})`} pointerEvents="none">
                    <text y={-2} textAnchor="middle" fontSize={fsNome} fontWeight="700" fill="#111827"
                      stroke="#fff" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">
                      {emoji ? `${emoji} ` : ''}{nomeMax === maxCar ? nome : nomeVisibile}
                    </text>
                    <text y={fsNome + 2} textAnchor="middle" fontSize="14" fontWeight="600" fill={oltre ? '#ef4444' : '#6b7280'}
                      stroke="#fff" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">
                      {occupati}/{t.capienza}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-400 border border-rose-600" /> adulto</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400 border border-purple-600" /> bambino 👶</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300" /> posto libero</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-dashed border-gray-300" /> non ancora posizionato</span>
          <span>💍 tavolo sposi · 🧸 tavolo bambini</span>
        </div>
        {nonPiazzati.length > 0 && tavoli.length > nonPiazzati.length && (
          <p className="text-xs text-amber-600 mt-1 px-1">{nonPiazzati.length} tavoli non ancora posizionati (bordo tratteggiato): trascinali dove vuoi.</p>
        )}
      </div>

      <div className="card min-w-0 lg:sticky lg:top-0">
        {!sel ? (
          <p className="text-sm text-gray-400 text-center py-6">Seleziona un tavolo sulla pianta per vederne gli ospiti.</p>
        ) : (
          <>
            <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
              {tipoTavolo[sel.tipo]?.emoji} {sel.nome}
            </h3>
            {sel.descrizione && <p className="text-xs text-gray-500 -mt-0.5 mb-1">{sel.descrizione}</p>}
            <p className={`text-xs mb-3 ${sel.ospiti.length > sel.capienza ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              {sel.ospiti.length}/{sel.capienza} posti occupati{sovrapposti.has(sel.id) ? ' · si sovrappone a un altro tavolo' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <select className="form-input text-xs py-2 sm:py-1 w-auto" aria-label="Forma del tavolo" value={sel.forma || 'tondo'}
                onChange={e => salvaTavolo(sel.id, { forma: e.target.value })}>
                {Object.entries(formaTavolo).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {sel.forma === 'elle' && sel.tipo !== 'sposi' && (
                <select className="form-input text-xs py-2 sm:py-1 w-auto" aria-label="Posti del tavolo a L" value={sel.elle_posti || 'entrambi'}
                  onChange={e => salvaTavolo(sel.id, { elle_posti: e.target.value })}>
                  {Object.entries(ellePosti).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
              {ruotabile(sel) && (
                <button className="btn-secondary text-xs py-2 sm:py-1" onClick={() => salvaTavolo(sel.id, { rotazione: ((sel.rotazione || 0) + 90) % 360 })}>
                  <RotateCw size={13} /> Ruota
                </button>
              )}
            </div>
            {sel.tipo === 'sposi' && sel.forma !== 'elle' && (
              <p className="text-xs text-gray-400 -mt-1.5 mb-3">{ORIENTAMENTO[sel.rotazione || 0] || ORIENTAMENTO[0]} Usa "Ruota" per girarle verso la sala.</p>
            )}
            {sel.ospiti.length === 0 ? (
              <p className="text-xs text-gray-400">Nessun ospite seduto.</p>
            ) : (
              <ul className="text-sm space-y-0.5 max-h-80 overflow-y-auto">
                {sel.ospiti.map(o => (
                  <li key={o.id} className={`truncate ${o.rsvp === 'declinato' ? 'line-through text-red-400' : o.parent_id ? 'text-gray-500 text-xs pl-3' : 'text-gray-800'}`}>
                    {o.sposo ? '💍 ' : ''}{nomeOspite(o)}{o.tipo === 'bambino' ? ' 👶' : ''}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
