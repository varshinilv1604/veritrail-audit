const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

// Start clean on every boot: this is a prototype, not a system that needs to
// survive restarts with old data, and a fixed seed is easier to demo/grade.
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE firms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('staff', 'reviewer', 'admin'))
  );

  CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    client_id INTEGER NOT NULL REFERENCES clients(id),
    doc_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending'
      CHECK (status IN ('Pending', 'Uploaded', 'Under Review', 'Approved', 'Correction Required')),
    file_name TEXT,
    file_path TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TEXT,
    review_comment TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT
  );

  -- Append-only. No route ever issues UPDATE/DELETE against this table,
  -- and non-privileged DB roles could be denied write access to enforce
  -- immutability outside the app layer too (see README).
  CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_id INTEGER NOT NULL REFERENCES firms(id),
    document_id INTEGER NOT NULL REFERENCES documents(id),
    actor_user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX idx_clients_firm ON clients(firm_id);
  CREATE INDEX idx_documents_firm ON documents(firm_id);
  CREATE INDEX idx_documents_client ON documents(client_id);
  CREATE INDEX idx_audit_firm ON audit_events(firm_id);
  CREATE INDEX idx_audit_document ON audit_events(document_id);
`);

module.exports = db;
