const router = require('express').Router();
const db = require('../db');

// Info matrimonio (pubblica)
router.get('/info', (req, res) => {
  const cfg = db.prepare('SELECT nome_sposo1, nome_sposo2, data_matrimonio, app_name, app_emoji FROM config LIMIT 1').get();
  res.json(cfg || {});
});

// Trova ospite per nome + cognome esatti (case-insensitive, prova anche invertiti)
router.get('/trova', (req, res) => {
  const nome = (req.query.nome || '').trim();
  const cognome = (req.query.cognome || '').trim();
  if (!nome) return res.status(400).json({ error: 'Nome richiesto' });

  const ospite = db.prepare(`
    SELECT id, nome, cognome, rsvp, intolleranze
    FROM ospiti
    WHERE (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
       OR (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
    LIMIT 1
  `).get(nome, cognome, cognome, nome);

  if (ospite) {
    res.json({ trovato: true, ...ospite });
  } else {
    res.json({ trovato: false, nome, cognome, rsvp: 'attesa', intolleranze: '' });
  }
});

function upsertOspite({ nome, cognome, rsvp, intolleranze, messaggio_ospite, tipo, eta }) {
  const existing = db.prepare(`
    SELECT id FROM ospiti
    WHERE (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
       OR (LOWER(nome) = LOWER(?) AND LOWER(COALESCE(cognome, '')) = LOWER(?))
    LIMIT 1
  `).get(nome, cognome || '', cognome || '', nome);

  if (existing) {
    db.prepare('UPDATE ospiti SET rsvp=?, intolleranze=?, messaggio_ospite=? WHERE id=?')
      .run(rsvp, intolleranze || null, messaggio_ospite || null, existing.id);
  } else {
    db.prepare(`INSERT INTO ospiti (nome, cognome, rsvp, intolleranze, messaggio_ospite, tipo, eta, fonte)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'sito')`)
      .run(nome, cognome || null, rsvp, intolleranze || null, messaggio_ospite || null,
        tipo || 'adulto', eta || null);
  }
}

// Invia risposta: ospite principale + partner opzionale + figli opzionali
router.post('/rispondi', (req, res) => {
  const { id, nome, cognome, rsvp, intolleranze, messaggio_ospite, partner, figli } = req.body;

  if (!['confermato', 'declinato', 'attesa'].includes(rsvp))
    return res.status(400).json({ error: 'Stato non valido' });

  // Ospite principale
  if (id) {
    const ospite = db.prepare('SELECT id FROM ospiti WHERE id = ?').get(id);
    if (!ospite) return res.status(404).json({ error: 'Ospite non trovato' });
    db.prepare('UPDATE ospiti SET rsvp=?, intolleranze=?, messaggio_ospite=? WHERE id=?')
      .run(rsvp, intolleranze || null, messaggio_ospite || null, id);
  } else {
    db.prepare(`INSERT INTO ospiti (nome, cognome, rsvp, intolleranze, messaggio_ospite, fonte)
                VALUES (?, ?, ?, ?, ?, 'sito')`)
      .run(nome, cognome || null, rsvp, intolleranze || null, messaggio_ospite || null);
  }

  // Partner (opzionale)
  if (partner?.nome?.trim() && partner?.rsvp) {
    if (!['confermato', 'declinato'].includes(partner.rsvp))
      return res.status(400).json({ error: 'Stato partner non valido' });
    upsertOspite({ nome: partner.nome.trim(), cognome: partner.cognome?.trim() || '', rsvp: partner.rsvp });
  }

  // Figli (opzionale)
  if (Array.isArray(figli)) {
    for (const f of figli) {
      if (!f.nome?.trim()) continue;
      db.prepare(`INSERT INTO ospiti (nome, rsvp, tipo, intolleranze, eta, fonte)
                  VALUES (?, 'confermato', 'bambino', ?, ?, 'sito')`)
        .run(f.nome.trim(), f.intolleranze?.trim() || null, parseInt(f.eta) || null);
    }
  }

  res.json({ ok: true });
});

module.exports = router;
