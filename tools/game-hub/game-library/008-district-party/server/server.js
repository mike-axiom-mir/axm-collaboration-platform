'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { URL } = require('node:url');
const {
  BUILD_NAME,
  BUILD_VERSION,
  DEFAULT_PORT,
  DEFAULT_ROOM,
  MAX_JSON_BODY_BYTES,
} = require('../shared/constants');
const { isValidSessionId } = require('../shared/validation');
const { validatePartyId } = require('../foundation-adapter/display-router');
const { parseAXMPlayersJSON } = require('../foundation-adapter/player-normalizer');
const { serializeStaticWorld, serializeWorldState } = require('./display-state');
const { getControllerInfo, routeInput } = require('./input-router');
const { getAdapterObservation } = require('./seat-observation');
const { SessionManager } = require('./session-manager');
const { WorldLoop } = require('./world-loop');

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
});

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
  );
  response.setHeader('Cache-Control', 'no-store');
}

function sendJson(response, statusCode, payload) {
  setSecurityHeaders(response);
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

function sendText(response, statusCode, body) {
  setSecurityHeaders(response);
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

function readJsonBody(request, limit = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let failed = false;
    const chunks = [];
    request.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        failed = true;
        chunks.length = 0;
        const error = Object.assign(new Error('Request body exceeds the local runtime limit.'), { code: 'BODY_TOO_LARGE' });
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (failed) return;
      if (size === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(Object.assign(new Error(`Malformed JSON body: ${error.message}`), { code: 'MALFORMED_JSON' }));
      }
    });
    request.on('error', reject);
  });
}

function isLoopbackAddress(address) {
  if (typeof address !== 'string') return false;
  const normalized = address.toLowerCase();
  return normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === 'localhost'
    || normalized.startsWith('::ffff:127.');
}

function privateLanAddresses() {
  const values = [];
  let networkInterfaces;
  try {
    networkInterfaces = os.networkInterfaces();
  } catch {
    return [];
  }
  for (const interfaces of Object.values(networkInterfaces)) {
    for (const item of interfaces || []) {
      if (item.family !== 'IPv4' || item.internal) continue;
      const address = item.address;
      if (/^10\./.test(address)
        || /^192\.168\./.test(address)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(address)) values.push(address);
    }
  }
  return [...new Set(values)];
}

function errorStatus(error) {
  const code = error?.code;
  if (code === 'BODY_TOO_LARGE') return 413;
  if (code === 'HOST_TOKEN_REJECTED') return 403;
  if (code === 'SESSION_NOT_FOUND') return 404;
  if (code === 'INVALID_PARTY' || code === 'INVALID_ROOM' || code?.startsWith('INVALID_') || code === 'MALFORMED_JSON') return 400;
  if (code === 'DUPLICATE_SEAT'
    || code === 'MALFORMED_PLAYERS_JSON'
    || code === 'NO_PLAYERS'
    || code === 'NO_READY_PLAYERS'
    || code === 'INVALID_PARTY_ROSTER'
    || code === 'TOO_MANY_PLAYERS') return 400;
  return 500;
}

function errorPayload(error) {
  const status = errorStatus(error);
  return {
    status,
    payload: {
      ok: false,
      error: status === 500 ? 'internal-server-error' : (error.code || 'bad-request').toLowerCase(),
      message: status === 500 ? 'The local server could not complete the request.' : error.message,
    },
  };
}

function staticFileForPath(projectRoot, pathname) {
  const aliases = {
    '/': 'client/launcher/launcher.html',
    '/index.html': 'client/launcher/launcher.html',
    '/launcher.html': 'client/launcher/launcher.html',
    '/controller.html': 'client/controller/controller.html',
    '/party-screen.html': 'client/party-screen/party-screen.html',
    '/game': 'client/game/game.html',
    '/game/': 'client/game/game.html',
    '/game.html': 'client/game/game.html',
    '/common.css': 'client/common.css',
  };
  if (aliases[pathname]) return path.join(projectRoot, aliases[pathname]);

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const roots = [
    { prefix: '/launcher/', root: path.join(projectRoot, 'client', 'launcher') },
    { prefix: '/controller/', root: path.join(projectRoot, 'client', 'controller') },
    { prefix: '/party-screen/', root: path.join(projectRoot, 'client', 'party-screen') },
    { prefix: '/game/', root: path.join(projectRoot, 'client', 'game') },
    { prefix: '/vendor/', root: path.join(projectRoot, 'client', 'vendor') },
    { prefix: '/client/', root: path.join(projectRoot, 'client') },
    { prefix: '/assets/', root: path.join(projectRoot, 'assets') },
    { prefix: '/data/', root: path.join(projectRoot, 'data') },
  ];
  const match = roots.find((entry) => decoded.startsWith(entry.prefix));
  if (!match || decoded.includes('\0')) return null;
  const relative = decoded.slice(match.prefix.length);
  const candidate = path.resolve(match.root, relative);
  const rootWithSeparator = `${path.resolve(match.root)}${path.sep}`;
  if (!candidate.startsWith(rootWithSeparator)) return null;
  return candidate;
}

