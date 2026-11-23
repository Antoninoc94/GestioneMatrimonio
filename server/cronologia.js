const db = require('./db');

// Gli orari prima delle 5 sono la notte dopo (fine festa all'1:00): in ordine
// alfabetico finirebbero in cima, prima dei preparativi del mattino.
const FINE_NOTTE = '05:00';
const ORDINE = `ORDER BY CASE WHEN c.ora < '${FINE_NOTTE}' THEN 1 ELSE 0 END, c.ora ASC, c.id ASC`;

// L'evento con il luogo risolto: se è collegato a una location, nome e
// indirizzo vengono da lì e seguono le modifiche fatte in Location.
const SELECT = `
  SELECT c.*, l.nome AS location_nome, l.indirizzo AS location_indirizzo, l.tipo AS location_tipo
  FROM cronologia c LEFT JOIN location l ON l.id = c.location_id`;

const eventi = (where = '') => db.prepare(`${SELECT} ${where} ${ORDINE}`).all();
const evento = id => db.prepare(`${SELECT} WHERE c.id = ?`).get(id);

const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const minuti = ora => { const [h, m] = ora.split(':').map(Number); return h * 60 + m; };
const ora = min => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
// Minuti dall'inizio della "giornata" (le 5:00): confrontabili anche dopo mezzanotte.
const chiave = o => (minuti(o) - minuti(FINE_NOTTE) + 1440) % 1440;

const TIPI_CERIMONIA = ['Chiesa', 'Municipio', 'Cerimonia civile'];

// La giornata tipo, in minuti relativi all'inizio della cerimonia. Gli orari
// di ciò che viene dopo la cerimonia si calcolano in fila, dalla durata di
// ciascun evento, così cambiare lo spostamento fa scorrere tutto il resto.
function bozza({ oraCerimonia, spostamento }) {
  const confermate = db.prepare("SELECT id, tipo, nome FROM location WHERE stato = 'confermato' ORDER BY id").all();
  const luogoCer = confermate.find(l => TIPI_CERIMONIA.includes(l.tipo));
  const luogoRic = confermate.find(l => l.tipo === 'Ricevimento');
  const civile = luogoCer && luogoCer.tipo !== 'Chiesa';
  const C = minuti(oraCerimonia);

  const out = [];
  const add = (inizio, e) => { out.push({ ora: ora(inizio), ...e }); return inizio + (e.durata || 0); };

  add(C - 210, { titolo: 'Trucco e parrucco della sposa', tipo: 'preparativi', durata: 150, luogo: 'Casa della sposa', pubblico: 0 });
  add(C - 150, { titolo: 'Preparativi dello sposo', tipo: 'preparativi', durata: 90, luogo: 'Casa dello sposo', pubblico: 0 });
  add(C - 120, { titolo: 'Foto dei preparativi', tipo: 'foto', durata: 75, descrizione: 'Il fotografo passa da entrambe le case', pubblico: 0 });
  // Tipo 'altro' e non 'cerimonia': Inviti prende come ora della cerimonia il
  // primo evento di quel tipo, e non deve essere l'arrivo degli invitati.
  add(C - 30, { titolo: 'Arrivo degli invitati e dello sposo', tipo: 'altro', durata: 30, location_id: luogoCer?.id, pubblico: 1 });
  let t = add(C, {
    titolo: civile ? 'Rito civile' : 'Cerimonia', tipo: 'cerimonia', durata: civile ? 30 : 60,
    location_id: luogoCer?.id, descrizione: 'Ingresso della sposa', pubblico: 1,
  });
  t = add(t, { titolo: 'Uscita degli sposi, lancio del riso e foto di gruppo', tipo: 'foto', durata: 30, location_id: luogoCer?.id, pubblico: 1 });
  if (spostamento > 0) {
    t = add(t, { titolo: 'Spostamento verso il ricevimento', tipo: 'viaggio', durata: spostamento, pubblico: 1 });
  }
  t = add(t, {
    titolo: 'Aperitivo di benvenuto', tipo: 'ricevimento', durata: 90, location_id: luogoRic?.id,
    descrizione: 'Intanto gli sposi fanno le foto di coppia', pubblico: 1,
  });
  t = add(t, { titolo: `Ingresso degli sposi e ${t < minuti('17:00') ? 'pranzo' : 'cena'}`, tipo: 'ricevimento', durata: 180, location_id: luogoRic?.id, pubblico: 1 });
  t = add(t, { titolo: 'Taglio della torta', tipo: 'ricevimento', durata: 30, location_id: luogoRic?.id, pubblico: 1 });
  t = add(t, { titolo: 'Primo ballo e festa', tipo: 'ricevimento', durata: 120, location_id: luogoRic?.id, pubblico: 1 });
  add(t, { titolo: 'Saluti finali', tipo: 'altro', location_id: luogoRic?.id, pubblico: 1 });
  return out;
}

module.exports = { ORDINE, eventi, evento, ORA, minuti, ora, chiave, bozza };
