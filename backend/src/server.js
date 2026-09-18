require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./db'); // creates schema (and resets the sqlite file) before seeding
require('./seed'); // fixed demo data: 2 firms, isolated clients/users/documents

const { requireAuth } = require('./auth');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const documentRoutes = require('./routes/documents');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/clients', requireAuth, clientRoutes);
app.use('/api/documents', requireAuth, documentRoutes);

app.use((err, _req, res, _next) => {
  // Multer errors (bad file type, too large) land here.
  console.error(err.message);
  res.status(400).json({ error: err.message || 'Unexpected error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`OBLIQ-in audit backend listening on http://localhost:${PORT}`);
});
