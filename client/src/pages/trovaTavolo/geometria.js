// Geometria della sala per la pagina pubblica: quanto spazio occupano i tavoli,
// le inquadrature (tutta la sala, il proprio tavolo) e la sala girata per chi
// tiene il telefono in verticale con la rotazione bloccata.
import { PIANTA_H, ingombro, posizioneTavolo, sedieRuotate } from '../tavoli/util';

// Raggio della sedia più lontana dal centro del tavolo, rotazione compresa.
const raggioTavolo = t => {
  const { w, h } = ingombro(t);
  const sedie = sedieRuotate(t);
  return {
    x: Math.max(w / 2, ...sedie.map(p => Math.abs(p.x))) + 14,
    y: Math.max(h / 2, ...sedie.map(p => Math.abs(p.y))) + 14,
  };
};

// Tavoli con la posizione già risolta (anche quelli mai trascinati).
export const piazza = tavoli => tavoli.map(t => {
  const { x, y } = posizioneTavolo(t, tavoli);
  return { ...t, pos_x: x, pos_y: y };
});

// La sala girata di 90° in senso orario: le posizioni ruotano, e ogni tavolo
// ruota con lei. I nomi, scritti fuori dalla rotazione, restano dritti.
export const ruotaSala = tavoli => tavoli.map(t => ({
  ...t,
  pos_x: PIANTA_H - t.pos_y,
  pos_y: t.pos_x,
  rotazione: ((t.rotazione || 0) + 90) % 360,
  // Un tavolo tondo normale è simmetrico: girarlo non cambia niente, ma il
  // tavolo sposi tondo ha le sedie da un lato e quindi deve girare.
}));

// Il rettangolo che contiene tutti i tavoli con le loro sedie, più un margine:
// la pianta mostra la sala vera, non i 1200×800 dello spazio di lavoro.
export function confini(tavoli, margine = 50) {
  if (!tavoli.length) return { x: 0, y: 0, w: 1200, h: 800 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tavoli) {
    const r = raggioTavolo(t);
    x0 = Math.min(x0, t.pos_x - r.x); x1 = Math.max(x1, t.pos_x + r.x);
    y0 = Math.min(y0, t.pos_y - r.y); y1 = Math.max(y1, t.pos_y + r.y);
  }
  return { x: x0 - margine, y: y0 - margine, w: x1 - x0 + margine * 2, h: y1 - y0 + margine * 2 };
}

// Inquadratura sul proprio tavolo: lui al centro con un po' di sala attorno,
// così si capisce dove sta rispetto agli altri.
export function inquadraTavolo(t) {
  const r = raggioTavolo(t);
  const lato = Math.max(r.x, r.y) * 4.2;
  return { x: t.pos_x - lato / 2, y: t.pos_y - lato / 2, w: lato, h: lato };
}

// Allarga il riquadro fino alle proporzioni dello schermo, centrato: così
// passare da un'inquadratura all'altra è uno zoom pulito e non una deformazione.
export function adattaProporzioni(box, aspetto) {
  if (!aspetto || !Number.isFinite(aspetto)) return box;
  let { x, y, w, h } = box;
  if (w / h < aspetto) { const nw = h * aspetto; x -= (nw - w) / 2; w = nw; }
  else { const nh = w / aspetto; y -= (nh - h) / 2; h = nh; }
  return { x, y, w, h };
}

// Verso cui guarda la sedia: lo schienale sta dalla parte opposta al tavolo.
// In gradi, per rotate() di SVG, in coordinate locali del tavolo.
export const angoloSedia = p => (Math.atan2(p.x, -p.y) * 180) / Math.PI;
