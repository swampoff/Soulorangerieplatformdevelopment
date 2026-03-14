import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'soulorangerie-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Extract and verify user from Authorization header
export function getAuthUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  // Fetch full user from DB
  const user = db.prepare('SELECT id, email, name, role, plan, avatar FROM users WHERE id = ?').get(payload.userId);
  return user || null;
}

// Middleware for Hono
export function requireAuth() {
  return async (c, next) => {
    const user = getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('user', user);
    await next();
  };
}

export function requireRole(...roles) {
  return async (c, next) => {
    const user = getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    if (!roles.includes(user.role)) {
      return c.json({ error: `Forbidden: ${roles.join(' or ')} role required` }, 403);
    }
    c.set('user', user);
    await next();
  };
}
