'use strict';

const LANES_X = [-5.5, 0, 5.5];
const PHASES = {countdown: 'countdown', running: 'running', paused: 'paused', won: 'won', lost: 'lost'};
const COLORS = {
  player: '#5fd8ff',
  shard: '#58b9ff',
  obstacle: '#ff3b42',
  fog: 0x0a1128,
  accent: '#d4a6ff',
  void: '#11214d'
};

const BASE_RUN_SPEED = 11.2;
const BASE_GRAVITY = -34;
const JUMP_VELOCITY = 14.4;
const PLAYER_RADIUS = 1.1;
const PLAYER_HALF_HEIGHT = 1.2;
const COUNTDOWN_MS = 2400;
const WORLD_AHEAD = 125;
const WIN_DISTANCE = 420;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function toMs(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return fallback;
}
function makeRng(seed) {
  let s = seed >>> 0;
  return function random() {
    s = (Math.imul(16598013, s) + 1013904223) >>> 0;
    return (s >>> 8) / 0x01000000;
  };
}
function toFloat(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAxis(value) {
  return clamp(toFloat(value, 0), -1, 1);
}

function sanitizeButton(value) {
  return !!value;
}

function sanitizeInput(raw, options) {
  const clearInputs = !!(options && options.clear);
  if (clearInputs) {
    return { moveX: 0, moveZ: 0, jump: false, pause: false };
  }
  return {
    moveX: normalizeAxis(raw && raw.moveX),
    moveZ: normalizeAxis(raw && raw.moveZ),
    jump: sanitizeButton(raw && raw.jump),
    pause: sanitizeButton(raw && raw.pause)
  };
}
function nearestLane(x) {
  let idx = 0;
  let best = Infinity;
  for (let i = 0; i < LANES_X.length; i++) {
    const d = Math.abs(LANES_X[i] - x);
    if (d < best) {
      best = d;
      idx = i;
    }
  }
  return idx;
}
function pick(arr, random) {
  return arr[(random() * arr.length) | 0];
}
function event(state, text, now) {
  state.event = text;
  state.eventAt = now;
}

function createPlayer() {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    onGround: true,
    lane: 1,
    anim: 'run',
    stumbleUntil: 0,
    jumpAt: 0,
    landAt: 0,
    lastJumpAt: 0,
    lastSafeDistance: 0
  };
}

function createSeatList(rawSeats) {
  if (!Array.isArray(rawSeats) || !rawSeats.length) {
    return [{ id: 'p1', display_name: 'Player 1', type: 'human' }];
  }
  return rawSeats.slice(0, 1).map((seat, index) => ({
    id: 'p1',
    display_name: String(seat.display_name || ('Player ' + (index + 1))).slice(0, 28),
    type: 'human'
  }));
}

function makePlayerState() {
  return createPlayer();
}

function createSeededRandomState(seed) {
  return {
    seed,
    random: makeRng(seed)
  };
}

function shuffleOpenLanes(state) {
  const a = pick([0, 1, 2], state.random);
  let b = pick([0, 1, 2], state.random);
  if (b === a) b = (a + 1) % 3;
  return [a, b].sort((x, y) => x - y);
}

function spawnShard(state) {
  const lane = pick(state.activeLanes, state.random);
  const jitter = (state.random() - .5) * 2;
  state.shards.push({
    id: 'sh-' + (state._nextShardId++),
    kind: 'shard',
    x: LANES_X[lane] + jitter,
    trackZ: state.progress + WORLD_AHEAD - 6 + state.random() * 16,
    radius: 1.0,
    color: COLORS.shard
  });
}

function spawnObstacle(state) {
  const lane = pick(state.activeLanes, state.random);
  const kind = state.random() < .5 ? 'spike' : 'wall';
  const width = kind === 'spike' ? 1.9 : 4.7;
  const height = kind === 'spike' ? 4.0 : 2.8;
  const depth = kind === 'spike' ? 3.8 : 5.8;
  state.obstacles.push({
    id: 'ob-' + (state._nextObstacleId++),
    kind,
    x: LANES_X[lane],
    lane,
    trackZ: state.progress + WORLD_AHEAD - 6 + state.random() * 18,
    width,
    height,
    depth,
    radius: Math.max(width, depth) * .55,
    color: COLORS.obstacle,
    damage: kind === 'wall' ? 35 : 28
  });
}

