(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PulseChoirCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GAME_ID = '012-pulse-choir';
  const STATE_SCHEMA = 'axm.pulse-choir-state/v1';
  const INPUT_SCHEMA = 'axm.semantic-game-intent/v1';
  const SHOW_SCHEMA = 'axm.pulse-choir-show-arc/v1';
  const CONDUCTOR_SCHEMA = 'axm.pulse-choir-conductor-plan/v1';
  const ROOM_SIGNAL_SCHEMA = 'axm.pulse-choir-room-signal/v1';
  const SHOW_HISTORY_LIMIT = 6;
  const PHASES = Object.freeze({ LOBBY: 'lobby', COUNTDOWN: 'countdown', PLAYING: 'playing', RESULTS: 'results' });
  const METRICS = Object.freeze({
    arenaWidth: 100,
    arenaHeight: 62,
    coreX: 50,
    coreY: 31,
    coreRadius: 7.4,
    playerRadius: 2.15,
    beatRadius: 1.55,
    playerSpeed: 26,
    maxCarry: 3,
    targetBeatCount: 14,
    countdownMs: 3000,
    roundMs: 75000,
    inputTtlMs: 280,
    pulseBufferMs: 240,
    syncWindowMs: 1900,
    glitchWarningMs: 1150,
    glitchActiveMs: 900,
    glitchThickness: 4.6,
    harmonyWindowMs: 6500,
    triadChargeBonus: 14,
    triadScoreBonus: 80,
    fullCarryScoreBonus: 24,
    perfectShieldCharges: 1,
    setlistActMs: 23000,
    setlistTransitionMs: 1000,
    showArcRounds: 3,
    aiScoreFactor: 0.4,
    rankInRhythm: 1200,
    rankEncore: 3000,
    rankHeadliner: 4500,
    frameBudgetMs: 16.7
  });
  const PLAYER_RECIPES = Object.freeze([
    Object.freeze({ color: '#6df7ff', ink: '#06262b', shape: 'triangle', glyph: '▲' }),
    Object.freeze({ color: '#ffcf5a', ink: '#2e2205', shape: 'square', glyph: '■' }),
    Object.freeze({ color: '#ff71c8', ink: '#310620', shape: 'diamond', glyph: '◆' }),
    Object.freeze({ color: '#a8ff6a', ink: '#142d05', shape: 'circle', glyph: '●' })
  ]);
  const BEAT_TYPES = Object.freeze({
    spark: Object.freeze({ id: 'spark', label: 'SPARK', value: 12, score: 10, color: '#68f7ff', shape: 'triangle', glyph: '△' }),
    chord: Object.freeze({ id: 'chord', label: 'CHORD', value: 18, score: 16, color: '#ffe06a', shape: 'square', glyph: '□' }),
    wild: Object.freeze({ id: 'wild', label: 'WILD', value: 28, score: 24, color: '#ff65bd', shape: 'diamond', glyph: '◇', raisesThreat: true })
  });
  const SETLIST_LIBRARY = Object.freeze({
    human: Object.freeze([
      Object.freeze({ kind: 'human-triad', title: 'HUMAN SPOTLIGHT', instruction: 'A human banks one complete TRIAD.', target: 1, reward: 280, glyph: '★', humanRequired: true }),
      Object.freeze({ kind: 'human-pulses', title: 'CALL & RESPONSE', instruction: 'Human seats join two pulse windows.', target: 2, reward: 240, glyph: '◉', humanRequired: true })
    ]),
    team: Object.freeze([
      Object.freeze({ kind: 'all-seat-bank', title: 'PASS THE MIC', instruction: 'Every active seat banks at least once.', target: 'players', reward: 260, glyph: '↻', humanRequired: true }),
      Object.freeze({ kind: 'perfect-choir', title: 'ONE-BREATH CHOIR', instruction: 'Land one perfect synchronized pulse.', target: 1, reward: 320, glyph: '◆', humanRequired: true })
    ]),
    flow: Object.freeze([
      Object.freeze({ kind: 'chain-four', title: 'CHAIN REACTION', instruction: 'Build a four-bank harmony chain.', target: 4, reward: 220, glyph: '×', humanRequired: false }),
      Object.freeze({ kind: 'wild-two', title: 'RIDE THE STATIC', instruction: 'Bank two WILD beats before the cue turns.', target: 2, reward: 240, glyph: '◇', humanRequired: false })
    ])
  });
  const ROOM_SIGNAL_CHOICES = Object.freeze({
    together: Object.freeze({ id: 'together', title: 'TOGETHER', cue: 'SYNC THE ROOM', explanation: 'shared timing', actKinds: Object.freeze(['human-pulses', 'perfect-choir', 'chain-four']) }),
    bold: Object.freeze({ id: 'bold', title: 'BOLD', cue: 'TAKE THE SPOTLIGHT', explanation: 'spotlight risk', actKinds: Object.freeze(['human-triad', 'all-seat-bank', 'wild-two']) }),
    flow: Object.freeze({ id: 'flow', title: 'FLOW', cue: 'KEEP THE CHAIN MOVING', explanation: 'continuous room flow', actKinds: Object.freeze(['human-pulses', 'all-seat-bank', 'chain-four']) })
  });
  const ROOM_SIGNAL_ORDER = Object.freeze(['together', 'bold', 'flow']);
  const ASSET_CONTRACT = Object.freeze({
    player: 'recipe color + unique glyph/shape + name label + 2.15 world-unit contact radius',
    beat: 'type color + unique outline shape + glyph + 1.55 world-unit contact radius',
    core: 'centered concentric rings; charge is fill, number, and pulse cadence',
    glitch: 'striped telegraph before solid active sweep; text and optional sound duplicate the warning'
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function distance(a, b) { return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y)); }
  function normalizeVector(x, y) {
    const nx = Number.isFinite(Number(x)) ? Number(x) : 0;
    const ny = Number.isFinite(Number(y)) ? Number(y) : 0;
    const length = Math.hypot(nx, ny);
    if (length <= 0.0001) return { x: 0, y: 0 };
    if (length <= 1) return { x: nx, y: ny };
    return { x: nx / length, y: ny / length };
  }
  function nextRandom(state) {
    let value = Number(state.rngState || 12026) >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    state.rngState = value >>> 0;
    return state.rngState / 4294967296;
  }
  function nextId(state, prefix) {
    state.nextEntityId += 1;
    return prefix + '-' + state.nextEntityId;
  }
  function rosterSort(a, b) { return Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, '')); }
  function normalizeRoster(roster) {
    const source = Array.isArray(roster) && roster.length ? roster.slice(0, 4) : [
      { slot: 1, seat_id: 'seat_1', display_name: 'Player 1', type: 'human' },
      { slot: 2, seat_id: 'seat_2', display_name: 'Tempo', type: 'ai' },
      { slot: 3, seat_id: 'seat_3', display_name: 'Echo', type: 'ai' }
    ];
    const seen = new Set();
    return source.map((seat, index) => {
      const slot = clamp(Math.round(Number(seat.slot) || index + 1), 1, 4);
      let id = 'p' + slot;
      if (seen.has(id)) id = 'p' + (index + 1);
      seen.add(id);
      return {
        id,
        slot,
        seatId: String(seat.seat_id || seat.seatId || ('seat_' + slot)).slice(0, 48),
        name: String(seat.display_name || seat.name || ('Player ' + slot)).slice(0, 32),
        type: seat.type === 'ai' ? 'ai' : 'human'
      };
    }).sort((a, b) => a.slot - b.slot);
  }
  function pushBounded(list, item, limit) {
    list.push(item);
    if (list.length > limit) list.splice(0, list.length - limit);
  }
  function commitEvent(state, id, type, message, now, data) {
    if (state.recentEventIds.includes(id)) return false;
    pushBounded(state.recentEventIds, id, 96);
    pushBounded(state.events, { id, type, message, at: now, data: data || null }, 40);
    state.message = message;
    return true;
  }
  function normalizeSeed(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric >>> 0 : 12026;
  }
  function deriveRoundSeed(baseSeed, roundNumber) {
    const index = Math.max(1, Math.floor(Number(roundNumber) || 1));
    return (normalizeSeed(baseSeed) + index - 1) >>> 0;
  }
  function showPosition(roundNumber) {
    const round = Math.max(1, Math.floor(Number(roundNumber) || 1));
    return {
      showNumber: Math.floor((round - 1) / METRICS.showArcRounds) + 1,
      roundInShow: ((round - 1) % METRICS.showArcRounds) + 1
    };
  }
  function rankForScore(score) {
    return score >= METRICS.rankHeadliner ? 'HEADLINER' : score >= METRICS.rankEncore ? 'ENCORE' : score >= METRICS.rankInRhythm ? 'IN RHYTHM' : 'WARM-UP';
  }
  function rankTier(rank) {
    return ['WARM-UP', 'IN RHYTHM', 'ENCORE', 'HEADLINER'].indexOf(String(rank));
  }
  function normalizeStoredRoomSignal(value) {
    if (!value || value.schema !== ROOM_SIGNAL_SCHEMA) return null;
    const targetRound = Math.max(1, Math.floor(Number(value.targetRound) || 0));
    const votes = {};
    Object.keys(value.votes && typeof value.votes === 'object' ? value.votes : {}).sort().slice(0, 4).forEach(actorId => {
      const choice = String(value.votes[actorId] || '').toLowerCase();
      if (/^p[1-4]$/.test(actorId) && ROOM_SIGNAL_CHOICES[choice]) votes[actorId] = choice;
    });
    return { schema: ROOM_SIGNAL_SCHEMA, targetRound, votes };
  }
  function ensureRoomSignal(show) {
    if (!show || Number(show.completedRounds || 0) < 1) {
      if (show) show.roomSignal = null;
      return null;
    }
    const targetRound = Math.max(1, Math.floor(Number(show.completedRounds || 0)) + 1);
    const existing = normalizeStoredRoomSignal(show.roomSignal);
    show.roomSignal = existing && existing.targetRound === targetRound
      ? existing
      : { schema: ROOM_SIGNAL_SCHEMA, targetRound, votes: {} };
    return show.roomSignal;
  }
  function resolveRoomSignal(show, players) {
    const signal = normalizeStoredRoomSignal(show && show.roomSignal);
    if (!signal || signal.targetRound !== Math.max(1, Number(show && show.completedRounds || 0) + 1)) return null;
    const roster = players && typeof players === 'object' ? Object.values(players) : [];
    const humanIds = roster.length
      ? roster.filter(player => player && player.type === 'human').map(player => String(player.id)).sort()
      : Object.keys(signal.votes).sort();
    const counts = Object.fromEntries(ROOM_SIGNAL_ORDER.map(choice => [choice, 0]));
    let totalVotes = 0;
    humanIds.forEach(actorId => {
      const choice = signal.votes[actorId];
      if (!ROOM_SIGNAL_CHOICES[choice]) return;
      counts[choice] += 1;
      totalVotes += 1;
    });
    let choice = null;
    ROOM_SIGNAL_ORDER.forEach(candidate => {
      if (counts[candidate] > 0 && (!choice || counts[candidate] > counts[choice])) choice = candidate;
    });
    const definition = choice ? ROOM_SIGNAL_CHOICES[choice] : null;
    return {
      schema: ROOM_SIGNAL_SCHEMA,
      targetRound: signal.targetRound,
      choice,
      title: definition ? definition.title : null,
      cue: definition ? definition.cue : 'VOTE ON YOUR PHONE',
      count: choice ? counts[choice] : 0,
      totalVotes,
      eligibleHumans: humanIds.length,
      counts
    };
  }
  function createShowMemory(baseSeed, source) {
    const previous = source || {};
    return {
      schema: SHOW_SCHEMA,
      baseSeed: normalizeSeed(previous.baseSeed === undefined ? baseSeed : previous.baseSeed),
      roundNumber: Math.max(0, Math.floor(Number(previous.roundNumber) || 0)),
      completedRounds: Math.max(0, Math.floor(Number(previous.completedRounds) || 0)),
      totalScore: Math.max(0, Math.floor(Number(previous.totalScore) || 0)),
      bestScore: Math.max(0, Math.floor(Number(previous.bestScore) || 0)),
      bestRank: String(previous.bestRank || 'WARM-UP'),
      totalActsCleared: Math.max(0, Math.floor(Number(previous.totalActsCleared) || 0)),
      history: Array.isArray(previous.history) ? clone(previous.history).slice(-SHOW_HISTORY_LIMIT) : [],
      roomSignal: normalizeStoredRoomSignal(previous.roomSignal),
      next: null
    };
  }
  function setlistDefinition(kind) {
    const pools = Object.values(SETLIST_LIBRARY);
    for (const pool of pools) {
      const found = pool.find(definition => definition.kind === kind);
      if (found) return found;
    }
    return null;
  }
  function deriveAdaptiveConductorPlan(show, seed) {
    const memory = show || {};
    const history = Array.isArray(memory.history) ? memory.history : [];
    const latest = history.length ? history[history.length - 1] : null;
    if (!latest) {
      return {
        schema: CONDUCTOR_SCHEMA,
        mode: 'opening',
        title: 'OPENING SET',
        cue: 'ESTABLISH THE ROOM',
        reason: 'First round establishes the room’s rhythm before the show adapts.',
        sourceRound: null,
        actKinds: null
      };
    }
    const actsCleared = Math.max(0, Number(latest.actsCleared || 0));
    const humanBanked = Math.max(0, Number(latest.humanBanked || 0));
    const humanPulses = Math.max(0, Number(latest.humanPulses || 0));
    const perfectSurges = Math.max(0, Number(latest.perfectSurges || 0));
    const bestStreak = Math.max(0, Number(latest.bestStreak || 0));
    const rank = String(latest.rank || 'WARM-UP');
    const sourceRound = Math.max(1, Number(latest.roundNumber || history.length));
    if (!humanBanked || !humanPulses || actsCleared === 0 || rank === 'WARM-UP') {
      return {
        schema: CONDUCTOR_SCHEMA,
        mode: 'reconnect',
        title: 'RECONNECT SET',
        cue: 'CLEARER HUMAN LINK',
        reason: 'Round ' + sourceRound + ' needs a clearer human link, so the next set serves direct room cues.',
        sourceRound,
        actKinds: ['human-pulses', 'all-seat-bank', 'chain-four']
      };
    }
    if (!perfectSurges || bestStreak < 4 || actsCleared < 3) {
      const focus = !perfectSurges ? 'a perfect choir' : bestStreak < 4 ? 'a four-bank chain' : 'the last uncleared act';
      return {
        schema: CONDUCTOR_SCHEMA,
        mode: 'lock-in',
        title: 'LOCK-IN SET',
        cue: 'PRACTICE ' + focus.toUpperCase(),
        reason: 'Round ' + sourceRound + ' found momentum; the next set practices ' + focus + '.',
        sourceRound,
        actKinds: [humanBanked > humanPulses ? 'human-pulses' : 'human-triad', !perfectSurges ? 'perfect-choir' : 'all-seat-bank', bestStreak < 4 ? 'chain-four' : 'wild-two']
      };
    }
    return {
      schema: CONDUCTOR_SCHEMA,
      mode: 'headliner',
      title: 'HEADLINER SET',
      cue: 'RAISE COORDINATION PRESSURE',
      reason: 'Round ' + sourceRound + ' cleared the room; the next set raises coordination pressure.',
      sourceRound,
      actKinds: ['human-triad', 'perfect-choir', 'wild-two']
    };
  }
  function deriveConductorPlan(show, seed, players) {
    const plan = deriveAdaptiveConductorPlan(show, seed);
    const signal = resolveRoomSignal(show, players);
    if (!signal) return plan;
    plan.roomSignal = signal;
    if (!signal.choice) return plan;
    const definition = ROOM_SIGNAL_CHOICES[signal.choice];
    plan.baseActKinds = Array.isArray(plan.actKinds) ? clone(plan.actKinds) : null;
    plan.actKinds = clone(definition.actKinds);
    plan.reason += ' Room Signal chose ' + definition.title + ' (' + signal.count + '/' + signal.totalVotes + ' human vote' + (signal.totalVotes === 1 ? '' : 's') + '), so this set emphasizes ' + definition.explanation + '.';
    return plan;
  }
  function setlistChoice(seed, salt, options, cadence) {
    const stride = Math.max(1, Math.floor(Number(cadence) || 1));
    const mixed = (Math.floor((normalizeSeed(seed)) / stride) + (salt >>> 0)) >>> 0;
    return options[mixed % options.length];
  }
  function createSetlist(seed, players, conductor) {
    const playerCount = Math.max(1, Object.keys(players || {}).length || Number(players) || 1);
    const baseline = [
      setlistChoice(seed, 0x13579bdf, SETLIST_LIBRARY.human, 1),
      setlistChoice(seed, 0x2468ace0, SETLIST_LIBRARY.team, 2),
      setlistChoice(seed, 0x5f3759df, SETLIST_LIBRARY.flow, 4)
    ];
    const plan = conductor && conductor.schema === CONDUCTOR_SCHEMA ? clone(conductor) : deriveConductorPlan(null, seed);
    const adapted = Array.isArray(plan.actKinds) && plan.actKinds.length === 3
      ? plan.actKinds.map(setlistDefinition)
      : null;
    const definitions = adapted && adapted.every(Boolean) ? adapted : baseline;
    return {
      schema: 'axm.pulse-choir-live-setlist/v1',
      conductor: plan,
      activeIndex: null,
      completed: 0,
      missed: 0,
      bonusScore: 0,
      advanceAt: null,
      acts: definitions.map((definition, index) => ({
        id: 'act-' + (index + 1) + '-' + definition.kind,
        index,
        kind: definition.kind,
        title: definition.title,
        instruction: definition.instruction,
        glyph: definition.glyph,
        target: definition.target === 'players' ? playerCount : definition.target,
        reward: definition.reward,
        humanRequired: definition.humanRequired,
        progress: 0,
        contributors: [],
        status: 'queued',
        startedAt: null,
        endsAt: null,
        completedAt: null
      }))
    };
  }
  function setShowNext(show, players) {
    const nextRoundNumber = Math.max(1, Number(show.completedRounds || 0) + 1);
    const position = showPosition(nextRoundNumber);
    const seed = deriveRoundSeed(show.baseSeed, nextRoundNumber);
    ensureRoomSignal(show);
    const conductor = deriveConductorPlan(show, seed, players);
    const setlist = createSetlist(seed, players, conductor);
    show.next = {
      roundNumber: nextRoundNumber,
      showNumber: position.showNumber,
      roundInShow: position.roundInShow,
      seed,
      conductor: clone(conductor),
      acts: setlist.acts.map(act => ({ kind: act.kind, title: act.title, glyph: act.glyph, humanRequired: act.humanRequired }))
    };
    return show.next;
  }
  function normalizeConductorState(state) {
    if (!state || !state.show || !state.players || !state.setlist) return false;
    const before = JSON.stringify({ next: state.show.next, conductor: state.setlist.conductor, acts: state.phase === PHASES.LOBBY ? state.setlist.acts : null });
    if (state.phase === PHASES.RESULTS) {
      setShowNext(state.show, state.players);
      if (!state.setlist.conductor || state.setlist.conductor.schema !== CONDUCTOR_SCHEMA) {
        const priorShow = createShowMemory(state.show.baseSeed || state.seed, state.show);
        priorShow.history = priorShow.history.slice(0, -1);
        priorShow.completedRounds = Math.max(0, Number(priorShow.completedRounds || 0) - 1);
        priorShow.roomSignal = null;
        state.setlist.conductor = deriveConductorPlan(priorShow, state.seed, state.players);
      }
      if (state.result) {
        state.result.show = clone(state.show);
        state.result.setlist = clone(state.setlist);
      }
    } else {
      setShowNext(state.show, state.players);
      const plan = state.phase === PHASES.LOBBY
        ? state.show.next.conductor
        : deriveConductorPlan(state.show, state.seed, state.players);
      if (state.phase === PHASES.LOBBY) state.setlist = createSetlist(state.show.next.seed, state.players, plan);
      else state.setlist.conductor = plan;
    }
    return before !== JSON.stringify({ next: state.show.next, conductor: state.setlist.conductor, acts: state.phase === PHASES.LOBBY ? state.setlist.acts : null });
  }
  function activeSetlistAct(state) {
    if (!state.setlist || state.setlist.activeIndex === null) return null;
    return state.setlist.acts[state.setlist.activeIndex] || null;
  }
  function openSetlistAct(state, index, now) {
    const act = state.setlist && state.setlist.acts[index];
    if (!act) {
      if (state.setlist) state.setlist.activeIndex = null;
      return false;
    }
    state.setlist.activeIndex = index;
    state.setlist.advanceAt = null;
    act.status = 'active';
    act.startedAt = now;
    act.endsAt = Math.min(state.roundEndsAt || now + METRICS.setlistActMs, now + METRICS.setlistActMs);
    commitEvent(state, 'setlist-open-' + act.id, 'setlist-open', 'LIVE SETLIST · ' + act.title + ': ' + act.instruction, now, { act: clone(act) });
    return true;
  }
  function startSetlist(state, now) {
    if (!state.setlist || !state.setlist.acts.length || state.setlist.activeIndex !== null) return false;
    return openSetlistAct(state, 0, now);
  }
  function completeSetlistAct(state, act, now) {
    if (!act || act.status !== 'active') return false;
    act.progress = act.target;
    act.status = 'completed';
    act.completedAt = now;
    act.endsAt = now;
    state.setlist.completed += 1;
    state.setlist.bonusScore += act.reward;
    state.setlist.advanceAt = now + METRICS.setlistTransitionMs;
    state.score += act.reward;
    commitEvent(state, 'setlist-complete-' + act.id, 'setlist-complete', act.title + ' CLEARED · +' + act.reward + ' SETLIST BONUS', now, { act: clone(act), completed: state.setlist.completed, total: state.setlist.acts.length });
    return true;
  }
  function recordSetlistEvent(state, event, now) {
    const act = activeSetlistAct(state);
    if (!act || act.status !== 'active' || !event) return false;
    const player = event.player && state.players[event.player];
    let changed = false;
    if (act.kind === 'human-triad' && event.type === 'bank' && event.triad && player && player.type === 'human') {
      act.progress = 1;
      if (!act.contributors.includes(player.id)) act.contributors.push(player.id);
      changed = true;
    } else if (act.kind === 'human-pulses' && event.type === 'pulse' && player && player.type === 'human') {
      act.progress += 1;
      if (!act.contributors.includes(player.id)) act.contributors.push(player.id);
      changed = true;
    } else if (act.kind === 'all-seat-bank' && event.type === 'bank' && player) {
      if (!act.contributors.includes(player.id)) {
        act.contributors.push(player.id);
        act.progress = act.contributors.length;
        changed = true;
      }
    } else if (act.kind === 'perfect-choir' && event.type === 'sync-result' && event.perfect) {
      act.progress = 1;
      act.contributors = Object.keys(state.players);
      changed = true;
    } else if (act.kind === 'chain-four' && event.type === 'bank') {
      act.progress = Math.max(act.progress, Number(event.streak || 0));
      if (player && !act.contributors.includes(player.id)) act.contributors.push(player.id);
      changed = true;
    } else if (act.kind === 'wild-two' && event.type === 'bank') {
      const wilds = Array.isArray(event.cargo) ? event.cargo.filter(kind => kind === 'wild').length : 0;
      if (wilds) {
        act.progress += wilds;
        if (player && !act.contributors.includes(player.id)) act.contributors.push(player.id);
        changed = true;
      }
    }
    if (!changed) return false;
    act.progress = Math.min(act.target, act.progress);
    if (act.progress >= act.target) completeSetlistAct(state, act, now);
    return true;
  }
  function updateSetlistClock(state, now) {
    if (!state.setlist) return false;
    if (state.setlist.advanceAt !== null && now >= state.setlist.advanceAt) {
      const nextIndex = Number(state.setlist.activeIndex) + 1;
      if (nextIndex < state.setlist.acts.length) return openSetlistAct(state, nextIndex, now);
      state.setlist.activeIndex = null;
      state.setlist.advanceAt = null;
      commitEvent(state, 'setlist-closed', 'setlist-closed', 'LIVE SETLIST CLOSED · ' + state.setlist.completed + '/' + state.setlist.acts.length + ' acts cleared.', now, { completed: state.setlist.completed, total: state.setlist.acts.length });
      return true;
    }
    const act = activeSetlistAct(state);
    if (act && act.status === 'active' && now >= act.endsAt) {
      act.status = 'missed';
      act.endsAt = now;
      state.setlist.missed += 1;
      state.setlist.advanceAt = now + METRICS.setlistTransitionMs;
      commitEvent(state, 'setlist-missed-' + act.id, 'setlist-missed', act.title + ' MISSED · next act incoming.', now, { act: clone(act) });
      return true;
    }
    return false;
  }
  function closeSetlist(state, now) {
    if (!state.setlist) return;
    state.setlist.acts.forEach(act => {
      if (act.status === 'completed' || act.status === 'missed') return;
      act.status = 'missed';
      act.endsAt = now;
      state.setlist.missed += 1;
    });
    state.setlist.activeIndex = null;
    state.setlist.advanceAt = null;
  }
  function spawnBeat(state, forced) {
    const roll = nextRandom(state);
    const kind = forced && forced.kind || (roll < 0.58 ? 'spark' : roll < 0.86 ? 'chord' : 'wild');
    let x = forced && Number(forced.x);
    let y = forced && Number(forced.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      for (let tries = 0; tries < 16; tries += 1) {
        x = 7 + nextRandom(state) * (METRICS.arenaWidth - 14);
        y = 7 + nextRandom(state) * (METRICS.arenaHeight - 14);
        if (Math.hypot(x - METRICS.coreX, y - METRICS.coreY) > METRICS.coreRadius + 7) break;
      }
    }
    const beat = { id: nextId(state, 'beat'), kind, x, y, bornAt: state.clockMs };
    state.beats.push(beat);
    return beat;
  }
  function refillBeats(state) {
    while (state.beats.length < METRICS.targetBeatCount) spawnBeat(state);
  }
  function createPlayers(roster) {
    const players = {};
    const seats = normalizeRoster(roster);
    seats.forEach((seat, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / Math.max(4, seats.length));
      const recipe = PLAYER_RECIPES[index % PLAYER_RECIPES.length];
      players[seat.id] = {
        id: seat.id,
        seatId: seat.seatId,
        name: seat.name,
        type: seat.type,
        recipe: clone(recipe),
        x: METRICS.coreX + Math.cos(angle) * 15,
        y: METRICS.coreY + Math.sin(angle) * 15,
        vx: 0,
        vy: 0,
        input: { x: 0, y: 0, expiresAt: 0 },
        lastSequence: 0,
        pulseBufferedUntil: 0,
        pulsedSyncId: null,
        stunnedUntil: 0,
        carrying: [],
        collected: 0,
        banked: 0,
        pulseContributions: 0,
        glitchHits: 0,
        shieldCharges: 0,
        lastGlitchId: null,
        ai: seat.type === 'ai' ? { nextDecisionAt: 0, intent: 'idle' } : null
      };
    });
    return players;
  }
  function createInitialState(roster, options) {
    const settings = options || {};
    const configuredSeed = normalizeSeed(settings.baseSeed === undefined ? settings.seed : settings.baseSeed);
    const show = createShowMemory(configuredSeed, settings.show);
    const roundNumber = Math.max(0, Math.floor(Number(settings.roundNumber === undefined ? show.roundNumber : settings.roundNumber) || 0));
    show.roundNumber = roundNumber;
    const roundSeed = settings.seed === undefined ? deriveRoundSeed(show.baseSeed, Math.max(1, roundNumber || show.completedRounds + 1)) : normalizeSeed(settings.seed);
    const state = {
      schema: STATE_SCHEMA,
      gameId: GAME_ID,
      seed: roundSeed,
      rngState: roundSeed,
      revision: 0,
      nextEntityId: 0,
      clockMs: Number(settings.now || 0),
      phase: PHASES.LOBBY,
      phaseEndsAt: null,
      roundEndsAt: null,
      timeLeftMs: METRICS.roundMs,
      score: 0,
      surgeCount: 0,
      perfectSurges: 0,
      bestSync: 0,
      harmony: { streak: 0, bestStreak: 0, multiplier: 1, expiresAt: 0, lastBankPlayer: null },
      core: { x: METRICS.coreX, y: METRICS.coreY, radius: METRICS.coreRadius, charge: 0, glowUntil: 0 },
      players: createPlayers(roster),
      beats: [],
      sync: null,
      glitch: null,
      nextGlitchAt: null,
      glitchIndex: 0,
      show,
      setlist: null,
      message: 'Start the round when the room is ready.',
      events: [],
      pulseLedger: [],
      inputLedger: [],
      recentEventIds: [],
      result: null
    };
    state.setlist = createSetlist(state.seed, state.players, deriveConductorPlan(state.show, state.seed, state.players));
    setShowNext(state.show, state.players);
    refillBeats(state);
    return state;
  }
  function resetRoundState(state, now, options) {
    const settings = options || {};
    const roster = Object.values(state.players).sort(rosterSort).map(player => ({
      slot: Number(player.id.replace(/\D/g, '')),
      seat_id: player.seatId,
      display_name: player.name,
      type: player.type
    }));
    const show = createShowMemory(state.show && state.show.baseSeed || state.seed, state.show);
    const roundNumber = show.completedRounds + 1;
    const seed = deriveRoundSeed(show.baseSeed, Math.max(1, roundNumber));
    return createInitialState(roster, { baseSeed: show.baseSeed, seed, show, roundNumber, now });
  }
  function startRound(state, now) {
    if (![PHASES.LOBBY, PHASES.RESULTS].includes(state.phase)) return { ok: false, reason: 'round-already-active' };
    const fresh = resetRoundState(state, now, { advance: true });
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, fresh);
    state.phase = PHASES.COUNTDOWN;
    state.phaseEndsAt = now + METRICS.countdownMs;
    const position = showPosition(state.show.roundNumber);
    state.message = 'Show ' + position.showNumber + ', round ' + position.roundInShow + '. Collect, bank, then pulse together.';
    commitEvent(state, nextId(state, 'event'), 'round-countdown', state.message, now);
    state.revision += 1;
    return { ok: true, phase: state.phase, roundNumber: state.show.roundNumber, seed: state.seed };
  }
  function applyRoomSignal(state, actorId, choice, now) {
    if (!state || !state.show || !state.players) return { ok: false, reason: 'invalid-state' };
    if (![PHASES.LOBBY, PHASES.RESULTS].includes(state.phase)) return { ok: false, reason: 'room-signal-round-active' };
    if (Number(state.show.completedRounds || 0) < 1) return { ok: false, reason: 'room-signal-not-open' };
    const player = state.players[String(actorId || '')];
    if (!player) return { ok: false, reason: 'unknown-player' };
    if (player.type !== 'human') return { ok: false, reason: 'room-signal-human-only' };
    const choiceId = String(choice || '').toLowerCase();
    if (!ROOM_SIGNAL_CHOICES[choiceId]) return { ok: false, reason: 'invalid-room-signal' };
    const signal = ensureRoomSignal(state.show);
    if (signal.votes[player.id] === choiceId) {
      const resolved = resolveRoomSignal(state.show, state.players);
      return { ok: true, changed: false, choice: choiceId, roomSignal: resolved, next: clone(state.show.next) };
    }
    signal.votes[player.id] = choiceId;
    const next = setShowNext(state.show, state.players);
    const resolved = next.conductor.roomSignal;
    if (state.phase === PHASES.LOBBY) state.setlist = createSetlist(next.seed, state.players, next.conductor);
    if (state.result) state.result.show = clone(state.show);
    const message = player.name + ' chose ' + ROOM_SIGNAL_CHOICES[choiceId].title + '. Room Signal: ' + (resolved.title || 'OPEN') + ' ' + resolved.count + '/' + resolved.totalVotes + '.';
    commitEvent(state, nextId(state, 'room-signal'), 'room-signal', message, now, { player: player.id, choice: choiceId, resolved: clone(resolved) });
    state.revision += 1;
    return { ok: true, changed: true, choice: choiceId, roomSignal: clone(resolved), next: clone(next) };
  }
  function logInput(state, player, action, now, accepted, reason) {
    pushBounded(state.inputLedger, {
      player: player.id,
      sequence: action.seq,
      type: action.type,
      x: action.x,
      y: action.y,
      at: now,
      accepted,
      reason: reason || null
    }, 96);
  }
  function logPulse(state, player, stage, now, extra) {
    pushBounded(state.pulseLedger, Object.assign({
      id: nextId(state, 'pulse'),
      player: player.id,
      stage,
      at: now,
      syncId: state.sync && state.sync.id || null
    }, extra || {}), 48);
  }
  function activatePulse(state, player, now) {
    logPulse(state, player, 'intent', now);
    if (state.phase !== PHASES.PLAYING) {
      logPulse(state, player, 'result', now, { accepted: false, reason: 'round-not-playing' });
      return { ok: false, reason: 'round-not-playing' };
    }
    if (!state.sync) {
      player.pulseBufferedUntil = now + METRICS.pulseBufferMs;
      logPulse(state, player, 'result', now, { accepted: true, reason: 'buffered-for-sync' });
      return { ok: true, buffered: true };
    }
    if (player.pulsedSyncId === state.sync.id) {
      logPulse(state, player, 'result', now, { accepted: false, reason: 'already-pulsed' });
      return { ok: false, reason: 'already-pulsed' };
    }
    logPulse(state, player, 'active', now, { windowEndsAt: state.sync.endsAt });
    player.pulsedSyncId = state.sync.id;
    player.pulseContributions += 1;
    state.sync.pulses.push({ player: player.id, at: now });
    logPulse(state, player, 'result', now, { accepted: true, contribution: 1 });
    commitEvent(state, 'pulse-commit-' + state.sync.id + '-' + player.id, 'pulse', player.name + ' joined the pulse.', now, { player: player.id });
    recordSetlistEvent(state, { type: 'pulse', player: player.id }, now);
    return { ok: true, pulsed: true };
  }
  function applyAction(state, actorId, rawAction, now) {
    const player = state.players[actorId];
    if (!player) return { ok: false, reason: 'unknown-player' };
    const action = Object.assign({}, rawAction || {});
    action.type = String(action.type || '').toLowerCase();
    const suppliedSequence = Math.floor(Number(action.seq || 0));
    action.seq = suppliedSequence > 0 ? suppliedSequence : player.lastSequence + 1;
    if (action.seq <= player.lastSequence) {
      logInput(state, player, action, now, false, 'stale-sequence');
      return { ok: false, reason: 'stale-sequence', lastSequence: player.lastSequence };
    }
    player.lastSequence = action.seq;
    if (action.type === 'move') {
      const vector = normalizeVector(action.x, action.y);
      player.input = { x: vector.x, y: vector.y, expiresAt: now + METRICS.inputTtlMs };
      logInput(state, player, action, now, true);
      state.revision += 1;
      return { ok: true, input: clone(player.input) };
    }
    if (action.type === 'pulse') {
      const result = activatePulse(state, player, now);
      logInput(state, player, action, now, result.ok, result.reason);
      state.revision += 1;
      return result;
    }
    logInput(state, player, action, now, false, 'unsupported-action');
    return { ok: false, reason: 'unsupported-action' };
  }
  function openSync(state, now) {
    if (state.sync || state.core.charge < 100) return false;
    state.core.charge = 100;
    state.sync = { id: nextId(state, 'sync'), openedAt: now, endsAt: now + METRICS.syncWindowMs, pulses: [] };
    Object.values(state.players).forEach(player => { player.pulsedSyncId = null; });
    commitEvent(state, 'sync-open-' + state.sync.id, 'sync-open', 'PULSE WINDOW: hit it together!', now, { endsAt: state.sync.endsAt });
    return true;
  }
  function resolveSync(state, now) {
    if (!state.sync) return false;
    const playerCount = Object.keys(state.players).length;
    const hits = state.sync.pulses.length;
    const perfect = hits === playerCount && playerCount > 0;
    const award = hits ? hits * 45 + (perfect ? 220 : 0) : 0;
    state.score += award;
    state.bestSync = Math.max(state.bestSync, hits);
    state.surgeCount += 1;
    if (perfect) {
      state.perfectSurges += 1;
      Object.values(state.players).forEach(player => {
        player.shieldCharges = Math.min(2, player.shieldCharges + METRICS.perfectShieldCharges);
      });
    }
    state.core.charge = 0;
    state.core.glowUntil = now + 850;
    const syncId = state.sync.id;
    state.sync = null;
    const message = hits
      ? (perfect ? 'PERFECT CHOIR! +' + award + ' - TEAM SHIELDS READY' : hits + '/' + playerCount + ' pulse · +' + award)
      : 'The pulse window faded. Rebuild the rhythm.';
    commitEvent(state, 'sync-result-' + syncId, 'sync-result', message, now, { hits, playerCount, perfect, award, shieldsGranted: perfect ? METRICS.perfectShieldCharges : 0 });
    recordSetlistEvent(state, { type: 'sync-result', perfect, hits, playerCount }, now);
    return true;
  }
  function collectBeats(state, player, now) {
    if (player.carrying.length >= METRICS.maxCarry) return;
    for (let index = state.beats.length - 1; index >= 0; index -= 1) {
      if (player.carrying.length >= METRICS.maxCarry) break;
      const beat = state.beats[index];
      if (distance(player, beat) > METRICS.playerRadius + METRICS.beatRadius) continue;
      state.beats.splice(index, 1);
      player.carrying.push(beat.kind);
      player.collected += 1;
      commitEvent(state, 'collect-' + beat.id, 'collect', player.name + ' caught a ' + BEAT_TYPES[beat.kind].label + '.', now, { player: player.id, beat: beat.id, kind: beat.kind });
    }
  }
  function bankCarry(state, player, now) {
    if (!player.carrying.length || distance(player, state.core) > METRICS.coreRadius + METRICS.playerRadius) return false;
    const cargo = player.carrying.splice(0);
    const baseCharge = cargo.reduce((total, kind) => total + BEAT_TYPES[kind].value, 0);
    const baseScore = cargo.reduce((total, kind) => total + BEAT_TYPES[kind].score, 0);
    const fullCarry = cargo.length === METRICS.maxCarry;
    const triad = fullCarry && new Set(cargo).size === METRICS.maxCarry;
    const chainAlive = state.harmony.expiresAt >= now;
    state.harmony.streak = chainAlive ? state.harmony.streak + 1 : 1;
    state.harmony.bestStreak = Math.max(state.harmony.bestStreak, state.harmony.streak);
    state.harmony.multiplier = 1 + Math.min(4, state.harmony.streak - 1) * 0.25;
    state.harmony.expiresAt = now + METRICS.harmonyWindowMs;
    state.harmony.lastBankPlayer = player.id;
    const chargeBonus = triad ? METRICS.triadChargeBonus : 0;
    const scoreBonus = triad ? METRICS.triadScoreBonus : fullCarry ? METRICS.fullCarryScoreBonus : 0;
    const charge = baseCharge + chargeBonus;
    const scoreFactor = player.type === 'ai' ? METRICS.aiScoreFactor : 1;
    const score = Math.round((baseScore + scoreBonus) * state.harmony.multiplier * scoreFactor);
    const wilds = cargo.filter(kind => kind === 'wild').length;
    player.banked += cargo.length;
    state.core.charge = Math.min(100, state.core.charge + charge);
    state.score += score;
    if (wilds && state.nextGlitchAt) state.nextGlitchAt = Math.max(now + 850, state.nextGlitchAt - wilds * 700);
    const message = triad
      ? 'TRIAD! ' + player.name + ' scored ' + score + ' and supercharged the core.'
      : player.name + ' banked ' + cargo.length + ' beat' + (cargo.length === 1 ? '' : 's') + ' · +' + charge + '% core.';
    commitEvent(state, nextId(state, 'bank'), triad ? 'triad-bank' : 'bank', message, now, {
      player: player.id,
      cargo,
      charge,
      score,
      baseCharge,
      baseScore,
      chargeBonus,
      scoreBonus,
      fullCarry,
      triad,
      streak: state.harmony.streak,
      multiplier: state.harmony.multiplier,
      scoreFactor
    });
    recordSetlistEvent(state, { type: 'bank', player: player.id, cargo, triad, streak: state.harmony.streak }, now);
    openSync(state, now);
    return true;
  }
  function createGlitch(state, now) {
    state.glitchIndex += 1;
    const axis = state.glitchIndex % 2 ? 'horizontal' : 'vertical';
    const extent = axis === 'horizontal' ? METRICS.arenaHeight : METRICS.arenaWidth;
    const line = 10 + nextRandom(state) * (extent - 20);
    state.glitch = {
      id: nextId(state, 'glitch'),
      axis,
      line,
      phase: 'telegraph',
      warningUntil: now + METRICS.glitchWarningMs,
      activeUntil: now + METRICS.glitchWarningMs + METRICS.glitchActiveMs
    };
    commitEvent(state, 'glitch-warning-' + state.glitch.id, 'glitch-warning', 'GLITCH INCOMING · leave the striped lane.', now, { axis, line, warningUntil: state.glitch.warningUntil });
  }
  function updateGlitch(state, now) {
    if (!state.glitch) {
      if (state.nextGlitchAt && now >= state.nextGlitchAt) createGlitch(state, now);
      return;
    }
    const glitch = state.glitch;
    if (glitch.phase === 'telegraph' && now >= glitch.warningUntil) {
      glitch.phase = 'active';
      commitEvent(state, 'glitch-active-' + glitch.id, 'glitch-active', 'GLITCH ACTIVE!', now, { id: glitch.id });
    }
    if (glitch.phase === 'active') {
      Object.values(state.players).forEach(player => {
        const coordinate = glitch.axis === 'horizontal' ? player.y : player.x;
        if (Math.abs(coordinate - glitch.line) > METRICS.glitchThickness / 2 + METRICS.playerRadius) return;
        if (player.lastGlitchId === glitch.id) return;
        player.lastGlitchId = glitch.id;
        if (player.shieldCharges > 0) {
          player.shieldCharges -= 1;
          commitEvent(state, 'glitch-block-' + glitch.id + '-' + player.id, 'glitch-block', player.name + ' turned a choir shield into a clean save!', now, { player: player.id });
          return;
        }
        player.glitchHits += 1;
        state.harmony.streak = 0;
        state.harmony.multiplier = 1;
        state.harmony.expiresAt = 0;
        player.stunnedUntil = now + 650;
        const droppedKind = player.carrying.pop();
        if (droppedKind) spawnBeat(state, { kind: droppedKind, x: player.x + 3, y: player.y });
        commitEvent(state, 'glitch-hit-' + glitch.id + '-' + player.id, 'glitch-hit', player.name + (droppedKind ? ' dropped one beat.' : ' was scrambled.'), now, { player: player.id, droppedKind: droppedKind || null });
      });
    }
    if (now >= glitch.activeUntil) {
      commitEvent(state, 'glitch-clear-' + glitch.id, 'glitch-clear', 'Lane clear. Rebuild the rhythm.', now);
      state.glitch = null;
      state.nextGlitchAt = now + Math.max(3900, 6400 - state.surgeCount * 260);
    }
  }
  function finishRound(state, now) {
    if (state.phase !== PHASES.PLAYING) return false;
    if (state.sync) resolveSync(state, now);
    closeSetlist(state, now);
    state.phase = PHASES.RESULTS;
    state.phaseEndsAt = null;
    state.roundEndsAt = null;
    state.timeLeftMs = 0;
    Object.values(state.players).forEach(player => { player.input = { x: 0, y: 0, expiresAt: 0 }; });
    const rank = rankForScore(state.score);
    const show = createShowMemory(state.show && state.show.baseSeed || state.seed, state.show);
    const roundNumber = Math.max(1, Number(show.roundNumber || show.completedRounds + 1));
    show.roundNumber = roundNumber;
    show.completedRounds = Math.max(show.completedRounds, roundNumber);
    show.totalScore += state.score;
    show.bestScore = Math.max(show.bestScore, state.score);
    if (rankTier(rank) > rankTier(show.bestRank)) show.bestRank = rank;
    show.totalActsCleared += state.setlist.completed;
    const position = showPosition(roundNumber);
    const humanPlayers = Object.values(state.players).filter(player => player.type === 'human');
    pushBounded(show.history, {
      roundNumber,
      showNumber: position.showNumber,
      roundInShow: position.roundInShow,
      seed: state.seed,
      score: state.score,
      rank,
      actsCleared: state.setlist.completed,
      perfectSurges: state.perfectSurges,
      bestStreak: state.harmony.bestStreak,
      totalGlitchHits: Object.values(state.players).reduce((sum, player) => sum + Number(player.glitchHits || 0), 0),
      humanBanked: humanPlayers.reduce((sum, player) => sum + Number(player.banked || 0), 0),
      humanPulses: humanPlayers.reduce((sum, player) => sum + Number(player.pulseContributions || 0), 0),
      roomSignal: clone(state.setlist.conductor && state.setlist.conductor.roomSignal || null),
      setlist: state.setlist.acts.map(act => ({ kind: act.kind, title: act.title, status: act.status }))
    }, SHOW_HISTORY_LIMIT);
    setShowNext(show, state.players);
    state.show = show;
    state.result = {
      roundNumber,
      score: state.score,
      rank,
      surges: state.surgeCount,
      perfectSurges: state.perfectSurges,
      bestSync: state.bestSync,
      bestStreak: state.harmony.bestStreak,
      show: clone(show),
      setlist: clone(state.setlist),
      players: Object.values(state.players).sort(rosterSort).map(player => ({
        id: player.id,
        name: player.name,
        collected: player.collected,
        banked: player.banked,
        pulses: player.pulseContributions,
        glitchHits: player.glitchHits
      }))
    };
    commitEvent(state, nextId(state, 'result'), 'round-result', 'ROUND ' + roundNumber + ' · ' + rank + ' · ' + state.score + ' points. The next Setlist is ready.', now, clone(state.result));
    state.revision += 1;
    return true;
  }
  function step(state, dtMs, now) {
    const dt = clamp(dtMs, 0, 100);
    state.clockMs = now;
    if (state.phase === PHASES.COUNTDOWN) {
      if (now >= state.phaseEndsAt) {
        state.phase = PHASES.PLAYING;
        state.phaseEndsAt = null;
        state.roundEndsAt = now + METRICS.roundMs;
        state.nextGlitchAt = now + 6200;
        state.message = 'Catch beats. Bank at the core. Pulse together.';
        commitEvent(state, nextId(state, 'event'), 'round-start', state.message, now);
        startSetlist(state, now);
      }
      state.revision += 1;
      return state;
    }
    if (state.phase !== PHASES.PLAYING) return state;
    state.timeLeftMs = Math.max(0, state.roundEndsAt - now);
    updateSetlistClock(state, now);
    if (state.harmony.streak && state.harmony.expiresAt < now) {
      state.harmony.streak = 0;
      state.harmony.multiplier = 1;
      state.harmony.expiresAt = 0;
    }
    const players = Object.values(state.players).sort(rosterSort);
    players.forEach(player => {
      if (player.input.expiresAt < now) player.input = { x: 0, y: 0, expiresAt: 0 };
      const stunned = player.stunnedUntil > now;
      const carrySlow = 1 - player.carrying.length * 0.08;
      const seatPace = player.type === 'ai' ? 0.76 : 1;
      const speed = stunned ? 0 : METRICS.playerSpeed * carrySlow * seatPace;
      player.vx = player.input.x * speed;
      player.vy = player.input.y * speed;
      player.x = clamp(player.x + player.vx * dt / 1000, METRICS.playerRadius, METRICS.arenaWidth - METRICS.playerRadius);
      player.y = clamp(player.y + player.vy * dt / 1000, METRICS.playerRadius, METRICS.arenaHeight - METRICS.playerRadius);
      collectBeats(state, player, now);
      bankCarry(state, player, now);
    });
    refillBeats(state);
    if (state.sync) {
      players.forEach(player => {
        if (player.pulseBufferedUntil >= now && player.pulsedSyncId !== state.sync.id) {
          player.pulseBufferedUntil = 0;
          activatePulse(state, player, now);
        }
      });
      if (state.sync && (state.sync.pulses.length >= players.length || now >= state.sync.endsAt)) resolveSync(state, now);
    }
    updateGlitch(state, now);
    if (state.timeLeftMs <= 0) finishRound(state, now);
    state.revision += 1;
    return state;
  }
  function chooseAiIntent(state, actorId, now) {
    const player = state.players[actorId];
    if (!player || player.type !== 'ai') return { type: 'idle', reason: 'not-ai' };
    if (state.phase !== PHASES.PLAYING) return { type: 'idle', reason: 'round-not-playing' };
    if (state.sync && player.pulsedSyncId !== state.sync.id) return { type: 'pulse', reason: 'join-sync' };
    if (player.stunnedUntil > now) return { type: 'move', x: 0, y: 0, reason: 'stunned' };
    let target;
    if (player.carrying.length >= METRICS.maxCarry || (player.carrying.length && state.core.charge >= 78)) target = state.core;
    else {
      const carriedKinds = new Set(player.carrying);
      target = state.beats.slice().sort((a, b) => {
        const aPenalty = carriedKinds.has(a.kind) ? 16 : 0;
        const bPenalty = carriedKinds.has(b.kind) ? 16 : 0;
        return distance(player, a) + aPenalty - distance(player, b) - bPenalty;
      })[0] || state.core;
    }
    const vector = normalizeVector(target.x - player.x, target.y - player.y);
    return { type: 'move', x: vector.x, y: vector.y, reason: target === state.core ? 'bank' : 'collect', targetId: target.id || 'core' };
  }
  function executeAiIntent(state, actorId, intent, now) {
    const player = state.players[actorId];
    if (!player || player.type !== 'ai') return { ok: false, reason: 'not-ai' };
    const action = Object.assign({}, intent || {}, { seq: player.lastSequence + 1 });
    player.ai.intent = action.reason || action.type;
    player.ai.nextDecisionAt = now + 240;
    if (action.type === 'idle') {
      player.input = { x: 0, y: 0, expiresAt: 0 };
      return { ok: true, idle: true, reason: action.reason || 'idle' };
    }
    return applyAction(state, actorId, action, now);
  }
  function tickAi(state, now) {
    Object.values(state.players).filter(player => player.type === 'ai').forEach(player => {
      if (!player.ai || player.ai.nextDecisionAt > now) return;
      executeAiIntent(state, player.id, chooseAiIntent(state, player.id, now), now);
    });
  }
  function observe(state, actorId) {
    const player = state.players[actorId];
    if (!player) return null;
    return {
      schema: 'axm.pulse-choir-seat-observation/v1',
      player: clone(player),
      phase: state.phase,
      timeLeftMs: state.timeLeftMs,
      score: state.score,
      core: clone(state.core),
      harmony: clone(state.harmony),
      perfectSurges: state.perfectSurges,
      show: clone(state.show),
      setlist: clone(state.setlist),
      sync: clone(state.sync),
      glitch: clone(state.glitch),
      visibleBeats: state.beats.map(beat => ({ id: beat.id, kind: beat.kind, x: beat.x, y: beat.y })),
      teammates: Object.values(state.players).filter(item => item.id !== actorId).map(item => ({ id: item.id, name: item.name, x: item.x, y: item.y, carrying: item.carrying.length, pulsed: item.pulsedSyncId === (state.sync && state.sync.id) })),
      legalActions: ['move-vector', 'pulse'],
      authority: 'server'
    };
  }
  function snapshot(state) { return clone(state); }

  return {
    ASSET_CONTRACT,
    BEAT_TYPES,
    CONDUCTOR_SCHEMA,
    GAME_ID,
    INPUT_SCHEMA,
    METRICS,
    PHASES,
    PLAYER_RECIPES,
    ROOM_SIGNAL_CHOICES,
    ROOM_SIGNAL_ORDER,
    ROOM_SIGNAL_SCHEMA,
    SETLIST_LIBRARY,
    SHOW_SCHEMA,
    STATE_SCHEMA,
    activatePulse,
    applyRoomSignal,
    applyAction,
    chooseAiIntent,
    closeSetlist,
    clone,
    createInitialState,
    createShowMemory,
    createSetlist,
    deriveConductorPlan,
    deriveRoundSeed,
    distance,
    executeAiIntent,
    finishRound,
    normalizeRoster,
    normalizeConductorState,
    normalizeVector,
    observe,
    openSync,
    openSetlistAct,
    recordSetlistEvent,
    refillBeats,
    resolveRoomSignal,
    resetRoundState,
    resolveSync,
    snapshot,
    showPosition,
    spawnBeat,
    startRound,
    startSetlist,
    step,
    setShowNext,
    tickAi,
    updateSetlistClock
  };
});
