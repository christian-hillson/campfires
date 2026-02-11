import express from 'express';
import { resetPersistence, getPersistence } from '../persistence.js';
import { router } from '../api.js';

export function createTestApp() {
  resetPersistence();
  getPersistence(':memory:');

  const app = express();
  app.use(express.json());
  app.use('/api', router);

  return app;
}
