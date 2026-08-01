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

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM documenti ORDER BY created_at DESC').all());
});

router.post('/', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File mancante' });
  const { titolo, categoria, fornitore_id, note } = req.body;
  const r = db.prepare('INSERT INTO documenti (titolo, categoria, nome_file, percorso_file, dimensione, fornitore_id, note) VALUES (?,?,?,?,?,?,?)')
    .run(titolo, categoria || 'altro', req.file.originalname, req.file.filename, req.file.size, fornitore_id || null, note);
  res.json(db.prepare('SELECT * FROM documenti WHERE id = ?').get(r.lastInsertRowid));
});

router.get('/download/:id', auth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documenti WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
  const filePath = path.join(__dirname, '../uploads', doc.percorso_file);
  res.download(filePath, doc.nome_file);
});

router.delete('/:id', auth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documenti WHERE id = ?').get(req.params.id);
  if (doc) {
    const filePath = path.join(__dirname, '../uploads', doc.percorso_file);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM documenti WHERE id = ?').run(req.params.id);
  }
  res.json({ ok: true });
});

module.exports = router;
