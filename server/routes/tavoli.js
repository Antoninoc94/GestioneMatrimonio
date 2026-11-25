const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { assicuraSposi } = require('../sposi');
const { postiEffettivi } = require('../posti');

const FORME = ['tondo', 'rettangolare'];
const TIPI = ['normale', 'sposi', 'bambini'];
// Dimensioni della pianta in unità SVG: il client disegna nello stesso sistema.
const PIANTA_W = 1200;
const PIANTA_H = 800;

const ORDINE = 'ORDER BY ordine IS NULL, ordine ASC, nome ASC';
const COLONNE_OSPITI = 'id, nome, cognome, tavolo_id, rsvp, tipo, parent_id, relazione, eta, intolleranze, sposo, posto';

// Il tavolo con i suoi ospiti, ognuno con la sedia su cui siede davvero
// (`posto`, scelta o automatica) e `posto_fisso` se l'hanno scelta gli sposi.
// `posti_scelti`: al tavolo c'è almeno una sedia scelta a mano.
function conOspiti(t, ospiti) {
  const posti = postiEffettivi(t, ospiti);
  return {
    ...t,
    posti_scelti: ospiti.some(o => o.posto != null),
    ospiti: ospiti.map(o => ({ ...o, posto: posti.get(o.id), posto_fisso: o.posto != null })),
  };
}

const ospitiDi = id => db.prepare(`SELECT ${COLONNE_OSPITI} FROM ospiti WHERE tavolo_id = ? ORDER BY cognome ASC, nome ASC`).all(id);

const coord = (v, max) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : null;
};

// Applica sopra `base` solo i campi presenti nel body e li valida: la pianta
// manda la sola rotazione, la gestione il solo nome, e il resto non va toccato.
function componi(base, body) {
  const t = { ...base };
  for (const k of ['nome', 'capienza', 'note', 'forma', 'tipo', 'rotazione']) {
    if (k in body) t[k] = body[k];
  }
  const nome = String(t.nome ?? '').trim();
  if (!nome) return { error: 'Il nome del tavolo è obbligatorio' };
  const capienza = parseInt(t.capienza);
  return {
    nome,
    capienza: Number.isInteger(capienza) && capienza >= 1 ? Math.min(capienza, 200) : 8,
    note: t.note ? String(t.note) : null,
    forma: FORME.includes(t.forma) ? t.forma : 'tondo',
    tipo: TIPI.includes(t.tipo) ? t.tipo : 'normale',
    rotazione: (((parseInt(t.rotazione) || 0) % 360) + 360) % 360,
  };
}

router.get('/', auth, (req, res) => {
  const tavoli = db.prepare(`SELECT * FROM tavoli ${ORDINE}`).all();
  const ospiti = db.prepare(`SELECT ${COLONNE_OSPITI} FROM ospiti ORDER BY cognome ASC, nome ASC`).all();
  res.json(tavoli.map(t => conOspiti(t, ospiti.filter(o => o.tavolo_id === t.id))));
});

router.post('/', auth, (req, res) => {
  const v = componi({}, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  // In coda: un tavolo nuovo non deve scavalcare l'ordine già scelto.
  const { prossimo } = db.prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS prossimo FROM tavoli').get();
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO tavoli (nome, capienza, note, forma, tipo, rotazione, ordine) VALUES (?,?,?,?,?,?,?)')
      .run(v.nome, v.capienza, v.note, v.forma, v.tipo, v.rotazione, prossimo);
    if (v.tipo === 'sposi') assicuraSposi(r.lastInsertRowid);
    return r.lastInsertRowid;
  })();
  const t = db.prepare('SELECT * FROM tavoli WHERE id = ?').get(id);
  res.json(conOspiti(t, ospitiDi(id)));
});

// Nuovo ordine dei tavoli: l'elenco completo degli id, nell'ordine voluto.
router.post('/ordine', auth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(Number.isInteger)) {
    return res.status(400).json({ error: 'Ordine non valido' });
  }
  const stmt = db.prepare('UPDATE tavoli SET ordine = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
  res.json({ ok: true });
});

