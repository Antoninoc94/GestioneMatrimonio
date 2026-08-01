const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Pubblico: solo dati estetici (per login page)
router.get('/public', (req, res) => {
  const cfg = db.prepare('SELECT app_name, app_emoji, login_subtitle FROM config LIMIT 1').get();
  res.json(cfg || { app_name: 'Il Nostro Matrimonio', app_emoji: '💍', login_subtitle: '' });
});

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM config LIMIT 1').get());
});

router.put('/', auth, (req, res) => {
  const { data_matrimonio, budget_totale, nome_sposo1, nome_sposo2, app_name, app_emoji, login_subtitle } = req.body;
  db.prepare(`UPDATE config SET data_matrimonio=?, budget_totale=?, nome_sposo1=?, nome_sposo2=?, app_name=?, app_emoji=?, login_subtitle=?, updated_at=datetime('now')`)
    .run(data_matrimonio, budget_totale, nome_sposo1, nome_sposo2,
      app_name || 'Il Nostro Matrimonio', app_emoji || '💍', login_subtitle || '');
  res.json(db.prepare('SELECT * FROM config LIMIT 1').get());
});

module.exports = router;
