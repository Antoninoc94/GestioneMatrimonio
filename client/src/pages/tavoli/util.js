// Supporto condiviso dalle schede di Tavoli.jsx.

export const PIANTA_W = 1200; // stesse unità di server/routes/tavoli.js
export const PIANTA_H = 800;

export const tipoTavolo = {
  normale: { label: 'Normale', emoji: '' },
  sposi: { label: 'Sposi', emoji: '💍' },
  bambini: { label: 'Bambini', emoji: '🧸' },
};
export const formaTavolo = {
  tondo: 'Tondo',
  rettangolare: 'Rettangolare',
  elle: 'A L',
};
// Dove siedono gli ospiti attorno al tavolo a L.
export const ellePosti = {
  entrambi: 'Dentro e fuori',
  esterno: 'Solo fuori',
  interno: 'Solo dentro',
};

export const nomeOspite = o => (o.cognome ? `${o.cognome} ${o.nome}` : o.nome);

// Ingombro del tavolo sulla pianta, cresce coi posti. Per il rettangolare
// w è il lato lungo, prima della rotazione.
export function misure(t) {
  const n = Math.max(1, t.capienza || 1);
  if (t.forma === 'elle') {
    // Quadrato di lato `S` con due bracci spessi `T`: lo si fa crescere finché
    // i lati scelti per i posti bastano per `n` sedie a ~40 unità l'una.
    // Lunghezza utile: fuori 2S, dentro 2S-2T, entrambi 4S-2T.
    const T = ELLE_T;
    const config = t.tipo === 'sposi' ? 'esterno' : t.elle_posti;
    const necessaria = n * 40;
    const daS = config === 'interno' ? (necessaria + 2 * T) / 2
      : config === 'esterno' ? necessaria / 2
      : (necessaria + 2 * T) / 4;
    const S = Math.min(320, Math.max(170, Math.ceil(daS)));
    return { w: S, h: S, S, T };
  }
  if (t.forma === 'rettangolare') {
    // Il tavolo sposi ha i posti su un lato solo: serve lungo il doppio.
    const perLato = t.tipo === 'sposi' ? n : Math.ceil(n / 2);
    return { w: Math.max(110, perLato * 40 + 14), h: 72 };
  }
  const r = Math.min(120, 42 + n * 4);
  return { w: r * 2, h: r * 2, r };
}

// Ingombro dopo la rotazione (solo 0/90/180/270 hanno senso in una sala).
// La L resta quadrata a ogni rotazione.
export function ingombro(t) {
  const m = misure(t);
  const verticale = t.forma === 'rettangolare' && (t.rotazione || 0) % 180 === 90;
  return verticale ? { w: m.h, h: m.w } : { w: m.w, h: m.h };
}

// Passo della griglia a cui i tavoli si agganciano mentre si trascinano.
export const PASSO_GRIGLIA = 20;

const piazzato = t => t.pos_x != null && t.pos_y != null;

// Coppie di tavoli posizionati che si toccano, sedie comprese (mezza fila
// di sedie per lato). Due tondi si confrontano come cerchi, il resto per
// ingombro: la L ha un incavo, quindi un tavolo infilato nell'angolo viene
// segnalato anche se non la tocca davvero.
export function sovrapposizioni(tavoli) {
  const MARGINE = 12;
  const lista = tavoli.filter(piazzato);
  const coppie = [];
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      let tocca;
      if (a.forma === 'tondo' && b.forma === 'tondo') {
        tocca = Math.hypot(a.pos_x - b.pos_x, a.pos_y - b.pos_y) < misure(a).r + misure(b).r + 2 * MARGINE;
      } else {
        const A = ingombro(a), B = ingombro(b);
        tocca = Math.abs(a.pos_x - b.pos_x) < (A.w + B.w) / 2 + 2 * MARGINE
          && Math.abs(a.pos_y - b.pos_y) < (A.h + B.h) / 2 + 2 * MARGINE;
      }
      if (tocca) coppie.push([a, b]);
    }
  }
  return coppie;
}

// Posizione dei tavoli non ancora piazzati: griglia nell'ordine dei tavoli,
// adattata al loro numero così resta tutto dentro la sala. Dipende dalla
// posizione nell'elenco completo, non tra i soli non piazzati: altrimenti
// piazzarne uno farebbe saltare tutti gli altri.
export function posizioneDefault(index, totale) {
  const n = Math.max(1, totale);
  const cols = Math.max(4, Math.ceil(Math.sqrt(n * (PIANTA_W / PIANTA_H))));
  const rows = Math.max(3, Math.ceil(n / cols));
  return {
    x: (PIANTA_W / cols) * ((index % cols) + 0.5),
    y: (PIANTA_H / rows) * (Math.floor(index / cols) + 0.5),
  };
}

