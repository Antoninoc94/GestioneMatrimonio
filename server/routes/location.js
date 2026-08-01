const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM location ORDER BY tipo, nome').all());
});

router.post('/', auth, (req, res) => {
  const { tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato, note } = req.body;
  const r = db.prepare('INSERT INTO location (tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato || 'in_valutazione', note);
  res.json(db.prepare('SELECT * FROM location WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato, note } = req.body;
  db.prepare('UPDATE location SET tipo=?, nome=?, indirizzo=?, contatto=?, telefono=?, email=?, sito_web=?, capienza=?, costo=?, stato=?, note=? WHERE id=?')
    .run(tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato, note, req.params.id);
  res.json(db.prepare('SELECT * FROM location WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM location WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
