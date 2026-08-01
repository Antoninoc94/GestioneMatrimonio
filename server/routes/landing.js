const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/landing');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const name = `landing-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, name);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Pubblico: dati per la landing page
router.get('/info', (req, res) => {
  const config = db.prepare(`
    SELECT data_matrimonio, nome_sposo1, nome_sposo2,
           landing_abilitata, landing_messaggio, landing_dress_code,
           landing_info_pratiche, landing_tema, landing_foto, landing_foto_posizione,
           conferma_abilitata
    FROM config LIMIT 1
  `).get();
  const locations = db.prepare("SELECT * FROM location WHERE stato = 'confermato' ORDER BY tipo ASC").all();
  const cronologia = db.prepare('SELECT * FROM cronologia ORDER BY ora ASC').all();
  res.json({ config: config || {}, locations, cronologia });
});

// Upload foto landing
router.post('/foto', auth, upload.single('foto'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File mancante' });
  const old = db.prepare('SELECT landing_foto FROM config LIMIT 1').get();
  if (old?.landing_foto) {
    const oldPath = path.join(__dirname, '../uploads/landing', old.landing_foto);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  db.prepare('UPDATE config SET landing_foto = ?').run(req.file.filename);
  res.json({ landing_foto: req.file.filename });
});

// Rimuovi foto landing
router.delete('/foto', auth, (req, res) => {
  const cfg = db.prepare('SELECT landing_foto FROM config LIMIT 1').get();
  if (cfg?.landing_foto) {
    const filePath = path.join(__dirname, '../uploads/landing', cfg.landing_foto);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('UPDATE config SET landing_foto = NULL').run();
  }
  res.json({ ok: true });
});

module.exports = router;
