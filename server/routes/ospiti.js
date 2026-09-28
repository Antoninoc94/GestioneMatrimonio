const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Non `eta || null`: 0 è l'età valida di un neonato di pochi mesi.
const etaOrNull = v => { const n = parseInt(v); return Number.isNaN(n) ? null : n; };

const RSVP = ['attesa', 'confermato', 'declinato'];

const selectOne = db.prepare('SELECT o.*, t.nome as tavolo_nome FROM ospiti o LEFT JOIN tavoli t ON o.tavolo_id = t.id WHERE o.id = ?');

const inserisci = o => db.prepare(
  'INSERT INTO ospiti (nome, cognome, lato, tipo, rsvp, tavolo_id, email, telefono, intolleranze, note, parent_id, eta, relazione) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
).run(o.nome, o.cognome || null, o.lato || 'comune', o.tipo || 'adulto', o.rsvp || 'attesa',
  o.tavolo_id || null, o.email || null, o.telefono || null, o.intolleranze || null, o.note || null,
  o.parent_id || null, etaOrNull(o.eta), o.relazione || null).lastInsertRowid;

const aggiorna = (id, o) => db.prepare(
  'UPDATE ospiti SET nome=?, cognome=?, lato=?, tipo=?, rsvp=?, tavolo_id=?, email=?, telefono=?, intolleranze=?, note=?, parent_id=?, eta=?, messaggio_ospite=?, relazione=? WHERE id=?'
).run(o.nome, o.cognome || null, o.lato, o.tipo, o.rsvp, o.tavolo_id || null, o.email || null, o.telefono || null,
  o.intolleranze || null, o.note || null, o.parent_id || null, etaOrNull(o.eta), o.messaggio_ospite || null, o.relazione || null, id);

// Familiari e ospite principale vanno eliminati insieme: un'interruzione tra i
// due statement lascerebbe partner e figli in lista senza il loro invitato.
const eliminaConFamiliari = db.transaction(id => {
  db.prepare('DELETE FROM ospiti WHERE parent_id = ?').run(id);
  db.prepare('DELETE FROM ospiti WHERE id = ?').run(id);
});

router.get('/', auth, (req, res) => {
  const ospiti = db.prepare(`
    SELECT o.*, t.nome as tavolo_nome
    FROM ospiti o
    LEFT JOIN tavoli t ON o.tavolo_id = t.id
    ORDER BY o.cognome ASC, o.nome ASC
  `).all();
  res.json(ospiti);
});

router.post('/', auth, (req, res) => {
  res.json(selectOne.get(inserisci(req.body)));
});

router.put('/:id', auth, (req, res) => {
  aggiorna(req.params.id, req.body);
  res.json(selectOne.get(req.params.id));
});

// Il form della Lista Ospiti salva invitato, partner e figli insieme: con una
// richiesta per persona un errore a metà lasciava la famiglia salvata a pezzi.
// Dei familiari si scrivono solo i campi che il form gestisce: tavolo, email,
// telefono e note restano quelli che sono (prima il form li azzerava a ogni
// modifica dell'invitato, togliendo partner e figli dal loro tavolo).
const aggiornaFamiliare = db.prepare(`UPDATE ospiti SET nome=?, cognome=?, rsvp=?, intolleranze=?, lato=?, tipo=?, eta=?
  WHERE id=? AND parent_id=?`);

const salvaFamiglia = db.transaction((id, ospite, partner, figli) => {
  if (id) aggiorna(id, ospite);
  else id = inserisci(ospite);
  const familiari = [
    ...(partner ? [{ ...partner, relazione: 'partner', tipo: 'adulto', eta: null }] : []),
    ...figli.map(f => ({ ...f, relazione: 'figlio' })),
  ];
  for (const f of familiari) {
    if (f.id) {
      aggiornaFamiliare.run(f.nome.trim(), f.cognome || null, f.rsvp || 'attesa', f.intolleranze || null,
        ospite.lato || 'comune', f.tipo || 'adulto', etaOrNull(f.eta), f.id, id);
    } else {
      inserisci({ ...f, nome: f.nome.trim(), lato: ospite.lato, parent_id: id });
    }
  }
  return id;
});

router.post('/famiglia', auth, (req, res) => {
  const { id, ospite, partner, figli } = req.body;
  if (!ospite?.nome?.trim()) return res.status(400).json({ error: 'Il nome dell\'ospite è obbligatorio' });
  const figliValidi = (Array.isArray(figli) ? figli : []).filter(f => f.nome?.trim());
  const p = partner?.nome?.trim() ? partner : null;
  res.json(selectOne.get(salvaFamiglia(id || null, ospite, p, figliValidi)));
});

// Azioni sulla selezione multipla: una richiesta e una transazione, invece di
// una chiamata per ospite che a metà lascia la selezione modificata a pezzi.
const idsValidi = ids => Array.isArray(ids) && ids.length > 0 && ids.every(Number.isInteger);

router.post('/bulk/elimina', auth, (req, res) => {
  const { ids } = req.body;
  if (!idsValidi(ids)) return res.status(400).json({ error: 'Nessun ospite selezionato' });
  db.transaction(() => ids.forEach(id => eliminaConFamiliari(id)))();
  res.json({ ok: true });
});

// Cambia un solo campo (rsvp, tavolo_id oppure lo stato dell'invito) sugli
// ospiti indicati, senza riscrivere il resto della riga.
router.post('/bulk/aggiorna', auth, (req, res) => {
  const { ids, rsvp, tavolo_id, invito } = req.body;
  if (!idsValidi(ids)) return res.status(400).json({ error: 'Nessun ospite selezionato' });
  let stmt, valore;
  if ('rsvp' in req.body) {
    if (!RSVP.includes(rsvp)) return res.status(400).json({ error: 'Stato RSVP non valido' });
    stmt = db.prepare('UPDATE ospiti SET rsvp = ? WHERE id = ?');
    valore = rsvp;
  } else if ('tavolo_id' in req.body) {
    stmt = db.prepare('UPDATE ospiti SET tavolo_id = ? WHERE id = ?');
    valore = tavolo_id == null ? null : parseInt(tavolo_id);
    if (Number.isNaN(valore)) return res.status(400).json({ error: 'Tavolo non valido' });
  } else if (invito) {
    // `valore` è il canale, NULL quando si annulla. La data della prima
    // consegna resta: segnare di nuovo non la sposta.
    valore = invito.inviato ? (['whatsapp', 'manuale'].includes(invito.canale) ? invito.canale : 'manuale') : null;
    const s = db.prepare(`UPDATE ospiti SET invito_canale = ?,
      invito_inviato = CASE WHEN ? IS NULL THEN NULL ELSE COALESCE(invito_inviato, date('now', 'localtime')) END
      WHERE id = ?`);
    stmt = { run: (v, id) => s.run(v, v, id) };
  } else {
    return res.status(400).json({ error: 'Nessuna modifica indicata' });
  }
  db.transaction(() => ids.forEach(id => stmt.run(valore, id)))();
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  eliminaConFamiliari(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
