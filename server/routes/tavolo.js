// Pagina pubblica "Trova il tuo tavolo": l'invitato inquadra il QR all'ingresso
// della sala, scrive il suo nome e vede il tavolo sulla pianta.
// Nessun token: è per gli ospiti, non per gli sposi. Per questo è spenta finché
// non la si accende (config.tavolo_pubblico_abilitato) ed espone il minimo: nome
// e tavolo di chi ha un posto, e la sola geometria dei tavoli. Niente rsvp,
// intolleranze, note o recapiti.
const router = require('express').Router();
const db = require('../db');

const abilitata = () => db.prepare('SELECT tavolo_pubblico_abilitato FROM config LIMIT 1').get()?.tavolo_pubblico_abilitato === 1;

const checkAbilitata = (req, res, next) => {
  if (!abilitata()) return res.status(403).json({ disabilitata: true, error: 'La ricerca del tavolo non è ancora attiva.' });
  next();
};

// Minuscole e senza accenti: chi scrive "nicolo" deve trovare "Nicolò".
const semplifica = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const parole = s => semplifica(s).split(/[\s'’-]+/).filter(Boolean);

const MAX_RISULTATI = 8;

router.get('/info', (req, res) => {
  const cfg = db.prepare('SELECT nome_sposo1, nome_sposo2, data_matrimonio, landing_tema FROM config LIMIT 1').get() || {};
  res.json({ ...cfg, abilitata: abilitata() ? 1 : 0 });
});

// Ogni parola scritta deve essere l'inizio di una parola del nome o del
// cognome, in qualsiasi ordine: "ros mar" trova "Mario Rossi". Almeno due
// lettere, e un tetto ai risultati, perché la ricerca non diventi un modo
// comodo per scorrere l'intera lista degli invitati.
router.get('/cerca', checkAbilitata, (req, res) => {
  const cercate = parole(req.query.q);
  if (cercate.join('').length < 2) return res.json({ risultati: [], altri: false });

  // Gli sposi no: sanno dove siedono. Chi ha declinato non ha un posto anche
  // se fosse rimasto assegnato per sbaglio.
  const seduti = db.prepare(`
    SELECT o.id, o.nome, o.cognome, t.id AS tavolo_id, t.nome AS tavolo_nome
    FROM ospiti o JOIN tavoli t ON t.id = o.tavolo_id
    WHERE o.sposo IS NULL AND COALESCE(o.rsvp, '') != 'declinato'
    ORDER BY o.cognome ASC, o.nome ASC
  `).all();

  const trovati = seduti.filter(o => {
    const sue = [...parole(o.nome), ...parole(o.cognome)];
    return cercate.every(c => sue.some(p => p.startsWith(c)));
  });

  res.json({
    risultati: trovati.slice(0, MAX_RISULTATI).map(o => ({
      id: o.id, nome: o.nome, cognome: o.cognome || '', tavolo: { id: o.tavolo_id, nome: o.tavolo_nome },
    })),
    altri: trovati.length > MAX_RISULTATI,
  });
});

// La pianta: solo la geometria, nessun ospite.
router.get('/pianta', checkAbilitata, (req, res) => {
  const tavoli = db.prepare(`
    SELECT id, nome, forma, tipo, capienza, rotazione, pos_x, pos_y
    FROM tavoli ORDER BY ordine IS NULL, ordine ASC, nome ASC
  `).all();
  res.json(tavoli);
});

module.exports = router;
