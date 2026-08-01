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
    email TEXT UNIQUE NOT NULL,
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
`);

// Seed default config if not exists
const configExists = db.prepare('SELECT id FROM config LIMIT 1').get();
if (!configExists) {
  db.prepare('INSERT INTO config (data_matrimonio, budget_totale, nome_sposo1, nome_sposo2) VALUES (?, ?, ?, ?)')
    .run(null, 0, 'Sposo 1', 'Sposo 2');
}

// Seed default users if not exists
const userExists = db.prepare('SELECT id FROM users LIMIT 1').get();
if (!userExists) {
  const hash1 = bcrypt.hashSync('sposo1', 10);
  const hash2 = bcrypt.hashSync('sposa1', 10);
  db.prepare('INSERT INTO users (nome, email, password, ruolo) VALUES (?, ?, ?, ?)').run('Sposo', 'sposo@matrimonio.it', hash1, 'sposo');
  db.prepare('INSERT INTO users (nome, email, password, ruolo) VALUES (?, ?, ?, ?)').run('Sposa', 'sposa@matrimonio.it', hash2, 'sposa');
}

module.exports = db;
