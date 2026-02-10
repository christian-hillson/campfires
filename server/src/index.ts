import express from 'express';
import cors from 'cors';
import http from 'http';
import { router } from './api.js';
import { createWebSocketServer } from './ws-server.js';
import { getPersistence } from './persistence.js';
import { Summarizer } from './summarizer.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DB_PATH = process.env.DB_PATH || './campfires.db';

// Initialize persistence
console.log(`Initializing database at ${DB_PATH}...`);
getPersistence(DB_PATH);

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Create summarizer
const summarizer = new Summarizer();

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

  // Start summarizer and run initial tick
  summarizer.start();
  summarizer.runOnce();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  summarizer.stop();
  wss.close();
  server.close(() => {
    getPersistence().close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  summarizer.stop();
  wss.close();
  server.close(() => {
    getPersistence().close();
    process.exit(0);
  });
});
