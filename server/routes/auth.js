const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

// Login con username (o email per retrocompatibilità)
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username e password obbligatori' });

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Credenziali non valide' });

  const token = jwt.sign(
    { id: user.id, nome: user.nome, username: user.username, email: user.email, ruolo: user.ruolo },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, nome: user.nome, username: user.username, email: user.email, ruolo: user.ruolo } });
});

// Cambio password
router.post('/change-password', auth, (req, res) => {
  const { vecchia_password, nuova_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(vecchia_password, user.password))
    return res.status(400).json({ error: 'Vecchia password non corretta' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(nuova_password, 10), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
