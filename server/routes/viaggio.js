const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM viaggio ORDER BY data_inizio ASC, created_at ASC').all());
});

router.post('/', auth, (req, res) => {
  const { tipo, titolo, luogo, data_inizio, data_fine, costo, numero_prenotazione, stato, note } = req.body;
  const r = db.prepare(
    'INSERT INTO viaggio (tipo, titolo, luogo, data_inizio, data_fine, costo, numero_prenotazione, stato, note) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(tipo || 'altro', titolo, luogo || null, data_inizio || null, data_fine || null,
    costo || null, numero_prenotazione || null, stato || 'da_prenotare', note || null);
  res.json(db.prepare('SELECT * FROM viaggio WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  const { tipo, titolo, luogo, data_inizio, data_fine, costo, numero_prenotazione, stato, note } = req.body;
  db.prepare(
    'UPDATE viaggio SET tipo=?, titolo=?, luogo=?, data_inizio=?, data_fine=?, costo=?, numero_prenotazione=?, stato=?, note=? WHERE id=?'
  ).run(tipo, titolo, luogo || null, data_inizio || null, data_fine || null,
    costo || null, numero_prenotazione || null, stato, note || null, req.params.id);
  res.json(db.prepare('SELECT * FROM viaggio WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM viaggio WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
