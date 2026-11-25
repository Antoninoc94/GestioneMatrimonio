import { misure, ruotabile, righeNome, areaNome, sedieRuotate, contornoElle } from './util';

export function TestoTavolo({ t, testo = t.nome, fill = '#374151', max = 26, fontFamily, fontWeight = 700 }) {
  const area = areaNome(t);
  const { fs, righe } = righeNome(testo, area.w, area.h, { max });
  const lh = fs * 1.15;
  return (
    <text transform={`translate(${area.x || 0} ${area.y || 0})`} textAnchor="middle" fontSize={fs} fontWeight={fontWeight} fontFamily={fontFamily} fill={fill} pointerEvents="none">
      {righe.map((r, i) => (
        <tspan key={i} x="0" y={(i - (righe.length - 1) / 2) * lh + fs * 0.35}>{r}</tspan>
      ))}
    </text>
  );
}

const R_SEDIA = 14;

// Un tavolo solo, ingrandito, con le sedie numerate. `sedia(i)` dice come
// disegnare la sedia i: { fill, stroke, testo, evidenzia }. Con `onSedia` le
// sedie si toccano (gestione dei posti), altrimenti è solo da guardare.
export default function TavoloDaVicino({ t, sedia, onSedia, coloreTavolo = { fill: '#ffffff', stroke: '#d1d5db' }, testo, fontFamily, coloreTesto, className, style }) {
  const sedie = sedieRuotate(t);
  const m = misure(t);
  const rot = ruotabile(t) ? t.rotazione || 0 : 0;
  // Margine per l'alone pulsante della sedia evidenziata.
  const lato = Math.max(...sedie.map(p => Math.max(Math.abs(p.x), Math.abs(p.y))), m.w / 2, m.h / 2) + R_SEDIA + 12;
  return (
    <svg viewBox={`${-lato} ${-lato} ${lato * 2} ${lato * 2}`} className={className} style={style} role="img" aria-label={`Tavolo ${t.nome}`}>
      <g transform={`rotate(${rot})`}>
        {t.forma === 'elle'
          ? <polygon points={contornoElle(m.S, m.T).map(p => p.join(',')).join(' ')} strokeLinejoin="round" fill={coloreTavolo.fill} stroke={coloreTavolo.stroke} strokeWidth="2" />
          : t.forma === 'rettangolare'
          ? <rect x={-m.w / 2} y={-m.h / 2} width={m.w} height={m.h} rx="8" fill={coloreTavolo.fill} stroke={coloreTavolo.stroke} strokeWidth="2" />
          : <circle r={m.r} fill={coloreTavolo.fill} stroke={coloreTavolo.stroke} strokeWidth="2" />}
      </g>
      <TestoTavolo t={t} testo={testo} fill={coloreTesto} fontFamily={fontFamily} max={22} />
      {sedie.map((p, i) => {
        const d = sedia(i);
        return (
          <g key={i} transform={`translate(${p.x} ${p.y})`}
            onClick={onSedia ? () => onSedia(i) : undefined}
            style={onSedia ? { cursor: 'pointer' } : undefined}>
            {d.evidenzia && (
              <circle r={R_SEDIA + 7} fill="none" stroke={d.stroke} strokeWidth="3">
                <animate attributeName="opacity" values="0.9;0.15;0.9" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <circle r={R_SEDIA} fill={d.fill} stroke={d.stroke} strokeWidth={d.evidenzia ? 3 : 1.5} />
            {d.testo != null && (
              <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill={d.coloreTesto || '#374151'} pointerEvents="none">{d.testo}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
