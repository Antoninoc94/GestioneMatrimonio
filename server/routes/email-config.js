const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { testConnection } = require('../email');

router.get('/', auth, (req, res) => {
  const cfg = db.prepare('SELECT id, smtp_host, smtp_port, smtp_user, from_name, from_email, enabled FROM email_config WHERE id = 1').get();
  res.json(cfg);
});

router.put('/', auth, (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_password, from_name, from_email, enabled } = req.body;

  // Aggiorna solo la password se fornita (non sovrascriverla con stringa vuota)
  if (smtp_password) {
    db.prepare('UPDATE email_config SET smtp_host=?, smtp_port=?, smtp_user=?, smtp_password=?, from_name=?, from_email=?, enabled=? WHERE id=1')
      .run(smtp_host, smtp_port || 587, smtp_user, smtp_password, from_name, from_email, enabled ? 1 : 0);
  } else {
    db.prepare('UPDATE email_config SET smtp_host=?, smtp_port=?, smtp_user=?, from_name=?, from_email=?, enabled=? WHERE id=1')
      .run(smtp_host, smtp_port || 587, smtp_user, from_name, from_email, enabled ? 1 : 0);
  }

  const cfg = db.prepare('SELECT id, smtp_host, smtp_port, smtp_user, from_name, from_email, enabled FROM email_config WHERE id = 1').get();
  res.json(cfg);
});

router.post('/test', auth, async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, message: 'Connessione SMTP riuscita!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
