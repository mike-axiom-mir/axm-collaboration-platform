#!/usr/bin/env node
'use strict';

/**
 * Brace Room — pure simulation core.
 *
 * No DOM, no canvas, no networking in this file on purpose: every rule the
 * game runs on lives here as plain data + pure functions so it can be unit
 * tested directly (see tests/brace-room-selftest.js) and so app.js stays a
 * thin render/input layer on top of it.
 *
 * Balance numbers below are first-guess starting points (see
 * DESIGN_BIBLE.md and BUILD_PLAN.md) — tune after a real playtest, not
 * before.
 */

const ARENA = { width: 640, height: 640, centerX: 320, centerY: 320, ringRadius: 220 };
const ZONE_RADIUS = 46; // how close a player must be to a station to act on it
const PLAYER_SPEED = 190; // px/sec
const PLAYER_RADIUS = 14;

const MASH_GAIN = 14;
const HOLD_RATE = 46; // effort/sec while held in zone
const RHYTHM_GAIN = 27;
const RHYTHM_BEAT_MS = 650;
const RHYTHM_WINDOW_MS = 190;
const CREW_RATE = 42; // effort/sec while 2+ players hold together
const DECAY_RATE = 26; // effort/sec lost when not actively fed
const EFFORT_TARGET = 100;

const HULL_MAX = 100;
// v0.1.0 shipped with REGEN=3 / MISS=12 — a headless bot playtest (see
// dev/balance-sim.js) found that even a coordinated, always-correct bot
// lost 100% of runs across every player count and session length, because
// a realistic resolve:miss ratio (~1:1 even for a skilled team) times a
// 1:4 regen:damage ratio guarantees hull loss over any real session length.
// Rebalanced to a 7:9 ratio (still a real cost for missing, still real
// progress for succeeding) — see BALANCE_NOTES.md for the before/after data.
const HULL_REGEN_ON_RESOLVE = 7;
const HULL_DAMAGE_ON_MISS = 9;
const HULL_DAMAGE_ON_FALSE_ALARM_MISTAKE = 6;

const STATIONS = [
  { id: 'engine-bay', label: 'Engine Bay', faultLabel: 'Coolant Leak', verb: 'mash', angleDeg: 0 },
  { id: 'breaker', label: 'Breaker', faultLabel: 'Power Surge', verb: 'hold', angleDeg: 60 },
  { id: 'bulkhead', label: 'Bulkhead', faultLabel: 'Hull Breach', verb: 'crew2', angleDeg: 120 },
  { id: 'radio', label: 'Radio', faultLabel: 'Comms Static', verb: 'rhythm', angleDeg: 180 },
  { id: 'vent', label: 'Vent', faultLabel: 'Smoke', verb: 'mash', angleDeg: 240 },
  { id: 'ballast', label: 'Ballast', faultLabel: 'Trim Drift', verb: 'hold', angleDeg: 300 }
];

// Wave table: time-based, not score-based, so every session has a known shape.
const WAVES = [
  { wave: 1, shareEnd: 0.40, spawnMs: [3500, 4500], ringMs: 7000, crewEnabled: false, falseAlarmChance: 0 },
  { wave: 2, shareEnd: 0.75, spawnMs: [2000, 3000], ringMs: 5000, crewEnabled: true, falseAlarmChance: 0 },
  { wave: 3, shareEnd: 1.00, spawnMs: [1000, 1500], ringMs: 3500, crewEnabled: true, falseAlarmChance: 0.12 }
];

const PLAYER_IDS = ['p1', 'p2', 'p3', 'p4'];
const PLAYER_START_ANGLES = [200, 340, 20, 160]; // spread starting spots around the ring

function stationPosition(station) {
  const rad = (station.angleDeg * Math.PI) / 180;
  return {
    x: ARENA.centerX + Math.cos(rad) * ARENA.ringRadius,
    y: ARENA.centerY + Math.sin(rad) * ARENA.ringRadius
  };
}

/** Deterministic PRNG (mulberry32) so a session seed reproduces the same run. */
function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInRange(rng, range) {
  return range[0] + rng() * (range[1] - range[0]);
}

