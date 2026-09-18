const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { issueToken } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Same generic error whether the email is unknown or the password is
  // wrong, so login doesn't leak which emails exist in the system.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = issueToken(user);
  const firm = db.prepare('SELECT id, name FROM firms WHERE id = ?').get(user.firm_id);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    firm,
  });
});

module.exports = router;
