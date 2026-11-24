const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { assicuraSposi } = require('../sposi');

const FORME = ['tondo', 'rettangolare', 'elle'];
// Dove siedono gli ospiti nel tavolo a L: fuori dall'angolo, dentro, o ovunque.
const ELLE_POSTI = ['esterno', 'interno', 'entrambi'];
const TIPI = ['normale', 'sposi', 'bambini'];
// Dimensioni della pianta in unità SVG: il client disegna nello stesso sistema.
const PIANTA_W = 1200;
const PIANTA_H = 800;

const ORDINE = 'ORDER BY ordine IS NULL, ordine ASC, nome ASC';
const COLONNE_OSPITI = 'id, nome, cognome, tavolo_id, rsvp, tipo, parent_id, relazione, eta, intolleranze, sposo';

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
  for (const k of ['nome', 'descrizione', 'capienza', 'note', 'forma', 'tipo', 'rotazione', 'elle_posti']) {
    if (k in body) t[k] = body[k];
  }
  const nome = String(t.nome ?? '').trim();
  if (!nome) return { error: 'Il nome del tavolo è obbligatorio' };
  const capienza = parseInt(t.capienza);
  return {
    nome,
    capienza: Number.isInteger(capienza) && capienza >= 1 ? Math.min(capienza, 200) : 8,
    descrizione: t.descrizione ? String(t.descrizione).trim().slice(0, 120) || null : null,
    note: t.note ? String(t.note) : null,
    forma: FORME.includes(t.forma) ? t.forma : 'tondo',
    tipo: TIPI.includes(t.tipo) ? t.tipo : 'normale',
    rotazione: (((parseInt(t.rotazione) || 0) % 360) + 360) % 360,
    elle_posti: ELLE_POSTI.includes(t.elle_posti) ? t.elle_posti : 'entrambi',
  };
}

// ── Preset: disposizioni salvate ────────────────────────────────────────────
// Un preset fotografa i tavoli e chi siede dove. Gli ospiti sono salvati per
// id: se nel frattempo uno è stato eliminato, applicando si salta e lo si dice.
const COLONNE_TAVOLO = 'nome, descrizione, capienza, note, forma, tipo, rotazione, elle_posti, pos_x, pos_y';

function fotografia() {
  const tavoli = db.prepare(`SELECT id, ${COLONNE_TAVOLO} FROM tavoli ${ORDINE}`).all();
  const seduti = db.prepare('SELECT id, tavolo_id FROM ospiti WHERE tavolo_id IS NOT NULL').all();
  return {
    tavoli: tavoli.map(({ id, ...t }) => ({ ...t, ospiti: seduti.filter(o => o.tavolo_id === id).map(o => o.id) })),
  };
}

const riepilogo = r => {
  let dati = { tavoli: [] };
  try { dati = JSON.parse(r.dati); } catch { /* preset illeggibile: appare vuoto */ }
  const tavoli = Array.isArray(dati.tavoli) ? dati.tavoli : [];
  return {
    id: r.id,
    nome: r.nome,
    auto: !!r.auto,
    // Il minimo per disegnare una miniatura della sala.
    anteprima: tavoli.map(t => ({
      forma: t.forma, tipo: t.tipo, rotazione: t.rotazione, elle_posti: t.elle_posti,
      capienza: t.capienza, pos_x: t.pos_x, pos_y: t.pos_y,
    })),
    created_at: r.created_at,
    updated_at: r.updated_at,
    n_tavoli: tavoli.length,
    posti: tavoli.reduce((s, t) => s + (t.capienza || 0), 0),
    n_ospiti: tavoli.reduce((s, t) => s + (t.ospiti?.length || 0), 0),
  };
};

const nomePreset = v => String(v ?? '').trim().slice(0, 80);
const nomeUsato = (nome, tranne) =>
  db.prepare('SELECT 1 FROM tavoli_preset WHERE nome = ? COLLATE NOCASE AND id IS NOT ?').get(nome, tranne ?? null);

router.get('/preset', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM tavoli_preset ORDER BY auto DESC, updated_at DESC, id DESC').all().map(riepilogo));
});

router.post('/preset', auth, (req, res) => {
  const nome = nomePreset(req.body.nome);
  if (!nome) return res.status(400).json({ error: 'Dai un nome al preset' });
  if (nomeUsato(nome)) return res.status(400).json({ error: 'Esiste già un preset con questo nome' });
  const r = db.prepare('INSERT INTO tavoli_preset (nome, dati) VALUES (?, ?)').run(nome, JSON.stringify(fotografia()));
  res.json(riepilogo(db.prepare('SELECT * FROM tavoli_preset WHERE id = ?').get(r.lastInsertRowid)));
});

