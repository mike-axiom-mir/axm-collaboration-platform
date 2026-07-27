#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const {
  DEFAULT_TICK_RATE,
  DEFAULT_FPS,
  createEngineState,
  assignSeat,
  readySeat,
  startSession,
  queueInput,
  engineTick,
  endSession
} = require('./game-engine/engine-core');
const { recoverRuntimeSession } = require('./game-engine/runtime-lifecycle');
const { DEFAULT_IDLE_TIMEOUT_MS, createRuntimeIdleWatchdog, normalizeIdleTimeout } = require('./game-engine/runtime-idle-policy');
const AssetHandoff = require('./asset-handoff');

const ROOT = __dirname;
const HOST = process.env.AXM_GAME_HUB_HOST || '0.0.0.0';
const PORT = Number(process.env.AXM_GAME_HUB_PORT || 8789);
const LIBRARY_DIR = path.join(ROOT, 'game-library');
const ASSET_INBOX_DIR = path.join(ROOT, 'asset-inbox');
const RESULT_DIR = path.resolve(process.env.AXM_GAME_HUB_RESULT_DIR || path.resolve(ROOT, '..', '..', 'state', 'game-night'));
const RESULT_FILE = path.join(RESULT_DIR, 'results.json');
const LOBBY_CONTROLLER_FILE = path.join(ROOT, 'lobby-controller.html');
const DISTRICT_CONTROLLER_DIR = path.join(LIBRARY_DIR, '008-district-party', 'client', 'controller');
const DISTRICT_CLIENT_DIR = path.join(LIBRARY_DIR, '008-district-party', 'client');
const MAX_RESULTS = 250;
const RUNTIME_ACTIVITY_PRELOAD = path.join(ROOT, 'game-engine', 'runtime-activity-preload.js');
const GAME_IDLE_TIMEOUT_MS = normalizeIdleTimeout(process.env.AXM_GAME_IDLE_TIMEOUT_MS, DEFAULT_IDLE_TIMEOUT_MS);

const state = createEngineState();
let loop = null;
let activeGameProcess = null;
let activeLaunch = null;

function loadResults() {
  try {
    const value = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
    return Array.isArray(value.results) ? value.results.slice(-MAX_RESULTS) : [];
  } catch (e) { return []; }
}

function saveResult(result) {
  const results = loadResults();
  const found = results.findIndex(item => item.session_id === result.session_id);
  if (found >= 0) results[found] = result;
  else results.push(result);
  fs.mkdirSync(RESULT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_FILE, JSON.stringify({ schema: 'axm.game-night-results/v1', updated_at: new Date().toISOString(), results: results.slice(-MAX_RESULTS) }, null, 2) + '\n');
  return result;
}

function stopGameRuntime() {
  const runtime = activeGameProcess;
  activeGameProcess = null;
  activeLaunch = null;
  if (runtime && runtime.idleWatchdog) runtime.idleWatchdog.stop();
  if (runtime && runtime.child && !runtime.child.killed) {
    try { runtime.child.kill(); } catch (e) {}
  }
}

function recoverLostRuntime(status, reason) {
  stopLoop();
  const result = recoverRuntimeSession(state, { status, reason });
  if (result) saveResult(result);
  return result;
}

function runtimeIdleState() {
  return activeGameProcess && activeGameProcess.idleWatchdog
    ? activeGameProcess.idleWatchdog.snapshot()
    : null;
}

function markRuntimeActivity(kind) {
  return !!(activeGameProcess && activeGameProcess.idleWatchdog && activeGameProcess.idleWatchdog.touch(kind));
}

function stopIdleRuntime(gameId, receipt) {
  if (!activeGameProcess || activeGameProcess.gameId !== gameId) return null;
  const idleForMs = receipt && receipt.idle_for_ms || GAME_IDLE_TIMEOUT_MS;
  stopGameRuntime();
  return recoverLostRuntime('idle-timeout', `no-managed-game-input-for-${idleForMs}-ms`);
}

function waitForRuntime(port, checkPath) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    function retry() {
      tries++;
      if (tries >= 30) return reject(new Error('game runtime did not become ready on port ' + port));
      setTimeout(probe, 100);
    }
    function probe() {
      const q = http.get({ hostname: '127.0.0.1', port, path: checkPath || '/', timeout: 500 }, r => {
        r.resume();
        if (r.statusCode >= 200 && r.statusCode < 500) return resolve();
        retry();
      });
      q.on('timeout', () => q.destroy());
      q.on('error', retry);
    }
    probe();
  });
}

