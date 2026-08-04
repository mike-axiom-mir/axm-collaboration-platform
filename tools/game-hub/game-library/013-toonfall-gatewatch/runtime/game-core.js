(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ToonfallCore = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const GAME_ID = '013-toonfall-gatewatch';
  const STATE_SCHEMA = 'axm.toonfall-state/v1';
  const INPUT_SCHEMA = 'axm.toonfall-input/v1';
  const OBSERVATION_SCHEMA = 'axm.toonfall-observation/v1';
  const PHASES = Object.freeze({
    STORY: 'story',
    BRIEFING: 'briefing',
    EXPLORE: 'explore',
    WAVE: 'wave',
    INTERMISSION: 'intermission',
    VICTORY: 'victory',
    DEFEAT: 'defeat'
  });
  const STORY = Object.freeze([
    {
      eyebrow: 'BLOOMVALE · ONE BRIGHT MORNING',
      title: 'A little world made of color.',
      copy: 'The Heartlight paints every hill, stream, and cloud in Bloomvale. Scout Pippa keeps its paths safe; Moxie, a tiny defense bot, keeps Pippa laughing.'
    },
    {
      eyebrow: 'THEN THE PAPER SKY TORE',
      title: 'The Inkblight found the gate.',
      copy: 'Hungry Smudges are pouring through three rifts. If they drain the Heartlight, the valley becomes a blank page.'
    },
    {
      eyebrow: 'GATEWATCH PROTOCOL',
      title: 'Two defenders. Three waves.',
      copy: 'Move, aim, and fire while Moxie guards your flank. Dash out of danger and trigger a Heartburst when the swarm crowds the beacon.'
    }
  ]);
  const DISTRICTS = Object.freeze([
    { id: 'heartlight-commons', name: 'Heartlight Commons', x: 1200, y: 675, radius: 330, color: '#79e5ae', tagline: 'The bright center of Bloomvale.' },
    { id: 'sunpetal-market', name: 'Sunpetal Market', x: 470, y: 335, radius: 285, color: '#ffd66f', tagline: 'Stalls, bunting, and Bramble’s color cart.' },
    { id: 'ripplewood', name: 'Ripplewood', x: 1940, y: 350, radius: 300, color: '#68d9dd', tagline: 'A singing grove beside the upper stream.' },
    { id: 'cloudstep-orchard', name: 'Cloudstep Orchard', x: 475, y: 1050, radius: 285, color: '#ff91bd', tagline: 'Fruit trees growing into the painted clouds.' },
    { id: 'lantern-fen', name: 'Lantern Fen', x: 1880, y: 1050, radius: 300, color: '#b594ff', tagline: 'Patch’s training range glows after dusk.' }
  ]);
  const NPCS = Object.freeze([
    { id: 'maribel', name: 'Mayor Maribel', role: 'Keeper of the Commons', x: 1370, y: 610, color: '#62edc1', dialogue: 'Bloomvale is bigger than one gate. Take my field map and meet the neighbors.' },
    { id: 'bramble', name: 'Bramble', role: 'Color Cartographer', x: 455, y: 355, color: '#ffd35f', dialogue: 'Loose color wisps are hiding along every road. Four will strengthen the Heartlight.' },
    { id: 'nori', name: 'Nori', role: 'Ripplewood Listener', x: 1940, y: 375, color: '#5de3ee', dialogue: 'Every district has its own rhythm. Walk the full loop and your boots will remember it.' },
    { id: 'lumi', name: 'Lumi', role: 'Orchard Tender', x: 500, y: 1045, color: '#ff8fb9', dialogue: 'People are Bloomvale’s real landmarks. Come back after you have heard every story.' },
    { id: 'patch', name: 'Patch', role: 'Fen Range Captain', x: 1840, y: 1035, color: '#b38cff', dialogue: 'The six range blooms only open for a clean shot. Paint five and I will tune your blaster.' }
  ]);
  const COLOR_WISPS = Object.freeze([
    { id: 'wisp-commons', x: 1075, y: 520 }, { id: 'wisp-market-road', x: 820, y: 445 },
    { id: 'wisp-market', x: 330, y: 250 }, { id: 'wisp-ripple-road', x: 1600, y: 470 },
    { id: 'wisp-ripple', x: 2110, y: 245 }, { id: 'wisp-orchard-road', x: 790, y: 930 },
    { id: 'wisp-orchard', x: 350, y: 1170 }, { id: 'wisp-fen-road', x: 1530, y: 940 },
    { id: 'wisp-fen', x: 2070, y: 1140 }, { id: 'wisp-river', x: 1210, y: 1110 }
  ]);
  const PRACTICE_TARGETS = Object.freeze([
    { id: 'range-1', x: 1710, y: 905 }, { id: 'range-2', x: 1830, y: 880 },
    { id: 'range-3', x: 1980, y: 910 }, { id: 'range-4', x: 1715, y: 1185 },
    { id: 'range-5', x: 1855, y: 1210 }, { id: 'range-6', x: 2020, y: 1170 }
  ]);
  const UNLOCKS = Object.freeze({
    'field-map': { name: 'Maribel’s Field Map', description: 'Reveals districts, people, wisps, and activities.', progress: { kind: 'npc', targetId: 'maribel', goal: 1, label: 'MEET MARIBEL' } },
    'chroma-reserve': { name: 'Chroma Reserve', description: 'Adds 40 maximum Heartlight color.', progress: { kind: 'wisps', goal: 4, label: 'COLOR WISPS' } },
    'moxie-overclock': { name: 'Moxie Overclock', description: 'Moxie fires more quickly after meeting three neighbors.', progress: { kind: 'neighbors', goal: 3, label: 'NEIGHBORS' } },
    'trailblazer-boots': { name: 'Trailblazer Boots', description: 'Move faster and dash more often after visiting four districts.', progress: { kind: 'districts', goal: 4, label: 'DISTRICTS' } },
    'prism-paint': { name: 'Prism Paint', description: 'Player shots deal more damage after clearing Patch’s range.', progress: { kind: 'targets', goal: 5, label: 'RANGE BLOOMS' } },
    'heart-pocket': { name: 'Heart Pocket', description: 'Adds 25 maximum health after meeting everyone.', progress: { kind: 'neighbors', goal: 5, label: 'NEIGHBORS' } }
  });
  const CONFIG = Object.freeze({
    worldWidth: 2400,
    worldHeight: 1350,
    tickMs: 50,
    waveCounts: [8, 12, 17],
    waveSpawnMs: [850, 700, 560],
    intermissionMs: 3200,
    playerSpeed: 230,
    allySpeed: 190,
    projectileSpeed: 760,
    playerFireMs: 190,
    allyFireMs: 430,
    dashCooldownMs: 1800,
    pulseCooldownMs: 9500,
    prismCounterMs: 2400,
    prismCounterMultiplier: 2,
    perfectDodgeScore: 35,
    respawnMs: 4200,
    beaconHealth: 360,
    maxEnemies: 28,
    maxInputSeq: 2147483647,
    maxInputSeqGap: 1000000
  });
  const ENEMY_TYPES = Object.freeze({
    nib: { hp: 34, speed: 74, damage: 8, radius: 19, score: 80, attackMs: 720, windupMs: 360 },
    sprinter: { hp: 24, speed: 118, damage: 6, radius: 15, score: 120, attackMs: 620, windupMs: 250 },
    bruiser: { hp: 105, speed: 48, damage: 17, radius: 30, score: 260, attackMs: 980, windupMs: 520 }
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function monotonicNow(state, value, fallbackDelta) {
    const candidate = Number(value);
    const fallback = Math.max(0, Number(fallbackDelta) || 0);
    return Number.isFinite(candidate) ? Math.max(state.now, candidate) : state.now + fallback;
  }
  function length(x, y) { return Math.sqrt(x * x + y * y); }
  function normalize(x, y) {
    const size = length(x, y);
    return size > 0.0001 ? { x: x / size, y: y / size } : { x: 0, y: 0 };
  }
  function distance(a, b) { return length(a.x - b.x, a.y - b.y); }
  function event(state, type, message, detail) {
    state.eventSeq += 1;
    state.events.push({ id: 'event-' + state.eventSeq, type, message, detail: detail || null, at: state.now });
    state.events = state.events.slice(-60);
  }
  function rand(state) {
    let value = state.rngState | 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    state.rngState = value >>> 0;
    return state.rngState / 4294967296;
  }
  function uid(state, prefix) {
    state.entitySeq += 1;
    return prefix + '-' + state.entitySeq;
  }
  function actor(id, name, kind, x, y, color) {
    return {
      id, name, kind, x, y, vx: 0, vy: 0, facingX: 1, facingY: 0,
      health: 100, maxHealth: 100, radius: 24, color, lastShotAt: -99999,
      lastHitAt: -99999, downUntil: 0, invulnerableUntil: 0, kills: 0, shots: 0
    };
  }
  function normalizeRoster(raw) {
    const source = Array.isArray(raw) ? raw : [];
    const human = source.find(item => String(item && item.type || 'human').toLowerCase() === 'human') || source[0] || {};
    return [{
      id: 'p1',
      seatId: String(human.seat_id || human.seatId || 'seat_1').slice(0, 80),
      name: String(human.display_name || human.displayName || human.name || 'Scout Pippa').slice(0, 60),
      type: 'human'
    }];
  }
  function createInitialState(roster, options) {
    options = options || {};
    const seats = normalizeRoster(roster);
    const proposedNow = Number(options.now);
    const now = Number.isFinite(proposedNow) && proposedNow >= 0 ? proposedNow : 0;
    const seed = (Number(options.seed) || 13013) >>> 0;
    const state = {
      schema: STATE_SCHEMA,
      version: '0.3.1-bloomvale-steward',
      gameId: GAME_ID,
      seed,
      rngState: seed || 1,
      entitySeq: 0,
      eventSeq: 0,
      now,
      clockOffsetMs: 0,
      pausedAtExternal: 0,
      elapsedMs: 0,
      phase: PHASES.STORY,
      storyStep: 0,
      paused: false,
      wave: 0,
      waveTarget: 0,
      waveSpawned: 0,
      nextSpawnAt: 0,
      nextWaveAt: 0,
      score: 0,
      combo: 0,
      bestCombo: 0,
      comboUntil: 0,
      kills: 0,
      shots: 0,
      hits: 0,
      perfectDodges: 0,
      roster: seats,
      player: actor('p1', seats[0].name, 'human', 1080, 750, '#5cecff'),
      ally: actor('moxie', 'Moxie', 'ai-companion', 1145, 760, '#ffd35c'),
      beacon: { id: 'heartlight', x: 1200, y: 675, radius: 58, health: CONFIG.beaconHealth, maxHealth: CONFIG.beaconHealth, lastHitAt: -99999 },
      exploration: {
        currentDistrictId: 'heartlight-commons',
        visitedDistrictIds: ['heartlight-commons'],
        metNpcIds: [],
        collectedWispIds: [],
        paintedTargetIds: [],
        unlockIds: [],
        completedActivityIds: []
      },
      npcs: clone(NPCS),
      colorWisps: COLOR_WISPS.map(item => Object.assign({ collected: false, radius: 16 }, item)),
      practiceTargets: PRACTICE_TARGETS.map(item => Object.assign({ painted: false, radius: 24, lastHitAt: -99999 }, item)),
      enemies: [],
      projectiles: [],
      pickups: [],
      effects: [],
      input: { moveX: 0, moveY: 0, aimX: 1, aimY: 0, firing: false, dash: false, pulse: false, seq: 0 },
      lastInputSeq: 0,
      dashReadyAt: 0,
      pulseReadyAt: 0,
      counterReadyUntil: 0,
      result: null,
      events: [],
      truth: {
        stateAuthority: 'managed-local-server',
        humanSeats: 1,
        aiCompanions: 1,
        splitScreen: false,
        internetRequired: false
      }
    };
    event(state, 'story-opened', 'Bloomvale is waiting.', { storyStep: 0 });
    return state;
  }
  function validate(state) {
    const errors = [];
    if (!state || state.schema !== STATE_SCHEMA) errors.push('state schema mismatch');
    if (!state || !Object.values(PHASES).includes(state.phase)) errors.push('invalid phase');
    if (!state || !state.player || !state.ally || !state.beacon) errors.push('required actors missing');
    if (!state || !Array.isArray(state.enemies) || !Array.isArray(state.projectiles)) errors.push('world collections missing');
    if (!state || !state.exploration || !Array.isArray(state.exploration.visitedDistrictIds) || !Array.isArray(state.exploration.unlockIds)) errors.push('exploration state missing');
    if (state && (!state.truth || state.truth.humanSeats !== 1 || state.truth.aiCompanions !== 1 || state.truth.splitScreen !== false)) errors.push('fixed one-human one-ai truth widened');
    if (state && (!Number.isFinite(state.now) || state.now < 0)) errors.push('authoritative time invalid');
    if (state && (!Number.isFinite(state.clockOffsetMs) || state.clockOffsetMs < 0 || !Number.isFinite(state.pausedAtExternal) || state.pausedAtExternal < 0)) errors.push('authority clock mapping invalid');
    if (state && (!Number.isSafeInteger(state.perfectDodges) || state.perfectDodges < 0 || !Number.isFinite(state.counterReadyUntil) || state.counterReadyUntil < 0)) errors.push('Prism Counter state invalid');
    if (state && (!Number.isSafeInteger(state.lastInputSeq) || state.lastInputSeq < 0 || state.lastInputSeq > CONFIG.maxInputSeq)) errors.push('input sequence invalid');
    return { pass: errors.length === 0, errors };
  }
  function hasUnlock(state, id) {
    return !!(state.exploration && state.exploration.unlockIds.includes(id));
  }
  function completeActivity(state, id, message) {
    if (state.exploration.completedActivityIds.includes(id)) return false;
    state.exploration.completedActivityIds.push(id);
    state.score += 300;
    event(state, 'activity-complete', message, { activityId: id });
    return true;
  }
  function grantUnlock(state, id, source) {
    if (!UNLOCKS[id] || hasUnlock(state, id)) return false;
    state.exploration.unlockIds.push(id);
    if (id === 'chroma-reserve') {
      state.beacon.maxHealth += 40;
      state.beacon.health = Math.min(state.beacon.maxHealth, state.beacon.health + 40);
    }
    if (id === 'heart-pocket') {
      state.player.maxHealth += 25;
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 25);
    }
    state.score += 250;
    event(state, 'unlock', 'UNLOCKED · ' + UNLOCKS[id].name, { unlockId: id, source: source || null, description: UNLOCKS[id].description });
    return true;
  }
  function checkUnlocks(state) {
    const exploration = state.exploration;
    if (exploration.metNpcIds.includes('maribel')) grantUnlock(state, 'field-map', 'Mayor Maribel');
    if (exploration.collectedWispIds.length >= 4) grantUnlock(state, 'chroma-reserve', 'Four color wisps');
    if (exploration.metNpcIds.length >= 3) grantUnlock(state, 'moxie-overclock', 'Three new neighbors');
    if (exploration.visitedDistrictIds.length >= 4) grantUnlock(state, 'trailblazer-boots', 'Four discovered districts');
    if (exploration.paintedTargetIds.length >= 5) grantUnlock(state, 'prism-paint', 'Patch’s range trial');
    if (exploration.metNpcIds.length >= NPCS.length) grantUnlock(state, 'heart-pocket', 'Every Bloomvale neighbor');
    if (exploration.collectedWispIds.length >= COLOR_WISPS.length) completeActivity(state, 'wisp-trail', 'Every loose color wisp is back in the page.');
    if (exploration.visitedDistrictIds.length >= DISTRICTS.length) completeActivity(state, 'district-loop', 'The full Bloomvale loop is charted.');
    if (exploration.paintedTargetIds.length >= 5) completeActivity(state, 'range-trial', 'Patch’s five-target range trial is complete.');
    if (exploration.metNpcIds.length >= NPCS.length) completeActivity(state, 'meet-the-neighbors', 'Pippa has met every Bloomvale neighbor.');
  }
  function districtAt(entity) {
    let nearest = DISTRICTS[0];
    let nearestDistance = Infinity;
    DISTRICTS.forEach(district => {
      const value = distance(entity, district);
      if (value < nearestDistance) { nearest = district; nearestDistance = value; }
    });
    return nearestDistance <= nearest.radius ? nearest : null;
  }
  function updateExploration(state, now) {
    const exploration = state.exploration;
    const district = districtAt(state.player);
    if (district) {
      exploration.currentDistrictId = district.id;
      if (!exploration.visitedDistrictIds.includes(district.id)) {
        exploration.visitedDistrictIds.push(district.id);
        state.score += 75;
        event(state, 'district-discovered', 'DISCOVERED · ' + district.name, { districtId: district.id, tagline: district.tagline });
      }
    }
    state.colorWisps.forEach(wisp => {
      if (!wisp.collected && distance(wisp, state.player) <= wisp.radius + state.player.radius) {
        wisp.collected = true;
        exploration.collectedWispIds.push(wisp.id);
        state.score += 60;
        state.effects.push({ id: uid(state, 'fx'), type: 'wisp', x: wisp.x, y: wisp.y, at: now, color: '#fff48a' });
        event(state, 'wisp-collected', 'Color wisp found · ' + exploration.collectedWispIds.length + ' / ' + COLOR_WISPS.length, { wispId: wisp.id });
      }
    });
    checkUnlocks(state);
  }
  function enterExplore(state, now, reason) {
    state.phase = PHASES.EXPLORE;
    state.paused = false;
    state.nextWaveAt = 0;
    state.input.moveX = 0;
    state.input.moveY = 0;
    state.input.firing = false;
    state.projectiles = [];
    updateExploration(state, now);
    event(state, 'explore-opened', reason || 'Bloomvale is open. Explore, meet neighbors, or return to the Heartlight.', { nextWave: state.wave + 1 });
  }
  function resolveInteraction(state, now) {
    if (state.phase !== PHASES.EXPLORE) return { ok: false, reason: 'not-exploring' };
    let nearestNpc = null;
    let nearestDistance = Infinity;
    state.npcs.forEach(npc => {
      const value = distance(state.player, npc);
      if (value < nearestDistance) { nearestNpc = npc; nearestDistance = value; }
    });
    if (nearestNpc && nearestDistance <= 125) {
      const firstMeeting = !state.exploration.metNpcIds.includes(nearestNpc.id);
      if (firstMeeting) {
        state.exploration.metNpcIds.push(nearestNpc.id);
        state.score += 100;
      }
      event(state, firstMeeting ? 'npc-met' : 'npc-talked', nearestNpc.name + ' · ' + nearestNpc.dialogue, { npcId: nearestNpc.id, firstMeeting, role: nearestNpc.role });
      checkUnlocks(state);
      return { ok: true, interaction: 'npc', npcId: nearestNpc.id, firstMeeting };
    }
    if (distance(state.player, state.beacon) <= 180 && state.wave < CONFIG.waveCounts.length) {
      beginWave(state, now);
      return { ok: true, interaction: 'wave-start', wave: state.wave };
    }
    event(state, 'interaction-empty', 'Nothing close enough to meet. Follow the path markers.', null);
    return { ok: false, reason: 'nothing-nearby' };
  }
  function beginWave(state, now) {
    state.wave += 1;
    state.phase = PHASES.WAVE;
    state.waveTarget = CONFIG.waveCounts[state.wave - 1];
    state.waveSpawned = 0;
    state.nextSpawnAt = now + 250;
    state.nextWaveAt = 0;
    state.combo = 0;
    event(state, 'wave-start', 'Wave ' + state.wave + ' breached the gate.', { wave: state.wave, target: state.waveTarget });
  }
  function finish(state, victory) {
    state.phase = victory ? PHASES.VICTORY : PHASES.DEFEAT;
    state.paused = false;
    state.result = {
      victory,
      title: victory ? 'Bloomvale stays bright!' : 'The page went quiet.',
      score: state.score,
      wave: state.wave,
      kills: state.kills,
      accuracy: state.shots ? Math.round(state.hits / state.shots * 100) : 0,
      perfectDodges: state.perfectDodges,
      beaconHealth: Math.max(0, Math.round(state.beacon.health)),
      districts: state.exploration.visitedDistrictIds.length,
      neighbors: state.exploration.metNpcIds.length,
      unlocks: state.exploration.unlockIds.length
    };
    event(state, victory ? 'victory' : 'defeat', state.result.title, clone(state.result));
  }
  function applyAction(state, actorId, raw, now) {
    const check = validate(state);
    if (!check.pass) throw new Error('invalid Toonfall state: ' + check.errors.join('; '));
    const action = raw || {};
    const type = String(action.type || 'input');
    const proposedExternalNow = Number(now);
    if (type === 'pause' && state.paused && Number.isFinite(proposedExternalNow) && state.pausedAtExternal > 0) {
      state.clockOffsetMs += Math.max(0, proposedExternalNow - state.pausedAtExternal);
      state.pausedAtExternal = 0;
    }
    if (!state.paused || type === 'pause') {
      const mappedNow = Number.isFinite(proposedExternalNow) ? proposedExternalNow - state.clockOffsetMs : NaN;
      state.now = monotonicNow(state, mappedNow, 0);
    }
    if (actorId && actorId !== 'p1' && actorId !== 'screen') return { ok: false, reason: 'unknown-actor' };
    if (state.paused && type !== 'pause') return { ok: false, reason: 'paused' };
    if (type === 'story-next') {
      if (state.phase !== PHASES.STORY) return { ok: false, reason: 'not-in-story' };
      if (state.storyStep < STORY.length - 1) {
        state.storyStep += 1;
        event(state, 'story-step', STORY[state.storyStep].title, { storyStep: state.storyStep });
      } else {
        state.phase = PHASES.BRIEFING;
        event(state, 'briefing', 'Gatewatch is ready.', null);
      }
      return { ok: true, phase: state.phase, storyStep: state.storyStep };
    }
    if (type === 'start') {
      if (state.phase !== PHASES.BRIEFING) return { ok: false, reason: 'not-ready' };
      enterExplore(state, state.now, 'Bloomvale is open. Meet Maribel east of the Heartlight, explore the roads, or press F at the beacon to begin.');
      return { ok: true, phase: state.phase };
    }
    if (type === 'pause') {
      if (![PHASES.EXPLORE, PHASES.WAVE, PHASES.INTERMISSION].includes(state.phase)) return { ok: false, reason: 'not-pausable' };
      if (!state.paused) state.pausedAtExternal = Number.isFinite(proposedExternalNow) ? proposedExternalNow : state.now + state.clockOffsetMs;
      state.paused = !state.paused;
      event(state, state.paused ? 'paused' : 'resumed', state.paused ? 'Gatewatch paused.' : 'Gatewatch resumed.', null);
      return { ok: true, paused: state.paused };
    }
    if (type === 'interact') return resolveInteraction(state, state.now);
    if (type !== 'input') return { ok: false, reason: 'unsupported-action' };
    if (![PHASES.EXPLORE, PHASES.WAVE, PHASES.INTERMISSION].includes(state.phase)) return { ok: false, reason: 'input-not-active' };
    const seq = Number(action.seq);
    if (!Number.isSafeInteger(seq) || seq < 1 || seq > CONFIG.maxInputSeq) return { ok: false, reason: 'invalid-sequence', expectedAfter: state.lastInputSeq };
    if (seq <= state.lastInputSeq) return { ok: false, reason: 'stale-sequence', expectedAfter: state.lastInputSeq };
    if (seq - state.lastInputSeq > CONFIG.maxInputSeqGap) return { ok: false, reason: 'sequence-gap-too-large', expectedAfter: state.lastInputSeq };
    state.lastInputSeq = seq;
    const move = normalize(clamp(action.moveX, -1, 1), clamp(action.moveY, -1, 1));
    const aim = normalize(clamp(action.aimX, -1, 1), clamp(action.aimY, -1, 1));
    const hasAim = !!(aim.x || aim.y);
    const playerOnline = state.player.health > 0 && state.player.downUntil <= state.now;
    state.input = {
      moveX: move.x,
      moveY: move.y,
      aimX: hasAim ? aim.x : state.input.aimX,
      aimY: hasAim ? aim.y : state.input.aimY,
      firing: playerOnline && action.firing === true,
      dash: playerOnline && action.dash === true,
      pulse: playerOnline && action.pulse === true,
      seq
    };
    return { ok: true, seq };
  }
  function moveActor(entity, dx, dy, speed, dt) {
    const direction = normalize(dx, dy);
    entity.vx = direction.x * speed;
    entity.vy = direction.y * speed;
    entity.x = clamp(entity.x + entity.vx * dt, 60, CONFIG.worldWidth - 60);
    entity.y = clamp(entity.y + entity.vy * dt, 70, CONFIG.worldHeight - 55);
    if (direction.x || direction.y) {
      entity.facingX = direction.x;
      entity.facingY = direction.y;
    }
  }
  function fireProjectile(state, owner, direction, now, damage, options) {
    const aim = normalize(direction.x, direction.y);
    if (!aim.x && !aim.y) return false;
    const counter = !!(options && options.counter && owner.id === 'p1');
    state.projectiles.push({
      id: uid(state, 'shot'), owner: owner.id, x: owner.x + aim.x * (owner.radius + 10), y: owner.y + aim.y * (owner.radius + 10),
      vx: aim.x * CONFIG.projectileSpeed, vy: aim.y * CONFIG.projectileSpeed, radius: counter ? 10 : owner.id === 'p1' ? 6 : 5,
      damage, counter, bornAt: now, color: counter ? '#d7ff72' : owner.id === 'p1' ? '#65f5ff' : '#ffd95c'
    });
    owner.lastShotAt = now;
    owner.shots += 1;
    state.shots += 1;
    state.effects.push({ id: uid(state, 'fx'), type: counter ? 'counter-muzzle' : 'muzzle', x: owner.x, y: owner.y, at: now, color: counter ? '#d7ff72' : owner.id === 'p1' ? '#65f5ff' : '#ffd95c' });
    return true;
  }
  function chooseEnemyType(state) {
    const roll = rand(state);
    if (state.wave >= 3 && roll > 0.7) return 'bruiser';
    if (state.wave >= 2 && roll > 0.48) return 'sprinter';
    return 'nib';
  }
  function spawnEnemy(state, now) {
    if (state.enemies.length >= CONFIG.maxEnemies) return false;
    const gates = [
      { x: 520, y: 360 }, { x: 1880, y: 370 }, { x: 1200, y: 120 },
      { x: 610, y: 1130 }, { x: 1810, y: 1120 }
    ];
    const gate = gates[Math.floor(rand(state) * gates.length) % gates.length];
    const kind = chooseEnemyType(state);
    const spec = ENEMY_TYPES[kind];
    state.enemies.push({
      id: uid(state, kind), kind, x: gate.x + (rand(state) - 0.5) * 80, y: gate.y + (rand(state) - 0.5) * 65,
      vx: 0, vy: 0, facingX: 0, facingY: 1, health: spec.hp, maxHealth: spec.hp, radius: spec.radius,
      lastAttackAt: now - spec.attackMs, lastHitAt: -99999, wobble: rand(state) * Math.PI * 2,
      windupStartedAt: 0, windupUntil: 0, windupTargetId: null, attackAimX: 0, attackAimY: 0
    });
    state.waveSpawned += 1;
    return true;
  }
  function nearestEnemy(state, entity) {
    let nearest = null;
    let nearestDistance = Infinity;
    state.enemies.forEach(enemy => {
      const value = distance(entity, enemy);
      if (enemy.health > 0 && value < nearestDistance) { nearest = enemy; nearestDistance = value; }
    });
    return nearest ? { enemy: nearest, distance: nearestDistance } : null;
  }
  function awardKill(state, enemy, ownerId) {
    const spec = ENEMY_TYPES[enemy.kind];
    state.kills += 1;
    state.score += spec.score + state.combo * 15;
    state.combo = state.now <= state.comboUntil ? state.combo + 1 : 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboUntil = state.now + 2800;
    if (ownerId === 'p1') state.player.kills += 1;
    if (ownerId === 'moxie') state.ally.kills += 1;
    state.effects.push({ id: uid(state, 'fx'), type: 'pop', x: enemy.x, y: enemy.y, at: state.now, color: enemy.kind === 'bruiser' ? '#ff7ab8' : '#b377ff' });
    if (state.kills % 5 === 0) state.pickups.push({ id: uid(state, 'heart'), type: 'heart', x: enemy.x, y: enemy.y, bornAt: state.now, radius: 15 });
    event(state, 'enemy-popped', (ownerId === 'moxie' ? 'Moxie' : state.player.name) + ' popped a ' + enemy.kind + '.', { enemy: enemy.kind, ownerId, combo: state.combo });
  }
  function damageActor(state, target, amount, now, source) {
    if (target.invulnerableUntil > now || target.downUntil > now) return false;
    target.health = Math.max(0, target.health - amount);
    target.lastHitAt = now;
    state.effects.push({
      id: uid(state, 'fx'),
      type: 'defender-hit',
      targetId: target.id,
      x: target.x,
      y: target.y,
      sourceX: source && Number.isFinite(source.x) ? source.x : target.x,
      sourceY: source && Number.isFinite(source.y) ? source.y : target.y,
      sourceKind: source && ENEMY_TYPES[source.kind] ? source.kind : 'unknown',
      amount: Math.max(0, Number(amount) || 0),
      at: now,
      color: '#ff5d72'
    });
    if (target.health <= 0) {
      target.downUntil = now + CONFIG.respawnMs;
      target.invulnerableUntil = target.downUntil + 1200;
      if (target.id === 'p1') state.counterReadyUntil = 0;
      event(state, 'defender-down', target.name + ' needs a reboot.', { id: target.id, returnsAt: target.downUntil });
    }
    return true;
  }

  function enemyTargetById(state, targetId) {
    if (targetId === 'p1') return state.player;
    if (targetId === 'moxie') return state.ally;
    if (targetId === 'heartlight') return state.beacon;
    return null;
  }

  function clearEnemyWindup(enemy) {
    enemy.windupStartedAt = 0;
    enemy.windupUntil = 0;
    enemy.windupTargetId = null;
    enemy.attackAimX = 0;
    enemy.attackAimY = 0;
  }

  function startEnemyWindup(enemy, target, direction, spec, now) {
    enemy.windupStartedAt = now;
    enemy.windupUntil = now + spec.windupMs;
    enemy.windupTargetId = target.id;
    enemy.attackAimX = direction.x;
    enemy.attackAimY = direction.y;
  }

  function missEnemyAttack(state, enemy, target, now) {
    state.effects.push({
      id: uid(state, 'fx'), type: 'enemy-miss', sourceId: enemy.id, sourceKind: enemy.kind,
      targetId: target ? target.id : enemy.windupTargetId,
      targetX: target && Number.isFinite(target.x) ? target.x : enemy.x,
      targetY: target && Number.isFinite(target.y) ? target.y : enemy.y,
      x: enemy.x, y: enemy.y, at: now, color: '#7dffca'
    });
    if (target && target.id === 'p1' && target.health > 0 && !(target.downUntil > now)) {
      state.perfectDodges += 1;
      state.score += CONFIG.perfectDodgeScore;
      state.counterReadyUntil = now + CONFIG.prismCounterMs;
      state.effects.push({ id: uid(state, 'fx'), type: 'counter-ready', targetId: 'p1', x: target.x, y: target.y, at: now, color: '#d7ff72' });
      event(state, 'perfect-dodge', 'Perfect dodge · Prism Counter armed.', { sourceId: enemy.id, sourceKind: enemy.kind, readyUntil: state.counterReadyUntil, score: CONFIG.perfectDodgeScore });
    }
  }
  function updatePlayer(state, dt, now) {
    const player = state.player;
    if (player.downUntil > now) {
      player.vx = 0; player.vy = 0;
      state.input.firing = false; state.input.dash = false; state.input.pulse = false;
      return;
    }
    if (player.downUntil && player.downUntil <= now && player.health <= 0) {
      state.input.firing = false; state.input.dash = false; state.input.pulse = false;
      player.health = 70; player.x = 1080; player.y = 750; player.downUntil = 0;
      event(state, 'defender-return', player.name + ' is back in color.', { id: player.id });
    }
    const playerSpeed = hasUnlock(state, 'trailblazer-boots') ? 275 : CONFIG.playerSpeed;
    moveActor(player, state.input.moveX, state.input.moveY, playerSpeed, dt);
    if (state.input.aimX || state.input.aimY) { player.facingX = state.input.aimX; player.facingY = state.input.aimY; }
    if (state.input.dash && now >= state.dashReadyAt) {
      const dash = normalize(state.input.moveX || player.facingX, state.input.moveY || player.facingY);
      const dashDistance = hasUnlock(state, 'trailblazer-boots') ? 155 : 125;
      player.x = clamp(player.x + dash.x * dashDistance, 60, CONFIG.worldWidth - 60);
      player.y = clamp(player.y + dash.y * dashDistance, 70, CONFIG.worldHeight - 55);
      player.invulnerableUntil = now + 240;
      state.dashReadyAt = now + (hasUnlock(state, 'trailblazer-boots') ? 1350 : CONFIG.dashCooldownMs);
      state.effects.push({ id: uid(state, 'fx'), type: 'dash', x: player.x, y: player.y, at: now, color: player.color });
    }
    if (state.input.pulse && now >= state.pulseReadyAt) {
      let affected = 0;
      let popped = 0;
      state.enemies.forEach(enemy => {
        if (enemy.health > 0 && distance(player, enemy) <= 235) {
          enemy.health -= 48;
          enemy.lastHitAt = now;
          affected += 1;
          if (enemy.health <= 0) { awardKill(state, enemy, 'p1'); popped += 1; }
        }
      });
      state.beacon.health = Math.min(state.beacon.maxHealth, state.beacon.health + 18);
      player.health = Math.min(player.maxHealth, player.health + 16);
      state.pulseReadyAt = now + CONFIG.pulseCooldownMs;
      state.effects.push({ id: uid(state, 'fx'), type: 'pulse', x: player.x, y: player.y, at: now, color: '#d6ff70' });
      event(state, 'heartburst', 'Heartburst pushed back ' + affected + ' Smudges' + (popped ? ' and popped ' + popped + '.' : '.'), { affected, popped });
    }
    if (state.input.firing && now - player.lastShotAt >= CONFIG.playerFireMs) {
      const baseDamage = hasUnlock(state, 'prism-paint') ? 32 : 24;
      const counter = state.counterReadyUntil > now;
      const fired = fireProjectile(state, player, { x: state.input.aimX, y: state.input.aimY }, now, counter ? baseDamage * CONFIG.prismCounterMultiplier : baseDamage, { counter });
      if (fired && counter) {
        state.counterReadyUntil = 0;
        event(state, 'prism-counter', 'Prism Counter launched.', { damage: baseDamage * CONFIG.prismCounterMultiplier });
      }
    }
    state.input.dash = false;
    state.input.pulse = false;
  }
  function updateAlly(state, dt, now) {
    const ally = state.ally;
    if (ally.downUntil > now) { ally.vx = 0; ally.vy = 0; return; }
    if (ally.downUntil && ally.downUntil <= now && ally.health <= 0) {
      ally.health = 75; ally.x = 1145; ally.y = 760; ally.downUntil = 0;
      event(state, 'defender-return', 'Moxie rebooted.', { id: ally.id });
    }
    const target = nearestEnemy(state, ally);
    if (!target) {
      const angle = now / 1700;
      const home = state.phase === PHASES.EXPLORE
        ? { x: state.player.x - state.player.facingX * 78 + Math.cos(angle) * 24, y: state.player.y - state.player.facingY * 78 + Math.sin(angle) * 24 }
        : { x: state.beacon.x + Math.cos(angle) * 125, y: state.beacon.y + Math.sin(angle) * 105 };
      moveActor(ally, home.x - ally.x, home.y - ally.y, CONFIG.allySpeed * (state.phase === PHASES.EXPLORE ? .82 : .55), dt);
      return;
    }
    const direction = normalize(target.enemy.x - ally.x, target.enemy.y - ally.y);
    ally.facingX = direction.x; ally.facingY = direction.y;
    if (target.distance > 245) moveActor(ally, direction.x, direction.y, CONFIG.allySpeed, dt);
    else if (target.distance < 115) moveActor(ally, -direction.x + direction.y * 0.35, -direction.y - direction.x * 0.35, CONFIG.allySpeed, dt);
    else moveActor(ally, direction.y * 0.22, -direction.x * 0.22, CONFIG.allySpeed * 0.5, dt);
    const allyFireMs = hasUnlock(state, 'moxie-overclock') ? 320 : CONFIG.allyFireMs;
    if (target.distance < 520 && now - ally.lastShotAt >= allyFireMs) fireProjectile(state, ally, direction, now, 17);
  }
  function updateProjectiles(state, dt, now) {
    state.projectiles.forEach(projectile => {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      if (projectile.dead) return;
      if (state.phase === PHASES.EXPLORE && projectile.owner === 'p1') {
        for (const target of state.practiceTargets) {
          if (target.painted) continue;
          if (distance(projectile, target) <= projectile.radius + target.radius) {
            target.painted = true;
            target.lastHitAt = now;
            projectile.dead = true;
            state.exploration.paintedTargetIds.push(target.id);
            state.score += 80;
            state.effects.push({ id: uid(state, 'fx'), type: 'target', x: target.x, y: target.y, at: now, color: '#b38cff' });
            event(state, 'target-painted', 'Range bloom painted · ' + state.exploration.paintedTargetIds.length + ' / ' + PRACTICE_TARGETS.length, { targetId: target.id });
            checkUnlocks(state);
            break;
          }
        }
      }
      if (projectile.dead) return;
      for (const enemy of state.enemies) {
        if (enemy.health <= 0) continue;
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius) {
          enemy.health -= projectile.damage;
          enemy.lastHitAt = now;
          projectile.dead = true;
          state.hits += 1;
          const defeated = enemy.health <= 0;
          if (defeated) awardKill(state, enemy, projectile.owner);
          if (projectile.counter) {
            state.effects.push({ id: uid(state, 'fx'), type: 'counter-hit', x: enemy.x, y: enemy.y, at: now, color: '#d7ff72', damage: projectile.damage });
            event(state, 'counter-hit', 'Prism Counter hit · ' + projectile.damage + ' color.', { damage: projectile.damage, defeated, enemy: enemy.kind });
          }
          break;
        }
      }
    });
    state.projectiles = state.projectiles.filter(projectile => !projectile.dead && now - projectile.bornAt < 1500 && projectile.x > -50 && projectile.x < CONFIG.worldWidth + 50 && projectile.y > -50 && projectile.y < CONFIG.worldHeight + 50);
    state.enemies = state.enemies.filter(enemy => enemy.health > 0);
  }
  function updateEnemies(state, dt, now) {
    state.enemies.forEach(enemy => {
      const spec = ENEMY_TYPES[enemy.kind];
      if (Number(enemy.windupUntil) > 0) {
        const target = enemyTargetById(state, enemy.windupTargetId);
        enemy.vx = 0; enemy.vy = 0;
        if (enemy.attackAimX || enemy.attackAimY) {
          enemy.facingX = enemy.attackAimX;
          enemy.facingY = enemy.attackAimY;
        }
        if (now < enemy.windupUntil) return;
        const targetAlive = !!target && target.health > 0 && !(target.downUntil > now);
        const contact = target ? enemy.radius + (target.radius || 22) + 5 : 0;
        let landed = false;
        if (targetAlive && distance(enemy, target) <= contact + 4) {
          if (target.id === 'heartlight') {
            state.beacon.health = Math.max(0, state.beacon.health - spec.damage);
            state.beacon.lastHitAt = now;
            event(state, 'beacon-hit', 'The Heartlight lost ' + spec.damage + ' color.', { enemy: enemy.kind, health: state.beacon.health });
            landed = true;
          } else landed = damageActor(state, target, spec.damage, now, enemy);
        }
        enemy.lastAttackAt = now;
        if (!landed) missEnemyAttack(state, enemy, target, now);
        clearEnemyWindup(enemy);
        return;
      }
      const possible = [state.beacon];
      if (state.player.downUntil <= now && distance(enemy, state.player) < 245) possible.push(state.player);
      if (state.ally.downUntil <= now && distance(enemy, state.ally) < 215) possible.push(state.ally);
      let target = possible[0];
      possible.forEach(candidate => { if (distance(enemy, candidate) < distance(enemy, target)) target = candidate; });
      const direction = normalize(target.x - enemy.x, target.y - enemy.y);
      enemy.facingX = direction.x; enemy.facingY = direction.y;
      const contact = enemy.radius + (target.radius || 22) + 5;
      if (distance(enemy, target) > contact) moveActor(enemy, direction.x, direction.y, spec.speed, dt);
      else if (now - enemy.lastAttackAt >= spec.attackMs) startEnemyWindup(enemy, target, direction, spec, now);
    });
  }
  function updatePickups(state, now) {
    state.pickups.forEach(pickup => {
      if (distance(pickup, state.player) < pickup.radius + state.player.radius && state.player.downUntil <= now) {
        pickup.dead = true;
        state.player.health = Math.min(state.player.maxHealth, state.player.health + 25);
        state.beacon.health = Math.min(state.beacon.maxHealth, state.beacon.health + 12);
        state.score += 75;
        event(state, 'heart-collected', 'A color heart restored the team.', null);
      }
    });
    state.pickups = state.pickups.filter(pickup => !pickup.dead && now - pickup.bornAt < 10000);
  }
  function step(state, deltaMs, now) {
    const check = validate(state);
    if (!check.pass) throw new Error('invalid Toonfall state: ' + check.errors.join('; '));
    const dtMs = clamp(deltaMs, 0, 100);
    if (state.paused) return state;
    const proposedExternalNow = Number(now);
    const mappedNow = Number.isFinite(proposedExternalNow) ? proposedExternalNow - state.clockOffsetMs : NaN;
    state.now = monotonicNow(state, mappedNow, dtMs);
    if (state.counterReadyUntil && state.now >= state.counterReadyUntil) state.counterReadyUntil = 0;
    if (![PHASES.EXPLORE, PHASES.WAVE, PHASES.INTERMISSION].includes(state.phase)) return state;
    state.elapsedMs += dtMs;
    if (state.combo && state.now > state.comboUntil) state.combo = 0;
    if (state.phase === PHASES.EXPLORE) {
      updatePlayer(state, dtMs / 1000, state.now);
      updateAlly(state, dtMs / 1000, state.now);
      updateProjectiles(state, dtMs / 1000, state.now);
      updateExploration(state, state.now);
      state.effects = state.effects.filter(effect => state.now - effect.at < (effect.type === 'counter-hit' ? 1800 : 900)).slice(-80);
      return state;
    }
    if (state.phase === PHASES.INTERMISSION) {
      updatePlayer(state, dtMs / 1000, state.now);
      updateAlly(state, dtMs / 1000, state.now);
      if (state.now >= state.nextWaveAt) beginWave(state, state.now);
      return state;
    }
    const spawnInterval = CONFIG.waveSpawnMs[state.wave - 1];
    while (state.waveSpawned < state.waveTarget && state.now >= state.nextSpawnAt && state.enemies.length < CONFIG.maxEnemies) {
      spawnEnemy(state, state.now);
      state.nextSpawnAt += spawnInterval;
    }
    updatePlayer(state, dtMs / 1000, state.now);
    updateAlly(state, dtMs / 1000, state.now);
    updateProjectiles(state, dtMs / 1000, state.now);
    updateEnemies(state, dtMs / 1000, state.now);
    updatePickups(state, state.now);
    state.effects = state.effects.filter(effect => state.now - effect.at < (effect.type === 'counter-hit' ? 1800 : 900)).slice(-80);
    if (state.beacon.health <= 0) finish(state, false);
    else if (state.waveSpawned >= state.waveTarget && state.enemies.length === 0) {
      if (state.wave >= CONFIG.waveCounts.length) finish(state, true);
      else {
        state.beacon.health = Math.min(state.beacon.maxHealth, state.beacon.health + 28);
        state.player.health = Math.min(state.player.maxHealth, state.player.health + 35);
        state.ally.health = Math.min(state.ally.maxHealth, state.ally.health + 35);
        enterExplore(state, state.now, 'Wave clear. Bloomvale is open again—explore or return to the Heartlight for wave ' + (state.wave + 1) + '.');
      }
    }
    return state;
  }
  function snapshot(state) {
    const copy = clone(state);
    copy.events = copy.events.slice(-20);
    copy.effects = copy.effects.slice(-50);
    return copy;
  }
  function observe(state) {
    const playerDown = state.player.health <= 0 && state.player.downUntil > state.now;
    const activeActions = state.paused
      ? ['pause-to-resume', 'pause']
      : playerDown
        ? ['wait-for-reboot', 'pause']
        : state.phase === PHASES.EXPLORE
          ? ['move-aim-fire-interact-map', 'pause']
          : ['move-aim-fire-dash-heartburst', 'pause'];
    return {
      schema: OBSERVATION_SCHEMA,
      gameId: GAME_ID,
      phase: state.phase,
      paused: state.paused,
      wave: state.wave,
      objective: playerDown ? 'Wait for ' + state.player.name + ' to reboot' : state.phase === PHASES.STORY ? STORY[state.storyStep].title : state.phase === PHASES.BRIEFING ? 'Open Bloomvale' : state.phase === PHASES.EXPLORE ? 'Explore Bloomvale or begin wave ' + (state.wave + 1) + ' at the Heartlight' : state.phase === PHASES.WAVE ? 'Defend the Heartlight and clear wave ' + state.wave : state.phase === PHASES.INTERMISSION ? 'Regroup before wave ' + (state.wave + 1) : state.result && state.result.title,
      player: {
        x: state.player.x, y: state.player.y, health: state.player.health, down: playerDown,
        dashReady: !playerDown && state.now >= state.dashReadyAt,
        pulseReady: !playerDown && state.now >= state.pulseReadyAt,
        perfectDodges: state.perfectDodges,
        counter: state.counterReadyUntil > state.now ? { readyUntil: state.counterReadyUntil, remainingMs: state.counterReadyUntil - state.now, damageMultiplier: CONFIG.prismCounterMultiplier } : null
      },
      ally: { x: state.ally.x, y: state.ally.y, health: state.ally.health, down: state.ally.downUntil > state.now, behavior: state.enemies.length ? 'defend-and-engage' : 'orbit-heartlight' },
      beacon: { health: state.beacon.health, maxHealth: state.beacon.maxHealth },
      enemies: state.enemies.map(enemy => ({
        id: enemy.id, kind: enemy.kind, x: enemy.x, y: enemy.y, health: enemy.health,
        attack: enemy.windupUntil > state.now ? {
          targetId: enemy.windupTargetId,
          resolvesAt: enemy.windupUntil,
          remainingMs: enemy.windupUntil - state.now
        } : null
      })),
      exploration: clone(state.exploration),
      score: state.score,
      result: clone(state.result),
      allowedActions: state.phase === PHASES.STORY ? ['story-next'] : state.phase === PHASES.BRIEFING ? ['start'] : activeActions,
      authority: 'observation-only'
    };
  }

  return {
    COLOR_WISPS,
    CONFIG,
    DISTRICTS,
    ENEMY_TYPES,
    GAME_ID,
    INPUT_SCHEMA,
    NPCS,
    OBSERVATION_SCHEMA,
    PHASES,
    PRACTICE_TARGETS,
    STATE_SCHEMA,
    STORY,
    UNLOCKS,
    applyAction,
    beginWave,
    clone,
    createInitialState,
    districtAt,
    enterExplore,
    finish,
    hasUnlock,
    normalizeRoster,
    observe,
    resolveInteraction,
    snapshot,
    spawnEnemy,
    step,
    validate
  };
});
