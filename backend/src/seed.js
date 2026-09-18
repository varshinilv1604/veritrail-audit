// Seeds two firms with isolated users/clients/documents, for demoing
// cross-tenant isolation. Runs automatically on server boot (see server.js).
const bcrypt = require('bcryptjs');
const db = require('./db');

const REQUIRED_DOCS = [
  'Bank Statement',
  'Sales Register',
  'Purchase Register',
  'GST Return',
  'Expense Summary',
];

function hash(pw) {
  return bcrypt.hashSync(pw, 10);
}

function seedFirm({ firmName, clientName, staff, reviewer, admin }) {
  const firmId = db
    .prepare('INSERT INTO firms (name) VALUES (?)')
    .run(firmName).lastInsertRowid;

  const insertUser = db.prepare(
    'INSERT INTO users (firm_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  );
  const staffId = insertUser.run(firmId, staff.name, staff.email, hash(staff.password), 'staff').lastInsertRowid;
  const reviewerId = insertUser.run(firmId, reviewer.name, reviewer.email, hash(reviewer.password), 'reviewer').lastInsertRowid;
  insertUser.run(firmId, admin.name, admin.email, hash(admin.password), 'admin');

  const clientId = db
    .prepare('INSERT INTO clients (firm_id, name) VALUES (?, ?)')
    .run(firmId, clientName).lastInsertRowid;

  const insertDoc = db.prepare(
    'INSERT INTO documents (firm_id, client_id, doc_type, status) VALUES (?, ?, ?, ?)'
  );
  for (const docType of REQUIRED_DOCS) {
    insertDoc.run(firmId, clientId, docType, 'Pending');
  }

  return { firmId, clientId, staffId, reviewerId };
}

seedFirm({
  firmName: 'ABC & Co.',
  clientName: 'ABC Traders Pvt. Ltd.',
  staff: { name: 'Rohit Sharma', email: 'rohit@abcco.test', password: 'password123' },
  reviewer: { name: 'Aman Gupta', email: 'aman@abcco.test', password: 'password123' },
  admin: { name: 'Priya Mehta', email: 'priya@abcco.test', password: 'password123' },
});

seedFirm({
  firmName: 'XYZ & Co.',
  clientName: 'XYZ Retail Ltd.',
  staff: { name: 'Neha Verma', email: 'neha@xyzco.test', password: 'password123' },
  reviewer: { name: 'Karan Singh', email: 'karan@xyzco.test', password: 'password123' },
  admin: { name: 'Divya Rao', email: 'divya@xyzco.test', password: 'password123' },
});

console.log('Seed complete: 2 firms, each with 1 client and 5 required documents.');
console.log('Login with any seeded email above and password: password123');
