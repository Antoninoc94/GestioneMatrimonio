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

  // Se la pagina è disabilitata, restituisci solo il minimo senza esporre i contenuti
  if (!config || config.landing_abilitata !== 1) {
    return res.json({ config: { landing_abilitata: 0, landing_tema: config?.landing_tema || 'rose' }, locations: [], cronologia: [] });
  }

  const locations = db.prepare("SELECT * FROM location WHERE stato = 'confermato' ORDER BY tipo ASC").all();
  const cronologia = db.prepare('SELECT * FROM cronologia ORDER BY ora ASC').all();
  res.json({ config, locations, cronologia });
});

// Upload foto landing: 'foto' è sempre la versione ritagliata da mostrare
// pubblicamente; 'originale' è presente solo quando si carica una foto nuova
// (non quando si ritaglia di nuovo una foto già caricata), e viene conservata
// per permettere di rifare il ritaglio in futuro senza ricaricarla.
router.post('/foto', auth, upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'originale', maxCount: 1 }]), (req, res) => {
  const croppedFile = req.files?.foto?.[0];
  const originalFile = req.files?.originale?.[0];
  if (!croppedFile) return res.status(400).json({ error: 'File mancante' });

  const old = db.prepare('SELECT landing_foto, landing_foto_originale FROM config LIMIT 1').get();
  if (old?.landing_foto) {
    const oldPath = path.join(__dirname, '../uploads/landing', old.landing_foto);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  let originaleFilename = old?.landing_foto_originale || null;
  if (originalFile) {
    if (old?.landing_foto_originale) {
      const oldOrigPath = path.join(__dirname, '../uploads/landing', old.landing_foto_originale);
      if (fs.existsSync(oldOrigPath)) fs.unlinkSync(oldOrigPath);
    }
    originaleFilename = originalFile.filename;
  }

  db.prepare('UPDATE config SET landing_foto = ?, landing_foto_originale = ?, landing_foto_crop = ?')
    .run(croppedFile.filename, originaleFilename, req.body.crop || null);
  res.json({ landing_foto: croppedFile.filename, landing_foto_originale: originaleFilename });
});

// Rimuovi foto landing (ritagliata + originale)
router.delete('/foto', auth, (req, res) => {
  const cfg = db.prepare('SELECT landing_foto, landing_foto_originale FROM config LIMIT 1').get();
  for (const filename of [cfg?.landing_foto, cfg?.landing_foto_originale]) {
    if (!filename) continue;
    const filePath = path.join(__dirname, '../uploads/landing', filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare('UPDATE config SET landing_foto = NULL, landing_foto_originale = NULL, landing_foto_crop = NULL').run();
  res.json({ ok: true });
});

module.exports = router;
