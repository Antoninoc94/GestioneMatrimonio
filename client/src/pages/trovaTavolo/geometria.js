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

// Allarga il riquadro fino alle proporzioni dello schermo, centrato: così
// passare da un'inquadratura all'altra è uno zoom pulito e non una deformazione.
export function adattaProporzioni(box, aspetto) {
  if (!aspetto || !Number.isFinite(aspetto)) return box;
  let { x, y, w, h } = box;
  if (w / h < aspetto) { const nw = h * aspetto; x -= (nw - w) / 2; w = nw; }
  else { const nh = w / aspetto; y -= (nh - h) / 2; h = nh; }
  return { x, y, w, h };
}

// Lato più lungo dell'inquadratura sul proprio posto, in unità della pianta:
// oltre, le sedie (40 unità l'una) diventano troppo piccole sul telefono.
const LATO_MASSIMO = 1100;

// Dove sta la sedia sulla pianta.
export function puntoSedia(t, posto) {
  const p = posto != null ? sedieRuotate(t)[posto] : null;
  return p ? { x: t.pos_x + p.x, y: t.pos_y + p.y } : { x: t.pos_x, y: t.pos_y };
}

// Inquadratura sul proprio tavolo, già nelle proporzioni dello schermo.
// Segue la forma del tavolo: un margine uguale su ogni lato, misurato sul lato
// corto, così un tavolo lungo non si porta dietro mezza sala. Se il riquadro
// resta troppo grande (tavolo lunghissimo, o in verticale su uno schermo in
// orizzontale) si stringe attorno alla sedia, senza uscire dal riquadro intero.
export function inquadraPosto(t, posto, aspetto) {
  const r = raggioTavolo(t);
  const m = Math.min(r.x, r.y) * 1.1 + 40;
  const box = adattaProporzioni({ x: t.pos_x - r.x - m, y: t.pos_y - r.y - m, w: 2 * (r.x + m), h: 2 * (r.y + m) }, aspetto);
  const k = Math.min(1, LATO_MASSIMO / Math.max(box.w, box.h));
  if (k === 1) return box;
  const w = box.w * k, h = box.h * k;
  const s = puntoSedia(t, posto);
  const entro = (c, da, lato, tot) => Math.min(Math.max(c - lato / 2, da), da + tot - lato);
  return { x: entro(s.x, box.x, w, box.w), y: entro(s.y, box.y, h, box.h), w, h };
}

// Verso cui guarda la sedia: lo schienale sta dalla parte opposta al tavolo.
// In gradi, per rotate() di SVG, in coordinate locali del tavolo.
export const angoloSedia = p => (Math.atan2(p.x, -p.y) * 180) / Math.PI;
