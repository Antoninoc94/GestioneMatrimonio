const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// Profilo utente corrente
router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, nome, username, email, ruolo FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Aggiorna profilo
router.put('/me', auth, (req, res) => {
  const { nome, username, email } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Il nome è obbligatorio' });
  if (!username?.trim()) return res.status(400).json({ error: 'Lo username è obbligatorio' });

  // Verifica unicità username (escludendo se stesso)
  const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username.trim(), req.user.id);
  if (existing) return res.status(400).json({ error: 'Username già in uso' });

  db.prepare('UPDATE users SET nome = ?, username = ?, email = ? WHERE id = ?')
    .run(nome.trim(), username.trim().toLowerCase(), email?.trim() || null, req.user.id);

  const updated = db.prepare('SELECT id, nome, username, email, ruolo FROM users WHERE id = ?').get(req.user.id);
  const token = jwt.sign(
    { id: updated.id, nome: updated.nome, username: updated.username, email: updated.email, ruolo: updated.ruolo },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ user: updated, token });
});

// Lista utenti (per vedere il partner)
router.get('/utenti', auth, (req, res) => {
  const users = db.prepare('SELECT id, nome, username, email, ruolo FROM users ORDER BY id').all();
  res.json(users);
});

module.exports = router;
