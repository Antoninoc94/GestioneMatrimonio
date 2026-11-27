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
    // Dentro, l'angolo non si usa: vedi ELLE_ANGOLO.
    const necessaria = n * 40;
    const daS = config === 'interno' ? (necessaria + 2 * T + 2 * ELLE_ANGOLO) / 2
      : config === 'esterno' ? necessaria / 2
      : (necessaria + 2 * T + 2 * ELLE_ANGOLO) / 4;
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

// Si ruota ciò che non è simmetrico: il rettangolare, e il tavolo sposi
// anche tondo, perché le sue sedie stanno su un lato solo. Le sedie sono
// disegnate dentro lo stesso gruppo ruotato, quindi girano col tavolo; i
// quattro versi servono a scegliere verso dove guardano.
// Anche la L, che ha l'angolo da portare dal lato giusto.
export const ruotabile = t => t.forma === 'rettangolare' || t.forma === 'elle' || t.tipo === 'sposi';
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

// Posti attorno al tavolo, in coordinate locali (prima della rotazione).
export function posti(t) {
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

// Tiene il tavolo (sedie comprese) dentro la sala.
export const limitaPosizione = (t, x, y) => {
  const { w, h } = ingombro(t);
  const mw = w / 2 + 26, mh = h / 2 + 26;
  return {
    x: Math.round(Math.min(Math.max(x, mw), PIANTA_W - mw)),
    y: Math.round(Math.min(Math.max(y, mh), PIANTA_H - mh)),
  };
};

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

// Dove sta il tavolo sulla pianta: la posizione salvata, oppure il suo posto
// nella griglia di partenza finché nessuno l'ha spostato.
export function posizioneTavolo(t, tavoli) {
  if (t.pos_x != null && t.pos_y != null) return { x: t.pos_x, y: t.pos_y };
  const p = posizioneDefault(tavoli.indexOf(t), tavoli.length);
  return limitaPosizione(t, p.x, p.y);
}

// Nome del tavolo dentro il suo disegno: va a capo tra le parole e rimpicciolisce
// finché ci sta, invece di tagliarlo a "Tavolo degli am…". La larghezza dei
// caratteri è stimata (0.6 em): non serve misurare il testo per davvero.
export function righeNome(testo, maxW, maxH, { max = 26, min = 11 } = {}) {
  const parole = String(testo ?? '').trim().split(/\s+/).filter(Boolean);
  const lung = s => [...s].length;
  // Prima una riga sola, anche un po' più piccola: "Tavolo 2" spezzato in
  // "Tavolo / 2" si legge peggio che con qualche punto in meno.
  const tuttoInsieme = parole.join(' ');
  for (let fs = max; fs >= Math.max(min, Math.round(max * 0.7)); fs--) {
    if (lung(tuttoInsieme) <= Math.floor(maxW / (fs * 0.6)) && fs * 1.15 <= maxH) return { fs, righe: [tuttoInsieme] };
  }
  for (let fs = max; fs >= min; fs--) {
    const perRiga = Math.floor(maxW / (fs * 0.6));
    if (parole.some(p => lung(p) > perRiga)) continue;
    const righe = [];
    for (const p of parole) {
      const ultima = righe[righe.length - 1];
      if (ultima && lung(`${ultima} ${p}`) <= perRiga) righe[righe.length - 1] = `${ultima} ${p}`;
      else righe.push(p);
    }
    if (righe.length * fs * 1.15 <= maxH) return { fs, righe };
  }
  // Non ci sta nemmeno al minimo: righe piene e puntini sull'ultima.
  const fs = min;
  const perRiga = Math.max(3, Math.floor(maxW / (fs * 0.6)));
  const maxRighe = Math.max(1, Math.floor(maxH / (fs * 1.15)));
  const tutto = [...parole.join(' ')];
  const righe = [];
  for (let i = 0; i < tutto.length && righe.length < maxRighe; i += perRiga) righe.push(tutto.slice(i, i + perRiga).join(''));
  if (tutto.length > perRiga * maxRighe) righe[righe.length - 1] = `${righe[righe.length - 1].slice(0, -1)}…`;
  return { fs, righe };
}

// Spazio utile per il nome, non ruotato: { w, h } e il centro { x, y }
// rispetto a quello del tavolo (0,0 tranne che per la L). La L ha al centro
// del suo riquadro l'incavo: il nome va lì se le sedie stanno solo fuori,
// altrimenti sull'angolo, come nella pianta degli sposi.
export function areaNome(t) {
  if (t.forma === 'elle') {
    const { S, T } = misure(t);
    const m = S / 2;
    const dentro = t.tipo !== 'sposi' && t.elle_posti !== 'esterno';
    const l = dentro ? { x: -m + T / 2, y: m - T / 2, lato: T - 10 } : { x: T / 2, y: -T / 2, lato: S - T - 24 };
    const a = ((t.rotazione || 0) * Math.PI) / 180;
    return { x: l.x * Math.cos(a) - l.y * Math.sin(a), y: l.x * Math.sin(a) + l.y * Math.cos(a), w: l.lato, h: l.lato };
  }
  if (t.forma === 'rettangolare') {
    const { w, h } = ingombro(t);
    return { w: w - 16, h: h - 10 };
  }
  const { r } = misure(t);
  return { w: r * 1.55, h: r * 1.3 };
}

// Le sedie in coordinate del tavolo già ruotato: i numeri dentro le sedie
// devono restare dritti, quindi si ruotano i punti e non il gruppo.
// `n` è la direzione in cui la sedia sta rispetto al tavolo (verso l'esterno),
// ruotata anch'essa: dice dove scrivere un'etichetta accanto alla sedia.
export function sedieRuotate(t) {
  const a = ((ruotabile(t) ? t.rotazione || 0 : 0) * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const ruota = (x, y) => [x * c - y * s, x * s + y * c];
  return posti(t).map(p => {
    const d = Math.hypot(p.x, p.y) || 1;
    const [nx, ny] = p.n ?? (t.forma === 'rettangolare' ? [0, p.y < 0 ? -1 : 1] : [p.x / d, p.y / d]);
    const [x, y] = ruota(p.x, p.y);
    return { x, y, n: ruota(nx, ny) };
  });
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
// Tratto dei lati interni lasciato libero vicino all'angolo: la profondità di
// una sedia (distanza dal bordo più mezza sedia), con un po' d'aria.
export const ELLE_ANGOLO = 28;

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
  // Dentro, i due lati si incontrano ad angolo: le sedie vicine all'angolo
  // finirebbero una addosso all'altra, quindi i lati partono un po' più in là.
  const k = ELLE_ANGOLO;
  const interni = [
    { a: [-m + T, -m], b: [-m + T, m - T - k], n: [1, 0] }, // destra del braccio verticale
    { a: [-m + T + k, m - T], b: [m, m - T], n: [0, -1] },  // sopra il braccio orizzontale
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
      n: l.n, // verso cui guarda via dal tavolo: la pagina degli invitati ci orienta la sedia
    };
  }));
}
