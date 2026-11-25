import { misure, ruotabile, posti, righeNome, areaNome } from '../tavoli/util';
import { angoloSedia } from './geometria';

// La sala disegnata per gli invitati. Tavoli come tovaglie con un'ombra
// morbida, sedie vere rivolte verso il tavolo, il proprio tavolo in primo piano
// e la propria sedia accesa. Riceve tavoli già piazzati (geometria.piazza) e
// l'inquadratura da mostrare.

// Dal tema della pagina Wedding: i grigi neutri restano caldi, come carta.
const colori = tema => ({
  primary: tema.primary, dark: tema.dark, light: tema.light, mid: tema.mid,
  bordo: tema.border, sedia: '#d9d2cb', ombra: tema.dark, trama: tema.border,
  pavimento: tema.bg ? '#fbf9f5' : '#fbf8f4',
});

const SERIF = '"Playfair Display", Georgia, serif';
const SANS = 'Montserrat, system-ui, sans-serif';

// Il tavolo sposi in maiuscolo, grassetto e spaziato: il corsivo, alle misure
// della pianta su un telefono, non si leggeva.
function Nome({ t, colore, grande }) {
  const sposi = t.tipo === 'sposi';
  const area = areaNome(t);
  const testo = sposi ? String(t.nome ?? '').toUpperCase() : t.nome;
  // Lettere maiuscole spaziate occupano circa un terzo in più.
  const { fs, righe } = righeNome(testo, sposi ? area.w / 1.35 : area.w, area.h, { max: grande ? 34 : 28, min: 11 });
  const corpo = sposi ? fs * 0.9 : fs;
  const lh = corpo * 1.12;
  return (
    <text textAnchor="middle" fontFamily={sposi ? SANS : SERIF} fontWeight={sposi ? 700 : 600}
      fontSize={corpo} fill={colore} pointerEvents="none" style={{ letterSpacing: sposi ? '0.2em' : '0.01em' }}>
      {righe.map((r, i) => (
        <tspan key={i} x={sposi ? corpo * 0.1 : 0} y={(i - (righe.length - 1) / 2) * lh + corpo * 0.34}>{r}</tspan>
      ))}
    </text>
  );
}

// Attorno a un tondo ogni sedia guarda il centro; lungo un rettangolare
// guarda dritta verso il suo lato, non verso il centro: a ventaglio, su un
// tavolo lungo, le sedie in fondo finivano quasi di traverso.
function Sedia({ C, p, dritta, mia, delMio, attenuata }) {
  const angolo = dritta ? (p.y < 0 ? 0 : 180) : angoloSedia(p);
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${angolo})${mia ? ' scale(1.3)' : ''}`} className={mia ? 'tt-sedia-mia' : undefined}>
      {mia && <circle r="26" className="tt-alone" />}
      {/* seduta e, verso l'esterno, lo schienale */}
      <rect x="-10" y="-6" width="20" height="14" rx="4.5"
        fill={mia ? C.primary : delMio ? C.light : '#ffffff'}
        stroke={mia ? C.dark : delMio ? C.mid : C.sedia}
        strokeWidth={mia ? 2 : 1.25} opacity={attenuata ? 0.7 : 1} />
      <rect x="-9" y="-10.5" width="18" height="4" rx="2"
        fill={mia ? C.dark : delMio ? C.mid : C.sedia} opacity={attenuata ? 0.6 : 1} />
    </g>
  );
}

function Tavolo({ C, t, mio, posto, attenuato, grande, nomi }) {
  const m = misure(t);
  const rot = ruotabile(t) ? t.rotazione || 0 : 0;
  const sposi = t.tipo === 'sposi';
  const fill = mio ? '#ffffff' : sposi ? C.light : '#ffffff';
  const stroke = mio ? C.primary : sposi ? C.mid : C.bordo;
  const forma = (inset, props) => (t.forma === 'rettangolare'
    ? <rect x={-m.w / 2 + inset} y={-m.h / 2 + inset} width={m.w - inset * 2} height={m.h - inset * 2} rx={Math.max(2, 10 - inset)} {...props} />
    : <circle r={m.r - inset} {...props} />);
  return (
    <g transform={`translate(${t.pos_x} ${t.pos_y})`} className={`tt-tavolo${attenuato ? ' tt-attenuato' : ''}`}>
      <g transform={`rotate(${rot})`}>
        {posti(t).map((p, i) => (
          <Sedia key={i} C={C} p={p} dritta={t.forma === 'rettangolare'} mia={mio && i === posto} delMio={mio} attenuata={attenuato} />
        ))}
        {forma(0, { fill, stroke, strokeWidth: mio ? 3 : 1.5, filter: 'url(#tt-ombra)' })}
        {/* l'orlo della tovaglia */}
        {forma(7, { fill: 'none', stroke: mio ? C.primary : C.bordo, strokeWidth: 0.8, opacity: mio ? 0.55 : 0.6, strokeDasharray: sposi ? '2 4' : undefined })}
      </g>
      {nomi && <Nome t={t} colore={mio ? C.dark : '#3f3a36'} grande={grande} />}
    </g>
  );
}

// `nomi={false}` nel tavolo da vicino: il nome è già scritto in grande sopra.
export default function Sala({ tema, tavoli, mioId, posto, viewBox, pavimento = true, grande = false, nomi = true, className, style }) {
  const C = colori(tema);
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
  const conMio = tavoli.some(t => t.id === mioId);
  // Il proprio tavolo per ultimo: sopra gli altri, alone compreso.
  const ordinati = [...tavoli].sort((a, b) => (a.id === mioId) - (b.id === mioId));
  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" className={className} style={style} role="img"
      aria-label={conMio ? 'Pianta della sala con il tuo posto illuminato' : 'Pianta della sala'}>
      <defs>
        <filter id="tt-ombra" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor={C.ombra} floodOpacity="0.18" />
        </filter>
        <pattern id="tt-trama" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="14" cy="14" r="1.1" fill={C.trama} />
        </pattern>
      </defs>
      {pavimento && (
        <>
          <rect x={viewBox.x - 2000} y={viewBox.y - 2000} width={viewBox.w + 4000} height={viewBox.h + 4000} fill={C.pavimento} />
          <rect x={viewBox.x - 2000} y={viewBox.y - 2000} width={viewBox.w + 4000} height={viewBox.h + 4000} fill="url(#tt-trama)" />
        </>
      )}
      {ordinati.map(t => (
        <Tavolo key={t.id} C={C} t={t} mio={t.id === mioId} posto={posto} attenuato={conMio && t.id !== mioId} grande={grande} nomi={nomi} />
      ))}
    </svg>
  );
}
