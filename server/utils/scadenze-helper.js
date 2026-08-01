// Restituisce la lista completa di scadenze: manuali + automatiche da altre sezioni
function getAllScadenze(db) {
  const manuali = db.prepare('SELECT *, \'manuale\' as source FROM scadenze ORDER BY data_scadenza ASC').all();

  const daPreventivi = db.prepare(`
    SELECT
      'prev_' || id          AS id,
      'Scade preventivo: ' || COALESCE(fornitore_nome, categoria) AS titolo,
      categoria              AS categoria,
      data_scadenza,
      'alta'                 AS priorita,
      0                      AS completata,
      'preventivo'           AS source,
      id                     AS source_id,
      fornitore_nome,
      importo,
      stato
    FROM preventivi
    WHERE data_scadenza IS NOT NULL
      AND stato NOT IN ('accettato', 'rifiutato')
    ORDER BY data_scadenza ASC
  `).all();

  const daViaggio = db.prepare(`
    SELECT
      'viag_' || id          AS id,
      'Da prenotare: ' || titolo AS titolo,
      'viaggio'              AS categoria,
      data_inizio            AS data_scadenza,
      'media'                AS priorita,
      0                      AS completata,
      'viaggio'              AS source,
      id                     AS source_id
    FROM viaggio
    WHERE data_inizio IS NOT NULL AND stato = 'da_prenotare'
    ORDER BY data_inizio ASC
  `).all();

  const daCosti = db.prepare(`
    SELECT
      'costo_' || id         AS id,
      'Pagamento: ' || descrizione AS titolo,
      categoria,
      data_pagamento         AS data_scadenza,
      'alta'                 AS priorita,
      0                      AS completata,
      'costo'                AS source,
      id                     AS source_id,
      importo_effettivo      AS importo
    FROM costi
    WHERE pagato = 0 AND data_pagamento IS NOT NULL
    ORDER BY data_pagamento ASC
  `).all();

  const tutte = [...manuali, ...daPreventivi, ...daViaggio, ...daCosti];
  tutte.sort((a, b) => {
    if (!a.data_scadenza) return 1;
    if (!b.data_scadenza) return -1;
    return a.data_scadenza.localeCompare(b.data_scadenza);
  });
  return tutte;
}

module.exports = { getAllScadenze };
