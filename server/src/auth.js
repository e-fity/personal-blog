import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.ADMIN_SECRET || 'digital-garden-local-secret-change-me';
const TOKEN_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function issueToken(username) {
  return signToken({ username, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload || !payload.username) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }
  req.admin = payload;
  next();
}
