#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.AXM_RELAYBOUND_HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8794);
const ROOT = __dirname;
const CLIENT = path.join(ROOT, 'relaybound-client.html');
const DEBRIEF = path.join(ROOT, 'relaybound-debrief.html');
const TICK_MS = 1000 / 30;
const STREAM_MS = 50;
const WORLD = { width: 72, depth: 44 };

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function cleanName(v, fallback) {
  const text = String(v || '').replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 22);
  return text || fallback;
}
function loadSeats() {
  let raw = [];
  try { raw = JSON.parse(process.env.AXM_PLAYERS_JSON || '[]'); } catch (_) {}
  if (!raw.length) raw = [{ display_name: 'Human', type: 'human' }, { display_name: 'Nova', type: 'ai' }];
  if (raw.length === 1) raw.push({ display_name: 'Nova', type: 'ai' });
  return raw.slice(0, 2).map((seat, i) => ({
    id: 'p' + (i + 1),
    name: cleanName(seat.display_name, i ? 'Nova' : 'Human'),
    kind: seat.type === 'human' ? 'human' : 'ai'
  }));
}

const seats = loadSeats();
const inputs = {};
const players = {};
seats.forEach((seat, i) => {
  players[seat.id] = {
    ...seat,
    color: i ? '#65d9ff' : '#ffbd5b',
    role: i ? 'ward' : 'edge',
    x: 12,
    z: i ? 26 : 18,
    yaw: Math.PI / 2,
    health: i ? 130 : 80,
    maxHealth: i ? 130 : 80,
    down: false,
    revive: 0,
    shield: false,
    lastActionAt: 0,
    kills: 0
  };
  inputs[seat.id] = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, action: false, updatedAt: 0 };
});

let nextEnemy = 1;
let nextBolt = 1;
let lastTick = Date.now();
const streams = new Set();
const world = {
  game_id: '004-relaybound',
  version: '0.1.0-role-relay',
  phase: 'combat',
  stage: 1,
  arena: WORLD,
  players,
  enemies: [],
  bolts: [],
  sparks: [],
  upgrades: { attack: 1, defense: 1 },
  relayCount: 0,
  shrineOpenedAt: 0,
  event: 'WARD EXPOSES · EDGE STRIKES · STAY TOGETHER',
  eventAt: Date.now(),
  guardianId: null,
  result: null,
  timeline: [{ at: Date.now(), text: 'WARD EXPOSES · EDGE STRIKES · STAY TOGETHER' }]
};

function announce(text) {
  world.event = text; world.eventAt = Date.now();
  world.timeline.push({ at: world.eventAt, text: text });
  if (world.timeline.length > 80) world.timeline.shift();
}
function roleStats(role) {
  return role === 'edge'
    ? { maxHealth: 72 + world.upgrades.attack * 8, speed: 6.4 + world.upgrades.attack * 0.25 }
    : { maxHealth: 118 + world.upgrades.defense * 12, speed: 5.45 + world.upgrades.defense * 0.15 };
}
function applyRole(player, role, refill) {
  const before = player.maxHealth || 1;
  player.role = role;
  player.maxHealth = roleStats(role).maxHealth;
  player.health = refill ? player.maxHealth : clamp(player.health * player.maxHealth / before, 1, player.maxHealth);
  player.shield = false;
  player.down = false;
  player.revive = 0;
}
function makeEnemy(kind, x, z) {
  const guardian = kind === 'guardian';
  return {
    id: 'e' + nextEnemy++, kind,
    x, z, yaw: -Math.PI / 2,
    health: guardian ? 300 : 38,
    maxHealth: guardian ? 300 : 38,
    exposedUntil: 0,
    stunnedUntil: 0,
    lastShotAt: Date.now() - Math.random() * 1200,
    attackSeed: Math.random() * Math.PI * 2,
    alive: true
  };
}
function spawnFirstChamber() {
  world.enemies = [
    makeEnemy('shade', 45, 12), makeEnemy('shade', 52, 20),
    makeEnemy('shade', 45, 32), makeEnemy('shade', 59, 26)
  ];
}
function spawnGuardian() {
  const boss = makeEnemy('guardian', 55, 22);
  world.enemies = [boss];
  world.guardianId = boss.id;
  world.phase = 'guardian';
  world.stage = 2;
}
spawnFirstChamber();