function runtimeJson(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: requestPath, timeout: 1200 }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error('runtime metadata HTTP ' + response.statusCode));
        try { resolve(JSON.parse(body)); } catch (error) { reject(new Error('runtime metadata was not JSON')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('runtime metadata timed out')));
    request.on('error', reject);
  });
}

function normalizeRuntimePath(value) {
  const route = String(value || '').trim();
  if (!route) return null;
  if (route.startsWith('./')) return '/' + route.slice(2);
  if (route.startsWith('?')) return '/' + route;
  return route.startsWith('/') ? route : '/' + route;
}

function runtimeBrowserUrl(port, value) {
  let route = normalizeRuntimePath(value);
  if (!route) return null;
  route = route.replace(/^\/games\/\d{3}(?=\/|$)/, '') || '/';
  return `http://127.0.0.1:${port}${route}`;
}

function runtimeMetadataFromHostBootstrap(bootstrap) {
  const launch = bootstrap && bootstrap.launch;
  if (!launch) return null;
  const controllerLinks = (launch.controllers || []).map(link => ({
    seatId: link.seatId,
    slot: link.slot,
    displayName: link.displayName,
    partyId: link.partyId,
    url: normalizeRuntimePath(link.url)
  })).filter(link => link.seatId && link.url);
  const partyScreenLinks = {};
  for (const screen of launch.partyScreens || []) {
    const route = normalizeRuntimePath(screen.url);
    if (!route) continue;
    const party = String(screen.partyId || '').toUpperCase();
    if (party === 'A') partyScreenLinks.party_a = route;
    else if (party === 'B') partyScreenLinks.party_b = route;
  }
  partyScreenLinks.all = partyScreenLinks.party_a || partyScreenLinks.party_b || null;
  return { controllerLinks, partyScreenLinks };
}

function lanAddresses() {
  const results = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (/virtual|vethernet|wsl|loopback/i.test(name)) continue;
    for (const item of entries || []) {
      if (item.family !== 'IPv4' || item.internal || item.address.startsWith('169.254.')) continue;
      results.push({ name, address: item.address });
    }
  }
  results.sort((a, b) => {
    const score = value => /wi-?fi|wireless|wlan/i.test(value.name) ? 0 : /ethernet/i.test(value.name) ? 1 : 2;
    return score(a) - score(b);
  });
  return results;
}

