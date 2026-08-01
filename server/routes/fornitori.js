const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM fornitori ORDER BY categoria, nome').all());
});

router.post('/', auth, (req, res) => {
  const { categoria, nome, contatto, telefono, email, note, stato } = req.body;
  const r = db.prepare('INSERT INTO fornitori (categoria, nome, contatto, telefono, email, note, stato) VALUES (?,?,?,?,?,?,?)')
    .run(categoria, nome, contatto, telefono, email, note, stato || 'da_contattare');
  res.json(db.prepare('SELECT * FROM fornitori WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { categoria, nome, contatto, telefono, email, note, stato } = req.body;
  db.prepare('UPDATE fornitori SET categoria=?, nome=?, contatto=?, telefono=?, email=?, note=?, stato=? WHERE id=?')
    .run(categoria, nome, contatto, telefono, email, note, stato, req.params.id);
  res.json(db.prepare('SELECT * FROM fornitori WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM fornitori WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
