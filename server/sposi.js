// Gli sposi come ospiti: due righe di `ospiti` marcate da `sposo` (1 e 2,
// come nome_sposo1/nome_sposo2 in config), così contano nei posti, nel
// catering, nei segnaposti e nei PDF come chiunque altro. Si creano quando
// un tavolo diventa il tavolo sposi; i nomi seguono le Impostazioni.
const db = require('./db');

function nomiSposi() {
  const cfg = db.prepare('SELECT nome_sposo1, nome_sposo2 FROM config LIMIT 1').get() || {};
  return { 1: cfg.nome_sposo1?.trim() || 'Sposo', 2: cfg.nome_sposo2?.trim() || 'Sposa' };
}

// Crea gli sposi che mancano e fa sedere al tavolo chi non ha ancora un posto.
// Chi è già seduto altrove resta dov'è: lo hanno messo lì gli sposi stessi.
function assicuraSposi(tavoloId) {
  const nomi = nomiSposi();
  for (const n of [1, 2]) {
    const esistente = db.prepare('SELECT id, tavolo_id FROM ospiti WHERE sposo = ?').get(n);
    if (!esistente) {
      db.prepare(`INSERT INTO ospiti (nome, lato, tipo, rsvp, tavolo_id, sposo, fonte)
        VALUES (?, 'comune', 'adulto', 'confermato', ?, ?, 'lista')`).run(nomi[n], tavoloId, n);
    } else if (!esistente.tavolo_id) {
      db.prepare('UPDATE ospiti SET tavolo_id = ? WHERE id = ?').run(tavoloId, esistente.id);
    }
  }
}

// Dopo un cambio di nome nelle Impostazioni. Il cognome, se aggiunto a mano
// nella Lista Ospiti, non si tocca.
function aggiornaNomiSposi() {
  const nomi = nomiSposi();
  const stmt = db.prepare('UPDATE ospiti SET nome = ? WHERE sposo = ?');
  stmt.run(nomi[1], 1);
  stmt.run(nomi[2], 2);
}

module.exports = { assicuraSposi, aggiornaNomiSposi };
