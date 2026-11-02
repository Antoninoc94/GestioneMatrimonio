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

// Il preventivo arriva come multipart (per l'allegato), quindi le rate viaggiano
// come stringa JSON. Restituisce { rate } oppure { error }; rate === undefined
// significa "campo assente", cioè rate da lasciare invariate.
const parseRate = raw => {
  if (raw === undefined) return { rate: undefined };
  let list;
  try { list = JSON.parse(raw || '[]'); } catch { return { error: 'Piano di pagamento non valido' }; }
  if (!Array.isArray(list)) return { error: 'Piano di pagamento non valido' };
  const oggi = new Date().toISOString().split('T')[0];
  const rate = [];
  for (const r of list) {
    const importo = parseFloat(r.importo);
    if (!(importo > 0)) return { error: 'Ogni rata deve avere un importo maggiore di zero' };
    const pagata = r.pagata ? 1 : 0;
    rate.push({
      id: parseInt(r.id) || null,
      descrizione: r.descrizione?.trim() || null,
      importo,
      data_scadenza: r.data_scadenza || null,
      pagata,
      data_pagamento: pagata ? (r.data_pagamento || oggi) : null,
    });
  }
  return { rate };
};

// Allinea le rate del preventivo alla lista ricevuta: aggiorna quelle con id,
// inserisce le nuove, elimina quelle sparite. Va chiamata dentro una transazione.
const salvaRate = (preventivoId, rate) => {
  const esistenti = db.prepare('SELECT id FROM preventivi_rate WHERE preventivo_id = ?').all(preventivoId).map(r => r.id);
  const tenute = new Set();
  const upd = db.prepare('UPDATE preventivi_rate SET descrizione=?, importo=?, data_scadenza=?, pagata=?, data_pagamento=?, ordine=? WHERE id=? AND preventivo_id=?');
  const ins = db.prepare('INSERT INTO preventivi_rate (preventivo_id, descrizione, importo, data_scadenza, pagata, data_pagamento, ordine) VALUES (?,?,?,?,?,?,?)');
  rate.forEach((r, i) => {
    if (r.id && esistenti.includes(r.id)) {
      upd.run(r.descrizione, r.importo, r.data_scadenza, r.pagata, r.data_pagamento, i, r.id, preventivoId);
      tenute.add(r.id);
    } else {
      ins.run(preventivoId, r.descrizione, r.importo, r.data_scadenza, r.pagata, r.data_pagamento, i);
    }
  });
  const del = db.prepare('DELETE FROM preventivi_rate WHERE id = ?');
  esistenti.filter(id => !tenute.has(id)).forEach(id => del.run(id));
};

const SELECT_PREVENTIVO = `
  SELECT p.*, l.nome AS location_nome
  FROM preventivi p LEFT JOIN location l ON l.id = p.location_id
`;

const conRate = p => {
  // Fatture collegate alle rate (vedi fatture_rate): una fattura che copre più
  // rate compare su ognuna, ma nel fatturato del preventivo conta una volta sola.
  const fatture = db.prepare(`
    SELECT fr.rata_id, d.id, d.titolo, d.nome_file, d.numero_fattura, d.data_fattura, d.importo_fattura
    FROM fatture_rate fr
    JOIN documenti d ON d.id = fr.documento_id
    JOIN preventivi_rate r ON r.id = fr.rata_id
    WHERE r.preventivo_id = ? ORDER BY d.data_fattura, d.id
  `).all(p.id);
  const rate = db.prepare('SELECT * FROM preventivi_rate WHERE preventivo_id = ? ORDER BY ordine, id').all(p.id)
    .map(r => ({ ...r, fatture: fatture.filter(f => f.rata_id === r.id) }));
  const pagato = rate.filter(r => r.pagata).reduce((s, r) => s + r.importo, 0);
  const fatturato = [...new Map(fatture.map(f => [f.id, f.importo_fattura || 0])).values()].reduce((s, n) => s + n, 0);
  return { ...p, rate, totale_pagato: pagato, residuo: p.importo - pagato, totale_fatturato: fatturato, n_fatture: new Set(fatture.map(f => f.id)).size };
};

const getPreventivo = id => {
  const p = db.prepare(`${SELECT_PREVENTIVO} WHERE p.id = ?`).get(id);
  return p ? conRate(p) : null;
};

router.get('/', auth, (req, res) => {
  res.json(db.prepare(`${SELECT_PREVENTIVO} ORDER BY p.created_at DESC`).all().map(conRate));
});

router.post('/', auth, upload.single('allegato'), (req, res) => {
  const { fornitore_id, fornitore_nome, location_id, categoria, descrizione, importo, stato, data_scadenza, note } = req.body;
  const { rate, error } = parseRate(req.body.rate);
  if (error) {
    deleteFile(req.file?.filename);
    return res.status(400).json({ error });
  }
  const file = req.file ? { nome_file: req.file.originalname, percorso_file: req.file.filename, dimensione_file: req.file.size } : { nome_file: null, percorso_file: null, dimensione_file: null };
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO preventivi (fornitore_id, fornitore_nome, location_id, categoria, descrizione, importo, stato, data_scadenza, note, nome_file, percorso_file, dimensione_file) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(fornitore_id || null, fornitore_nome, location_id || null, categoria, descrizione, parseFloat(importo), stato || 'in_attesa', data_scadenza, note, file.nome_file, file.percorso_file, file.dimensione_file);
    if (rate) salvaRate(r.lastInsertRowid, rate);
    return r.lastInsertRowid;
  })();
  res.json(getPreventivo(id));
});

router.put('/:id', auth, upload.single('allegato'), (req, res) => {
  const { fornitore_id, fornitore_nome, location_id, categoria, descrizione, importo, stato, data_scadenza, note, rimuovi_allegato } = req.body;
  const { rate, error } = parseRate(req.body.rate);
  if (error) {
    deleteFile(req.file?.filename);
    return res.status(400).json({ error });
  }
  // dimensione_file va riletta insieme alle altre: se manca dalla SELECT, il ramo
  // "allegato invariato" la riscrive come NULL a ogni modifica del preventivo.
  const existing = db.prepare('SELECT nome_file, percorso_file, dimensione_file FROM preventivi WHERE id = ?').get(req.params.id);

  let file = { nome_file: existing?.nome_file, percorso_file: existing?.percorso_file, dimensione_file: existing?.dimensione_file };
  if (req.file) {
    deleteFile(existing?.percorso_file);
    file = { nome_file: req.file.originalname, percorso_file: req.file.filename, dimensione_file: req.file.size };
  } else if (rimuovi_allegato === 'true') {
    deleteFile(existing?.percorso_file);
    file = { nome_file: null, percorso_file: null, dimensione_file: null };
  }

  db.transaction(() => {
    db.prepare('UPDATE preventivi SET fornitore_id=?, fornitore_nome=?, location_id=?, categoria=?, descrizione=?, importo=?, stato=?, data_scadenza=?, note=?, nome_file=?, percorso_file=?, dimensione_file=? WHERE id=?')
      .run(fornitore_id || null, fornitore_nome, location_id || null, categoria, descrizione, parseFloat(importo), stato, data_scadenza, note, file.nome_file, file.percorso_file, file.dimensione_file, req.params.id);
    if (rate) salvaRate(Number(req.params.id), rate);
  })();
  res.json(getPreventivo(req.params.id));
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
