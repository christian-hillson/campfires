import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './setup.js';
import { signupAndGetToken } from './helpers.js';

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
});
