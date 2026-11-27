// Galleria foto degli invitati.
//
// Pubblico (/foto, nessun token): vedere le foto non nascoste e caricarne, se la
// galleria e i caricamenti sono accesi. Gli sposi gestiscono tutto sotto /admin.
//
// Dell'invitato arrivano tre file per foto, già pronti dal suo telefono:
// l'originale, una versione grande (~2048 px) e una miniatura, entrambe JPEG
// ricreate nel browser e quindi senza EXIF (niente posizione GPS). Il pubblico
// vede solo grande e miniatura; l'originale lo scaricano gli sposi.
// I file non stanno in una cartella statica ma passano da qui: una foto
// nascosta deve restare davvero irraggiungibile.
const router = require('express').Router();
const multer = require('multer');
const archiver = require('archiver');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const g = require('../galleria');

const MB = 1024 * 1024;
const MAX_ORIGINALE = 25 * MB;
const MAX_GRANDE = 8 * MB;
const MAX_MINI = 1 * MB;
const PER_PAGINA = 60;

const cfg = () => db.prepare('SELECT galleria_abilitata, galleria_caricamenti FROM config LIMIT 1').get() || {};
const visibile = () => cfg().galleria_abilitata === 1;
const caricamentiAperti = () => visibile() && cfg().galleria_caricamenti === 1 && g.pronta();

