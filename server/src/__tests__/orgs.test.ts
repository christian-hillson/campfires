import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './setup.js';
import { signupAndGetToken } from './helpers.js';

describe('Orgs API', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/orgs', () => {
    it('creates an org when authenticated', async () => {
      const { token } = await signupAndGetToken(app);

      const res = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme Corp', mission: 'Build stuff' })
        .expect(201);

      expect(res.body.orgId).toBeDefined();
      expect(res.body.name).toBe('Acme Corp');
      expect(res.body.mission).toBe('Build stuff');
    });

    it('returns 401 without auth', async () => {
      await request(app).post('/api/orgs').send({ name: 'Acme' }).expect(401);
    });

    it('returns 400 when name is missing', async () => {
      const { token } = await signupAndGetToken(app);

      await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/orgs/:id', () => {
    it('returns an org by id', async () => {
      const { token } = await signupAndGetToken(app);

      const created = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme' })
        .expect(201);

      const res = await request(app).get(`/api/orgs/${created.body.orgId}`).expect(200);

      expect(res.body.name).toBe('Acme');
    });

    it('returns 404 for unknown org', async () => {
      await request(app).get('/api/orgs/nonexistent').expect(404);
    });
  });

  describe('PUT /api/orgs/:id', () => {
    it('returns 403 when user is not in the org', async () => {
      const { token } = await signupAndGetToken(app);

      // Create org (user is not auto-joined to org, only to team)
      const created = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme' })
        .expect(201);

      // User's JWT has no orgId, so update should be 403
      await request(app)
        .put(`/api/orgs/${created.body.orgId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' })
        .expect(403);
    });

    it('returns 401 without auth', async () => {
      await request(app).put('/api/orgs/some-id').send({ name: 'Updated' }).expect(401);
    });
  });
});
