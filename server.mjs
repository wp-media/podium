#!/usr/bin/env node
// Thin shim — delegates to the full Express + SQLite + WebSocket server.
// Kept at the repo root so the /podium skill's SERVER_SCRIPT path stays stable.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { createApp, startServer, startBackgroundServices } = require(
  join(__dirname, 'dashboard', 'server', 'index.js')
);

const PORT = parseInt(process.env.DASHBOARD_PORT || '4820', 10);
const app = createApp();
let httpServer = null;

startServer(app, PORT).then((server) => {
  httpServer = server;
  startBackgroundServices();
});

const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down…`);
  if (httpServer) {
    // Close new connections immediately; destroy existing keep-alive/SSE/WS
    // connections so the process doesn't wait up to 5 s for them to drain.
    if (typeof httpServer.closeAllConnections === 'function') {
      httpServer.closeAllConnections(); // Node 18.2+
    }
    httpServer.close();
  }
  try { require(join(__dirname, 'dashboard', 'server', 'db.js')).db.close(); } catch { /* ok */ }
  try { require(join(__dirname, 'dashboard', 'server', 'lib', 'server-info.js')).removeServerInfo(); } catch { /* ok */ }
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