router.put('/preset/:id', auth, (req, res) => {
  const nome = nomePreset(req.body.nome);
  if (!nome) return res.status(400).json({ error: 'Dai un nome al preset' });
  if (nomeUsato(nome, Number(req.params.id))) return res.status(400).json({ error: 'Esiste già un preset con questo nome' });
  const r = db.prepare("UPDATE tavoli_preset SET nome = ?, updated_at = datetime('now') WHERE id = ?").run(nome, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Preset non trovato' });
  res.json({ ok: true });
});

// Sovrascrive il preset con i tavoli di adesso.
router.post('/preset/:id/aggiorna', auth, (req, res) => {
  const r = db.prepare("UPDATE tavoli_preset SET dati = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(fotografia()), req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Preset non trovato' });
  res.json(riepilogo(db.prepare('SELECT * FROM tavoli_preset WHERE id = ?').get(req.params.id)));
});

router.delete('/preset/:id', auth, (req, res) => {
  db.prepare('DELETE FROM tavoli_preset WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Sostituisce i tavoli attuali con quelli del preset, tutto o niente: a metà
// strada gli ospiti resterebbero senza tavolo e la sala vuota.
router.post('/preset/:id/applica', auth, (req, res) => {
  const riga = db.prepare('SELECT * FROM tavoli_preset WHERE id = ?').get(req.params.id);
  if (!riga) return res.status(404).json({ error: 'Preset non trovato' });
  let dati;
  try { dati = JSON.parse(riga.dati); } catch { return res.status(400).json({ error: 'Il preset è danneggiato' }); }
  if (!Array.isArray(dati.tavoli)) return res.status(400).json({ error: 'Il preset è danneggiato' });

  const esistenti = new Set(db.prepare('SELECT id FROM ospiti').all().map(o => o.id));
  let saltati = 0;
  let salvato = null;
  db.transaction(() => {
    // Rete di sicurezza: la disposizione di adesso resta recuperabile. Se ne
    // tiene una sola, quella dell'ultima applicazione.
    if (db.prepare('SELECT 1 FROM tavoli LIMIT 1').get()) {
      db.prepare('DELETE FROM tavoli_preset WHERE auto = 1').run();
      salvato = riga.auto ? 'Disposizione precedente' : `Prima di «${riga.nome}»`.slice(0, 80);
      db.prepare('INSERT INTO tavoli_preset (nome, dati, auto) VALUES (?, ?, 1)').run(salvato, JSON.stringify(fotografia()));
    }
    db.prepare('UPDATE ospiti SET tavolo_id = NULL WHERE tavolo_id IS NOT NULL').run();
    db.prepare('DELETE FROM tavoli').run();
    const ins = db.prepare(`INSERT INTO tavoli (nome, descrizione, capienza, note, forma, tipo, rotazione, elle_posti, pos_x, pos_y, ordine)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const siede = db.prepare('UPDATE ospiti SET tavolo_id = ? WHERE id = ?');
    let tavoloSposi = null;
    dati.tavoli.forEach((t, i) => {
      const v = componi({}, t);
      const id = ins.run(v.nome, v.descrizione, v.capienza, v.note, v.forma, v.tipo, v.rotazione, v.elle_posti,
        coord(t.pos_x, PIANTA_W), coord(t.pos_y, PIANTA_H), i).lastInsertRowid;
      if (v.tipo === 'sposi' && tavoloSposi === null) tavoloSposi = id;
      for (const oid of Array.isArray(t.ospiti) ? t.ospiti : []) {
        if (esistenti.has(oid)) siede.run(id, oid); else saltati++;
      }
    });
    // Come alla creazione del tavolo sposi: se gli sposi non sono seduti da
    // nessuna parte nel preset, tornano al loro tavolo.
    if (tavoloSposi !== null) assicuraSposi(tavoloSposi);
  })();
  res.json({ ok: true, saltati, salvato });
});

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
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO tavoli (nome, descrizione, capienza, note, forma, tipo, rotazione, elle_posti, ordine) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(v.nome, v.descrizione, v.capienza, v.note, v.forma, v.tipo, v.rotazione, v.elle_posti, prossimo);
    if (v.tipo === 'sposi') assicuraSposi(r.lastInsertRowid);
    return r.lastInsertRowid;
  })();
  const t = db.prepare('SELECT * FROM tavoli WHERE id = ?').get(id);
  res.json({ ...t, ospiti: ospitiDi(id) });
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
    db.prepare('UPDATE tavoli SET nome=?, descrizione=?, capienza=?, note=?, forma=?, tipo=?, rotazione=?, elle_posti=? WHERE id=?')
      .run(v.nome, v.descrizione, v.capienza, v.note, v.forma, v.tipo, v.rotazione, v.elle_posti, req.params.id);
    // Solo quando diventa il tavolo sposi: risalvarlo non deve rimettere a
    // sedere chi gli sposi hanno tolto apposta.
    if (v.tipo === 'sposi' && esistente.tipo !== 'sposi') assicuraSposi(esistente.id);
  })();
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