// Problemi da segnalare sopra le schede. Ogni avviso può avere un'azione
// che lo risolve: `ids` + `tavoloId` vanno passati a assignGuests.
export function calcolaAvvisi(tavoli, ospiti) {
  const avvisi = [];
  const byId = new Map(ospiti.map(o => [o.id, o]));
  const tavoloById = new Map(tavoli.map(t => [t.id, t]));

  for (const t of tavoli) {
    if (t.ospiti.length > t.capienza) {
      avvisi.push({
        key: `pieno-${t.id}`,
        livello: 'errore',
        testo: `${t.nome}: ${t.ospiti.length} ospiti su ${t.capienza} posti (${t.ospiti.length - t.capienza} di troppo)`,
      });
    }
  }

  const coppie = sovrapposizioni(tavoli);
  for (const [a, b] of coppie.slice(0, 5)) {
    avvisi.push({ key: `sovrapposti-${a.id}-${b.id}`, livello: 'attenzione', testo: `${a.nome} e ${b.nome} si sovrappongono sulla pianta` });
  }
  if (coppie.length > 5) {
    avvisi.push({ key: 'sovrapposti-altri', livello: 'attenzione', testo: `…e altre ${coppie.length - 5} sovrapposizioni sulla pianta` });
  }

  const declinati = ospiti.filter(o => o.tavolo_id && o.rsvp === 'declinato');
  if (declinati.length) {
    const nomi = declinati.slice(0, 4).map(nomeOspite).join(', ') + (declinati.length > 4 ? '…' : '');
    avvisi.push({
      key: 'declinati',
      livello: 'errore',
      testo: `${declinati.length === 1 ? '1 ospite ha declinato ma è ancora seduto' : `${declinati.length} ospiti hanno declinato ma sono ancora seduti`}: ${nomi}`,
      azione: { label: 'Togli dai tavoli', ids: declinati.map(o => o.id), tavoloId: null },
    });
  }

  // Un bambino può stare al tavolo dei genitori oppure al tavolo dei bambini.
  // Qui si discrimina l'età (`tipo`), non la parentela: un figlio adulto
  // seduto altrove è una scelta, non un errore.
  for (const o of ospiti) {
    if (o.tipo !== 'bambino' || !o.parent_id || !o.tavolo_id || o.rsvp === 'declinato') continue;
    const genitore = byId.get(o.parent_id);
    if (!genitore?.tavolo_id || genitore.tavolo_id === o.tavolo_id) continue;
    if (tavoloById.get(o.tavolo_id)?.tipo === 'bambini') continue;
    const tg = tavoloById.get(genitore.tavolo_id);
    avvisi.push({
      key: `bimbo-${o.id}`,
      livello: 'attenzione',
      testo: `${nomeOspite(o)} (bambino) è a "${tavoloById.get(o.tavolo_id)?.nome}", lontano da ${nomeOspite(genitore)} ("${tg?.nome}")`,
      azione: { label: `Sposta a ${tg?.nome}`, ids: [o.id], tavoloId: genitore.tavolo_id },
    });
  }

  return avvisi;
}

// ── Tavolo a L ──────────────────────────────────────────────────────────────
// Coordinate locali centrate sull'origine, prima della rotazione. Il braccio
// verticale sta a sinistra e quello orizzontale in basso: l'angolo è in basso
// a sinistra e "Ruota" lo porta negli altri tre.
export const ELLE_T = 64;

// Contorno della L (senso orario, a partire da in alto a sinistra).
export function contornoElle(S, T) {
  const m = S / 2;
  return [[-m, -m], [-m + T, -m], [-m + T, m - T], [m, m - T], [m, m], [-m, m]];
}

// I lati su cui possono sedere gli ospiti: `n` è la normale uscente dal
// tavolo. I lati corti delle estremità restano liberi.
export function elleLati(config, S, T) {
  const m = S / 2;
  const esterni = [
    { a: [-m, -m], b: [-m, m], n: [-1, 0] }, // lato sinistro, lungo
    { a: [-m, m], b: [m, m], n: [0, 1] },    // lato in basso, lungo
  ];
  const interni = [
    { a: [-m + T, -m], b: [-m + T, m - T], n: [1, 0] }, // destra del braccio verticale
    { a: [-m + T, m - T], b: [m, m - T], n: [0, -1] },  // sopra il braccio orizzontale
  ];
  const lati = config === 'interno' ? interni : config === 'esterno' ? esterni : [...esterni, ...interni];
  return lati.map(l => ({ ...l, len: Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) }));
}

// Posti sui lati scelti, ripartiti in proporzione alla lunghezza (resti ai
// lati più lunghi) e distribuiti a passo regolare, a `distanza` dal bordo.
export function postiElle(t, distanza = 15) {
  const n = Math.max(1, t.capienza || 1);
  const { S, T } = misure(t);
  const lati = elleLati(t.tipo === 'sposi' ? 'esterno' : t.elle_posti, S, T);
  const totale = lati.reduce((s, l) => s + l.len, 0);
  const quote = lati.map(l => (n * l.len) / totale);
  const conta = quote.map(Math.floor);
  let resto = n - conta.reduce((s, c) => s + c, 0);
  [...quote.keys()].sort((i, j) => (quote[j] - conta[j]) - (quote[i] - conta[i])).forEach(i => { if (resto-- > 0) conta[i]++; });
  return lati.flatMap((l, i) => Array.from({ length: conta[i] }, (_, j) => {
    const f = (j + 0.5) / conta[i];
    return {
      x: l.a[0] + (l.b[0] - l.a[0]) * f + l.n[0] * distanza,
      y: l.a[1] + (l.b[1] - l.a[1]) * f + l.n[1] * distanza,
    };
  }));
}
