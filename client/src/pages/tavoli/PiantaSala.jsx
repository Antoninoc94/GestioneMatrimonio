import { useRef, useState } from 'react';
import { RotateCw, LayoutGrid, Circle, RectangleHorizontal, MousePointerClick, Undo2 } from 'lucide-react';
import TavoloDaVicino from './TavoloDaVicino';
import { PIANTA_W, PIANTA_H, misure, posizioneDefault, nomeOspite, tipoTavolo, ruotabile, ingombro, posti, limitaPosizione, posizioneTavolo } from './util';

const COLORI = {
  normale: { fill: '#ffffff', stroke: '#d1d5db' },
  sposi: { fill: '#ffe4e6', stroke: '#fb7185' },
  bambini: { fill: '#f3e8ff', stroke: '#c084fc' },
};

// Per il tavolo sposi: dove stanno le sedie e quindi verso dove guardano
// gli sposi (oltre il tavolo, cioè dal lato opposto). rotate() in SVG gira
// in senso orario: le sedie partono in alto e passano a destra, in basso, a sinistra.
const ORIENTAMENTO = {
  0: 'Sedie sul lato in alto: gli sposi guardano verso il basso.',
  90: 'Sedie sul lato destro: gli sposi guardano verso sinistra.',
  180: "Sedie sul lato in basso: gli sposi guardano verso l'alto.",
  270: 'Sedie sul lato sinistro: gli sposi guardano verso destra.',
};

// Chi siede su ogni sedia: Map(indice sedia → ospite).
const perSedia = t => new Map(t.ospiti.filter(o => o.posto != null).map(o => [o.posto, o]));

const coloreSedia = o => (!o ? { fill: '#ffffff', stroke: '#d1d5db' }
  : o.tipo === 'bambino' ? { fill: '#c084fc', stroke: '#9333ea' }
  : { fill: '#fb7185', stroke: '#e11d48' });

