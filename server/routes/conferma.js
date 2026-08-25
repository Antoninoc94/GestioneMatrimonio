const router = require('express').Router();
const db = require('../db');

const checkAbilitata = (req, res, next) => {
  const cfg = db.prepare('SELECT conferma_abilitata FROM config LIMIT 1').get();
  if (cfg && cfg.conferma_abilitata === 0) {
    return res.status(403).json({ disabilitata: true, error: 'La pagina di conferma è momentaneamente disabilitata.' });
  }
  next();
};

// Info matrimonio (pubblica — sempre accessibile, serve per mostrare msg disabilitata)
router.get('/info', (req, res) => {
  const cfg = db.prepare('SELECT nome_sposo1, nome_sposo2, data_matrimonio, app_name, app_emoji, conferma_abilitata FROM config LIMIT 1').get();
  res.json(cfg || {});
});

// Trova ospite per nome + cognome esatti (case-insensitive, prova anche invertiti)
router.get('/trova', checkAbilitata, (req, res) => {
  const nome = (req.query.nome || '').trim();
  const cognome = (req.query.cognome || '').trim();
  if (!nome) return res.status(400).json({ error: 'Nome richiesto' });

  const candidati = db.prepare(`
    SELECT id, nome, cognome, rsvp, intolleranze, messaggio_ospite, parent_id
    FROM ospiti
    WHERE (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
       OR (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
  `).all(nome, cognome, cognome, nome);

  // Più invitati con lo stesso nome+cognome: non possiamo scegliere per loro,
  // altrimenti rischiamo di far confermare/declinare la presenza al posto sbagliato.
  if (candidati.length > 1) {
    return res.json({ trovato: false, ambiguo: true, nome, cognome, rsvp: 'attesa', intolleranze: '', partner: null, figli: [] });
  }

  const ospite = candidati[0];

  if (ospite) {
    // Se l'ospite trovato è un partner (ha parent_id), carica invece l'ospite principale
    let principale = ospite;
    if (ospite.parent_id) {
      const parent = db.prepare(`
        SELECT id, nome, cognome, rsvp, intolleranze, messaggio_ospite
        FROM ospiti WHERE id = ?
      `).get(ospite.parent_id);
      if (parent) principale = parent;
    }

    // Carica il partner collegato tramite parent_id
    const partner = db.prepare(`
      SELECT id, nome, cognome, intolleranze, rsvp FROM ospiti
      WHERE parent_id = ? AND relazione = 'partner'
      LIMIT 1
    `).get(principale.id);

    // Carica i figli (a prescindere dall'età) collegati tramite parent_id
    const figli = db.prepare(`
      SELECT id, nome, eta, intolleranze, rsvp FROM ospiti
      WHERE parent_id = ? AND relazione = 'figlio'
      ORDER BY id ASC
    `).all(principale.id);

    res.json({ trovato: true, ...principale, partner: partner || null, figli });
  } else {
    res.json({ trovato: false, nome, cognome, rsvp: 'attesa', intolleranze: '', partner: null, figli: [] });
  }
});

// Usato solo per il partner: la relazione è sempre 'partner', il tipo è sempre 'adulto'
// (un partner di età minore non rientra nella logica "figlio/bambino" del form pubblico).
function upsertPartner({ nome, cognome, rsvp, intolleranze, messaggio_ospite, parent_id }) {
  const candidati = db.prepare(`
    SELECT id FROM ospiti
    WHERE (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
       OR (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
  `).all(nome, cognome || '', cognome || '', nome);

  // Se il nome+cognome è ambiguo (più ospiti omonimi), non aggiorniamo un record
  // a caso: meglio creare un nuovo ospite piuttosto che rischiare di sovrascrivere
  // la risposta di qualcun altro.
  if (candidati.length === 1) {
    db.prepare('UPDATE ospiti SET rsvp=?, intolleranze=?, messaggio_ospite=?, parent_id=?, relazione=? WHERE id=?')
      .run(rsvp, intolleranze || null, messaggio_ospite || null, parent_id || null, 'partner', candidati[0].id);
  } else {
    db.prepare(`INSERT INTO ospiti (nome, cognome, rsvp, intolleranze, messaggio_ospite, tipo, fonte, parent_id, relazione)
                VALUES (?, ?, ?, ?, ?, 'adulto', 'sito', ?, 'partner')`)
      .run(nome, cognome || null, rsvp, intolleranze || null, messaggio_ospite || null, parent_id || null);
  }
}

// Invia risposta: ospite principale + partner opzionale + figli opzionali
router.post('/rispondi', checkAbilitata, (req, res) => {
  const { id, nome, cognome, rsvp, intolleranze, messaggio_ospite, partner, figli } = req.body;

  if (!['confermato', 'declinato', 'attesa'].includes(rsvp))
    return res.status(400).json({ error: 'Stato non valido' });

  // Ospite principale
  let mainId = id;
  if (id) {
    const ospite = db.prepare('SELECT id FROM ospiti WHERE id = ?').get(id);
    if (!ospite) return res.status(404).json({ error: 'Ospite non trovato' });
    db.prepare('UPDATE ospiti SET rsvp=?, intolleranze=?, messaggio_ospite=? WHERE id=?')
      .run(rsvp, intolleranze || null, messaggio_ospite || null, id);
  } else {
    const r = db.prepare(`INSERT INTO ospiti (nome, cognome, rsvp, intolleranze, messaggio_ospite, fonte)
                VALUES (?, ?, ?, ?, ?, 'sito')`)
      .run(nome, cognome || null, rsvp, intolleranze || null, messaggio_ospite || null);
    mainId = r.lastInsertRowid;
  }

  // Partner (opzionale)
  if (partner?.nome?.trim() && partner?.rsvp) {
    if (!['confermato', 'declinato'].includes(partner.rsvp))
      return res.status(400).json({ error: 'Stato partner non valido' });
    upsertPartner({ nome: partner.nome.trim(), cognome: partner.cognome?.trim() || '', rsvp: partner.rsvp, intolleranze: partner.intolleranze?.trim() || null, parent_id: mainId });
  }

  // Figli: cancella quelli esistenti e reinserisce dal form (evita duplicati alla ri-sottomissione).
  // Il tipo (adulto/bambino) si deduce dall'età rispetto alla soglia configurata — un figlio
  // maggiorenne non deve essere trattato come bambino nei conteggi/menu, ma resta comunque
  // un "figlio" a livello di parentela (relazione), a prescindere dall'età.
  if (Array.isArray(figli)) {
    const mainFonte = db.prepare('SELECT fonte FROM ospiti WHERE id = ?').get(mainId)?.fonte || 'sito';
    const soglia = db.prepare('SELECT soglia_eta_bambino FROM config LIMIT 1').get()?.soglia_eta_bambino || 12;
    db.prepare("DELETE FROM ospiti WHERE parent_id = ? AND relazione = 'figlio'").run(mainId);
    for (const f of figli) {
      if (!f.nome?.trim()) continue;
      const fRsvp = ['confermato', 'declinato'].includes(f.rsvp) ? f.rsvp : 'confermato';
      const fEta = parseInt(f.eta) || null;
      const fTipo = fEta != null && fEta >= soglia ? 'adulto' : 'bambino';
      db.prepare(`INSERT INTO ospiti (nome, rsvp, tipo, intolleranze, eta, fonte, parent_id, relazione)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'figlio')`)
        .run(f.nome.trim(), fRsvp, fTipo, f.intolleranze?.trim() || null, fEta, mainFonte, mainId);
    }
  }

  res.json({ ok: true });
});

module.exports = router;
