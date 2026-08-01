const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM costi ORDER BY categoria, descrizione').all());
});

router.post('/', auth, (req, res) => {
  const { categoria, descrizione, importo_preventivo, importo_effettivo, pagato, data_pagamento, fornitore_id, note } = req.body;
  const r = db.prepare('INSERT INTO costi (categoria, descrizione, importo_preventivo, importo_effettivo, pagato, data_pagamento, fornitore_id, note) VALUES (?,?,?,?,?,?,?,?)')
    .run(categoria, descrizione, importo_preventivo || 0, importo_effettivo || 0, pagato ? 1 : 0, data_pagamento, fornitore_id || null, note);
  res.json(db.prepare('SELECT * FROM costi WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { categoria, descrizione, importo_preventivo, importo_effettivo, pagato, data_pagamento, fornitore_id, note } = req.body;
  db.prepare('UPDATE costi SET categoria=?, descrizione=?, importo_preventivo=?, importo_effettivo=?, pagato=?, data_pagamento=?, fornitore_id=?, note=? WHERE id=?')
    .run(categoria, descrizione, importo_preventivo || 0, importo_effettivo || 0, pagato ? 1 : 0, data_pagamento, fornitore_id || null, note, req.params.id);
  res.json(db.prepare('SELECT * FROM costi WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM costi WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
