const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const config = db.prepare('SELECT * FROM config LIMIT 1').get();
  const oggi = new Date().toISOString().split('T')[0];

  const totalePreventivi = db.prepare("SELECT SUM(importo) as tot FROM preventivi WHERE stato = 'accettato'").get();
  const totaleCosti = db.prepare('SELECT SUM(importo_effettivo) as tot, SUM(importo_preventivo) as prev FROM costi').get();
  const costiPagati = db.prepare('SELECT SUM(importo_effettivo) as tot FROM costi WHERE pagato = 1').get();

  const scadenzeImminenti = db.prepare(
    "SELECT * FROM scadenze WHERE completata = 0 AND data_scadenza >= ? ORDER BY data_scadenza ASC LIMIT 5"
  ).all(oggi);

  const scadenzeScadute = db.prepare(
    "SELECT * FROM scadenze WHERE completata = 0 AND data_scadenza < ? ORDER BY data_scadenza DESC"
  ).all(oggi);

  const totFornitoriPerCategoria = db.prepare(
    'SELECT categoria, COUNT(*) as count FROM fornitori GROUP BY categoria'
  ).all();

  const costiPerCategoria = db.prepare(
    'SELECT categoria, SUM(importo_effettivo) as tot FROM costi GROUP BY categoria ORDER BY tot DESC'
  ).all();

  const preventiviPerStato = db.prepare(
    'SELECT stato, COUNT(*) as count, SUM(importo) as tot FROM preventivi GROUP BY stato'
  ).all();

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
      preventiviAccettati: totalePreventivi.tot || 0,
    },
    scadenzeImminenti,
    scadenzeScadute,
    totFornitoriPerCategoria,
    costiPerCategoria,
    preventiviPerStato,
  });
});

module.exports = router;