async function startGameRuntime(game, mode, selectedPlayers, playMode) {
  const launch = game && game.launch;
  if (!launch || !launch.server_entry) throw new Error('game has no managed server_entry');
  const manifestAbs = path.resolve(ROOT, game.manifest_path || '');
  const gameDir = path.dirname(manifestAbs);
  const entry = path.resolve(gameDir, launch.server_entry);
  const dirPrefix = gameDir.endsWith(path.sep) ? gameDir : gameDir + path.sep;
  if (!entry.startsWith(dirPrefix)) throw new Error('game runtime entry escapes its game folder');
  if (!fs.existsSync(entry) || !/\.(?:c?js)$/i.test(entry)) throw new Error('game runtime entry missing or unsupported');
  stopGameRuntime();
  const port = Number(launch.port || 8792);
  const seat1 = Array.isArray(selectedPlayers) ? selectedPlayers[0] : null;
  const seat2 = Array.isArray(selectedPlayers) ? selectedPlayers[1] : null;
  const seat3 = Array.isArray(selectedPlayers) ? selectedPlayers[2] : null;
  const seat4 = Array.isArray(selectedPlayers) ? selectedPlayers[3] : null;
  const child = childProcess.spawn(process.execPath, ['--require', RUNTIME_ACTIVITY_PRELOAD, entry], {
    cwd: path.dirname(entry),
    env: Object.assign({}, process.env, {
      PORT: String(port),
      AXM_GAME_ID: game.game_id,
      AXM_GAME_MODE: mode || 'human-vs-ai',
       AXM_GAME_PLAY_MODE: playMode && playMode.id || '',
       AXM_GAME_SESSION_ID: state.session && state.session.session_id || '',
      AXM_PLAYERS_JSON: JSON.stringify(selectedPlayers || []),
      AXM_MANAGED_BY_GAME_HUB: '1',
      AXM_GAME_HUB_CALLBACK_URL: `http://127.0.0.1:${server.address().port}`,
      AXM_P1_NAME: seat1 && seat1.display_name || 'Mike',
      AXM_P2_NAME: seat2 && seat2.display_name || 'Nova',
      AXM_P3_NAME: seat3 && seat3.display_name || 'Gemini',
      AXM_P4_NAME: seat4 && seat4.display_name || 'Codex'
    }),
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  });
  const idleWatchdog = createRuntimeIdleWatchdog({
    timeoutMs: GAME_IDLE_TIMEOUT_MS,
    onTimeout: receipt => stopIdleRuntime(game.game_id, receipt)
  });
  activeGameProcess = { gameId: game.game_id, child, port, idleWatchdog };
  child.on('message', message => {
    if (!activeGameProcess || activeGameProcess.child !== child) return;
    if (!message || message.type !== 'axm.runtime-activity/v1') return;
    if (message.gameId && message.gameId !== game.game_id) return;
    if (message.sessionId && state.session && message.sessionId !== state.session.session_id) return;
    markRuntimeActivity(message.kind || 'managed-runtime-input');
  });
  child.once('exit', (code, signal) => {
    if (activeGameProcess && activeGameProcess.child === child) {
      activeGameProcess = null;
      activeLaunch = null;
      recoverLostRuntime('runtime-lost', `child-exit:${code == null ? 'none' : code}:${signal || 'none'}`);
    }
  });
  await waitForRuntime(port, launch.ready_path || '/');
  let runtimeState = null;
  try { runtimeState = await runtimeJson(port, '/api/launcher-state'); } catch (error) {}
  if (!runtimeState) {
    try { runtimeState = runtimeMetadataFromHostBootstrap(await runtimeJson(port, '/api/host/bootstrap')); }
    catch (error) {}
  }
  if (activeGameProcess && activeGameProcess.child === child) activeGameProcess.runtimeState = runtimeState;
  if (!activeGameProcess || activeGameProcess.child !== child || child.exitCode !== null) {
    throw new Error('game runtime ended during launch');
  }
  idleWatchdog.touch('runtime-ready');
  idleWatchdog.start();
  const firstHumanIndex = (selectedPlayers || []).findIndex(player => player.type === 'human');
  let clientUrl = firstHumanIndex < 0 ? (launch.spectator_client_entry || launch.client_entry || null) : (launch.client_entry || null);
  if (firstHumanIndex > 0 && clientUrl) clientUrl = clientUrl.replace(/player=p1\b/, 'player=p' + (firstHumanIndex + 1));
  const displayPath = runtimeState && runtimeState.partyScreenLinks
    ? (runtimeState.partyScreenLinks.all || runtimeState.partyScreenLinks.party_a)
    : null;
  return {
    port,
    clientUrl: runtimeBrowserUrl(port, clientUrl),
    spectatorUrl: runtimeBrowserUrl(port, displayPath || launch.spectator_client_entry),
    controllerLinks: runtimeState && Array.isArray(runtimeState.controllerLinks) ? runtimeState.controllerLinks : []
  };
}

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(obj, null, 2));
}