function serveStatic(projectRoot, pathname, response) {
  const filePath = staticFileForPath(projectRoot, pathname);
  if (!filePath) return false;
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stats.isFile()) return false;
  setSecurityHeaders(response);
  response.writeHead(200, {
    'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stats.size,
  });
  fs.createReadStream(filePath).pipe(response);
  return true;
}

function createDistrictPartyServer(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
  const environmentPort = Number(process.env.PORT);
  const port = options.port ?? (Number.isInteger(environmentPort) && environmentPort > 0 ? environmentPort : DEFAULT_PORT);
  const host = options.host || process.env.HOST || '0.0.0.0';
  const logger = options.logger || console;
  const sessionManager = options.sessionManager || new SessionManager({ projectRoot });
  const worldLoop = new WorldLoop(() => sessionManager.getRunningSession());
  const pidPath = path.join(projectRoot, '.axm-district-party.pid');

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://axm.local');
      const pathname = url.pathname;

      if (request.method === 'OPTIONS') {
        setSecurityHeaders(response);
        response.writeHead(204, { Allow: 'GET, POST, OPTIONS' });
        response.end();
        return;
      }

      if (request.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
        const session = sessionManager.getRunningSession();
        sendJson(response, 200, {
          ok: true,
          build: BUILD_NAME,
          version: BUILD_VERSION,
          status: session ? 'running' : 'waiting',
          sessionId: session?.id || null,
          roomCode: session?.roomCode || DEFAULT_ROOM,
          tick: session?.world?.tick || 0,
          localOnly: true,
          telemetry: false,
          runtimeInternetRequired: false,
          lanAddresses: privateLanAddresses(),
        });
        return;
      }

      if (request.method === 'POST' && (pathname === '/api/session/start' || pathname === '/api/sessions')) {
        if (!isLoopbackAddress(request.socket.remoteAddress)) {
          sendJson(response, 403, { ok: false, error: 'host-local-start-required' });
          return;
        }
        const body = await readJsonBody(request);
        const players = body.players ?? body.AXM_PLAYERS_JSON;
        const responseBody = sessionManager.createSession({
          roomCode: body.roomCode || DEFAULT_ROOM,
          players: typeof players === 'string' ? parseAXMPlayersJSON(players) : players,
          settings: body.settings || {},
        });
        sendJson(response, 201, responseBody);
        return;
      }

      if (request.method === 'GET' && (pathname === '/api/launcher-state' || pathname === '/api/session')) {
        sendJson(response, 200, sessionManager.launcherState(isLoopbackAddress(request.socket.remoteAddress)));
        return;
      }

      if (request.method === 'POST' && pathname === '/api/input') {
        const body = await readJsonBody(request);
        const result = routeInput(sessionManager, body);
        sendJson(response, result.ok ? 200 : result.statusCode, result);
        return;
      }

      if (request.method === 'GET' && pathname === '/api/controller-info') {
        const result = getControllerInfo(sessionManager, {
          roomCode: url.searchParams.get('roomCode') || url.searchParams.get('room'),
          sessionId: url.searchParams.get('sessionId') || url.searchParams.get('session'),
          seatId: url.searchParams.get('seatId') || url.searchParams.get('seat'),
          token: url.searchParams.get('token'),
        });
        sendJson(response, result.ok ? 200 : result.statusCode, result);
        return;
      }

      if (request.method === 'GET' && pathname === '/api/adapter-observation') {
        const result = getAdapterObservation(sessionManager, {
          roomCode: url.searchParams.get('roomCode') || url.searchParams.get('room'),
          sessionId: url.searchParams.get('sessionId') || url.searchParams.get('session'),
          seatId: url.searchParams.get('seatId') || url.searchParams.get('seat'),
          token: request.headers['x-axm-seat-token'],
          width: url.searchParams.get('width'),
          height: url.searchParams.get('height'),
        });
        sendJson(response, result.ok ? 200 : result.statusCode, result);
        return;
      }

      if (request.method === 'GET' && (pathname === '/api/state' || pathname === '/api/world')) {
        const sessionId = url.searchParams.get('sessionId') || url.searchParams.get('session');
        if (!isValidSessionId(sessionId)) {
          sendJson(response, 400, { ok: false, error: 'invalid-session' });
          return;
        }
        const session = sessionManager.getSession(sessionId);
        if (!session || session.status !== 'running') {
          sendJson(response, 404, { ok: false, error: 'session-not-running' });
          return;
        }
        const requestedRoom = url.searchParams.get('roomCode') || url.searchParams.get('room');
        if (requestedRoom !== session.roomCode) {
          sendJson(response, 403, { ok: false, error: 'room-session-mismatch' });
          return;
        }
        if (pathname === '/api/world') {
          sendJson(response, 200, serializeStaticWorld(session));
          return;
        }
        const party = url.searchParams.get('party') || 'all';
        if (!validatePartyId(party)) {
          sendJson(response, 400, { ok: false, error: 'invalid-party' });
          return;
        }
        sendJson(response, 200, serializeWorldState(session, party));
        return;
      }

      const displayMatch = pathname.match(/^\/(?:api\/)?display\/(party_a|party_b|all)$/);
      if (request.method === 'GET' && displayMatch) {
        sendJson(response, 200, sessionManager.displayState(displayMatch[1]));
        return;
      }
      if (request.method === 'GET' && pathname.startsWith('/display/')) {
        sendJson(response, 400, { ok: false, error: 'invalid-party' });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/session/restart') {
        const body = await readJsonBody(request);
        sendJson(response, 200, sessionManager.restartSession(body.sessionId, body.hostToken));
        return;
      }
      if (request.method === 'POST' && pathname === '/api/session/end') {
        const body = await readJsonBody(request);
        sendJson(response, 200, sessionManager.endSession(body.sessionId, body.hostToken));
        return;
      }
      if (request.method === 'POST' && pathname === '/api/session/settings') {
        const body = await readJsonBody(request);
        sendJson(response, 200, sessionManager.updateCombatRules(
          body.sessionId,
          body.hostToken,
          body.combatRules || body.settings?.combat || {},
        ));
        return;
      }

      if (request.method === 'GET' && serveStatic(projectRoot, pathname, response)) return;
      if (request.method !== 'GET' && staticFileForPath(projectRoot, pathname)) {
        sendJson(response, 405, { ok: false, error: 'method-not-allowed' });
        return;
      }
      sendText(response, 404, 'AXM District Party local route not found.');
    } catch (error) {
      const { status, payload } = errorPayload(error);
      if (status === 500) logger.error?.('[AXM District Party] request error', error);
      if (!response.headersSent) sendJson(response, status, payload);
      else response.destroy();
    }
  });

  function writePidFile() {
    fs.writeFileSync(pidPath, `${process.pid}\n`, { encoding: 'utf8', mode: 0o600 });
  }

  function removePidFile() {
    try {
      const recorded = fs.readFileSync(pidPath, 'utf8').trim();
      if (recorded === String(process.pid)) fs.unlinkSync(pidPath);
    } catch {
      // Missing or foreign PID files are left alone.
    }
  }

  return {
    server,
    sessionManager,
    worldLoop,
    projectRoot,
    pidPath,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      });
      writePidFile();
      if (options.autoStartLoop !== false) worldLoop.start();
      return server.address();
    },
    async close() {
      worldLoop.stop();
      if (server.listening) await new Promise((resolve) => server.close(resolve));
      removePidFile();
    },
  };
}

