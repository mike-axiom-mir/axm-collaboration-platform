#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8814);
const GAME_ID = '014-bonk-and-bolt';
const GAME_PREFIX = '/games/014/';
const startedAt = Date.now();
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8'
};

function safeFile(urlPath) {
  let relative;
  try { relative = decodeURIComponent(String(urlPath || '/').split('?')[0]); }
  catch (_) { return null; }
  if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else if (relative === '/games/014') relative = '';
  else if (relative === '/') relative = '';
  else if (/^\/(?:index\.html|app\.js|game-data\.js|systems\.js|styles\.css|assets\/|vendor\/)/.test(relative)) relative = relative.slice(1);
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
    team: { humanSeats: 2, localSharedScreen: true, splitScreen: false },
    authority: {
      launchSession: 'managed-local-server',
      worldSave: 'browser-local-persistent',
      realtimeSimulation: 'browser-local',
      note: 'The Game Hub owns the launch session. Gameplay and the portable offline save remain on the local browser in this first edition.'
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
          status: 'FIRST EDITION',
          localOnly: true,
          gameHubSessionAuthority: 'server',
          worldSaveAuthority: 'browser-local-persistent',
          realtimeSimulationAuthority: 'browser-local',
          minPlayers: 1,
          maxPlayers: 2,
          renderer: 'Three.js r160 WebGL',
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
        });
      }
      if (request.method === 'GET' && url.pathname === '/api/launcher-state') return sendJson(response, 200, launcherState());
      if (request.method === 'GET' && url.pathname === '/api/observation') {
        return sendJson(response, 200, {
          ok: true,
          schema: 'bonk-bolt-runtime-observation/v1',
          runtime: 'ready',
          saveLocation: 'localStorage:bonk-and-bolt-save-v1',
          supports: ['solo', 'two-player-local-coop', 'keyboard-mouse', 'gamepad-p2', 'persistent-world', '24-hour-finale'],
          limitation: 'This endpoint proves runtime availability, not browser-rendered gameplay state.'
        });
      }
      if (url.pathname === '/') {
        response.writeHead(302, { location: GAME_PREFIX, 'cache-control': 'no-store' });
        return response.end();
      }
      const file = safeFile(url.pathname);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return response.end('Bonk & Bolt route not found.');
      }
      const extension = path.extname(file).toLowerCase();
      response.writeHead(200, {
        'content-type': MIME[extension] || 'application/octet-stream',
        'cache-control': /\.(?:html|js|css|json)$/i.test(file) ? 'no-store' : 'public, max-age=3600',
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
  runtime.server.listen(PORT, HOST, () => console.log('Bonk & Bolt listening on http://' + HOST + ':' + PORT));
}

module.exports = { GAME_ID, GAME_PREFIX, HOST, PORT, createRuntime, launcherState, safeFile };
