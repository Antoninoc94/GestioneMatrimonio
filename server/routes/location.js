const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const conFasce = l => ({
  ...l,
  fasce: db.prepare('SELECT * FROM location_fasce WHERE location_id = ? ORDER BY eta_da').all(l.id),
});

// Restituisce { fasce } oppure { error }; fasce === undefined significa
// "campo assente", cioè fasce da lasciare invariate.
const parseFasce = list => {
  if (list === undefined) return { fasce: undefined };
  if (!Array.isArray(list)) return { error: 'Fasce d\'età non valide' };
  const fasce = [];
  for (const f of list) {
    const eta_da = parseInt(f.eta_da);
    const eta_a = parseInt(f.eta_a);
    const valore = parseFloat(f.valore);
    if (!(eta_da >= 0) || !(eta_a >= eta_da)) return { error: 'In ogni fascia "da età" deve essere minore o uguale ad "a età"' };
    if (!(valore >= 0)) return { error: 'La tariffa di una fascia non può essere negativa' };
    fasce.push({ eta_da, eta_a, tipo: f.tipo === 'fisso' ? 'fisso' : 'percentuale', valore });
  }
  return { fasce };
};

const salvaFasce = (locationId, fasce) => {
  db.prepare('DELETE FROM location_fasce WHERE location_id = ?').run(locationId);
  const ins = db.prepare('INSERT INTO location_fasce (location_id, eta_da, eta_a, tipo, valore) VALUES (?,?,?,?,?)');
  fasce.forEach(f => ins.run(locationId, f.eta_da, f.eta_a, f.tipo, f.valore));
};

const prezzoFascia = (f, prezzoAdulto) => f.tipo === 'fisso' ? f.valore : prezzoAdulto * f.valore / 100;

// Costo stimato del ricevimento in una location per un gruppo di ospiti. Chi non
// rientra in nessuna fascia paga da adulto; un bambino senza età viene contato
// da adulto (stima prudente) e segnalato a parte.
const stima = (location, ospiti) => {
  const prezzo = location.prezzo_adulto || 0;
  const righe = location.fasce.map(f => ({ fascia: f, n: 0, prezzo_unitario: prezzoFascia(f, prezzo) }));
  let adulti = 0;
  let senzaEta = 0;
  for (const o of ospiti) {
    const bambino = o.tipo === 'bambino' || o.relazione === 'figlio';
    if (o.eta == null) {
      if (bambino) senzaEta++; else adulti++;
      continue;
    }
    const r = righe.find(r => o.eta >= r.fascia.eta_da && o.eta <= r.fascia.eta_a);
    if (r) r.n++; else adulti++;
  }
  const totaleBambini = righe.reduce((s, r) => s + r.n * r.prezzo_unitario, 0);
  const nBambini = righe.reduce((s, r) => s + r.n, 0);
  return {
    persone: ospiti.length,
    adulti,
    senza_eta: senzaEta,
    fasce: righe.map(r => ({ eta_da: r.fascia.eta_da, eta_a: r.fascia.eta_a, tipo: r.fascia.tipo, valore: r.fascia.valore, n: r.n, prezzo_unitario: r.prezzo_unitario, totale: r.n * r.prezzo_unitario })),
    totale_adulti: (adulti + senzaEta) * prezzo,
    totale_bambini: totaleBambini,
    bambini_come_adulti: nBambini * prezzo,
    totale: (adulti + senzaEta) * prezzo + totaleBambini,
  };
};

router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM location ORDER BY tipo, nome').all().map(conFasce));
});

// Stima per ogni location con un prezzo a persona: su tutti gli invitati (esclusi
// quelli che hanno declinato) e sui soli confermati.
router.get('/stime', auth, (req, res) => {
  const ospiti = db.prepare("SELECT eta, tipo, relazione, rsvp FROM ospiti WHERE rsvp != 'declinato'").all();
  const confermati = ospiti.filter(o => o.rsvp === 'confermato');
  const locations = db.prepare('SELECT * FROM location WHERE prezzo_adulto > 0 ORDER BY nome').all().map(conFasce);
  res.json(locations.map(l => ({
    location_id: l.id,
    nome: l.nome,
    prezzo_adulto: l.prezzo_adulto,
    invitati: stima(l, ospiti),
    confermati: stima(l, confermati),
  })));
});

router.post('/', auth, (req, res) => {
  const { tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato, note, prezzo_adulto } = req.body;
  const { fasce, error } = parseFasce(req.body.fasce);
  if (error) return res.status(400).json({ error });
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO location (tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato, note, prezzo_adulto) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato || 'in_valutazione', note, parseFloat(prezzo_adulto) || null);
    if (fasce) salvaFasce(r.lastInsertRowid, fasce);
    return r.lastInsertRowid;
  })();
  res.json(conFasce(db.prepare('SELECT * FROM location WHERE id = ?').get(id)));
});

router.put('/:id', auth, (req, res) => {
  const { tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato, note, prezzo_adulto } = req.body;
  const { fasce, error } = parseFasce(req.body.fasce);
  if (error) return res.status(400).json({ error });
  db.transaction(() => {
    db.prepare('UPDATE location SET tipo=?, nome=?, indirizzo=?, contatto=?, telefono=?, email=?, sito_web=?, capienza=?, costo=?, stato=?, note=?, prezzo_adulto=? WHERE id=?')
      .run(tipo, nome, indirizzo, contatto, telefono, email, sito_web, capienza, costo, stato, note, parseFloat(prezzo_adulto) || null, req.params.id);
    if (fasce) salvaFasce(Number(req.params.id), fasce);
  })();
  res.json(conFasce(db.prepare('SELECT * FROM location WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM location WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
