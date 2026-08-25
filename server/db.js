const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'matrimonio.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    username TEXT UNIQUE,
    email TEXT,
    password TEXT NOT NULL,
    ruolo TEXT DEFAULT 'sposo',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_matrimonio TEXT,
    budget_totale REAL DEFAULT 0,
    nome_sposo1 TEXT,
    nome_sposo2 TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fornitori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL,
    nome TEXT NOT NULL,
    contatto TEXT,
    telefono TEXT,
    email TEXT,
    note TEXT,
    stato TEXT DEFAULT 'da_contattare',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS preventivi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fornitore_id INTEGER REFERENCES fornitori(id) ON DELETE SET NULL,
    fornitore_nome TEXT,
    categoria TEXT NOT NULL,
    descrizione TEXT,
    importo REAL NOT NULL,
    stato TEXT DEFAULT 'in_attesa',
    data_scadenza TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS costi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL,
    descrizione TEXT NOT NULL,
    importo_preventivo REAL DEFAULT 0,
    importo_effettivo REAL DEFAULT 0,
    pagato INTEGER DEFAULT 0,
    data_pagamento TEXT,
    fornitore_id INTEGER REFERENCES fornitori(id) ON DELETE SET NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scadenze (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT NOT NULL,
    descrizione TEXT,
    data_scadenza TEXT NOT NULL,
    categoria TEXT DEFAULT 'altro',
    priorita TEXT DEFAULT 'media',
    completata INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS location (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    nome TEXT NOT NULL,
    indirizzo TEXT,
    contatto TEXT,
    telefono TEXT,
    email TEXT,
    sito_web TEXT,
    capienza INTEGER,
    costo REAL,
    stato TEXT DEFAULT 'in_valutazione',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT NOT NULL,
    categoria TEXT DEFAULT 'altro',
    nome_file TEXT NOT NULL,
    percorso_file TEXT NOT NULL,
    dimensione INTEGER,
    fornitore_id INTEGER REFERENCES fornitori(id) ON DELETE SET NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS idee (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titolo TEXT NOT NULL,
    descrizione TEXT,
    categoria TEXT DEFAULT 'altro',
    immagine_url TEXT,
    priorita TEXT DEFAULT 'media',
    realizzata INTEGER DEFAULT 0,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_config (
    id INTEGER PRIMARY KEY,
    smtp_host TEXT DEFAULT 'smtp.gmail.com',
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT,
    smtp_password TEXT,
    from_name TEXT DEFAULT 'Il Nostro Matrimonio',
    from_email TEXT,
    enabled INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tavoli (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    capienza INTEGER DEFAULT 8,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ospiti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cognome TEXT,
    lato TEXT DEFAULT 'comune',
    tipo TEXT DEFAULT 'adulto',
    rsvp TEXT DEFAULT 'attesa',
    tavolo_id INTEGER REFERENCES tavoli(id) ON DELETE SET NULL,
    email TEXT,
    telefono TEXT,
    intolleranze TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cronologia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ora TEXT NOT NULL,
    titolo TEXT NOT NULL,
    descrizione TEXT,
    luogo TEXT,
    durata INTEGER,
    tipo TEXT DEFAULT 'altro',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS regali (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ospite_id INTEGER REFERENCES ospiti(id) ON DELETE SET NULL,
    mittente TEXT,
    descrizione TEXT NOT NULL,
    tipo TEXT DEFAULT 'altro',
    valore_stimato REAL,
    ringraziamento_inviato INTEGER DEFAULT 0,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS viaggio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT DEFAULT 'altro',
    titolo TEXT NOT NULL,
    luogo TEXT,
    data_inizio TEXT,
    data_fine TEXT,
    costo REAL,
    numero_prenotazione TEXT,
    stato TEXT DEFAULT 'da_prenotare',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS note_veloci (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    testo TEXT NOT NULL,
    autore TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS checklist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    testo TEXT NOT NULL,
    fase TEXT NOT NULL,
    completata INTEGER DEFAULT 0,
    predefinita INTEGER DEFAULT 0,
    ordine INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrazione: aggiunge colonne config se non esistono
const configCols = db.prepare('PRAGMA table_info(config)').all();
if (!configCols.find(c => c.name === 'app_name')) {
  db.prepare("ALTER TABLE config ADD COLUMN app_name TEXT DEFAULT 'Il Nostro Matrimonio'").run();
  db.prepare("UPDATE config SET app_name = 'Il Nostro Matrimonio' WHERE app_name IS NULL").run();
}
if (!configCols.find(c => c.name === 'app_emoji')) {
  db.prepare("ALTER TABLE config ADD COLUMN app_emoji TEXT DEFAULT '💍'").run();
  db.prepare("UPDATE config SET app_emoji = '💍' WHERE app_emoji IS NULL").run();
}
if (!configCols.find(c => c.name === 'login_subtitle')) {
  db.prepare("ALTER TABLE config ADD COLUMN login_subtitle TEXT DEFAULT ''").run();
}
if (!configCols.find(c => c.name === 'conferma_abilitata')) {
  db.prepare('ALTER TABLE config ADD COLUMN conferma_abilitata INTEGER DEFAULT 1').run();
}
if (!configCols.find(c => c.name === 'landing_abilitata')) {
  db.prepare('ALTER TABLE config ADD COLUMN landing_abilitata INTEGER DEFAULT 1').run();
}
if (!configCols.find(c => c.name === 'landing_messaggio')) {
  db.prepare("ALTER TABLE config ADD COLUMN landing_messaggio TEXT DEFAULT ''").run();
}
if (!configCols.find(c => c.name === 'landing_dress_code')) {
  db.prepare("ALTER TABLE config ADD COLUMN landing_dress_code TEXT DEFAULT ''").run();
}
if (!configCols.find(c => c.name === 'landing_info_pratiche')) {
  db.prepare("ALTER TABLE config ADD COLUMN landing_info_pratiche TEXT DEFAULT ''").run();
}
if (!configCols.find(c => c.name === 'landing_tema')) {
  db.prepare("ALTER TABLE config ADD COLUMN landing_tema TEXT DEFAULT 'rose'").run();
}
if (!configCols.find(c => c.name === 'landing_foto')) {
  db.prepare('ALTER TABLE config ADD COLUMN landing_foto TEXT').run();
}
if (!configCols.find(c => c.name === 'landing_foto_posizione')) {
  db.prepare("ALTER TABLE config ADD COLUMN landing_foto_posizione TEXT DEFAULT 'center top'").run();
}
if (!configCols.find(c => c.name === 'soglia_eta_bambino')) {
  db.prepare('ALTER TABLE config ADD COLUMN soglia_eta_bambino INTEGER DEFAULT 12').run();
}

// Migrazione: aggiunge colonna username se non esiste (DB già esistente)
const cols = db.prepare('PRAGMA table_info(users)').all();
if (!cols.find(c => c.name === 'username')) {
  db.prepare('ALTER TABLE users ADD COLUMN username TEXT').run();
}
if (!cols.find(c => c.name === 'email') || cols.find(c => c.name === 'email')?.notnull) {
  // email già presente come NOT NULL nei DB vecchi — la lasciamo com'è
}

// Seed default config
const configExists = db.prepare('SELECT id FROM config LIMIT 1').get();
if (!configExists) {
  db.prepare('INSERT INTO config (data_matrimonio, budget_totale, nome_sposo1, nome_sposo2, app_name, app_emoji, login_subtitle) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(null, 0, 'Sposo 1', 'Sposo 2', 'Il Nostro Matrimonio', '💍', '');
}

// Seed email config
const emailConfigExists = db.prepare('SELECT id FROM email_config LIMIT 1').get();
if (!emailConfigExists) {
  db.prepare('INSERT INTO email_config (id) VALUES (1)').run();
}

// Migrazione: aggiunge colonne scheduling email se non esistono
const emailCols = db.prepare('PRAGMA table_info(email_config)').all().map(c => c.name);
if (!emailCols.includes('reminder_abilitato')) {
  db.prepare('ALTER TABLE email_config ADD COLUMN reminder_abilitato INTEGER DEFAULT 0').run();
}
if (!emailCols.includes('reminder_frequenza')) {
  db.prepare("ALTER TABLE email_config ADD COLUMN reminder_frequenza TEXT DEFAULT 'settimanale'").run();
}
if (!emailCols.includes('reminder_giorni_anticipo')) {
  db.prepare('ALTER TABLE email_config ADD COLUMN reminder_giorni_anticipo INTEGER DEFAULT 14').run();
}
if (!emailCols.includes('reminder_ora')) {
  db.prepare('ALTER TABLE email_config ADD COLUMN reminder_ora INTEGER DEFAULT 8').run();
}
if (!emailCols.includes('ultimo_invio_auto')) {
  db.prepare('ALTER TABLE email_config ADD COLUMN ultimo_invio_auto TEXT').run();
}

// Migrazione: aggiunge messaggio_ospite agli ospiti
const ospCols = db.prepare('PRAGMA table_info(ospiti)').all().map(c => c.name);
if (!ospCols.includes('messaggio_ospite')) {
  db.prepare('ALTER TABLE ospiti ADD COLUMN messaggio_ospite TEXT').run();
}
if (!ospCols.includes('fonte')) {
  db.prepare("ALTER TABLE ospiti ADD COLUMN fonte TEXT DEFAULT 'lista'").run();
}
if (!ospCols.includes('eta')) {
  db.prepare('ALTER TABLE ospiti ADD COLUMN eta INTEGER').run();
}
if (!ospCols.includes('parent_id')) {
  db.prepare('ALTER TABLE ospiti ADD COLUMN parent_id INTEGER REFERENCES ospiti(id) ON DELETE CASCADE').run();
}
if (!ospCols.includes('relazione')) {
  db.prepare('ALTER TABLE ospiti ADD COLUMN relazione TEXT').run();
}
// Deduce la relazione (partner/figlio) dal vecchio tipo per i familiari già esistenti:
// finora 'tipo' era usato sia per l'età che per la parentela, quindi era sempre coerente
// (figli sempre 'bambino', partner sempre 'adulto'). Da qui in avanti le due cose sono
// indipendenti: 'relazione' resta fissa, 'tipo' viene ricalcolato dall'età.
db.prepare(`
  UPDATE ospiti SET relazione = CASE WHEN tipo = 'bambino' THEN 'figlio' ELSE 'partner' END
  WHERE parent_id IS NOT NULL AND relazione IS NULL
`).run();
// Ricalcola tipo per i figli già esistenti in base all'età già salvata e alla soglia
// corrente: senza questo, un figlio maggiorenne inserito prima di questa modifica
// resterebbe 'bambino' finché qualcuno non lo riapre e risalva a mano.
db.prepare(`
  UPDATE ospiti SET tipo = CASE
    WHEN eta >= (SELECT soglia_eta_bambino FROM config LIMIT 1) THEN 'adulto'
    ELSE 'bambino'
  END
  WHERE relazione = 'figlio' AND eta IS NOT NULL
`).run();

// Migrazione: traccia l'esito dell'invio email per le note veloci
const noteCols = db.prepare('PRAGMA table_info(note_veloci)').all().map(c => c.name);
if (!noteCols.includes('email_stato')) {
  db.prepare('ALTER TABLE note_veloci ADD COLUMN email_stato TEXT').run();
}
if (!noteCols.includes('email_errore')) {
  db.prepare('ALTER TABLE note_veloci ADD COLUMN email_errore TEXT').run();
}

// Seed checklist predefinita
const checklistExists = db.prepare('SELECT id FROM checklist_items LIMIT 1').get();
if (!checklistExists) {
  const insertItem = db.prepare('INSERT INTO checklist_items (testo, fase, predefinita, ordine) VALUES (?, ?, 1, ?)');
  const items = [
    ['12mesi', 'Definire la data del matrimonio'],
    ['12mesi', 'Stabilire il budget totale'],
    ['12mesi', 'Scegliere la formula (civile, religioso, simbolico)'],
    ['12mesi', 'Creare la prima bozza della lista ospiti'],
    ['12mesi', 'Visitare e prenotare la location'],
    ['12mesi', 'Prenotare il catering'],
    ['12mesi', 'Iniziare la ricerca dell\'abito da sposa'],
    ['6mesi', 'Prenotare il fotografo'],
    ['6mesi', 'Prenotare il videomaker'],
    ['6mesi', 'Scegliere e prenotare il fiorista'],
    ['6mesi', 'Prenotare la musica (DJ o orchestra)'],
    ['6mesi', 'Prenotare parrucchiere e makeup'],
    ['6mesi', 'Inviare i save-the-date'],
    ['6mesi', 'Scegliere le fedi nuziali'],
    ['6mesi', 'Prenotare il viaggio di nozze'],
    ['3mesi', 'Ordinare l\'abito da sposa'],
    ['3mesi', 'Scegliere l\'abito dello sposo'],
    ['3mesi', 'Prenotare l\'auto / trasporto'],
    ['3mesi', 'Scegliere e ordinare le bomboniere'],
    ['3mesi', 'Definire il menu con il catering'],
    ['3mesi', 'Organizzare l\'alloggio per ospiti da fuori'],
    ['3mesi', 'Inviare gli inviti formali'],
    ['3mesi', 'Creare la lista nozze'],
    ['1mese', 'Confermare tutti i fornitori'],
    ['1mese', 'Organizzare la cena di prova con il catering'],
    ['1mese', 'Definire la disposizione dei tavoli'],
    ['1mese', 'Creare la timeline della giornata'],
    ['1mese', 'Prove abito finale'],
    ['1mese', 'Consegnare il saldo ai fornitori'],
    ['1mese', 'Preparare i segnaposti'],
    ['settimana', 'Confermare orari con tutti i fornitori'],
    ['settimana', 'Trial capelli e makeup'],
    ['settimana', 'Preparare i documenti per la cerimonia'],
    ['settimana', 'Preparare i bouquet con il fiorista'],
    ['settimana', 'Caricare le playlist musicali'],
    ['settimana', 'Rilassarsi e godersi il momento!'],
    ['giorno', 'Colazione tranquilla con la famiglia'],
    ['giorno', 'Trucco e capelli'],
    ['giorno', 'Foto dei preparativi'],
    ['giorno', 'Arrivare in orario alla cerimonia'],
    ['giorno', 'Godersi ogni singolo momento'],
  ];
  items.forEach(([fase, testo], i) => insertItem.run(testo, fase, i));
}

// Seed default users
const userExists = db.prepare('SELECT id FROM users LIMIT 1').get();
if (!userExists) {
  const hash1 = bcrypt.hashSync('sposo1', 10);
  const hash2 = bcrypt.hashSync('sposa1', 10);
  db.prepare('INSERT INTO users (nome, username, email, password, ruolo) VALUES (?, ?, ?, ?, ?)').run('Sposo', 'sposo', null, hash1, 'sposo');
  db.prepare('INSERT INTO users (nome, username, email, password, ruolo) VALUES (?, ?, ?, ?, ?)').run('Sposa', 'sposa', null, hash2, 'sposa');
} else {
  // Migrazione: imposta username dagli utenti esistenti se null
  db.prepare("UPDATE users SET username = LOWER(ruolo) WHERE username IS NULL").run();
}

module.exports = db;
