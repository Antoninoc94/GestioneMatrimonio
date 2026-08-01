const nodemailer = require('nodemailer');
const db = require('./db');

function getConfig() {
  return db.prepare('SELECT * FROM email_config WHERE id = 1').get();
}

function getTransporter(cfg) {
  if (!cfg) cfg = getConfig();
  if (!cfg?.enabled || !cfg.smtp_user || !cfg.smtp_password) return null;

  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: cfg.smtp_port,
    secure: cfg.smtp_port === 465,
    auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
  });
}

async function sendEmail({ to, subject, html }) {
  const cfg = getConfig();
  const transporter = getTransporter(cfg);
  if (!transporter) throw new Error('Email non configurata o disabilitata');

  return transporter.sendMail({
    from: `"${cfg.from_name || 'Il Nostro Matrimonio'}" <${cfg.from_email || cfg.smtp_user}>`,
    to,
    subject,
    html,
  });
}

async function testConnection() {
  const cfg = getConfig();
  const transporter = getTransporter(cfg);
  if (!transporter) throw new Error('Email non configurata o disabilitata');
  await transporter.verify();
}

async function sendTestEmail() {
  const cfg = getConfig();
  const transporter = getTransporter(cfg);
  if (!transporter) throw new Error('Email non configurata o disabilitata');

  const dest = cfg.from_email || cfg.smtp_user;
  const appCfg = db.prepare('SELECT app_name FROM config LIMIT 1').get();
  const appName = appCfg?.app_name || 'Il Nostro Matrimonio';

  await transporter.sendMail({
    from: `"${cfg.from_name || appName}" <${cfg.from_email || cfg.smtp_user}>`,
    to: dest,
    subject: `✅ Test email — ${appName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #f3f4f6;">
        <h2 style="color:#e11d48;margin-top:0;">Test Email</h2>
        <p>Perfetto! La configurazione email di <strong>${appName}</strong> funziona correttamente.</p>
        <p style="color:#6b7280;font-size:14px;">Riceverai notifiche a questo indirizzo quando invierai promemoria o avvisi.</p>
        <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;">
        <p style="color:#9ca3af;font-size:12px;">Inviato da ${appName}</p>
      </div>`,
  });
  return dest;
}

async function sendScadenzeReminder(giorni = 14) {
  const cfg = getConfig();
  const transporter = getTransporter(cfg);
  if (!transporter) throw new Error('Email non configurata o disabilitata');

  const appCfg = db.prepare('SELECT app_name, nome_sposo1, nome_sposo2, data_matrimonio FROM config LIMIT 1').get();
  const appName = appCfg?.app_name || 'Il Nostro Matrimonio';

  const scadenze = db.prepare(`
    SELECT * FROM scadenze
    WHERE completata = 0
      AND data_scadenza >= date('now')
      AND data_scadenza <= date('now', '+${giorni} days')
    ORDER BY data_scadenza ASC
  `).all();

  const scaduteGia = db.prepare(`
    SELECT * FROM scadenze
    WHERE completata = 0 AND data_scadenza < date('now')
    ORDER BY data_scadenza ASC
  `).all();

  const dest = cfg.from_email || cfg.smtp_user;

  const prioritaLabel = { alta: '🔴 Alta', media: '🟡 Media', bassa: '🟢 Bassa' };

  const righeImminenti = scadenze.map(s => {
    const data = new Date(s.data_scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${s.titolo}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${data}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${prioritaLabel[s.priorita] || s.priorita}</td>
    </tr>`;
  }).join('');

  const righeScadute = scaduteGia.map(s => {
    const data = new Date(s.data_scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #fee2e2;color:#dc2626;">${s.titolo}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fee2e2;color:#dc2626;">${data}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fee2e2;">${prioritaLabel[s.priorita] || s.priorita}</td>
    </tr>`;
  }).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #f3f4f6;">
      <h2 style="color:#e11d48;margin-top:0;">📅 Promemoria Scadenze</h2>
      <p style="color:#374151;">Riepilogo scadenze per <strong>${appName}</strong>${appCfg?.nome_sposo1 ? ` — ${appCfg.nome_sposo1} & ${appCfg.nome_sposo2}` : ''}.</p>

      ${scaduteGia.length > 0 ? `
      <h3 style="color:#dc2626;font-size:15px;">⚠️ Scadute (${scaduteGia.length})</h3>
      <table style="width:100%;border-collapse:collapse;background:#fef2f2;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#fee2e2;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9ca3af;">SCADENZA</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9ca3af;">DATA</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9ca3af;">PRIORITÀ</th>
        </tr></thead>
        <tbody>${righeScadute}</tbody>
      </table>` : ''}

      ${scadenze.length > 0 ? `
      <h3 style="color:#374151;font-size:15px;margin-top:20px;">📌 Prossimi ${giorni} giorni (${scadenze.length})</h3>
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9ca3af;">SCADENZA</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9ca3af;">DATA</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9ca3af;">PRIORITÀ</th>
        </tr></thead>
        <tbody>${righeImminenti}</tbody>
      </table>` : '<p style="color:#6b7280;">Nessuna scadenza nei prossimi ' + giorni + ' giorni.</p>'}

      <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;">
      <p style="color:#9ca3af;font-size:12px;">Inviato da ${appName}</p>
    </div>`;

  await transporter.sendMail({
    from: `"${cfg.from_name || appName}" <${cfg.from_email || cfg.smtp_user}>`,
    to: dest,
    subject: `📅 Promemoria scadenze — ${appName}`,
    html,
  });

  return { dest, imminenti: scadenze.length, scadute: scaduteGia.length };
}

module.exports = { sendEmail, testConnection, sendTestEmail, sendScadenzeReminder };