// Posizioni sulla pianta, una o tante insieme ("disponi in griglia").
router.post('/posizioni', auth, (req, res) => {
  const { posizioni } = req.body;
  if (!Array.isArray(posizioni) || posizioni.length === 0 || !posizioni.every(p => Number.isInteger(p?.id))) {
    return res.status(400).json({ error: 'Posizioni non valide' });
  }
  const stmt = db.prepare('UPDATE tavoli SET pos_x = ?, pos_y = ? WHERE id = ?');
  db.transaction(() => posizioni.forEach(p => stmt.run(coord(p.x, PIANTA_W), coord(p.y, PIANTA_H), p.id)))();
  res.json({ ok: true });
});

router.put('/:id', auth, (req, res) => {
  const esistente = db.prepare('SELECT * FROM tavoli WHERE id = ?').get(req.params.id);
  if (!esistente) return res.status(404).json({ error: 'Tavolo non trovato' });
  const v = componi(esistente, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  db.transaction(() => {
    db.prepare('UPDATE tavoli SET nome=?, capienza=?, note=?, forma=?, tipo=?, rotazione=? WHERE id=?')
      .run(v.nome, v.capienza, v.note, v.forma, v.tipo, v.rotazione, req.params.id);
    // Solo quando diventa il tavolo sposi: risalvarlo non deve rimettere a
    // sedere chi gli sposi hanno tolto apposta.
    if (v.tipo === 'sposi' && esistente.tipo !== 'sposi') assicuraSposi(esistente.id);
    // Con meno posti, le sedie che non ci sono più tornano libere.
    db.prepare('UPDATE ospiti SET posto = NULL WHERE tavolo_id = ? AND posto >= ?').run(esistente.id, v.capienza);
  })();
  const t = db.prepare('SELECT * FROM tavoli WHERE id = ?').get(req.params.id);
  res.json(conOspiti(t, ospitiDi(t.id)));
});

// Le sedie di un tavolo, tutte insieme: { posti: [{ id, posto }] } con ogni
// ospite seduto lì (chi manca torna in automatico), oppure { automatico: true }
// per tornare alla disposizione automatica. Tutto o niente: due ospiti sulla
// stessa sedia per un salvataggio a metà sarebbero peggio di nessun cambio.
router.post('/:id/posti', auth, (req, res) => {
  const t = db.prepare('SELECT id, capienza FROM tavoli WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tavolo non trovato' });
  const seduti = new Set(db.prepare('SELECT id FROM ospiti WHERE tavolo_id = ?').all(t.id).map(o => o.id));
  const posti = req.body.automatico ? [] : req.body.posti;
  if (!Array.isArray(posti)) return res.status(400).json({ error: 'Posti non validi' });
  const usate = new Set();
  for (const p of posti) {
    if (!seduti.has(p?.id)) return res.status(400).json({ error: "Un ospite non è più seduto a questo tavolo: ricarica la pagina" });
    if (p.posto == null) continue;
    if (!Number.isInteger(p.posto) || p.posto < 0 || p.posto >= t.capienza || usate.has(p.posto)) {
      return res.status(400).json({ error: 'Sedia non valida o già occupata' });
    }
    usate.add(p.posto);
  }
  db.transaction(() => {
    db.prepare('UPDATE ospiti SET posto = NULL WHERE tavolo_id = ?').run(t.id);
    const stmt = db.prepare('UPDATE ospiti SET posto = ? WHERE id = ?');
    for (const p of posti) if (p.posto != null) stmt.run(p.posto, p.id);
  })();
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  db.transaction(() => {
    db.prepare('UPDATE ospiti SET tavolo_id = NULL WHERE tavolo_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tavoli WHERE id = ?').run(req.params.id);
  })();
  res.json({ ok: true });
});

module.exports = router;
