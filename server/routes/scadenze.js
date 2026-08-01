const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { getAllScadenze } = require('../utils/scadenze-helper');

router.get('/', auth, (req, res) => {
  res.json(getAllScadenze(db));
});

router.post('/', auth, (req, res) => {
  const { titolo, descrizione, data_scadenza, categoria, priorita } = req.body;
  const r = db.prepare('INSERT INTO scadenze (titolo, descrizione, data_scadenza, categoria, priorita) VALUES (?,?,?,?,?)')
    .run(titolo, descrizione, data_scadenza, categoria || 'altro', priorita || 'media');
  res.json(db.prepare('SELECT *, \'manuale\' as source FROM scadenze WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { titolo, descrizione, data_scadenza, categoria, priorita, completata } = req.body;
  db.prepare('UPDATE scadenze SET titolo=?, descrizione=?, data_scadenza=?, categoria=?, priorita=?, completata=? WHERE id=?')
    .run(titolo, descrizione, data_scadenza, categoria, priorita, completata ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT *, \'manuale\' as source FROM scadenze WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM scadenze WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
