const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const deleteFile = percorso_file => {
  if (!percorso_file) return;
  const filePath = path.join(__dirname, '../uploads', percorso_file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM preventivi ORDER BY created_at DESC').all());
});

router.post('/', auth, upload.single('allegato'), (req, res) => {
  const { fornitore_id, fornitore_nome, categoria, descrizione, importo, stato, data_scadenza, note } = req.body;
  const file = req.file ? { nome_file: req.file.originalname, percorso_file: req.file.filename, dimensione_file: req.file.size } : { nome_file: null, percorso_file: null, dimensione_file: null };
  const r = db.prepare('INSERT INTO preventivi (fornitore_id, fornitore_nome, categoria, descrizione, importo, stato, data_scadenza, note, nome_file, percorso_file, dimensione_file) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(fornitore_id || null, fornitore_nome, categoria, descrizione, parseFloat(importo), stato || 'in_attesa', data_scadenza, note, file.nome_file, file.percorso_file, file.dimensione_file);
  res.json(db.prepare('SELECT * FROM preventivi WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, upload.single('allegato'), (req, res) => {
  const { fornitore_id, fornitore_nome, categoria, descrizione, importo, stato, data_scadenza, note, rimuovi_allegato } = req.body;
  const existing = db.prepare('SELECT nome_file, percorso_file FROM preventivi WHERE id = ?').get(req.params.id);

  let file = { nome_file: existing?.nome_file, percorso_file: existing?.percorso_file, dimensione_file: existing?.dimensione_file };
  if (req.file) {
    deleteFile(existing?.percorso_file);
    file = { nome_file: req.file.originalname, percorso_file: req.file.filename, dimensione_file: req.file.size };
  } else if (rimuovi_allegato === 'true') {
    deleteFile(existing?.percorso_file);
    file = { nome_file: null, percorso_file: null, dimensione_file: null };
  }

  db.prepare('UPDATE preventivi SET fornitore_id=?, fornitore_nome=?, categoria=?, descrizione=?, importo=?, stato=?, data_scadenza=?, note=?, nome_file=?, percorso_file=?, dimensione_file=? WHERE id=?')
    .run(fornitore_id || null, fornitore_nome, categoria, descrizione, parseFloat(importo), stato, data_scadenza, note, file.nome_file, file.percorso_file, file.dimensione_file, req.params.id);
  res.json(db.prepare('SELECT * FROM preventivi WHERE id = ?').get(req.params.id));
});

router.get('/download/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM preventivi WHERE id = ?').get(req.params.id);
  if (!p || !p.percorso_file) return res.status(404).json({ error: 'Allegato non trovato' });
  const filePath = path.join(__dirname, '../uploads', p.percorso_file);
  res.download(filePath, p.nome_file);
});

router.delete('/:id', auth, (req, res) => {
  const p = db.prepare('SELECT percorso_file FROM preventivi WHERE id = ?').get(req.params.id);
  if (p) deleteFile(p.percorso_file);
  db.prepare('DELETE FROM preventivi WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
