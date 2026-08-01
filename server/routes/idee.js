const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM idee ORDER BY created_at DESC').all());
});

router.post('/', auth, (req, res) => {
  const { titolo, descrizione, categoria, immagine_url, priorita, note } = req.body;
  const r = db.prepare('INSERT INTO idee (titolo, descrizione, categoria, immagine_url, priorita, note) VALUES (?,?,?,?,?,?)')
    .run(titolo, descrizione, categoria || 'altro', immagine_url, priorita || 'media', note);
  res.json(db.prepare('SELECT * FROM idee WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { titolo, descrizione, categoria, immagine_url, priorita, realizzata, note } = req.body;
  db.prepare('UPDATE idee SET titolo=?, descrizione=?, categoria=?, immagine_url=?, priorita=?, realizzata=?, note=? WHERE id=?')
    .run(titolo, descrizione, categoria, immagine_url, priorita, realizzata ? 1 : 0, note, req.params.id);
  res.json(db.prepare('SELECT * FROM idee WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM idee WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