function nearestPlayer(enemy) {
  const active = Object.values(players).filter(p => !p.down);
  active.sort((a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z));
  return active[0] || null;
}
function partnerOf(id) { return players[id === 'p1' ? 'p2' : 'p1']; }
function exposeAround(ward, now) {
  let count = 0;
  const radius = 8.2 + world.upgrades.defense * 0.75;
  for (const enemy of world.enemies) {
    if (!enemy.alive || Math.hypot(enemy.x - ward.x, enemy.z - ward.z) > radius) continue;
    enemy.exposedUntil = Math.max(enemy.exposedUntil, now + 2700 + world.upgrades.defense * 350);
    enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + 280);
    count++;
  }
  if (count) announce(ward.name.toUpperCase() + ' EXPOSED ' + count + ' ARMOR SIGIL' + (count > 1 ? 'S' : ''));
}
function edgeStrike(player, now) {
  const cooldown = Math.max(260, 630 - world.upgrades.attack * 70);
  if (now - player.lastActionAt < cooldown || player.down) return;
  player.lastActionAt = now;
  const ax = Math.sin(player.yaw), az = Math.cos(player.yaw);
  let best = null, bestScore = Infinity;
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - player.x, dz = enemy.z - player.z, distance = Math.hypot(dx, dz);
    const forward = (dx * ax + dz * az) / Math.max(0.001, distance);
    const score = distance - forward * 2;
    if (distance < 8.5 && forward > 0.45 && score < bestScore) { best = enemy; bestScore = score; }
  }
  world.sparks.push({ id: 's' + now + player.id, kind: 'slash', x: player.x + ax * 2.2, z: player.z + az * 2.2, color: '#ffb548', bornAt: now });
  if (!best) { announce(player.name.toUpperCase() + ' CUT THROUGH EMPTY AIR'); return; }
  if (best.exposedUntil < now) { announce('ARMOR HELD · WARD MUST EXPOSE IT'); return; }
  const damage = 13 + world.upgrades.attack * 7;
  best.health = Math.max(0, best.health - damage);
  best.stunnedUntil = now + 350;
  if (!best.health) {
    best.alive = false;
    player.kills++;
    announce(player.name.toUpperCase() + ' BROKE ' + (best.kind === 'guardian' ? 'THE SENTINEL' : 'A SHADE'));
  } else announce('EXPOSED HIT · ' + best.health + ' HP');
}
function wardAction(player, now) {
  if (player.down) return;
  player.shield = true;
  if (now - player.lastActionAt > 850) {
    player.lastActionAt = now;
    exposeAround(player, now);
    world.sparks.push({ id: 's' + now + player.id, kind: 'ward', x: player.x, z: player.z, color: '#5ee7ff', bornAt: now });
  }
}
function playerAction(player, active, now) {
  if (!['combat', 'guardian'].includes(world.phase)) { player.shield = false; return; }
  if (!active) { player.shield = false; return; }
  if (player.role === 'edge') edgeStrike(player, now); else wardAction(player, now);
}
function chooseUpgrade(actor, type) {
  if (world.phase !== 'upgrade' || !['attack', 'defense'].includes(type) || actor.down) return false;
  const partner = partnerOf(actor.id);
  world.upgrades[type]++;
  const claimedRole = type === 'attack' ? 'edge' : 'ward';
  const forcedRole = claimedRole === 'edge' ? 'ward' : 'edge';
  applyRole(actor, forcedRole, true);
  applyRole(partner, claimedRole, true);
  world.relayCount++;
  world.bolts = [];
  const relayEvent = actor.name.toUpperCase() + ' UPGRADED ' + type.toUpperCase() + ' · ' + partner.name.toUpperCase() + ' INHERITS IT';
  if (world.relayCount === 1) { spawnGuardian(); announce(relayEvent + ' · SENTINEL AWAKENS'); }
  else {
    world.phase = 'guardian';
    const guardian = world.enemies.find(e => e.id === world.guardianId);
    if (guardian) { guardian.stunnedUntil = Date.now() + 1100; guardian.exposedUntil = 0; }
    world.stage = 3;
    announce(relayEvent + ' · FINAL PHASE');
  }
  return true;
}
function openShrine(reason) {
  world.phase = 'upgrade';
  world.shrineOpenedAt = Date.now();
  world.bolts = [];
  Object.values(players).forEach(p => { p.shield = false; p.health = Math.min(p.maxHealth, p.health + p.maxHealth * 0.35); });
  announce(reason + ' · CHOOSE WHAT YOUR PARTNER WILL INHERIT');
}
function damagePlayer(player, amount, now) {
  if (player.down || world.phase === 'won') return;
  player.health = Math.max(0, player.health - amount);
  if (player.health) return;
  player.down = true;
  player.shield = false;
  player.revive = 0;
  announce(player.name.toUpperCase() + ' IS DOWN · WARD MUST COVER THE REVIVE');
  if (Object.values(players).every(p => p.down)) {
    setTimeout(resetCheckpoint, 900);
  }
}
function resetCheckpoint() {
  world.bolts = [];
  Object.values(players).forEach((p, i) => {
    p.x = 12; p.z = i ? 26 : 18; p.yaw = Math.PI / 2; p.down = false; p.revive = 0;
    p.health = p.maxHealth;
  });
  for (const enemy of world.enemies) {
    enemy.alive = true; enemy.health = enemy.maxHealth; enemy.x = enemy.kind === 'guardian' ? 55 : clamp(enemy.x, 44, 60); enemy.exposedUntil = 0;
  }
  announce('THE BOND RESTORED THE LAST CHAMBER');
}
function updateRevive(dt) {
  const ward = Object.values(players).find(p => p.role === 'ward' && !p.down && p.shield);
  const downed = Object.values(players).find(p => p.down);
  if (!ward || !downed || Math.hypot(ward.x - downed.x, ward.z - downed.z) > 4.3) {
    if (downed) downed.revive = Math.max(0, downed.revive - dt * 0.35);
    return;
  }
  downed.revive += dt / Math.max(1.5, 2.8 - world.upgrades.defense * 0.25);
  if (downed.revive >= 1) {
    downed.down = false; downed.revive = 0; downed.health = Math.ceil(downed.maxHealth * 0.55);
    announce(ward.name.toUpperCase() + ' RESTORED ' + downed.name.toUpperCase());
  }
}
function updateHuman(player, input, dt, now) {
  if (now - input.updatedAt > 650) { input.moveX = 0; input.moveY = 0; input.action = false; }
  if (Math.hypot(input.aimX, input.aimY) > 0.12) player.yaw = Math.atan2(input.aimX, input.aimY);
  move(player, input.moveX, input.moveY, dt);
  playerAction(player, input.action, now);
}
function move(player, x, y, dt) {
  if (player.down) return;
  const length = Math.min(1, Math.hypot(x, y));
  if (length < 0.03) return;
  const speed = roleStats(player.role).speed;
  player.x = clamp(player.x + x / length * speed * dt, 3, WORLD.width - 3);
  player.z = clamp(player.z + y / length * speed * dt, 3, WORLD.depth - 3);
}
function updateAI(player, dt, now) {
  if (world.phase === 'upgrade') {
    player.shield = false;
    move(player, (36 - player.x) * 0.2, (22 - player.z) * 0.2, dt);
    if (now - world.shrineOpenedAt > 10000) {
      const type = world.upgrades.attack <= world.upgrades.defense ? 'attack' : 'defense';
      chooseUpgrade(player, type);
    }
    return;
  }
  const living = world.enemies.filter(e => e.alive);
  if (!living.length || player.down) { player.shield = false; return; }
  living.sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
  const target = living[0];
  const partner = partnerOf(player.id);
  if (player.role === 'ward') {
    const desiredX = partner.x - Math.sin(partner.yaw) * 2.2;
    const desiredZ = partner.z - Math.cos(partner.yaw) * 2.2;
    move(player, desiredX - player.x, desiredZ - player.z, dt);
    const dx = target.x - player.x, dz = target.z - player.z;
    player.yaw = Math.atan2(dx, dz);
    const danger = world.bolts.some(b => Math.hypot(b.x - player.x, b.z - player.z) < 11);
    playerAction(player, danger || Math.hypot(dx, dz) < 8.4, now);
  } else {
    const dx = target.x - player.x, dz = target.z - player.z, distance = Math.hypot(dx, dz);
    const wobble = Math.sin(now * 0.0031 + Number(player.id.slice(1)) * 2.7) * 0.11;
    player.yaw = Math.atan2(dx, dz) + wobble;
    if (distance > 5.8) move(player, dx, dz, dt);
    else move(player, -dz * 0.25, dx * 0.25, dt);
    if (distance < 8.5 && Math.abs(wobble) < 0.1) playerAction(player, true, now);
  }
}
function spawnBolt(enemy, target, now) {
  const dx = target.x - enemy.x, dz = target.z - enemy.z, length = Math.max(0.001, Math.hypot(dx, dz));
  const speed = enemy.kind === 'guardian' ? 10.5 : 8.2;
  world.bolts.push({
    id: 'b' + nextBolt++, owner: enemy.id,
    x: enemy.x, z: enemy.z, vx: dx / length * speed, vz: dz / length * speed,
    damage: enemy.kind === 'guardian' ? 24 : 16, bornAt: now
  });
}
function updateEnemies(dt, now) {
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.stunnedUntil > now || world.phase === 'upgrade') continue;
    const target = nearestPlayer(enemy);
    if (!target) continue;
    const dx = target.x - enemy.x, dz = target.z - enemy.z, distance = Math.max(0.001, Math.hypot(dx, dz));
    enemy.yaw = Math.atan2(dx, dz);
    if (distance > (enemy.kind === 'guardian' ? 12 : 8)) {
      const speed = enemy.kind === 'guardian' ? 1.15 : 1.9;
      enemy.x += dx / distance * speed * dt; enemy.z += dz / distance * speed * dt;
    }
    const interval = enemy.kind === 'guardian' ? 900 : 1750;
    if (now - enemy.lastShotAt > interval) { enemy.lastShotAt = now; spawnBolt(enemy, target, now); }
  }
  world.enemies = world.enemies.filter(e => e.alive || now - world.eventAt < 500);
  const alive = world.enemies.filter(e => e.alive);
  if (world.phase === 'combat' && !alive.length) openShrine('THE FIRST CHAMBER IS CLEAR');
  const guardian = alive.find(e => e.id === world.guardianId);
  if (world.phase === 'guardian' && guardian && world.relayCount === 1 && guardian.health <= guardian.maxHealth * 0.52) openShrine('THE SENTINEL CHANGED ITS COUNTER');
  if (world.phase === 'guardian' && world.guardianId && !guardian) {
    world.phase = 'won'; world.result = { winner: 'bond', relays: world.relayCount, attack: world.upgrades.attack, defense: world.upgrades.defense };
    announce('RELAY COMPLETE · HUMAN AND AI BROKE THE SENTINEL TOGETHER');
  }
}
function updateBolts(dt, now) {
  const keep = [];
  for (const bolt of world.bolts) {
    bolt.x += bolt.vx * dt; bolt.z += bolt.vz * dt;
    if (now - bolt.bornAt > 6000 || bolt.x < 0 || bolt.z < 0 || bolt.x > WORLD.width || bolt.z > WORLD.depth) continue;
    let blocked = false;
    for (const ward of Object.values(players).filter(p => p.role === 'ward' && p.shield && !p.down)) {
      const radius = 3.6 + world.upgrades.defense * 0.45;
      if (Math.hypot(bolt.x - ward.x, bolt.z - ward.z) <= radius) {
        blocked = true;
        world.sparks.push({ id: 's' + now + bolt.id, kind: 'block', x: bolt.x, z: bolt.z, color: '#70eaff', bornAt: now });
        break;
      }
    }
    if (blocked) continue;
    let hit = null;
    for (const p of Object.values(players)) {
      if (!p.down && Math.hypot(bolt.x - p.x, bolt.z - p.z) < 1.05) { hit = p; break; }
    }
    if (hit) { damagePlayer(hit, bolt.damage, now); continue; }
    keep.push(bolt);
  }
  world.bolts = keep;
  world.sparks = world.sparks.filter(s => now - s.bornAt < 850);
}
function tick() {
  const now = Date.now();
  const dt = clamp((now - lastTick) / 1000, 0.001, 0.06);
  lastTick = now;
  for (const player of Object.values(players)) {
    player.shield = false;
    if (player.kind === 'human') updateHuman(player, inputs[player.id], dt, now);
    else updateAI(player, dt, now);
  }
  updateRevive(dt);
  if (world.phase !== 'won') { updateEnemies(dt, now); updateBolts(dt, now); }
}
function publicState() {
  const now = Date.now();
  return {
    ...world,
    now,
    enemies: world.enemies.map(e => ({ ...e, exposed: e.exposedUntil > now })),
    shrineIn: world.phase === 'upgrade' ? Math.max(0, 10000 - (now - world.shrineOpenedAt)) : 0
  };
}
function debriefData() {
  return {
    game_id: world.game_id,
    version: world.version,
    phase: world.phase,
    result: world.result,
    relayCount: world.relayCount,
    upgrades: world.upgrades,
    players: Object.values(players).map(function (p) { return { id: p.id, name: p.name, kind: p.kind, role: p.role, kills: p.kills, health: p.health, maxHealth: p.maxHealth, down: p.down }; }),
    timeline: world.timeline.slice(),
    summary: 'The pair completed ' + world.relayCount + ' forced role relays. Attack reached tier ' + world.upgrades.attack + ' and Defense reached tier ' + world.upgrades.defense + '.'
  };
}
function sendJson(res, code, value) {
  const body = JSON.stringify(value);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 25000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const mime = { '.js': 'text/javascript; charset=utf-8', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(urlPath, res) {
  const relative = decodeURIComponent(urlPath.replace(/^\//, ''));
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(path.resolve(ROOT) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://relaybound.local');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }); res.end(); return; }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); fs.createReadStream(CLIENT).pipe(res); return; }
    if (req.method === 'GET' && url.pathname === '/debrief') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); fs.createReadStream(DEBRIEF).pipe(res); return; }
    if (req.method === 'GET' && url.pathname === '/debrief-data') { sendJson(res, 200, debriefData()); return; }
    if (req.method === 'GET' && (url.pathname === '/state' || url.pathname === '/health')) { sendJson(res, 200, publicState()); return; }
    if (req.method === 'GET' && url.pathname === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' }); res.write('retry: 1000\n\n'); streams.add(res); req.on('close', () => streams.delete(res)); return; }
    if (req.method === 'GET' && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/vendor/'))) { if (!serveStatic(url.pathname, res)) sendJson(res, 404, { ok: false }); return; }
    if (req.method === 'POST' && url.pathname === '/input') {
      const id = /^p[12]$/.test(url.searchParams.get('player') || '') ? url.searchParams.get('player') : '';
      if (!players[id] || players[id].kind !== 'human') { sendJson(res, 403, { ok: false, error: 'seat is not human-controlled' }); return; }
      const body = await readJson(req), input = inputs[id];
      input.moveX = clamp(Number(body.moveX) || 0, -1, 1);
      input.moveY = clamp(Number(body.moveY) || 0, -1, 1);
      input.aimX = clamp(Number(body.aimX) || 0, -1, 1);
      input.aimY = clamp(Number(body.aimY) || 0, -1, 1);
      input.action = !!body.action;
      input.updatedAt = Date.now();
      if (body.upgrade) chooseUpgrade(players[id], String(body.upgrade));
      sendJson(res, 200, { ok: true }); return;
    }
    sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (error) { sendJson(res, 400, { ok: false, error: error.message }); }
});

const physics = setInterval(tick, TICK_MS);
const stream = setInterval(() => {
  const packet = 'data: ' + JSON.stringify(publicState()) + '\n\n';
  for (const client of streams) { try { client.write(packet); } catch (_) { streams.delete(client); } }
}, STREAM_MS);
server.listen(PORT, HOST, () => {
  console.log('Relaybound 004 · human + AI role relay vertical slice');
  console.log('Local: http://127.0.0.1:' + PORT + '/?player=screen');
});
function shutdown() { clearInterval(physics); clearInterval(stream); for (const client of streams) { try { client.end(); } catch (_) {} } server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 600).unref(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
