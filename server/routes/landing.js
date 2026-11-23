const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');
const { eventi } = require('../cronologia');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/landing');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  // Il campo nel nome: foto, originale e anteprima arrivano nella stessa
  // richiesta, e con solo il timestamp due file .jpg si sovrascrivevano.
  filename: (req, file, cb) => {
    const name = `landing-${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`;
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

  // Solo i campi rilevanti per un invitato: referente/telefono/email/costo/note
  // sono dati interni per trattare con il fornitore, non vanno esposti pubblicamente.
  const locations = db.prepare("SELECT id, tipo, nome, indirizzo FROM location WHERE stato = 'confermato' ORDER BY tipo ASC").all();
  // Solo gli eventi segnati come visibili, e solo i campi che servono a un
  // invitato: i preparativi a casa degli sposi restano nella gestione.
  const cronologia = eventi('WHERE c.pubblico = 1').map(e => ({
    id: e.id, ora: e.ora, durata: e.durata, titolo: e.titolo, descrizione: e.descrizione, tipo: e.tipo,
    luogo: e.location_nome || e.luogo, indirizzo: e.location_id ? e.location_indirizzo : null,
  }));
  res.json({ config, locations, cronologia });
});

const rimuovi = filename => {
  if (!filename) return;
  const filePath = path.join(__dirname, '../uploads/landing', filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

// Upload foto landing: 'foto' è sempre la versione ritagliata da mostrare
// pubblicamente; 'originale' è presente solo quando si carica una foto nuova
// (non quando si ritaglia di nuovo una foto già caricata), e viene conservata
// per permettere di rifare il ritaglio in futuro senza ricaricarla.
// 'anteprima' è la copia piccola del ritaglio per l'anteprima dei link.

router.post('/foto', auth, upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'originale', maxCount: 1 }, { name: 'anteprima', maxCount: 1 }]), (req, res) => {
  const croppedFile = req.files?.foto?.[0];
  const originalFile = req.files?.originale?.[0];
  const anteprimaFile = req.files?.anteprima?.[0];
  if (!croppedFile) return res.status(400).json({ error: 'File mancante' });

  const old = db.prepare('SELECT landing_foto, landing_foto_originale, landing_foto_anteprima FROM config LIMIT 1').get();
  rimuovi(old?.landing_foto);
  // L'anteprima segue sempre il ritaglio: una vecchia non va più bene.
  rimuovi(old?.landing_foto_anteprima);

  let originaleFilename = old?.landing_foto_originale || null;
  if (originalFile) {
    rimuovi(old?.landing_foto_originale);
    originaleFilename = originalFile.filename;
  }

  db.prepare('UPDATE config SET landing_foto = ?, landing_foto_originale = ?, landing_foto_crop = ?, landing_foto_anteprima = ?')
    .run(croppedFile.filename, originaleFilename, req.body.crop || null, anteprimaFile?.filename || null);
  res.json({ landing_foto: croppedFile.filename, landing_foto_originale: originaleFilename });
});

// Rimuovi foto landing (ritagliata, originale e anteprima)
router.delete('/foto', auth, (req, res) => {
  const cfg = db.prepare('SELECT landing_foto, landing_foto_originale, landing_foto_anteprima FROM config LIMIT 1').get();
  [cfg?.landing_foto, cfg?.landing_foto_originale, cfg?.landing_foto_anteprima].forEach(rimuovi);
  db.prepare('UPDATE config SET landing_foto = NULL, landing_foto_originale = NULL, landing_foto_crop = NULL, landing_foto_anteprima = NULL').run();
  res.json({ ok: true });
});

module.exports = router;
