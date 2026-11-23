const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const TIPI = ['volo', 'hotel', 'escursione', 'trasporto', 'ristorante', 'altro'];
const STATI = ['da_prenotare', 'prenotato', 'pagato', 'completato'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const testo = v => (v == null ? '' : String(v)).trim() || null;
const data = v => (DATA.test(v || '') ? v : null);
const ora = v => (ORA.test(String(v || '').slice(0, 5)) ? String(v).slice(0, 5) : null);

function campi(b) {
  const tipo = TIPI.includes(b.tipo) ? b.tipo : 'altro';
  const v = {
    tipo,
    titolo: testo(b.titolo),
    luogo: testo(b.luogo),
    data_inizio: data(b.data_inizio),
    ora_inizio: ora(b.ora_inizio),
    data_fine: data(b.data_fine),
    ora_fine: ora(b.ora_fine),
    compagnia: tipo === 'volo' ? testo(b.compagnia) : null,
    numero_volo: tipo === 'volo' ? testo(b.numero_volo)?.toUpperCase() ?? null : null,
    luogo_partenza: tipo === 'volo' ? testo(b.luogo_partenza) : null,
    luogo_arrivo: tipo === 'volo' ? testo(b.luogo_arrivo) : null,
    costo: parseFloat(b.costo) > 0 ? parseFloat(b.costo) : null,
    numero_prenotazione: testo(b.numero_prenotazione),
    link: testo(b.link),
    contatto: testo(b.contatto),
    stato: STATI.includes(b.stato) ? b.stato : 'da_prenotare',
    note: testo(b.note),
  };
  if (v.link && !/^https?:\/\//i.test(v.link)) v.link = `https://${v.link}`;
  // Pagamenti: "pagato" senza importo vuol dire tutto; pagato tutto porta lo
  // stato a pagato (se era solo prenotato). Saldo e "prenotare entro" servono
  // solo finché c'è qualcosa da saldare o da prenotare.
  const pagato = parseFloat(b.pagato);
  v.pagato = Number.isFinite(pagato) && pagato > 0 ? pagato : null;
  if (v.stato === 'pagato' && v.costo && !v.pagato) v.pagato = v.costo;
  if (v.stato === 'prenotato' && v.costo && v.pagato >= v.costo) v.stato = 'pagato';
  if (v.costo && v.pagato > v.costo) return { error: 'Il pagato supera il costo' };
  v.data_saldo = v.costo && (v.pagato || 0) < v.costo ? data(b.data_saldo) : null;
  v.prenotare_entro = v.stato === 'da_prenotare' ? data(b.prenotare_entro) : null;
  // Un volo si descrive da sé: senza titolo diventa "Roma → Tokyo".
  if (!v.titolo && tipo === 'volo') {
    v.titolo = [v.luogo_partenza, v.luogo_arrivo].filter(Boolean).join(' → ') || v.numero_volo || null;
  }
  if (!v.titolo) return { error: 'Il titolo è obbligatorio' };
  if (v.data_inizio && v.data_fine && v.data_fine < v.data_inizio) {
    return { error: 'La data di fine è prima di quella di inizio' };
  }
  return v;
}

const COLONNE = ['tipo', 'titolo', 'luogo', 'data_inizio', 'ora_inizio', 'data_fine', 'ora_fine', 'compagnia', 'numero_volo',
  'luogo_partenza', 'luogo_arrivo', 'costo', 'pagato', 'data_saldo', 'prenotare_entro', 'numero_prenotazione', 'link', 'contatto', 'stato', 'note'];

router.get('/', auth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM viaggio ORDER BY data_inizio IS NULL, data_inizio ASC, ora_inizio IS NULL, ora_inizio ASC, created_at ASC`).all());
});

router.post('/', auth, (req, res) => {
  const v = campi(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const r = db.prepare(`INSERT INTO viaggio (${COLONNE.join(', ')}) VALUES (${COLONNE.map(c => '@' + c).join(', ')})`).run(v);
  res.json(db.prepare('SELECT * FROM viaggio WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  if (!db.prepare('SELECT 1 FROM viaggio WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Elemento non trovato' });
  const v = campi(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  db.prepare(`UPDATE viaggio SET ${COLONNE.map(c => `${c}=@${c}`).join(', ')} WHERE id=@id`).run({ ...v, id: req.params.id });
  res.json(db.prepare('SELECT * FROM viaggio WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM viaggio WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Checklist ────────────────────────────────────────────────────────────
const CATEGORIE = ['documenti', 'salute', 'soldi', 'bagaglio', 'casa', 'altro'];

// La lista di partenza, da cui togliere quello che non serve. I documenti
// personali sono uno per ciascuno degli sposi (persona 1 e 2).
const SUGGERITA = [
  ['documenti', 'Passaporto', [1, 2]],
  ["documenti", "Carta d'identità", [1, 2]],
  ['documenti', 'Visto, ESTA o autorizzazione di ingresso (se serve)', [null]],
  ['documenti', 'Copie digitali dei documenti sul telefono e via email', [null]],
  ['salute', 'Assicurazione sanitaria di viaggio', [null]],
  ['salute', 'Vaccinazioni consigliate per la destinazione', [null]],
  ['salute', 'Farmaci personali e kit di primo soccorso', [null]],
  ['soldi', 'Carte abilitate all\'estero e avviso alla banca', [null]],
  ['soldi', 'Un po\' di contanti in valuta locale', [null]],
  ['bagaglio', 'Adattatore per le prese', [null]],
  ['bagaglio', 'Caricabatterie e power bank', [null]],
  ['bagaglio', 'Check-in online dei voli', [null]],
  ['casa', 'Chi bada a casa, piante e animali', [null]],
  ['casa', 'Chiudere gas e acqua, svuotare il frigo', [null]],
];

const voceChecklist = b => {
  const voce = testo(b.testo);
  if (!voce) return { error: 'Scrivi la voce' };
  return {
    testo: voce,
    categoria: CATEGORIE.includes(b.categoria) ? b.categoria : 'altro',
    persona: [1, 2].includes(Number(b.persona)) ? Number(b.persona) : null,
    data: data(b.data),
    fatto: b.fatto ? 1 : 0,
    note: testo(b.note),
  };
};

router.get('/checklist', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM viaggio_checklist ORDER BY fatto ASC, data IS NULL, data ASC, id ASC').all());
});

router.post('/checklist', auth, (req, res) => {
  const v = voceChecklist(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const r = db.prepare('INSERT INTO viaggio_checklist (testo, categoria, persona, data, fatto, note) VALUES (@testo, @categoria, @persona, @data, @fatto, @note)').run(v);
  res.json(db.prepare('SELECT * FROM viaggio_checklist WHERE id = ?').get(r.lastInsertRowid));
});

// Aggiunge le voci suggerite che mancano: si può ripetere senza doppioni.
router.post('/checklist/suggerita', auth, (req, res) => {
  const esiste = db.prepare('SELECT 1 FROM viaggio_checklist WHERE testo = ? AND persona IS ?');
  const ins = db.prepare('INSERT INTO viaggio_checklist (testo, categoria, persona) VALUES (?, ?, ?)');
  db.transaction(() => {
    for (const [categoria, t, persone] of SUGGERITA) {
      for (const p of persone) if (!esiste.get(t, p)) ins.run(t, categoria, p);
    }
  })();
  res.json(db.prepare('SELECT * FROM viaggio_checklist ORDER BY fatto ASC, data IS NULL, data ASC, id ASC').all());
});

router.put('/checklist/:id', auth, (req, res) => {
  if (!db.prepare('SELECT 1 FROM viaggio_checklist WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Voce non trovata' });
  const v = voceChecklist(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  db.prepare('UPDATE viaggio_checklist SET testo=@testo, categoria=@categoria, persona=@persona, data=@data, fatto=@fatto, note=@note WHERE id=@id')
    .run({ ...v, id: req.params.id });
  res.json(db.prepare('SELECT * FROM viaggio_checklist WHERE id = ?').get(req.params.id));
});

router.delete('/checklist/:id', auth, (req, res) => {
  db.prepare('DELETE FROM viaggio_checklist WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
