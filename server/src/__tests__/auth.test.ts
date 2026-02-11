import { createHash } from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './setup.js';
import { signupAndGetToken } from './helpers.js';
import { getPersistence } from '../persistence.js';

describe('Auth API', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/signup', () => {
    it('creates a new user and returns a token', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'alice@example.com', password: 'pass123', displayName: 'Alice' })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user.displayName).toBe('Alice');
      expect(res.body.user.type).toBe('human');
    });

    it('rejects duplicate email', async () => {
      await signupAndGetToken(app, { email: 'dup@example.com' });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'dup@example.com', password: 'pass123', displayName: 'Dup' })
        .expect(400);

      expect(res.body.error).toMatch(/already registered/i);
    });

    it('returns 400 when fields are missing', async () => {
      await request(app).post('/api/auth/signup').send({ email: 'x@x.com' }).expect(400);
      await request(app)
        .post('/api/auth/signup')
        .send({ email: 'x@x.com', password: 'p' })
        .expect(400);
      await request(app).post('/api/auth/signup').send({}).expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns a token for valid credentials', async () => {
      await signupAndGetToken(app, { email: 'bob@example.com', password: 'secret' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bob@example.com', password: 'secret' })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('bob@example.com');
    });

    it('returns 401 for wrong password', async () => {
      await signupAndGetToken(app, { email: 'bob@example.com', password: 'secret' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bob@example.com', password: 'wrong' })
        .expect(401);

      expect(res.body.error).toMatch(/invalid/i);
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'pass' })
        .expect(401);

      expect(res.body.error).toMatch(/invalid/i);
    });

    it('returns 400 when fields are missing', async () => {
      await request(app).post('/api/auth/login').send({ email: 'x@x.com' }).expect(400);
      await request(app).post('/api/auth/login').send({}).expect(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns a new token for a valid token', async () => {
      const { token } = await signupAndGetToken(app);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.token).toBeDefined();
    });

    it('returns 401 without a token', async () => {
      await request(app).post('/api/auth/refresh').expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Rate limiting', () => {
    it('returns 429 after exceeding max attempts on login', async () => {
      await signupAndGetToken(app, { email: 'target@example.com', password: 'secret' });

      // Signup used 1 of 5 allowed attempts. Make 4 more failed login attempts.
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'target@example.com', password: 'wrong' })
          .expect(401);
      }

      // Next attempt should be rate limited (6th total auth request)
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'target@example.com', password: 'wrong' })
        .expect(429);

      expect(res.body.error).toMatch(/too many/i);
    });
  });

  describe('bcrypt migration', () => {
    it('logs in with a legacy SHA256 hash and upgrades it to bcrypt', async () => {
      const password = 'migrationtest';
      const jwtSecret = 'campfires-dev-secret-change-in-production';
      const legacyHash = createHash('sha256')
        .update(password + jwtSecret)
        .digest('hex');

      // Directly insert a user with a legacy SHA256 hash
      const db = getPersistence();
      db.createUser('legacy@example.com', legacyHash, 'Legacy User', 'human');

      // Login should succeed with old hash
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'legacy@example.com', password })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('legacy@example.com');

      // Verify the hash was upgraded to bcrypt (starts with $2a$ or $2b$)
      const updatedUser = db.getUserByEmail('legacy@example.com');
      expect(updatedUser!.passwordHash).toMatch(/^\$2[ab]\$/);

      // Login should still work after migration
      const res2 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'legacy@example.com', password })
        .expect(200);

      expect(res2.body.token).toBeDefined();
    });
  });
});
