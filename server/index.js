require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { sendScadenzeReminder } = require('./email');

// ── Fail-fast sulla configurazione ───────────────────────────────
// Senza JWT_SECRET il server partirebbe lo stesso, ma ogni login fallirebbe
// con un fuorviante "credenziali non valide" (in realtà un 500 di jsonwebtoken:
// "secretOrPrivateKey must have a value"). Meglio non partire affatto.
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET non impostato.');
  console.error('        Sviluppo locale: crealo in server/.env (non nella root del repo).');
  console.error('        Docker: variabile "environment" in docker-compose.yml / file .env accanto ad esso.');
  process.exit(1);
}

const app = express();

// ── Reverse proxy ────────────────────────────────────────────────
// Dietro nginx/Cloudflare la connessione arriva dal proxy, non dal visitatore:
// senza questa impostazione ogni ospite risulterebbe avere lo stesso IP e
// finirebbe nello stesso contatore di rate limit, bloccandosi a vicenda.
//
// Il valore è il NUMERO di proxy fidati (1 = solo nginx, 2 = Cloudflare +
// nginx), mai `true`: fidandosi di chiunque, un aggressore potrebbe falsificare
// X-Forwarded-For e azzerare i limiti a ogni richiesta.
const TRUST_PROXY = parseInt(process.env.TRUST_PROXY || '0', 10);
if (TRUST_PROXY > 0) {
  app.set('trust proxy', TRUST_PROXY);
  console.log(`Reverse proxy: mi fido di ${TRUST_PROXY} hop (X-Forwarded-For)`);
}

// ── Scheduler promemoria automatici ──────────────────────────────
const minIntervalOre = { giornaliero: 20, settimanale: 6 * 24, bisettimanale: 13 * 24, mensile: 28 * 24 };

async function checkAutoReminder() {
  try {
    const cfg = db.prepare('SELECT * FROM email_config WHERE id = 1').get();
    if (!cfg?.enabled || !cfg?.reminder_abilitato) return;

    const now = new Date();
    if (now.getHours() !== (cfg.reminder_ora ?? 8)) return;

    const lastSent = cfg.ultimo_invio_auto ? new Date(cfg.ultimo_invio_auto) : null;
    const minOre = minIntervalOre[cfg.reminder_frequenza] || minIntervalOre.settimanale;
    if (lastSent && (now - lastSent) < minOre * 3600000) return;

    await sendScadenzeReminder(cfg.reminder_giorni_anticipo || 14);
    db.prepare('UPDATE email_config SET ultimo_invio_auto = ? WHERE id = 1').run(now.toISOString());
    console.log(`[Auto-reminder] Promemoria scadenze inviato: ${now.toLocaleString('it-IT')}`);
  } catch (err) {
    console.error('[Auto-reminder] Errore:', err.message);
  }
}

// Controlla ogni ora
setInterval(checkAutoReminder, 60 * 60 * 1000);
// Primo controllo dopo 1 minuto dall'avvio
setTimeout(checkAutoReminder, 60 * 1000);

app.use(cors());
app.use(express.json());

// Solo le foto della landing sono pubbliche per design. Contratti, preventivi e
// documenti restano fuori dallo static: si scaricano da /api/documenti/download/:id
// e /api/preventivi/download/:id, che passano dal middleware auth.
app.use('/uploads/landing', express.static(path.join(__dirname, 'uploads/landing')));

// ── Rate limit sulle superfici pubbliche ─────────────────────────
// Sono gli unici endpoint raggiungibili senza token. Nota: i limiti sono per IP,
// quindi valgono finché il container riceve l'IP reale del client (port mapping
// diretto). Dietro un reverse proxy servirebbe app.set('trust proxy', 1).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true, // solo i tentativi falliti consumano il budget
  message: { error: 'Troppi tentativi di accesso. Riprova tra qualche minuto.' },
});

// La ricerca del proprio nome è interattiva (più tentativi sono normali),
// quindi il limite è largo: serve solo a fermare gli script.
const confermaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppe richieste. Riprova tra qualche minuto.' },
});

// L'invio della risposta può creare righe in `ospiti`, ma il limite deve contare
// script, non persone: con la CGNAT degli operatori mobili più invitati possono
// presentarsi con lo stesso IP pubblico. 60/ora ferma comunque un abuso
// automatico, che di richieste ne farebbe migliaia.
const rispondiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppe conferme inviate da questa connessione. Riprova tra un\'ora.' },
});

// "Trova il tuo tavolo" si usa in sala, dove gli invitati sono quasi tutti sul
// Wi-Fi del locale, cioè dietro lo stesso IP, e ognuno digita più volte (la
// ricerca parte a ogni lettera). Il limite è quindi largo: 150 ospiti per una
// decina di richieste stanno dentro, uno script che scorre la lista no.
const tavoloLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppe richieste. Riprova tra qualche minuto.' },
});

app.post('/api/auth/login', loginLimiter);
app.post('/api/conferma/rispondi', rispondiLimiter);

