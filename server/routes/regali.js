const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const regali = db.prepare(`
    SELECT r.*, o.nome as ospite_nome, o.cognome as ospite_cognome
    FROM regali r
    LEFT JOIN ospiti o ON r.ospite_id = o.id
    ORDER BY r.created_at DESC
  `).all();
  res.json(regali);
});

router.post('/', auth, (req, res) => {
  const { ospite_id, mittente, descrizione, tipo, valore_stimato, ringraziamento_inviato, note } = req.body;
  const r = db.prepare(
    'INSERT INTO regali (ospite_id, mittente, descrizione, tipo, valore_stimato, ringraziamento_inviato, note) VALUES (?,?,?,?,?,?,?)'
  ).run(ospite_id || null, mittente || null, descrizione, tipo || 'altro',
    valore_stimato || null, ringraziamento_inviato ? 1 : 0, note || null);
  res.json(db.prepare('SELECT r.*, o.nome as ospite_nome, o.cognome as ospite_cognome FROM regali r LEFT JOIN ospiti o ON r.ospite_id = o.id WHERE r.id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { ospite_id, mittente, descrizione, tipo, valore_stimato, ringraziamento_inviato, note } = req.body;
  db.prepare(
    'UPDATE regali SET ospite_id=?, mittente=?, descrizione=?, tipo=?, valore_stimato=?, ringraziamento_inviato=?, note=? WHERE id=?'
  ).run(ospite_id || null, mittente || null, descrizione, tipo, valore_stimato || null,
    ringraziamento_inviato ? 1 : 0, note || null, req.params.id);
  res.json(db.prepare('SELECT r.*, o.nome as ospite_nome, o.cognome as ospite_cognome FROM regali r LEFT JOIN ospiti o ON r.ospite_id = o.id WHERE r.id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM regali WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
