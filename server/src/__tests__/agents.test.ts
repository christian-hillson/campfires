import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from './setup.js';
import { signupAndGetToken } from './helpers.js';

describe('Agents API', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  async function setupUserWithTeam(app: Express) {
    const { token, user } = await signupAndGetToken(app);

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

    // Join the team to get an updated token with teamId/orgId
    const joinRes = await request(app)
      .post('/api/teams/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ inviteCode: teamRes.body.inviteCode })
      .expect(200);

    return {
      token: joinRes.body.token as string,
      user,
      org: orgRes.body,
      team: teamRes.body,
    };
  }

  describe('POST /api/agents', () => {
    it('registers an agent for a human user on a team', async () => {
      const { token } = await setupUserWithTeam(app);

      const res = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'My Claude' })
        .expect(201);

      expect(res.body.agent).toBeDefined();
      expect(res.body.agent.type).toBe('agent');
      expect(res.body.agent.displayName).toBe('My Claude');
      expect(res.body.token).toBeDefined();
    });

    it('returns 400 when user has no team', async () => {
      const { token } = await signupAndGetToken(app);

      await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(app).post('/api/agents').send({}).expect(401);
    });
  });

  describe('POST /api/agents/activity', () => {
    it('records an activity event', async () => {
      const { token } = await setupUserWithTeam(app);

      // Register agent
      const agentRes = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);

      const agentToken = agentRes.body.token;

      const res = await request(app)
        .post('/api/agents/activity')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ type: 'commit', message: 'Fix bug', branch: 'main' })
        .expect(201);

      expect(res.body.type).toBe('commit');
      expect(res.body.message).toBe('Fix bug');
    });

    it('returns 400 when type is missing', async () => {
      const { token } = await setupUserWithTeam(app);

      // Register agent
      const agentRes = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);

      await request(app)
        .post('/api/agents/activity')
        .set('Authorization', `Bearer ${agentRes.body.token}`)
        .send({ message: 'Fix bug' })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(app).post('/api/agents/activity').send({ type: 'commit' }).expect(401);
    });
  });
});
