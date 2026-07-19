#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const GAME_ROOT = path.join(__dirname, 'game');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8800);
const GAME_PREFIX = '/games/010/';
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.woff2': 'font/woff2'
};

function selectedMode(env) {
  const value = String((env || process.env).AXM_GAME_PLAY_MODE || 'tycoon').trim();
  return value === 'walkable-globe' ? 'walkable-globe' : 'tycoon';
}

function modeEntry(mode) {
  return mode === 'walkable-globe'
    ? GAME_PREFIX
    : GAME_PREFIX + 'game/tycoon-steward/';
}

function safeFile(urlPath) {
  let relative = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else if (relative === '/games/010') relative = '';
  else return null;
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const candidate = path.resolve(GAME_ROOT, relative.replace(/^\/+/, ''));
  return candidate === GAME_ROOT || candidate.startsWith(GAME_ROOT + path.sep) ? candidate : null;
}

function sendJson(response, status, value) {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  response.end(JSON.stringify(value, null, 2));
}

function createServer(options) {
  options = options || {};
  const env = options.env || process.env;
  return http.createServer((request, response) => {
    const mode = selectedMode(env);
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/health') return sendJson(response, 200, {ok: true, gameId: '010-living-globe-tycoon', mode, localOnly: true});
    if (pathname === '/api/launcher-state') return sendJson(response, 200, {
      ok: true,
      schema: 'axm.game-runtime-launcher-state/v1',
      gameId: '010-living-globe-tycoon',
      playMode: mode,
      controllerLinks: [],
      partyScreenLinks: {all: modeEntry(mode)},
      authority: {session: 'managed-server', world: 'browser-local-game-package'}
    });
    if (pathname === '/') {
      response.writeHead(302, {location: modeEntry(mode), 'cache-control': 'no-store'});
      return response.end();
    }
    const file = safeFile(pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404, {'content-type': 'text/plain; charset=utf-8'});
      return response.end('Living Globe Tycoon route not found.');
    }
    response.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': /\.(?:html|js|css|json)$/i.test(file) ? 'no-store' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff'
    });
    fs.createReadStream(file).pipe(response);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => console.log('AXM Living Globe Tycoon listening on http://' + HOST + ':' + PORT));
}

module.exports = {GAME_ROOT, GAME_PREFIX, createServer, modeEntry, safeFile, selectedMode};
