import express from 'express';
import { resetPersistence, getPersistence } from '../persistence.js';
import { createRouter } from '../api.js';

export function createTestApp() {
  resetPersistence();
  getPersistence(':memory:');

  const app = express();
  app.use(express.json());
  app.use('/api', createRouter());

  return app;
}