export default function PiantaSala({ tavoli, salvaPosizioni, salvaTavolo, salvaPosti }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null); // { id, dx, dy, x, y, mosso }
  const [selId, setSelId] = useState(null);
  const [selOspite, setSelOspite] = useState(null);

  const nonPiazzati = tavoli.filter(t => t.pos_x == null || t.pos_y == null);
  const posizione = t => {
    if (drag?.id === t.id) return { x: drag.x, y: drag.y };
    return posizioneTavolo(t, tavoli);
  };

  const puntoSvg = e => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  const onPointerDown = (e, t) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = puntoSvg(e);
    const cur = posizione(t);
    setDrag({ id: t.id, dx: p.x - cur.x, dy: p.y - cur.y, x: cur.x, y: cur.y, mosso: false });
  };
  const onPointerMove = (e, t) => {
    if (drag?.id !== t.id) return;
    const p = puntoSvg(e);
    const n = limitaPosizione(t, p.x - drag.dx, p.y - drag.dy);
    // Qualche unità di tolleranza: un tocco col dito non deve diventare uno spostamento.
    const mosso = drag.mosso || Math.hypot(n.x - drag.x, n.y - drag.y) > 3;
    setDrag(d => ({ ...d, ...(mosso ? n : {}), mosso }));
  };
  const onPointerUp = t => {
    if (drag?.id !== t.id) return;
    if (drag.mosso) salvaPosizioni([{ id: t.id, x: drag.x, y: drag.y }]);
    else { setSelId(s => (s === t.id ? null : t.id)); setSelOspite(null); }
    setDrag(null);
  };

  const disponiInGriglia = () => {
    if (tavoli.length > nonPiazzati.length && !confirm('Riposizionare tutti i tavoli in griglia? Le posizioni attuali andranno perse.')) return;
    salvaPosizioni(tavoli.map((t, i) => {
      const p = posizioneDefault(i, tavoli.length);
      return { id: t.id, ...limitaPosizione(t, p.x, p.y) };
    }));
  };

  const sel = tavoli.find(t => t.id === selId);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px] items-start">
      <div className="card p-2 sm:p-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2 px-1">
          <p className="text-xs text-gray-500 mr-auto flex items-center gap-1">
            <MousePointerClick size={13} className="flex-shrink-0" /> Trascina i tavoli per disporli · tocca un tavolo per i dettagli
          </p>
          <button className="btn-secondary text-xs py-1" onClick={disponiInGriglia} disabled={tavoli.length === 0}>
            <LayoutGrid size={13} /> Disponi in griglia
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <svg ref={svgRef} viewBox={`0 0 ${PIANTA_W} ${PIANTA_H}`} className="w-full min-w-[640px] block select-none bg-gray-50" role="img" aria-label="Pianta della sala">
            <defs>
              <pattern id="griglia-sala" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#eceef1" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={PIANTA_W} height={PIANTA_H} fill="url(#griglia-sala)" />
            {tavoli.length === 0 && (
              <text x={PIANTA_W / 2} y={PIANTA_H / 2} textAnchor="middle" fill="#9ca3af" fontSize="22">Nessun tavolo: creane uno da "Gestisci"</text>
            )}
            {tavoli.map(t => {
              const { x, y } = posizione(t);
              const m = misure(t);
              const c = COLORI[t.tipo] || COLORI.normale;
              const occupati = t.ospiti.length;
              const sedute = perSedia(t);
              const oltre = occupati > t.capienza;
              const piazzato = t.pos_x != null && t.pos_y != null;
              const selezionato = selId === t.id;
              const { w: larghezza } = ingombro(t);
              const maxCar = Math.max(12, Math.floor(larghezza / 9.5));
              const nome = t.nome.length > maxCar ? `${t.nome.slice(0, maxCar - 1)}…` : t.nome;
              const stroke = selezionato ? '#e11d48' : oltre ? '#ef4444' : c.stroke;
              const emoji = tipoTavolo[t.tipo]?.emoji;
              return (
                <g key={t.id} transform={`translate(${x} ${y})`}
                  style={{ touchAction: 'none', cursor: drag?.id === t.id ? 'grabbing' : 'grab' }}
                  className="cursor-grab"
                  onPointerDown={e => onPointerDown(e, t)}
                  onPointerMove={e => onPointerMove(e, t)}
                  onPointerUp={() => onPointerUp(t)}
                  onPointerCancel={() => setDrag(null)}>
                  <g transform={`rotate(${ruotabile(t) ? t.rotazione || 0 : 0})`}>
                    {posti(t).map((p, i) => {
                      const c = coloreSedia(sedute.get(i));
                      return <circle key={i} cx={p.x} cy={p.y} r="9" fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />;
                    })}
                    {t.forma === 'rettangolare'
                      ? <rect x={-m.w / 2} y={-m.h / 2} width={m.w} height={m.h} rx="8" fill={c.fill} stroke={stroke}
                          strokeWidth={selezionato ? 3 : 2} strokeDasharray={piazzato ? undefined : '6 4'} />
                      : <circle r={m.r} fill={c.fill} stroke={stroke} strokeWidth={selezionato ? 3 : 2} strokeDasharray={piazzato ? undefined : '6 4'} />}
                  </g>
                  <text y={-2} textAnchor="middle" fontSize="17" fontWeight="700" fill="#111827" pointerEvents="none">
                    {emoji ? `${emoji} ` : ''}{nome}
                  </text>
                  <text y="19" textAnchor="middle" fontSize="14" fontWeight="600" fill={oltre ? '#ef4444' : '#6b7280'} pointerEvents="none">
                    {occupati}/{t.capienza}
                  </text>
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
            <p className={`text-xs mb-3 ${sel.ospiti.length > sel.capienza ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              {sel.ospiti.length}/{sel.capienza} posti occupati
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button className="btn-secondary text-xs py-1"
                onClick={() => salvaTavolo(sel.id, { forma: sel.forma === 'rettangolare' ? 'tondo' : 'rettangolare' })}>
                {sel.forma === 'rettangolare' ? <><Circle size={13} /> Rendi tondo</> : <><RectangleHorizontal size={13} /> Rendi rettangolare</>}
              </button>
              {ruotabile(sel) && (
                <button className="btn-secondary text-xs py-1" onClick={() => salvaTavolo(sel.id, { rotazione: ((sel.rotazione || 0) + 90) % 360 })}>
                  <RotateCw size={13} /> Ruota
                </button>
              )}
            </div>
            {sel.tipo === 'sposi' && (
              <p className="text-xs text-gray-400 -mt-1.5 mb-3">{ORIENTAMENTO[sel.rotazione || 0] || ORIENTAMENTO[0]} Usa "Ruota" per girarle verso la sala.</p>
            )}
            {sel.ospiti.length === 0 ? (
              <p className="text-xs text-gray-400">Nessun ospite seduto.</p>
            ) : (
              <Posti t={sel} selOspite={selOspite} setSelOspite={setSelOspite} salvaPosti={salvaPosti} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Chi siede dove. Si tocca un ospite e poi la sedia: se è occupata i due si
// scambiano. Al primo cambio tutto il tavolo viene salvato com'è, così le
// altre sedie non si spostano più da sole quando arriva un ospite nuovo.
function Posti({ t, selOspite, setSelOspite, salvaPosti }) {
  const sedute = perSedia(t);
  const scelto = t.ospiti.find(o => o.id === selOspite);
  const senzaSedia = t.ospiti.filter(o => o.posto == null);

  const siedi = i => {
    const occupante = sedute.get(i);
    if (!scelto) {
      if (occupante) setSelOspite(occupante.id);
      return;
    }
    if (occupante?.id === scelto.id) { setSelOspite(null); return; }
    const nuovi = t.ospiti.map(o => ({
      id: o.id,
      posto: o.id === scelto.id ? i : o.id === occupante?.id ? scelto.posto ?? null : o.posto ?? null,
    }));
    salvaPosti(t.id, nuovi);
    setSelOspite(null);
  };

  return (
    <>
      <TavoloDaVicino t={t} className="w-full max-w-[260px] mx-auto block my-1" onSedia={siedi}
        coloreTavolo={{ fill: '#f9fafb', stroke: '#d1d5db' }}
        sedia={i => {
          const o = sedute.get(i);
          const suo = scelto && o?.id === scelto.id;
          return { ...coloreSedia(o), testo: i + 1, coloreTesto: o ? '#ffffff' : '#9ca3af', evidenzia: suo, ...(suo ? { stroke: '#111827' } : {}) };
        }} />
      <p className="text-[11px] text-gray-500 text-center mb-2">
        {scelto ? <>Ora tocca la sedia per <strong>{nomeOspite(scelto)}</strong></> : 'Tocca un ospite (o la sua sedia), poi la sedia dove siede.'}
      </p>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] text-gray-400">{t.posti_scelti ? 'Posti scelti da voi' : 'Posti automatici: famiglie vicine'}</span>
        {t.posti_scelti && (
          <button className="text-[11px] text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1"
            onClick={() => { if (confirm('Tornare ai posti automatici per questo tavolo?')) salvaPosti(t.id, null); }}>
            <Undo2 size={11} /> Automatici
          </button>
        )}
      </div>
      <ul className="text-sm space-y-0.5 max-h-72 overflow-y-auto">
        {[...t.ospiti].sort((a, b) => (a.posto ?? 999) - (b.posto ?? 999)).map(o => (
          <li key={o.id}>
            <button onClick={() => setSelOspite(s => (s === o.id ? null : o.id))}
              className={`w-full flex items-center gap-2 text-left rounded px-1.5 py-0.5 ${selOspite === o.id ? 'bg-rose-50 ring-1 ring-rose-300' : 'hover:bg-gray-50'}`}>
              <span className={`w-5 h-5 flex-shrink-0 rounded-full text-[10px] font-bold flex items-center justify-center ${o.posto == null ? 'bg-red-100 text-red-600' : o.tipo === 'bambino' ? 'bg-purple-400 text-white' : 'bg-rose-400 text-white'}`}>
                {o.posto == null ? '!' : o.posto + 1}
              </span>
              <span className={`truncate ${o.rsvp === 'declinato' ? 'line-through text-red-400' : o.parent_id ? 'text-gray-500 text-xs' : 'text-gray-800'}`}>
                {o.sposo ? '💍 ' : ''}{nomeOspite(o)}{o.tipo === 'bambino' ? ' 👶' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {senzaSedia.length > 0 && (
        <p className="text-[11px] text-red-500 mt-1.5">{senzaSedia.length === 1 ? '1 ospite è' : `${senzaSedia.length} ospiti sono`} senza sedia: il tavolo è pieno.</p>
      )}
    </>
  );
}
