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
  'luogo_partenza', 'luogo_arrivo', 'costo', 'numero_prenotazione', 'link', 'contatto', 'stato', 'note'];

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

module.exports = router;
