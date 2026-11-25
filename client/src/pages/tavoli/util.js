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
};

export const nomeOspite = o => (o.cognome ? `${o.cognome} ${o.nome}` : o.nome);

// Ingombro del tavolo sulla pianta, cresce coi posti. Per il rettangolare
// w è il lato lungo, prima della rotazione.
export function misure(t) {
  const n = Math.max(1, t.capienza || 1);
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
export const ruotabile = t => t.forma === 'rettangolare' || t.tipo === 'sposi';
// Ingombro dopo la rotazione (solo 0/90/180/270 hanno senso in una sala).
export const ingombro = t => {
  const m = misure(t);
  const verticale = t.forma === 'rettangolare' && (t.rotazione || 0) % 180 === 90;
  return verticale ? { w: m.h, h: m.w } : { w: m.w, h: m.h };
};

// Posti attorno al tavolo, in coordinate locali (prima della rotazione).
export function posti(t) {
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

// Spazio utile per il nome, centrato sul tavolo e non ruotato.
export function areaNome(t) {
  if (t.forma === 'rettangolare') {
    const { w, h } = ingombro(t);
    return { w: w - 16, h: h - 10 };
  }
  const { r } = misure(t);
  return { w: r * 1.55, h: r * 1.3 };
}

// Le sedie in coordinate del tavolo già ruotato: i numeri dentro le sedie
// devono restare dritti, quindi si ruotano i punti e non il gruppo.
export function sedieRuotate(t) {
  const a = ((ruotabile(t) ? t.rotazione || 0 : 0) * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return posti(t).map(p => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
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
