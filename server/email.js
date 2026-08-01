const nodemailer = require('nodemailer');
const db = require('./db');

function getTransporter() {
  const cfg = db.prepare('SELECT * FROM email_config WHERE id = 1').get();
  if (!cfg?.enabled || !cfg.smtp_user || !cfg.smtp_password) return null;

  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: cfg.smtp_port,
    secure: cfg.smtp_port === 465,
    auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
  });
}

async function sendEmail({ to, subject, html }) {
  const transporter = getTransporter();
  if (!transporter) throw new Error('Email non configurata o disabilitata');

  const cfg = db.prepare('SELECT * FROM email_config WHERE id = 1').get();
  return transporter.sendMail({
    from: `"${cfg.from_name}" <${cfg.from_email || cfg.smtp_user}>`,
    to,
    subject,
    html,
  });
}

async function testConnection() {
  const transporter = getTransporter();
  if (!transporter) throw new Error('Email non configurata');
  await transporter.verify();
}

module.exports = { sendEmail, testConnection };