app.use('/api/conferma', confermaLimiter, require('./routes/conferma'));
app.use('/api/landing', require('./routes/landing'));
app.use('/api/tavolo', tavoloLimiter, require('./routes/tavolo'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/config', require('./routes/config'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/fornitori', require('./routes/fornitori'));
app.use('/api/preventivi', require('./routes/preventivi'));
app.use('/api/costi', require('./routes/costi'));
app.use('/api/scadenze', require('./routes/scadenze'));
app.use('/api/location', require('./routes/location'));
app.use('/api/documenti', require('./routes/documenti'));
app.use('/api/idee', require('./routes/idee'));
app.use('/api/profilo', require('./routes/profilo'));
app.use('/api/email-config', require('./routes/email-config'));
app.use('/api/ospiti', require('./routes/ospiti'));
app.use('/api/tavoli', require('./routes/tavoli'));
app.use('/api/cronologia', require('./routes/cronologia'));
app.use('/api/regali', require('./routes/regali'));
app.use('/api/viaggio', require('./routes/viaggio'));
app.use('/api/note', require('./routes/note'));
app.use('/api/checklist', require('./routes/checklist'));

// Serve React build in production
const clientDist = path.join(__dirname, '../client/dist');
// ── Anteprima dei link (WhatsApp, Telegram, Facebook…) ──────────
// Le app di chat non eseguono JavaScript: leggono solo l'HTML iniziale, dove
// c'era il titolo fisso "Il Nostro Matrimonio" di index.html. Il server ci
// scrive i dati veri prima di inviarlo: per /wedding e /conferma nomi degli
// sposi, data e foto; per il resto dell'app il nome impostato in Aspetto.
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const dataLunga = iso => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
};

// Stessa normalizzazione di client/src/publicUrl.js: "dominio.it/" → "https://dominio.it".
const baseUrl = (urlPubblico, req) => {
  const v = (urlPubblico || '').trim().replace(/\/+$/, '');
  if (!v) return `${req.protocol}://${req.get('host')}`;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

const renderIndex = (html, req) => {
  const cfg = db.prepare(`SELECT app_name, nome_sposo1, nome_sposo2, data_matrimonio, landing_abilitata,
    landing_foto, landing_foto_anteprima, url_pubblico FROM config LIMIT 1`).get() || {};
  const appName = cfg.app_name || 'Il Nostro Matrimonio';
  const pagina = req.path.replace(/\/+$/, '');
  if (pagina !== '/wedding' && pagina !== '/conferma') {
    return html.replace(/<title>.*?<\/title>/, `<title>${escHtml(appName)}</title>`);
  }

  const titolo = cfg.nome_sposo1 && cfg.nome_sposo2 ? `${cfg.nome_sposo1} & ${cfg.nome_sposo2}` : appName;
  const quando = cfg.data_matrimonio ? `Ci sposiamo il ${dataLunga(cfg.data_matrimonio)}.` : '';
  const descrizione = pagina === '/conferma'
    ? [quando, 'Conferma qui la tua presenza.'].filter(Boolean).join(' ')
    : quando || 'Tutte le informazioni sul nostro matrimonio.';
  const base = baseUrl(cfg.url_pubblico, req);
  // A pagina disattivata la foto non si mostra neanche nell'anteprima.
  const foto = cfg.landing_abilitata === 1 ? (cfg.landing_foto_anteprima || cfg.landing_foto) : null;

  const meta = [
    `<meta name="description" content="${escHtml(descrizione)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${escHtml(titolo)}" />`,
    `<meta property="og:description" content="${escHtml(descrizione)}" />`,
    `<meta property="og:url" content="${escHtml(base + pagina)}" />`,
    ...(foto ? [
      `<meta property="og:image" content="${escHtml(`${base}/uploads/landing/${foto}`)}" />`,
      '<meta name="twitter:card" content="summary_large_image" />',
    ] : []),
  ].join('\n    ');

  return html
    .replace(/<title>.*?<\/title>/, `<title>${escHtml(titolo)}</title>`)
    .replace('</head>', `    ${meta}\n  </head>`);
};

if (require('fs').existsSync(clientDist)) {
  const indexHtml = require('fs').readFileSync(path.join(clientDist, 'index.html'), 'utf8');
  app.use(express.static(clientDist, {
    // "/" deve passare da renderIndex come ogni altra pagina, non uscire
    // come file statico col titolo fisso.
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  app.get('/{*splat}', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.type('html').send(renderIndex(indexHtml, req));
  });
}

// ── Error handler globale ────────────────────────────────────────
// Va registrato per ultimo. Senza, un upload troppo grande o un errore SQL
// arrivano al client come 500 opaco e la causa reale resta solo nei log.
// Il messaggio dettagliato non viene mai esposto: l'app è raggiungibile
// pubblicamente per l'RSVP degli invitati.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(`[ERRORE] ${req.method} ${req.originalUrl}:`, err.message);

  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'File troppo grande: il limite è 10 MB.' });
  if (typeof err.code === 'string' && err.code.startsWith('LIMIT_'))
    return res.status(400).json({ error: 'Upload non valido.' });
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY')
    return res.status(400).json({ error: 'Operazione non valida: il record è collegato ad altri dati.' });
  if (typeof err.code === 'string' && err.code.startsWith('SQLITE_'))
    return res.status(400).json({ error: 'Operazione non valida sui dati.' });
  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Richiesta malformata.' });

  res.status(err.status || 500).json({ error: 'Errore interno del server.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server avviato su porta ${PORT}`));