function spawnGate(state) {
  const openLanes = shuffleOpenLanes(state);
  state.gates.push({
    id: 'gt-' + (state._nextGateId++),
    trackZ: state.progress + WORLD_AHEAD - 4 + state.random() * 12,
    openLanes,
    width: 16.2,
    passBy: false
  });
  state.activeLanes = openLanes.slice();
}

function spawnRuins(state) {
  const columns = Math.max(2, 1 + (state.difficulty | 0));
  for (let i = 0; i < columns; i++) {
    const x = (state.random() - .5) * 28;
    const z = state.progress + WORLD_AHEAD + i * 11;
    const h = 5 + state.random() * 7 + state.difficulty * .6;
    const w = 3 + state.random() * 4;
    const d = 3 + state.random() * 6;
    state.ruins.push({
      id: 'rn-' + (state._nextRuinsId++),
      x,
      trackZ: z,
      width: w,
      depth: d,
      height: h,
      color: i % 2 ? COLORS.accent : COLORS.void
    });
  }
}

function removePassed(state) {
  const cutoff = state.progress - 10;
  state.shards = state.shards.filter(s => s.trackZ > cutoff);
  state.obstacles = state.obstacles.filter(o => o.trackZ > cutoff);
  state.gates = state.gates.filter(g => g.trackZ > cutoff);
  state.ruins = state.ruins.filter(r => r.trackZ > cutoff - 24);
}

function seedForDistance(state) {
  return state.randomSeed;
}

function finish(state, won, now) {
  if (state.result) return;
  state.phase = won ? PHASES.won : PHASES.lost;
  state.result = {
    won,
    score: Math.max(0, Math.round(state.score)),
    shards: state.totalShards,
    combo: state.bestCombo,
    distance: Math.round(state.progress),
    durationMs: Math.max(0, now - (state.startedAt || state.startAt))
  };
  state.endedAt = now;
  event(state, won ? 'AURORA SIGNAL LOCK COMPLETE' : 'SHARD ARRAY COLLAPSED', now);
}

function create(rawSeats, now = Date.now(), options) {
  const createdAt = toMs(now, Date.now());
  const seats = createSeatList(rawSeats);
  const seed = toMs(options && options.seed, 0x2a) >>> 0;
  const randomState = createSeededRandomState(seed);

  const state = {
    schema: 'axm.shardrunner-state/v1',
    gameId: '022-shardrunner',
    version: '0.1.0',
    status: 'EXPERIMENTAL',
    createdAt,
    now: createdAt,
    phase: PHASES.countdown,
    startAt: createdAt + COUNTDOWN_MS,
    _inputClearUntil: 0,
    pauseAt: 0,
    startedAt: 0,
    endedAt: 0,
    players: {},
    result: null,
    event: 'SIGNAL ARRAY WARMING UP',
    eventAt: createdAt,
    seat: seats[0],
    score: 0,
    bestCombo: 0,
    combo: 0,
    comboExpiresAt: 0,
    comboWindow: 1500,
    totalShards: 0,
    progress: 0,
    distanceGoal: WIN_DISTANCE,
    speed: BASE_RUN_SPEED,
    difficulty: 1,
    stamina: 100,
    player: makePlayerState(),
    randomSeed: seed,
    random: randomState.random,
    nextShardAt: createdAt + 420,
    nextObstacleAt: createdAt + 760,
    nextGateAt: createdAt + 1700,
    spawnCursor: 24,
    laneWander: 0,
    activeLanes: [0, 1, 2],
    _nextShardId: 1,
    _nextObstacleId: 1,
    _nextGateId: 1,
    _nextRuinsId: 1,
    stalls: [],
    shards: [],
    obstacles: [],
    gates: [],
    ruins: []
  };

  state.player.lane = 1;
  state.randomState = randomState;
  const seedName = String(seed);
  event(state, 'RUN SEAT ' + (state.seat.display_name || 'RUNNER') + ' · RNG #' + seedName, createdAt);

  for (let i = 0; i < 5; i++) spawnRuins(state);
  return state;
}

