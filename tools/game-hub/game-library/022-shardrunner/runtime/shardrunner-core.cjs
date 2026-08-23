'use strict';

const LANES_X = [-5.5, 0, 5.5];
const PHASES = {
  countdown: 'countdown',
  running: 'running',
  paused: 'paused',
  won: 'won',
  lost: 'lost',
  cooldown: 'cooldown'
};
const COLORS = {
  player: '#5fd8ff',
  shard: '#58b9ff',
  obstacle: '#ff3b42',
  fog: 0x0a1128,
  accent: '#d4a6ff',
  void: '#11214d'
};

const BUILD_VERSION = '0.2.1';
const BASE_RUN_SPEED = 11.2;
const BASE_GRAVITY = -34;
const JUMP_VELOCITY = 14.4;
const PLAYER_RADIUS = 1.1;
const PLAYER_HALF_HEIGHT = 1.2;
const COUNTDOWN_MS = 2400;
const WORLD_AHEAD = 125;
const WIN_DISTANCE = 420;
const COOLDOWN_MS = 900;
const JUMP_STEADY_COOLDOWN_MS = 185;
const MIN_TIER = 1;
const MAX_TIER = 6;
const SHARD_METER = 110;
const DIFFICULTY_PROFILE = {
  1: { shardBaseMs: 410, shardRangeMs: 150, obstacleChance: 0.34, obstacleBaseMs: 790, obstacleRangeMs: 290, gateGapBaseMs: 3600, gateGapRangeMs: 1800, lanePressureBoost: 0.02 },
  2: { shardBaseMs: 392, shardRangeMs: 148, obstacleChance: 0.39, obstacleBaseMs: 742, obstacleRangeMs: 276, gateGapBaseMs: 3470, gateGapRangeMs: 1760, lanePressureBoost: 0.05 },
  3: { shardBaseMs: 372, shardRangeMs: 145, obstacleChance: 0.44, obstacleBaseMs: 690, obstacleRangeMs: 267, gateGapBaseMs: 3360, gateGapRangeMs: 1720, lanePressureBoost: 0.08 },
  4: { shardBaseMs: 356, shardRangeMs: 140, obstacleChance: 0.50, obstacleBaseMs: 646, obstacleRangeMs: 256, gateGapBaseMs: 3260, gateGapRangeMs: 1660, lanePressureBoost: 0.11 },
  5: { shardBaseMs: 338, shardRangeMs: 136, obstacleChance: 0.56, obstacleBaseMs: 610, obstacleRangeMs: 248, gateGapBaseMs: 3140, gateGapRangeMs: 1600, lanePressureBoost: 0.15 },
  6: { shardBaseMs: 322, shardRangeMs: 132, obstacleChance: 0.62, obstacleBaseMs: 586, obstacleRangeMs: 238, gateGapBaseMs: 3060, gateGapRangeMs: 1530, lanePressureBoost: 0.17 }
};
const INPUT_OWNER_STALE_MS = 220;
const INPUT_AXIS_DEADZONE = 0.05;

function difficultyProfile(tier) {
  const key = clamp(tier, MIN_TIER, MAX_TIER);
  return DIFFICULTY_PROFILE[key] || DIFFICULTY_PROFILE[MIN_TIER];
}

function setPhase(state, nextPhase, now, options) {
  if (!state || state.phase === nextPhase) return;
  state.phase = nextPhase;
  state.runState = nextPhase;
  if (options && Object.prototype.hasOwnProperty.call(options, 'reason')) {
    state.reason = options.reason;
  }
  if (options && options.eventText) {
    event(state, options.eventText, now, {
      reason: state.reason || options.reason,
      reasonText: state.reason || options.reason || options.eventText
    });
  }
}

