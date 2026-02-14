import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { router } from './api.js';
import { createWebSocketServer } from './ws-server.js';
import { getPersistence } from './persistence.js';
import { Summarizer } from './summarizer.js';
import { SessionCleaner } from './session-cleaner.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DB_PATH = process.env.DB_PATH || './campfires.db';

// Initialize persistence
console.log(`Initializing database at ${DB_PATH}...`);
getPersistence(DB_PATH);

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

// Mount API routes
app.use('/api', router);

// Also expose health at root for convenience
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = createWebSocketServer(server);

// Create summarizer and session cleaner
const summarizer = new Summarizer();
const sessionCleaner = new SessionCleaner();

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔥 Campfires Server running on http://localhost:${PORT}   ║
║                                                           ║
║   REST API:    http://localhost:${PORT}/api                 ║
║   Health:      http://localhost:${PORT}/health              ║
║   WebSocket:   ws://localhost:${PORT}/campfire/:teamId      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Start summarizer and session cleaner
  summarizer.start();
  summarizer.runOnce().catch((err) => console.error('[Summarizer] Initial run error:', err));
  sessionCleaner.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  summarizer.stop();
  sessionCleaner.stop();
  wss.close();
  server.close(() => {
    getPersistence().close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  summarizer.stop();
  sessionCleaner.stop();
  wss.close();
  server.close(() => {
    getPersistence().close();
    process.exit(0);
  });
});
