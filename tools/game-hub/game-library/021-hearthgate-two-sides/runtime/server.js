#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

function resolveHost(source) {
  const environment = source || process.env;
  return environment.HOST || (environment.AXM_MANAGED_BY_GAME_HUB === '1' ? '0.0.0.0' : '127.0.0.1');
}

const HOST = resolveHost(process.env);
const PORT = Number(process.env.PORT || 8821);
const GAME_ID = '021-hearthgate-two-sides';
const GAME_PREFIX = '/games/021/';
const RUNTIME_DIR = __dirname;
const INPUT_TTL_MS = 650;
const VALID_PLAYERS = new Set(['p1', 'p2']);

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function playersFromEnvironment() {
  try {
    const parsed = JSON.parse(process.env.AXM_PLAYERS_JSON || '[]');
    if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 2);
  } catch (_) {}
  return [{ seat_id: 'local-p1', slot: 1, type: 'human', display_name: process.env.AXM_P1_NAME || 'Warden One' }];
}

function launchConfig() {
  const players = playersFromEnvironment();
  return {
    schema: 'axm.hearthgate-launch/v1',
    gameId: GAME_ID,
    managedByGameHub: process.env.AXM_MANAGED_BY_GAME_HUB === '1',
    sessionId: process.env.AXM_GAME_SESSION_ID || null,
    requestedMode: process.env.AXM_GAME_MODE || null,
    defaultGameMode: players.length >= 2 ? 'coop' : 'single',
    players: players.map((player, index) => ({
      id: `p${index + 1}`,
      seatId: player.seat_id || player.seatId || null,
      slot: Number(player.slot || index + 1),
      type: player.type || 'human',
      displayName: player.display_name || player.name || `Warden ${index + 1}`
    })),
    controls: {
      protocol: 'axm-semantic-input-v1',
      gamepadProfile: 'axm-universal-xbox-brawl-v0.2.1',
      localGamepads: true,
      phoneControllers: true,
      controllerPath: '/controller.html?player={player}'
    }
  };
}

function safeFile(urlPath) {
  let relative;
  try { relative = decodeURIComponent(String(urlPath || '/').split('?')[0]); }
  catch (_) { return null; }
  if (relative === '/' || relative === GAME_PREFIX || relative === '/games/021') relative = 'index.html';
  else if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else relative = relative.replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const candidate = path.resolve(RUNTIME_DIR, relative);
  if (candidate !== RUNTIME_DIR && !candidate.startsWith(RUNTIME_DIR + path.sep)) return null;
  return candidate;
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  response.end(JSON.stringify(value));
}

function readJson(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = '';
    const limit = maxBytes || 16 * 1024;
    request.on('data', chunk => {
      body += chunk;
      if (body.length > limit) request.destroy(new Error('request body too large'));
    });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (_) { reject(new Error('invalid JSON')); }
    });
    request.on('error', reject);
  });
}

function axis(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-1, Math.min(1, number)) : 0;
}

function createServer() {
  const inputs = {};
  return http.createServer(async (request, response) => {
    const pathname = String(request.url || '/').split('?')[0];
    if (pathname === '/health') {
      sendJson(response, 200, { ok: true, status: 'ok', gameId: GAME_ID, stateAuthority: 'browser-local' });
      return;
    }
    if (pathname === '/api/input' && request.method === 'POST') {
      try {
        const body = await readJson(request);
        const player = String(body.player || '');
        if (!VALID_PLAYERS.has(player)) { sendJson(response, 400, { error: 'unknown player id' }); return; }
        const previous = inputs[player] || { edges: { fire: 0, volley: 0, upgrade: 0, repair: 0, fortify: 0, blueprint: 0, build: 0, pause: 0, back: 0 } };
        const incomingEdges = body.edges && typeof body.edges === 'object' ? body.edges : {};
        const edges = Object.assign({}, previous.edges);
        Object.keys(edges).forEach(key => { if (incomingEdges[key]) edges[key] += 1; });
        const fireAimX = incomingEdges.fire ? axis(body.fireAimX === undefined ? body.aimX : body.fireAimX) : axis(previous.fireAimX);
        const fireAimY = incomingEdges.fire ? axis(body.fireAimY === undefined ? body.aimY : body.fireAimY) : axis(previous.fireAimY);
        inputs[player] = {
          protocol: 'axm-semantic-input-v1',
          player,
          moveX: axis(body.moveX), moveY: axis(body.moveY),
          aimX: axis(body.aimX), aimY: axis(body.aimY),
          fire: Boolean(body.fire), buildHeld: Boolean(body.buildHeld), fireAimX, fireAimY, edges,
          sequence: Math.max(Number(previous.sequence || 0) + 1, Number(body.sequence || 0)),
          updatedAt: Date.now()
        };
        sendJson(response, 200, { ok: true, sequence: inputs[player].sequence });
      } catch (error) { sendJson(response, 400, { error: error.message }); }
      return;
    }
    if (pathname === '/api/input' && request.method === 'GET') {
      const now = Date.now();
      const fresh = {};
      const phoneStatus = {};
      Object.keys(inputs).forEach(player => {
        const connected = now - inputs[player].updatedAt <= INPUT_TTL_MS;
        if (connected) fresh[player] = inputs[player];
        phoneStatus[player] = connected ? 'fresh' : 'disconnected';
      });
      sendJson(response, 200, { protocol: 'axm-semantic-input-v1', inputs: fresh, phoneStatus, ttlMs: INPUT_TTL_MS });
      return;
    }
    if (pathname === '/api/launch-config' || pathname === '/api/launcher-state') {
      const config = launchConfig();
      if (pathname === '/api/launcher-state') {
        config.controllerLinks = config.players.map(player => ({ seatId: player.seatId, slot: player.slot, displayName: player.displayName, url: `/controller.html?player=${player.id}` }));
        config.partyScreenLinks = { all: '/' };
      }
      sendJson(response, 200, config);
      return;
    }
    if (pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'unknown endpoint' });
      return;
    }
    const filePath = safeFile(request.url);
    if (!filePath) {
      sendJson(response, 404, { error: 'not found' });
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        sendJson(response, 404, { error: 'not found' });
        return;
      }
      response.writeHead(200, {
        'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      });
      response.end(data);
    });
  });
}

if (require.main === module) {
  createServer().listen(PORT, HOST, () => {
    console.log(`Hearthgate server listening on http://${HOST}:${PORT}/`);
  });
}

module.exports = { createServer, launchConfig, playersFromEnvironment, safeFile, resolveHost, GAME_ID, GAME_PREFIX, INPUT_TTL_MS, PORT, HOST };