function makeRunSummary(state, opts) {
  const reason = opts && opts.reason ? opts.reason : null;
  return {
    runId: state.runId,
    attempt: state.attempt || 1,
    distance: Math.round(state.progress || 0),
    distanceGoal: Math.max(0, Math.round(state.distanceGoal || WIN_DISTANCE)),
    distanceToGoal: Math.max(0, Math.round((state.distanceGoal || WIN_DISTANCE) - (state.progress || 0))),
    shards: state.totalShards || 0,
    combo: state.combo || 0,
    bestCombo: state.bestCombo || 0,
    bestScore: Math.max(0, Math.round(state.bestScore || state.score || 0)),
    stamina: Math.max(0, Math.round(state.stamina || 0)),
    runState: state.phase || state.runState || PHASES.countdown,
    seed: state.randomSeed || state.seed || 0,
    runVersion: state.runVersion || state.buildVersion || BUILD_VERSION,
    reason: state.reason || null,
    diedBy: reason || state.diedBy || null,
    bestScore: Math.max(0, Math.round(state.score || 0))
  };
}

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
function makeRunId(seed, attempt) {
  return `run-${seed.toString(16)}-${String(attempt).padStart(3, '0')}`;
}
function toFloat(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAxis(value, options) {
  const deadzone = clamp(toFloat(options && options.deadzone, INPUT_AXIS_DEADZONE), 0, 1);
  const normalized = clamp(toFloat(value, 0), -1, 1);
  return Math.abs(normalized) <= deadzone ? 0 : normalized;
}

function sanitizeButton(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (text === '') return false;
    if (text === 'true' || text === '1' || text === 'on' || text === 'yes') return true;
    if (text === 'false' || text === '0' || text === 'off' || text === 'no') return false;
  }
  return !!value;
}

function sanitizeInput(raw, options) {
  const clearInputs = !!(options && options.clear);
  if (clearInputs) {
    return {
      moveX: 0,
      moveZ: 0,
      jump: false,
      pause: false,
      restart: false,
      owner: raw && (raw.owner || raw.source) ? String(raw.owner || raw.source) : 'system',
      source: raw && (raw.source || raw.owner) ? String(raw.source || raw.owner) : 'system'
    };
  }
  const owner = raw && (raw.owner || raw.source);
  return {
    moveX: normalizeAxis(raw && raw.moveX, { deadzone: INPUT_AXIS_DEADZONE }),
    moveZ: normalizeAxis(raw && raw.moveZ, { deadzone: INPUT_AXIS_DEADZONE }),
    jump: sanitizeButton(raw && raw.jump),
    pause: sanitizeButton(raw && raw.pause),
    restart: sanitizeButton(raw && raw.restart),
    owner: owner ? String(owner) : 'unknown',
    source: raw && (raw.source || raw.owner) ? String(raw.source || raw.owner) : owner ? String(owner) : 'unknown'
  };
}

