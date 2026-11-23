const router = require('express').Router();
const db = require('../db');
const { sendRsvpNotifica } = require('../email');

// La data di chiusura vale in ora italiana: il container gira in UTC, e a
// mezzanotte e mezza del giorno dopo le conferme devono essere già chiuse.
// Se il runtime non conoscesse il fuso, meglio la data UTC che un 500 su /conferma.
const oggiItalia = () => {
  try {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

// Chiusa a mano (interruttore in Impostazioni) oppure passato l'ultimo giorno utile.
const statoConferma = () => {
  const cfg = db.prepare('SELECT conferma_abilitata, conferma_scadenza FROM config LIMIT 1').get();
  if (cfg?.conferma_abilitata === 0) return { aperta: false };
  if (cfg?.conferma_scadenza && oggiItalia() > cfg.conferma_scadenza) return { aperta: false, scaduta: cfg.conferma_scadenza };
  return { aperta: true };
};

const checkAbilitata = (req, res, next) => {
  const stato = statoConferma();
  if (!stato.aperta) {
    return res.status(403).json({ disabilitata: true, scaduta: stato.scaduta || null, error: 'La pagina di conferma è chiusa.' });
  }
  next();
};

// Info matrimonio (pubblica — sempre accessibile, serve per mostrare msg disabilitata)
router.get('/info', (req, res) => {
  const cfg = db.prepare('SELECT nome_sposo1, nome_sposo2, data_matrimonio, app_name, app_emoji, conferma_scadenza FROM config LIMIT 1').get();
  const stato = statoConferma();
  res.json({ ...cfg, conferma_abilitata: stato.aperta ? 1 : 0, scaduta: stato.scaduta || null });
});

// Trova ospite per nome + cognome esatti (case-insensitive, prova anche invertiti)
router.get('/trova', checkAbilitata, (req, res) => {
  const nome = (req.query.nome || '').trim();
  const cognome = (req.query.cognome || '').trim();
  if (!nome) return res.status(400).json({ error: 'Nome richiesto' });

  const candidati = db.prepare(`
    SELECT id, nome, cognome, rsvp, intolleranze, messaggio_ospite, parent_id
    FROM ospiti
    WHERE sposo IS NULL AND (
          (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
       OR (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?)))
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
    WHERE sposo IS NULL AND (
          (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
       OR (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?)))
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

  // Validazioni prima della transazione: dentro non si può rispondere al client
  // e uscire a metà, andrebbe in rollback un lavoro già iniziato.
  const conPartner = !!(partner?.nome?.trim() && partner?.rsvp);
  if (conPartner && !['confermato', 'declinato'].includes(partner.rsvp))
    return res.status(400).json({ error: 'Stato partner non valido' });

  if (id && !db.prepare('SELECT id FROM ospiti WHERE id = ? AND sposo IS NULL').get(id))
    return res.status(404).json({ error: 'Ospite non trovato' });

  // Ospite principale, partner e figli si salvano tutti o nessuno: un errore a
  // metà lascerebbe la famiglia con una risposta registrata solo in parte.
  const salvaRisposta = db.transaction(() => {
    // Ospite principale
    let mainId = id;
    if (id) {
      db.prepare('UPDATE ospiti SET rsvp=?, intolleranze=?, messaggio_ospite=? WHERE id=?')
        .run(rsvp, intolleranze || null, messaggio_ospite || null, id);
    } else {
      const r = db.prepare(`INSERT INTO ospiti (nome, cognome, rsvp, intolleranze, messaggio_ospite, fonte)
                  VALUES (?, ?, ?, ?, ?, 'sito')`)
        .run(nome, cognome || null, rsvp, intolleranze || null, messaggio_ospite || null);
      mainId = r.lastInsertRowid;
    }

    // Partner (opzionale)
    if (conPartner) {
      upsertPartner({ nome: partner.nome.trim(), cognome: partner.cognome?.trim() || '', rsvp: partner.rsvp, intolleranze: partner.intolleranze?.trim() || null, parent_id: mainId });
    }

    // Figli. Il tipo (adulto/bambino) si deduce dall'età rispetto alla soglia configurata — un figlio
    // maggiorenne non deve essere trattato come bambino nei conteggi/menu, ma resta comunque
    // un "figlio" a livello di parentela (relazione), a prescindere dall'età.
    //
    // I figli già in lista si aggiornano, non si cancellano e ricreano: la riga
    // porta tavolo, cognome, lato e note che il form pubblico non conosce, e
    // ricrearla li azzerava (bambini tolti dal tavolo a ogni risposta). Si
    // riconoscono dall'id rimandato dal form o, in mancanza, dal nome; quelli
    // tolti dal form si eliminano, quelli nuovi si inseriscono.
    if (Array.isArray(figli)) {
      const main = db.prepare('SELECT fonte, lato FROM ospiti WHERE id = ?').get(mainId);
      const soglia = db.prepare('SELECT soglia_eta_bambino FROM config LIMIT 1').get()?.soglia_eta_bambino || 12;
      const liberi = new Map(db.prepare("SELECT id, nome FROM ospiti WHERE parent_id = ? AND relazione = 'figlio'")
        .all(mainId).map(e => [e.id, e]));
      const trova = f => {
        const id = parseInt(f.id);
        if (liberi.has(id)) return liberi.get(id);
        const nome = f.nome.trim().toLowerCase();
        return [...liberi.values()].find(e => (e.nome || '').trim().toLowerCase() === nome);
      };
      for (const f of figli) {
        if (!f.nome?.trim()) continue;
        const fRsvp = ['confermato', 'declinato'].includes(f.rsvp) ? f.rsvp : 'confermato';
        // Non `|| null`: 0 è l'età valida di un neonato.
        const fEta = Number.isNaN(parseInt(f.eta)) ? null : parseInt(f.eta);
        const fTipo = fEta != null && fEta >= soglia ? 'adulto' : 'bambino';
        const esistente = trova(f);
        if (esistente) {
          liberi.delete(esistente.id);
          db.prepare('UPDATE ospiti SET nome = ?, rsvp = ?, tipo = ?, intolleranze = ?, eta = ? WHERE id = ?')
            .run(f.nome.trim(), fRsvp, fTipo, f.intolleranze?.trim() || null, fEta, esistente.id);
        } else {
          db.prepare(`INSERT INTO ospiti (nome, rsvp, tipo, intolleranze, eta, fonte, lato, parent_id, relazione)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'figlio')`)
            .run(f.nome.trim(), fRsvp, fTipo, f.intolleranze?.trim() || null, fEta, main?.fonte || 'sito', main?.lato || 'comune', mainId);
        }
      }
      const elimina = db.prepare('DELETE FROM ospiti WHERE id = ?');
      for (const id of liberi.keys()) elimina.run(id);
    }
    return mainId;
  });

  const mainId = salvaRisposta();
  res.json({ ok: true });

  // Dopo aver risposto all'ospite: l'invio SMTP può metterci secondi o fallire,
  // e la sua risposta è comunque salvata. Un errore si registra e basta.
  sendRsvpNotifica(mainId, !id).catch(err => console.error('[RSVP] notifica email non inviata:', err.message));
});

module.exports = router;
