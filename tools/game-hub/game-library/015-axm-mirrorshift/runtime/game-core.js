(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MirrorShiftCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GAME_ID = '015-axm-mirrorshift';
  const PHASES = Object.freeze({ LOBBY: 'lobby', COUNTDOWN: 'countdown', RACING: 'racing', RESULTS: 'results' });
  const MODES = Object.freeze({ RACE: 'race', TOUR: 'tour', BATTLE: 'battle' });
  const TRACK_IDS = Object.freeze({
    FORGE: 'mirror-forge',
    GARDENS: 'splitglass-gardens',
    FOUNDRY: 'null-foundry'
  });
  const RACE_VARIANT_IDS = Object.freeze({
    CLEAR: 'clear-signal',
    SPRINT: 'shardline-sprint',
    GAUNTLET: 'redline-gauntlet'
  });
  const ROUTE_DIRECTION_IDS = Object.freeze({
    FORWARD: 'forward',
    REFLECTION: 'reflection'
  });
  const ROUTE_DIRECTIONS = Object.freeze({
    [ROUTE_DIRECTION_IDS.FORWARD]: Object.freeze({
      id: ROUTE_DIRECTION_IDS.FORWARD,
      label: 'FLOW LINE',
      shortLabel: 'FLOW',
      description: 'The authored circuit in its original direction.',
      changesVehicleStats: false,
      changesCatchup: false,
      lobbyLocked: true
    }),
    [ROUTE_DIRECTION_IDS.REFLECTION]: Object.freeze({
      id: ROUTE_DIRECTION_IDS.REFLECTION,
      label: 'REFLECTION RUN',
      shortLabel: 'REFLECT',
      description: 'The same authored circuit reversed around its fixed finish line.',
      changesVehicleStats: false,
      changesCatchup: false,
      lobbyLocked: true
    })
  });
  const ROUTE_DIRECTION_CATALOG = Object.freeze(Object.values(ROUTE_DIRECTIONS));
  const RACE_VARIANTS = Object.freeze({
    [RACE_VARIANT_IDS.CLEAR]: Object.freeze({
      id: RACE_VARIANT_IDS.CLEAR,
      label: 'CLEAR SIGNAL',
      shortLabel: 'CLEAR',
      format: '3 LAPS // ORIGINAL MIX',
      description: 'The authored circuit at full signal fidelity.',
      laps: 3,
      hazardPeriodScale: 1,
      hazardActiveScale: 1,
      itemRespawnScale: 1,
      shortcutWidthScale: 1,
      shortcutBoostMs: 360,
      shortcutBoostPower: 1.08,
      offRoadDrag: 120,
      musicTempoDelta: 0,
      visual: 'clear-grid',
      changesVehicleStats: false,
      changesCatchup: false,
      lobbyLocked: true
    }),
    [RACE_VARIANT_IDS.SPRINT]: Object.freeze({
      id: RACE_VARIANT_IDS.SPRINT,
      label: 'SHARDLINE SPRINT',
      shortLabel: 'SPRINT',
      format: '2 LAPS // RISK ROUTES',
      description: 'A short precision run with tighter, higher-payoff shortcuts.',
      laps: 2,
      hazardPeriodScale: .94,
      hazardActiveScale: .92,
      itemRespawnScale: .9,
      shortcutWidthScale: .76,
      shortcutBoostMs: 720,
      shortcutBoostPower: 1.13,
      offRoadDrag: 145,
      musicTempoDelta: 6,
      visual: 'shard-rain',
      changesVehicleStats: false,
      changesCatchup: false,
      lobbyLocked: true
    }),
    [RACE_VARIANT_IDS.GAUNTLET]: Object.freeze({
      id: RACE_VARIANT_IDS.GAUNTLET,
      label: 'REDLINE GAUNTLET',
      shortLabel: 'REDLINE',
      format: '4 LAPS // LIVE PRESSURE',
      description: 'A long-form pressure race with faster hazards and item turnover.',
      laps: 4,
      hazardPeriodScale: .72,
      hazardActiveScale: 1.08,
      itemRespawnScale: .72,
      shortcutWidthScale: 1,
      shortcutBoostMs: 420,
      shortcutBoostPower: 1.09,
      offRoadDrag: 130,
      musicTempoDelta: 9,
      visual: 'redline-pulse',
      changesVehicleStats: false,
      changesCatchup: false,
      lobbyLocked: true
    })
  });
  const RACE_VARIANT_CATALOG = Object.freeze(Object.values(RACE_VARIANTS));
  const SIGNAL_TOUR = Object.freeze({
    schema: 'axm.mirrorshift-signal-tour/v1',
    label: 'SIGNAL TOUR',
    points: Object.freeze([9, 6, 4, 2]),
    tieBreaker: 'total points, then latest-round placement, then stable seat order',
    rounds: Object.freeze([
      Object.freeze({ number: 1, trackId: TRACK_IDS.FORGE, variantId: RACE_VARIANT_IDS.CLEAR }),
      Object.freeze({ number: 2, trackId: TRACK_IDS.GARDENS, variantId: RACE_VARIANT_IDS.SPRINT }),
      Object.freeze({ number: 3, trackId: TRACK_IDS.FOUNDRY, variantId: RACE_VARIANT_IDS.GAUNTLET })
    ])
  });
  const BASE_STATS = Object.freeze({ maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: 0.985 });
  const ASSIST_CONTRACT = Object.freeze({ steeringStrength: 0.22, changesVehicleStats: false, configurableOnlyInLobby: true });
  const MUSIC_PROFILES = Object.freeze({
    'mirror-forge': Object.freeze({ id: 'forge', tempo: 126, rootMidi: 48, scale: [0, 3, 5, 7, 10] }),
    'splitglass-gardens': Object.freeze({ id: 'gardens', tempo: 118, rootMidi: 53, scale: [0, 2, 5, 7, 9] }),
    'null-foundry': Object.freeze({ id: 'foundry', tempo: 132, rootMidi: 43, scale: [0, 2, 3, 7, 8] }),
    battle: Object.freeze({ id: 'core', tempo: 138, rootMidi: 46, scale: [0, 1, 5, 7, 10] })
  });
  const METRICS = Object.freeze({
    laps: 3,
    countdownMs: 3200,
    maxRaceMs: 150000,
    roadWidth: 112,
    shieldMax: 3,
    inputTimeoutMs: 650,
    itemRespawnMs: 3900,
    boltLifeMs: 2800,
    mineLifeMs: 12000,
    resultsDelayMs: 15000,
    catchupByRank: [1, 1.025, 1.05, 1.075],
    driftMinSpeed: 92,
    driftTierThresholds: [0.24, 0.55, 0.86],
    driftBoostMs: [0, 620, 980, 1380],
    driftBoostPower: [1, 1.1, 1.14, 1.18],
    battleDurationMs: 60000,
    battleScoreToWin: 12,
    battleHitCooldownMs: 980,
    battleRespawnMs: 1500,
    battleSpawnProtectionMs: 1800,
    battleItemRespawnMs: 1450
  });
  const INPUT_SCHEMA = Object.freeze({
    schema: 'axm.semantic-racing-input/v1',
    intents: {
      drive: { throttle: '0..1', brake: '0..1; brake + throttle + steer at speed charges drift', steer: '-1..1', seq: 'monotonic integer' },
      item: { seq: 'monotonic integer' },
      start: { seq: 'monotonic integer' }
    }
  });
  const ITEM_TYPES = Object.freeze({
    bolt: { id: 'bolt', label: 'ARC BOLT', icon: '➶', attack: true },
    mine: { id: 'mine', label: 'GLITCH MINE', icon: '✹', attack: true },
    emp: { id: 'emp', label: 'EMP NOVA', icon: '◉', attack: true },
    repair: { id: 'repair', label: 'GUARD PATCH', icon: '✦', attack: false }
  });
  const POWERUP_WEIGHTS = Object.freeze([
    { id: 'bolt', weight: 35 },
    { id: 'mine', weight: 30 },
    { id: 'emp', weight: 20 },
    { id: 'repair', weight: 15 }
  ]);
  const BATTLE_POWERUP_WEIGHTS = Object.freeze([
    { id: 'bolt', weight: 30 },
    { id: 'mine', weight: 25 },
    { id: 'emp', weight: 35 },
    { id: 'repair', weight: 10 }
  ]);
  const RACERS = Object.freeze([
    {
      id: 'p1', name: 'Mike', title: 'Workshop Maverick', vehicle: 'Maker GT',
      color: '#ff9f43', accent: '#fff1d2', dark: '#4a2416', portrait: 0,
      signature: 'MAKE IT LOUD',
      bio: 'Turns half-finished ideas into unfairly good game-night stories.'
    },
    {
      id: 'p2', name: 'Axiom/Mir', title: 'Signal Twin', vehicle: 'Axiom Arc',
      color: '#706cff', accent: '#77ecff', dark: '#1e205f', portrait: 1,
      signature: 'TWIN SIGNAL',
      bio: 'Reads the circuit as two truths moving in perfect symmetry.'
    },
    {
      id: 'p3', name: 'Codex', title: 'Curious Compiler', vehicle: 'Prompt Runner',
      color: '#26e6ee', accent: '#ff4fbd', dark: '#0b5366', portrait: 2,
      signature: 'LIVE COMPILE',
      bio: 'Builds the route while driving it, then asks why it cannot go faster.'
    },
    {
      id: 'p4', name: 'Mirror', title: 'Chrome Echo', vehicle: 'Prism Wraith',
      color: '#f0f5ff', accent: '#ff5f8f', dark: '#25263f', portrait: 3,
      signature: 'COUNTER ANGLE',
      bio: 'Returns every challenge with the angle changed and the stakes raised.'
    }
  ]);
  const CHARACTER_EXPRESSIONS = Object.freeze({
    p1: Object.freeze({
      id: 'maker-ratchet', label: 'RATCHET ROAR', quote: 'If it rattles, it runs.',
      visual: 'piston-chevrons', waveform: 'square', motif: Object.freeze([45, 52, 57, 64]),
      changesPerformance: false
    }),
    p2: Object.freeze({
      id: 'twin-orbit', label: 'DUAL PHASE', quote: 'Two lines. One answer.',
      visual: 'counter-orbit', waveform: 'sine', motif: Object.freeze([50, 57, 62, 69]),
      changesPerformance: false
    }),
    p3: Object.freeze({
      id: 'live-compile', label: 'ROUTE COMPILED', quote: 'Route compiled. Keep up.',
      visual: 'pixel-stack', waveform: 'triangle', motif: Object.freeze([52, 55, 59, 64]),
      changesPerformance: false
    }),
    p4: Object.freeze({
      id: 'prism-echo', label: 'RETURN SIGNAL', quote: 'I saw that move coming back.',
      visual: 'echo-prism', waveform: 'sine', motif: Object.freeze([59, 55, 62, 67]),
      changesPerformance: false
    })
  });
  const KINETIC_RIGS = Object.freeze({
    p1: Object.freeze({
      id: 'maker-piston-rig', motion: 'ratchet-pistons', cadence: 1.08,
      ride: 1.12, roll: 0.92, signatureOffset: 0.15, changesPerformance: false
    }),
    p2: Object.freeze({
      id: 'axiom-twin-rig', motion: 'counter-orbit-fins', cadence: 0.84,
      ride: 0.84, roll: 0.78, signatureOffset: 1.72, changesPerformance: false
    }),
    p3: Object.freeze({
      id: 'codex-stack-rig', motion: 'compile-stack-fins', cadence: 1.22,
      ride: 0.96, roll: 1.08, signatureOffset: 3.28, changesPerformance: false
    }),
    p4: Object.freeze({
      id: 'mirror-prism-rig', motion: 'phase-prism-plates', cadence: 0.72,
      ride: 0.78, roll: 0.7, signatureOffset: 4.64, changesPerformance: false
    })
  });
  const RESULT_STAGE_MOMENTS = Object.freeze({
    p1: Object.freeze({
      id: 'ratchet-salute', label: 'RATCHET SALUTE', motion: 'piston-pop',
      cadence: 1.08, phaseOffset: 0.18, entryRoll: -2.8, float: 1.55, roll: 0.82,
      changesPerformance: false, changesAuthority: false
    }),
    p2: Object.freeze({
      id: 'twin-orbit-lock', label: 'TWIN ORBIT LOCK', motion: 'counter-orbit',
      cadence: 0.82, phaseOffset: 1.7, entryRoll: 2.4, float: 1.18, roll: 0.64,
      changesPerformance: false, changesAuthority: false
    }),
    p3: Object.freeze({
      id: 'compile-complete', label: 'COMPILE COMPLETE', motion: 'stack-resolve',
      cadence: 1.22, phaseOffset: 3.14, entryRoll: -1.7, float: 1.34, roll: 0.72,
      changesPerformance: false, changesAuthority: false
    }),
    p4: Object.freeze({
      id: 'return-vector', label: 'RETURN VECTOR', motion: 'prism-return',
      cadence: 0.7, phaseOffset: 4.62, entryRoll: 2.1, float: 1.04, roll: 0.52,
      changesPerformance: false, changesAuthority: false
    })
  });
  const START_GRID_MOMENTS = Object.freeze({
    p1: Object.freeze({
      id: 'ratchet-ready', label: 'RATCHET READY', motion: 'piston-set',
      cadence: 1.12, phaseOffset: 0.22, entryRoll: -2.6, float: 1.28,
      changesPerformance: false, changesAuthority: false
    }),
    p2: Object.freeze({
      id: 'signal-synced', label: 'SIGNAL SYNCED', motion: 'dual-lock',
      cadence: 0.86, phaseOffset: 1.68, entryRoll: 2.2, float: 1.04,
      changesPerformance: false, changesAuthority: false
    }),
    p3: Object.freeze({
      id: 'compile-armed', label: 'COMPILE ARMED', motion: 'stack-prime',
      cadence: 1.24, phaseOffset: 3.16, entryRoll: -1.8, float: 1.16,
      changesPerformance: false, changesAuthority: false
    }),
    p4: Object.freeze({
      id: 'vector-returned', label: 'VECTOR RETURNED', motion: 'prism-lock',
      cadence: 0.74, phaseOffset: 4.58, entryRoll: 2, float: 0.92,
      changesPerformance: false, changesAuthority: false
    })
  });
  const ENVIRONMENT_CHOREOGRAPHIES = Object.freeze({
    [TRACK_IDS.FORGE]: Object.freeze({
      id: 'forge-countercycle', label: 'FORGE COUNTERCYCLE', motion: 'counter-orbit-arcs',
      cadence: 0.18, direction: 1, phaseOffset: 0.22, density: 8, drift: 7,
      baseGlow: 0.24, glowRange: 0.34, changesPerformance: false, changesAuthority: false
    }),
    [TRACK_IDS.GARDENS]: Object.freeze({
      id: 'garden-bloom-tide', label: 'BLOOM TIDE', motion: 'petal-drift-glints',
      cadence: 0.12, direction: -1, phaseOffset: 1.68, density: 18, drift: 11,
      baseGlow: 0.2, glowRange: 0.28, changesPerformance: false, changesAuthority: false
    }),
    [TRACK_IDS.FOUNDRY]: Object.freeze({
      id: 'foundry-heat-cycle', label: 'FOUNDRY HEAT CYCLE', motion: 'stack-ember-lift',
      cadence: 0.24, direction: 1, phaseOffset: 3.16, density: 16, drift: 15,
      baseGlow: 0.26, glowRange: 0.38, changesPerformance: false, changesAuthority: false
    }),
    'mirror-core-arena': Object.freeze({
      id: 'core-vector-scan', label: 'CORE VECTOR SCAN', motion: 'return-vector-shards',
      cadence: 0.28, direction: -1, phaseOffset: 4.58, density: 12, drift: 6,
      baseGlow: 0.25, glowRange: 0.4, changesPerformance: false, changesAuthority: false
    })
  });

  function isRaceMode(mode) {
    return mode === MODES.RACE || mode === MODES.TOUR;
  }

  function signalTourRound(index) {
    return SIGNAL_TOUR.rounds[Math.max(0, Math.min(SIGNAL_TOUR.rounds.length - 1, Number(index) || 0))];
  }

  function tourStandings(points, latestRanking) {
    const stableSeats = RACERS.map(racer => racer.id);
    const latest = Array.isArray(latestRanking) && latestRanking.length ? latestRanking : stableSeats;
    return stableSeats.slice().sort((first, second) =>
      Number(points[second] || 0) - Number(points[first] || 0)
      || latest.indexOf(first) - latest.indexOf(second)
      || stableSeats.indexOf(first) - stableSeats.indexOf(second)
    );
  }

  function createSignalTour() {
    const points = Object.fromEntries(RACERS.map(racer => [racer.id, 0]));
    return {
      schema: SIGNAL_TOUR.schema,
      label: SIGNAL_TOUR.label,
      roundIndex: 0,
      roundCount: SIGNAL_TOUR.rounds.length,
      pointsTable: SIGNAL_TOUR.points.slice(),
      points,
      standings: tourStandings(points),
      roundResults: [],
      complete: false,
      championId: null
    };
  }

  function characterExpressionFor(characterId) {
    return CHARACTER_EXPRESSIONS[String(characterId || '')] || CHARACTER_EXPRESSIONS.p1;
  }

  function kineticRigFor(characterId) {
    return KINETIC_RIGS[String(characterId || '')] || KINETIC_RIGS.p1;
  }

  function resultStageMomentFor(characterId) {
    return RESULT_STAGE_MOMENTS[String(characterId || '')] || RESULT_STAGE_MOMENTS.p1;
  }

  function startGridMomentFor(characterId) {
    return START_GRID_MOMENTS[String(characterId || '')] || START_GRID_MOMENTS.p1;
  }

  function environmentChoreographyFor(environmentId) {
    return ENVIRONMENT_CHOREOGRAPHIES[String(environmentId || '')] || ENVIRONMENT_CHOREOGRAPHIES[TRACK_IDS.FORGE];
  }

  function raceVariantFor(variantId) {
    return RACE_VARIANTS[String(variantId || '')] || RACE_VARIANTS[RACE_VARIANT_IDS.CLEAR];
  }

  function routeDirectionFor(directionId) {
    return ROUTE_DIRECTIONS[String(directionId || '')] || ROUTE_DIRECTIONS[ROUTE_DIRECTION_IDS.FORWARD];
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function round(value, places) {
    const power = Math.pow(10, places == null ? 3 : places);
    return Math.round(value * power) / power;
  }
  function environmentChoreographyPose(environmentId, frameNow, prefersReducedMotion) {
    const requestedEnvironmentId = String(environmentId || '');
    const resolvedEnvironmentId = ENVIRONMENT_CHOREOGRAPHIES[requestedEnvironmentId] ? requestedEnvironmentId : TRACK_IDS.FORGE;
    const profile = environmentChoreographyFor(resolvedEnvironmentId);
    const elapsedSeconds = Math.max(0, Number(frameNow) || 0) / 1000;
    const reduced = Boolean(prefersReducedMotion);
    const angle = elapsedSeconds * profile.cadence * Math.PI * 2 * profile.direction + profile.phaseOffset;
    const wrappedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const phase = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(angle);
    const secondaryPhase = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(angle * 0.67 + Math.PI * 0.42);
    return {
      schema: 'axm.environment-choreography-pose/v1',
      environmentId: resolvedEnvironmentId,
      choreographyId: profile.id,
      choreographyLabel: profile.label,
      motion: profile.motion,
      reducedMotion: reduced,
      changesPerformance: false,
      changesAuthority: false,
      density: profile.density,
      phase: round(phase, 4),
      secondaryPhase: round(secondaryPhase, 4),
      rotationRad: round(reduced ? profile.phaseOffset : wrappedAngle, 4),
      drift: round(reduced ? 0 : Math.sin(angle * 0.83) * profile.drift, 4),
      glow: round(profile.baseGlow + phase * profile.glowRange, 4)
    };
  }
  function vehicleAnimationPose(racer, frameNow, stateNow, prefersReducedMotion) {
    const actor = racer || {};
    const rig = kineticRigFor(actor.characterId);
    const input = actor.input || {};
    const speed = Math.max(0, Number(actor.speed) || 0);
    const speedRatio = clamp(speed / BASE_STATS.maxSpeed, 0, 1.35);
    const throttle = clamp(input.throttle, 0, 1);
    const brake = clamp(input.brake, 0, 1);
    const steer = clamp(input.steer, -1, 1);
    const frameSeconds = Math.max(0, Number(frameNow) || 0) / 1000;
    const authorityNow = Number(stateNow) || 0;
    const reduced = Boolean(prefersReducedMotion);
    const motionScale = reduced ? 0.12 : 1;
    const boosting = authorityNow < (Number(actor.boostUntil) || 0);
    const impacted = authorityNow < (Number(actor.spinUntil) || 0);
    const drifting = Boolean(actor.drifting);
    const offRoad = Boolean(actor.offRoad);
    const cadence = rig.cadence * (1.35 + speedRatio * 8.2);
    const ridePhase = frameSeconds * cadence + rig.signatureOffset;
    const idlePhase = frameSeconds * rig.cadence * 2.1 + rig.signatureOffset;
    const roadPulse = Math.sin(ridePhase) * (0.28 + speedRatio * 1.42) * rig.ride;
    const idlePulse = Math.sin(idlePhase) * (speedRatio < 0.025 ? 0.34 : 0.08);
    const offRoadPulse = offRoad ? Math.sin(ridePhase * 2.7) * (0.7 + speedRatio * 1.2) : 0;
    const impactPulse = impacted ? Math.sin(frameSeconds * 28 + rig.signatureOffset) * 0.075 : 0;
    const driftRoll = drifting ? (Number(actor.driftDirection) || (steer < 0 ? -1 : 1)) * 0.052 : 0;
    const bodyRoll = motionScale * (-steer * (0.012 + speedRatio * 0.032) * rig.roll - driftRoll + impactPulse);
    const noseShift = motionScale * (brake * 1.7 - throttle * 0.62 - (boosting ? 1.18 : 0));
    const load = clamp(brake * 0.72 - throttle * 0.25 - (boosting ? 0.42 : 0), -0.72, 0.82);
    const signaturePhase = reduced ? 0.5 : (Math.sin(frameSeconds * rig.cadence * Math.PI * 2 + rig.signatureOffset) + 1) / 2;
    const energy = clamp(speedRatio * 0.68 + (boosting ? 0.32 : 0) + (drifting ? 0.18 : 0) + (impacted ? 0.2 : 0), 0, 1);
    let state = 'idle';
    if (impacted) state = 'impact';
    else if (boosting) state = 'boost';
    else if (drifting) state = 'drift';
    else if (brake > 0.35 && speedRatio > 0.08) state = 'brake';
    else if (speedRatio > 0.08) state = 'drive';
    return {
      schema: 'axm.vehicle-animation-pose/v1',
      rigId: rig.id,
      motion: rig.motion,
      characterId: String(actor.characterId || 'p1'),
      state,
      changesPerformance: false,
      reducedMotion: reduced,
      bodyLift: round(motionScale * (roadPulse + idlePulse + offRoadPulse), 4),
      bodyRoll: round(bodyRoll, 5),
      noseShift: round(noseShift, 4),
      wheelSpin: round(reduced ? 0 : frameSeconds * speed * 0.16, 4),
      wheelSteer: round(steer * 0.34, 4),
      frontTravel: round(motionScale * load * 1.8, 4),
      rearTravel: round(motionScale * -load * 1.25, 4),
      signaturePhase: round(signaturePhase, 4),
      energy: round(energy, 4)
    };
  }
  function resultStagePose(characterId, place, elapsedMs, prefersReducedMotion) {
    const moment = resultStageMomentFor(characterId);
    const position = Math.round(clamp(place, 1, 4));
    const elapsed = Math.max(0, Number(elapsedMs) || 0);
    const reduced = Boolean(prefersReducedMotion);
    const delay = (position - 1) * 85;
    const entranceProgress = reduced ? 1 : clamp((elapsed - delay) / 520, 0, 1);
    const eased = 1 - Math.pow(1 - entranceProgress, 3);
    const phase = elapsed / 1000 * moment.cadence * Math.PI * 2 + moment.phaseOffset;
    const rankEnergy = (5 - position) / 4;
    const winnerScale = position === 1 ? 0.035 : 0;
    const floating = Math.sin(phase) * moment.float * rankEnergy * eased;
    const rolling = (1 - eased) * moment.entryRoll + Math.sin(phase * 0.72) * moment.roll * eased;
    const pulse = position === 1 ? Math.sin(phase * 0.5) * 0.006 * eased : 0;
    return {
      schema: 'axm.result-stage-pose/v1',
      characterId: String(characterId || 'p1'),
      momentId: moment.id,
      momentLabel: moment.label,
      motion: moment.motion,
      place: position,
      reducedMotion: reduced,
      changesPerformance: false,
      changesAuthority: false,
      entranceProgress: round(entranceProgress, 4),
      lift: reduced ? 0 : round((1 - eased) * 16 - floating, 4),
      rollDeg: reduced ? 0 : round(rolling, 4),
      scale: round(reduced ? 1 + winnerScale : 0.95 + eased * 0.05 + winnerScale + pulse, 4),
      opacity: round(reduced ? 1 : 0.22 + eased * 0.78, 4),
      glow: round(0.18 + rankEnergy * 0.34 + (position === 1 ? 0.18 : 0) + (reduced ? 0 : Math.max(0, Math.sin(phase)) * 0.08 * eased), 4)
    };
  }
  function startGridPose(characterId, seat, elapsedMs, prefersReducedMotion) {
    const moment = startGridMomentFor(characterId);
    const position = Math.round(clamp(seat, 1, 4));
    const elapsed = Math.max(0, Number(elapsedMs) || 0);
    const reduced = Boolean(prefersReducedMotion);
    const delay = (position - 1) * 72;
    const entranceProgress = reduced ? 1 : clamp((elapsed - delay) / 430, 0, 1);
    const eased = 1 - Math.pow(1 - entranceProgress, 3);
    const phase = elapsed / 1000 * moment.cadence * Math.PI * 2 + moment.phaseOffset;
    const floating = Math.sin(phase) * moment.float * eased;
    const rolling = (1 - eased) * moment.entryRoll + Math.sin(phase * 0.68) * 0.42 * eased;
    const pulse = Math.max(0, Math.sin(phase)) * 0.006 * eased;
    return {
      schema: 'axm.start-grid-pose/v1',
      characterId: String(characterId || 'p1'),
      momentId: moment.id,
      momentLabel: moment.label,
      motion: moment.motion,
      seat: position,
      reducedMotion: reduced,
      changesPerformance: false,
      changesAuthority: false,
      entranceProgress: round(entranceProgress, 4),
      lift: reduced ? 0 : round((1 - eased) * 18 - floating, 4),
      rollDeg: reduced ? 0 : round(rolling, 4),
      scale: round(reduced ? 1 : 0.94 + eased * 0.06 + pulse, 4),
      opacity: round(reduced ? 1 : 0.18 + eased * 0.82, 4),
      glow: round(0.2 + position * 0.035 + (reduced ? 0 : Math.max(0, Math.sin(phase)) * 0.1 * eased), 4)
    };
  }
  function angleDelta(target, current) {
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }
  function interpolatePresentationPose(previous, current, alpha, snapDistance) {
    const next = current || {};
    const currentX = Number(next.x);
    const currentY = Number(next.y);
    const currentHeading = Number(next.heading);
    const fallback = {
      x: Number.isFinite(currentX) ? currentX : 0,
      y: Number.isFinite(currentY) ? currentY : 0,
      heading: Number.isFinite(currentHeading) ? currentHeading : 0,
      interpolated: false,
      snapped: true
    };
    if (!previous || !Number.isFinite(Number(previous.x)) || !Number.isFinite(Number(previous.y)) || !Number.isFinite(Number(previous.heading))) return fallback;
    const priorX = Number(previous.x);
    const priorY = Number(previous.y);
    const priorHeading = Number(previous.heading);
    const dx = fallback.x - priorX;
    const dy = fallback.y - priorY;
    const limit = Math.max(1, Number(snapDistance) || 180);
    if (dx * dx + dy * dy > limit * limit) return fallback;
    const t = clamp(alpha, 0, 1);
    return {
      x: priorX + dx * t,
      y: priorY + dy * t,
      heading: priorHeading + angleDelta(fallback.heading, priorHeading) * t,
      interpolated: t < 1 && (Math.abs(dx) > .001 || Math.abs(dy) > .001 || Math.abs(angleDelta(fallback.heading, priorHeading)) > .001),
      snapped: false
    };
  }
  function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
  function driftTierForCharge(charge) {
    const value = clamp(charge, 0, 1);
    if (value >= METRICS.driftTierThresholds[2]) return 3;
    if (value >= METRICS.driftTierThresholds[1]) return 2;
    if (value >= METRICS.driftTierThresholds[0]) return 1;
    return 0;
  }
  function normalizeAssists(value) {
    const source = value || {};
    return {
      steering: source.steering === true || Number(source.steering) > 0 ? ASSIST_CONTRACT.steeringStrength : 0,
      autoAccelerate: source.autoAccelerate === true
    };
  }
  function nextRandom(state) {
    state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
    return state.rng / 4294967296;
  }

  function hydrateTrack(definition) {
    const points = definition.points;
    const shortcuts = (definition.shortcuts || []).map(shortcut => Object.assign({}, shortcut, {
      from: points[shortcut.entryIndex],
      to: points[shortcut.exitIndex]
    }));
    const hazards = (definition.hazards || []).map(hazard => {
      if (hazard.shortcutId) {
        const shortcut = shortcuts.find(item => item.id === hazard.shortcutId);
        if (shortcut) return Object.assign({}, hazard, {
          x: round((shortcut.from.x + shortcut.to.x) * .5, 2),
          y: round((shortcut.from.y + shortcut.to.y) * .5, 2)
        });
      }
      return Object.assign({}, hazard, points[hazard.index]);
    });
    const track = Object.assign({}, definition, {
      points,
      padIndices: definition.padIndices || [11, 23, 36, 49, 63, 77, 91, 105, 119, 133, 147, 162],
      shortcuts,
      hazards
    });
    return track;
  }

  function buildTrack(pointCount) {
    const count = pointCount || 176;
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const theta = index / count * Math.PI * 2;
      const radial = 1 + 0.11 * Math.sin(theta * 3 + 0.35) + 0.035 * Math.cos(theta * 5);
      points.push({
        x: round(640 + Math.cos(theta) * 430 * radial, 2),
        y: round(400 + Math.sin(theta) * 258 * (1 + 0.08 * Math.cos(theta * 2 - 0.5)), 2)
      });
    }
    return hydrateTrack({
      id: TRACK_IDS.FORGE,
      name: 'Mirror Forge',
      subtitle: 'Flow circuit · phase gates · core-cut shortcut',
      width: 1280,
      height: 800,
      roadWidth: METRICS.roadWidth,
      points,
      theme: { background: '#050817', center: '#171238', grid: '#6675ff', glow: '#35f2ff', shoulder: '#252849', road: '#111630', lane: '#8b9dd5', accent: '#ff4fbd', label: '#7783aa' },
      landmarks: [
        { type: 'core', x: 640, y: 400, label: 'MIRROR FORGE' },
        { type: 'gate', x: 325, y: 224, rotation: -.58 },
        { type: 'gate', x: 952, y: 565, rotation: -.58 }
      ],
      shortcuts: [{ id: 'core-cut', name: 'Core Cut', entryIndex: 104, exitIndex: 132, width: 54, risk: 'phase shear' }],
      hazards: [
        { id: 'forge-gate-a', type: 'phase-gate', index: 42, radius: 38, periodMs: 3100, activeMs: 1500, phaseOffset: 0, speedFactor: .46, spinMs: 360 },
        { id: 'forge-gate-b', type: 'phase-gate', index: 152, radius: 38, periodMs: 3100, activeMs: 1500, phaseOffset: 1550, speedFactor: .46, spinMs: 360 },
        { id: 'forge-core-shear', type: 'phase-shear', shortcutId: 'core-cut', radius: 32, periodMs: 2700, activeMs: 950, phaseOffset: 700, speedFactor: .52, spinMs: 260 }
      ]
    });
  }

  function buildSplitglassTrack(pointCount) {
    const count = pointCount || 176;
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const theta = index / count * Math.PI * 2;
      points.push({
        x: round(640 + Math.cos(theta) * 385 + Math.cos(theta * 2 + .45) * 72, 2),
        y: round(400 + Math.sin(theta) * 248 + Math.sin(theta * 3 - .4) * 38, 2)
      });
    }
    return hydrateTrack({
      id: TRACK_IDS.GARDENS,
      name: 'Splitglass Gardens',
      subtitle: 'Petal bends · prism blooms · greenhouse slipstream',
      width: 1280,
      height: 800,
      roadWidth: 104,
      points,
      theme: { background: '#04131a', center: '#0c2d32', grid: '#2d9c8c', glow: '#59ffd0', shoulder: '#18383d', road: '#0a252d', lane: '#8cdccc', accent: '#b982ff', label: '#78c9b7' },
      landmarks: [
        { type: 'garden', x: 640, y: 400, label: 'SPLITGLASS' },
        { type: 'crystal', x: 414, y: 397, rotation: -.2 },
        { type: 'crystal', x: 868, y: 399, rotation: .25 }
      ],
      shortcuts: [{ id: 'greenhouse-slip', name: 'Greenhouse Slip', entryIndex: 8, exitIndex: 36, width: 48, risk: 'prism shear' }],
      hazards: [
        { id: 'prism-bloom-a', type: 'prism-bloom', index: 72, radius: 44, periodMs: 3600, activeMs: 1750, phaseOffset: 400, speedFactor: .5, spinMs: 240 },
        { id: 'prism-bloom-b', type: 'prism-bloom', index: 151, radius: 44, periodMs: 3600, activeMs: 1750, phaseOffset: 2200, speedFactor: .5, spinMs: 240 },
        { id: 'greenhouse-prism', type: 'prism-shear', shortcutId: 'greenhouse-slip', radius: 31, periodMs: 2500, activeMs: 850, phaseOffset: 1150, speedFactor: .58, spinMs: 210 }
      ]
    });
  }

  function signedPower(value, exponent) {
    return Math.sign(value) * Math.pow(Math.abs(value), exponent);
  }

  function buildNullFoundryTrack(pointCount) {
    const count = pointCount || 176;
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const theta = index / count * Math.PI * 2;
      points.push({
        x: round(640 + signedPower(Math.cos(theta), .48) * 438 + Math.sin(theta * 3) * 13, 2),
        y: round(400 + signedPower(Math.sin(theta), .56) * 262 + Math.cos(theta * 4 + .2) * 12, 2)
      });
    }
    return hydrateTrack({
      id: TRACK_IDS.FOUNDRY,
      name: 'Null Foundry',
      subtitle: 'Hard corners · heat vents · magnetic service lane',
      width: 1280,
      height: 800,
      roadWidth: 118,
      points,
      theme: { background: '#160805', center: '#35170e', grid: '#a84d24', glow: '#ff9f43', shoulder: '#4a291d', road: '#28150f', lane: '#d0a071', accent: '#ff3d6e', label: '#c9875d' },
      landmarks: [
        { type: 'foundry', x: 640, y: 400, label: 'NULL FOUNDRY' },
        { type: 'stack', x: 402, y: 309, rotation: 0 },
        { type: 'stack', x: 876, y: 492, rotation: Math.PI }
      ],
      shortcuts: [{ id: 'mag-rail', name: 'Mag-Rail Service Lane', entryIndex: 101, exitIndex: 128, width: 52, risk: 'mag flare' }],
      hazards: [
        { id: 'heat-vent-a', type: 'heat-vent', index: 57, radius: 42, periodMs: 2900, activeMs: 1350, phaseOffset: 250, speedFactor: .38, spinMs: 420 },
        { id: 'heat-vent-b', type: 'heat-vent', index: 138, radius: 42, periodMs: 2900, activeMs: 1350, phaseOffset: 1700, speedFactor: .38, spinMs: 420 },
        { id: 'mag-flare', type: 'mag-flare', shortcutId: 'mag-rail', radius: 33, periodMs: 2600, activeMs: 900, phaseOffset: 900, speedFactor: .5, spinMs: 300 }
      ]
    });
  }

  const TRACK = buildTrack();
  const TRACKS = Object.freeze({
    [TRACK_IDS.FORGE]: TRACK,
    [TRACK_IDS.GARDENS]: buildSplitglassTrack(),
    [TRACK_IDS.FOUNDRY]: buildNullFoundryTrack()
  });
  function reverseTrackIndex(index, count) {
    const normalized = ((Math.round(Number(index) || 0) % count) + count) % count;
    return normalized === 0 ? 0 : count - normalized;
  }

  function buildReflectionTrack(track) {
    const count = track.points.length;
    const points = [track.points[0]].concat(track.points.slice(1).reverse());
    const padIndices = (track.padIndices || []).map(index => reverseTrackIndex(index, count)).sort((a, b) => a - b);
    const shortcuts = (track.shortcuts || []).map(shortcut => {
      const reflected = Object.assign({}, shortcut, {
        entryIndex: reverseTrackIndex(shortcut.exitIndex, count),
        exitIndex: reverseTrackIndex(shortcut.entryIndex, count)
      });
      delete reflected.from;
      delete reflected.to;
      return reflected;
    });
    const hazards = (track.hazards || []).map(hazard => {
      const reflected = Object.assign({}, hazard);
      if (Number.isInteger(hazard.index)) reflected.index = reverseTrackIndex(hazard.index, count);
      delete reflected.x;
      delete reflected.y;
      return reflected;
    });
    return hydrateTrack(Object.assign({}, track, {
      points,
      padIndices,
      shortcuts,
      hazards,
      routeDirectionId: ROUTE_DIRECTION_IDS.REFLECTION
    }));
  }

  const REFLECTION_TRACKS = Object.freeze(Object.fromEntries(Object.entries(TRACKS).map(([trackId, track]) => [trackId, buildReflectionTrack(track)])));

  function trackFor(trackId, directionId) {
    const id = TRACKS[String(trackId || '')] ? String(trackId) : TRACK_IDS.FORGE;
    return routeDirectionFor(directionId).id === ROUTE_DIRECTION_IDS.REFLECTION ? REFLECTION_TRACKS[id] : TRACKS[id];
  }

  const TRACK_CATALOG = Object.freeze(Object.values(TRACKS).map(track => Object.freeze({
    id: track.id,
    name: track.name,
    subtitle: track.subtitle,
    roadWidth: track.roadWidth,
    hazardCount: track.hazards.length,
    shortcutCount: track.shortcuts.length
  })));
  const BATTLE_ARENA = Object.freeze({
    id: 'mirror-core-arena',
    name: 'Mirror Core Arena',
    width: 1280,
    height: 800,
    centerX: 640,
    centerY: 400,
    radiusX: 510,
    radiusY: 315,
    roadWidth: 630,
    points: Object.freeze(Array.from({ length: 96 }, (_, index) => {
      const theta = index / 96 * Math.PI * 2;
      return Object.freeze({ x: round(640 + Math.cos(theta) * 455, 2), y: round(400 + Math.sin(theta) * 270, 2) });
    }))
  });
  const BATTLE_SPAWNS = Object.freeze([
    Object.freeze({ x: 318, y: 232, heading: 0.46 }),
    Object.freeze({ x: 962, y: 232, heading: Math.PI - 0.46 }),
    Object.freeze({ x: 318, y: 568, heading: -0.46 }),
    Object.freeze({ x: 962, y: 568, heading: Math.PI + 0.46 })
  ]);

  function normalizeRoster(rawRoster) {
    const source = Array.isArray(rawRoster) ? rawRoster.slice(0, 4) : [];
    return RACERS.map((character, index) => {
      const seat = source[index] || {};
      const type = String(seat.type || (index === 0 && !source.length ? 'human' : 'ai')).toLowerCase();
      return {
        id: character.id,
        seatId: String(seat.seat_id || seat.seatId || 'seat_' + (index + 1)),
        displayName: String(seat.display_name || seat.displayName || character.name).slice(0, 32),
        type: type === 'human' ? 'human' : 'ai'
      };
    });
  }

  function normalizeCharacterAssignments(rawAssignments) {
    const requested = rawAssignments && typeof rawAssignments === 'object' ? rawAssignments : {};
    const known = new Set(RACERS.map(character => character.id));
    const used = new Set();
    const assignments = {};
    RACERS.forEach(character => {
      const requestedId = String(requested[character.id] || character.id);
      if (known.has(requestedId) && !used.has(requestedId)) {
        assignments[character.id] = requestedId;
        used.add(requestedId);
      }
    });
    RACERS.forEach(character => {
      if (assignments[character.id]) return;
      const available = RACERS.find(candidate => !used.has(candidate.id));
      assignments[character.id] = available.id;
      used.add(available.id);
    });
    return assignments;
  }

  function applyCharacterIdentity(racer, character) {
    const expression = characterExpressionFor(character.id);
    racer.characterId = character.id;
    racer.character = character.name;
    racer.title = character.title;
    racer.vehicle = character.vehicle;
    racer.color = character.color;
    racer.accent = character.accent;
    racer.dark = character.dark;
    racer.portrait = character.portrait;
    racer.signature = character.signature;
    racer.bio = character.bio;
    racer.expressionId = expression.id;
    racer.expressionLabel = expression.label;
    racer.signatureQuote = expression.quote;
    return racer;
  }

  function createRacer(character, seat, index, track, assistProfile) {
    const raceTrack = track || TRACK;
    const count = raceTrack.points.length;
    const trackIndex = 8 - index * 2;
    const point = raceTrack.points[trackIndex];
    const ahead = raceTrack.points[(trackIndex + 2) % count];
    const lateral = index % 2 ? 13 : -13;
    const tangent = Math.atan2(ahead.y - point.y, ahead.x - point.x);
    const racer = {
      id: seat.id,
      displayName: seat.displayName,
      seatId: seat.seatId,
      ai: seat.type !== 'human',
      x: point.x + Math.cos(tangent + Math.PI / 2) * lateral,
      y: point.y + Math.sin(tangent + Math.PI / 2) * lateral,
      heading: tangent,
      speed: 0,
      trackIndex,
      lastTrackIndex: trackIndex,
      lap: 0,
      lapCheckpoint: 0,
      progress: trackIndex / count,
      rank: index + 1,
      catchup: METRICS.catchupByRank[index],
      shield: METRICS.shieldMax,
      item: null,
      input: { throttle: 0, brake: 0, steer: 0 },
      assists: normalizeAssists(assistProfile),
      assistActive: { steering: false, autoAccelerate: false },
      lastInputAt: 0,
      lastSeq: -1,
      hitCooldownUntil: 0,
      spinUntil: 0,
      boostUntil: 0,
      boostPower: 1,
      drifting: false,
      driftCharge: 0,
      driftTier: 0,
      driftDirection: 0,
      driftStartedAt: 0,
      driftReleasedAt: 0,
      itemCooldownUntil: 0,
      aiItemAt: 0,
      finishedAt: null,
      finishPlace: null,
      offRoad: false,
      score: 0,
      guardBreaks: 0,
      knockouts: 0,
      timesWiped: 0,
      respawnAt: 0,
      spawnProtectionUntil: 0,
      spawnIndex: index,
      activeShortcutId: null,
      shortcutTargetId: null,
      hazardCooldownUntil: 0,
      stats: { hits: 0, attacks: 0, repairs: 0, pickups: 0, drifts: 0, bestDriftTier: 0, driftBoostMs: 0, respawns: 0, shortcuts: 0, hazardsHit: 0 }
    };
    return applyCharacterIdentity(racer, character);
  }

  function createItemPads(track) {
    const raceTrack = track || TRACK;
    const indices = raceTrack.padIndices;
    return indices.map((trackIndex, index) => {
      const p = raceTrack.points[trackIndex];
      return { id: 'pad-' + (index + 1), trackIndex, x: p.x, y: p.y, active: true, respawnAt: 0 };
    });
  }

  function createBattlePads() {
    const positions = [
      [640, 184], [856, 232], [1020, 400], [856, 568],
      [640, 616], [424, 568], [260, 400], [424, 232],
      [640, 302], [738, 400], [640, 498], [542, 400]
    ];
    return positions.map((position, index) => ({
      id: 'core-pad-' + (index + 1),
      trackIndex: index * 8,
      x: position[0],
      y: position[1],
      active: true,
      respawnAt: 0
    }));
  }

  function placeRacerForMode(racer, index, mode, track) {
    if (mode === MODES.BATTLE) {
      const spawn = BATTLE_SPAWNS[index % BATTLE_SPAWNS.length];
      racer.x = spawn.x;
      racer.y = spawn.y;
      racer.heading = spawn.heading;
      racer.trackIndex = index * 24;
      racer.lastTrackIndex = racer.trackIndex;
      racer.progress = 0;
      racer.lap = 0;
      racer.lapCheckpoint = 0;
      return;
    }
    const raceTrack = track || TRACK;
    const count = raceTrack.points.length;
    const trackIndex = 8 - index * 2;
    const point = raceTrack.points[trackIndex];
    const ahead = raceTrack.points[(trackIndex + 2) % count];
    const lateral = index % 2 ? 13 : -13;
    const tangent = Math.atan2(ahead.y - point.y, ahead.x - point.x);
    racer.x = point.x + Math.cos(tangent + Math.PI / 2) * lateral;
    racer.y = point.y + Math.sin(tangent + Math.PI / 2) * lateral;
    racer.heading = tangent;
    racer.trackIndex = trackIndex;
    racer.lastTrackIndex = trackIndex;
    racer.progress = trackIndex / count;
    racer.lap = 0;
    racer.lapCheckpoint = 0;
  }

  function resetRacerForRound(racer, index, mode, track, now) {
    placeRacerForMode(racer, index, mode, track);
    racer.speed = 0;
    racer.rank = index + 1;
    racer.catchup = METRICS.catchupByRank[index];
    racer.shield = METRICS.shieldMax;
    racer.item = null;
    racer.input = { throttle: 0, brake: 0, steer: 0 };
    racer.assistActive = { steering: false, autoAccelerate: false };
    racer.lastInputAt = Number(now || 0);
    racer.hitCooldownUntil = 0;
    racer.spinUntil = 0;
    racer.boostUntil = 0;
    racer.boostPower = 1;
    racer.drifting = false;
    racer.driftCharge = 0;
    racer.driftTier = 0;
    racer.driftDirection = 0;
    racer.driftStartedAt = 0;
    racer.driftReleasedAt = 0;
    racer.itemCooldownUntil = 0;
    racer.aiItemAt = 0;
    racer.finishedAt = null;
    racer.finishPlace = null;
    racer.offRoad = false;
    racer.score = 0;
    racer.guardBreaks = 0;
    racer.knockouts = 0;
    racer.timesWiped = 0;
    racer.respawnAt = 0;
    racer.spawnProtectionUntil = 0;
    racer.activeShortcutId = null;
    racer.shortcutTargetId = null;
    racer.hazardCooldownUntil = 0;
    racer.stats = { hits: 0, attacks: 0, repairs: 0, pickups: 0, drifts: 0, bestDriftTier: 0, driftBoostMs: 0, respawns: 0, shortcuts: 0, hazardsHit: 0 };
  }

  function createInitialState(rawRoster, options) {
    const settings = options || {};
    const roster = normalizeRoster(rawRoster);
    const characterAssignments = normalizeCharacterAssignments(settings.characterAssignments);
    const mode = settings.mode === MODES.BATTLE ? MODES.BATTLE : settings.mode === MODES.TOUR ? MODES.TOUR : MODES.RACE;
    const tourRound = mode === MODES.TOUR ? signalTourRound(0) : null;
    const trackId = tourRound ? tourRound.trackId : TRACKS[settings.trackId] ? settings.trackId : TRACK_IDS.FORGE;
    const variant = raceVariantFor(tourRound ? tourRound.variantId : settings.variantId);
    const routeDirectionId = tourRound ? ROUTE_DIRECTION_IDS.FORWARD : routeDirectionFor(settings.routeDirectionId).id;
    const raceTrack = trackFor(trackId, routeDirectionId);
    const state = {
      schema: 'axm.mirrorshift-state/v7',
      gameId: GAME_ID,
      mode,
      trackId,
      variantId: variant.id,
      routeDirectionId,
      raceLaps: variant.laps,
      phase: PHASES.LOBBY,
      seed: Number.isFinite(Number(settings.seed)) ? Number(settings.seed) : 15015,
      rng: Number.isFinite(Number(settings.seed)) ? Number(settings.seed) >>> 0 : 15015,
      now: Number(settings.now || 0),
      countdownEndsAt: 0,
      raceStartedAt: 0,
      battleEndsAt: 0,
      winnerAt: 0,
      result: null,
      tour: mode === MODES.TOUR ? createSignalTour() : null,
      tick: 0,
      racers: {},
      ranking: RACERS.map(item => item.id),
      track: mode === MODES.BATTLE ? BATTLE_ARENA : raceTrack,
      pads: mode === MODES.BATTLE ? createBattlePads() : createItemPads(raceTrack),
      projectiles: [],
      mines: [],
      effects: [],
      events: [],
      nextEntityId: 1
    };
    RACERS.forEach((seatDefinition, index) => {
      const character = RACERS.find(candidate => candidate.id === characterAssignments[seatDefinition.id]);
      state.racers[seatDefinition.id] = createRacer(character, roster[index], index, raceTrack, settings.assists && settings.assists[seatDefinition.id]);
      placeRacerForMode(state.racers[seatDefinition.id], index, mode, raceTrack);
    });
    pushEvent(state, 'ready', mode === MODES.BATTLE
      ? 'Mirror Core ready. Break guards, force wipes, own the arena.'
      : variant.label + ' ready. ' + variant.format.replace(' // ', ' · ') + '. Equal machines.', state.now, {
        variantId: variant.id,
        raceLaps: variant.laps,
        routeDirectionId
      });
    if (mode === MODES.TOUR) pushEvent(state, 'tour', 'SIGNAL TOUR ready · Round 1 of ' + SIGNAL_TOUR.rounds.length + ' · ' + raceTrack.name + ' · ' + variant.label, state.now, { tourRound: 1 });
    updateRanking(state);
    return state;
  }

  function pushEvent(state, type, text, now, metadata) {
    state.events.push(Object.assign({ id: state.nextEntityId++, type, text, at: Number(now || state.now) }, metadata || {}));
    if (state.events.length > 14) state.events.splice(0, state.events.length - 14);
  }

  function setCharacter(state, racerId, requestedCharacterId, now) {
    const racer = state && state.racers && state.racers[String(racerId || '')];
    const character = RACERS.find(candidate => candidate.id === String(requestedCharacterId || ''));
    if (!racer) return { ok: false, reason: 'unknown-racer' };
    if (!character) return { ok: false, reason: 'unknown-character' };
    if (state.phase !== PHASES.LOBBY) return { ok: false, reason: 'character-locked' };
    state.now = Number(now == null ? state.now : now);
    if (racer.characterId === character.id) {
      return { ok: true, racerId: racer.id, characterId: character.id, swappedWith: null };
    }
    const previousCharacter = RACERS.find(candidate => candidate.id === racer.characterId);
    const occupant = Object.values(state.racers).find(candidate => candidate.characterId === character.id);
    applyCharacterIdentity(racer, character);
    if (occupant && occupant.id !== racer.id) applyCharacterIdentity(occupant, previousCharacter);
    pushEvent(state, 'character', 'P' + racer.id.slice(1) + ' chose ' + character.name.toUpperCase() + (occupant ? ' · P' + occupant.id.slice(1) + ' takes ' + previousCharacter.name.toUpperCase() : ''), state.now, {
      racerId: racer.id,
      characterId: character.id,
      expressionId: characterExpressionFor(character.id).id
    });
    return { ok: true, racerId: racer.id, characterId: character.id, swappedWith: occupant && occupant.id !== racer.id ? occupant.id : null };
  }

  function setMode(state, requestedMode, now) {
    const mode = requestedMode === MODES.BATTLE ? MODES.BATTLE : requestedMode === MODES.TOUR ? MODES.TOUR : requestedMode === MODES.RACE ? MODES.RACE : null;
    if (!state || !mode) return { ok: false, reason: 'unsupported-mode' };
    if (state.phase !== PHASES.LOBBY) return { ok: false, reason: 'mode-locked' };
    state.mode = mode;
    state.now = Number(now == null ? state.now : now);
    if (mode === MODES.TOUR) {
      const tourRound = signalTourRound(0);
      state.tour = createSignalTour();
      state.trackId = tourRound.trackId;
      state.variantId = tourRound.variantId;
      state.routeDirectionId = ROUTE_DIRECTION_IDS.FORWARD;
      state.raceLaps = raceVariantFor(tourRound.variantId).laps;
    } else state.tour = null;
    const raceTrack = trackFor(state.trackId, state.routeDirectionId);
    state.track = mode === MODES.BATTLE ? BATTLE_ARENA : raceTrack;
    state.pads = mode === MODES.BATTLE ? createBattlePads() : createItemPads(raceTrack);
    state.projectiles = [];
    state.mines = [];
    state.effects = [];
    Object.values(state.racers).forEach((racer, index) => {
      placeRacerForMode(racer, index, mode, raceTrack);
      racer.speed = 0;
      racer.rank = index + 1;
      racer.catchup = METRICS.catchupByRank[index];
      racer.shield = METRICS.shieldMax;
      racer.item = null;
      racer.score = 0;
      racer.guardBreaks = 0;
      racer.knockouts = 0;
      racer.timesWiped = 0;
      racer.respawnAt = 0;
      racer.spawnProtectionUntil = 0;
      racer.finishedAt = null;
      racer.finishPlace = null;
      racer.drifting = false;
      racer.driftCharge = 0;
      racer.driftTier = 0;
      racer.activeShortcutId = null;
      racer.shortcutTargetId = null;
      racer.hazardCooldownUntil = 0;
      racer.input = { throttle: 0, brake: 0, steer: 0 };
    });
    updateRanking(state);
    pushEvent(state, 'mode', mode === MODES.BATTLE ? 'MIRROR CORE selected · 90% attacks' : mode === MODES.TOUR ? 'SIGNAL TOUR selected · three server-owned rounds' : 'CIRCUIT CROWN selected · ' + state.raceLaps + ' laps', state.now);
    return { ok: true, mode };
  }

  function setTrack(state, requestedTrackId, now) {
    const trackId = String(requestedTrackId || '');
    if (!state || !TRACKS[trackId]) return { ok: false, reason: 'unsupported-track' };
    if (state.phase !== PHASES.LOBBY) return { ok: false, reason: 'track-locked' };
    if (state.mode === MODES.TOUR) return { ok: false, reason: 'tour-itinerary' };
    if (state.mode !== MODES.RACE) return { ok: false, reason: 'battle-mode' };
    const track = trackFor(trackId, state.routeDirectionId);
    state.trackId = track.id;
    state.track = track;
    state.pads = createItemPads(track);
    state.projectiles = [];
    state.mines = [];
    state.effects = [];
    state.now = Number(now == null ? state.now : now);
    Object.values(state.racers).forEach((racer, index) => {
      placeRacerForMode(racer, index, MODES.RACE, track);
      racer.speed = 0;
      racer.item = null;
      racer.activeShortcutId = null;
      racer.shortcutTargetId = null;
      racer.hazardCooldownUntil = 0;
    });
    updateRanking(state);
    pushEvent(state, 'track', track.name + ' selected · ' + track.subtitle, state.now);
    return { ok: true, trackId: track.id };
  }

  function setRouteDirection(state, requestedDirectionId, now) {
    const direction = ROUTE_DIRECTIONS[String(requestedDirectionId || '')];
    if (!state || !direction) return { ok: false, reason: 'unsupported-route-direction' };
    if (state.phase !== PHASES.LOBBY) return { ok: false, reason: 'route-direction-locked' };
    if (state.mode === MODES.TOUR) return { ok: false, reason: 'tour-itinerary' };
    if (state.mode !== MODES.RACE) return { ok: false, reason: 'battle-mode' };
    state.routeDirectionId = direction.id;
    state.track = trackFor(state.trackId, direction.id);
    state.pads = createItemPads(state.track);
    state.projectiles = [];
    state.mines = [];
    state.effects = [];
    state.now = Number(now == null ? state.now : now);
    Object.values(state.racers).forEach((racer, index) => {
      placeRacerForMode(racer, index, MODES.RACE, state.track);
      racer.speed = 0;
      racer.item = null;
      racer.finishedAt = null;
      racer.finishPlace = null;
      racer.activeShortcutId = null;
      racer.shortcutTargetId = null;
      racer.hazardCooldownUntil = 0;
    });
    updateRanking(state);
    pushEvent(state, 'route-direction', direction.label + ' selected · finish line fixed · equal stats unchanged', state.now, {
      routeDirectionId: direction.id,
      changesVehicleStats: false,
      changesCatchup: false
    });
    return { ok: true, routeDirectionId: direction.id };
  }

  function setRaceVariant(state, requestedVariantId, now) {
    const variant = RACE_VARIANTS[String(requestedVariantId || '')];
    if (!state || !variant) return { ok: false, reason: 'unsupported-variant' };
    if (state.phase !== PHASES.LOBBY) return { ok: false, reason: 'variant-locked' };
    if (state.mode === MODES.TOUR) return { ok: false, reason: 'tour-itinerary' };
    if (state.mode !== MODES.RACE) return { ok: false, reason: 'battle-mode' };
    state.variantId = variant.id;
    state.raceLaps = variant.laps;
    state.now = Number(now == null ? state.now : now);
    state.projectiles = [];
    state.mines = [];
    state.effects = [];
    Object.values(state.racers).forEach((racer, index) => {
      placeRacerForMode(racer, index, MODES.RACE, state.track);
      racer.speed = 0;
      racer.item = null;
      racer.finishedAt = null;
      racer.finishPlace = null;
      racer.activeShortcutId = null;
      racer.shortcutTargetId = null;
      racer.hazardCooldownUntil = 0;
    });
    updateRanking(state);
    pushEvent(state, 'variant', variant.label + ' selected · ' + variant.format + ' · equal stats unchanged', state.now, {
      variantId: variant.id,
      raceLaps: variant.laps,
      changesVehicleStats: false,
      changesCatchup: false
    });
    return { ok: true, variantId: variant.id, raceLaps: variant.laps };
  }

  function setAssists(state, racerId, requested, now) {
    const racer = state && state.racers && state.racers[String(racerId || '')];
    if (!racer) return { ok: false, reason: 'unknown-racer' };
    if (state.phase !== PHASES.LOBBY) return { ok: false, reason: 'assists-locked' };
    racer.assists = normalizeAssists(requested);
    racer.assistActive = { steering: false, autoAccelerate: false };
    state.now = Number(now == null ? state.now : now);
    const enabled = [];
    if (racer.assists.steering) enabled.push('LIGHT STEERING');
    if (racer.assists.autoAccelerate) enabled.push('AUTO ACCELERATE');
    pushEvent(state, 'assist', racer.character + ' assists: ' + (enabled.length ? enabled.join(' + ') : 'OFF') + ' · equal stats unchanged', state.now);
    return { ok: true, racerId: racer.id, assists: Object.assign({}, racer.assists) };
  }

  function startRace(state, now) {
    if (!state || state.phase !== PHASES.LOBBY) return { ok: false, reason: 'not-in-lobby' };
    state.now = Number(now || state.now);
    state.phase = PHASES.COUNTDOWN;
    state.countdownEndsAt = state.now + METRICS.countdownMs;
    pushEvent(state, 'countdown', state.mode === MODES.BATTLE
      ? 'Mirror Core charged. Guards online. 90% attack pool.'
      : raceVariantFor(state.variantId).label + ' armed. ' + state.raceLaps + ' laps. Attack pool set to 85%.', state.now, {
        racerId: 'p1',
        characterId: state.racers.p1.characterId,
        expressionId: state.racers.p1.expressionId,
        variantId: state.variantId,
        routeDirectionId: state.routeDirectionId,
        raceLaps: state.raceLaps
      });
    return { ok: true };
  }

  function chooseItem(state) {
    const roll = nextRandom(state) * 100;
    let cursor = 0;
    const weights = state.mode === MODES.BATTLE ? BATTLE_POWERUP_WEIGHTS : POWERUP_WEIGHTS;
    for (const item of weights) {
      cursor += item.weight;
      if (roll < cursor) return item.id;
    }
    return 'bolt';
  }

  function findNearestTrackPoint(racer, track) {
    const raceTrack = track || TRACK;
    const originIndex = racer.trackIndex || 0;
    let bestIndex = originIndex;
    let bestDistance = Infinity;
    const count = raceTrack.points.length;
    const searchRadius = 18;
    for (let offset = -searchRadius; offset <= searchRadius; offset += 1) {
      const index = (originIndex + offset + count) % count;
      const point = raceTrack.points[index];
      const dx = racer.x - point.x;
      const dy = racer.y - point.y;
      const value = dx * dx + dy * dy;
      if (value < bestDistance) {
        bestDistance = value;
        bestIndex = index;
      }
    }
    if (bestDistance > 240 * 240) {
      for (let index = 0; index < count; index += 1) {
        const point = raceTrack.points[index];
        const value = distanceSquared(racer, point);
        if (value < bestDistance) { bestDistance = value; bestIndex = index; }
      }
    }
    return { index: bestIndex, distance: Math.sqrt(bestDistance) };
  }

  function pointToSegment(point, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const t = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared, 0, 1);
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    const px = point.x - x;
    const py = point.y - y;
    return { distance: Math.sqrt(px * px + py * py), t, x, y };
  }

  function forwardIndexDistance(from, to, count) {
    return (to - from + count) % count;
  }

  function findShortcut(track, shortcutId) {
    return (track.shortcuts || []).find(shortcut => shortcut.id === shortcutId) || null;
  }

  function shortcutStatus(racer, track) {
    const shortcut = findShortcut(track, racer.activeShortcutId || racer.shortcutTargetId);
    if (!shortcut) return null;
    return { shortcut, segment: pointToSegment(racer, shortcut.from, shortcut.to) };
  }

  function hazardActive(hazard, now, variantId) {
    const variant = raceVariantFor(variantId);
    const periodMs = Math.max(400, hazard.periodMs * variant.hazardPeriodScale);
    const activeMs = Math.min(periodMs * .82, hazard.activeMs * variant.hazardActiveScale);
    const phase = (Number(now || 0) + Number(hazard.phaseOffset || 0)) % periodMs;
    return phase < activeMs;
  }

  function musicStateFor(state, actorId) {
    const actor = state && state.racers && state.racers[actorId || 'p1'];
    const profile = MUSIC_PROFILES[state && state.mode === MODES.BATTLE ? 'battle' : state && state.trackId] || MUSIC_PROFILES[TRACK_IDS.FORGE];
    const variant = raceVariantFor(state && state.variantId);
    const variantTempo = state && isRaceMode(state.mode) ? variant.musicTempoDelta : 0;
    let cue = 'lobby';
    let intensity = 0;
    let tempo = profile.tempo - 18;
    let reason = 'waiting in lobby';
    if (state && state.phase === PHASES.COUNTDOWN) {
      cue = 'charge'; intensity = 1; tempo = profile.tempo; reason = 'countdown armed';
    } else if (state && state.phase === PHASES.RACING && actor) {
      const incoming = state.projectiles.some(projectile => projectile.targetId === actor.id);
      const nearbyMine = state.mines.some(mine => distanceSquared(actor, mine) < 120 * 120);
      const boosting = state.now < actor.boostUntil;
      if (state.mode === MODES.BATTLE) {
        const remaining = state.battleEndsAt ? Math.max(0, state.battleEndsAt - state.now) : METRICS.battleDurationMs;
        const leaderScore = Math.max(...Object.values(state.racers).map(racer => racer.score));
        if (remaining <= 15000 || leaderScore >= METRICS.battleScoreToWin - 3) {
          cue = 'core-showdown'; intensity = 3; tempo = profile.tempo + 10; reason = 'battle end pressure';
        } else if (actor.shield <= 1 || incoming || nearbyMine) {
          cue = 'core-danger'; intensity = 3; tempo = profile.tempo + 5; reason = 'guard or threat pressure';
        } else {
          cue = 'core-pressure'; intensity = 2; tempo = profile.tempo; reason = 'active arena combat';
        }
      } else if (boosting) {
        cue = 'overdrive'; intensity = 3; tempo = profile.tempo + 8; reason = 'drift boost active';
      } else if (actor.lap >= Number(state.raceLaps || METRICS.laps) - 1) {
        cue = 'final-lap'; intensity = 3; tempo = profile.tempo + 7; reason = 'final lap';
      } else if (actor.shield <= 1 || incoming || nearbyMine) {
        cue = 'danger'; intensity = 3; tempo = profile.tempo + 3; reason = 'guard or threat pressure';
      } else if (actor.rank >= 3) {
        cue = 'chase'; intensity = 2; tempo = profile.tempo + 2; reason = 'catch-up chase';
      } else {
        cue = 'flow'; intensity = 1; tempo = profile.tempo; reason = actor.rank === 1 ? 'holding the lead' : 'front pack';
      }
    } else if (state && state.phase === PHASES.RESULTS) {
      cue = state.result && state.result.winnerId === (actor && actor.id) ? 'victory' : 'debrief';
      intensity = 1; tempo = 92; reason = cue === 'victory' ? 'player victory' : 'round complete';
    }
    const layers = ['pulse'];
    if (intensity >= 1) layers.push('bass');
    if (intensity >= 2) layers.push('arp');
    if (intensity >= 3) layers.push('spark');
    return {
      schema: 'axm.adaptive-music-state/v1',
      id: profile.id + (state && isRaceMode(state.mode) ? '-' + variant.id : '') + '-' + cue,
      profile: profile.id,
      variantId: state && isRaceMode(state.mode) ? variant.id : null,
      cue,
      intensity,
      tempo: tempo + variantTempo,
      rootMidi: profile.rootMidi,
      scale: profile.scale.slice(),
      layers,
      reason
    };
  }

  function updateRanking(state) {
    const ordered = Object.values(state.racers).slice().sort((a, b) => {
      if (state.mode === MODES.BATTLE) {
        return b.score - a.score || b.knockouts - a.knockouts || b.guardBreaks - a.guardBreaks || b.shield - a.shield || a.timesWiped - b.timesWiped || a.id.localeCompare(b.id);
      }
      if (a.finishedAt != null && b.finishedAt != null) return a.finishedAt - b.finishedAt;
      if (a.finishedAt != null) return -1;
      if (b.finishedAt != null) return 1;
      return b.progress - a.progress;
    });
    state.ranking = ordered.map(racer => racer.id);
    ordered.forEach((racer, index) => {
      racer.rank = index + 1;
      racer.catchup = METRICS.catchupByRank[index];
    });
  }

  function targetAheadOf(state, owner) {
    if (state.mode === MODES.BATTLE) {
      const rivals = Object.values(state.racers)
        .filter(racer => racer.id !== owner.id && !(racer.respawnAt && state.now < racer.respawnAt))
        .sort((a, b) => distanceSquared(owner, a) - distanceSquared(owner, b));
      return rivals[0] || null;
    }
    const candidates = Object.values(state.racers)
      .filter(racer => racer.id !== owner.id && racer.finishedAt == null)
      .map(racer => ({ racer, gap: racer.progress - owner.progress }))
      .filter(entry => entry.gap > -0.05)
      .sort((a, b) => a.gap - b.gap);
    return candidates.length ? candidates[0].racer : null;
  }

  function applyHit(state, racer, source, now, attackerId) {
    if (!racer || racer.finishedAt != null || (racer.respawnAt && now < racer.respawnAt) || now < racer.spawnProtectionUntil || now < racer.hitCooldownUntil) return false;
    const battle = state.mode === MODES.BATTLE;
    const shieldBefore = racer.shield;
    const wipedOut = shieldBefore === 0;
    const attacker = attackerId && state.racers[attackerId] && attackerId !== racer.id ? state.racers[attackerId] : null;
    racer.hitCooldownUntil = now + (battle ? METRICS.battleHitCooldownMs : 820);
    racer.stats.hits += 1;
    racer.drifting = false;
    racer.driftCharge = 0;
    racer.driftTier = 0;
    racer.driftDirection = 0;
    racer.boostUntil = 0;
    racer.boostPower = 1;
    if (!wipedOut) {
      racer.shield -= 1;
      racer.speed *= 0.58;
      racer.spinUntil = now + 310;
      pushEvent(state, 'hit', source + ' cracked ' + racer.character + '\'s guard · ' + racer.shield + ' left', now);
    } else {
      racer.speed *= 0.18;
      racer.spinUntil = now + 1150;
      racer.item = null;
      pushEvent(state, 'wipeout', source + ' wiped out ' + racer.character + ' — guard offline', now);
      if (battle) {
        racer.timesWiped += 1;
        racer.respawnAt = now + METRICS.battleRespawnMs;
        racer.spawnProtectionUntil = racer.respawnAt + METRICS.battleSpawnProtectionMs;
      }
    }
    if (battle && attacker) {
      if (wipedOut) {
        attacker.score += 2;
        attacker.knockouts += 1;
        pushEvent(state, 'score', attacker.character + ' earned +2 CORE for a clean wipe', now);
      } else {
        attacker.score += 1;
        attacker.guardBreaks += 1;
        pushEvent(state, 'score', attacker.character + ' earned +1 CORE for a guard break', now);
      }
    }
    state.effects.push({ id: state.nextEntityId++, type: wipedOut ? 'wipeout' : 'shield-hit', x: racer.x, y: racer.y, bornAt: now, expiresAt: now + 700, color: racer.accent });
    return true;
  }

  function useItem(state, racer, now) {
    if (!racer || state.phase !== PHASES.RACING || !racer.item || now < racer.itemCooldownUntil || racer.finishedAt != null || (racer.respawnAt && now < racer.respawnAt)) {
      return { ok: false, reason: 'item-unavailable' };
    }
    const item = racer.item;
    racer.item = null;
    racer.itemCooldownUntil = now + 500;
    if (item === 'repair') {
      if (racer.shield < METRICS.shieldMax) {
        racer.shield += 1;
        racer.stats.repairs += 1;
        pushEvent(state, 'repair', racer.character + ' restored one Flux Guard segment', now);
      } else {
        racer.boostUntil = now + 900;
        racer.boostPower = 1.12;
        pushEvent(state, 'boost', racer.character + ' converted a full guard patch into boost', now);
      }
      return { ok: true, item };
    }
    racer.stats.attacks += 1;
    if (item === 'mine') {
      state.mines.push({
        id: 'mine-' + state.nextEntityId++, ownerId: racer.id,
        x: racer.x - Math.cos(racer.heading) * 28, y: racer.y - Math.sin(racer.heading) * 28,
        bornAt: now, armedAt: now + 500, expiresAt: now + METRICS.mineLifeMs
      });
      pushEvent(state, 'attack', racer.character + ' dropped a Glitch Mine', now);
      return { ok: true, item };
    }
    if (item === 'emp') {
      state.effects.push({ id: state.nextEntityId++, type: 'emp', x: racer.x, y: racer.y, bornAt: now, expiresAt: now + 650, color: racer.accent });
      let hits = 0;
      Object.values(state.racers).forEach(target => {
        if (target.id !== racer.id && distanceSquared(racer, target) < 185 * 185 && applyHit(state, target, racer.character + '\'s EMP', now, racer.id)) hits += 1;
      });
      racer.boostUntil = now + 450;
      pushEvent(state, 'attack', racer.character + ' fired an EMP Nova' + (hits ? ' · ' + hits + ' hit' + (hits === 1 ? '' : 's') : ''), now);
      return { ok: true, item, hits };
    }
    const target = targetAheadOf(state, racer);
    state.projectiles.push({
      id: 'bolt-' + state.nextEntityId++, ownerId: racer.id, targetId: target && target.id,
      x: racer.x + Math.cos(racer.heading) * 30, y: racer.y + Math.sin(racer.heading) * 30,
      heading: racer.heading, speed: 390, bornAt: now, expiresAt: now + METRICS.boltLifeMs
    });
    pushEvent(state, 'attack', racer.character + ' launched an Arc Bolt', now);
    return { ok: true, item: 'bolt' };
  }

  function applyAction(state, actorId, action, now) {
    const racer = state && state.racers && state.racers[String(actorId || '')];
    if (!racer) return { ok: false, reason: 'unknown-racer' };
    const intent = action || {};
    const seq = Number(intent.seq);
    if (Number.isFinite(seq) && seq <= racer.lastSeq) return { ok: false, reason: 'stale-sequence' };
    if (Number.isFinite(seq)) racer.lastSeq = seq;
    const type = String(intent.type || 'drive');
    if (type === 'start') return startRace(state, now);
    if (type === 'item') return useItem(state, racer, Number(now || state.now));
    if (type !== 'drive') return { ok: false, reason: 'unsupported-intent' };
    racer.input = {
      throttle: clamp(intent.throttle, 0, 1),
      brake: clamp(intent.brake, 0, 1),
      steer: clamp(intent.steer, -1, 1)
    };
    racer.lastInputAt = Number(now || state.now);
    return { ok: true };
  }

  function releaseDrift(state, racer, now) {
    if (!racer.drifting) return 0;
    const tier = driftTierForCharge(racer.driftCharge);
    racer.drifting = false;
    racer.driftReleasedAt = now;
    racer.driftDirection = 0;
    if (tier > 0) {
      const duration = METRICS.driftBoostMs[tier];
      racer.boostUntil = Math.max(racer.boostUntil, now + duration);
      racer.boostPower = Math.max(racer.boostPower || 1, METRICS.driftBoostPower[tier]);
      racer.stats.drifts += 1;
      racer.stats.bestDriftTier = Math.max(racer.stats.bestDriftTier, tier);
      racer.stats.driftBoostMs += duration;
      const labels = ['', 'BLUE SHIFT', 'VIOLET SHIFT', 'MIRROR OVERDRIVE'];
      const colors = ['', '#35f2ff', '#8c79ff', '#ffad52'];
      pushEvent(state, 'drift', racer.character + ' released ' + labels[tier], now, {
        racerId: racer.id,
        characterId: racer.characterId,
        expressionId: racer.expressionId,
        driftTier: tier
      });
      state.effects.push({
        id: state.nextEntityId++, type: 'drift-boost', tier,
        x: racer.x, y: racer.y, bornAt: now, expiresAt: now + 620, color: colors[tier]
      });
    }
    racer.driftCharge = 0;
    racer.driftTier = 0;
    return tier;
  }

  function respawnBattleRacer(state, racer, now) {
    const spawn = BATTLE_SPAWNS[(racer.spawnIndex + racer.timesWiped) % BATTLE_SPAWNS.length];
    racer.x = spawn.x;
    racer.y = spawn.y;
    racer.heading = spawn.heading;
    racer.speed = 0;
    racer.shield = METRICS.shieldMax;
    racer.item = null;
    racer.input = { throttle: 0, brake: 0, steer: 0 };
    racer.drifting = false;
    racer.driftCharge = 0;
    racer.driftTier = 0;
    racer.respawnAt = 0;
    racer.stats.respawns += 1;
    state.effects.push({ id: state.nextEntityId++, type: 'respawn', x: racer.x, y: racer.y, bornAt: now, expiresAt: now + 900, color: racer.accent });
    pushEvent(state, 'respawn', racer.character + ' re-entered under spawn protection', now);
  }

  function updateBattleAi(state, racer, now) {
    const rival = targetAheadOf(state, racer);
    const activePads = state.pads.filter(pad => pad.active);
    const pad = activePads.sort((a, b) => distanceSquared(racer, a) - distanceSquared(racer, b))[0];
    const target = racer.item && rival ? rival : (pad || rival || { x: BATTLE_ARENA.centerX, y: BATTLE_ARENA.centerY });
    const desired = Math.atan2(target.y - racer.y, target.x - racer.x);
    const delta = angleDelta(desired, racer.heading);
    racer.input.steer = clamp(delta * 2.35, -1, 1);
    racer.input.throttle = Math.abs(delta) > 1.35 ? 0.5 : 1;
    racer.input.brake = Math.abs(delta) > 0.58 && racer.speed > METRICS.driftMinSpeed ? 0.46 : 0;
    racer.lastInputAt = now;
    if (!racer.item || now < racer.aiItemAt) return;
    const rivalDistance = rival ? Math.sqrt(distanceSquared(racer, rival)) : Infinity;
    const shouldUse = racer.item === 'repair' ? racer.shield < METRICS.shieldMax
      : racer.item === 'emp' ? rivalDistance < 205
        : racer.item === 'mine' ? rivalDistance < 170 || nextRandom(state) > .6
          : Boolean(rival);
    if (shouldUse) {
      useItem(state, racer, now);
      racer.aiItemAt = now + 820 + nextRandom(state) * 720;
    }
  }

  function updateAi(state, racer, now) {
    if (state.mode === MODES.BATTLE) return updateBattleAi(state, racer, now);
    const track = state.track;
    const count = track.points.length;
    const lookAhead = 7 + Math.round(racer.speed / 75);
    if (!racer.shortcutTargetId && track.shortcuts && track.shortcuts.length) {
      const candidate = track.shortcuts.find(shortcut => forwardIndexDistance(racer.trackIndex, shortcut.entryIndex, count) <= 4);
      if (candidate && distanceSquared(racer, candidate.from) < 150 * 150) racer.shortcutTargetId = candidate.id;
    }
    const shortcut = findShortcut(track, racer.shortcutTargetId);
    const target = shortcut ? shortcut.to : track.points[(racer.trackIndex + lookAhead) % count];
    const desired = Math.atan2(target.y - racer.y, target.x - racer.x);
    const delta = angleDelta(desired, racer.heading);
    racer.input.steer = clamp(delta * 2.1, -1, 1);
    const curve = Math.abs(delta);
    racer.input.throttle = curve > 1.12 ? 0.55 : 1;
    racer.input.brake = curve > 0.48 && racer.speed > METRICS.driftMinSpeed ? 0.42 : 0;
    racer.lastInputAt = now;
    if (racer.item && now >= racer.aiItemAt) {
      const targetRacer = targetAheadOf(state, racer);
      if (racer.item === 'repair' ? racer.shield < METRICS.shieldMax : targetRacer || racer.item === 'mine') {
        useItem(state, racer, now);
        racer.aiItemAt = now + 1600 + nextRandom(state) * 1300;
      }
    }
  }

  function updateRacer(state, racer, dt, now) {
    if (state.mode === MODES.BATTLE && racer.respawnAt) {
      if (now < racer.respawnAt) {
        racer.speed = 0;
        return;
      }
      respawnBattleRacer(state, racer, now);
    }
    if (racer.finishedAt != null) {
      racer.speed = Math.max(0, racer.speed - BASE_STATS.brake * 0.35 * dt);
      return;
    }
    if (racer.ai) updateAi(state, racer, now);
    else if (now - racer.lastInputAt > METRICS.inputTimeoutMs) racer.input = { throttle: 0, brake: 0, steer: 0 };

    const effectiveInput = Object.assign({}, racer.input);
    racer.assistActive = { steering: false, autoAccelerate: false };
    if (!racer.ai && racer.assists) {
      if (racer.assists.autoAccelerate) {
        effectiveInput.throttle = 1;
        racer.assistActive.autoAccelerate = true;
      }
      if (isRaceMode(state.mode) && racer.assists.steering && !racer.activeShortcutId && !racer.shortcutTargetId) {
        const assistTarget = state.track.points[(racer.trackIndex + 6) % state.track.points.length];
        const desired = Math.atan2(assistTarget.y - racer.y, assistTarget.x - racer.x);
        const correction = clamp(angleDelta(desired, racer.heading) * 1.7, -1, 1);
        effectiveInput.steer = clamp(effectiveInput.steer * (1 - racer.assists.steering) + correction * racer.assists.steering, -1, 1);
        racer.assistActive.steering = Math.abs(correction) > .08;
      }
    }

    const spinning = now < racer.spinUntil;
    if (now >= racer.boostUntil) racer.boostPower = 1;
    const boost = now < racer.boostUntil ? Math.max(1, racer.boostPower || 1) : 1;
    const maxSpeed = BASE_STATS.maxSpeed * racer.catchup * boost;
    const wantsDrift = !spinning && !racer.offRoad && racer.speed >= METRICS.driftMinSpeed
      && effectiveInput.throttle >= 0.35 && effectiveInput.brake >= 0.2 && Math.abs(effectiveInput.steer) >= 0.32;
    if (wantsDrift) {
      if (!racer.drifting) {
        racer.drifting = true;
        racer.driftStartedAt = now;
        racer.driftCharge = 0;
      }
      racer.driftDirection = effectiveInput.steer < 0 ? -1 : 1;
      const speedFactor = clamp(racer.speed / BASE_STATS.maxSpeed, 0.35, 1.25);
      racer.driftCharge = clamp(racer.driftCharge + dt * Math.abs(effectiveInput.steer) * (0.46 + speedFactor * 0.5), 0, 1);
      racer.driftTier = driftTierForCharge(racer.driftCharge);
    } else if (racer.drifting) releaseDrift(state, racer, now);
    if (spinning) {
      racer.heading += 4.8 * dt;
      racer.speed = Math.max(0, racer.speed - BASE_STATS.brake * 0.48 * dt);
    } else {
      racer.speed += BASE_STATS.acceleration * effectiveInput.throttle * dt;
      racer.speed -= (wantsDrift ? 26 : BASE_STATS.brake) * effectiveInput.brake * dt;
      racer.speed -= (wantsDrift ? 16 : 24) * dt;
      racer.speed = clamp(racer.speed, 0, maxSpeed);
      const steerPower = (0.38 + 0.82 * racer.speed / Math.max(1, maxSpeed));
      const driftTurn = wantsDrift ? 1.22 + racer.driftCharge * 0.14 : 1;
      racer.heading += effectiveInput.steer * BASE_STATS.turnRate * steerPower * driftTurn * dt;
    }
    racer.x += Math.cos(racer.heading) * racer.speed * dt;
    racer.y += Math.sin(racer.heading) * racer.speed * dt;

    if (state.mode === MODES.BATTLE) {
      const dx = (racer.x - BATTLE_ARENA.centerX) / BATTLE_ARENA.radiusX;
      const dy = (racer.y - BATTLE_ARENA.centerY) / BATTLE_ARENA.radiusY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 1) {
        racer.x = BATTLE_ARENA.centerX + dx / distance * BATTLE_ARENA.radiusX * .985;
        racer.y = BATTLE_ARENA.centerY + dy / distance * BATTLE_ARENA.radiusY * .985;
        racer.heading += Math.PI * .72;
        racer.speed *= .42;
        state.effects.push({ id: state.nextEntityId++, type: 'arena-bounce', x: racer.x, y: racer.y, bornAt: now, expiresAt: now + 320, color: racer.accent });
      }
      racer.offRoad = false;
      racer.progress = racer.score + racer.knockouts * .01 + racer.guardBreaks * .001;
      return;
    }

    const track = state.track;
    const variant = raceVariantFor(state.variantId);
    const nearest = findNearestTrackPoint(racer, track);
    if (!racer.activeShortcutId && !racer.shortcutTargetId && track.shortcuts && track.shortcuts.length) {
      const entered = track.shortcuts.find(item => forwardIndexDistance(racer.trackIndex, item.entryIndex, track.points.length) <= 3 && distanceSquared(racer, item.from) <= 82 * 82);
      if (entered) racer.shortcutTargetId = entered.id;
    }
    let shortcut = shortcutStatus(racer, track);
    const shortcutHeadingAligned = shortcut
      ? Math.abs(angleDelta(Math.atan2(shortcut.shortcut.to.y - shortcut.shortcut.from.y, shortcut.shortcut.to.x - shortcut.shortcut.from.x), racer.heading)) <= .7
      : false;
    const shortcutWidth = shortcut ? shortcut.shortcut.width * variant.shortcutWidthScale : 0;
    if (shortcut && !racer.activeShortcutId && shortcutHeadingAligned && shortcut.segment.distance <= shortcutWidth * .9 && shortcut.segment.t >= .006 && shortcut.segment.t <= .28) {
      racer.activeShortcutId = shortcut.shortcut.id;
      racer.shortcutTargetId = shortcut.shortcut.id;
      racer.stats.shortcuts += 1;
      pushEvent(state, 'shortcut', racer.character + ' committed to ' + shortcut.shortcut.name, now);
    }
    shortcut = shortcutStatus(racer, track);
    const activeShortcutWidth = shortcut ? shortcut.shortcut.width * variant.shortcutWidthScale : 0;
    const inShortcut = Boolean(shortcut && racer.activeShortcutId && shortcut.segment.distance <= activeShortcutWidth && shortcut.segment.t < .97);
    racer.offRoad = !inShortcut && nearest.distance > track.roadWidth * 0.5;
    if (racer.offRoad) {
      racer.drifting = false;
      racer.driftCharge = 0;
      racer.driftTier = 0;
      racer.driftDirection = 0;
      racer.speed = Math.max(0, racer.speed - variant.offRoadDrag * dt);
      if (nearest.distance > track.roadWidth * 1.45) {
        const road = track.points[nearest.index];
        racer.x += (road.x - racer.x) * Math.min(1, dt * 1.4);
        racer.y += (road.y - racer.y) * Math.min(1, dt * 1.4);
      }
    }
    const count = track.points.length;
    const previous = racer.trackIndex;
    racer.lastTrackIndex = previous;
    racer.trackIndex = inShortcut
      ? Math.round(shortcut.shortcut.entryIndex + forwardIndexDistance(shortcut.shortcut.entryIndex, shortcut.shortcut.exitIndex, count) * shortcut.segment.t) % count
      : nearest.index;
    if (shortcut && racer.activeShortcutId && shortcut.segment.t >= .92) {
      racer.trackIndex = shortcut.shortcut.exitIndex;
      racer.activeShortcutId = null;
      racer.shortcutTargetId = null;
      racer.boostUntil = Math.max(racer.boostUntil, now + variant.shortcutBoostMs);
      racer.boostPower = Math.max(racer.boostPower, variant.shortcutBoostPower);
      pushEvent(state, 'shortcut', racer.character + ' cleared ' + shortcut.shortcut.name, now);
    } else if (shortcut && racer.activeShortcutId && shortcut.segment.distance > activeShortcutWidth * 1.65) {
      racer.activeShortcutId = null;
      racer.shortcutTargetId = null;
    }
    const fraction = racer.trackIndex / count;
    if (!racer.offRoad) {
      if (fraction >= .22 && fraction < .48 && racer.lapCheckpoint === 0) racer.lapCheckpoint = 1;
      else if (fraction >= .48 && fraction < .74 && racer.lapCheckpoint === 1) racer.lapCheckpoint = 2;
      else if (fraction >= .74 && racer.lapCheckpoint === 2) racer.lapCheckpoint = 3;
    }
    const crossedStartForward = previous > count * .76 && racer.trackIndex < count * .14;
    if (!racer.offRoad && crossedStartForward && racer.lapCheckpoint === 3 && racer.speed > 35) {
      racer.lap += 1;
      racer.lapCheckpoint = 0;
      if (racer.lap >= state.raceLaps) {
        racer.finishedAt = now;
        racer.finishPlace = Object.values(state.racers).filter(other => other.finishedAt != null).length;
        if (!state.winnerAt) state.winnerAt = now;
        pushEvent(state, 'finish', racer.character + ' finished in P' + racer.finishPlace, now, {
          racerId: racer.id,
          characterId: racer.characterId,
          expressionId: racer.expressionId,
          finishPlace: racer.finishPlace
        });
      }
    }
    if (!racer.offRoad && now >= racer.hazardCooldownUntil) {
      const hazard = (track.hazards || []).find(item => hazardActive(item, now, state.variantId) && distanceSquared(racer, item) <= item.radius * item.radius);
      if (hazard) {
        racer.speed *= hazard.speedFactor;
        racer.spinUntil = Math.max(racer.spinUntil, now + hazard.spinMs);
        racer.hazardCooldownUntil = now + 1600;
        racer.drifting = false;
        racer.driftCharge = 0;
        racer.driftTier = 0;
        racer.stats.hazardsHit += 1;
        state.effects.push({ id: state.nextEntityId++, type: 'hazard-hit', x: racer.x, y: racer.y, bornAt: now, expiresAt: now + 620, color: track.theme.accent });
        pushEvent(state, 'hazard', racer.character + ' hit ' + hazard.type.replace(/-/g, ' '), now);
      }
    }
    racer.progress = racer.lap + racer.trackIndex / count;
  }

  function updatePads(state, now) {
    state.pads.forEach(pad => {
      if (!pad.active && now >= pad.respawnAt) pad.active = true;
      if (!pad.active) return;
      for (const racer of Object.values(state.racers)) {
        if (racer.finishedAt != null || (racer.respawnAt && now < racer.respawnAt) || racer.item || distanceSquared(racer, pad) > 34 * 34) continue;
        racer.item = chooseItem(state);
        racer.stats.pickups += 1;
        pad.active = false;
        const variant = raceVariantFor(state.variantId);
        pad.respawnAt = now + (state.mode === MODES.BATTLE ? METRICS.battleItemRespawnMs : METRICS.itemRespawnMs * variant.itemRespawnScale);
        pushEvent(state, 'pickup', racer.character + ' picked up ' + ITEM_TYPES[racer.item].label, now);
        break;
      }
    });
  }

  function updateProjectiles(state, dt, now) {
    state.projectiles.forEach(projectile => {
      const target = state.racers[projectile.targetId];
      if (target && target.finishedAt == null) {
        const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
        projectile.heading += clamp(angleDelta(desired, projectile.heading), -2.8 * dt, 2.8 * dt);
      }
      projectile.x += Math.cos(projectile.heading) * projectile.speed * dt;
      projectile.y += Math.sin(projectile.heading) * projectile.speed * dt;
      for (const racer of Object.values(state.racers)) {
        if (racer.id === projectile.ownerId || distanceSquared(projectile, racer) > 23 * 23) continue;
        if (applyHit(state, racer, (state.racers[projectile.ownerId] || { character: 'A rival' }).character + '\'s bolt', now, projectile.ownerId)) projectile.expiresAt = 0;
      }
    });
    state.projectiles = state.projectiles.filter(projectile => projectile.expiresAt > now);
  }

  function updateMines(state, now) {
    state.mines.forEach(mine => {
      if (now < mine.armedAt) return;
      for (const racer of Object.values(state.racers)) {
        if (racer.id === mine.ownerId || distanceSquared(mine, racer) > 29 * 29) continue;
        if (applyHit(state, racer, (state.racers[mine.ownerId] || { character: 'A rival' }).character + '\'s mine', now, mine.ownerId)) mine.expiresAt = 0;
      }
    });
    state.mines = state.mines.filter(mine => mine.expiresAt > now);
  }

  function resolveRacerContacts(state) {
    const racers = Object.values(state.racers).filter(racer => !(racer.respawnAt && state.now < racer.respawnAt));
    for (let a = 0; a < racers.length; a += 1) {
      for (let b = a + 1; b < racers.length; b += 1) {
        const first = racers[a];
        const second = racers[b];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= 0 || distSq > 30 * 30) continue;
        const dist = Math.sqrt(distSq);
        const overlap = (30 - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        first.x -= nx * overlap;
        first.y -= ny * overlap;
        second.x += nx * overlap;
        second.y += ny * overlap;
        first.speed *= 0.97;
        second.speed *= 0.97;
      }
    }
  }

  function finishRace(state, now) {
    updateRanking(state);
    const roundWinner = state.racers[state.ranking[0]];
    let winner = roundWinner;
    let tourResult = null;
    if (state.mode === MODES.TOUR && state.tour) {
      const pointsAwarded = {};
      state.ranking.forEach((id, index) => {
        const awarded = SIGNAL_TOUR.points[index] || 0;
        pointsAwarded[id] = awarded;
        state.tour.points[id] = Number(state.tour.points[id] || 0) + awarded;
      });
      const roundNumber = state.tour.roundIndex + 1;
      state.tour.roundResults.push({
        roundNumber,
        trackId: state.trackId,
        variantId: state.variantId,
        winnerId: roundWinner.id,
        ranking: state.ranking.slice(),
        pointsAwarded: Object.assign({}, pointsAwarded),
        elapsedMs: Math.max(0, now - state.raceStartedAt)
      });
      state.tour.standings = tourStandings(state.tour.points, state.ranking);
      state.tour.complete = roundNumber >= state.tour.roundCount;
      state.tour.championId = state.tour.complete ? state.tour.standings[0] : null;
      if (state.tour.complete) winner = state.racers[state.tour.championId];
      const nextRound = state.tour.complete ? null : signalTourRound(state.tour.roundIndex + 1);
      tourResult = {
        schema: state.tour.schema,
        label: state.tour.label,
        roundNumber,
        roundCount: state.tour.roundCount,
        pointsTable: state.tour.pointsTable.slice(),
        points: Object.assign({}, state.tour.points),
        pointsAwarded,
        standings: state.tour.standings.slice(),
        complete: state.tour.complete,
        championId: state.tour.championId,
        nextRound: nextRound ? Object.assign({}, nextRound) : null
      };
    }
    state.phase = PHASES.RESULTS;
    state.result = {
      mode: state.mode,
      trackId: state.trackId,
      trackName: isRaceMode(state.mode) ? state.track.name : BATTLE_ARENA.name,
      variantId: isRaceMode(state.mode) ? state.variantId : null,
      variantLabel: isRaceMode(state.mode) ? raceVariantFor(state.variantId).label : null,
      routeDirectionId: isRaceMode(state.mode) ? state.routeDirectionId : null,
      routeDirectionLabel: isRaceMode(state.mode) ? routeDirectionFor(state.routeDirectionId).label : null,
      raceLaps: isRaceMode(state.mode) ? state.raceLaps : null,
      winnerId: winner.id,
      roundWinnerId: roundWinner.id,
      winner: winner.character,
      vehicle: winner.vehicle,
      ranking: state.ranking.slice(),
      elapsedMs: Math.max(0, now - state.raceStartedAt),
      equalStats: true,
      attackDropRate: state.mode === MODES.BATTLE ? 0.9 : 0.85,
      shieldSegments: METRICS.shieldMax,
      totalDriftBoosts: Object.values(state.racers).reduce((sum, racer) => sum + racer.stats.drifts, 0),
      scores: Object.fromEntries(state.ranking.map(id => [id, state.racers[id].score])),
      guardBreaks: Object.fromEntries(state.ranking.map(id => [id, state.racers[id].guardBreaks])),
      knockouts: Object.fromEntries(state.ranking.map(id => [id, state.racers[id].knockouts]))
    };
    if (tourResult) state.result.tour = tourResult;
    pushEvent(state, 'results', state.mode === MODES.BATTLE
      ? winner.character + ' dominates the Mirror Core with ' + winner.score + ' points'
      : state.mode === MODES.TOUR
        ? tourResult.complete
          ? winner.character + ' claims the Signal Tour with ' + tourResult.points[winner.id] + ' points'
          : roundWinner.character + ' takes Tour Round ' + tourResult.roundNumber + ' · standings updated'
        : winner.character + ' takes the Mirror Crown', now, state.mode === MODES.TOUR ? { tourRound: tourResult.roundNumber, tourComplete: tourResult.complete } : null);
  }

  function advanceTour(state, now) {
    if (!state || state.mode !== MODES.TOUR || !state.tour) return { ok: false, reason: 'not-tour' };
    if (state.phase !== PHASES.RESULTS) return { ok: false, reason: 'tour-round-active' };
    if (state.tour.complete) return { ok: false, reason: 'tour-complete' };
    state.now = Number(now == null ? state.now : now);
    state.tour.roundIndex += 1;
    const round = signalTourRound(state.tour.roundIndex);
    const variant = raceVariantFor(round.variantId);
    state.trackId = round.trackId;
    state.variantId = round.variantId;
    state.routeDirectionId = ROUTE_DIRECTION_IDS.FORWARD;
    state.raceLaps = variant.laps;
    state.track = trackFor(round.trackId, state.routeDirectionId);
    state.pads = createItemPads(state.track);
    state.projectiles = [];
    state.mines = [];
    state.effects = [];
    state.phase = PHASES.LOBBY;
    state.countdownEndsAt = 0;
    state.raceStartedAt = 0;
    state.battleEndsAt = 0;
    state.winnerAt = 0;
    state.result = null;
    Object.values(state.racers).forEach((racer, index) => resetRacerForRound(racer, index, MODES.TOUR, state.track, state.now));
    updateRanking(state);
    pushEvent(state, 'tour-round', 'SIGNAL TOUR Round ' + (state.tour.roundIndex + 1) + ' of ' + state.tour.roundCount + ' · ' + state.track.name + ' · ' + variant.label, state.now, { tourRound: state.tour.roundIndex + 1 });
    return { ok: true, roundNumber: state.tour.roundIndex + 1, roundCount: state.tour.roundCount };
  }

  function step(state, deltaMs, now) {
    if (!state) return state;
    const current = Number(now == null ? state.now + Number(deltaMs || 0) : now);
    const dt = clamp(Number(deltaMs || 0) / 1000, 0, 0.1);
    state.now = current;
    state.tick += 1;
    if (state.phase === PHASES.COUNTDOWN && current >= state.countdownEndsAt) {
      state.phase = PHASES.RACING;
      state.raceStartedAt = current;
      state.battleEndsAt = state.mode === MODES.BATTLE ? current + METRICS.battleDurationMs : 0;
      Object.values(state.racers).forEach(racer => { racer.lastInputAt = current; });
      pushEvent(state, 'go', state.mode === MODES.BATTLE ? 'CORE LIVE · break guards, force wipes' : 'GO · equal machines, unequal nerve', current, {
        racerId: 'p1',
        characterId: state.racers.p1.characterId,
        expressionId: state.racers.p1.expressionId,
        variantId: isRaceMode(state.mode) ? state.variantId : null,
        raceLaps: isRaceMode(state.mode) ? state.raceLaps : null
      });
    }
    if (state.phase !== PHASES.RACING) {
      state.effects = state.effects.filter(effect => effect.expiresAt > current);
      return state;
    }
    updateRanking(state);
    Object.values(state.racers).forEach(racer => updateRacer(state, racer, dt, current));
    resolveRacerContacts(state);
    updatePads(state, current);
    updateProjectiles(state, dt, current);
    updateMines(state, current);
    state.effects = state.effects.filter(effect => effect.expiresAt > current);
    updateRanking(state);
    if (state.mode === MODES.BATTLE) {
      const scoreReached = Object.values(state.racers).some(racer => racer.score >= METRICS.battleScoreToWin);
      if (scoreReached || current >= state.battleEndsAt) finishRace(state, current);
    } else {
      const finished = Object.values(state.racers).filter(racer => racer.finishedAt != null).length;
      if (finished === RACERS.length || (state.winnerAt && current - state.winnerAt >= METRICS.resultsDelayMs) || current - state.raceStartedAt >= METRICS.maxRaceMs) finishRace(state, current);
    }
    return state;
  }

  function observe(state, actorId) {
    const racer = state && state.racers && state.racers[actorId];
    if (!racer) return null;
    return {
      schema: 'axm.seat-screen-semantics/v2',
      gameId: GAME_ID,
      phase: state.phase,
      mode: state.mode,
      trackId: state.trackId,
      trackName: isRaceMode(state.mode) ? state.track.name : BATTLE_ARENA.name,
      variantId: isRaceMode(state.mode) ? state.variantId : null,
      variantLabel: isRaceMode(state.mode) ? raceVariantFor(state.variantId).label : null,
      routeDirectionId: isRaceMode(state.mode) ? state.routeDirectionId : null,
      routeDirectionLabel: isRaceMode(state.mode) ? routeDirectionFor(state.routeDirectionId).label : null,
      raceLaps: isRaceMode(state.mode) ? state.raceLaps : null,
      tour: state.tour ? {
        schema: state.tour.schema,
        roundNumber: state.tour.roundIndex + 1,
        roundCount: state.tour.roundCount,
        points: Object.assign({}, state.tour.points),
        standings: state.tour.standings.slice(),
        complete: state.tour.complete,
        championId: state.tour.championId
      } : null,
      timeRemainingMs: state.mode === MODES.BATTLE && state.battleEndsAt ? Math.max(0, state.battleEndsAt - state.now) : null,
      self: {
        id: racer.id, characterId: racer.characterId, character: racer.character, title: racer.title, signature: racer.signature, expressionId: racer.expressionId, expressionLabel: racer.expressionLabel, signatureQuote: racer.signatureQuote, vehicle: racer.vehicle, color: racer.color, accent: racer.accent, rank: racer.rank,
        lap: Math.min(state.raceLaps, racer.lap + 1), shield: racer.shield, item: racer.item,
        score: racer.score,
        assists: Object.assign({}, racer.assists),
        assistActive: Object.assign({}, racer.assistActive),
        guardBreaks: racer.guardBreaks,
        knockouts: racer.knockouts,
        respawning: Boolean(racer.respawnAt && state.now < racer.respawnAt),
        spawnProtected: state.now < racer.spawnProtectionUntil,
        speedRatio: round(racer.speed / (BASE_STATS.maxSpeed * racer.catchup), 2), catchup: racer.catchup,
        drift: {
          active: racer.drifting,
          charge: round(racer.driftCharge, 2),
          tier: racer.driftTier,
          boosting: state.now < racer.boostUntil,
          boostPower: round(racer.boostPower || 1, 2)
        }
      },
      visibleRace: state.ranking.map(id => {
        const item = state.racers[id];
        return { id, characterId: item.characterId, character: item.character, rank: item.rank, lap: Math.min(state.raceLaps, item.lap + 1), shield: item.shield, score: item.score, knockouts: item.knockouts, respawning: Boolean(item.respawnAt && state.now < item.respawnAt), finished: item.finishedAt != null };
      }),
      allowedIntents: ['drive', 'item', 'start', 'character'],
      hiddenStateExcluded: true
    };
  }

  function snapshot(state) {
    return JSON.parse(JSON.stringify(state));
  }

  return {
    BASE_STATS,
    ASSIST_CONTRACT,
    MUSIC_PROFILES,
    GAME_ID,
    INPUT_SCHEMA,
    ITEM_TYPES,
    METRICS,
    MODES,
    PHASES,
    RACE_VARIANT_IDS,
    RACE_VARIANTS,
    RACE_VARIANT_CATALOG,
    ROUTE_DIRECTION_IDS,
    ROUTE_DIRECTIONS,
    ROUTE_DIRECTION_CATALOG,
    SIGNAL_TOUR,
    TRACK_IDS,
    TRACKS,
    REFLECTION_TRACKS,
    TRACK_CATALOG,
    BATTLE_ARENA,
    BATTLE_POWERUP_WEIGHTS,
    CHARACTER_EXPRESSIONS,
    KINETIC_RIGS,
    RESULT_STAGE_MOMENTS,
    START_GRID_MOMENTS,
    ENVIRONMENT_CHOREOGRAPHIES,
    POWERUP_WEIGHTS,
    RACERS,
    TRACK,
    applyAction,
    applyHit,
    advanceTour,
    buildTrack,
    buildSplitglassTrack,
    buildNullFoundryTrack,
    chooseItem,
    createInitialState,
    characterExpressionFor,
    kineticRigFor,
    resultStageMomentFor,
    startGridMomentFor,
    environmentChoreographyFor,
    raceVariantFor,
    routeDirectionFor,
    trackFor,
    driftTierForCharge,
    normalizeRoster,
    normalizeCharacterAssignments,
    normalizeAssists,
    musicStateFor,
    observe,
    snapshot,
    startRace,
    step,
    updateRanking,
    useItem,
    releaseDrift,
    setMode,
    setTrack,
    setRouteDirection,
    setRaceVariant,
    setAssists,
    setCharacter,
    hazardActive,
    isRaceMode,
    interpolatePresentationPose,
    resultStagePose,
    startGridPose,
    environmentChoreographyPose,
    vehicleAnimationPose,
    pointToSegment
  };
});
