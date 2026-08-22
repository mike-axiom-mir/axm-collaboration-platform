#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8818);
const GAME_ID = '018-last-stop-nebula';
const GAME_PREFIX = '/games/018/';
const startedAt = Date.now();
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function safeFile(urlPath) {
  let relative;
  try { relative = decodeURIComponent(String(urlPath || '/').split('?')[0]); }
  catch (_) { return null; }
  if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else if (relative === '/games/018') relative = '';
  else if (relative === '/') relative = '';
  else return null;
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const candidate = path.resolve(__dirname, relative.replace(/^\/+/, ''));
  return candidate === __dirname || candidate.startsWith(__dirname + path.sep) ? candidate : null;
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff'
  });
  response.end(JSON.stringify(data));
}

function launcherState() {
  return {
    ok: true,
    schema: 'axm.game-runtime-launcher-state/v1',
    gameId: GAME_ID,
    playablePath: GAME_PREFIX,
    controllerLinks: [],
    partyScreenLinks: { all: GAME_PREFIX },
    team: { humanSeats: 1, localSharedScreen: false, splitScreen: false },
    authority: {
      launchSession: 'managed-local-server',
      runSave: 'browser-local-persistent',
      realtimeSimulation: 'browser-local',
      note: 'The server only launches the offline files. The browser owns gameplay, score, and save state.'
    },
    localOnly: true
  };
}

function createRuntime() {
  const server = http.createServer((request, response) => {
    try {
      if (request.method === 'OPTIONS') return sendJson(response, 200, { ok: true });
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, {
          ok: true,
          gameId: GAME_ID,
          status: 'BETA',
          localOnly: true,
          gameHubSessionAuthority: 'server',
          runSaveAuthority: 'browser-local-persistent',
          realtimeSimulationAuthority: 'browser-local',
          minPlayers: 1,
          maxPlayers: 1,
          renderer: 'Three.js r160 WebGL',
          version: '0.26.0-beta',
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
        });
      }
      if (request.method === 'GET' && url.pathname === '/api/launcher-state') return sendJson(response, 200, launcherState());
      if (request.method === 'GET' && url.pathname === '/api/observation') {
        return sendJson(response, 200, {
          ok: true,
          schema: 'last-stop-nebula-runtime-observation/v1',
          runtime: 'ready',
          saveLocation: 'localStorage:last-stop-nebula-save-v1',
          recordLocation: 'localStorage:last-stop-nebula-record-v1',
          balanceLedgerLocation: 'localStorage:last-stop-nebula-run-ledger-v1 (last 24 compact run summaries)',
          supports: ['single-player', 'keyboard-mouse', 'touch', 'persistent-run', 'local-balance-ledger', 'three-retirement-contracts', 'procedural-3d-station'],
          limitation: 'This endpoint proves local runtime availability, not rendered WebGL appearance or a completed gameplay journey.'
        });
      }
      if (url.pathname === '/') {
        response.writeHead(302, { location: GAME_PREFIX, 'cache-control': 'no-store' });
        return response.end();
      }
      const file = safeFile(url.pathname);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return response.end('Last Stop: Nebula route not found.');
      }
      const extension = path.extname(file).toLowerCase();
      response.writeHead(200, {
        'content-type': MIME[extension] || 'application/octet-stream',
        'cache-control': /\.(?:html|m?js|css|json)$/i.test(file) ? 'no-store' : 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; media-src 'none'; object-src 'none'; frame-ancestors 'self'"
      });
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
  });
  return { server, launcherState };
}

if (require.main === module) {
  const runtime = createRuntime();
  runtime.server.listen(PORT, HOST, () => console.log(`Last Stop: Nebula listening on http://${HOST}:${PORT}${GAME_PREFIX}`));
}

module.exports = { GAME_ID, GAME_PREFIX, HOST, PORT, createRuntime, launcherState, safeFile };
