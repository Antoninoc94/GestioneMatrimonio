const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const ospiti = db.prepare(`
    SELECT o.*, t.nome as tavolo_nome
    FROM ospiti o
    LEFT JOIN tavoli t ON o.tavolo_id = t.id
    ORDER BY o.cognome ASC, o.nome ASC
  `).all();
  res.json(ospiti);
});

router.post('/', auth, (req, res) => {
  const { nome, cognome, lato, tipo, rsvp, tavolo_id, email, telefono, intolleranze, note, parent_id, eta } = req.body;
  const r = db.prepare(
    'INSERT INTO ospiti (nome, cognome, lato, tipo, rsvp, tavolo_id, email, telefono, intolleranze, note, parent_id, eta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(nome, cognome || null, lato || 'comune', tipo || 'adulto', rsvp || 'attesa',
    tavolo_id || null, email || null, telefono || null, intolleranze || null, note || null,
    parent_id || null, eta || null);
  res.json(db.prepare('SELECT o.*, t.nome as tavolo_nome FROM ospiti o LEFT JOIN tavoli t ON o.tavolo_id = t.id WHERE o.id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { nome, cognome, lato, tipo, rsvp, tavolo_id, email, telefono, intolleranze, note, parent_id, eta, messaggio_ospite } = req.body;
  db.prepare(
    'UPDATE ospiti SET nome=?, cognome=?, lato=?, tipo=?, rsvp=?, tavolo_id=?, email=?, telefono=?, intolleranze=?, note=?, parent_id=?, eta=?, messaggio_ospite=? WHERE id=?'
  ).run(nome, cognome || null, lato, tipo, rsvp, tavolo_id || null, email || null, telefono || null,
    intolleranze || null, note || null, parent_id || null, eta || null, messaggio_ospite || null, req.params.id);
  res.json(db.prepare('SELECT o.*, t.nome as tavolo_nome FROM ospiti o LEFT JOIN tavoli t ON o.tavolo_id = t.id WHERE o.id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM ospiti WHERE parent_id = ?').run(req.params.id);
  db.prepare('DELETE FROM ospiti WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