function waveForElapsed(elapsedMs, sessionLengthMs) {
  const fraction = sessionLengthMs > 0 ? Math.min(1, elapsedMs / sessionLengthMs) : 1;
  for (const wave of WAVES) {
    if (fraction <= wave.shareEnd) return wave;
  }
  return WAVES[WAVES.length - 1];
}

function maxConcurrentFaults(playerCount, waveNumber) {
  // v0.1.0 used `playerCount + (wave >= 3 ? 1 : 0)`, which meant wave 3
  // always had MORE simultaneous faults than there were players to cover
  // them — for every crew size, not just large ones. That isn't "harder,"
  // it's unwinnable regardless of skill (confirmed by dev/balance-sim.js:
  // 0% win rate across all 12 player-count/session-length combinations
  // even for a perfectly coordinated bot). Difficulty should come from
  // spawn speed and ring length shrinking — both things a team can get
  // better at — not from a fault count that exceeds the number of bodies
  // available to answer it. Wave 1 gets one fewer slot than the full crew
  // as breathing room while people learn the stations; waves 2-3 cap at
  // exactly the crew size, never above it.
  const players = Math.max(1, Math.min(4, playerCount || 1));
  if (waveNumber <= 1) return Math.max(1, players - 1);
  return Math.min(6, players);
}

function normalizePlayerCount(playerCount) {
  const n = Number(playerCount) || 1;
  return Math.max(1, Math.min(4, Math.round(n)));
}

