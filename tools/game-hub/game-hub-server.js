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
const AssetHandoff = require('./asset-handoff');

const ROOT = __dirname;
const HOST = process.env.AXM_GAME_HUB_HOST || '0.0.0.0';
const PORT = Number(process.env.AXM_GAME_HUB_PORT || 8789);
const LIBRARY_DIR = path.join(ROOT, 'game-library');
const ASSET_INBOX_DIR = path.join(ROOT, 'asset-inbox');

const state = createEngineState();
let loop = null;
let activeGameProcess = null;

function stopGameRuntime() {
  if (activeGameProcess && activeGameProcess.child && !activeGameProcess.child.killed) {
    try { activeGameProcess.child.kill(); } catch (e) {}
  }
  activeGameProcess = null;
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

async function startGameRuntime(game, mode, selectedPlayers) {
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
  const child = childProcess.spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: Object.assign({}, process.env, {
      PORT: String(port),
      AXM_GAME_ID: game.game_id,
      AXM_GAME_MODE: mode || 'human-vs-ai',
      AXM_PLAYERS_JSON: JSON.stringify(selectedPlayers || []),
      AXM_P1_NAME: seat1 && seat1.display_name || 'Mike',
      AXM_P2_NAME: seat2 && seat2.display_name || 'Nova',
      AXM_P3_NAME: seat3 && seat3.display_name || 'Gemini',
      AXM_P4_NAME: seat4 && seat4.display_name || 'Codex'
    }),
    windowsHide: true,
    stdio: 'ignore'
  });
  activeGameProcess = { gameId: game.game_id, child, port };
  child.once('exit', () => { if (activeGameProcess && activeGameProcess.child === child) activeGameProcess = null; });
  await waitForRuntime(port, launch.ready_path || '/');
  const firstHumanIndex = (selectedPlayers || []).findIndex(player => player.type === 'human');
  let clientUrl = firstHumanIndex < 0 ? (launch.spectator_client_entry || launch.client_entry || null) : (launch.client_entry || null);
  if (firstHumanIndex > 0 && clientUrl) clientUrl = clientUrl.replace(/player=p1\b/, 'player=p' + (firstHumanIndex + 1));
  return {
    port,
    clientUrl,
    spectatorUrl: launch.spectator_client_entry || null
  };
}

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(obj, null, 2));
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

function findGame(gameId) {
  const games = listGames();
  return games.find(game => game.game_id === gameId) || null;
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
        lan_addresses: lanAddresses()
      });
    }

    if (req.method === 'GET' && req.url === '/state') return send(res, 200, { ok: true, state });
    if (req.method === 'GET' && req.url === '/seats') return send(res, 200, { ok: true, seats: state.lobby.seats });
    if (req.method === 'GET' && req.url === '/games') return send(res, 200, { ok: true, games: listGames() });
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
      const session = startSession(state, game);
      const players = session.selected_players || [];
      const firstHuman = players[0] && players[0].type === 'human';
      const secondHuman = players[1] && players[1].type === 'human';
      const mode = players.length > 2 ? 'four-player' : firstHuman
        ? (secondHuman ? 'human-vs-human' : 'human-vs-ai')
        : (secondHuman ? 'ai-vs-human' : 'ai-vs-ai');
      const runtime = await startGameRuntime(game, mode, players);
      startLoop();
      const networks = lanAddresses();
      const primary = networks[0] && networks[0].address;
      const joinUrl = mode === 'human-vs-human' && primary
        ? `http://${primary}:${runtime.port}/?room=AXM1&player=p2`
        : null;
      const controllerUrls = players.map((player, index) => ({
        player: 'p' + (index + 1),
        seat_id: player.seat_id,
        name: player.display_name,
        type: player.type,
        local_url: player.type === 'human' ? `http://127.0.0.1:${runtime.port}/?room=AXM1&player=p${index + 1}` : null,
        lan_url: player.type === 'human' && primary ? `http://${primary}:${runtime.port}/?room=AXM1&player=p${index + 1}` : null
      }));
      return send(res, 200, {
        ok: true,
        session,
        selected_players: players,
        host_player_name: players[0] && players[0].display_name || 'Player 1',
        join_player_name: players[1] && players[1].display_name || 'Player 2',
        mode,
        tick_rate: DEFAULT_TICK_RATE,
        fps: DEFAULT_FPS,
        client_url: runtime.clientUrl,
        host_url: runtime.clientUrl,
        spectator_url: runtime.spectatorUrl,
        join_url: joinUrl,
        controller_urls: controllerUrls,
        room_code: 'AXM1',
        lan_addresses: networks,
        runtime_port: runtime.port
      });
    }

    if (req.method === 'POST' && req.url === '/input') {
      const p = await readBody(req);
      return send(res, 200, { ok: true, result: queueInput(state, p) });
    }

    if (req.method === 'POST' && req.url === '/game/end') {
      const p = await readBody(req);
      stopLoop();
      stopGameRuntime();
      return send(res, 200, { ok: true, result: endSession(state, p.summary || {}) });
    }

    send(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    send(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log('AXM Game Hub v0.1');
  console.log(`Listening: http://${HOST}:${PORT}`);
  console.log(`Engine default: ${DEFAULT_TICK_RATE} TPS / ${DEFAULT_FPS} FPS`);
  console.log('Health: /health');
});

process.on('exit', stopGameRuntime);
process.on('SIGINT', () => { stopGameRuntime(); process.exit(0); });
