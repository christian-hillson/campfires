import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload, User } from '@campfires/shared';
import { getPersistence } from './persistence.js';
import { auditAuthFailure } from './audit-log.js';

// ============================================
// WebSocket Upgrade Tokens (single-use, 30s TTL)
// ============================================

const WS_TOKEN_TTL_MS = 30_000;

interface WsTokenEntry {
  payload: JwtPayload;
  expiresAt: number;
}

const wsTokenStore: Map<string, WsTokenEntry> = new Map();

// Cleanup expired tokens every 10 seconds
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of wsTokenStore) {
    if (entry.expiresAt <= now) {
      wsTokenStore.delete(token);
    }
  }
}, 10_000);

export function createWsToken(payload: JwtPayload): string {
  const token = randomBytes(32).toString('hex');
  wsTokenStore.set(token, {
    payload,
    expiresAt: Date.now() + WS_TOKEN_TTL_MS,
  });
  return token;
}

export function consumeWsToken(token: string): JwtPayload | null {
  const entry = wsTokenStore.get(token);
  if (!entry) return null;
  wsTokenStore.delete(token); // single-use: delete immediately
  if (entry.expiresAt <= Date.now()) return null;
  return entry.payload;
}

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Legacy SHA256 hash (for migration from old passwords)
function legacySha256Hash(password: string): string {
  return createHash('sha256')
    .update(password + JWT_SECRET)
    .digest('hex');
}

function isLegacyHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Migration path: check if this is an old SHA256 hash
  if (isLegacyHash(hash)) {
    return legacySha256Hash(password) === hash;
  }
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function signup(
  email: string,
  password: string,
  displayName: string,
): Promise<{ user: User; token: string } | { error: string }> {
  const db = getPersistence();

  // Check if user exists
  const existing = db.getUserByEmail(email);
  if (existing) {
    return { error: 'Email already registered' };
  }

  // Create user
  const passwordHash = await hashPassword(password);
  const user = db.createUser(email, passwordHash, displayName, 'human');

  // Generate token
  const payload: JwtPayload = {
    userId: user.userId,
    email: user.email,
    teamId: null,
    orgId: null,
    type: user.type,
  };

  const token = generateToken(payload);

  return { user, token };
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: User; token: string } | { error: string }> {
  const db = getPersistence();

  // Find user
  const userWithPassword = db.getUserByEmail(email);
  if (!userWithPassword) {
    return { error: 'Invalid email or password' };
  }

  // Verify password
  if (!(await verifyPassword(password, userWithPassword.passwordHash))) {
    return { error: 'Invalid email or password' };
  }

  // Migration: upgrade legacy SHA256 hash to bcrypt on successful login
  if (isLegacyHash(userWithPassword.passwordHash)) {
    const newHash = await hashPassword(password);
    db.updateUserPasswordHash(userWithPassword.userId, newHash);
  }

  // Get user without password hash
  const user = db.getUser(userWithPassword.userId);
  if (!user) {
    return { error: 'User not found' };
  }

  // Generate token
  const payload: JwtPayload = {
    userId: user.userId,
    email: user.email,
    teamId: user.teamId || null,
    orgId: user.orgId || null,
    type: user.type,
  };

  const token = generateToken(payload);

  return { user, token };
}

export function refreshToken(oldToken: string): { token: string } | { error: string } {
  const payload = verifyToken(oldToken);
  if (!payload) {
    return { error: 'Invalid or expired token' };
  }

  const db = getPersistence();
  const user = db.getUser(payload.userId);
  if (!user) {
    return { error: 'User not found' };
  }

  const newPayload: JwtPayload = {
    userId: user.userId,
    email: user.email,
    teamId: user.teamId || null,
    orgId: user.orgId || null,
    type: user.type,
  };

  const token = generateToken(newPayload);

  return { token };
}

// Express middleware for authentication
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    auditAuthFailure(req, 'No token provided');
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    auditAuthFailure(req, 'Invalid or expired token');
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = payload;
  next();
}

// Optional auth middleware - sets user if token present but doesn't require it
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}
