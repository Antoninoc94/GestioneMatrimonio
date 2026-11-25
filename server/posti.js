// Su quale sedia siede ognuno. Un posto scelto dagli sposi (ospiti.posto) si
// rispetta; chi non ce l'ha prende le sedie libere in un ordine fisso, con le
// famiglie una accanto all'altra. Calcolato qui e non nel client perché la
// pianta degli sposi e la pagina pubblica /tavolo devono mostrare la stessa sedia.
// Le sedie sono numerate come posti() in client/src/pages/tavoli/util.js: in
// giro attorno al tavolo tondo, a righe sul rettangolare.

// tavolo: { capienza, tipo }; ospiti: tutti quelli seduti a quel tavolo.
// Ritorna Map(id ospite → indice sedia, o null se il tavolo è già pieno).
function postiEffettivi(tavolo, ospiti) {
  const n = Math.max(1, tavolo.capienza || 1);
  const posti = new Map();
  const prese = new Set();

  for (const o of ospiti) {
    const p = o.posto;
    if (Number.isInteger(p) && p >= 0 && p < n && !prese.has(p)) {
      posti.set(o.id, p);
      prese.add(p);
    }
  }

  // Al tavolo sposi le sedie stanno su un lato solo: si riempiono dal centro
  // verso i lati, così gli sposi (messi per primi) restano in mezzo.
  let libere = Array.from({ length: n }, (_, i) => i).filter(i => !prese.has(i));
  if (tavolo.tipo === 'sposi') {
    const centro = (n - 1) / 2;
    libere = libere.sort((a, b) => Math.abs(a - centro) - Math.abs(b - centro) || a - b);
  }

  // Famiglie insieme: invitato principale, poi partner, poi figli. L'ordine
  // delle famiglie segue quello in cui arrivano gli ospiti (cognome, nome),
  // con gli sposi davanti a tutti.
  const daSedere = ospiti.filter(o => !posti.has(o.id));
  const famiglie = new Map();
  for (const o of daSedere) {
    const chiave = o.parent_id ?? o.id;
    if (!famiglie.has(chiave)) famiglie.set(chiave, []);
    famiglie.get(chiave).push(o);
  }
  const rango = o => (!o.parent_id ? 0 : o.relazione === 'partner' ? 1 : 2);
  const gruppi = [...famiglie.values()]
    .map(g => g.sort((a, b) => rango(a) - rango(b) || a.id - b.id))
    .sort((a, b) => (a.some(o => o.sposo) ? 0 : 1) - (b.some(o => o.sposo) ? 0 : 1));

  let i = 0;
  for (const g of gruppi) {
    for (const o of g) posti.set(o.id, i < libere.length ? libere[i++] : null);
  }
  return posti;
}

module.exports = { postiEffettivi };
