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
  const b = req.body;
  // Ritorna il valore trasformato se la chiave è presente nel body,
  // altrimenti undefined → SQLite lo tratta come NULL → COALESCE preserva il valore esistente
  const p = (k, fn) => k in b ? fn(b[k]) : undefined;
  const toBool = v => (v === false || v === 0 ? 0 : 1);

  db.prepare(`UPDATE config SET
    data_matrimonio=COALESCE(?,data_matrimonio),
    budget_totale=COALESCE(?,budget_totale),
    nome_sposo1=COALESCE(?,nome_sposo1),
    nome_sposo2=COALESCE(?,nome_sposo2),
    app_name=COALESCE(?,app_name),
    app_emoji=COALESCE(?,app_emoji),
    login_subtitle=COALESCE(?,login_subtitle),
    conferma_abilitata=COALESCE(?,conferma_abilitata),
    landing_abilitata=COALESCE(?,landing_abilitata),
    landing_messaggio=COALESCE(?,landing_messaggio),
    landing_dress_code=COALESCE(?,landing_dress_code),
    landing_info_pratiche=COALESCE(?,landing_info_pratiche),
    landing_tema=COALESCE(?,landing_tema),
    updated_at=datetime('now')`)
    .run(
      p('data_matrimonio', v => v || null),
      p('budget_totale', v => parseFloat(v) || 0),
      p('nome_sposo1', v => v || null),
      p('nome_sposo2', v => v || null),
      p('app_name', v => v || 'Il Nostro Matrimonio'),
      p('app_emoji', v => v || '💍'),
      p('login_subtitle', v => v ?? ''),
      p('conferma_abilitata', toBool),
      p('landing_abilitata', toBool),
      p('landing_messaggio', v => v ?? ''),
      p('landing_dress_code', v => v ?? ''),
      p('landing_info_pratiche', v => v ?? ''),
      p('landing_tema', v => v || 'rose')
    );
  res.json(db.prepare('SELECT * FROM config LIMIT 1').get());
});

module.exports = router;
