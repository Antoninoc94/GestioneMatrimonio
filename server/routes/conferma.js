const router = require('express').Router();
const db = require('../db');

// Info matrimonio (pubblica)
router.get('/info', (req, res) => {
  const cfg = db.prepare('SELECT nome_sposo1, nome_sposo2, data_matrimonio, app_name, app_emoji FROM config LIMIT 1').get();
  res.json(cfg || {});
});

// Trova ospite per nome + cognome esatti (case-insensitive)
// Restituisce sempre 200: { trovato, id?, nome, cognome, rsvp, intolleranze }
router.get('/trova', (req, res) => {
  const nome = (req.query.nome || '').trim();
  const cognome = (req.query.cognome || '').trim();
  if (!nome) return res.status(400).json({ error: 'Nome richiesto' });

  const ospite = db.prepare(`
    SELECT id, nome, cognome, rsvp, intolleranze
    FROM ospiti
    WHERE LOWER(nome) = LOWER(?)
      AND LOWER(COALESCE(cognome, '')) = LOWER(?)
    LIMIT 1
  `).get(nome, cognome);

  if (ospite) {
    res.json({ trovato: true, ...ospite });
  } else {
    res.json({ trovato: false, nome, cognome, rsvp: 'attesa', intolleranze: '' });
  }
});

// Invia risposta: aggiorna esistente o crea nuovo ospite da sito
router.post('/rispondi', (req, res) => {
  const { id, nome, cognome, rsvp, intolleranze, messaggio_ospite } = req.body;
  if (!['confermato', 'declinato', 'attesa'].includes(rsvp)) {
    return res.status(400).json({ error: 'Stato non valido' });
  }

  if (id) {
    // Ospite già in lista: aggiorna
    const ospite = db.prepare('SELECT id FROM ospiti WHERE id = ?').get(id);
    if (!ospite) return res.status(404).json({ error: 'Ospite non trovato' });
    db.prepare('UPDATE ospiti SET rsvp=?, intolleranze=?, messaggio_ospite=? WHERE id=?')
      .run(rsvp, intolleranze || null, messaggio_ospite || null, id);
  } else {
    // Ospite non in lista: crea con fonte='sito'
    db.prepare(`
      INSERT INTO ospiti (nome, cognome, rsvp, intolleranze, messaggio_ospite, fonte)
      VALUES (?, ?, ?, ?, ?, 'sito')
    `).run(nome, cognome || null, rsvp, intolleranze || null, messaggio_ospite || null);
  }

  res.json({ ok: true });
});

module.exports = router;
