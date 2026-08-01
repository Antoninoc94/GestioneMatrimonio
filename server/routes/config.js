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
  const {
    data_matrimonio, budget_totale, nome_sposo1, nome_sposo2,
    app_name, app_emoji, login_subtitle, conferma_abilitata,
    landing_abilitata, landing_messaggio, landing_dress_code,
    landing_info_pratiche, landing_tema
  } = req.body;
  db.prepare(`UPDATE config SET data_matrimonio=?, budget_totale=?, nome_sposo1=?, nome_sposo2=?, app_name=?, app_emoji=?, login_subtitle=?, conferma_abilitata=?, landing_abilitata=?, landing_messaggio=?, landing_dress_code=?, landing_info_pratiche=?, landing_tema=?, updated_at=datetime('now')`)
    .run(
      data_matrimonio, budget_totale, nome_sposo1, nome_sposo2,
      app_name || 'Il Nostro Matrimonio', app_emoji || '💍', login_subtitle || '',
      conferma_abilitata === false || conferma_abilitata === 0 ? 0 : 1,
      landing_abilitata === false || landing_abilitata === 0 ? 0 : 1,
      landing_messaggio || '', landing_dress_code || '', landing_info_pratiche || '',
      landing_tema || 'rose'
    );
  res.json(db.prepare('SELECT * FROM config LIMIT 1').get());
});

module.exports = router;
