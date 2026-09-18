const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.csv']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Random name on disk. The client-supplied original name is only ever
    // used for display (from the DB column), never to build a filesystem
    // path, so it can't be used for path traversal.
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Unsupported file type: ${ext || 'unknown'}`));
    }
    cb(null, true);
  },
});

function logEvent({ firmId, documentId, actorUserId, action, comment }) {
  db.prepare(
    `INSERT INTO audit_events (firm_id, document_id, actor_user_id, action, comment)
     VALUES (?, ?, ?, ?, ?)`
  ).run(firmId, documentId, actorUserId, action, comment || null);
}

// Every handler below re-fetches the document scoped to req.user.firmId
// before touching it. A valid, unexpired JWT for Firm A simply cannot
// select a Firm B document row - the query returns nothing and we 404,
// identically to an id that doesn't exist at all (no information leak
// about other firms' data even existing).
function getOwnedDocument(req, res) {
  const doc = db
    .prepare('SELECT * FROM documents WHERE id = ? AND firm_id = ?')
    .get(req.params.id, req.user.firmId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return null;
  }
  return doc;
}

router.get('/:id', (req, res) => {
  const doc = getOwnedDocument(req, res);
  if (!doc) return;

  const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(doc.client_id);
  const uploadedBy = doc.uploaded_by
    ? db.prepare('SELECT name FROM users WHERE id = ?').get(doc.uploaded_by)
    : null;
  const reviewedBy = doc.reviewed_by
    ? db.prepare('SELECT name FROM users WHERE id = ?').get(doc.reviewed_by)
    : null;

  const history = db
    .prepare(
      `SELECT e.id, e.action, e.comment, e.created_at, u.name AS actor_name, u.role AS actor_role
       FROM audit_events e
       JOIN users u ON u.id = e.actor_user_id
       WHERE e.document_id = ? AND e.firm_id = ?
       ORDER BY e.created_at ASC, e.id ASC`
    )
    .all(doc.id, req.user.firmId);

  res.json({
    id: doc.id,
    docType: doc.doc_type,
    status: doc.status,
    fileName: doc.file_name,
    uploadedAt: doc.uploaded_at,
    uploadedByName: uploadedBy ? uploadedBy.name : null,
    reviewComment: doc.review_comment,
    reviewedAt: doc.reviewed_at,
    reviewedByName: reviewedBy ? reviewedBy.name : null,
    client,
    history,
  });
});

router.get('/:id/file', (req, res) => {
  const doc = getOwnedDocument(req, res);
  if (!doc) return;
  if (!doc.file_path) return res.status(404).json({ error: 'No file uploaded yet' });

  res.download(doc.file_path, doc.file_name);
});

router.post('/:id/upload', requireRole('staff', 'admin'), upload.single('file'), (req, res) => {
  const doc = getOwnedDocument(req, res);
  if (!doc) return;
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  if (doc.status === 'Approved') {
    fs.unlink(req.file.path, () => {});
    return res.status(409).json({ error: 'Document is already approved and cannot be re-uploaded' });
  }

  const isRevision = doc.status === 'Correction Required';
  const now = new Date().toISOString();

  // Best-effort cleanup of the previous file on disk; failure to delete an
  // old revision is not worth failing the request over.
  if (doc.file_path) fs.unlink(doc.file_path, () => {});

  db.prepare(
    `UPDATE documents
     SET status = 'Uploaded', file_name = ?, file_path = ?, uploaded_by = ?, uploaded_at = ?,
         review_comment = NULL
     WHERE id = ? AND firm_id = ?`
  ).run(req.file.originalname, req.file.path, req.user.userId, now, doc.id, req.user.firmId);

  logEvent({
    firmId: req.user.firmId,
    documentId: doc.id,
    actorUserId: req.user.userId,
    action: isRevision ? 'uploaded revised document' : 'uploaded document',
    comment: req.file.originalname,
  });

  res.json({ ok: true });
});

router.post('/:id/start-review', requireRole('reviewer', 'admin'), (req, res) => {
  const doc = getOwnedDocument(req, res);
  if (!doc) return;

  if (doc.status !== 'Uploaded') {
    return res.status(409).json({ error: `Cannot start review from status "${doc.status}"` });
  }

  db.prepare('UPDATE documents SET status = ? WHERE id = ? AND firm_id = ?').run(
    'Under Review',
    doc.id,
    req.user.firmId
  );

  logEvent({
    firmId: req.user.firmId,
    documentId: doc.id,
    actorUserId: req.user.userId,
    action: `started reviewing ${doc.file_name || doc.doc_type}`,
  });

  res.json({ ok: true });
});

router.post('/:id/approve', requireRole('reviewer', 'admin'), (req, res) => {
  const doc = getOwnedDocument(req, res);
  if (!doc) return;

  if (doc.status !== 'Under Review') {
    return res.status(409).json({ error: `Cannot approve from status "${doc.status}"` });
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE documents
     SET status = 'Approved', reviewed_by = ?, reviewed_at = ?, review_comment = NULL
     WHERE id = ? AND firm_id = ?`
  ).run(req.user.userId, now, doc.id, req.user.firmId);

  logEvent({
    firmId: req.user.firmId,
    documentId: doc.id,
    actorUserId: req.user.userId,
    action: 'approved document',
  });

  res.json({ ok: true });
});

router.post('/:id/request-correction', requireRole('reviewer', 'admin'), (req, res) => {
  const doc = getOwnedDocument(req, res);
  if (!doc) return;

  if (doc.status !== 'Under Review') {
    return res.status(409).json({ error: `Cannot request correction from status "${doc.status}"` });
  }

  const { comment } = req.body || {};
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'A comment explaining the correction is required' });
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE documents
     SET status = 'Correction Required', reviewed_by = ?, reviewed_at = ?, review_comment = ?
     WHERE id = ? AND firm_id = ?`
  ).run(req.user.userId, now, comment.trim(), doc.id, req.user.firmId);

  logEvent({
    firmId: req.user.firmId,
    documentId: doc.id,
    actorUserId: req.user.userId,
    action: 'requested correction',
    comment: comment.trim(),
  });

  res.json({ ok: true });
});

module.exports = router;
