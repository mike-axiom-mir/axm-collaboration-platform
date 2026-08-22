#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = process.env.AXM_RELAYBOUND_HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8794);
const ROOT = __dirname;
const CLIENT = path.join(ROOT, 'relaybound-client.html');
const DEBRIEF = path.join(ROOT, 'relaybound-debrief.html');
const TICK_MS = 1000 / 30;
const STREAM_MS = 80;
const WORLD = { width: 72, depth: 44 };
const START_COUNTDOWN_MS = Math.max(60, Math.min(5000, Number(process.env.AXM_RELAYBOUND_COUNTDOWN_MS) || 3000));
const BEACON_HOLD_MS = Math.max(120, Math.min(6000, Number(process.env.AXM_RELAYBOUND_BEACON_HOLD_MS) || 1600));
const RESONANCE_MS = 12000;
const TEST_MODE = process.env.AXM_TEST_MODE === '1';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function cleanName(v, fallback) {
  const text = String(v || '').replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 22);
  return text || fallback;
}
function seatKind(value) {
  const type = String(value || '').toLowerCase();
  return type === 'adapter' || type === 'ai' ? type : 'human';
}
function loadSeats() {
  let raw = [];
  try { raw = JSON.parse(process.env.AXM_PLAYERS_JSON || '[]'); } catch (_) {}
  if (!raw.length) raw = [{ display_name: 'Human', type: 'human' }, { display_name: 'Nova', type: 'ai' }];
  if (raw.length === 1) raw.push({ display_name: 'Nova', type: 'ai' });
  return raw.slice(0, 2).map((seat, i) => ({
    id: 'p' + (i + 1),
    seatId: cleanName(seat.seat_id || seat.seatId, 'seat_' + (i + 1)),
    name: cleanName(seat.display_name, i ? 'Nova' : 'Human'),
    kind: seatKind(seat.type),
    adapterId: seatKind(seat.type) === 'adapter' ? cleanName(seat.adapter_id || seat.adapterId || seat.display_name, 'connected-ai') : null
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
    invulnerableUntil: 0,
    lastActionAt: 0,
    kills: 0
  };
  inputs[seat.id] = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, action: false, updatedAt: 0, seq: 0 };
});
const adapterBindings = seats.filter(seat => seat.kind === 'adapter').map(seat => ({
  seatId: seat.seatId,
  actorId: seat.id,
  adapterId: seat.adapterId,
  token: 'seat-' + crypto.randomBytes(18).toString('hex'),
  protocol: 'axm-semantic-input-v1',
  inputEndpoint: '/api/input',
  observationEndpoint: '/api/adapter-observation'
}));

