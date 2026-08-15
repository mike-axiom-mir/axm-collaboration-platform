#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const Core = require('./shardrunner-core.cjs');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 8820);
const ROOT = __dirname;
const CLIENT_FILE = path.join(ROOT, 'index.html');
const TICK_MS = 1000 / 30;
const STREAM_MS = 45;

function loadSeats() {
  try {
    const raw = JSON.parse(process.env.AXM_PLAYERS_JSON || '[]');
    if (Array.isArray(raw) && raw.length) return raw;
  } catch (e) {}
  return [{ display_name: 'Player 1', type: 'human' }];
}

let game = Core.create(loadSeats(), Date.now(), { seed: Number(process.env.GAME_SEED || 0x6a09e667) });
let last = Date.now();
const inputs = { p1: { moveX: 0, moveZ: 0, jump: false, pause: false } };
const streams = new Set();
let inputClearUntil = 0;

function parseInputJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 18000) req.destroy();
    });
    req.on('end', () => {
      if (!raw.length) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  res.end(data);
}

function serveFile(file, res, type) {
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  fs.createReadStream(file).pipe(res);
}

function assetPath(urlPath) {
  if (urlPath === '/index.html' || urlPath === '/') return CLIENT_FILE;
  const safe = path.join(ROOT, '..', '..', '..', urlPath.replace(/^\//, '')); // preserve as-is
  if (!safe.startsWith(ROOT) || !safe.startsWith(path.resolve(ROOT))) return null;
  return null;
}

function tick() {
  const now = Date.now();
  const dt = Math.min((now - last) / 1000, 0.08);
  last = now;
  Core.step(game, inputs, dt, now);
}

function stream() {
  const snapshot = 'data: ' + JSON.stringify(Core.publicState(game)) + '\n\n';
  for (const client of streams) {
    try {
      client.write(snapshot);
    } catch (e) {
      streams.delete(client);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    });
    return res.end();
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return serveFile(CLIENT_FILE, res, 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true, phase: game.phase, seat: game.seat && game.seat.id });
  }

  if (req.method === 'GET' && url.pathname === '/state') {
    return sendJson(res, 200, Core.publicState(game));
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*'
    });
    res.write('retry: 700\n\n');
    streams.add(res);
    req.on('close', () => streams.delete(res));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/vendor/')) {
    const file = path.resolve(ROOT, url.pathname.slice(1));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return sendJson(res, 404, { ok: false });
    const ext = path.extname(file).toLowerCase();
    const map = { '.js': 'application/javascript; charset=utf-8', '.wasm': 'application/octet-stream' };
    return serveFile(file, res, map[ext] || 'application/octet-stream');
  }

  if (req.method === 'POST' && url.pathname === '/input') {
    const raw = await parseInputJson(req);
    const player = url.searchParams.get('player');
    if (player !== 'p1') return sendJson(res, 403, { ok: false, error: 'single-seat experiment' });
    const now = Date.now();
    inputs.p1 = Core.sanitizeInput(raw, { clear: now < inputClearUntil });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/restart') {
    game = Core.create(loadSeats(), Date.now(), { seed: Date.now() ^ 0x9e3779b9 });
    inputs.p1 = { moveX: 0, moveZ: 0, jump: false, pause: false };
    last = Date.now();
    inputClearUntil = Date.now() + 300;
    return sendJson(res, 200, { ok: true, state: Core.publicState(game) });
  }

  return sendJson(res, 404, { ok: false, error: 'not found' });
});


server.listen(PORT, HOST, () => {
  console.log('Shardrunner 022 listening on http://127.0.0.1:' + PORT + '/?room=AXM1&player=p1');
});

setInterval(tick, TICK_MS);
setInterval(stream, STREAM_MS);
