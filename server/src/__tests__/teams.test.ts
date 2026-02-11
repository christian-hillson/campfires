import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './setup.js';
import { signupAndGetToken } from './helpers.js';

describe('Teams API', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  async function createOrgAndTeam(app: Express, token: string) {
    const orgRes = await request(app)
      .post('/api/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Org' })
      .expect(201);

    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgId: orgRes.body.orgId, name: 'Alpha Team' })
      .expect(201);

    return { org: orgRes.body, team: teamRes.body };
  }

  describe('POST /api/teams', () => {
    it('creates a team and auto-joins creator', async () => {
      const { token, user } = await signupAndGetToken(app);

      const orgRes = await request(app)
        .post('/api/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Org' })
        .expect(201);

      const res = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${token}`)
        .send({ orgId: orgRes.body.orgId, name: 'Alpha Team' })
        .expect(201);

      expect(res.body.teamId).toBeDefined();
      expect(res.body.name).toBe('Alpha Team');
      expect(res.body.inviteCode).toBeDefined();

      // Verify creator was auto-joined
      const membersRes = await request(app)
        .get(`/api/teams/${res.body.teamId}/members`)
        .expect(200);

      expect(membersRes.body).toHaveLength(1);
      expect(membersRes.body[0].userId).toBe(user.userId);
    });

    it('returns 401 without auth', async () => {
      await request(app).post('/api/teams').send({ orgId: 'org-1', name: 'Team' }).expect(401);
    });

    it('returns 400 when required fields are missing', async () => {
      const { token } = await signupAndGetToken(app);

      await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Team' })
        .expect(400);
    });
  });

  describe('POST /api/teams/join', () => {
    it('joins a team via invite code', async () => {
      const { token: creatorToken } = await signupAndGetToken(app, {
        email: 'creator@example.com',
      });
      const { team } = await createOrgAndTeam(app, creatorToken);

      const { token: joinerToken } = await signupAndGetToken(app, {
        email: 'joiner@example.com',
      });

      const res = await request(app)
        .post('/api/teams/join')
        .set('Authorization', `Bearer ${joinerToken}`)
        .send({ inviteCode: team.inviteCode })
        .expect(200);

      expect(res.body.team.teamId).toBe(team.teamId);
      expect(res.body.token).toBeDefined();
    });

    it('returns 404 for bad invite code', async () => {
      const { token } = await signupAndGetToken(app);

      await request(app)
        .post('/api/teams/join')
        .set('Authorization', `Bearer ${token}`)
        .send({ inviteCode: 'BADCODE1' })
        .expect(404);
    });

    it('returns 400 when invite code is missing', async () => {
      const { token } = await signupAndGetToken(app);

      await request(app)
        .post('/api/teams/join')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/teams/:id/members', () => {
    it('returns team members', async () => {
      const { token } = await signupAndGetToken(app);
      const { team } = await createOrgAndTeam(app, token);

      const res = await request(app).get(`/api/teams/${team.teamId}/members`).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for unknown team', async () => {
      await request(app).get('/api/teams/nonexistent/members').expect(404);
    });
  });
});
