require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { sendScadenzeReminder } = require('./email');

const app = express();

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

// Serve React build in production
const clientDist = path.join(__dirname, '../client/dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist, {
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
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server avviato su porta ${PORT}`));
