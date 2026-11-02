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

// Una fattura appartiene al fornitore e può coprire zero, una o più rate dei
// suoi preventivi: il collegamento sta in fatture_rate e si può cambiare dopo.
const RATE_DOCUMENTI = `
  SELECT fr.documento_id, r.id, r.descrizione, r.importo, r.pagata,
         COALESCE(l.nome, pf.nome, p.fornitore_nome, p.categoria) AS preventivo_nome
  FROM fatture_rate fr
  JOIN preventivi_rate r ON r.id = fr.rata_id
  JOIN preventivi p ON p.id = r.preventivo_id
  LEFT JOIN fornitori pf ON pf.id = p.fornitore_id
  LEFT JOIN location l ON l.id = p.location_id
`;

const conRate = docs => {
  const rate = db.prepare(`${RATE_DOCUMENTI} ORDER BY p.id, r.ordine, r.id`).all();
  return docs.map(d => ({ ...d, rate: rate.filter(r => r.documento_id === d.id) }));
};

const getDocumento = id => {
  const d = db.prepare('SELECT d.*, f.nome AS fornitore_nome FROM documenti d LEFT JOIN fornitori f ON f.id = d.fornitore_id WHERE d.id = ?').get(id);
  return d ? conRate([d])[0] : null;
};

// rate_ids arriva come stringa JSON (multipart) o come array (JSON). Restituisce
// { rateIds } con id esistenti, oppure { error }.
const parseRateIds = raw => {
  if (raw === undefined || raw === '') return { rateIds: [] };
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { return { error: 'Rate collegate non valide' }; }
  }
  if (!Array.isArray(list)) return { error: 'Rate collegate non valide' };
  const rateIds = [...new Set(list.map(Number).filter(Boolean))];
  const trovata = db.prepare('SELECT id FROM preventivi_rate WHERE id = ?');
  if (rateIds.some(id => !trovata.get(id))) return { error: 'Una delle rate collegate non esiste più: ricarica la pagina' };
  return { rateIds };
};

// Senza fornitore indicato, la fattura prende quello del preventivo della prima rata.
const fornitoreDaRate = rateIds => rateIds.length
  ? db.prepare('SELECT p.fornitore_id FROM preventivi_rate r JOIN preventivi p ON p.id = r.preventivo_id WHERE r.id = ?').get(rateIds[0])?.fornitore_id ?? null
  : null;

const campiFattura = body => ({
  numero_fattura: body.numero_fattura?.trim() || null,
  data_fattura: body.data_fattura || null,
  importo_fattura: parseFloat(body.importo_fattura) > 0 ? parseFloat(body.importo_fattura) : null,
});

const collegaRate = (documentoId, rateIds) => {
  db.prepare('DELETE FROM fatture_rate WHERE documento_id = ?').run(documentoId);
  const ins = db.prepare('INSERT INTO fatture_rate (documento_id, rata_id) VALUES (?, ?)');
  rateIds.forEach(id => ins.run(documentoId, id));
};

router.get('/', auth, (req, res) => {
  res.json(conRate(db.prepare('SELECT d.*, f.nome AS fornitore_nome FROM documenti d LEFT JOIN fornitori f ON f.id = d.fornitore_id ORDER BY d.created_at DESC').all()));
});

router.post('/', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File mancante' });
  const { titolo, categoria, note } = req.body;
  const { rateIds, error } = parseRateIds(req.body.rate_ids);
  if (error) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error });
  }
  const fornitore_id = req.body.fornitore_id || fornitoreDaRate(rateIds);
  const f = campiFattura(req.body);
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO documenti (titolo, categoria, nome_file, percorso_file, dimensione, fornitore_id, note, numero_fattura, data_fattura, importo_fattura) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(titolo, categoria || 'altro', req.file.originalname, req.file.filename, req.file.size, fornitore_id, note, f.numero_fattura, f.data_fattura, f.importo_fattura);
    collegaRate(r.lastInsertRowid, rateIds);
    return r.lastInsertRowid;
  })();
  res.json(getDocumento(id));
});

// Modifica i dati del documento (non il file): serve soprattutto a decidere in
// un secondo momento a quali rate corrisponde una fattura.
router.put('/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT id FROM documenti WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Documento non trovato' });
  const { titolo, categoria, note } = req.body;
  if (!titolo?.trim()) return res.status(400).json({ error: 'Il titolo è obbligatorio' });
  const { rateIds, error } = parseRateIds(req.body.rate_ids);
  if (error) return res.status(400).json({ error });
  const fornitore_id = req.body.fornitore_id || fornitoreDaRate(rateIds);
  const f = campiFattura(req.body);
  db.transaction(() => {
    db.prepare('UPDATE documenti SET titolo=?, categoria=?, fornitore_id=?, note=?, numero_fattura=?, data_fattura=?, importo_fattura=? WHERE id=?')
      .run(titolo.trim(), categoria || 'altro', fornitore_id, note || null, f.numero_fattura, f.data_fattura, f.importo_fattura, req.params.id);
    collegaRate(Number(req.params.id), rateIds);
  })();
  res.json(getDocumento(req.params.id));
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
