const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { getAllScadenze } = require('../utils/scadenze-helper');

router.get('/', auth, (req, res) => {
  const config = db.prepare('SELECT * FROM config LIMIT 1').get();
  const oggi = new Date().toISOString().split('T')[0];
  const fra14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  // Budget
  const totaleCosti = db.prepare('SELECT SUM(importo_effettivo) as tot, SUM(importo_preventivo) as prev FROM costi').get();
  const costiPagati = db.prepare('SELECT SUM(importo_effettivo) as tot FROM costi WHERE pagato = 1').get();
  const preventiviAccettati = db.prepare("SELECT SUM(importo) as tot FROM preventivi WHERE stato = 'accettato'").get();

  // Scadenze unificate
  const tutteScadenze = getAllScadenze(db);
  const scadenzeImminenti = tutteScadenze.filter(s => !s.completata && s.data_scadenza >= oggi).slice(0, 6);
  const scadenzeScadute = tutteScadenze.filter(s => !s.completata && s.data_scadenza < oggi);

  // Ospiti
  const ospitiStats = db.prepare(`
    SELECT
      COUNT(*) as totale,
      SUM(CASE WHEN rsvp='confermato' THEN 1 ELSE 0 END) as confermati,
      SUM(CASE WHEN rsvp='declinato'  THEN 1 ELSE 0 END) as declinati,
      SUM(CASE WHEN rsvp='attesa'     THEN 1 ELSE 0 END) as attesa,
      SUM(CASE WHEN rsvp='confermato' AND tipo='adulto'  THEN 1 ELSE 0 END) as adulti,
      SUM(CASE WHEN rsvp='confermato' AND tipo='bambino' THEN 1 ELSE 0 END) as bambini
    FROM ospiti
  `).get();

  // Fornitori per stato
  const fornitoriPerStato = db.prepare('SELECT stato, COUNT(*) as count FROM fornitori GROUP BY stato').all();
  const fornitoriConfermati = fornitoriPerStato.find(r => r.stato === 'confermato')?.count || 0;
  const fornitoriTotale = fornitoriPerStato.reduce((s, r) => s + r.count, 0);

  // Preventivi per stato (con importi)
  const preventiviPerStato = db.prepare('SELECT stato, COUNT(*) as count, SUM(importo) as tot FROM preventivi GROUP BY stato').all();

  // Preventivi in scadenza nei prossimi 14 giorni
  const preventiviInScadenza = db.prepare(`
    SELECT id, fornitore_nome, categoria, importo, data_scadenza, stato
    FROM preventivi
    WHERE data_scadenza IS NOT NULL
      AND data_scadenza >= ? AND data_scadenza <= ?
      AND stato NOT IN ('accettato', 'rifiutato')
    ORDER BY data_scadenza ASC
  `).all(oggi, fra14);

  // Costi non pagati
  const costiNonPagati = db.prepare('SELECT COUNT(*) as count, SUM(importo_effettivo) as tot FROM costi WHERE pagato = 0').get();

  // Spese per categoria
  const costiPerCategoria = db.prepare(
    'SELECT categoria, SUM(importo_effettivo) as tot FROM costi WHERE importo_effettivo > 0 GROUP BY categoria ORDER BY tot DESC'
  ).all();

  // Cronologia del giorno (se data matrimonio impostata)
  const cronologia = db.prepare('SELECT * FROM cronologia ORDER BY ora ASC').all();

  // Tavoli
  const tavoliStats = db.prepare(`
    SELECT COUNT(*) as totale,
      SUM(capienza) as posti_totali
    FROM tavoli
  `).get();
  const ospitiAssegnati = db.prepare('SELECT COUNT(*) as count FROM ospiti WHERE tavolo_id IS NOT NULL').get();

  // Viaggio
  const viaggioStats = db.prepare('SELECT stato, COUNT(*) as count FROM viaggio GROUP BY stato').all();

  // Regali
  const regaliStats = db.prepare(`
    SELECT COUNT(*) as totale,
      SUM(CASE WHEN ringraziamento_inviato=0 THEN 1 ELSE 0 END) as da_ringraziare
    FROM regali
  `).get();

  let giorniAlMatrimonio = null;
  if (config?.data_matrimonio) {
    const diff = new Date(config.data_matrimonio) - new Date();
    giorniAlMatrimonio = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  res.json({
    config,
    giorniAlMatrimonio,
    budget: {
      totale: config?.budget_totale || 0,
      preventivato: totaleCosti.prev || 0,
      effettivo: totaleCosti.tot || 0,
      pagato: costiPagati.tot || 0,
      preventiviAccettati: preventiviAccettati.tot || 0,
    },
    ospiti: ospitiStats,
    fornitori: { totale: fornitoriTotale, confermati: fornitoriConfermati, perStato: fornitoriPerStato },
    preventivi: { perStato: preventiviPerStato, inScadenza: preventiviInScadenza },
    costi: { nonPagati: costiNonPagati, perCategoria: costiPerCategoria },
    scadenzeImminenti,
    scadenzeScadute,
    cronologia,
    tavoli: { ...tavoliStats, assegnati: ospitiAssegnati?.count || 0 },
    viaggio: viaggioStats,
    regali: regaliStats,
  });
});

module.exports = router;
