const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

const TIPI = ['busta', 'bonifico', 'oggetto', 'lista_nozze', 'altro'];
const CANALI = ['whatsapp', 'biglietto', 'persona', 'telefono', 'email', 'altro'];
const TIPO_DESCRIZIONE = { busta: 'Busta', bonifico: 'Bonifico', oggetto: 'Regalo', lista_nozze: 'Lista nozze', altro: 'Regalo' };

const oggiItalia = () => {
  try {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

// Un regalo arriva da un nucleo: l'ospite principale con partner e figli.
// Ogni regalo porta i membri e un telefono per il ringraziamento (quello del
// principale, altrimenti il primo che c'è), letti al momento: se in Lista
// Ospiti si aggiunge un figlio o un numero, il regalo lo vede subito.
function conNucleo(regali) {
  const ospiti = db.prepare('SELECT id, nome, cognome, parent_id, relazione, tipo, telefono FROM ospiti').all();
  const byId = new Map(ospiti.map(o => [o.id, o]));
  return regali.map(r => {
    let capo = r.ospite_id ? byId.get(r.ospite_id) : null;
    // Regali registrati prima che si salvasse sempre il principale.
    if (capo?.parent_id && byId.has(capo.parent_id)) capo = byId.get(capo.parent_id);
    if (!capo) return { ...r, membri: [], telefono: null };
    const membri = [capo, ...ospiti.filter(o => o.parent_id === capo.id)
      .sort((a, b) => (a.relazione === 'partner' ? -1 : 0) - (b.relazione === 'partner' ? -1 : 0) || a.id - b.id)];
    const telefono = membri.find(m => m.telefono?.trim())?.telefono || null;
    return { ...r, membri: membri.map(({ telefono, parent_id, ...m }) => m), telefono };
  });
}

const tutti = () => conNucleo(db.prepare('SELECT * FROM regali ORDER BY created_at DESC, id DESC').all());
const uno = id => conNucleo([db.prepare('SELECT * FROM regali WHERE id = ?').get(id)])[0];

// Il ringraziamento: inviato con canale e data (oggi se manca), oppure niente.
function ringraziamento(b) {
  if (!b.ringraziamento_inviato) return { ringraziamento_inviato: 0, canale_ringraziamento: null, data_ringraziamento: null };
  return {
    ringraziamento_inviato: 1,
    canale_ringraziamento: CANALI.includes(b.canale_ringraziamento) ? b.canale_ringraziamento : null,
    data_ringraziamento: /^\d{4}-\d{2}-\d{2}$/.test(b.data_ringraziamento || '') ? b.data_ringraziamento : oggiItalia(),
  };
}

function campi(b) {
  const tipo = TIPI.includes(b.tipo) ? b.tipo : 'altro';
  let ospiteId = b.ospite_id ? parseInt(b.ospite_id) : null;
  if (ospiteId) {
    const o = db.prepare('SELECT id, parent_id, sposo FROM ospiti WHERE id = ?').get(ospiteId);
    if (!o || o.sposo) return { error: 'Ospite non trovato' };
    // Si salva sempre il principale del nucleo: scegliere il partner o un
    // figlio intesta il regalo a tutta la famiglia.
    ospiteId = o.parent_id || o.id;
  }
  const mittente = ospiteId ? null : (b.mittente?.trim() || null);
  if (!ospiteId && !mittente) return { error: 'Indica chi ha fatto il regalo' };
  const valore = parseFloat(b.valore_stimato);
  return {
    ospite_id: ospiteId,
    mittente,
    tipo,
    // La descrizione è facoltativa nel form (per una busta basta l'importo),
    // ma la colonna è NOT NULL: si usa il nome del tipo.
    descrizione: b.descrizione?.trim() || TIPO_DESCRIZIONE[tipo],
    valore_stimato: Number.isFinite(valore) && valore > 0 ? valore : null,
    note: b.note?.trim() || null,
    ...ringraziamento(b),
  };
}

router.get('/', auth, (req, res) => {
  res.json(tutti());
});

router.post('/', auth, (req, res) => {
  const v = campi(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const r = db.prepare(`INSERT INTO regali (ospite_id, mittente, descrizione, tipo, valore_stimato, note,
      ringraziamento_inviato, canale_ringraziamento, data_ringraziamento)
    VALUES (@ospite_id, @mittente, @descrizione, @tipo, @valore_stimato, @note,
      @ringraziamento_inviato, @canale_ringraziamento, @data_ringraziamento)`).run(v);
  res.json(uno(r.lastInsertRowid));
});

router.put('/:id', auth, (req, res) => {
  if (!db.prepare('SELECT 1 FROM regali WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Regalo non trovato' });
  const v = campi(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  db.prepare(`UPDATE regali SET ospite_id=@ospite_id, mittente=@mittente, descrizione=@descrizione, tipo=@tipo,
      valore_stimato=@valore_stimato, note=@note, ringraziamento_inviato=@ringraziamento_inviato,
      canale_ringraziamento=@canale_ringraziamento, data_ringraziamento=@data_ringraziamento WHERE id=@id`)
    .run({ ...v, id: req.params.id });
  res.json(uno(req.params.id));
});

// Solo il ringraziamento, dai pulsanti della scheda: non riscrive il resto.
router.post('/:id/ringraziamento', auth, (req, res) => {
  if (!db.prepare('SELECT 1 FROM regali WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Regalo non trovato' });
  const v = ringraziamento(req.body);
  db.prepare(`UPDATE regali SET ringraziamento_inviato=@ringraziamento_inviato, canale_ringraziamento=@canale_ringraziamento,
      data_ringraziamento=@data_ringraziamento WHERE id=@id`).run({ ...v, id: req.params.id });
  res.json(uno(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM regali WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
