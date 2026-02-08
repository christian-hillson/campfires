import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload, User } from '@campfires/shared';
import { getPersistence } from './persistence.js';

const JWT_SECRET = process.env.JWT_SECRET || 'campfires-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Simple password hashing (use bcrypt in production)
export function hashPassword(password: string): string {
  return createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
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

export function signup(
  email: string,
  password: string,
  displayName: string
): { user: User; token: string } | { error: string } {
  const db = getPersistence();

  // Check if user exists
  const existing = db.getUserByEmail(email);
  if (existing) {
    return { error: 'Email already registered' };
  }

  // Create user
  const passwordHash = hashPassword(password);
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

export function login(
  email: string,
  password: string
): { user: User; token: string } | { error: string } {
  const db = getPersistence();

  // Find user
  const userWithPassword = db.getUserByEmail(email);
  if (!userWithPassword) {
    return { error: 'Invalid email or password' };
  }

  // Verify password
  if (!verifyPassword(password, userWithPassword.passwordHash)) {
    return { error: 'Invalid email or password' };
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
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
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
