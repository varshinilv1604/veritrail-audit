const express = require('express');
const db = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();

const REQUIRED_DOCS = [
  'Bank Statement',
  'Sales Register',
  'Purchase Register',
  'GST Return',
  'Expense Summary',
];

// Every query here filters by req.user.firmId, taken from the verified JWT,
// never from a client-supplied param. That's what stops a Firm A user from
// listing or guessing their way into Firm B's clients.
router.get('/', (req, res) => {
  const clients = db
    .prepare('SELECT id, name, created_at FROM clients WHERE firm_id = ? ORDER BY created_at DESC')
    .all(req.user.firmId);
  res.json(clients);
});

router.get('/:id', (req, res) => {
  const client = db
    .prepare('SELECT id, name, created_at FROM clients WHERE id = ? AND firm_id = ?')
    .get(req.params.id, req.user.firmId);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

router.post('/', requireRole('staff', 'admin'), (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Client name is required' });

  const clientId = db
    .prepare('INSERT INTO clients (firm_id, name) VALUES (?, ?)')
    .run(req.user.firmId, name.trim()).lastInsertRowid;

  const insertDoc = db.prepare(
    'INSERT INTO documents (firm_id, client_id, doc_type, status) VALUES (?, ?, ?, ?)'
  );
  for (const docType of REQUIRED_DOCS) {
    insertDoc.run(req.user.firmId, clientId, docType, 'Pending');
  }

  const client = db.prepare('SELECT id, name, created_at FROM clients WHERE id = ?').get(clientId);
  res.status(201).json(client);
});

router.get('/:id/documents', (req, res) => {
  const client = db
    .prepare('SELECT id FROM clients WHERE id = ? AND firm_id = ?')
    .get(req.params.id, req.user.firmId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const documents = db
    .prepare(
      `SELECT d.id, d.doc_type, d.status, d.file_name, d.uploaded_at, d.reviewed_at,
              u.name AS uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.client_id = ? AND d.firm_id = ?
       ORDER BY d.id`
    )
    .all(req.params.id, req.user.firmId);
  res.json(documents);
});

module.exports = router;
