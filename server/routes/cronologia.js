const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { eventi, evento, ORA, minuti, ora, chiave, bozza } = require('../cronologia');

const TIPI = ['cerimonia', 'ricevimento', 'foto', 'viaggio', 'preparativi', 'altro'];

// Valida il body e risolve il luogo: con una location collegata il testo
// libero non serve (nome e indirizzo arrivano dalla location).
function campi(b) {
  const o = String(b.ora ?? '').slice(0, 5);
  if (!ORA.test(o)) return { error: 'Ora non valida' };
  const titolo = String(b.titolo ?? '').trim();
  if (!titolo) return { error: 'Il titolo è obbligatorio' };
  let locationId = b.location_id ? parseInt(b.location_id) : null;
  if (locationId && !db.prepare('SELECT 1 FROM location WHERE id = ?').get(locationId)) {
    return { error: 'Location non trovata' };
  }
  const durata = parseInt(b.durata);
  return {
    ora: o,
    titolo,
    descrizione: b.descrizione?.trim() || null,
    luogo: locationId ? null : (b.luogo?.trim() || null),
    location_id: locationId,
    durata: Number.isInteger(durata) && durata > 0 ? Math.min(durata, 1440) : null,
    tipo: TIPI.includes(b.tipo) ? b.tipo : 'altro',
    pubblico: b.pubblico === 0 || b.pubblico === false ? 0 : 1,
  };
}

const INSERT = `INSERT INTO cronologia (ora, titolo, descrizione, luogo, location_id, durata, tipo, pubblico)
                VALUES (@ora, @titolo, @descrizione, @luogo, @location_id, @durata, @tipo, @pubblico)`;

router.get('/', auth, (req, res) => {
  res.json(eventi());
});

router.post('/', auth, (req, res) => {
  const v = campi(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const r = db.prepare(INSERT).run(v);
  res.json(evento(r.lastInsertRowid));
});

// Crea la giornata tipo a partire dall'ora della cerimonia e dalle location
// confermate. Si aggiunge a quello che c'è, non lo sostituisce.
router.post('/bozza', auth, (req, res) => {
  const oraCerimonia = String(req.body.ora_cerimonia ?? '').slice(0, 5);
  if (!ORA.test(oraCerimonia)) return res.status(400).json({ error: 'Ora della cerimonia non valida' });
  if (minuti(oraCerimonia) < minuti('08:30') || minuti(oraCerimonia) > minuti('18:30')) {
    return res.status(400).json({ error: 'La bozza funziona con una cerimonia tra le 8:30 e le 18:30' });
  }
  const spostamento = parseInt(req.body.spostamento);
  if (!Number.isInteger(spostamento) || spostamento < 0 || spostamento > 240) {
    return res.status(400).json({ error: 'Tempo di spostamento non valido (0-240 minuti)' });
  }
  const stmt = db.prepare(INSERT);
  db.transaction(() => {
    for (const e of bozza({ oraCerimonia, spostamento })) {
      stmt.run({ descrizione: null, luogo: null, location_id: null, durata: null, ...e });
    }
  })();
  res.json(eventi());
});

// Sposta di N minuti un evento e tutti quelli che vengono dopo: se la
// cerimonia slitta di un quarto d'ora, slitta anche il resto della giornata.
router.post('/sposta', auth, (req, res) => {
  const da = evento(parseInt(req.body.da));
  if (!da) return res.status(404).json({ error: 'Evento non trovato' });
  const delta = parseInt(req.body.minuti);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 720) {
    return res.status(400).json({ error: 'Minuti non validi' });
  }
  const dopo = eventi().filter(e => chiave(e.ora) >= chiave(da.ora));
  const stmt = db.prepare('UPDATE cronologia SET ora = ? WHERE id = ?');
  db.transaction(() => dopo.forEach(e => stmt.run(ora(minuti(e.ora) + delta), e.id)))();
  res.json(eventi());
});

router.put('/:id', auth, (req, res) => {
  if (!evento(req.params.id)) return res.status(404).json({ error: 'Evento non trovato' });
  const v = campi(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  db.prepare(`UPDATE cronologia SET ora=@ora, titolo=@titolo, descrizione=@descrizione, luogo=@luogo,
              location_id=@location_id, durata=@durata, tipo=@tipo, pubblico=@pubblico WHERE id=@id`)
    .run({ ...v, id: req.params.id });
  res.json(evento(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM cronologia WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