// Nome e cognome di chi carica, obbligatori: servono agli sposi per ringraziare.
// Due parole almeno, solo lettere (con apostrofo, trattino e punto: D'Angelo,
// Anna-Maria, Jr.). Non si può sapere se è davvero il suo nome, ma si evita
// "ciao", "a" o un numero. Scritto tutto minuscolo o tutto maiuscolo, si
// sistemano le iniziali.
const PAROLA_NOME = /^\p{L}[\p{L}'’.-]+$/u;
const maiuscole = w => w.replace(/(^|[-'’])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase());
function formattaNome(v) {
  const parole = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parole.length < 2 || parole.join(' ').length > 60 || !parole.every(w => PAROLA_NOME.test(w))) return null;
  return parole.map(w => (w === w.toLowerCase() || w === w.toUpperCase() ? maiuscole(w.toLowerCase()) : w)).join(' ');
}
const semplifica = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const CODICE = /^[a-f0-9]{24}$/;
const contaVisibili = () => db.prepare('SELECT COUNT(*) AS n FROM galleria_foto WHERE nascosta = 0').get().n;

// ── Pubblico ─────────────────────────────────────────────────────
router.get('/info', (req, res) => {
  const c = db.prepare(`SELECT nome_sposo1, nome_sposo2, data_matrimonio, landing_tema, landing_foto,
    galleria_abilitata FROM config LIMIT 1`).get() || {};
  const { galleria_abilitata, ...resto } = c;
  res.json({ ...resto, abilitata: galleria_abilitata === 1 ? 1 : 0, caricamenti: caricamentiAperti() ? 1 : 0 });
});

// Più recenti in alto. `prima` è l'id dell'ultima foto già vista: si continua da lì.
router.get('/foto', (req, res) => {
  if (!visibile()) return res.status(403).json({ disabilitata: true, error: 'La galleria non è ancora attiva.' });
  const prima = parseInt(req.query.prima, 10);
  const righe = db.prepare(`
    SELECT id, codice, autore, larghezza, altezza FROM galleria_foto
    WHERE nascosta = 0 ${prima > 0 ? 'AND id < ?' : ''}
    ORDER BY id DESC LIMIT ?
  `).all(...(prima > 0 ? [prima] : []), PER_PAGINA + 1);
  res.json({ foto: righe.slice(0, PER_PAGINA), altre: righe.length > PER_PAGINA, totale: contaVisibili() });
});

function inviaFile(res, file, nomeScarica) {
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Foto non trovata.' });
  if (nomeScarica) res.attachment(nomeScarica);
  res.sendFile(file, { headers: { 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' } });
}

router.get('/file/:tipo/:codice', (req, res) => {
  const { tipo, codice } = req.params;
  if (!visibile() || !['mini', 'grande'].includes(tipo) || !CODICE.test(codice)) return res.status(404).end();
  const foto = db.prepare('SELECT id FROM galleria_foto WHERE codice = ? AND nascosta = 0').get(codice);
  if (!foto) return res.status(404).end();
  inviaFile(res, g.percorso(tipo === 'mini' ? 'mini' : 'grandi', codice, 'jpg'),
    req.query.scarica ? `foto-${foto.id}.jpg` : null);
});

// Caricamento. Multer scrive in .incoming, dentro la stessa cartella delle foto:
// così lo spostamento finale è un rename sullo stesso file system, non una copia.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try { g.preparaCartelle(); cb(null, path.join(g.DIR, '.incoming')); } catch (e) { cb(e); }
    },
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex')),
  }),
  limits: { fileSize: MAX_ORIGINALE, files: 3, fields: 6 },
}).fields([{ name: 'originale', maxCount: 1 }, { name: 'grande', maxCount: 1 }, { name: 'mini', maxCount: 1 }]);

router.post('/carica', (req, res, next) => {
  if (!visibile() || cfg().galleria_caricamenti !== 1)
    return res.status(403).json({ error: 'I caricamenti sono chiusi.' });
  if (!g.pronta())
    return res.status(503).json({ error: 'Al momento non si possono caricare foto. Riprova più tardi.' });
  next();
}, (req, res) => {
  upload(req, res, err => {
    const tutti = Object.values(req.files || {}).flat();
    const butta = () => tutti.forEach(f => g.rimuovi(f.path));
    if (err) {
      butta();
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'La foto è troppo pesante: il limite è 25 MB.' });
      return res.status(400).json({ error: 'Caricamento non valido.' });
    }

    const f = { originale: req.files?.originale?.[0], grande: req.files?.grande?.[0], mini: req.files?.mini?.[0] };
    if (!f.originale || !f.grande || !f.mini) { butta(); return res.status(400).json({ error: 'Foto incompleta.' }); }
    if (f.grande.size > MAX_GRANDE || f.mini.size > MAX_MINI) { butta(); return res.status(413).json({ error: 'Foto troppo pesante.' }); }

    const estensione = g.tipoImmagine(f.originale.path);
    if (!estensione || g.tipoImmagine(f.grande.path) !== 'jpg' || g.tipoImmagine(f.mini.path) !== 'jpg') {
      butta();
      return res.status(400).json({ error: 'Il file non è una foto valida.' });
    }
    const autore = formattaNome(req.body.autore);
    if (!autore) { butta(); return res.status(400).json({ error: 'Scrivi il tuo nome e cognome.' }); }
    const larghezza = parseInt(req.body.larghezza, 10);
    const altezza = parseInt(req.body.altezza, 10);
    if (!(larghezza > 0 && larghezza <= 20000 && altezza > 0 && altezza <= 20000)) {
      butta();
      return res.status(400).json({ error: 'Dimensioni non valide.' });
    }

    const codice = crypto.randomBytes(12).toString('hex');
    const destinazioni = [
      [f.originale.path, g.percorso('originali', codice, estensione)],
      [f.grande.path, g.percorso('grandi', codice, 'jpg')],
      [f.mini.path, g.percorso('mini', codice, 'jpg')],
    ];
    const fatti = [];
    try {
      for (const [da, a] of destinazioni) { fs.renameSync(da, a); fatti.push(a); }
      const info = db.prepare(`INSERT INTO galleria_foto (codice, estensione, nome_file, autore, larghezza, altezza, peso)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(codice, estensione, path.basename(String(f.originale.originalname || '')).slice(0, 120),
        autore, larghezza, altezza, f.originale.size);
      res.status(201).json({ id: Number(info.lastInsertRowid), codice });
    } catch (e) {
      // Un file spostato e uno no lascerebbe un mezzo caricamento: si disfa tutto.
      fatti.forEach(g.rimuovi);
      butta();
      console.error('[Galleria] caricamento fallito:', e.message);
      res.status(500).json({ error: 'Non siamo riusciti a salvare la foto. Riprova.' });
    }
  });
});

// ── Accesso temporaneo per gli sposi ─────────────────────────────
// Miniature, originali e ZIP si aprono da <img> e da un link di download, che
// non possono mandare l'header Authorization. Si usa un gettone breve nell'URL,
// firmato con un segreto diverso da quello del login: non vale come token di
// accesso all'app, solo per queste route.
const SEGRETO = () => `${process.env.JWT_SECRET}:galleria`;
const gettoneValido = t => {
  try { return jwt.verify(String(t || ''), SEGRETO()).galleria === 1; } catch { return false; }
};
const richiedeGettone = (req, res, next) => (gettoneValido(req.query.t) ? next() : res.status(401).json({ error: 'Link scaduto: ricarica la pagina.' }));

router.get('/privato/:tipo/:codice', richiedeGettone, (req, res) => {
  const { tipo, codice } = req.params;
  if (!['mini', 'grande', 'originale'].includes(tipo) || !CODICE.test(codice)) return res.status(404).end();
  const foto = db.prepare('SELECT id, estensione FROM galleria_foto WHERE codice = ?').get(codice);
  if (!foto) return res.status(404).end();
  const file = tipo === 'originale' ? g.percorso('originali', codice, foto.estensione)
    : g.percorso(tipo === 'mini' ? 'mini' : 'grandi', codice, 'jpg');
  inviaFile(res, file, req.query.scarica ? `foto-${foto.id}.${tipo === 'originale' ? foto.estensione : 'jpg'}` : null);
});

// Tutti gli originali in un solo ZIP, scritto man mano: sono GB e non devono
// stare in memoria. Le foto sono già compresse, quindi senza ricompressione.
router.get('/zip', richiedeGettone, (req, res) => {
  const righe = db.prepare('SELECT id, codice, estensione, autore, created_at FROM galleria_foto ORDER BY id ASC').all();
  const zip = archiver('zip', { zlib: { level: 0 } });
  zip.on('warning', e => console.error('[Galleria] zip:', e.message));
  zip.on('error', e => { console.error('[Galleria] zip:', e.message); res.destroy(e); });
  res.attachment('foto-matrimonio.zip');
  zip.pipe(res);
  res.on('close', () => { if (!res.writableFinished) zip.abort(); });
  for (const r of righe) {
    const file = g.percorso('originali', r.codice, r.estensione);
    if (!fs.existsSync(file)) continue;
    const autore = (r.autore || 'invitato').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'invitato';
    zip.file(file, { name: `${String(r.id).padStart(5, '0')}-${autore}.${r.estensione}` });
  }
  zip.finalize();
});

// ── Gestione degli sposi (richiede il login) ─────────────────────
const admin = require('express').Router();
admin.use(auth);

admin.get('/foto', (req, res) => {
  const foto = db.prepare(`SELECT id, codice, estensione, nome_file, autore, larghezza, altezza, peso, nascosta, created_at
    FROM galleria_foto ORDER BY id DESC`).all();
  const gettone = jwt.sign({ galleria: 1 }, SEGRETO(), { expiresIn: '2h' });
  // Chi ha caricato, e se il nome corrisponde a un invitato (in qualsiasi ordine):
  // aiuta a capire chi ringraziare e chi ha scritto un nome inventato.
  const invitati = new Set();
  for (const o of db.prepare('SELECT nome, cognome FROM ospiti WHERE sposo IS NULL').all()) {
    invitati.add(semplifica(`${o.nome} ${o.cognome}`));
    invitati.add(semplifica(`${o.cognome} ${o.nome}`));
  }
  const conteggio = new Map();
  for (const f of foto) if (f.autore) conteggio.set(f.autore, (conteggio.get(f.autore) || 0) + 1);
  const autori = [...conteggio].map(([nome, n]) => ({ nome, foto: n, in_lista: invitati.has(semplifica(nome)) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  res.json({
    foto, gettone, autori,
    stato: { pronta: g.pronta(), nas: g.NAS, abilitata: visibile(), caricamenti: cfg().galleria_caricamenti === 1 },
  });
});

// Nascondi, mostra o elimina più foto in una volta: tutto o niente nel database,
// i file si tolgono dopo (un file rimasto orfano non si vede, una riga senza file sì).
admin.post('/azioni', (req, res) => {
  const { azione } = req.body;
  const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map(Number).filter(n => Number.isInteger(n) && n > 0))] : [];
  if (!ids.length || ids.length > 5000) return res.status(400).json({ error: 'Nessuna foto selezionata.' });
  if (!['nascondi', 'mostra', 'elimina'].includes(azione)) return res.status(400).json({ error: 'Azione non valida.' });

  const segnaposto = ids.map(() => '?').join(',');
  if (azione === 'elimina') {
    const righe = db.prepare(`SELECT id, codice, estensione FROM galleria_foto WHERE id IN (${segnaposto})`).all(...ids);
    db.transaction(() => db.prepare(`DELETE FROM galleria_foto WHERE id IN (${segnaposto})`).run(...ids))();
    for (const r of righe) {
      g.rimuovi(g.percorso('originali', r.codice, r.estensione));
      g.rimuovi(g.percorso('grandi', r.codice, 'jpg'));
      g.rimuovi(g.percorso('mini', r.codice, 'jpg'));
    }
    return res.json({ ok: true, modificate: righe.length });
  }
  const r = db.prepare(`UPDATE galleria_foto SET nascosta = ? WHERE id IN (${segnaposto})`).run(azione === 'nascondi' ? 1 : 0, ...ids);
  res.json({ ok: true, modificate: r.changes });
});

router.use('/admin', admin);

module.exports = router;
