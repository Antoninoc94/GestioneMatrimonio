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

  const ospite = db.prepare(`
    SELECT id, nome, cognome, rsvp, intolleranze, messaggio_ospite
    FROM ospiti
    WHERE (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
       OR (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
    LIMIT 1
  `).get(nome, cognome, cognome, nome);

  if (ospite) {
    // Carica il partner (adulto collegato tramite parent_id)
    const partner = db.prepare(`
      SELECT id, nome, cognome, intolleranze FROM ospiti
      WHERE parent_id = ? AND tipo != 'bambino'
      LIMIT 1
    `).get(ospite.id);

    // Carica i figli (bambini collegati tramite parent_id)
    const figli = db.prepare(`
      SELECT id, nome, eta, intolleranze FROM ospiti
      WHERE parent_id = ? AND tipo = 'bambino'
      ORDER BY id ASC
    `).all(ospite.id);

    res.json({ trovato: true, ...ospite, partner: partner || null, figli });
  } else {
    res.json({ trovato: false, nome, cognome, rsvp: 'attesa', intolleranze: '', partner: null, figli: [] });
  }
});

function upsertOspite({ nome, cognome, rsvp, intolleranze, messaggio_ospite, tipo, eta, parent_id }) {
  const existing = db.prepare(`
    SELECT id FROM ospiti
    WHERE (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
       OR (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
    LIMIT 1
  `).get(nome, cognome || '', cognome || '', nome);

  if (existing) {
    db.prepare('UPDATE ospiti SET rsvp=?, intolleranze=?, messaggio_ospite=?, parent_id=? WHERE id=?')
      .run(rsvp, intolleranze || null, messaggio_ospite || null, parent_id || null, existing.id);
  } else {
    db.prepare(`INSERT INTO ospiti (nome, cognome, rsvp, intolleranze, messaggio_ospite, tipo, eta, fonte, parent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'sito', ?)`)
      .run(nome, cognome || null, rsvp, intolleranze || null, messaggio_ospite || null,
        tipo || 'adulto', eta || null, parent_id || null);
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
    upsertOspite({ nome: partner.nome.trim(), cognome: partner.cognome?.trim() || '', rsvp: partner.rsvp, intolleranze: partner.intolleranze?.trim() || null, parent_id: mainId });
  }

  // Figli: cancella quelli esistenti e reinserisce dal form (evita duplicati alla ri-sottomissione)
  if (Array.isArray(figli)) {
    db.prepare("DELETE FROM ospiti WHERE parent_id = ? AND tipo = 'bambino'").run(mainId);
    for (const f of figli) {
      if (!f.nome?.trim()) continue;
      db.prepare(`INSERT INTO ospiti (nome, rsvp, tipo, intolleranze, eta, fonte, parent_id)
                  VALUES (?, 'confermato', 'bambino', ?, ?, 'sito', ?)`)
        .run(f.nome.trim(), f.intolleranze?.trim() || null, parseInt(f.eta) || null, mainId);
    }
  }

  res.json({ ok: true });
});

module.exports = router;
