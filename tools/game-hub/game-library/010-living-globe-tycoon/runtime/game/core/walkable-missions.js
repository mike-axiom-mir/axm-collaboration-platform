(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMWalkableMissions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.2.0';
  var STATE_SCHEMA = 'axm.living-world.walkable-missions/v0.2';
  var LEGACY_STATE_SCHEMA = 'axm.living-world.walkable-missions/v0.1';
  var INTERVAL_SECONDS = 240;
  var DURATION_SECONDS = 360;
  var HISTORY_LIMIT = 40;
  var TOUR_MISSIONS = 4;
  var TOUR_BONUS = 3;
  var CURRENCY = Object.freeze({
    id: 'festivalLaurels',
    label: 'Festival Laurels',
    symbol: '✦',
    role: 'Ceremonial mission and stewardship-tour currency reserved for later explicit monuments, festivals or exceptional edicts.',
    treasuryEquivalent: false,
    tradeable: false,
    spendingConnected: false
  });
  var STARTER_ORDER = ['INSPECTION_TOUR', 'GREEN_RIBBON', 'LUMBER_LEDGER', 'LAKE_LUNCH_AUDIT', 'CAMPFIRE_DIPLOMACY', 'SUPPER_SERVICE'];
  var MISSION_ORDER = STARTER_ORDER.concat(['SHORELINE_SURVEY', 'NURSERY_PROMISE', 'WINDBREAK_WORKS', 'LAKE_RECOVERY', 'BEACON_CHAIN', 'FESTIVAL_TABLE']);
  var DEFINITIONS = Object.freeze({
    INSPECTION_TOUR: Object.freeze({
      label: 'Presidential Inspection Tour',
      brief: 'Travel the island. The palace assures everyone this counts as fieldwork.',
      eventKind: 'TRAVEL', unit: 'surface units', baseGoal: 60, baseReward: 1, tier: 'STARTER'
    }),
    GREEN_RIBBON: Object.freeze({
      label: 'The Green Ribbon Decree',
      brief: 'Plant saplings or reeds, or return caught fish. Ribbon-cutting scissors remain purely ceremonial.',
      eventKind: 'PLANT_LIFE', unit: 'living acts', baseGoal: 3, baseReward: 1, tier: 'STARTER'
    }),
    LUMBER_LEDGER: Object.freeze({
      label: 'Ministry of Useful Lumber',
      brief: 'Gather wood for island works. The Ministry of Looking Out The Window recommends replanting.',
      eventKind: 'GATHER_WOOD', unit: 'wood', baseGoal: 6, baseReward: 1, tier: 'STARTER'
    }),
    LAKE_LUNCH_AUDIT: Object.freeze({
      label: 'Lake Lunch Audit',
      brief: 'Catch fish before the lunch committee eats the agenda instead.',
      eventKind: 'CATCH_FISH', unit: 'fish caught', baseGoal: 2, baseReward: 2, tier: 'STARTER'
    }),
    CAMPFIRE_DIPLOMACY: Object.freeze({
      label: 'Campfire Diplomacy',
      brief: 'Build gathering fires. Foreign dignitaries are optional; marshmallows are under review.',
      eventKind: 'BUILD_FIRE', unit: 'campfires', baseGoal: 1, baseReward: 1, tier: 'STARTER'
    }),
    SUPPER_SERVICE: Object.freeze({
      label: 'Island Supper Service',
      brief: 'Cook fish at a campfire. The cabinet has bravely agreed to arrive after the cooking.',
      eventKind: 'COOK_FISH', unit: 'fish cooked', baseGoal: 2, baseReward: 2, tier: 'STARTER'
    }),
    SHORELINE_SURVEY: Object.freeze({
      label: 'Whole-Island Shoreline Survey',
      brief: 'Circle the longer coast and report which beaches are still where the map claims.',
      eventKind: 'TRAVEL', unit: 'surface units', baseGoal: 110, baseReward: 2, tier: 'EXPANDED'
    }),
    NURSERY_PROMISE: Object.freeze({
      label: 'The Five-Sapling Promise',
      brief: 'Restore five living places with saplings, reeds or returned fish before anyone unveils the plaque.',
      eventKind: 'PLANT_LIFE', unit: 'living acts', baseGoal: 5, baseReward: 2, tier: 'EXPANDED'
    }),
    WINDBREAK_WORKS: Object.freeze({
      label: 'Windbreak Works Reserve',
      brief: 'Gather a larger timber reserve for island repairs, then remember the nursery promise.',
      eventKind: 'GATHER_WOOD', unit: 'wood', baseGoal: 10, baseReward: 2, tier: 'EXPANDED'
    }),
    LAKE_RECOVERY: Object.freeze({
      label: 'Lake Recovery Census',
      brief: 'Land three careful catches so the kitchen and the lake committee can compare notes.',
      eventKind: 'CATCH_FISH', unit: 'fish caught', baseGoal: 3, baseReward: 3, tier: 'EXPANDED'
    }),
    BEACON_CHAIN: Object.freeze({
      label: 'Two-Shore Beacon Chain',
      brief: 'Raise two campfires on useful ground and give both horizons a warm landmark.',
      eventKind: 'BUILD_FIRE', unit: 'campfires', baseGoal: 2, baseReward: 2, tier: 'EXPANDED'
    }),
    FESTIVAL_TABLE: Object.freeze({
      label: 'The Long Festival Table',
      brief: 'Cook four fish for an island table long enough to outlast the speeches.',
      eventKind: 'COOK_FISH', unit: 'fish cooked', baseGoal: 4, baseReward: 3, tier: 'EXPANDED'
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
  function createProgression() {
    return {
      route: 'FOUR_ERRAND_STEWARDSHIP_TOUR',
      tourNumber: 1,
      completedInTour: 0,
      missionsPerTour: TOUR_MISSIONS,
      toursCompleted: 0,
      totalCompleted: 0,
      currentStreak: 0,
      bestStreak: 0
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
      progression: createProgression(),
      history: [],
      boundaries: {
        activePlayClockOnly: true,
        oneMissionAtATime: true,
        goalLockedAtMissionStart: true,
        cooperativeGoalMultiplier: 2,
        bothDeclaredSeatsContribute: true,
        rewardIsNotTreasury: true,
        rewardSpendingConnected: false,
        noAutomaticStrategicTurn: true,
        tourProgressOnlyFromCompletedMissions: true,
        tourBonusIsCeremonial: true
      }
    };
  }
  function normalizeSide(value) { return value === 'ai' ? 'ai' : value === 'human' ? 'human' : null; }
  function validActive(active) {
    if (!active || active.status !== 'ACTIVE' || !DEFINITIONS[active.definitionId] || typeof active.cooperative !== 'boolean') return false;
    var definition = DEFINITIONS[active.definitionId], expectedGoal = missionGoal(definition, active.cooperative), expectedReward = definition.baseReward * (active.cooperative ? 2 : 1);
    if (active.goal !== expectedGoal || active.eventKind !== definition.eventKind || active.unit !== definition.unit || active.tier !== definition.tier) return false;
    if (!active.reward || active.reward.currencyId !== CURRENCY.id || active.reward.amount !== expectedReward) return false;
    if (!Number.isFinite(active.progress) || active.progress < 0 || active.progress > active.goal || !active.contributions) return false;
    if (!Number.isFinite(active.contributions.human) || active.contributions.human < 0 || !Number.isFinite(active.contributions.ai) || active.contributions.ai < 0) return false;
    if (Math.abs(active.contributions.human + active.contributions.ai - active.progress) > 0.002) return false;
    if (!Number.isInteger(active.tourSlot) || active.tourSlot < 1 || active.tourSlot > TOUR_MISSIONS) return false;
    return Number.isFinite(active.startedAt) && Number.isFinite(active.expiresAt) && Math.abs(active.expiresAt - active.startedAt - DURATION_SECONDS) < 0.002;
  }
  function progressionFromHistory(history) {
    var progression = createProgression(), rows = Array.isArray(history) ? history : [], streak = 0;
    progression.totalCompleted = rows.filter(function (record) { return record && record.status === 'COMPLETED'; }).length;
    progression.toursCompleted = Math.floor(progression.totalCompleted / TOUR_MISSIONS);
    progression.completedInTour = progression.totalCompleted % TOUR_MISSIONS;
    progression.tourNumber = progression.toursCompleted + 1;
    for (var i = rows.length - 1; i >= 0; i -= 1) {
      if (!rows[i] || rows[i].status !== 'COMPLETED') break;
      streak += 1;
    }
    progression.currentStreak = streak;
    progression.bestStreak = streak;
    return progression;
  }
  function validProgression(progression) {
    if (!progression || progression.route !== 'FOUR_ERRAND_STEWARDSHIP_TOUR') return false;
    var integers = ['tourNumber', 'completedInTour', 'missionsPerTour', 'toursCompleted', 'totalCompleted', 'currentStreak', 'bestStreak'];
    if (integers.some(function (key) { return !Number.isInteger(progression[key]) || progression[key] < 0; })) return false;
    if (progression.missionsPerTour !== TOUR_MISSIONS || progression.tourNumber !== progression.toursCompleted + 1) return false;
    if (progression.completedInTour >= TOUR_MISSIONS || progression.totalCompleted !== progression.toursCompleted * TOUR_MISSIONS + progression.completedInTour) return false;
    return progression.bestStreak >= progression.currentStreak && progression.currentStreak <= progression.totalCompleted;
  }
  function migrate(input, seed) {
    var current = input && input.schema === STATE_SCHEMA && input.version === VERSION;
    var legacy = input && input.schema === LEGACY_STATE_SCHEMA && input.version === '0.1.0';
    if (!current && !legacy) return createState(seed);
    var state = clone(input);
    state.schema = STATE_SCHEMA; state.version = VERSION;
    state.clockSeconds = nonNegative(state.clockSeconds);
    state.sequence = Math.max(0, Math.floor(nonNegative(state.sequence)));
    state.randomState = (Number(state.randomState) >>> 0) || seedNumber(seed);
    state.nextMissionAt = nonNegative(state.nextMissionAt);
    state.lastDefinitionId = DEFINITIONS[state.lastDefinitionId] ? state.lastDefinitionId : null;
    state.active = current && validActive(state.active) ? state.active : null;
    state.currency = state.currency && state.currency.id === CURRENCY.id ? state.currency : { id: CURRENCY.id, label: CURRENCY.label, symbol: CURRENCY.symbol, balance: 0 };
    state.currency.label = CURRENCY.label; state.currency.symbol = CURRENCY.symbol; state.currency.balance = Math.max(0, Math.floor(nonNegative(state.currency.balance)));
    state.history = Array.isArray(state.history) ? state.history.slice(-HISTORY_LIMIT) : [];
    state.progression = validProgression(state.progression) ? state.progression : progressionFromHistory(state.history);
    state.boundaries = createState(seed).boundaries;
    return state;
  }
  function missionGoal(definition, cooperative) { return definition.baseGoal * (cooperative ? 2 : 1); }
  function eligible(definitionId, context) {
    var definition = DEFINITIONS[definitionId], goal = missionGoal(definition, context.cooperative);
    var canMakeRod = context.rod || context.wood >= 1 || context.treeCount > 0;
    var canMakeFire = context.fires > 0 || context.wood >= 5 || context.treeCount >= 2;
    if (definition.eventKind === 'CATCH_FISH') return context.fishAlive >= goal && canMakeRod;
    if (definition.eventKind === 'COOK_FISH') return context.fishAlive + context.rawFish >= goal && canMakeFire && (context.rawFish >= goal || canMakeRod);
    if (definition.eventKind === 'BUILD_FIRE') return context.wood + context.treeCount * 2 >= goal * 5;
    if (definition.eventKind === 'GATHER_WOOD') return context.treeCount >= Math.max(2, Math.ceil(goal / 3));
    return true;
  }
  function appendHistory(state, record) {
    state.history.push(record);
    if (state.history.length > HISTORY_LIMIT) state.history.splice(0, state.history.length - HISTORY_LIMIT);
  }
  function selectDefinition(state, context) {
    var unlocked = state.progression.totalCompleted >= 2 ? MISSION_ORDER : STARTER_ORDER;
    var candidates = unlocked.filter(function (id) { return eligible(id, context); });
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
      tier: definition.tier,
      tourSlot: state.progression.completedInTour + 1,
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
    state.progression.currentStreak = 0;
    appendHistory(state, record); state.active = null;
    return { type: 'MISSION_FAILED', mission: clone(record), progression: clone(state.progression) };
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
      var completed = clone(state.active), reward = completed.reward.amount, bonus = 0, completedTourNumber = null;
      completed.status = 'COMPLETED'; completed.completedAt = round(state.clockSeconds, 3); completed.rewardGranted = reward;
      state.progression.totalCompleted += 1;
      state.progression.completedInTour += 1;
      state.progression.currentStreak += 1;
      state.progression.bestStreak = Math.max(state.progression.bestStreak, state.progression.currentStreak);
      if (state.progression.completedInTour >= TOUR_MISSIONS) {
        completedTourNumber = state.progression.tourNumber;
        bonus = TOUR_BONUS;
        completed.tourCompleted = completedTourNumber;
        completed.tourBonusGranted = bonus;
        state.progression.toursCompleted += 1;
        state.progression.tourNumber += 1;
        state.progression.completedInTour = 0;
      } else completed.tourBonusGranted = 0;
      state.currency.balance += reward + bonus;
      appendHistory(state, completed); state.active = null;
      events.push({ type: 'MISSION_COMPLETED', mission: clone(completed), currency: clone(state.currency), progression: clone(state.progression) });
      if (bonus > 0) events.push({ type: 'MISSION_TOUR_COMPLETED', tourNumber: completedTourNumber, bonus: bonus, currency: clone(state.currency), progression: clone(state.progression) });
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
      progression: clone(state.progression),
      catalog: { total: MISSION_ORDER.length, unlocked: state.progression.totalCompleted >= 2 ? MISSION_ORDER.length : STARTER_ORDER.length, expandedUnlocked: state.progression.totalCompleted >= 2 },
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
    if (!validProgression(state.progression)) errors.push('invalid stewardship tour progression');
    if (!Array.isArray(state.history) || state.history.length > HISTORY_LIMIT) errors.push('invalid mission history');
    if (!state.boundaries || state.boundaries.rewardIsNotTreasury !== true || state.boundaries.rewardSpendingConnected !== false || state.boundaries.noAutomaticStrategicTurn !== true || state.boundaries.tourProgressOnlyFromCompletedMissions !== true || state.boundaries.tourBonusIsCeremonial !== true) errors.push('mission authority boundary required');
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    VERSION: VERSION,
    STATE_SCHEMA: STATE_SCHEMA,
    LEGACY_STATE_SCHEMA: LEGACY_STATE_SCHEMA,
    INTERVAL_SECONDS: INTERVAL_SECONDS,
    DURATION_SECONDS: DURATION_SECONDS,
    HISTORY_LIMIT: HISTORY_LIMIT,
    TOUR_MISSIONS: TOUR_MISSIONS,
    TOUR_BONUS: TOUR_BONUS,
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
