import type { Express } from 'express';
import request from 'supertest';

export async function signupAndGetToken(
  app: Express,
  overrides: { email?: string; password?: string; displayName?: string } = {},
) {
  const email = overrides.email ?? 'test@example.com';
  const password = overrides.password ?? 'password123';
  const displayName = overrides.displayName ?? 'Test User';

  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email, password, displayName })
    .expect(201);

  return {
    token: res.body.token as string,
    user: res.body.user,
  };
}
