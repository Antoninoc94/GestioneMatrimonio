const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM config LIMIT 1').get());
});

router.put('/', auth, (req, res) => {
  const { data_matrimonio, budget_totale, nome_sposo1, nome_sposo2 } = req.body;
  db.prepare(`UPDATE config SET data_matrimonio = ?, budget_totale = ?, nome_sposo1 = ?, nome_sposo2 = ?, updated_at = datetime('now')`)
    .run(data_matrimonio, budget_totale, nome_sposo1, nome_sposo2);
  res.json(db.prepare('SELECT * FROM config LIMIT 1').get());
});

module.exports = router;
