#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const core = require('./game-core');

function resolveHost(env) {
  const source = env || process.env;
  const explicit = String(source.HOST || '').trim();
  if (explicit) return explicit;
  return source.AXM_MANAGED_BY_GAME_HUB === '1' ? '0.0.0.0' : '127.0.0.1';
}

const HOST = resolveHost(process.env);
const PORT = Number(process.env.PORT || 8805);
const GAME_PREFIX = '/games/015/';
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png'
};
const TRANSPORT_METRICS = Object.freeze({
  heartbeatMs: 1000,
  sessionActiveMs: 2500,
  sessionRetentionMs: 15000,
  inputOwnerLeaseMs: 900
});

function parseRoster(env) {
  const source = env || process.env;
  try { return core.normalizeRoster(JSON.parse(String(source.AXM_PLAYERS_JSON || '[]'))); }
  catch (_) { return core.normalizeRoster([]); }
}

function safeFile(urlPath) {
  let relative = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else if (relative === '/games/015') relative = '';
  else if (['/controller.html', '/app.js', '/styles.css', '/game-core.js'].includes(relative)) relative = relative.slice(1);
  else if (relative.startsWith('/assets/')) relative = relative.slice(1);
  else return null;
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const candidate = path.resolve(__dirname, relative.replace(/^\/+/, ''));
  return candidate === __dirname || candidate.startsWith(__dirname + path.sep) ? candidate : null;
}

function readJson(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = '';
    const limit = Number(maxBytes || 32768);
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

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type'
  });
  response.end(JSON.stringify(value));
}