function createInitialState(options) {
  const settings = options || {};
  const seed = Number.isFinite(settings.seed) ? settings.seed >>> 0 : 12026;
  const sessionMinutes = [6, 9, 12].includes(settings.sessionMinutes) ? settings.sessionMinutes : 9;
  const playerCount = normalizePlayerCount(settings.playerCount);
  const rng = createRng(seed);

  const players = {};
  for (let i = 0; i < 4; i += 1) {
    const id = PLAYER_IDS[i];
    const active = i < playerCount;
    const rad = (PLAYER_START_ANGLES[i] * Math.PI) / 180;
    players[id] = {
      id,
      active,
      x: ARENA.centerX + Math.cos(rad) * (ARENA.ringRadius * 0.4),
      y: ARENA.centerY + Math.sin(rad) * (ARENA.ringRadius * 0.4)
    };
  }

  return {
    schema: 'brace-room/state-v1',
    seed,
    rng,
    sessionMinutes,
    sessionLengthMs: sessionMinutes * 60 * 1000,
    playerCount,
    elapsedMs: 0,
    status: 'running', // 'running' | 'won' | 'lost'
    hull: HULL_MAX,
    currentStreak: 0,
    bestStreak: 0,
    stats: { resolved: 0, missed: 0, falseAlarmsAvoided: 0, falseAlarmsMisresolved: 0 },
    players,
    faults: [],
    nextFaultId: 1,
    lastSpawnAt: 0,
    nextSpawnInterval: randomInRange(rng, WAVES[0].spawnMs),
    lastEvents: [],
    summary: null
  };
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function playersInZone(state, station) {
  const pos = stationPosition(station);
  const ids = [];
  for (const id of PLAYER_IDS) {
    const player = state.players[id];
    if (!player || !player.active) continue;
    if (distance(player.x, player.y, pos.x, pos.y) <= ZONE_RADIUS) ids.push(id);
  }
  return ids;
}

function moveplayers(state, dtMs, inputsByPlayer) {
  const dtSec = dtMs / 1000;
  const inputs = inputsByPlayer || {};
  for (const id of PLAYER_IDS) {
    const player = state.players[id];
    if (!player || !player.active) continue;
    const input = inputs[id] || {};
    const mx = clampAxis(input.moveX);
    const my = clampAxis(input.moveY);
    const mag = Math.hypot(mx, my) || 1;
    const nx = mag > 1 ? mx / mag : mx;
    const ny = mag > 1 ? my / mag : my;
    player.x = clamp(player.x + nx * PLAYER_SPEED * dtSec, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    player.y = clamp(player.y + ny * PLAYER_SPEED * dtSec, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
  }
}

function clampAxis(v) {
  const n = Number(v) || 0;
  return Math.max(-1, Math.min(1, n));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// A Bulkhead (crew2) fault occupies two whole players for its duration —
// it costs twice the "capacity" of any other fault, not the same one slot.
// Treating it as a same-size slot (v0.1.0's behavior) meant that for a
// 2-3 player crew, a Bulkhead fault silently consumed the entire team and
// left any other concurrent fault guaranteed to expire untouched. The bot
// playtest (dev/balance-sim.js) surfaced this directly: 2-player win rate
// collapsed to 3-40% while 1-player and 4-player stayed healthy — a shape
// that only makes sense if the 2-player crew was structurally worse off,
// which it was.
function stationCapacityCost(station) {
  return station.verb === 'crew2' ? 2 : 1;
}

function usedCapacity(state) {
  return state.faults.reduce((sum, fault) => sum + (fault.verb === 'crew2' ? 2 : 1), 0);
}

function eligibleStationsForSpawn(state, wave, capacityRemaining) {
  const occupied = new Set(state.faults.map(f => f.stationId));
  return STATIONS.filter(station => {
    if (occupied.has(station.id)) return false;
    // A crew2 (Bulkhead) fault needs two players holding together at once.
    // With fewer than 2 active players it is mathematically unresolvable —
    // spawning one anyway would just be an unavoidable hull hit, which
    // contradicts the documented "no Bulkhead faults until a second player
    // joins" promise (README_FIRST.md, DESIGN_BIBLE.md §9). It also must
    // not spawn if there isn't enough free capacity to "afford" its cost of 2.
    if (station.verb === 'crew2' && (!wave.crewEnabled || state.playerCount < 2)) return false;
    if (stationCapacityCost(station) > capacityRemaining) return false;
    return true;
  });
}

function maybeSpawnFault(state, wave) {
  const capacityRemaining = maxConcurrentFaults(state.playerCount, wave.wave) - usedCapacity(state);
  if (capacityRemaining <= 0) return;
  if (state.elapsedMs - state.lastSpawnAt < state.nextSpawnInterval) return;

  const candidates = eligibleStationsForSpawn(state, wave, capacityRemaining);
  if (candidates.length === 0) return;

  const station = candidates[Math.floor(state.rng() * candidates.length) % candidates.length];
  const isFalseAlarm = station.verb !== 'crew2' && state.rng() < wave.falseAlarmChance;

  state.faults.push({
    id: state.nextFaultId++,
    stationId: station.id,
    verb: station.verb,
    kind: isFalseAlarm ? 'false' : 'real',
    effort: 0,
    spawnedAt: state.elapsedMs,
    ringMs: wave.ringMs,
    beatAnchorMs: state.elapsedMs
  });
  state.lastSpawnAt = state.elapsedMs;
  state.nextSpawnInterval = randomInRange(state.rng, wave.spawnMs);
}

function nearestBeatDelta(msSinceAnchor) {
  const phase = msSinceAnchor % RHYTHM_BEAT_MS;
  return Math.min(phase, RHYTHM_BEAT_MS - phase);
}

function updateFault(state, fault, dtMs, inputsByPlayer) {
  const station = STATIONS.find(s => s.id === fault.stationId);
  const present = playersInZone(state, station);
  const inputs = inputsByPlayer || {};
  const presentHolding = present.filter(id => inputs[id] && inputs[id].action);
  const presentEdge = present.filter(id => inputs[id] && inputs[id].actionEdge);
  const dtSec = dtMs / 1000;
  let fed = false;

  if (fault.verb === 'mash') {
    if (presentEdge.length > 0) {
      fault.effort += MASH_GAIN * presentEdge.length;
      fed = true;
    }
  } else if (fault.verb === 'hold') {
    if (presentHolding.length > 0) {
      fault.effort += HOLD_RATE * dtSec;
      fed = true;
    }
  } else if (fault.verb === 'rhythm') {
    if (presentEdge.length > 0) {
      const delta = nearestBeatDelta(state.elapsedMs - fault.beatAnchorMs);
      if (delta <= RHYTHM_WINDOW_MS) {
        fault.effort += RHYTHM_GAIN * presentEdge.length;
        fed = true;
      }
    }
  } else if (fault.verb === 'crew2') {
    if (presentHolding.length >= 2) {
      fault.effort += CREW_RATE * dtSec;
      fed = true;
    }
  }

  if (!fed) {
    fault.effort = Math.max(0, fault.effort - DECAY_RATE * dtSec);
  }
  fault.effort = Math.min(EFFORT_TARGET, fault.effort);
}

function applyResolution(state, fault) {
  if (fault.kind === 'real') {
    state.hull = clamp(state.hull + HULL_REGEN_ON_RESOLVE, 0, HULL_MAX);
    state.stats.resolved += 1;
    state.currentStreak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
    state.lastEvents.push({ type: 'resolved', stationId: fault.stationId });
  } else {
    state.hull = clamp(state.hull - HULL_DAMAGE_ON_FALSE_ALARM_MISTAKE, 0, HULL_MAX);
    state.stats.falseAlarmsMisresolved += 1;
    state.currentStreak = 0;
    state.lastEvents.push({ type: 'false-alarm-mistake', stationId: fault.stationId });
  }
}

function applyExpiry(state, fault) {
  if (fault.kind === 'real') {
    state.hull = clamp(state.hull - HULL_DAMAGE_ON_MISS, 0, HULL_MAX);
    state.stats.missed += 1;
    state.currentStreak = 0;
    state.lastEvents.push({ type: 'missed', stationId: fault.stationId });
  } else {
    state.stats.falseAlarmsAvoided += 1;
    state.lastEvents.push({ type: 'false-alarm-avoided', stationId: fault.stationId });
  }
}

function buildSummary(state) {
  return {
    outcome: state.status,
    finalHull: Math.round(state.hull),
    resolved: state.stats.resolved,
    missed: state.stats.missed,
    falseAlarmsAvoided: state.stats.falseAlarmsAvoided,
    falseAlarmsMisresolved: state.stats.falseAlarmsMisresolved,
    bestStreak: state.bestStreak,
    durationMs: state.elapsedMs,
    playerCount: state.playerCount
  };
}

/**
 * Advance the simulation by dtMs given this tick's per-player inputs.
 * inputsByPlayer: { p1: { moveX, moveY, action, actionEdge }, ... }
 * Returns the same state object (mutated in place) for convenience.
 */
function tick(state, dtMs, inputsByPlayer) {
  if (state.status !== 'running') return state;
  state.lastEvents = [];

  state.elapsedMs += dtMs;
  moveplayers(state, dtMs, inputsByPlayer);

  const wave = waveForElapsed(state.elapsedMs, state.sessionLengthMs);
  state.wave = wave.wave;

  maybeSpawnFault(state, wave);

  const stillActive = [];
  for (const fault of state.faults) {
    updateFault(state, fault, dtMs, inputsByPlayer);
    const age = state.elapsedMs - fault.spawnedAt;
    if (fault.effort >= EFFORT_TARGET) {
      applyResolution(state, fault);
    } else if (age >= fault.ringMs) {
      applyExpiry(state, fault);
    } else {
      stillActive.push(fault);
    }
  }
  state.faults = stillActive;

  if (state.hull <= 0) {
    state.hull = 0;
    state.status = 'lost';
  } else if (state.elapsedMs >= state.sessionLengthMs) {
    state.status = 'won';
  }

  if (state.status !== 'running') {
    state.summary = buildSummary(state);
  }

  return state;
}

const BraceRoomCore = {
  ARENA,
  ZONE_RADIUS,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  STATIONS,
  WAVES,
  HULL_MAX,
  EFFORT_TARGET,
  PLAYER_IDS,
  RHYTHM_BEAT_MS,
  RHYTHM_WINDOW_MS,
  stationPosition,
  createRng,
  waveForElapsed,
  maxConcurrentFaults,
  normalizePlayerCount,
  createInitialState,
  playersInZone,
  nearestBeatDelta,
  tick,
  buildSummary
};

// UMD-lite: CommonJS for Node (server + tests), global for the browser
// client (loaded as a plain <script>, no bundler in this project).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BraceRoomCore;
} else {
  this.BraceRoomCore = BraceRoomCore; // eslint-disable-line no-invalid-this
}
