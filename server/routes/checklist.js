const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM checklist_items ORDER BY ordine ASC, id ASC').all());
});

router.post('/', auth, (req, res) => {
  const { testo, fase } = req.body;
  if (!testo?.trim() || !fase) return res.status(400).json({ error: 'Testo e fase obbligatori' });
  const maxOrdine = db.prepare('SELECT MAX(ordine) as m FROM checklist_items WHERE fase = ?').get(fase)?.m || 0;
  const r = db.prepare('INSERT INTO checklist_items (testo, fase, predefinita, ordine) VALUES (?, ?, 0, ?)')
    .run(testo.trim(), fase, maxOrdine + 1);
  res.json(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { completata } = req.body;
  db.prepare('UPDATE checklist_items SET completata = ? WHERE id = ?').run(completata ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM checklist_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
