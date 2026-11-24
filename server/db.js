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
if (!configCols.find(c => c.name === 'landing_foto_originale')) {
  db.prepare('ALTER TABLE config ADD COLUMN landing_foto_originale TEXT').run();
}
if (!configCols.find(c => c.name === 'landing_foto_crop')) {
  db.prepare('ALTER TABLE config ADD COLUMN landing_foto_crop TEXT').run();
}
// Copia piccola della foto ritagliata per l'anteprima dei link (WhatsApp &c.):
// la versione intera può pesare MB, e le app di chat non la mostrano.
if (!configCols.find(c => c.name === 'landing_foto_anteprima')) {
  db.prepare('ALTER TABLE config ADD COLUMN landing_foto_anteprima TEXT').run();
}
if (!configCols.find(c => c.name === 'soglia_eta_bambino')) {
  db.prepare('ALTER TABLE config ADD COLUMN soglia_eta_bambino INTEGER DEFAULT 12').run();
}
// Indirizzo con cui gli ospiti raggiungono /wedding e /conferma, usato nei QR.
// Serve perché la gestione si apre da un altro indirizzo (il dominio pubblico
// lascia passare solo le due pagine per gli ospiti).
if (!configCols.find(c => c.name === 'url_pubblico')) {
  db.prepare('ALTER TABLE config ADD COLUMN url_pubblico TEXT').run();
}
// Ultimo giorno (YYYY-MM-DD, incluso) in cui /conferma accetta risposte. NULL = nessun limite.
if (!configCols.find(c => c.name === 'conferma_scadenza')) {
  db.prepare('ALTER TABLE config ADD COLUMN conferma_scadenza TEXT').run();
}
// Testo dell'invito mandato via WhatsApp dalla Lista Ospiti. NULL = testo predefinito.
if (!configCols.find(c => c.name === 'messaggio_whatsapp')) {
  db.prepare('ALTER TABLE config ADD COLUMN messaggio_whatsapp TEXT').run();
}
// Campi del generatore inviti. Restano NULL finché non si salva la prima volta:
// così il client distingue "mai compilato" (usa i testi predefiniti) da
// "svuotato apposta" (stringa vuota). Nomi e data non si duplicano qui —
// l'invito legge nome_sposo1/2 e data_matrimonio.
for (const col of [
  'invito_ora_cerimonia', 'invito_luogo_cerimonia', 'invito_indirizzo_cerimonia',
  'invito_ora_ricevimento', 'invito_luogo_ricevimento', 'invito_indirizzo_ricevimento',
  'invito_rsvp_entro', 'invito_rsvp_telefono',
  'invito_messaggio_apertura', 'invito_messaggio_chiusura',
]) {
  if (!configCols.find(c => c.name === col)) {
    db.prepare(`ALTER TABLE config ADD COLUMN ${col} TEXT`).run();
  }
}
// Sezione regalo della pagina Wedding: IBAN e lista nozze. Spenta finché
// non la si attiva dall'editor della Landing.
if (!configCols.find(c => c.name === 'regalo_abilitato')) {
  db.prepare('ALTER TABLE config ADD COLUMN regalo_abilitato INTEGER DEFAULT 0').run();
}
for (const col of ['regalo_titolo', 'regalo_messaggio', 'regalo_iban', 'regalo_intestatario', 'regalo_banca', 'regalo_causale', 'regalo_link', 'regalo_link_testo']) {
  if (!configCols.find(c => c.name === col)) {
    db.prepare(`ALTER TABLE config ADD COLUMN ${col} TEXT`).run();
  }
}
if (!configCols.find(c => c.name === 'invito_tema')) {
  db.prepare("ALTER TABLE config ADD COLUMN invito_tema TEXT DEFAULT 'classico'").run();
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
// Email agli sposi a ogni risposta dal sito. Attiva di default: chi ha già
// configurato l'email la vuole quasi certamente.
if (!emailCols.includes('notifica_rsvp')) {
  db.prepare('ALTER TABLE email_config ADD COLUMN notifica_rsvp INTEGER DEFAULT 1').run();
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
// Invito consegnato alla famiglia (solo sull'invitato principale): data ISO, o
// NULL se ancora da consegnare, e come ('whatsapp' / 'manuale').
if (!ospCols.includes('invito_inviato')) {
  db.prepare('ALTER TABLE ospiti ADD COLUMN invito_inviato TEXT').run();
}
if (!ospCols.includes('invito_canale')) {
  db.prepare('ALTER TABLE ospiti ADD COLUMN invito_canale TEXT').run();
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

// Migrazione: tavoli con forma, tipo (sposi/bambini), ordine scelto dagli sposi
// e posizione sulla pianta della sala. pos_x/pos_y NULL = non ancora piazzato.
const tavoliCols = db.prepare('PRAGMA table_info(tavoli)').all().map(c => c.name);
if (!tavoliCols.includes('forma')) {
  db.prepare("ALTER TABLE tavoli ADD COLUMN forma TEXT DEFAULT 'tondo'").run();
}
if (!tavoliCols.includes('tipo')) {
  db.prepare("ALTER TABLE tavoli ADD COLUMN tipo TEXT DEFAULT 'normale'").run();
}
if (!tavoliCols.includes('pos_x')) {
  db.prepare('ALTER TABLE tavoli ADD COLUMN pos_x REAL').run();
}
if (!tavoliCols.includes('pos_y')) {
  db.prepare('ALTER TABLE tavoli ADD COLUMN pos_y REAL').run();
}
if (!tavoliCols.includes('rotazione')) {
  db.prepare('ALTER TABLE tavoli ADD COLUMN rotazione INTEGER DEFAULT 0').run();
}
if (!tavoliCols.includes('descrizione')) {
  db.prepare('ALTER TABLE tavoli ADD COLUMN descrizione TEXT').run();
}
if (!tavoliCols.includes('elle_posti')) {
  db.prepare("ALTER TABLE tavoli ADD COLUMN elle_posti TEXT DEFAULT 'entrambi'").run();
}
// Disposizioni salvate: una fotografia dei tavoli (forma, posizione, ordine) e
// di chi siede dove, in JSON, da riapplicare senza rifare tutto.
db.exec(`
  CREATE TABLE IF NOT EXISTS tavoli_preset (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    dati TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
// Il preset creato da solo prima di applicarne un altro (se ne tiene uno).
if (!db.prepare('PRAGMA table_info(tavoli_preset)').all().some(c => c.name === 'auto')) {
  db.prepare('ALTER TABLE tavoli_preset ADD COLUMN auto INTEGER DEFAULT 0').run();
}
if (!tavoliCols.includes('ordine')) {
  db.prepare('ALTER TABLE tavoli ADD COLUMN ordine INTEGER').run();
  // Finora l'ordine era alfabetico: si parte da lì, così nulla si sposta.
  db.prepare(`UPDATE tavoli SET ordine = (
    SELECT COUNT(*) FROM tavoli t2 WHERE t2.nome < tavoli.nome OR (t2.nome = tavoli.nome AND t2.id < tavoli.id)
  )`).run();
}

// Migrazione: gli sposi come ospiti (1 = nome_sposo1, 2 = nome_sposo2), creati
// col tavolo sposi da server/sposi.js. Chi aveva già un tavolo sposi prima di
// questa colonna li trova creati qui, una volta sola: se poi li elimina dalla
// lista non ricompaiono a ogni riavvio.
if (!ospCols.includes('sposo')) {
  db.prepare('ALTER TABLE ospiti ADD COLUMN sposo INTEGER').run();
  const tavoloSposi = db.prepare("SELECT id FROM tavoli WHERE tipo = 'sposi' ORDER BY ordine IS NULL, ordine, id LIMIT 1").get();
  if (tavoloSposi) {
    const cfg = db.prepare('SELECT nome_sposo1, nome_sposo2 FROM config LIMIT 1').get() || {};
    const nomi = [cfg.nome_sposo1?.trim() || 'Sposo', cfg.nome_sposo2?.trim() || 'Sposa'];
    const ins = db.prepare(`INSERT INTO ospiti (nome, lato, tipo, rsvp, tavolo_id, sposo, fonte)
      VALUES (?, 'comune', 'adulto', 'confermato', ?, ?, 'lista')`);
    nomi.forEach((nome, i) => ins.run(nome, tavoloSposi.id, i + 1));
  }
}

// Migrazione: cronologia collegata alle location e visibilità sulla pagina Wedding.
// location_id senza vincolo REFERENCES: se la location si elimina, location.js
// copia prima il nome in `luogo`, così l'evento non resta senza posto.
// pubblico parte da 1: finora la landing mostrava tutti gli eventi.
const cronCols = db.prepare('PRAGMA table_info(cronologia)').all().map(c => c.name);
if (!cronCols.includes('location_id')) {
  db.prepare('ALTER TABLE cronologia ADD COLUMN location_id INTEGER').run();
}
if (!cronCols.includes('pubblico')) {
  db.prepare('ALTER TABLE cronologia ADD COLUMN pubblico INTEGER DEFAULT 1').run();
}
// Fornitori coinvolti in ogni evento: dato interno, la landing non lo riceve.
db.exec(`
  CREATE TABLE IF NOT EXISTS cronologia_fornitori (
    cronologia_id INTEGER NOT NULL REFERENCES cronologia(id) ON DELETE CASCADE,
    fornitore_id INTEGER NOT NULL REFERENCES fornitori(id) ON DELETE CASCADE,
    PRIMARY KEY (cronologia_id, fornitore_id)
  )
`);

// Migrazione: come e quando si è ringraziato per un regalo, e il testo del
// ringraziamento su WhatsApp (NULL = testo predefinito del client).
const regaliCols = db.prepare('PRAGMA table_info(regali)').all().map(c => c.name);
if (!regaliCols.includes('canale_ringraziamento')) {
  db.prepare('ALTER TABLE regali ADD COLUMN canale_ringraziamento TEXT').run();
}
if (!regaliCols.includes('data_ringraziamento')) {
  db.prepare('ALTER TABLE regali ADD COLUMN data_ringraziamento TEXT').run();
}
if (!db.prepare('PRAGMA table_info(config)').all().some(c => c.name === 'messaggio_ringraziamento')) {
  db.prepare('ALTER TABLE config ADD COLUMN messaggio_ringraziamento TEXT').run();
}

// Migrazione: viaggio di nozze. I dati del viaggio (destinazione, date,
// budget) stanno in config: il viaggio è uno. Le prenotazioni guadagnano gli
// orari, i dettagli dei voli, il link alla prenotazione e un contatto.
for (const col of ['viaggio_destinazione', 'viaggio_partenza', 'viaggio_ritorno']) {
  if (!db.prepare('PRAGMA table_info(config)').all().some(c => c.name === col)) {
    db.prepare(`ALTER TABLE config ADD COLUMN ${col} TEXT`).run();
  }
}
if (!db.prepare('PRAGMA table_info(config)').all().some(c => c.name === 'viaggio_budget')) {
  db.prepare('ALTER TABLE config ADD COLUMN viaggio_budget REAL').run();
}
const viaggioCols = db.prepare('PRAGMA table_info(viaggio)').all().map(c => c.name);
for (const col of ['ora_inizio', 'ora_fine', 'compagnia', 'numero_volo', 'luogo_partenza', 'luogo_arrivo', 'link', 'contatto']) {
  if (!viaggioCols.includes(col)) db.prepare(`ALTER TABLE viaggio ADD COLUMN ${col} TEXT`).run();
}
// Soldi del viaggio: quanto è già pagato, entro quando va saldato il resto e
// entro quando prenotare (prima la scadenza "da prenotare" usava la data del
// viaggio, cioè avvisava il giorno della partenza).
if (!viaggioCols.includes('pagato')) {
  db.prepare('ALTER TABLE viaggio ADD COLUMN pagato REAL').run();
  // Chi l'aveva segnata come pagata l'ha pagata tutta.
  db.prepare("UPDATE viaggio SET pagato = costo WHERE stato IN ('pagato', 'completato') AND costo > 0").run();
}
for (const col of ['data_saldo', 'prenotare_entro']) {
  if (!viaggioCols.includes(col)) db.prepare(`ALTER TABLE viaggio ADD COLUMN ${col} TEXT`).run();
}
// Checklist del viaggio: documenti, salute, soldi, bagaglio, casa. `persona`
// è 1/2 (config.nome_sposo1/2) o NULL per entrambi; `data` per i documenti è
// la scadenza del documento, per il resto la data entro cui farlo.
db.exec(`
  CREATE TABLE IF NOT EXISTS viaggio_checklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    testo TEXT NOT NULL,
    categoria TEXT DEFAULT 'altro',
    persona INTEGER,
    data TEXT,
    fatto INTEGER DEFAULT 0,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Migrazione: traccia l'esito dell'invio email per le note veloci
const noteCols = db.prepare('PRAGMA table_info(note_veloci)').all().map(c => c.name);
if (!noteCols.includes('email_stato')) {
  db.prepare('ALTER TABLE note_veloci ADD COLUMN email_stato TEXT').run();
}
if (!noteCols.includes('email_errore')) {
  db.prepare('ALTER TABLE note_veloci ADD COLUMN email_errore TEXT').run();
}

// Migrazione: allegato (es. PDF del preventivo) sui preventivi
const preventiviCols = db.prepare('PRAGMA table_info(preventivi)').all().map(c => c.name);
if (!preventiviCols.includes('nome_file')) {
  db.prepare('ALTER TABLE preventivi ADD COLUMN nome_file TEXT').run();
}
if (!preventiviCols.includes('percorso_file')) {
  db.prepare('ALTER TABLE preventivi ADD COLUMN percorso_file TEXT').run();
}
if (!preventiviCols.includes('dimensione_file')) {
  db.prepare('ALTER TABLE preventivi ADD COLUMN dimensione_file INTEGER').run();
}
if (!preventiviCols.includes('anticipo')) {
  db.prepare('ALTER TABLE preventivi ADD COLUMN anticipo REAL').run();
}
if (!preventiviCols.includes('data_anticipo')) {
  db.prepare('ALTER TABLE preventivi ADD COLUMN data_anticipo TEXT').run();
}
// Un preventivo può riguardare una location (tabella separata dai fornitori)
if (!preventiviCols.includes('location_id')) {
  db.prepare('ALTER TABLE preventivi ADD COLUMN location_id INTEGER REFERENCES location(id) ON DELETE SET NULL').run();
}

// Piano di pagamento: caparra, tranche e saldo di un preventivo
db.exec(`
  CREATE TABLE IF NOT EXISTS preventivi_rate (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preventivo_id INTEGER NOT NULL REFERENCES preventivi(id) ON DELETE CASCADE,
    descrizione TEXT,
    importo REAL NOT NULL,
    data_scadenza TEXT,
    pagata INTEGER DEFAULT 0,
    data_pagamento TEXT,
    ordine INTEGER DEFAULT 0
  )
`);

// Prezzo a persona e fasce d'età dei bambini, diverse per ogni location: servono
// a stimare il costo del ricevimento sulla lista ospiti reale.
const locationCols = db.prepare('PRAGMA table_info(location)').all().map(c => c.name);
if (!locationCols.includes('prezzo_adulto')) {
  db.prepare('ALTER TABLE location ADD COLUMN prezzo_adulto REAL').run();
}
db.exec(`
  CREATE TABLE IF NOT EXISTS location_fasce (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL REFERENCES location(id) ON DELETE CASCADE,
    eta_da INTEGER NOT NULL,
    eta_a INTEGER NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'percentuale',
    valore REAL NOT NULL DEFAULT 0
  )
`);

// Migrazione: il vecchio anticipo singolo diventa la prima rata (già pagata).
// Le colonne anticipo/data_anticipo vengono svuotate così la migrazione non si
// ripete se in seguito l'utente cancella quella rata.
const conAnticipo = db.prepare('SELECT id, anticipo, data_anticipo FROM preventivi WHERE anticipo > 0').all();
if (conAnticipo.length > 0) {
  const insRata = db.prepare("INSERT INTO preventivi_rate (preventivo_id, descrizione, importo, data_scadenza, pagata, data_pagamento, ordine) VALUES (?, 'Anticipo', ?, ?, 1, ?, 0)");
  const svuota = db.prepare('UPDATE preventivi SET anticipo = NULL, data_anticipo = NULL WHERE id = ?');
  db.transaction(() => {
    for (const p of conAnticipo) {
      insRata.run(p.id, p.anticipo, p.data_anticipo, p.data_anticipo);
      svuota.run(p.id);
    }
  })();
}

// Fatture: sono documenti di categoria Fattura, legati al fornitore, con numero,
// data e importo. Non corrispondono per forza a una rata: una fattura può coprire
// più rate (o nessuna) e una rata può non averne. Il collegamento, facoltativo, sta
// in fatture_rate; se la rata sparisce la fattura resta in Documenti, scollegata.
const documentiCols = db.prepare('PRAGMA table_info(documenti)').all().map(c => c.name);
if (!documentiCols.includes('numero_fattura')) {
  db.prepare('ALTER TABLE documenti ADD COLUMN numero_fattura TEXT').run();
}
if (!documentiCols.includes('data_fattura')) {
  db.prepare('ALTER TABLE documenti ADD COLUMN data_fattura TEXT').run();
}
if (!documentiCols.includes('importo_fattura')) {
  db.prepare('ALTER TABLE documenti ADD COLUMN importo_fattura REAL').run();
}
db.exec(`
  CREATE TABLE IF NOT EXISTS fatture_rate (
    documento_id INTEGER NOT NULL REFERENCES documenti(id) ON DELETE CASCADE,
    rata_id INTEGER NOT NULL REFERENCES preventivi_rate(id) ON DELETE CASCADE,
    PRIMARY KEY (documento_id, rata_id)
  )
`);

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
