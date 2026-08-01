const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password obbligatori' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Credenziali non valide' });

  const token = jwt.sign({ id: user.id, nome: user.nome, email: user.email, ruolo: user.ruolo }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, ruolo: user.ruolo } });
});

router.post('/change-password', require('../middleware/auth'), (req, res) => {
  const { vecchia_password, nuova_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(vecchia_password, user.password))
    return res.status(400).json({ error: 'Vecchia password non corretta' });
  const hash = bcrypt.hashSync(nuova_password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