function spawnByTempo(state) {
  const now = state.now;
  if (now >= state.nextShardAt) {
    spawnShard(state);
    state.nextShardAt = now + 420 - (state.difficulty * 15) + (state.random() * 180);
  }
  if (now >= state.nextObstacleAt) {
    spawnObstacle(state);
    const base = 980 - Math.min(500, state.difficulty * 70);
    state.nextObstacleAt = now + base + state.random() * 260;
  }
  if (now >= state.nextGateAt) {
    spawnGate(state);
    state.nextGateAt = now + 4500 + state.random() * 2200 - Math.min(2200, state.difficulty * 280);
  }
}

function updateDifficulty(state, now) {
  const elapsed = now - state.startedAt;
  const next = 1 + Math.floor(elapsed / 7000);
  if (next !== state.difficulty) {
    state.difficulty = next;
    state.speed = BASE_RUN_SPEED + state.difficulty * 1.5;
    event(state, 'CORRUPTED FIELD INTENSIFIES · LEVEL ' + state.difficulty, now);
  }
  const drift = (state.random() - .5) * 4.0;
  state.laneWander = drift;
}

function handleMovement(state, input, dt) {
  const p = state.player;
  const canMove = state.phase === PHASES.running;
  if (!canMove || state.now < p.stumbleUntil) {
    p.vx = 0;
  } else {
    const desire = input.moveX * 12;
    p.vx += (desire - p.vx) * Math.min(1, dt * 10);
  }

  const targetLane = clamp((p.x + p.vx * dt), -LANES_X[2], LANES_X[2]);
  p.x = clamp(targetLane, -LANES_X[2], LANES_X[2]);

  p.lane = nearestLane(p.x);

  if (input.jump && p.onGround && state.now - p.lastJumpAt > 180) {
    p.vy = JUMP_VELOCITY;
    p.onGround = false;
    p.lastJumpAt = state.now;
    p.jumpAt = state.now;
    p.anim = 'jump';
  }

  if (!p.onGround) {
    p.vy += BASE_GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      if (!p.onGround) {
        p.onGround = true;
        p.landAt = state.now;
        p.anim = 'land';
      }
    }
  } else if (state.now >= p.stumbleUntil) {
    p.anim = Math.abs(p.vx) > .6 ? 'run' : 'idle';
  }

  if (state.now - p.landAt > 160) {
    if (p.anim === 'land' && p.onGround && Math.abs(p.vx) > .6) p.anim = 'run';
  }

  if (state.now < p.stumbleUntil) {
    p.anim = 'stumble';
  }
}

function resolveBranch(state) {
  const p = state.player;
  const track = state.progress;
  for (const gate of state.gates) {
    if (gate.passBy || gate.trackZ < track - 1.2) continue;
    if (gate.trackZ - track > 2) continue;
    const lane = nearestLane(p.x);
    if (!gate.openLanes.includes(lane)) {
      p.stumbleUntil = Math.max(p.stumbleUntil, state.now + 500);
      state.stamina -= 30;
      p.vy = 1.4;
      p.onGround = true;
      p.anim = 'stumble';
      p.stumbleUntil = state.now + 480;
      event(state, 'INCORRECT SPLIT — RED CORRUPTION', state.now);
      if (state.stamina <= 0) {
        finish(state, false, state.now);
      }
    } else {
      state.score += 20;
      event(state, 'BRANCH SELECTED · ROUTE SECURE', state.now);
    }
    gate.passBy = true;
  }
}

function collision2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.trackZ - b.trackZ - a.z;
  return Math.hypot(dx, dz);
}