let nextEnemy = 1;
let nextBolt = 1;
let lastTick = Date.now();
const streams = new Set();
const world = {
  game_id: '004-relaybound',
  version: '0.4.0-echo-chamber',
  phase: 'ready',
  stage: 1,
  arena: WORLD,
  players,
  enemies: [],
  bolts: [],
  sparks: [],
  upgrades: { attack: 1, defense: 1 },
  relayCount: 0,
  chambersCleared: 0,
  echoesDefeated: 0,
  beacons: [],
  resonanceUntil: 0,
  countdownEndsAt: 0,
  combatGraceUntil: 0,
  shrineOpenedAt: 0,
  event: 'RUN READY · START WHEN BOTH PARTNERS CAN SEE THEIR CONTROLS',
  eventAt: Date.now(),
  guardianId: null,
  result: null,
  timeline: [{ at: Date.now(), text: 'RUN READY · START WHEN BOTH PARTNERS CAN SEE THEIR CONTROLS' }]
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
  const echo = kind === 'echo';
  const enemyNumber = nextEnemy++;
  return {
    id: 'e' + enemyNumber, kind,
    x, z, yaw: -Math.PI / 2,
    spawnX: x, spawnZ: z,
    health: guardian ? 300 : echo ? 54 : 38,
    maxHealth: guardian ? 300 : echo ? 54 : 38,
    exposedUntil: 0,
    stunnedUntil: 0,
    lastShotAt: Date.now(),
    shotInterval: guardian ? 1150 : echo ? 1750 + (enemyNumber % 3) * 150 : 2100 + (enemyNumber % 4) * 180,
    attackSeed: Math.random() * Math.PI * 2,
    alive: true
  };
}
function makeBeacons() {
  return [
    { id: 'beacon_1', label: 'EMBER BOND', x: 15, z: 22, progress: 0, complete: false },
    { id: 'beacon_2', label: 'SKY BOND', x: 38, z: 33, progress: 0, complete: false }
  ];
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
function spawnEchoChamber() {
  const now = Date.now();
  world.enemies = [
    makeEnemy('echo', 43, 8), makeEnemy('echo', 54, 11), makeEnemy('echo', 63, 18),
    makeEnemy('echo', 45, 32), makeEnemy('echo', 55, 36), makeEnemy('echo', 64, 28)
  ];
  world.guardianId = null;
  world.phase = 'combat';
  world.stage = 2;
  world.combatGraceUntil = now + 2400;
  Object.values(players).forEach(player => { player.invulnerableUntil = world.combatGraceUntil; });
  world.enemies.forEach((enemy, index) => { enemy.lastShotAt = world.combatGraceUntil - enemy.shotInterval + index * 210; });
}
function resetRun() {
  world.phase = 'ready';
  world.stage = 1;
  world.enemies = [];
  world.bolts = [];
  world.sparks = [];
  world.upgrades = { attack: 1, defense: 1 };
  world.relayCount = 0;
  world.chambersCleared = 0;
  world.echoesDefeated = 0;
  world.beacons = makeBeacons();
  world.resonanceUntil = 0;
  world.countdownEndsAt = 0;
  world.combatGraceUntil = 0;
  world.shrineOpenedAt = 0;
  world.guardianId = null;
  world.result = null;
  world.timeline = [];
  Object.values(players).forEach((player, index) => {
    player.x = 12;
    player.z = index ? 26 : 18;
    player.yaw = Math.PI / 2;
    player.kills = 0;
    player.invulnerableUntil = 0;
    applyRole(player, index ? 'ward' : 'edge', true);
    const input = inputs[player.id];
    input.moveX = 0; input.moveY = 0; input.action = false; input.updatedAt = 0;
  });
  spawnFirstChamber();
  announce('RUN READY · START WHEN BOTH PARTNERS CAN SEE THEIR CONTROLS');
}
function beginCountdown() {
  if (world.phase !== 'ready') return false;
  world.phase = 'countdown';
  world.countdownEndsAt = Date.now() + START_COUNTDOWN_MS;
  announce('RELAY OPENS IN 3');
  return true;
}
function beginCombat() {
  world.phase = 'combat';
  world.countdownEndsAt = 0;
  const now = Date.now();
  world.combatGraceUntil = now + 2600;
  Object.values(players).forEach(player => { player.invulnerableUntil = world.combatGraceUntil; });
  world.enemies.forEach((enemy, index) => { enemy.lastShotAt = world.combatGraceUntil - enemy.shotInterval + index * 260; });
  announce('WARD EXPOSES · EDGE STRIKES · OPTIONAL BOND BEACONS REWARD STAYING TOGETHER');
}
resetRun();

function nearestPlayer(enemy) {
  const active = Object.values(players).filter(p => !p.down);
  active.sort((a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z));
  return active[0] || null;
}
function partnerOf(id) { return players[id === 'p1' ? 'p2' : 'p1']; }
function exposeAround(ward, now) {
  let count = 0;
  const radius = 8.2 + world.upgrades.defense * 0.75;
  const resonanceBonus = now < world.resonanceUntil ? 700 : 0;
  for (const enemy of world.enemies) {
    if (!enemy.alive || Math.hypot(enemy.x - ward.x, enemy.z - ward.z) > radius) continue;
    enemy.exposedUntil = Math.max(enemy.exposedUntil, now + 2700 + world.upgrades.defense * 350 + resonanceBonus);
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
  const damage = Math.round((13 + world.upgrades.attack * 7) * (now < world.resonanceUntil ? 1.25 : 1));
  best.health = Math.max(0, best.health - damage);
  best.stunnedUntil = now + 350;
  if (!best.health) {
    best.alive = false;
    if (best.kind === 'echo') world.echoesDefeated++;
    player.kills++;
    announce(player.name.toUpperCase() + ' BROKE ' + (best.kind === 'guardian' ? 'THE SENTINEL' : best.kind === 'echo' ? 'AN ECHO' : 'A SHADE'));
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
  if (world.relayCount === 1) { spawnEchoChamber(); announce(relayEvent + ' · THE ECHO CHAMBER OPENS'); }
  else if (world.relayCount === 2) { spawnGuardian(); world.stage = 3; announce(relayEvent + ' · SENTINEL AWAKENS'); }
  else {
    world.phase = 'guardian';
    const guardian = world.enemies.find(e => e.id === world.guardianId);
    if (guardian) { guardian.stunnedUntil = Date.now() + 1100; guardian.exposedUntil = 0; }
    world.stage = 4;
    announce(relayEvent + ' · FINAL PHASE');
  }
  return true;
}
function openShrine(reason) {
  world.phase = 'upgrade';
  world.shrineOpenedAt = Date.now();
  world.bolts = [];
  Object.values(players).forEach(p => {
    p.shield = false;
    p.down = false;
    p.revive = 0;
    p.health = Math.max(Math.ceil(p.maxHealth * 0.55), Math.min(p.maxHealth, p.health + p.maxHealth * 0.35));
  });
  announce(reason + ' · CHOOSE WHAT YOUR PARTNER WILL INHERIT');
}
function damagePlayer(player, amount, now) {
  if (player.down || world.phase === 'won' || player.invulnerableUntil > now) return;
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
  const now = Date.now();
  world.bolts = [];
  world.combatGraceUntil = now + 2200;
  Object.values(players).forEach((p, i) => {
    p.x = 12; p.z = i ? 26 : 18; p.yaw = Math.PI / 2; p.down = false; p.revive = 0;
    p.health = p.maxHealth;
    p.invulnerableUntil = world.combatGraceUntil;
  });
  world.enemies.forEach((enemy, index) => {
    enemy.alive = true; enemy.health = enemy.maxHealth; enemy.x = enemy.spawnX; enemy.z = enemy.spawnZ; enemy.exposedUntil = 0;
    enemy.lastShotAt = world.combatGraceUntil - enemy.shotInterval + index * 260;
  });
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
  const partner = partnerOf(player.id);
  const partnerBeacon = world.beacons.find(beacon => !beacon.complete && Math.hypot(partner.x - beacon.x, partner.z - beacon.z) < 5.6);
  if (partnerBeacon) {
    player.shield = false;
    move(player, partnerBeacon.x - player.x, partnerBeacon.z - player.z, dt);
    return;
  }
  const living = world.enemies.filter(e => e.alive);
  if (!living.length || player.down) { player.shield = false; return; }
  living.sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
  const target = living[0];
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
  const speed = enemy.kind === 'guardian' ? 9.2 : enemy.kind === 'echo' ? 8 : 7;
  world.bolts.push({
    id: 'b' + nextBolt++, owner: enemy.id,
    x: enemy.x, z: enemy.z, vx: dx / length * speed, vz: dz / length * speed,
    damage: enemy.kind === 'guardian' ? 18 : enemy.kind === 'echo' ? 12 : 10, bornAt: now
  });
}
function separateEnemies() {
  const alive = world.enemies.filter(enemy => enemy.alive);
  const minimum = 2.35;
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      let dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot(dx, dz);
      if (distance >= minimum) continue;
      if (distance < 0.001) { dx = (i + j) % 2 ? 1 : -1; dz = 0; distance = 1; }
      const push = (minimum - distance) * 0.5;
      const nx = dx / distance, nz = dz / distance;
      a.x = clamp(a.x - nx * push, 3, WORLD.width - 3);
      a.z = clamp(a.z - nz * push, 3, WORLD.depth - 3);
      b.x = clamp(b.x + nx * push, 3, WORLD.width - 3);
      b.z = clamp(b.z + nz * push, 3, WORLD.depth - 3);
    }
  }
}
function updateEnemies(dt, now) {
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.stunnedUntil > now || world.phase === 'upgrade') continue;
    const target = nearestPlayer(enemy);
    if (!target) continue;
    const dx = target.x - enemy.x, dz = target.z - enemy.z, distance = Math.max(0.001, Math.hypot(dx, dz));
    enemy.yaw = Math.atan2(dx, dz);
    if (distance > (enemy.kind === 'guardian' ? 12 : enemy.kind === 'echo' ? 9 : 8)) {
      const speed = enemy.kind === 'guardian' ? 1.15 : enemy.kind === 'echo' ? 2.15 : 1.9;
      enemy.x += dx / distance * speed * dt; enemy.z += dz / distance * speed * dt;
    }
  }
  separateEnemies();
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.stunnedUntil > now || world.phase === 'upgrade' || now < world.combatGraceUntil) continue;
    const target = nearestPlayer(enemy);
    if (!target) continue;
    const distance = Math.hypot(target.x - enemy.x, target.z - enemy.z);
    const range = enemy.kind === 'guardian' ? 34 : enemy.kind === 'echo' ? 30 : 28;
    if (distance <= range && now - enemy.lastShotAt > enemy.shotInterval) {
      enemy.lastShotAt = now;
      spawnBolt(enemy, target, now);
    }
  }
  world.enemies = world.enemies.filter(e => e.alive || now - world.eventAt < 500);
  const alive = world.enemies.filter(e => e.alive);
  if (world.phase === 'combat' && !alive.length) {
    world.chambersCleared = Math.max(world.chambersCleared, world.stage);
    openShrine(world.stage === 1 ? 'THE FIRST CHAMBER IS CLEAR' : 'THE ECHO CHAMBER IS CLEAR');
  }
  const guardian = alive.find(e => e.id === world.guardianId);
  if (world.phase === 'guardian' && guardian && world.relayCount === 2 && guardian.health <= guardian.maxHealth * 0.52) openShrine('THE SENTINEL CHANGED ITS COUNTER');
  if (world.phase === 'guardian' && world.guardianId && !guardian) {
    world.phase = 'won'; world.result = { winner: 'bond', relays: world.relayCount, chambers: world.chambersCleared, echoes: world.echoesDefeated, attack: world.upgrades.attack, defense: world.upgrades.defense, beacons: world.beacons.filter(beacon => beacon.complete).length };
    announce('RELAY COMPLETE · THE PARTNERS BROKE THE SENTINEL TOGETHER');
  }
}
function updateBolts(dt, now) {
  const keep = [];
  for (const bolt of world.bolts) {
    bolt.x += bolt.vx * dt; bolt.z += bolt.vz * dt;
    if (now - bolt.bornAt > 6000 || bolt.x < 0 || bolt.z < 0 || bolt.x > WORLD.width || bolt.z > WORLD.depth) continue;
    let blocked = false;
    for (const ward of Object.values(players).filter(p => p.role === 'ward' && p.shield && !p.down)) {
      const radius = 3.6 + world.upgrades.defense * 0.45 + (now < world.resonanceUntil ? 0.8 : 0);
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
function updateBeacons(dt, now) {
  if (!['combat', 'guardian'].includes(world.phase)) return;
  for (const beacon of world.beacons) {
    if (beacon.complete) continue;
    const nearby = Object.values(players).filter(player => !player.down && Math.hypot(player.x - beacon.x, player.z - beacon.z) <= 3.7);
    if (nearby.length === 2) beacon.progress = Math.min(1, beacon.progress + dt * 1000 / BEACON_HOLD_MS);
    else beacon.progress = Math.max(0, beacon.progress - dt * 0.22);
    if (beacon.progress < 1) continue;
    beacon.complete = true;
    world.resonanceUntil = now + RESONANCE_MS;
    Object.values(players).forEach(player => { if (!player.down) player.health = Math.min(player.maxHealth, player.health + Math.ceil(player.maxHealth * 0.28)); });
    world.sparks.push({ id: 'beacon-' + beacon.id + '-' + now, kind: 'resonance', x: beacon.x, z: beacon.z, color: '#a5ffcf', bornAt: now });
    announce(beacon.label + ' STABILIZED · TEAM HEALED · RELAY BOOSTED FOR 12 SECONDS');
  }
}
function tick() {
  const now = Date.now();
  const dt = clamp((now - lastTick) / 1000, 0.001, 0.06);
  lastTick = now;
  if (world.phase === 'countdown' && now >= world.countdownEndsAt) beginCombat();
  if (world.phase === 'ready' || world.phase === 'countdown' || world.phase === 'won') return;
  for (const player of Object.values(players)) {
    player.shield = false;
    if (player.kind === 'ai') updateAI(player, dt, now);
    else updateHuman(player, inputs[player.id], dt, now);
  }
  updateRevive(dt);
  updateBeacons(dt, now);
  updateEnemies(dt, now);
  updateBolts(dt, now);
}
function publicState() {
  const now = Date.now();
  return {
    ...world,
    now,
    enemies: world.enemies.map(e => ({ ...e, exposed: e.exposedUntil > now })),
    shrineIn: world.phase === 'upgrade' ? Math.max(0, 10000 - (now - world.shrineOpenedAt)) : 0,
    countdownRemaining: world.phase === 'countdown' ? Math.max(0, world.countdownEndsAt - now) : 0,
    resonanceRemaining: Math.max(0, world.resonanceUntil - now)
  };
}
function controllerState() {
  const state = publicState();
  return {
    game_id: state.game_id,
    version: state.version,
    phase: state.phase,
    stage: state.stage,
    players: state.players,
    upgrades: state.upgrades,
    chambersCleared: state.chambersCleared,
    beacons: state.beacons,
    event: state.event,
    eventAt: state.eventAt,
    now: state.now,
    shrineIn: state.shrineIn,
    countdownRemaining: state.countdownRemaining,
    resonanceRemaining: state.resonanceRemaining
  };
}
function launcherState() {
  return {
    ok: true,
    schema: 'axm.game-runtime-launcher-state/v1',
    gameId: world.game_id,
    playablePath: '/games/004/?player=screen',
    team: Object.values(players).map(player => ({ actorId: player.id, seatId: player.seatId, name: player.name, type: player.kind })),
    adapterBindings: adapterBindings.map(binding => ({ ...binding })),
    gamepadProfile: 'axm-universal-xbox-brawl-v0.2.1',
    localOnly: true
  };
}
function adapterBinding(request, url, body) {
  const seatId = String((body && (body.seatId || body.seat_id)) || url.searchParams.get('seat') || '');
  const token = String((body && body.token) || request.headers['x-axm-seat-token'] || '').replace(/^Bearer\s+/i, '');
  return adapterBindings.find(binding => binding.seatId === seatId && binding.token === token) || null;
}
function adapterObservation(binding) {
  const self = players[binding.actorId], partner = partnerOf(binding.actorId), now = Date.now();
  return {
    ok: true,
    schema: 'axm.relaybound.adapter-observation/v1',
    gameId: world.game_id,
    seatId: binding.seatId,
    actorId: binding.actorId,
    phase: world.phase,
    stage: world.stage,
    objective: world.event,
    self: { id: self.id, role: self.role, x: self.x, z: self.z, yaw: self.yaw, health: self.health, maxHealth: self.maxHealth, down: self.down, shield: self.shield },
    partner: { id: partner.id, role: partner.role, x: partner.x, z: partner.z, health: partner.health, maxHealth: partner.maxHealth, down: partner.down },
    enemies: world.enemies.filter(enemy => enemy.alive).map(enemy => ({ id: enemy.id, kind: enemy.kind, x: enemy.x, z: enemy.z, health: enemy.health, exposed: enemy.exposedUntil > now })),
    beacons: world.beacons.map(beacon => ({ id: beacon.id, label: beacon.label, x: beacon.x, z: beacon.z, progress: beacon.progress, complete: beacon.complete })),
    resonanceRemaining: Math.max(0, world.resonanceUntil - now),
    upgrades: { ...world.upgrades },
    chambersCleared: world.chambersCleared,
    controls: { protocol: 'axm-semantic-input-v1', inputEndpoint: '/api/input', nextSequenceMinimum: inputs[binding.actorId].seq + 1, intents: ['move', 'aim', 'action', 'upgrade'] },
    authority: 'observation-only'
  };
}
function debriefData() {
  return {
    game_id: world.game_id,
    version: world.version,
    phase: world.phase,
    result: world.result,
    relayCount: world.relayCount,
    chambersCleared: world.chambersCleared,
    echoesDefeated: world.echoesDefeated,
    beaconsCompleted: world.beacons.filter(beacon => beacon.complete).length,
    upgrades: world.upgrades,
    players: Object.values(players).map(function (p) { return { id: p.id, name: p.name, kind: p.kind, role: p.role, kills: p.kills, health: p.health, maxHealth: p.maxHealth, down: p.down }; }),
    timeline: world.timeline.slice(),
    summary: 'The pair cleared ' + world.chambersCleared + ' combat chambers, completed ' + world.relayCount + ' forced role relays, and stabilized ' + world.beacons.filter(beacon => beacon.complete).length + ' optional bond beacons. Attack reached tier ' + world.upgrades.attack + ' and Defense reached tier ' + world.upgrades.defense + '.'
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
const FALLBACK_COLORMAP = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlW/7cAAAAASUVORK5CYII=', 'base64');
function serveStatic(urlPath, res) {
  const relative = decodeURIComponent(urlPath.replace(/^\//, ''));
  const file = path.resolve(ROOT, relative);
  if (file.startsWith(path.resolve(ROOT) + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, {
      'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache, max-age=0, must-revalidate',
      'x-axm-asset-authority': 'packaged'
    });
    fs.createReadStream(file).pipe(res);
    return true;
  }
  if (/\/Textures\/colormap\.png$/i.test(urlPath)) {
    res.writeHead(200, {
      'content-type': 'image/png',
      'content-length': FALLBACK_COLORMAP.length,
      'cache-control': 'no-store',
      'x-axm-asset-authority': 'fallback'
    });
    res.end(FALLBACK_COLORMAP);
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://relaybound.local');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-axm-seat-token' }); res.end(); return; }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); fs.createReadStream(CLIENT).pipe(res); return; }
    if (req.method === 'GET' && url.pathname === '/debrief') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); fs.createReadStream(DEBRIEF).pipe(res); return; }
    if (req.method === 'GET' && url.pathname === '/debrief-data') { sendJson(res, 200, debriefData()); return; }
    if (req.method === 'GET' && url.pathname === '/api/launcher-state') { sendJson(res, 200, launcherState()); return; }
    if (req.method === 'GET' && url.pathname === '/api/adapter-observation') {
      const binding = adapterBinding(req, url, null);
      if (!binding) { sendJson(res, 403, { ok: false, error: 'invalid connected-AI seat binding' }); return; }
      sendJson(res, 200, adapterObservation(binding)); return;
    }
    if (req.method === 'GET' && (url.pathname === '/state' || url.pathname === '/health')) {
      sendJson(res, 200, url.pathname === '/state' && url.searchParams.get('view') === 'controller' ? controllerState() : publicState()); return;
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
      res.write('retry: 1000\n\n');
      const streamClient = { res, controller: url.searchParams.get('view') === 'controller' };
      streams.add(streamClient);
      req.on('close', () => streams.delete(streamClient));
      return;
    }
    if (req.method === 'GET' && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/vendor/'))) { if (!serveStatic(url.pathname, res)) sendJson(res, 404, { ok: false }); return; }
    if (TEST_MODE && req.method === 'POST' && url.pathname === '/api/test/set') {
      const body = await readJson(req);
      if (body.phase) world.phase = String(body.phase);
      if (body.players) Object.keys(body.players).forEach(id => { if (players[id]) Object.assign(players[id], body.players[id]); });
      if (body.clearEnemies) world.enemies.forEach(enemy => { enemy.alive = false; enemy.health = 0; });
      if (Number.isFinite(body.guardianHealth)) { const guardian = world.enemies.find(enemy => enemy.id === world.guardianId); if (guardian) guardian.health = clamp(Number(body.guardianHealth), 0, guardian.maxHealth); }
      sendJson(res, 200, { ok: true, state: publicState() }); return;
    }
    if (req.method === 'POST' && url.pathname === '/start') {
      if (!beginCountdown()) { sendJson(res, 409, { ok: false, error: 'run is not waiting to start' }); return; }
      sendJson(res, 200, { ok: true, state: publicState() }); return;
    }
    if (req.method === 'POST' && url.pathname === '/restart') {
      if (world.phase !== 'won') { sendJson(res, 409, { ok: false, error: 'finish the current run before restarting' }); return; }
      resetRun();
      sendJson(res, 200, { ok: true, state: publicState() }); return;
    }
    if (req.method === 'POST' && url.pathname === '/input') {
      const body = await readJson(req);
      let id = /^p[12]$/.test(url.searchParams.get('player') || '') ? url.searchParams.get('player') : '';
      let binding = null;
      if (!id && (body.seatId || body.seat_id)) { binding = adapterBinding(req, url, body); id = binding ? binding.actorId : ''; }
      if (!players[id] || players[id].kind === 'ai') { sendJson(res, 403, { ok: false, error: 'seat is controlled by the in-game AI' }); return; }
      if (players[id].kind === 'adapter') {
        binding = binding || adapterBinding(req, url, body);
        if (!binding || binding.actorId !== id) { sendJson(res, 403, { ok: false, error: 'invalid connected-AI seat binding' }); return; }
      }
      const semantic = body.input && typeof body.input === 'object' ? body.input : body;
      const input = inputs[id];
      if (players[id].kind === 'adapter') {
        const seq = Number(body.seq);
        if (!Number.isSafeInteger(seq) || seq <= input.seq) { sendJson(res, 409, { ok: false, error: 'stale connected-AI sequence', nextSequenceMinimum: input.seq + 1 }); return; }
        input.seq = seq;
      }
      input.moveX = clamp(Number(semantic.moveX) || 0, -1, 1);
      input.moveY = clamp(Number(semantic.moveY) || 0, -1, 1);
      input.aimX = clamp(Number(semantic.aimX) || 0, -1, 1);
      input.aimY = clamp(Number(semantic.aimY) || 0, -1, 1);
      input.action = !!(semantic.action || semantic.fire || semantic.attack);
      input.updatedAt = Date.now();
      if (semantic.upgrade) chooseUpgrade(players[id], String(semantic.upgrade));
      sendJson(res, 200, { ok: true }); return;
    }
    sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (error) { sendJson(res, 400, { ok: false, error: error.message }); }
});

const physics = setInterval(tick, TICK_MS);
const stream = setInterval(() => {
  if (!streams.size) return;
  const fullPacket = 'data: ' + JSON.stringify(publicState()) + '\n\n';
  let controllerPacket = '';
  for (const client of streams) {
    try {
      if (client.controller && !controllerPacket) controllerPacket = 'data: ' + JSON.stringify(controllerState()) + '\n\n';
      client.res.write(client.controller ? controllerPacket : fullPacket);
    } catch (_) { streams.delete(client); }
  }
}, STREAM_MS);
server.listen(PORT, HOST, () => {
  console.log('Relaybound 004 · two-chamber 3D role relay');
  console.log('Local: http://127.0.0.1:' + PORT + '/?player=screen');
});
function shutdown() { clearInterval(physics); clearInterval(stream); for (const client of streams) { try { client.res.end(); } catch (_) {} } server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 600).unref(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
