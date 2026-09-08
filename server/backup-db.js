#!/usr/bin/env node
// Copia consistente del database SQLite.
//
// Perche' non basta copiare il file .db: il database gira con journal_mode=WAL,
// quindi le transazioni piu' recenti vivono nel file -wal affiancato. Un `cp` o
// un `tar` a caldo del solo .db le perde, e copiare i tre file separatamente puo'
// produrre uno snapshot incoerente. VACUUM INTO chiede a SQLite di scrivere un
// singolo file gia' consolidato e compattato, in sicurezza anche a server acceso.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dest = process.argv[2];
if (!dest) {
  console.error('Uso: node backup-db.js <file-destinazione.db> [database-sorgente.db]');
  process.exit(1);
}
if (fs.existsSync(dest)) {
  console.error(`Errore: ${dest} esiste gia' (VACUUM INTO non sovrascrive).`);
  process.exit(1);
}

// La sorgente puo' essere passata esplicitamente: quando lo script viene copiato
// dentro al container __dirname non e' piu' /app/server, quindi il fallback su
// __dirname non varrebbe piu'.
const source = process.argv[3] || process.env.DB_PATH || path.join(__dirname, 'matrimonio.db');
if (!fs.existsSync(source)) {
  console.error(`Errore: database non trovato in ${source}`);
  process.exit(1);
}

const db = new Database(source, { readonly: true });
try {
  db.prepare('VACUUM INTO ?').run(dest);

  // Un backup non verificato non e' un backup: rileggiamo il file appena scritto.
  const copia = new Database(dest, { readonly: true });
  const esito = copia.pragma('integrity_check')[0].integrity_check;
  const ospiti = copia.prepare('SELECT COUNT(*) c FROM ospiti').get().c;
  copia.close();

  if (esito !== 'ok') {
    console.error(`Errore: il backup non supera integrity_check (${esito})`);
    process.exit(1);
  }
  const mb = (fs.statSync(dest).size / 1048576).toFixed(2);
  console.log(`Backup DB creato: ${dest} (${mb} MB, ${ospiti} ospiti, integrity_check ok)`);
} finally {
  db.close();
}
