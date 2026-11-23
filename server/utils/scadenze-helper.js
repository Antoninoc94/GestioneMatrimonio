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

  // Viaggio: entro quando prenotare (non la data del viaggio, che avvisava il
  // giorno della partenza) e il saldo di quanto resta da pagare.
  const daViaggio = db.prepare(`
    SELECT
      'viag_' || id          AS id,
      'Da prenotare: ' || titolo AS titolo,
      'viaggio'              AS categoria,
      prenotare_entro        AS data_scadenza,
      'media'                AS priorita,
      0                      AS completata,
      'viaggio'              AS source,
      id                     AS source_id,
      NULL                   AS importo
    FROM viaggio
    WHERE prenotare_entro IS NOT NULL AND stato = 'da_prenotare'
    UNION ALL
    SELECT
      'viag_saldo_' || id    AS id,
      'Saldo viaggio: ' || titolo AS titolo,
      'viaggio'              AS categoria,
      data_saldo             AS data_scadenza,
      'alta'                 AS priorita,
      0                      AS completata,
      'viaggio'              AS source,
      id                     AS source_id,
      costo - COALESCE(pagato, 0) AS importo
    FROM viaggio
    WHERE data_saldo IS NOT NULL AND costo > COALESCE(pagato, 0) AND stato != 'da_prenotare'
    UNION ALL
    -- Le cose da fare prima di partire, con una data entro cui farle. Per i
    -- documenti la data è la loro scadenza, non un compito: restano fuori.
    SELECT
      'viag_check_' || id    AS id,
      'Viaggio: ' || testo   AS titolo,
      'viaggio'              AS categoria,
      data                   AS data_scadenza,
      'media'                AS priorita,
      0                      AS completata,
      'viaggio'              AS source,
      id                     AS source_id,
      NULL                   AS importo
    FROM viaggio_checklist
    WHERE data IS NOT NULL AND fatto = 0 AND categoria != 'documenti'
    ORDER BY data_scadenza ASC
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

  // Solo i preventivi accettati: le rate di un preventivo ancora in valutazione
  // non sono un impegno preso.
  const daRate = db.prepare(`
    SELECT
      'rata_' || r.id        AS id,
      'Rata: ' || COALESCE(r.descrizione, 'pagamento') || ' — ' || COALESCE(l.nome, p.fornitore_nome, p.categoria) AS titolo,
      p.categoria            AS categoria,
      r.data_scadenza,
      'alta'                 AS priorita,
      0                      AS completata,
      'rata'                 AS source,
      p.id                   AS source_id,
      r.importo              AS importo
    FROM preventivi_rate r
    JOIN preventivi p ON p.id = r.preventivo_id
    LEFT JOIN location l ON l.id = p.location_id
    WHERE r.pagata = 0 AND r.data_scadenza IS NOT NULL AND p.stato = 'accettato'
    ORDER BY r.data_scadenza ASC
  `).all();

  const tutte = [...manuali, ...daPreventivi, ...daViaggio, ...daCosti, ...daRate];
  tutte.sort((a, b) => {
    if (!a.data_scadenza) return 1;
    if (!b.data_scadenza) return -1;
    return a.data_scadenza.localeCompare(b.data_scadenza);
  });
  return tutte;
}

module.exports = { getAllScadenze };
