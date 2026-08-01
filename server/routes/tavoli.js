const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const tavoli = db.prepare('SELECT * FROM tavoli ORDER BY nome ASC').all();
  const ospiti = db.prepare('SELECT id, nome, cognome, tavolo_id, rsvp, tipo, parent_id FROM ospiti ORDER BY cognome ASC, nome ASC').all();
  res.json(tavoli.map(t => ({
    ...t,
    ospiti: ospiti.filter(o => o.tavolo_id === t.id),
  })));
});

router.post('/', auth, (req, res) => {
  const { nome, capienza, note } = req.body;
  const r = db.prepare('INSERT INTO tavoli (nome, capienza, note) VALUES (?,?,?)').run(nome, capienza || 8, note || null);
  const t = db.prepare('SELECT * FROM tavoli WHERE id = ?').get(r.lastInsertRowid);
  res.json({ ...t, ospiti: [] });
});

router.put('/:id', auth, (req, res) => {
  const { nome, capienza, note } = req.body;
  db.prepare('UPDATE tavoli SET nome=?, capienza=?, note=? WHERE id=?').run(nome, capienza || 8, note || null, req.params.id);
  const t = db.prepare('SELECT * FROM tavoli WHERE id = ?').get(req.params.id);
  const ospiti = db.prepare('SELECT id, nome, cognome, rsvp FROM ospiti WHERE tavolo_id = ?').all(req.params.id);
  res.json({ ...t, ospiti });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('UPDATE ospiti SET tavolo_id = NULL WHERE tavolo_id = ?').run(req.params.id);
  db.prepare('DELETE FROM tavoli WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