async function runFromCommandLine() {
  const runtime = createDistrictPartyServer();
  if (process.env.AXM_PLAYERS_JSON) {
    runtime.sessionManager.createSession({
      players: parseAXMPlayersJSON(process.env.AXM_PLAYERS_JSON),
      roomCode: process.env.AXM_ROOM || DEFAULT_ROOM,
    });
  }
  const address = await runtime.listen();
  const actualPort = typeof address === 'object' ? address.port : DEFAULT_PORT;
  console.log(`${BUILD_NAME} ${BUILD_VERSION}`);
  console.log(`Host launcher: http://127.0.0.1:${actualPort}/`);
  console.log(`Party A screen: http://127.0.0.1:${actualPort}/party-screen.html?party=party_a`);
  console.log(`Party B screen: http://127.0.0.1:${actualPort}/party-screen.html?party=party_b`);
  console.log(`Health: http://127.0.0.1:${actualPort}/health`);
  const lan = privateLanAddresses();
  if (lan.length) {
    for (const ip of lan) {
      console.log(`Private LAN launcher: http://${ip}:${actualPort}/`);
      console.log(`Private LAN Party A: http://${ip}:${actualPort}/party-screen.html?party=party_a`);
      console.log(`Private LAN Party B: http://${ip}:${actualPort}/party-screen.html?party=party_b`);
    }
  }
  else console.log('Private LAN: NOT FOUND (phone join URL not claimed ready)');
  console.log('Status: LOCAL LAN ONLY · no cloud runtime · press Ctrl+C to stop');

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await runtime.close();
    process.exitCode = 0;
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  runFromCommandLine().catch((error) => {
    console.error('[AXM District Party] startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  createDistrictPartyServer,
  isLoopbackAddress,
  privateLanAddresses,
  readJsonBody,
  serveStatic,
  staticFileForPath,
};
