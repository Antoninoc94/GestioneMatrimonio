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
