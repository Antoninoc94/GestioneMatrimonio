const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM preventivi ORDER BY created_at DESC').all());
});

router.post('/', auth, (req, res) => {
  const { fornitore_id, fornitore_nome, categoria, descrizione, importo, stato, data_scadenza, note } = req.body;
  const r = db.prepare('INSERT INTO preventivi (fornitore_id, fornitore_nome, categoria, descrizione, importo, stato, data_scadenza, note) VALUES (?,?,?,?,?,?,?,?)')
    .run(fornitore_id || null, fornitore_nome, categoria, descrizione, importo, stato || 'in_attesa', data_scadenza, note);
  res.json(db.prepare('SELECT * FROM preventivi WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { fornitore_id, fornitore_nome, categoria, descrizione, importo, stato, data_scadenza, note } = req.body;
  db.prepare('UPDATE preventivi SET fornitore_id=?, fornitore_nome=?, categoria=?, descrizione=?, importo=?, stato=?, data_scadenza=?, note=? WHERE id=?')
    .run(fornitore_id || null, fornitore_nome, categoria, descrizione, importo, stato, data_scadenza, note, req.params.id);
  res.json(db.prepare('SELECT * FROM preventivi WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM preventivi WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
