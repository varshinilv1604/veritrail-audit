const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a value.');
}

function issueToken(user) {
  // firm_id and role are baked into the signed token, not read from the
  // request body/query on later calls, so a client can't just pass a
  // different firmId to reach another firm's data.
  return jwt.sign(
    { userId: user.id, firmId: user.firm_id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { userId, firmId, role, name }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

module.exports = { issueToken, requireAuth, requireRole };