function resolveInputOwner(samples, nowArg, options) {
  const now = toMs(nowArg, Date.now());
  const fallback = options && options.fallback ? String(options.fallback) : 'keyboard';
  const staleMs = Math.max(1, toMs(options && options.staleMs, INPUT_OWNER_STALE_MS));
  const priority = (options && options.priority) || ['keyboard', 'touch', 'gamepad'];
  const blockedUntil = (options && options.blockedUntil) || Object.create(null);
  const isBlocked = name => toMs(blockedUntil && blockedUntil[name], 0) > now;
  const hasKeyboard = !!(samples && samples.keyboard && samples.keyboard.active) &&
    (now - toMs(samples.keyboard.at, 0)) <= staleMs &&
    !isBlocked('keyboard');
  const hasTouch = !!(samples && samples.touch && samples.touch.active) &&
    (now - toMs(samples.touch.at, 0)) <= staleMs &&
    !isBlocked('touch');
  const hasGamepad = !!(samples && samples.gamepad && samples.gamepad.active) &&
    (now - toMs(samples.gamepad.at, 0)) <= staleMs &&
    !isBlocked('gamepad');
  const candidates = new Set();
  if (hasKeyboard) candidates.add('keyboard');
  if (hasTouch) candidates.add('touch');
  if (hasGamepad) candidates.add('gamepad');
  for (const c of priority) {
    if (candidates.has(c)) return c;
  }
  return fallback;
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
function event(state, text, now, opts) {
  state.event = text;
  state.eventAt = now;
  if (opts && Object.prototype.hasOwnProperty.call(opts, 'reasonText')) {
    state.reason = opts.reasonText;
  }
  if (opts && opts.reason) {
    state.diedBy = opts.reason;
  }
}

function refreshRunStats(state, overrides) {
  state.runStats = Object.assign({}, state.runStats || {}, {
    runId: state.runId,
    attempt: state.attempt || 1,
    distance: Math.max(0, Math.round(state.progress || 0)),
    distanceGoal: Math.max(0, Math.round(state.distanceGoal || WIN_DISTANCE)),
    distanceToGoal: Math.max(0, Math.round((state.distanceGoal || WIN_DISTANCE) - (state.progress || 0))),
    shards: state.totalShards || 0,
    stamina: Math.max(0, Math.round(state.stamina || 0)),
    combo: state.combo || 0,
    bestCombo: state.bestCombo || state.combo || 0,
    bestScore: Math.max(0, Math.round(state.bestScore || state.score || 0)),
    tier: state.difficulty || MIN_TIER,
    runVersion: state.runVersion || state.buildVersion || BUILD_VERSION,
    seed: state.randomSeed || state.seed || 0,
    fallReason: state.diedBy || null,
    dieReason: state.diedBy || null,
    runState: state.phase || state.runState || PHASES.countdown
  }, overrides || {});
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

function microVariance(state) {
  return (state.random() - .5) * 2;
}

function spawnShard(state) {
  const lane = pick(state.activeLanes, state.random);
  const jitter = microVariance(state) * 0.25;
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
  const jitter = microVariance(state) * 0.15;
  const bonus = (state.difficulty - 1) * 0.65;
  state.obstacles.push({
    id: 'ob-' + (state._nextObstacleId++),
    kind,
    x: LANES_X[lane] + jitter,
    lane,
    trackZ: state.progress + WORLD_AHEAD - 6 + state.random() * 18,
    width,
    height,
    depth,
    radius: Math.max(width, depth) * .55,
    color: COLORS.obstacle,
    damage: kind === 'wall' ? Math.max(26, 34 - state.difficulty + 0.5 * (state.random() * 8 - 4)) : Math.max(18, 27 - state.difficulty * 0.4)
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
  return state.randomSeed ^ (state.spawnCursor || 0);
}

function tierFromProgress(progress) {
  return clamp( MIN_TIER + Math.floor(Math.max(0, progress) / SHARD_METER), MIN_TIER, MAX_TIER );
}

function finish(state, won, now, reason) {
  if (state.result) return;
  state.bestScore = Math.max(state.bestScore || 0, Math.round(state.score));
  const dieReason = won ? null : (reason || 'STAMINA_COLLAPSE');
  const finishReason = won ? 'RUN_COMPLETE' : 'GAME_OVER';
  setPhase(state, won ? PHASES.won : PHASES.lost, now, {
    reason: finishReason
  });
  state.result = {
    won,
    score: Math.max(0, Math.round(state.score)),
    shards: state.totalShards,
    combo: state.bestCombo,
    bestScore: Math.max(0, Math.round(state.bestScore || state.score || 0)),
    distance: Math.round(state.progress),
    durationMs: Math.max(0, now - (state.startedAt || state.startAt)),
    runVersion: state.runVersion || BUILD_VERSION
  };
  state.reason = finishReason;
  state.runStats = Object.assign({}, state.runStats, {
    distance: Math.round(state.progress),
    shards: state.totalShards,
    stamina: Math.max(0, Math.round(state.stamina)),
    combo: state.bestCombo,
    bestCombo: state.bestCombo,
    attempt: state.attempt || 1,
    runId: state.runId,
    seed: state.randomSeed || state.seed || 0,
    diedBy: dieReason,
    fallReason: dieReason,
    dieReason
  });
  refreshRunStats(state, {
    fallReason: dieReason,
    dieReason
  });
  state.lastRunMetadata = makeRunSummary(state, { reason: dieReason });
  state.runSummary = makeRunSummary(state, { reason: dieReason });
  state.lastRun = {
    runId: state.runId,
    attempt: state.attempt,
    score: Math.max(0, Math.round(state.score)),
    distance: state.result.distance,
    shards: state.result.shards,
    combo: state.combo,
    bestCombo: state.bestCombo,
    diedBy: dieReason,
    seed: state.randomSeed,
    buildVersion: state.runVersion || BUILD_VERSION
  };
  state.endedAt = now;
  state.diedBy = dieReason;
  state.cooldownUntil = now + COOLDOWN_MS;
  event(state, won ? 'RUN COMPLETE' : 'GAME OVER', now, { reason: dieReason, reasonText: finishReason });
}

function create(rawSeats, now = Date.now(), options) {
  const createdAt = toMs(now, Date.now());
  const seats = createSeatList(rawSeats);
  const seed = toMs(options && options.seed, 0x2a) >>> 0;
  const attempt = Math.max(1, toMs(options && options.attempt, 1) | 0);
  const randomState = createSeededRandomState(seed);
  const state = {
    schema: 'axm.shardrunner-state/v1',
    gameId: '022-shardrunner',
    version: BUILD_VERSION,
    status: 'EXPERIMENTAL',
    buildVersion: BUILD_VERSION,
    seed: seed,
    createdAt,
    now: createdAt,
    runState: PHASES.countdown,
    phase: PHASES.countdown,
    startAt: createdAt + COUNTDOWN_MS,
    _inputClearUntil: 0,
    pauseAt: 0,
    startedAt: 0,
    endedAt: 0,
    cooldownUntil: 0,
    reason: 'READY',
    players: {},
    result: null,
    event: 'SIGNAL ARRAY WARMING UP',
    eventAt: createdAt,
    runId: makeRunId(seed, attempt),
    attempt,
    runVersion: BUILD_VERSION,
    _pauseHeld: false,
    _jumpHeld: false,
    _moveHold: false,
    inputSource: 'keyboard',
    seat: seats[0],
    score: 0,
    bestScore: 0,
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
    diedBy: null,
    pressure: 1,
    _difficultyTransitions: 0,
    runStats: {
      distance: 0,
      distanceGoal: WIN_DISTANCE,
      distanceToGoal: WIN_DISTANCE,
      shards: 0,
      runState: PHASES.countdown,
      stamina: 100,
      combo: 0,
      bestScore: 0,
      bestCombo: 0,
      tier: MIN_TIER,
      attempt: attempt,
      runId: makeRunId(seed, attempt),
      fallReason: null,
      dieReason: null,
      seed,
      runVersion: BUILD_VERSION
    },
    player: createPlayer(),
    randomSeed: seed,
    random: randomState.random,
    nextShardAt: createdAt + 420,
    nextObstacleAt: createdAt + 760,
    nextGateAt: createdAt + 1700,
    spawnCursor: 24,
    laneWander: 0,
    tier: 1,
    cameraPulse: 0,
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
  const seedName = String(seed);
  event(state, 'RUN SEAT ' + (state.seat.display_name || 'RUNNER') + ' · RNG #' + seedName, createdAt, { reasonText: 'READY' });

  for (let i = 0; i < 5; i++) {
    spawnRuins(state);
  }
  return state;
}

function updateDifficulty(state) {
  const tier = tierFromProgress(state.progress);
  if (tier !== state.difficulty) {
    state.difficulty = tier;
    state.tier = tier;
    state._difficultyTransitions = (state._difficultyTransitions || 0) + 1;
    state.runStats.tier = tier;
    state.speed = BASE_RUN_SPEED + state.difficulty * 1.5;
    event(state, 'CORRUPTED FIELD INTENSIFIES · LEVEL ' + state.difficulty, state.now);
  }
  refreshRunStats(state, { tier: state.difficulty });
  const profile = difficultyProfile(state.difficulty);
  const pressureTarget = 1.04 + (state.difficulty - 1) * 0.2 + (state.laneWander * 0.02) + (profile ? profile.lanePressureBoost : 0);
  state.pressure = Math.max(1, Math.min(2.2, pressureTarget));
  state.laneWander = (state.random() - .5) * Math.min(2.7, state.difficulty * 0.38);
  if (state.progress > 260 && state.distanceGoal < 520) {
    state.distanceGoal = 520;
  }
}

function spawnByTempo(state) {
  const now = state.now;
  const difficulty = state.difficulty;
  const profile = difficultyProfile(difficulty);
  const pressure = state.pressure || 1;
  if (now >= state.nextShardAt) {
    spawnShard(state);
    const shardBase = Math.max(180, (profile ? profile.shardBaseMs : 390) + microVariance(state) * 5);
    const shardRange = Math.max(80, profile ? profile.shardRangeMs : 140);
    const base = shardBase + (state.random() * shardRange);
    const jitter = microVariance(state);
    state.nextShardAt = now + Math.max(180, base / pressure * (1 + jitter * 0.2));
  }
  if (now >= state.nextObstacleAt) {
    const obstacleChance = Math.min(0.98, (profile ? profile.obstacleChance : 0.34) * pressure);
    if (state.random() < obstacleChance) {
      spawnObstacle(state);
    }
    const obstacleBase = Math.max(360, profile ? profile.obstacleBaseMs : 790);
    const obstacleRange = Math.max(150, profile ? profile.obstacleRangeMs : 290);
    const base = obstacleBase + state.random() * obstacleRange;
    state.nextObstacleAt = now + Math.max(420, (base + (difficulty * 12)) / pressure);
  }
  if (now >= state.nextGateAt) {
    spawnGate(state);
    const gateBase = Math.max(1500, profile ? profile.gateGapBaseMs : 3600);
    const gateRange = Math.max(840, profile ? profile.gateGapRangeMs : 1800);
    const base = gateBase + state.random() * gateRange;
    state.nextGateAt = now + Math.max(1500, base);
  }
}

function spawnCameraPulse(state, amount) {
  state.cameraPulse = Math.max(0, Math.min(1.2, (state.cameraPulse || 0) + amount));
}

function applyCameraDrift(state, dt) {
  state.cameraPulse = Math.max(0, (state.cameraPulse || 0) - dt * 1.9);
}

function handleMovement(state, input, dt) {
  const p = state.player;
  const canMove = state.phase === PHASES.running;
  const jumpRequest = !!input.jump && !state._jumpHeld;

  if (!input.jump) {
    state._jumpHeld = false;
  }

  if (!canMove || state.now < p.stumbleUntil) {
    p.vx = 0;
  } else {
    const desire = input.moveX * 12;
    p.vx += (desire - p.vx) * Math.min(1, dt * 10);
  }

  const targetLane = clamp((p.x + p.vx * dt), -LANES_X[2], LANES_X[2]);
  p.x = clamp(targetLane, -LANES_X[2], LANES_X[2]);

  p.lane = nearestLane(p.x);

  if (jumpRequest && p.onGround && state.now - p.lastJumpAt > JUMP_STEADY_COOLDOWN_MS) {
    state._jumpHeld = true;
    p.vy = JUMP_VELOCITY;
    p.onGround = false;
    p.lastJumpAt = state.now;
    p.jumpAt = state.now;
    p.anim = 'jump';
    spawnCameraPulse(state, 0.08);
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
        spawnCameraPulse(state, 0.13);
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

  if (state.now >= state.runStats.dieAt && state.runStats.dieAt) {
    state.runStats.dieAt = 0;
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
      state.stamina = Math.max(0, state.stamina - 30);
      p.vy = 1.4;
      p.onGround = true;
      p.anim = 'stumble';
      p.stumbleUntil = state.now + 480;
      state.runStats.stamina = Math.max(0, Math.round(state.stamina));
      refreshRunStats(state, {
        stamina: Math.max(0, Math.round(state.stamina)),
        combo: state.combo || 0,
        bestCombo: state.bestCombo || state.combo || 0,
        distance: Math.round(state.progress || 0),
        tier: state.difficulty || MIN_TIER
      });
      spawnCameraPulse(state, 0.35);
      event(state, 'COLLISION', state.now, { reasonText: 'COLLISION' });
      if (state.stamina <= 0) {
        finish(state, false, state.now, 'WRONG_LANE');
      }
  } else {
    state.score += 20;
    state.bestScore = Math.max(state.bestScore || 0, Math.round(state.score));
    state.runStats.shards += 0;
      state.runStats.combo = Math.max(1, state.runStats.combo);
      refreshRunStats(state, {
        combo: state.runStats.combo,
        bestCombo: state.bestCombo || state.runStats.combo,
        distance: Math.round(state.progress || 0),
        tier: state.difficulty || MIN_TIER
      });
      event(state, 'SHARD PATH CHOSEN', state.now, { reasonText: 'SHARD PATH CHOSEN' });
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
      state.runStats.shards += 1;
      if (now - state.comboExpiresAt > state.comboWindow) {
        state.combo = 1;
      } else {
        state.combo += 1;
      }
      state.comboExpiresAt = now + state.comboWindow;
      const gain = 6 + state.combo * 2 + Math.min(16, state.difficulty);
      state.score += gain;
      state.bestScore = Math.max(state.bestScore || 0, Math.round(state.score));
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.runStats.combo = state.combo;
      state.runStats.distance = Math.round(state.progress);
      state.runStats.stamina = Math.max(0, Math.round(state.stamina));
      refreshRunStats(state, {
        shards: state.totalShards,
        combo: state.combo,
        bestCombo: state.bestCombo,
        distance: Math.round(state.progress || 0),
        tier: state.difficulty || MIN_TIER
      });
      spawnCameraPulse(state, 0.09);
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
      state.runStats.stamina = Math.max(0, Math.round(state.stamina));
      refreshRunStats(state, {
        stamina: Math.max(0, Math.round(state.stamina)),
        combo: state.combo || 0,
        bestCombo: state.bestCombo || state.combo || 0,
        distance: Math.round(state.progress || 0),
        tier: state.difficulty || MIN_TIER
      });
      spawnCameraPulse(state, 0.42);
      const reason = obstacle.kind === 'wall' ? 'HARD_COLLISION' : 'SPIKE_COLLISION';
      event(state, 'COLLISION', state.now, { reasonText: 'COLLISION' });
      if (state.stamina <= 0) {
        finish(state, false, state.now, reason);
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
  state.bestScore = Math.max(0, Math.round(Math.max(state.bestScore || 0, state.score)));
  refreshRunStats(state, {
    distance: Math.max(0, Math.round(state.progress)),
    stamina: Math.max(0, Math.round(state.stamina || 0)),
    tier: state.difficulty || MIN_TIER
  });
}

function step(state, rawInputs, dt, nowArg) {
  state.now = toMs(nowArg, Date.now());
  dt = clamp(Number(dt) || 0, 0, .08);
  if (!state.runState || state.runState !== state.phase) {
    state.runState = state.phase;
  }

  const input = sanitizeInput(rawInputs && rawInputs[state.seat.id] || rawInputs || {}, {
    clear: state._inputClearUntil && state.now < state._inputClearUntil
  });
  state.inputSource = input.source || input.owner || state.inputSource;

  if (state.now < (state._inputClearUntil || 0)) {
    input.moveX = 0;
    input.moveZ = 0;
    state._moveHold = true;
  } else if (state._moveHold) {
    const hasMoveInput = Math.abs(input.moveX) > 0 || Math.abs(input.moveZ) > 0;
    if (hasMoveInput) {
      input.moveX = 0;
      input.moveZ = 0;
    } else {
      state._moveHold = false;
    }
  }

  if (state.now >= state._inputClearUntil && state._jumpHeld && !input.jump) {
    state._jumpHeld = false;
  }
  if (state.now >= state._inputClearUntil && state._pauseHeld && !input.pause) {
    state._pauseHeld = false;
  }

  if (state.now < state._inputClearUntil) {
    input.jump = false;
    input.pause = false;
  }

  if (state.phase === PHASES.countdown && state.now >= state.startAt) {
    setPhase(state, PHASES.running, state.now, {
      reason: 'RUNNING',
      eventText: 'RUNNER ARMED'
    });
    state.startedAt = state.now;
    state.reason = 'RUNNING';
  }

  if (state.phase === PHASES.paused) {
    if (!input.pause && state._pauseHeld) {
      state._pauseHeld = false;
    }
    if (input.pause && !state._pauseHeld) {
      state._pauseHeld = true;
      const nextPhase = state.prevPhase || PHASES.running;
      state.prevPhase = null;
      setPhase(state, nextPhase, state.now, {
        reason: 'RUNNING',
        eventText: 'RESUMED'
      });
      state.eventAt = state.now;
    }
    applyCameraDrift(state, dt);
    return publicState(state);
  }

  if (input.pause && !state._pauseHeld) {
    state._pauseHeld = true;
    state.prevPhase = state.phase;
    setPhase(state, PHASES.paused, state.now, {
      reason: 'PAUSED',
      eventText: 'PAUSED'
    });
    state.pauseAt = state.now;
    state.event = 'PAUSED';
    return publicState(state);
  }

  if (!input.pause && state._pauseHeld) {
    state._pauseHeld = false;
  }

  if (state.phase === PHASES.won || state.phase === PHASES.lost) {
    if (!state.cooldownUntil) {
      state.cooldownUntil = state.now + COOLDOWN_MS;
    }
    if (state.now >= state.cooldownUntil) {
      setPhase(state, PHASES.cooldown, state.now);
    }
    return publicState(state);
  }

  if (state.phase === PHASES.cooldown) {
    applyCameraDrift(state, dt);
    return publicState(state);
  }

  if (state.phase !== PHASES.running) {
    return publicState(state);
  }

  if (state.comboExpiresAt && state.now - state.comboExpiresAt > state.comboWindow) {
    state.combo = 0;
    state.runStats.combo = 0;
    refreshRunStats(state, {
      combo: 0,
      bestCombo: state.bestCombo || state.combo || 0,
      distance: Math.max(0, Math.round(state.progress || 0)),
      stamina: Math.max(0, Math.round(state.stamina || 0)),
      tier: state.difficulty || MIN_TIER
    });
  }

  updateDifficulty(state);
  handleMovement(state, input, dt);
  applyProgress(state, dt);
  spawnByTempo(state);
  resolveBranch(state);
  resolveShards(state);
  resolveObstacles(state);
  applyCameraDrift(state, dt);
  removePassed(state);

  if (state.progress >= state.distanceGoal) {
    finish(state, true, state.now, 'OBJECTIVE_COMPLETE');
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
  PHASES,
  resolveInputOwner,
  INPUT_OWNER_STALE_MS
};
