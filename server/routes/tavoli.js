const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const FORME = ['tondo', 'rettangolare'];
const TIPI = ['normale', 'sposi', 'bambini'];
// Dimensioni della pianta in unità SVG: il client disegna nello stesso sistema.
const PIANTA_W = 1200;
const PIANTA_H = 800;

const ORDINE = 'ORDER BY ordine IS NULL, ordine ASC, nome ASC';
const COLONNE_OSPITI = 'id, nome, cognome, tavolo_id, rsvp, tipo, parent_id, relazione, eta, intolleranze';

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
  res.json(tavoli.map(t => ({
    ...t,
    ospiti: ospiti.filter(o => o.tavolo_id === t.id),
  })));
});

router.post('/', auth, (req, res) => {
  const v = componi({}, req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  // In coda: un tavolo nuovo non deve scavalcare l'ordine già scelto.
  const { prossimo } = db.prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS prossimo FROM tavoli').get();
  const r = db.prepare('INSERT INTO tavoli (nome, capienza, note, forma, tipo, rotazione, ordine) VALUES (?,?,?,?,?,?,?)')
    .run(v.nome, v.capienza, v.note, v.forma, v.tipo, v.rotazione, prossimo);
  const t = db.prepare('SELECT * FROM tavoli WHERE id = ?').get(r.lastInsertRowid);
  res.json({ ...t, ospiti: [] });
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
  db.prepare('UPDATE tavoli SET nome=?, capienza=?, note=?, forma=?, tipo=?, rotazione=? WHERE id=?')
    .run(v.nome, v.capienza, v.note, v.forma, v.tipo, v.rotazione, req.params.id);
  const t = db.prepare('SELECT * FROM tavoli WHERE id = ?').get(req.params.id);
  res.json({ ...t, ospiti: ospitiDi(t.id) });
});

router.delete('/:id', auth, (req, res) => {
  db.transaction(() => {
    db.prepare('UPDATE ospiti SET tavolo_id = NULL WHERE tavolo_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tavoli WHERE id = ?').run(req.params.id);
  })();
  res.json({ ok: true });
});

module.exports = router;
