const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM cronologia ORDER BY ora ASC').all());
});

router.post('/', auth, (req, res) => {
  const { ora, titolo, descrizione, luogo, durata, tipo } = req.body;
  const r = db.prepare('INSERT INTO cronologia (ora, titolo, descrizione, luogo, durata, tipo) VALUES (?,?,?,?,?,?)')
    .run(ora, titolo, descrizione || null, luogo || null, durata || null, tipo || 'altro');
  res.json(db.prepare('SELECT * FROM cronologia WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { ora, titolo, descrizione, luogo, durata, tipo } = req.body;
  db.prepare('UPDATE cronologia SET ora=?, titolo=?, descrizione=?, luogo=?, durata=?, tipo=? WHERE id=?')
    .run(ora, titolo, descrizione || null, luogo || null, durata || null, tipo || 'altro', req.params.id);
  res.json(db.prepare('SELECT * FROM cronologia WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM cronologia WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
