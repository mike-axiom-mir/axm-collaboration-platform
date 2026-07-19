(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMWalkableMissions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.1.0';
  var STATE_SCHEMA = 'axm.living-world.walkable-missions/v0.1';
  var INTERVAL_SECONDS = 600;
  var DURATION_SECONDS = 300;
  var HISTORY_LIMIT = 40;
  var CURRENCY = Object.freeze({
    id: 'festivalLaurels',
    label: 'Festival Laurels',
    symbol: '✦',
    role: 'Ceremonial mission currency reserved for later explicit monuments, festivals or exceptional edicts.',
    treasuryEquivalent: false,
    tradeable: false,
    spendingConnected: false
  });
  var MISSION_ORDER = ['INSPECTION_TOUR', 'GREEN_RIBBON', 'LUMBER_LEDGER', 'LAKE_LUNCH_AUDIT', 'CAMPFIRE_DIPLOMACY', 'SUPPER_SERVICE'];
  var DEFINITIONS = Object.freeze({
    INSPECTION_TOUR: Object.freeze({
      label: 'Presidential Inspection Tour',
      brief: 'Travel the island. The palace assures everyone this counts as fieldwork.',
      eventKind: 'TRAVEL', unit: 'surface units', baseGoal: 60, baseReward: 1
    }),
    GREEN_RIBBON: Object.freeze({
      label: 'The Green Ribbon Decree',
      brief: 'Plant saplings or reeds, or return caught fish. Ribbon-cutting scissors remain purely ceremonial.',
      eventKind: 'PLANT_LIFE', unit: 'living acts', baseGoal: 3, baseReward: 1
    }),
    LUMBER_LEDGER: Object.freeze({
      label: 'Ministry of Useful Lumber',
      brief: 'Gather wood for island works. The Ministry of Looking Out The Window recommends replanting.',
      eventKind: 'GATHER_WOOD', unit: 'wood', baseGoal: 6, baseReward: 1
    }),
    LAKE_LUNCH_AUDIT: Object.freeze({
      label: 'Lake Lunch Audit',
      brief: 'Catch fish before the lunch committee eats the agenda instead.',
      eventKind: 'CATCH_FISH', unit: 'fish caught', baseGoal: 2, baseReward: 2
    }),
    CAMPFIRE_DIPLOMACY: Object.freeze({
      label: 'Campfire Diplomacy',
      brief: 'Build gathering fires. Foreign dignitaries are optional; marshmallows are under review.',
      eventKind: 'BUILD_FIRE', unit: 'campfires', baseGoal: 1, baseReward: 1
    }),
    SUPPER_SERVICE: Object.freeze({
      label: 'Island Supper Service',
      brief: 'Cook fish at a campfire. The cabinet has bravely agreed to arrive after the cooking.',
      eventKind: 'COOK_FISH', unit: 'fish cooked', baseGoal: 2, baseReward: 2
    })
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function round(value, digits) { var p = Math.pow(10, digits == null ? 3 : digits); return Math.round(value * p) / p; }
  function nonNegative(value) { return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0; }
  function seedNumber(seed) {
    var text = String(seed == null ? 'grafthold-missions' : seed), hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0) || 0x6d2b79f5;
  }
  function draw(state) {
    var x = state.randomState >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.randomState = (x >>> 0) || 0x6d2b79f5;
    return state.randomState / 4294967296;
  }
  function normalContext(input) {
    var context = input || {};
    return {
      cooperative: context.cooperative === true,
      fishAlive: Math.floor(nonNegative(context.fishAlive)),
      rawFish: Math.floor(nonNegative(context.rawFish)),
      cookedFish: Math.floor(nonNegative(context.cookedFish)),
      rod: context.rod === true,
      fires: Math.floor(nonNegative(context.fires)),
      wood: nonNegative(context.wood),
      treeCount: Math.floor(nonNegative(context.treeCount))
    };
  }
  function createState(seed) {
    return {
      schema: STATE_SCHEMA,
      version: VERSION,
      clockSeconds: 0,
      sequence: 0,
      randomState: ((seedNumber(seed) ^ 0x51a7e1a) >>> 0) || 0x6d2b79f5,
      nextMissionAt: 0,
      lastDefinitionId: null,
      active: null,
      currency: { id: CURRENCY.id, label: CURRENCY.label, symbol: CURRENCY.symbol, balance: 0 },
      history: [],
      boundaries: {
        activePlayClockOnly: true,
        oneMissionAtATime: true,
        goalLockedAtMissionStart: true,
        cooperativeGoalMultiplier: 2,
        bothDeclaredSeatsContribute: true,
        rewardIsNotTreasury: true,
        rewardSpendingConnected: false,
        noAutomaticStrategicTurn: true
      }
    };
  }
  function normalizeSide(value) { return value === 'ai' ? 'ai' : value === 'human' ? 'human' : null; }
  function validActive(active) {
    if (!active || active.status !== 'ACTIVE' || !DEFINITIONS[active.definitionId] || typeof active.cooperative !== 'boolean') return false;
    var definition = DEFINITIONS[active.definitionId], expectedGoal = missionGoal(definition, active.cooperative), expectedReward = definition.baseReward * (active.cooperative ? 2 : 1);
    if (active.goal !== expectedGoal || active.eventKind !== definition.eventKind || active.unit !== definition.unit) return false;
    if (!active.reward || active.reward.currencyId !== CURRENCY.id || active.reward.amount !== expectedReward) return false;
    if (!Number.isFinite(active.progress) || active.progress < 0 || active.progress > active.goal || !active.contributions) return false;
    if (!Number.isFinite(active.contributions.human) || active.contributions.human < 0 || !Number.isFinite(active.contributions.ai) || active.contributions.ai < 0) return false;
    if (Math.abs(active.contributions.human + active.contributions.ai - active.progress) > 0.002) return false;
    return Number.isFinite(active.startedAt) && Number.isFinite(active.expiresAt) && Math.abs(active.expiresAt - active.startedAt - DURATION_SECONDS) < 0.002;
  }
  function migrate(input, seed) {
    if (!input || input.schema !== STATE_SCHEMA || input.version !== VERSION) return createState(seed);
    var state = clone(input);
    state.clockSeconds = nonNegative(state.clockSeconds);
    state.sequence = Math.max(0, Math.floor(nonNegative(state.sequence)));
    state.randomState = (Number(state.randomState) >>> 0) || seedNumber(seed);
    state.nextMissionAt = nonNegative(state.nextMissionAt);
    state.lastDefinitionId = DEFINITIONS[state.lastDefinitionId] ? state.lastDefinitionId : null;
    state.active = validActive(state.active) ? state.active : null;
    state.currency = state.currency && state.currency.id === CURRENCY.id ? state.currency : { id: CURRENCY.id, label: CURRENCY.label, symbol: CURRENCY.symbol, balance: 0 };
    state.currency.label = CURRENCY.label; state.currency.symbol = CURRENCY.symbol; state.currency.balance = Math.max(0, Math.floor(nonNegative(state.currency.balance)));
    state.history = Array.isArray(state.history) ? state.history.slice(-HISTORY_LIMIT) : [];
    state.boundaries = createState(seed).boundaries;
    return state;
  }
  function missionGoal(definition, cooperative) { return definition.baseGoal * (cooperative ? 2 : 1); }
  function eligible(definitionId, context) {
    var definition = DEFINITIONS[definitionId], goal = missionGoal(definition, context.cooperative);
    var canMakeRod = context.rod || context.wood >= 1 || context.treeCount > 0;
    var canMakeFire = context.fires > 0 || context.wood >= 5 || context.treeCount >= 2;
    if (definitionId === 'LAKE_LUNCH_AUDIT') return context.fishAlive >= goal && canMakeRod;
    if (definitionId === 'SUPPER_SERVICE') return context.fishAlive + context.rawFish >= goal && canMakeFire && (context.rawFish >= goal || canMakeRod);
    if (definitionId === 'CAMPFIRE_DIPLOMACY') return context.wood + context.treeCount * 2 >= goal * 5;
    if (definitionId === 'LUMBER_LEDGER') return context.treeCount >= (context.cooperative ? 4 : 2);
    return true;
  }
  function appendHistory(state, record) {
    state.history.push(record);
    if (state.history.length > HISTORY_LIMIT) state.history.splice(0, state.history.length - HISTORY_LIMIT);
  }
  function selectDefinition(state, context) {
    var candidates = MISSION_ORDER.filter(function (id) { return eligible(id, context); });
    if (candidates.length > 1 && state.lastDefinitionId) candidates = candidates.filter(function (id) { return id !== state.lastDefinitionId; });
    if (!candidates.length) candidates = ['INSPECTION_TOUR'];
    return candidates[Math.floor(draw(state) * candidates.length) % candidates.length];
  }
  function startMission(state, context) {
    var definitionId = selectDefinition(state, context), definition = DEFINITIONS[definitionId], cooperative = context.cooperative;
    state.sequence += 1;
    state.lastDefinitionId = definitionId;
    state.nextMissionAt = round(state.clockSeconds + INTERVAL_SECONDS, 3);
    state.active = {
      id: 'island-mission-' + String(state.sequence).padStart(5, '0'),
      definitionId: definitionId,
      label: definition.label,
      brief: definition.brief,
      eventKind: definition.eventKind,
      unit: definition.unit,
      goal: missionGoal(definition, cooperative),
      progress: 0,
      contributions: { human: 0, ai: 0 },
      cooperative: cooperative,
      startedAt: round(state.clockSeconds, 3),
      expiresAt: round(state.clockSeconds + DURATION_SECONDS, 3),
      status: 'ACTIVE',
      reward: { currencyId: CURRENCY.id, amount: definition.baseReward * (cooperative ? 2 : 1) }
    };
    return { type: 'MISSION_STARTED', mission: clone(state.active) };
  }
  function failMission(state) {
    var record = clone(state.active);
    record.status = 'FAILED'; record.failedAt = round(state.clockSeconds, 3); record.rewardGranted = 0;
    appendHistory(state, record); state.active = null;
    return { type: 'MISSION_FAILED', mission: clone(record) };
  }
  function advance(input, elapsedSeconds, contextInput) {
    var state = migrate(input, input && input.randomState), events = [], elapsed = nonNegative(elapsedSeconds), context = normalContext(contextInput);
    state.clockSeconds = round(state.clockSeconds + elapsed, 3);
    if (state.active && state.clockSeconds >= state.active.expiresAt) events.push(failMission(state));
    if (!state.active && state.clockSeconds >= state.nextMissionAt) events.push(startMission(state, context));
    return { state: state, events: events };
  }
  function record(input, eventInput) {
    var state = migrate(input, input && input.randomState), event = eventInput || {}, events = [];
    if (!state.active) return { state: state, events: events, counted: false };
    if (state.clockSeconds >= state.active.expiresAt) return { state: state, events: [failMission(state)], counted: false };
    var side = normalizeSide(event.side), amount = nonNegative(event.amount);
    if (!side || amount <= 0 || event.eventKind !== state.active.eventKind) return { state: state, events: events, counted: false };
    if (side === 'ai' && !state.active.cooperative) return { state: state, events: [{ type: 'MISSION_PROGRESS_REFUSED', reason: 'AI contribution requires a mission that started in cooperative mode.' }], counted: false };
    var before = state.active.progress, accepted = Math.min(amount, state.active.goal - before);
    state.active.progress = round(before + accepted, 3);
    state.active.contributions[side] = round(state.active.contributions[side] + accepted, 3);
    events.push({ type: 'MISSION_PROGRESS', missionId: state.active.id, side: side, eventKind: event.eventKind, accepted: accepted, before: before, after: state.active.progress, goal: state.active.goal });
    if (state.active.progress >= state.active.goal) {
      var completed = clone(state.active), reward = completed.reward.amount;
      completed.status = 'COMPLETED'; completed.completedAt = round(state.clockSeconds, 3); completed.rewardGranted = reward;
      state.currency.balance += reward;
      appendHistory(state, completed); state.active = null;
      events.push({ type: 'MISSION_COMPLETED', mission: clone(completed), currency: clone(state.currency) });
    }
    return { state: state, events: events, counted: accepted > 0 };
  }
  function summary(input) {
    var state = migrate(input, input && input.randomState), active = state.active ? clone(state.active) : null;
    if (active) active.secondsRemaining = Math.max(0, Math.ceil(active.expiresAt - state.clockSeconds));
    return {
      schema: STATE_SCHEMA,
      clockSeconds: state.clockSeconds,
      active: active,
      nextMissionIn: active ? Math.max(0, Math.ceil(state.nextMissionAt - state.clockSeconds)) : Math.max(0, Math.ceil(state.nextMissionAt - state.clockSeconds)),
      currency: clone(state.currency),
      historyCount: state.history.length,
      lastResult: clone(state.history[state.history.length - 1] || null),
      boundaries: clone(state.boundaries)
    };
  }
  function validate(input) {
    var errors = [], state = input;
    if (!state || state.schema !== STATE_SCHEMA || state.version !== VERSION) return { ok: false, errors: ['walkable mission state schema/version required'] };
    if (!Number.isFinite(state.clockSeconds) || state.clockSeconds < 0) errors.push('invalid mission clock');
    if (!Number.isInteger(state.sequence) || state.sequence < 0 || !Number.isFinite(state.nextMissionAt) || state.nextMissionAt < 0) errors.push('invalid mission schedule');
    if (state.active && !validActive(state.active)) errors.push('invalid active mission');
    if (!state.currency || state.currency.id !== CURRENCY.id || !Number.isInteger(state.currency.balance) || state.currency.balance < 0) errors.push('invalid Festival Laurel balance');
    if (!Array.isArray(state.history) || state.history.length > HISTORY_LIMIT) errors.push('invalid mission history');
    if (!state.boundaries || state.boundaries.rewardIsNotTreasury !== true || state.boundaries.rewardSpendingConnected !== false || state.boundaries.noAutomaticStrategicTurn !== true) errors.push('mission authority boundary required');
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    VERSION: VERSION,
    STATE_SCHEMA: STATE_SCHEMA,
    INTERVAL_SECONDS: INTERVAL_SECONDS,
    DURATION_SECONDS: DURATION_SECONDS,
    HISTORY_LIMIT: HISTORY_LIMIT,
    CURRENCY: CURRENCY,
    MISSION_ORDER: MISSION_ORDER.slice(),
    DEFINITIONS: DEFINITIONS,
    createState: createState,
    migrate: migrate,
    advance: advance,
    record: record,
    summary: summary,
    validate: validate
  };
});
