const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendEmail, getDestinatari } = require('../email');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM note_veloci ORDER BY created_at DESC LIMIT 20').all());
});

router.post('/', auth, (req, res) => {
  const { testo } = req.body;
  if (!testo?.trim()) return res.status(400).json({ error: 'Testo obbligatorio' });
  const autore = req.user.nome || req.user.username || 'Utente';
  const r = db.prepare('INSERT INTO note_veloci (testo, autore) VALUES (?, ?)')
    .run(testo.trim(), autore);
  const nota = db.prepare('SELECT * FROM note_veloci WHERE id = ?').get(r.lastInsertRowid);
  res.json(nota);

  const appCfg = db.prepare('SELECT app_name FROM config LIMIT 1').get();
  const appName = appCfg?.app_name || 'Il Nostro Matrimonio';
  const data = new Date(nota.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dest = getDestinatari();
  sendEmail({
    to: dest,
    subject: `📝 Nuova nota — ${appName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #f3f4f6;">
        <h2 style="color:#e11d48;margin-top:0;">📝 Nuova nota</h2>
        <p style="color:#374151;"><strong>${autore}</strong> ha aggiunto una nota il <strong>${data}</strong>:</p>
        <blockquote style="margin:16px 0;padding:12px 16px;background:#fafafa;border-left:4px solid #e11d48;border-radius:4px;color:#374151;">${nota.testo.replace(/\n/g, '<br>')}</blockquote>
        <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;">
        <p style="color:#9ca3af;font-size:12px;">Inviato da ${appName}</p>
      </div>`,
  }).catch(() => {});
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM note_veloci WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