function sendHtml(res, code, html) {
  res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const limit = maxBytes || 1024 * 1024;
    req.on('data', d => { buf += d; if (buf.length > limit) req.destroy(new Error('request body too large')); });
    req.on('end', () => {
      try { resolve(buf ? JSON.parse(buf) : {}); }
      catch (e) { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function listGames() {
  if (!fs.existsSync(LIBRARY_DIR)) return [];
  const games = [];
  for (const item of fs.readdirSync(LIBRARY_DIR)) {
    const gameDir = path.join(LIBRARY_DIR, item);
    if (!fs.statSync(gameDir).isDirectory()) continue;
    const manifestPath = path.join(gameDir, 'game.manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      games.push(Object.assign({ manifest_path: path.relative(ROOT, manifestPath) }, manifest));
    } catch (e) {
      games.push({ game_id: item, status: 'manifest-error', error: e.message });
    }
  }
  return games;
}

function controllerPathFor(game, player, index) {
  const configured = game && game.launch && game.launch.controller_path;
  let route = String(configured || '/?room=AXM1&player={player}');
  route = route
    .replace(/\{player\}/g, 'p' + (index + 1))
    .replace(/\{seat_id\}/g, String(player && player.seat_id || ''));
  if (route.charAt(0) !== '/') route = '/' + route;
  return route;
}

function findGame(gameId) {
  const games = listGames();
  return games.find(game => game.game_id === gameId) || null;
}

function resolvePlayMode(game, requestedId) {
  const modes = game && Array.isArray(game.play_modes) ? game.play_modes : [];
  if (!modes.length) return null;
  const requested = String(requestedId || '').trim();
  const selected = requested ? modes.find(mode => mode.id === requested) : modes[0];
  if (!selected) throw new Error('unknown play mode for this game');
  return selected;
}

function readyCandidatesForGame(game) {
  const allowed = game && Array.isArray(game.allowed_seat_types) ? game.allowed_seat_types : ['human', 'adapter', 'ai'];
  return state.lobby.seats
    .filter(seat => seat.ready && seat.type !== 'closed' && seat.type !== 'empty' && seat.type !== 'spectator' && allowed.includes(seat.type))
    .sort((a, b) => (a.ready_order || 999999) - (b.ready_order || 999999))
    .slice(0, Number(game.max_players || 4));
}

function validatePlayModeRoster(playMode, players) {
  if (!playMode) return;
  const partyA = players.filter(player => Number(player.slot) <= 4);
  const partyB = players.filter(player => Number(player.slot) >= 5);
  if (playMode.party_rule === 'party-a-only') {
    if (!partyA.length) throw new Error('Story mode needs at least one ready seat from Party A (seats 1-4).');
    if (partyB.length) throw new Error('Story mode uses Party A seats 1-4 only. Unready Party B or choose House War.');
  }
  if (playMode.party_rule === 'balanced-parties') {
    if (!partyA.length || !partyB.length) throw new Error('House War needs ready seats in both Party A and Party B.');
    if (partyA.length !== partyB.length) throw new Error('House War needs equal Party A and Party B teams.');
  }
}

function startLoop() {
  stopLoop();
  const ms = Math.round(1000 / DEFAULT_TICK_RATE);
  loop = setInterval(() => {
    engineTick(state, null);
  }, ms);
}

function stopLoop() {
  if (loop) clearInterval(loop);
  loop = null;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 200, { ok: true });

    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, {
        ok: true,
        name: 'AXM Game Hub',
        status: state.status,
        default_tick_rate: DEFAULT_TICK_RATE,
        default_fps: DEFAULT_FPS,
        max_seats: state.lobby.max_seats,
        default_visible_seats: state.lobby.default_visible_seats,
        runtime_idle_timeout_ms: GAME_IDLE_TIMEOUT_MS,
        port: server.address().port,
        lobby_controller_path: '/lobby-controller',
        lan_addresses: lanAddresses()
      });
    }

    if (req.method === 'GET' && req.url.startsWith('/lobby-controller')) {
      return sendHtml(res, 200, fs.readFileSync(LOBBY_CONTROLLER_FILE, 'utf8'));
    }

    if (req.method === 'GET' && req.url.startsWith('/controller-preview')) {
      return sendHtml(res, 200, fs.readFileSync(path.join(DISTRICT_CONTROLLER_DIR, 'controller.html'), 'utf8'));
    }
    if (req.method === 'GET' && req.url === '/common.css') {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(fs.readFileSync(path.join(DISTRICT_CLIENT_DIR, 'common.css')));
    }
    if (req.method === 'GET' && req.url.startsWith('/controller/')) {
      const file = path.basename(new URL(req.url, 'http://127.0.0.1').pathname);
      if (!['controller.css', 'controller.js', 'axm-game-night-controls.js'].includes(file)) return send(res, 404, { ok: false, error: 'preview asset not found' });
      const type = file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      return res.end(fs.readFileSync(path.join(DISTRICT_CONTROLLER_DIR, file)));
    }

    if (req.method === 'GET' && req.url.startsWith('/lobby/status')) {
      const requestUrl = new URL(req.url, 'http://127.0.0.1');
      const seatId = requestUrl.searchParams.get('seat_id') || '';
      const requestedGameId = requestUrl.searchParams.get('game_id') || '';
      const seat = state.lobby.seats.find(item => item.id === seatId);
      if (!seat) return send(res, 404, { ok: false, error: 'seat not found' });
      const selected = state.session && Array.isArray(state.session.selected_players) ? state.session.selected_players : [];
      const playerIndex = selected.findIndex(player => player.seat_id === seatId);
      let controllerUrl = null;
      let previewUrl = null;
      const requestedGame = requestedGameId ? findGame(requestedGameId) : null;
      const host = String(req.headers.host || '127.0.0.1').replace(/:\d+$/, '');
      if (requestedGame && requestedGame.join && requestedGame.join.preview_path) {
        const previewPort = requestedGame.join.preview_via_game_hub ? server.address().port : Number(process.env.AXM_WORKSHOP_PORT || 8788);
        previewUrl = `http://${host}:${previewPort}${requestedGame.join.preview_path}`;
      }
      if (state.session && state.session.phase === 'RUNNING' && activeGameProcess && playerIndex >= 0 && selected[playerIndex].type === 'human') {
        const selectedGame = state.session.selected_game || {};
        const game = findGame(selectedGame.game_id);
        const issuedLink = activeGameProcess.runtimeState && Array.isArray(activeGameProcess.runtimeState.controllerLinks) ? activeGameProcess.runtimeState.controllerLinks.find(link => link.seatId === seatId) : null;
        const controllerPath = issuedLink && (issuedLink.url || issuedLink.path) || controllerPathFor(game, selected[playerIndex], playerIndex);
        controllerUrl = `http://${host}:${activeGameProcess.port}${controllerPath}`;
      }
      return send(res, 200, { ok: true, seat, phase: state.session && state.session.phase || 'LOBBY', preview_url: previewUrl, controller_url: controllerUrl });
    }

    if (req.method === 'GET' && req.url === '/state') return send(res, 200, { ok: true, state });
    if (req.method === 'GET' && req.url === '/active-launch') {
      const remote = String(req.socket.remoteAddress || '');
      if (!/^(?:127\.|::1$|::ffff:127\.)/.test(remote)) return send(res, 403, { ok: false, error: 'host-local active launch only' });
      return send(res, 200, { ok: true, launch: activeLaunch ? Object.assign({}, activeLaunch, { runtime_idle: runtimeIdleState() }) : null });
    }
    if (req.method === 'GET' && req.url === '/seats') return send(res, 200, { ok: true, seats: state.lobby.seats });
    if (req.method === 'GET' && req.url === '/games') return send(res, 200, { ok: true, games: listGames() });
    if (req.method === 'GET' && req.url.startsWith('/results')) {
      const requestUrl = new URL(req.url, 'http://127.0.0.1');
      const sessionId = requestUrl.searchParams.get('session');
      const results = loadResults();
      if (sessionId) {
        const result = results.find(item => item.session_id === sessionId);
        return result ? send(res, 200, { ok: true, result }) : send(res, 404, { ok: false, error: 'game result not found' });
      }
      return send(res, 200, { ok: true, results: results.slice(-25).reverse() });
    }
    if (req.method === 'GET' && req.url === '/assets/inbox') return send(res, 200, { ok: true, handoffs: AssetHandoff.listHandoffs(ASSET_INBOX_DIR) });

    if (req.method === 'POST' && req.url === '/assets/handoff') {
      const packet = await readBody(req, AssetHandoff.MAX_BYTES * 2);
      const handoff = AssetHandoff.createHandoff({ packet, libraryDir: LIBRARY_DIR, inboxDir: ASSET_INBOX_DIR });
      return send(res, 200, { ok: true, handoff });
    }

    if (req.method === 'POST' && req.url === '/assets/accept') {
      const p = await readBody(req);
      const handoff = AssetHandoff.acceptHandoff({ id: p.id, libraryDir: LIBRARY_DIR, inboxDir: ASSET_INBOX_DIR });
      return send(res, 200, { ok: true, handoff });
    }

    if (req.method === 'POST' && req.url === '/seat/assign') {
      const p = await readBody(req);
      return send(res, 200, { ok: true, seat: assignSeat(state, p.seat_id, p.patch || {}) });
    }

    if (req.method === 'POST' && req.url === '/seat/ready') {
      const p = await readBody(req);
      return send(res, 200, { ok: true, seat: readySeat(state, p.seat_id, !!p.ready) });
    }

    if (req.method === 'POST' && req.url === '/game/start') {
      const p = await readBody(req);
      const game = findGame(p.game_id) || p.game_manifest;
      if (!game) return send(res, 404, { ok: false, error: 'game not found' });
      let playMode;
      try {
        playMode = resolvePlayMode(game, p.play_mode);
        validatePlayModeRoster(playMode, readyCandidatesForGame(game));
      } catch (error) {
        return send(res, 409, { ok: false, error: error.message });
      }
      const session = startSession(state, game);
      const players = session.selected_players || [];
      const firstHuman = players[0] && players[0].type === 'human';
      const secondHuman = players[1] && players[1].type === 'human';
      const mode = players.length > 2 ? 'four-player' : firstHuman
        ? (secondHuman ? 'human-vs-human' : 'human-vs-ai')
        : (secondHuman ? 'ai-vs-human' : 'ai-vs-ai');
      let runtime;
      try {
        runtime = await startGameRuntime(game, mode, players, playMode);
      } catch (error) {
        stopGameRuntime();
        recoverLostRuntime('launch-failed', error.message);
        throw error;
      }
      startLoop();
      const networks = lanAddresses();
      const primary = networks[0] && networks[0].address;
      const joinUrl = mode === 'human-vs-human' && primary
        ? `http://${primary}:${runtime.port}/?room=AXM1&player=p2`
        : null;
      const controllerUrls = players.map((player, index) => {
        const issuedLink = runtime.controllerLinks.find(link => link.seatId === player.seat_id);
        const controllerPath = issuedLink && (issuedLink.url || issuedLink.path) || controllerPathFor(game, player, index);
        return {
          player: 'p' + (index + 1),
          seat_id: player.seat_id,
          name: player.display_name,
          type: player.type,
          local_url: player.type === 'human' ? `http://127.0.0.1:${runtime.port}${controllerPath}` : null,
          lan_url: player.type === 'human' && primary ? `http://${primary}:${runtime.port}${controllerPath}` : null
        };
      });
      activeLaunch = {
        ok: true,
        session,
        selected_players: players,
        host_player_name: players[0] && players[0].display_name || 'Player 1',
        join_player_name: players[1] && players[1].display_name || 'Player 2',
        mode,
        play_mode: playMode && playMode.id || null,
        tick_rate: DEFAULT_TICK_RATE,
        fps: DEFAULT_FPS,
        client_url: runtime.clientUrl,
        host_url: runtime.clientUrl,
        spectator_url: runtime.spectatorUrl,
        join_url: joinUrl,
        controller_urls: controllerUrls,
        room_code: 'AXM1',
        lan_addresses: networks,
        runtime_port: runtime.port,
        runtime_idle: runtimeIdleState()
      };
      return send(res, 200, activeLaunch);
    }

    if (req.method === 'POST' && req.url === '/input') {
      const p = await readBody(req);
      markRuntimeActivity('game-hub-input');
      return send(res, 200, { ok: true, result: queueInput(state, p) });
    }

    if (req.method === 'POST' && req.url === '/game/end') {
      const p = await readBody(req);
      if (!state.session || state.session.phase !== 'RUNNING' || !state.session.session_id) return send(res, 409, { ok: false, error: 'no running game session' });
      const session = JSON.parse(JSON.stringify(state.session || {}));
      stopLoop();
      stopGameRuntime();
      const summary = endSession(state, p.summary || {});
      const result = saveResult(Object.assign({}, summary, {
        game: session.selected_game || null,
        selected_players: Array.isArray(session.selected_players) ? session.selected_players : [],
        skipped_players: Array.isArray(session.skipped_players) ? session.skipped_players : [],
        started_at: session.started_at || null,
        reflection_state: p.reflect === false ? 'SKIPPED' : 'AVAILABLE',
        confirmed_finish: p.confirmed_finish !== false
      }));
      return send(res, 200, { ok: true, result });
    }

    send(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    send(res, 500, { ok: false, error: e.message });
  }
});

function listenHub(port = PORT, host = HOST) {
  return new Promise((resolve, reject) => {
    if (server.listening) return resolve(server.address());
    const onError = error => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      console.log('AXM Game Hub v0.1');
      console.log(`Listening: http://${host}:${server.address().port}`);
      console.log(`Engine default: ${DEFAULT_TICK_RATE} TPS / ${DEFAULT_FPS} FPS`);
      console.log('Health: /health');
      resolve(server.address());
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

server.on('close', stopGameRuntime);

if (require.main === module) {
  listenHub().catch(error => {
    console.error('AXM Game Hub failed to start: ' + error.message);
    process.exitCode = 1;
  });
  process.on('exit', stopGameRuntime);
  process.on('SIGINT', () => { stopGameRuntime(); process.exit(0); });
  process.on('SIGTERM', () => { stopGameRuntime(); process.exit(0); });
}

module.exports = { GAME_IDLE_TIMEOUT_MS, listenHub, listGames, markRuntimeActivity, resolvePlayMode, runtimeBrowserUrl, runtimeIdleState, server, startGameRuntime, state, stopGameRuntime, validatePlayModeRoster };