function createRuntime(options) {
  const settings = options || {};
  const env = settings.env || process.env;
  const clock = typeof settings.clock === 'function' ? settings.clock : () => Date.now();
  const roster = settings.roster || parseRoster(env);
  const seed = Number(env.MIRRORSHIFT_SEED || 15015);
  const initialTrackId = core.TRACKS[env.MIRRORSHIFT_TRACK] ? env.MIRRORSHIFT_TRACK : core.TRACK_IDS.FORGE;
  const initialVariantId = core.RACE_VARIANTS[env.MIRRORSHIFT_VARIANT] ? env.MIRRORSHIFT_VARIANT : core.RACE_VARIANT_IDS.CLEAR;
  const initialRouteDirectionId = core.ROUTE_DIRECTIONS[env.MIRRORSHIFT_ROUTE_DIRECTION] ? env.MIRRORSHIFT_ROUTE_DIRECTION : core.ROUTE_DIRECTION_IDS.FORWARD;
  let state = core.createInitialState(roster, { seed, now: clock(), trackId: initialTrackId, variantId: initialVariantId, routeDirectionId: initialRouteDirectionId });
  let timer = null;
  let lastTickAt = clock();
  const tickSamples = [];
  const transportStartedAt = clock();
  const transportSessions = new Map();
  const inputOwners = new Map();
  const actionReceipts = [];
  const clientRttSamples = [];

  function boundedSamples(list, value, limit) {
    list.push(value);
    while (list.length > Number(limit || 360)) list.shift();
  }

  function distribution(values) {
    const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
    const average = finite.length ? finite.reduce((total, value) => total + value, 0) / finite.length : 0;
    return {
      sampleCount: finite.length,
      average: Math.round(average * 100) / 100,
      p95: finite.length ? finite[Math.min(finite.length - 1, Math.floor(finite.length * .95))] : 0,
      max: finite.length ? finite[finite.length - 1] : 0
    };
  }

  function validSessionId(value) {
    const sessionId = String(value || '').slice(0, 96);
    return /^[a-zA-Z0-9._:-]{8,96}$/.test(sessionId) ? sessionId : null;
  }

  function normalizeClientKind(value) {
    const kind = String(value || '').toLowerCase();
    return kind === 'controller' || kind === 'screen' ? kind : 'unknown';
  }

  function sessionPacket(actorId, requestedSessionId, now, metadata) {
    const player = String(actorId || '');
    const racer = state.racers[player];
    if (!racer) return null;
    const sessionId = validSessionId(requestedSessionId);
    if (!sessionId) return null;
    const previous = transportSessions.get(sessionId);
    if (previous && previous.player !== player) return null;
    const resumed = Boolean(previous);
    const replaced = false;
    const requestedKind = normalizeClientKind(metadata && metadata.clientKind);
    const session = resumed ? previous : {
      player,
      sessionId,
      clientKind: requestedKind,
      connectedAt: now,
      lastSeenAt: now,
      handshakes: 0,
      resumes: 0,
      acceptedActions: 0,
      rejectedActions: 0,
      appliedActions: 0,
      ignoredActions: 0,
      driveActions: 0,
      appliedMeaningfulDriveActions: 0,
      itemAttempts: 0,
      heartbeatCount: 0,
      seatConfirmedAt: null,
      seatConfirmCount: 0,
      roundTripSamples: [],
      lastClientSeq: -1,
      lastRequestId: null
    };
    if (session.clientKind === 'unknown' && requestedKind !== 'unknown') session.clientKind = requestedKind;
    session.handshakes += 1;
    session.resumes += resumed ? 1 : 0;
    session.lastSeenAt = now;
    session.replacedPreviousSession = false;
    session.nextSeq = Math.max(1, Number(session.lastClientSeq) + 1);
    transportSessions.set(sessionId, session);
    return {
      schema: 'axm.mirrorshift-session/v1',
      player,
      sessionId,
      clientKind: session.clientKind,
      resumed,
      replaced,
      resumeCount: session.resumes,
      nextSeq: session.nextSeq,
      seatConfirmed: Boolean(session.seatConfirmedAt),
      phase: state.phase,
      mode: state.mode,
      trackId: state.trackId,
      variantId: state.variantId,
      routeDirectionId: state.routeDirectionId,
      raceLaps: state.raceLaps,
      tour: state.tour ? { roundNumber: state.tour.roundIndex + 1, roundCount: state.tour.roundCount, points: Object.assign({}, state.tour.points), complete: state.tour.complete } : null,
      serverNow: now
    };
  }

  function transportTelemetry(now) {
    transportSessions.forEach((session, sessionId) => {
      if (now - session.lastSeenAt > TRANSPORT_METRICS.sessionRetentionMs) transportSessions.delete(sessionId);
    });
    const sessions = Array.from(transportSessions.values()).map(session => ({
      player: session.player,
      sessionId: session.sessionId,
      clientKind: session.clientKind || 'unknown',
      connected: now - session.lastSeenAt <= TRANSPORT_METRICS.sessionActiveMs,
      connectedForMs: Math.max(0, now - session.connectedAt),
      lastSeenAgoMs: Math.max(0, now - session.lastSeenAt),
      handshakes: session.handshakes,
      resumes: session.resumes,
      acceptedActions: session.acceptedActions,
      rejectedActions: session.rejectedActions,
      appliedActions: session.appliedActions,
      ignoredActions: session.ignoredActions,
      driveActions: session.driveActions || 0,
      appliedMeaningfulDriveActions: session.appliedMeaningfulDriveActions || 0,
      itemAttempts: session.itemAttempts || 0,
      heartbeatCount: session.heartbeatCount || 0,
      seatConfirmed: Boolean(session.seatConfirmedAt),
      seatConfirmCount: session.seatConfirmCount || 0,
      roundTripMs: distribution(session.roundTripSamples || []),
      nextSeq: session.nextSeq
    }));
    const processing = distribution(actionReceipts.map(receipt => receipt.serverProcessMs));
    const roundTrip = distribution(clientRttSamples.map(sample => sample.rttMs));
    return {
      schema: 'axm.mirrorshift-transport-telemetry/v1',
      uptimeMs: Math.max(0, now - transportStartedAt),
      sessionCount: sessions.length,
      activeSessionCount: sessions.filter(session => session.connected).length,
      resumeCount: sessions.reduce((total, session) => total + session.resumes, 0),
      actionReceipts: Object.assign(processing, {
        accepted: actionReceipts.filter(receipt => receipt.accepted).length,
        rejected: actionReceipts.filter(receipt => !receipt.accepted).length,
        applied: actionReceipts.filter(receipt => receipt.applied).length,
        ignored: actionReceipts.filter(receipt => receipt.accepted && !receipt.applied).length
      }),
      clientReportedRoundTripMs: Object.assign(roundTrip, {
        source: 'measured fetch request-to-ack duration reported by the local client'
      }),
      sessions
    };
  }

  function statePacket() {
    return {
      ok: true,
      state: core.snapshot(state),
      characters: core.RACERS,
      baseStats: core.BASE_STATS,
      assistContract: core.ASSIST_CONTRACT,
      metrics: core.METRICS,
      modes: core.MODES,
      tracks: core.TRACK_CATALOG,
      raceVariants: core.RACE_VARIANT_CATALOG,
      routeDirections: core.ROUTE_DIRECTION_CATALOG,
      signalTour: core.SIGNAL_TOUR,
      items: core.ITEM_TYPES,
      itemWeights: core.POWERUP_WEIGHTS,
      battleItemWeights: core.BATTLE_POWERUP_WEIGHTS,
      authority: 'server'
    };
  }

  function launcherState() {
    return {
      ok: true,
      schema: 'axm.game-runtime-launcher-state/v1',
      gameId: core.GAME_ID,
      controllerLinks: roster.filter(seat => seat.type === 'human').map(seat => ({
        seatId: seat.seatId,
        player: seat.id,
        localPath: '/controller.html?room=AXM1&player=' + encodeURIComponent(seat.id)
      })),
      partyScreenLinks: { all: GAME_PREFIX + '?room=AXM1&player=screen' },
      authority: { session: 'managed-server', race: 'managed-server', tour: 'managed-server', items: 'managed-server' },
      inputSchema: core.INPUT_SCHEMA,
      transport: {
        sessionPath: '/api/session',
        heartbeatPath: '/api/heartbeat',
        seatConfirmationPath: '/api/seat-confirm',
        actionPath: '/api/action',
        characterPath: '/api/character',
        variantPath: '/api/variant',
        routeDirectionPath: '/api/route-direction',
        tourAdvancePath: '/api/tour/advance',
        clientTelemetryPath: '/api/client-telemetry',
        sessionSchema: 'axm.mirrorshift-session/v1',
        seatConfirmationSchema: 'axm.mirrorshift-seat-confirmation/v1',
        actionReceiptSchema: 'axm.mirrorshift-action-receipt/v1',
        reconnectStrategy: 'stable seat identity plus per-client monotonic sequences and server-global ordering',
        heartbeatMs: TRANSPORT_METRICS.heartbeatMs,
        inputOwnerLeaseMs: TRANSPORT_METRICS.inputOwnerLeaseMs
      },
      localOnly: true
    };
  }

  function advance(now) {
    const started = Date.now();
    const elapsed = Math.max(0, Math.min(100, now - lastTickAt));
    lastTickAt = now;
    core.step(state, elapsed, now);
    tickSamples.push(Date.now() - started);
    if (tickSamples.length > 180) tickSamples.shift();
  }

  function startLoop() {
    if (timer || settings.manualTick === true) return;
    lastTickAt = clock();
    timer = setInterval(() => advance(clock()), 40);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stopLoop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') return sendJson(response, 200, { ok: true });
      const url = new URL(request.url, 'http://127.0.0.1');
      const pathname = url.pathname;

      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, {
          ok: true,
          gameId: core.GAME_ID,
          status: 'PLAYABLE ALPHA V23 · LIVING CIRCUITS',
          localOnly: true,
          networkBind: {
            host: HOST,
            policy: process.env.AXM_MANAGED_BY_GAME_HUB === '1' && HOST === '0.0.0.0'
              ? 'managed-lan-all-interfaces'
              : 'standalone-loopback-or-explicit-override'
          },
          stateAuthority: 'server',
          phase: state.phase,
          mode: state.mode,
          trackId: state.trackId,
          variantId: state.variantId,
          routeDirectionId: state.routeDirectionId,
          raceLaps: state.raceLaps,
          tour: state.tour ? { roundNumber: state.tour.roundIndex + 1, roundCount: state.tour.roundCount, complete: state.tour.complete, championId: state.tour.championId } : null,
          racers: Object.keys(state.racers).length
        });
      }
      if (request.method === 'GET' && pathname === '/api/launcher-state') return sendJson(response, 200, launcherState());
      if (request.method === 'GET' && pathname === '/api/state') return sendJson(response, 200, statePacket());
      if (request.method === 'GET' && pathname === '/api/observe') {
        const observation = core.observe(state, String(url.searchParams.get('player') || 'p1'));
        return observation ? sendJson(response, 200, { ok: true, observation, characters: core.RACERS }) : sendJson(response, 404, { ok: false, error: 'unknown player' });
      }
      if (request.method === 'GET' && pathname === '/api/telemetry') {
        const sorted = tickSamples.slice().sort((a, b) => a - b);
        const average = sorted.length ? tickSamples.reduce((total, value) => total + value, 0) / sorted.length : 0;
        return sendJson(response, 200, {
          ok: true,
          schema: 'axm.mirrorshift-telemetry/v1',
          workload: '25 Hz authoritative four-racer simulation',
          sampleCount: sorted.length,
          tickMs: { average, p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0, budget: 5 },
          transport: transportTelemetry(clock()),
          warning: 'Local simulation timings do not prove performance on every game-night display or phone.'
        });
      }
      if (request.method === 'POST' && pathname === '/api/session') {
        const body = await readJson(request);
        const session = sessionPacket(String(body.player || body.actorId || 'p1'), body.sessionId, clock(), { clientKind: body.clientKind });
        return session ? sendJson(response, 200, { ok: true, session }) : sendJson(response, 400, { ok: false, error: 'valid player and sessionId required' });
      }
      if (request.method === 'POST' && pathname === '/api/client-telemetry') {
        const body = await readJson(request);
        const player = String(body.player || body.actorId || 'p1');
        const sessionId = validSessionId(body.sessionId);
        const session = sessionId ? transportSessions.get(sessionId) : null;
        const rttMs = Number(body.rttMs);
        if (!session || session.player !== player) return sendJson(response, 409, { ok: false, error: 'session-required' });
        if (!Number.isFinite(rttMs) || rttMs < 0 || rttMs > 5000) return sendJson(response, 400, { ok: false, error: 'invalid-rtt' });
        session.lastSeenAt = clock();
        boundedSamples(session.roundTripSamples, Math.round(rttMs * 100) / 100, 120);
        boundedSamples(clientRttSamples, {
          player,
          sessionId,
          requestId: String(body.requestId || '').slice(0, 128),
          rttMs: Math.round(rttMs * 100) / 100,
          reportedAt: session.lastSeenAt
        }, 360);
        return sendJson(response, 200, { ok: true, accepted: true });
      }
      if (request.method === 'POST' && pathname === '/api/heartbeat') {
        const body = await readJson(request);
        const player = String(body.player || body.actorId || 'p1');
        const sessionId = validSessionId(body.sessionId);
        const session = sessionId ? transportSessions.get(sessionId) : null;
        if (!session || session.player !== player) return sendJson(response, 409, { ok: false, error: 'session-required' });
        session.lastSeenAt = clock();
        session.heartbeatCount = (session.heartbeatCount || 0) + 1;
        return sendJson(response, 200, {
          ok: true,
          schema: 'axm.mirrorshift-heartbeat/v1',
          player,
          sessionId,
          nextSeq: session.nextSeq,
          serverNow: session.lastSeenAt
        });
      }
      if (request.method === 'POST' && pathname === '/api/seat-confirm') {
        const body = await readJson(request);
        const player = String(body.player || body.actorId || 'p1');
        const sessionId = validSessionId(body.sessionId);
        const session = sessionId ? transportSessions.get(sessionId) : null;
        if (!session || session.player !== player || session.clientKind !== 'controller') {
          return sendJson(response, 409, { ok: false, error: 'controller-session-required' });
        }
        if (state.phase !== 'lobby') return sendJson(response, 409, { ok: false, error: 'lobby-required' });
        session.lastSeenAt = clock();
        session.seatConfirmedAt = session.lastSeenAt;
        session.seatConfirmCount = (session.seatConfirmCount || 0) + 1;
        return sendJson(response, 200, {
          ok: true,
          schema: 'axm.mirrorshift-seat-confirmation/v1',
          player,
          confirmed: true,
          confirmationCount: session.seatConfirmCount,
          serverNow: session.lastSeenAt
        });
      }
      if (request.method === 'POST' && pathname === '/api/start') {
        const result = core.startRace(state, clock());
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/mode') {
        const body = await readJson(request);
        const result = core.setMode(state, String(body.mode || ''), clock());
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/track') {
        const body = await readJson(request);
        const result = core.setTrack(state, String(body.trackId || ''), clock());
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/variant') {
        const body = await readJson(request);
        const result = core.setRaceVariant(state, String(body.variantId || ''), clock());
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/route-direction') {
        const body = await readJson(request);
        const result = core.setRouteDirection(state, String(body.routeDirectionId || ''), clock());
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/tour/advance') {
        const result = core.advanceTour(state, clock());
        if (!result.ok) return sendJson(response, 409, Object.assign(statePacket(), result));
        inputOwners.clear();
        const started = core.startRace(state, clock());
        return sendJson(response, started.ok ? 200 : 409, Object.assign(statePacket(), result, { started: started.ok }));
      }
      if (request.method === 'POST' && pathname === '/api/assist') {
        const body = await readJson(request);
        const result = core.setAssists(state, String(body.player || body.racerId || 'p1'), body.assists || body, clock());
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/character') {
        const body = await readJson(request);
        const result = core.setCharacter(state, String(body.player || body.racerId || 'p1'), String(body.characterId || ''), clock());
        return sendJson(response, result.ok ? 200 : 409, Object.assign(statePacket(), result));
      }
      if (request.method === 'POST' && pathname === '/api/action') {
        const routeStartedAt = Date.now();
        const body = await readJson(request);
        const actorId = String(body.player || body.actorId || 'p1');
        const action = body.action || body;
        const sessionId = validSessionId(body.sessionId);
        const session = sessionId ? transportSessions.get(sessionId) : null;
        if (sessionId && (!session || session.player !== actorId)) return sendJson(response, 409, { ok: false, error: 'session-required' });
        const receivedAt = clock();
        const racer = state.racers[actorId];
        const clientSequence = Number(action.seq);
        const actionType = String(action.type || 'drive');
        const meaningfulDrive = actionType === 'drive' && (Number(action.throttle) > .05 || Number(action.brake) > .05 || Math.abs(Number(action.steer)) > .05);
        let serverSequence = clientSequence;
        let result;
        let applied = true;
        if (session) {
          if (!Number.isFinite(clientSequence) || !Number.isInteger(clientSequence)) result = { ok: false, reason: 'invalid-sequence' };
          else if (clientSequence <= session.lastClientSeq) result = { ok: false, reason: 'stale-sequence' };
          else {
            session.lastClientSeq = clientSequence;
            serverSequence = racer ? Math.max(1, racer.lastSeq + 1) : clientSequence;
            const owner = actionType === 'drive' ? inputOwners.get(actorId) : null;
            if (actionType === 'drive' && owner && owner.sessionId !== sessionId && owner.expiresAt > receivedAt) {
              applied = false;
              result = { ok: true, ignored: true, reason: 'input-owner-active' };
            } else {
              if (meaningfulDrive) inputOwners.set(actorId, { sessionId, expiresAt: receivedAt + TRANSPORT_METRICS.inputOwnerLeaseMs });
              else if (actionType === 'drive' && owner && owner.sessionId === sessionId) inputOwners.delete(actorId);
              result = core.applyAction(state, actorId, Object.assign({}, action, { seq: serverSequence }), receivedAt);
            }
          }
        } else result = core.applyAction(state, actorId, action, receivedAt);
        const receipt = {
          schema: 'axm.mirrorshift-action-receipt/v1',
          requestId: String(body.requestId || '').slice(0, 128),
          actorId,
          sessionId: sessionId || null,
          sequence: clientSequence,
          serverSequence,
          accepted: Boolean(result.ok),
          applied: Boolean(result.ok && applied),
          reason: result.reason || null,
          serverReceivedAt: receivedAt,
          serverAcknowledgedAt: clock(),
          serverProcessMs: Date.now() - routeStartedAt,
          nextSeq: session ? Math.max(1, session.lastClientSeq + 1) : (racer ? racer.lastSeq + 1 : null)
        };
        boundedSamples(actionReceipts, receipt, 720);
        if (session) {
          session.lastSeenAt = receipt.serverAcknowledgedAt;
          session.lastRequestId = receipt.requestId;
          session.acceptedActions += result.ok ? 1 : 0;
          session.rejectedActions += result.ok ? 0 : 1;
          session.appliedActions += result.ok && applied ? 1 : 0;
          session.ignoredActions += result.ok && !applied ? 1 : 0;
          session.driveActions = (session.driveActions || 0) + (actionType === 'drive' ? 1 : 0);
          session.itemAttempts = (session.itemAttempts || 0) + (actionType === 'item' ? 1 : 0);
          session.appliedMeaningfulDriveActions = (session.appliedMeaningfulDriveActions || 0) + (result.ok && applied && meaningfulDrive ? 1 : 0);
          session.nextSeq = Math.max(1, session.lastClientSeq + 1);
        }
        return sendJson(response, result.ok ? 200 : 409, { ok: result.ok, result, receipt });
      }
      if (request.method === 'POST' && pathname === '/api/reset') {
        const body = await readJson(request);
        const mode = body.mode === core.MODES.BATTLE || body.mode === core.MODES.TOUR || body.mode === core.MODES.RACE ? body.mode : state.mode;
        const trackId = core.TRACKS[body.trackId] ? body.trackId : state.trackId;
        const variantId = core.RACE_VARIANTS[body.variantId] ? body.variantId : state.variantId;
        const routeDirectionId = core.ROUTE_DIRECTIONS[body.routeDirectionId] ? body.routeDirectionId : state.routeDirectionId;
        const assists = Object.fromEntries(Object.entries(state.racers).map(([id, racer]) => [id, racer.assists]));
        const characterAssignments = Object.fromEntries(Object.entries(state.racers).map(([id, racer]) => [id, racer.characterId]));
        state = core.createInitialState(roster, { seed, now: clock(), mode, trackId, variantId, routeDirectionId, assists, characterAssignments });
        inputOwners.clear();
        lastTickAt = clock();
        return sendJson(response, 200, statePacket());
      }
      if (pathname === '/') {
        response.writeHead(302, { location: GAME_PREFIX + '?room=AXM1&player=screen', 'cache-control': 'no-store' });
        return response.end();
      }
      const file = safeFile(pathname);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return response.end('AXM: MIRRORSHIFT route not found.');
      }
      response.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': /\.(?:html|js|css|json)$/i.test(file) ? 'no-store' : 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; media-src 'none'; object-src 'none'"
      });
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
  });

  server.on('listening', startLoop);
  server.on('close', stopLoop);
  return {
    advance,
    clock,
    getState: () => core.snapshot(state),
    launcherState,
    roster,
    server,
    startLoop,
    stopLoop
  };
}

if (require.main === module) {
  const runtime = createRuntime();
  runtime.server.listen(PORT, HOST, () => console.log('AXM: MIRRORSHIFT listening on http://' + HOST + ':' + PORT));
}

module.exports = { GAME_PREFIX, HOST, PORT, TRANSPORT_METRICS, createRuntime, parseRoster, resolveHost, safeFile };