function resolveShards(state) {
  const p = state.player;
  const now = state.now;
  for (let i = state.shards.length - 1; i >= 0; i--) {
    const shard = state.shards[i];
    const dz = shard.trackZ - state.progress;
    const dist = Math.hypot(shard.x - p.x, dz - p.z);
    const hit = dist <= (shard.radius + PLAYER_RADIUS);
    const aerial = p.y > 1;
    if (hit && !aerial) {
      state.shards.splice(i, 1);
      state.totalShards += 1;
      if (now - state.comboExpiresAt > state.comboWindow) {
        state.combo = 1;
      } else {
        state.combo += 1;
      }
      state.comboExpiresAt = now + state.comboWindow;
      const gain = 6 + state.combo * 2 + Math.min(16, state.difficulty);
      state.score += gain;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      event(state, 'SINGLE SHARD PICKED · COMBO ' + state.combo, now);
    }
  }
}

function resolveObstacles(state) {
  const p = state.player;
  if (state.now < p.stumbleUntil) return;
  for (const obstacle of state.obstacles) {
    const dz = obstacle.trackZ - state.progress;
    if (dz > 7 || dz < -3) continue;
    const dx = Math.abs(obstacle.x - p.x);
    const footprint = (obstacle.width + PLAYER_RADIUS * 2) * 0.34;
    const hit = dx < footprint && dz > -0.6 && dz < 1.5;
    const airSafe = p.y > 1.05;
    if (hit && airSafe) continue;
    if (dx < footprint && dz < 2.1) {
      const severity = obstacle.kind === 'wall' ? 34 : 27;
      state.stamina = Math.max(0, state.stamina - severity);
      p.stumbleUntil = state.now + 450;
      p.vx *= -0.35;
      p.vy = Math.max(p.vy, 1.8);
      p.anim = 'stumble';
      event(state, 'CORRUPTED GEOMETRY COLLISION', state.now);
      if (state.stamina <= 0) {
        finish(state, false, state.now);
      }
      return;
    }
  }
}

function applyProgress(state, dt) {
  const runSpeed = state.speed + state.difficulty * 0.45;
  const advance = runSpeed * dt;
  state.progress += advance;
  state.score += dt * .25;
}

function step(state, rawInputs, dt, nowArg) {
  state.now = toMs(nowArg, Date.now());
  dt = clamp(Number(dt) || 0, 0, .08);

  const input = sanitizeInput(rawInputs && rawInputs[state.seat.id] || rawInputs || {}, {
    clear: state._inputClearUntil && state.now < state._inputClearUntil
  });

  if (state.phase === PHASES.countdown) {
    if (state.now >= state.startAt) {
      state.phase = PHASES.running;
      state.startedAt = state.now;
      event(state, 'RUNNER ARMED', state.now);
    }
    state.player.anim = 'idle';
  }

  if (state.phase === PHASES.paused) {
    if (!input.pause && state._pauseHeld) {
      state._pauseHeld = false;
    }
    if (input.pause && !state._pauseHeld) {
      state._pauseHeld = true;
      state.phase = state.prevPhase || PHASES.running;
      state.prevPhase = null;
      state.eventAt = state.now;
      state.event = 'RESUMED';
    }
    return publicState(state);
  }

  if (input.pause && !state._pauseHeld) {
    state._pauseHeld = true;
    state.prevPhase = state.phase;
    state.phase = PHASES.paused;
    state.pauseAt = state.now;
    state.event = 'PAUSED';
    state.eventAt = state.now;
    return publicState(state);
  }

  if (!input.pause && state._pauseHeld) {
    state._pauseHeld = false;
  }

  if (state.phase !== PHASES.running) {
    return publicState(state);
  }

  if (state.comboExpiresAt && state.now - state.comboExpiresAt > state.comboWindow) {
    state.combo = 0;
  }

  updateDifficulty(state, state.now);
  handleMovement(state, input, dt);
  applyProgress(state, dt);
  spawnByTempo(state);
  resolveBranch(state);
  resolveShards(state);
  resolveObstacles(state);
  removePassed(state);

  if (state.progress >= state.distanceGoal) {
    finish(state, true, state.now);
  }

  return state;
}

function publicState(state) {
  return JSON.parse(JSON.stringify(state));
}

module.exports = {
  create,
  step,
  publicState,
  sanitizeInput,
  normalizeAxis,
  sanitizeButton,
  toFloat,
  LAND: COLORS,
  PHASES
};
