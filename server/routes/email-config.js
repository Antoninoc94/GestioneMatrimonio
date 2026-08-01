const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { testConnection, sendTestEmail, sendScadenzeReminder } = require('../email');

router.get('/', auth, (req, res) => {
  const cfg = db.prepare('SELECT id, smtp_host, smtp_port, smtp_user, from_name, from_email, enabled, reminder_abilitato, reminder_frequenza, reminder_giorni_anticipo, reminder_ora, ultimo_invio_auto FROM email_config WHERE id = 1').get();
  res.json(cfg);
});

router.put('/', auth, (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_password, from_name, from_email, enabled,
          reminder_abilitato, reminder_frequenza, reminder_giorni_anticipo, reminder_ora } = req.body;

  if (smtp_password) {
    db.prepare('UPDATE email_config SET smtp_host=?, smtp_port=?, smtp_user=?, smtp_password=?, from_name=?, from_email=?, enabled=?, reminder_abilitato=?, reminder_frequenza=?, reminder_giorni_anticipo=?, reminder_ora=? WHERE id=1')
      .run(smtp_host, smtp_port || 587, smtp_user, smtp_password, from_name, from_email, enabled ? 1 : 0,
           reminder_abilitato ? 1 : 0, reminder_frequenza || 'settimanale', reminder_giorni_anticipo || 14, reminder_ora ?? 8);
  } else {
    db.prepare('UPDATE email_config SET smtp_host=?, smtp_port=?, smtp_user=?, from_name=?, from_email=?, enabled=?, reminder_abilitato=?, reminder_frequenza=?, reminder_giorni_anticipo=?, reminder_ora=? WHERE id=1')
      .run(smtp_host, smtp_port || 587, smtp_user, from_name, from_email, enabled ? 1 : 0,
           reminder_abilitato ? 1 : 0, reminder_frequenza || 'settimanale', reminder_giorni_anticipo || 14, reminder_ora ?? 8);
  }

  const cfg = db.prepare('SELECT id, smtp_host, smtp_port, smtp_user, from_name, from_email, enabled, reminder_abilitato, reminder_frequenza, reminder_giorni_anticipo, reminder_ora, ultimo_invio_auto FROM email_config WHERE id = 1').get();
  res.json(cfg);
});

// Verifica solo connessione SMTP (non invia email)
router.post('/verify', auth, async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, message: 'Connessione SMTP verificata!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Invia vera email di test all'indirizzo configurato
router.post('/test', auth, async (req, res) => {
  try {
    const dest = await sendTestEmail();
    res.json({ ok: true, message: `Email di test inviata a ${dest}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Invia promemoria scadenze
router.post('/remind-scadenze', auth, async (req, res) => {
  try {
    const giorni = parseInt(req.body.giorni) || 14;
    const result = await sendScadenzeReminder(giorni);
    res.json({ ok: true, message: `Promemoria inviato a ${result.dest} (${result.imminenti} imminenti, ${result.scadute} scadute)` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
