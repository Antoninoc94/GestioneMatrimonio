const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM note_veloci ORDER BY created_at DESC LIMIT 20').all());
});

router.post('/', auth, (req, res) => {
  const { testo } = req.body;
  if (!testo?.trim()) return res.status(400).json({ error: 'Testo obbligatorio' });
  const r = db.prepare('INSERT INTO note_veloci (testo, autore) VALUES (?, ?)')
    .run(testo.trim(), req.user.nome || req.user.username || 'Utente');
  res.json(db.prepare('SELECT * FROM note_veloci WHERE id = ?').get(r.lastInsertRowid));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM note_veloci WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
