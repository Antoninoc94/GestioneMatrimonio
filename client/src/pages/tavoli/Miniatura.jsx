import { PIANTA_W, PIANTA_H, misure, posizioneDefault, contornoElle } from './util';

const COLORI = {
  normale: { fill: '#ffffff', stroke: '#9ca3af' },
  sposi: { fill: '#ffe4e6', stroke: '#fb7185' },
  bambini: { fill: '#f3e8ff', stroke: '#c084fc' },
};

// La sala in piccolo: solo i corpi dei tavoli, senza sedie né nomi, per
// riconoscere a colpo d'occhio un preset. `tavoli` ha forma, tipo, rotazione,
// elle_posti, capienza e pos_x/pos_y, come l'anteprima dei preset.
export default function Miniatura({ tavoli, className = '' }) {
  return (
    <svg viewBox={`0 0 ${PIANTA_W} ${PIANTA_H}`} className={`bg-gray-50 border border-gray-200 rounded ${className}`} role="img" aria-label="Anteprima della sala">
      {tavoli.map((t, i) => {
        const piazzato = t.pos_x != null && t.pos_y != null;
        const p = piazzato ? { x: t.pos_x, y: t.pos_y } : posizioneDefault(i, tavoli.length);
        const m = misure(t);
        const c = COLORI[t.tipo] || COLORI.normale;
        const rot = t.forma === 'rettangolare' || t.forma === 'elle' || t.tipo === 'sposi' ? t.rotazione || 0 : 0;
        const stile = { fill: c.fill, stroke: c.stroke, strokeWidth: 9, strokeDasharray: piazzato ? undefined : '18 12' };
        return (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${rot})`}>
            {t.forma === 'elle'
              ? <polygon points={contornoElle(m.S, m.T).map(q => q.join(',')).join(' ')} strokeLinejoin="round" {...stile} />
              : t.forma === 'rettangolare'
              ? <rect x={-m.w / 2} y={-m.h / 2} width={m.w} height={m.h} rx="14" {...stile} />
              : <circle r={m.r} {...stile} />}
          </g>
        );
      })}
    </svg>
  );
}
