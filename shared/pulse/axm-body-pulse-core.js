(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMBodyPulse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.2.0';
  var STATE_SCHEMA = 'axm.body-pulse.state/v1';
  var MODULE_SCHEMA = 'axm.body-pulse.module/v1';
  var GOAL_SCHEMA = 'axm.body-pulse.goal/v1';
  var LEASE_SCHEMA = 'axm.body-pulse.lease/v1';
  var RECEIPT_SCHEMA = 'axm.body-pulse.receipt/v1';
  var MODES = ['STOPPED', 'ACTIVE', 'CONSERVE', 'REST'];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso(now) { return new Date(now == null ? Date.now() : now).toISOString(); }
  function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 200); }
  function number(value, fallback, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) n = fallback;
    return Math.max(min, Math.min(max, n));
  }
  function approximateBytes(value) {
    var json = JSON.stringify(value == null ? null : value);
    var bytes = 0;
    for (var i = 0; i < json.length; i += 1) {
      var code = json.charCodeAt(i);
      if (code < 128) bytes += 1;
      else if (code < 2048) bytes += 2;
      else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < json.length) { bytes += 4; i += 1; }
      else bytes += 3;
    }
    return bytes;
  }
  function id(prefix, seed) {
    var input = prefix + ':' + String(seed || '') + ':' + Date.now() + ':' + Math.random();
    var hash = 2166136261;
    for (var i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return prefix + '-' + (hash >>> 0).toString(36);
  }

  function createState() {
    return {
      schema: STATE_SCHEMA,
      version: VERSION,
      mode: 'STOPPED',
      modeChangedAt: null,
      modeChangedBy: null,
      config: { maxConcurrentLeases: 1, defaultLeaseMs: 120000, receiptLimit: 300, eventLimit: 500 },
      body: { sampledAt: null, cpuUsedRatio: null, memoryUsedRatio: null, gpuUsedRatio: null, gpuTemperatureC: null, cpuTemperatureC: null, thermalC: null, temperatureSource: null, batteryPercent: null, onBattery: null, pressure: 'UNKNOWN', knownSignals: [] },
      modules: {},
      goals: {},
      leases: [],
      receipts: [],
      events: []
    };
  }

  function normalize(raw) {
    var state = raw && raw.schema === STATE_SCHEMA ? clone(raw) : createState();
    state.version = VERSION;
    state.mode = MODES.indexOf(state.mode) >= 0 ? state.mode : 'STOPPED';
    state.config = Object.assign(createState().config, state.config || {});
    state.modules = state.modules && typeof state.modules === 'object' ? state.modules : {};
    state.goals = state.goals && typeof state.goals === 'object' ? state.goals : {};
    state.leases = Array.isArray(state.leases) ? state.leases : [];
    state.receipts = Array.isArray(state.receipts) ? state.receipts : [];
    state.events = Array.isArray(state.events) ? state.events : [];
    state.body = Object.assign(createState().body, state.body || {});
    return state;
  }

  function event(state, kind, data, now) {
    state.events.push(Object.assign({ at: nowIso(now), kind: kind }, data || {}));
    state.events = state.events.slice(-state.config.eventLimit);
  }

  function normalizeModule(input, previous) {
    input = input || {};
    previous = previous || {};
    var moduleId = text(input.moduleId || previous.moduleId, 80).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    if (!moduleId) throw new Error('moduleId required');
    return {
      schema: MODULE_SCHEMA,
      moduleId: moduleId,
      name: text(input.name || previous.name || moduleId, 100),
      goalQueueId: text(input.goalQueueId || previous.goalQueueId || (moduleId + '-goals'), 100),
      enabled: input.enabled == null ? previous.enabled === true : input.enabled === true,
      allowMaintenance: input.allowMaintenance == null ? previous.allowMaintenance === true : input.allowMaintenance === true,
      priority: Math.round(number(input.priority, previous.priority == null ? 50 : previous.priority, 0, 100)),
      activeCadenceMs: Math.round(number(input.activeCadenceMs, previous.activeCadenceMs || 900000, 10000, 86400000)),
      idleCadenceMs: Math.round(number(input.idleCadenceMs, previous.idleCadenceMs || 3600000, 60000, 604800000)),
      cost: {
        cpu: number(input.cost && input.cost.cpu, previous.cost && previous.cost.cpu || 1, 0, 100),
        memory: number(input.cost && input.cost.memory, previous.cost && previous.cost.memory || 1, 0, 100),
        gpu: number(input.cost && input.cost.gpu, previous.cost && previous.cost.gpu || 0, 0, 100)
      },
      authority: text(input.authority || previous.authority || 'proposal-only', 120),
      promotionGate: text(input.promotionGate || previous.promotionGate || 'explicit-review', 120),
      registeredAt: previous.registeredAt || nowIso(),
      updatedAt: nowIso(),
      lastRequestedAt: previous.lastRequestedAt || null,
      lastGrantedAt: previous.lastGrantedAt || null,
      nextDueAt: previous.nextDueAt || null,
      lastStatus: previous.lastStatus || 'REGISTERED',
      lastReason: previous.lastReason || 'Awaiting an explicit body mode and goal.'
    };
  }

  function registerModule(rawState, input, now) {
    var state = normalize(rawState);
    var moduleId = text(input && input.moduleId, 80).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    var module = normalizeModule(input, state.modules[moduleId]);
    module.updatedAt = nowIso(now);
    if (!module.registeredAt) module.registeredAt = nowIso(now);
    state.modules[module.moduleId] = module;
    event(state, 'module-registered', { moduleId: module.moduleId, enabled: module.enabled }, now);
    return state;
  }

  function setMode(rawState, mode, actor, now) {
    if (MODES.indexOf(mode) < 0) throw new Error('unknown body mode');
    var state = normalize(rawState);
    state.mode = mode;
    state.modeChangedAt = nowIso(now);
    state.modeChangedBy = text(actor || 'unknown', 100);
    event(state, 'mode-changed', { mode: mode, actor: state.modeChangedBy }, now);
    return state;
  }

  function normalizeGoal(input, previous, now) {
    input = input || {};
    previous = previous || {};
    var goalId = text(input.goalId || previous.goalId || id('goal', input.title), 100);
    var moduleId = text(input.moduleId || previous.moduleId, 80).toLowerCase();
    if (!moduleId) throw new Error('goal moduleId required');
    var nextStatus = ['OPEN', 'RUNNING', 'PAUSED', 'HELD', 'DONE', 'CANCELLED'].indexOf(input.status) >= 0 ? input.status : (previous.status || 'OPEN');
    return {
      schema: GOAL_SCHEMA,
      goalId: goalId,
      moduleId: moduleId,
      queueId: text(input.queueId || previous.queueId || (moduleId + '-goals'), 100),
      title: text(input.title || previous.title || 'Untitled goal', 180),
      priority: Math.round(number(input.priority, previous.priority == null ? 50 : previous.priority, 0, 100)),
      status: nextStatus,
      maxPulses: Math.round(number(input.maxPulses, previous.maxPulses || 1, 1, 10000)),
      usedPulses: Math.round(number(previous.usedPulses, 0, 0, 10000)),
      createdAt: previous.createdAt || nowIso(now),
      updatedAt: nowIso(now),
      createdBy: text(input.createdBy || previous.createdBy || 'unknown', 100),
      statusChangedAt: input.status && input.status !== previous.status ? nowIso(now) : (previous.statusChangedAt || null),
      statusChangedBy: text(input.statusChangedBy || previous.statusChangedBy || input.createdBy || 'unknown', 100),
      archivedAt: ['DONE', 'CANCELLED'].indexOf(nextStatus) >= 0 ? (previous.archivedAt || nowIso(now)) : null,
      requiresReview: input.requiresReview == null ? previous.requiresReview !== false : input.requiresReview !== false
    };
  }

  function upsertGoal(rawState, input, now) {
    var state = normalize(rawState);
    var goalId = text(input && input.goalId, 100);
    var goal = normalizeGoal(input, goalId ? state.goals[goalId] : null, now);
    if (!state.modules[goal.moduleId]) throw new Error('goal module is not registered');
    state.goals[goal.goalId] = goal;
    event(state, 'goal-upserted', { goalId: goal.goalId, moduleId: goal.moduleId, status: goal.status }, now);
    return state;
  }

  function deleteGoals(rawState, goalIds, actor, now) {
    var state = normalize(rawState);
    var ids = Array.isArray(goalIds) ? goalIds.map(function (goalId) { return text(goalId, 100); }).filter(Boolean) : [];
    if (!ids.length) throw new Error('at least one goalId required');
    var activeGoalIds = state.leases.filter(function (lease) { return lease.status === 'ACTIVE'; }).map(function (lease) { return lease.goalId; });
    ids.forEach(function (goalId) {
      if (activeGoalIds.indexOf(goalId) >= 0) throw new Error('cannot delete a goal with an active lease');
      var goal = state.goals[goalId];
      if (!goal) return;
      if (['DONE', 'CANCELLED'].indexOf(goal.status) < 0) throw new Error('only archived goals may be deleted');
      delete state.goals[goalId];
      state.receipts = state.receipts.filter(function (receipt) { return receipt.goalId !== goalId; });
      state.events = state.events.filter(function (entry) { return entry.goalId !== goalId; });
    });
    return state;
  }

  function sampleBody(rawState, input, now) {
    var state = normalize(rawState);
    input = input || {};
    var cpu = input.cpuUsedRatio == null ? null : number(input.cpuUsedRatio, 0, 0, 1);
    var memory = input.memoryUsedRatio == null ? null : number(input.memoryUsedRatio, 0, 0, 1);
    var gpu = input.gpuUsedRatio == null ? null : number(input.gpuUsedRatio, 0, 0, 1);
    var gpuTemperature = input.gpuTemperatureC == null ? null : number(input.gpuTemperatureC, 0, -50, 150);
    var cpuTemperature = input.cpuTemperatureC == null ? null : number(input.cpuTemperatureC, 0, -50, 150);
    var legacyThermal = input.thermalC == null ? null : number(input.thermalC, 0, -50, 150);
    var temperatures = [gpuTemperature, cpuTemperature, legacyThermal].filter(function (value) { return value != null; });
    var thermal = temperatures.length ? Math.max.apply(Math, temperatures) : null;
    var batteryPercent = input.batteryPercent == null ? null : number(input.batteryPercent, 0, 0, 100);
    var known = [];
    if (cpu != null) known.push('cpu');
    if (memory != null) known.push('memory');
    if (gpu != null) known.push('gpu');
    if (gpuTemperature != null) known.push('gpu-thermal');
    if (cpuTemperature != null) known.push('cpu-thermal');
    if (legacyThermal != null && gpuTemperature == null && cpuTemperature == null) known.push('thermal');
    if (batteryPercent != null || input.onBattery != null) known.push('battery');
    var pressureValue = Math.max(cpu == null ? 0 : cpu, memory == null ? 0 : memory, gpu == null ? 0 : gpu, thermal == null ? 0 : Math.max(0, (thermal - 55) / 40));
    var pressure = known.length ? (pressureValue >= .88 ? 'RED' : pressureValue >= .68 ? 'AMBER' : 'GREEN') : 'UNKNOWN';
    state.body = { sampledAt: nowIso(now), cpuUsedRatio: cpu, memoryUsedRatio: memory, gpuUsedRatio: gpu, gpuTemperatureC: gpuTemperature, cpuTemperatureC: cpuTemperature, thermalC: thermal, temperatureSource: text(input.temperatureSource || (cpuTemperature != null && gpuTemperature != null ? 'cpu+gpu' : cpuTemperature != null ? 'cpu' : gpuTemperature != null ? 'gpu' : legacyThermal != null ? 'generic' : ''), 100) || null, batteryPercent: batteryPercent, onBattery: input.onBattery == null ? null : input.onBattery === true, pressure: pressure, knownSignals: known };
    return state;
  }

  function activeGoals(state, moduleId) {
    return Object.keys(state.goals).map(function (key) { return state.goals[key]; }).filter(function (goal) {
      return goal.moduleId === moduleId && ['OPEN', 'RUNNING'].indexOf(goal.status) >= 0 && goal.usedPulses < goal.maxPulses;
    }).sort(function (a, b) { return b.priority - a.priority || Date.parse(a.createdAt) - Date.parse(b.createdAt); });
  }

  function pruneLeases(state, now) {
    var stamp = Number(now == null ? Date.now() : now);
    state.leases = state.leases.filter(function (lease) { return lease.status === 'ACTIVE' && Date.parse(lease.expiresAt) > stamp; });
  }

  function deny(state, module, reason, now) {
    module.lastStatus = reason === 'not-due' || reason === 'no-open-goal' ? 'IDLE' : 'HELD';
    module.lastReason = reason;
    event(state, 'pulse-held', { moduleId: module.moduleId, reason: reason }, now);
    return { state: state, granted: false, reason: reason, module: clone(module), body: clone(state.body) };
  }

  function requestPulse(rawState, input, now) {
    var state = normalize(rawState);
    var stamp = Number(now == null ? Date.now() : now);
    pruneLeases(state, stamp);
    var moduleId = text(input && input.moduleId, 80).toLowerCase();
    var module = state.modules[moduleId];
    if (!module) throw new Error('module is not registered');
    module.lastRequestedAt = nowIso(stamp);
    if (!module.enabled) return deny(state, module, 'module-disabled', stamp);
    if (state.mode === 'STOPPED') return deny(state, module, 'body-stopped', stamp);
    if (state.mode === 'REST') return deny(state, module, 'body-resting', stamp);
    if (state.body.pressure === 'RED') return deny(state, module, 'body-pressure-red', stamp);
    var goals = activeGoals(state, moduleId);
    if (!goals.length && !module.allowMaintenance) return deny(state, module, 'no-open-goal', stamp);
    var goal = goals[0] || null;
    var effectivePriority = Math.max(module.priority, goal ? goal.priority : 0);
    if (state.mode === 'CONSERVE' && effectivePriority < 70) return deny(state, module, 'conserve-priority-hold', stamp);
    if (module.nextDueAt && Date.parse(module.nextDueAt) > stamp && !(input && input.force === true)) return deny(state, module, 'not-due', stamp);
    if (state.leases.length >= state.config.maxConcurrentLeases) return deny(state, module, 'body-capacity-busy', stamp);
    var leaseMs = Math.round(number(input && input.leaseMs, state.config.defaultLeaseMs, 1000, 900000));
    var lease = { schema: LEASE_SCHEMA, leaseId: id('pulse', moduleId), moduleId: moduleId, goalId: goal && goal.goalId || null, grantedAt: nowIso(stamp), expiresAt: nowIso(stamp + leaseMs), status: 'ACTIVE', authority: module.authority, promotionGate: module.promotionGate, bodyPressure: state.body.pressure };
    state.leases.push(lease);
    module.lastGrantedAt = lease.grantedAt;
    module.nextDueAt = nowIso(stamp + (goal ? module.activeCadenceMs : module.idleCadenceMs));
    module.lastStatus = 'LEASED';
    module.lastReason = 'bounded-pulse-granted';
    if (goal) { goal.status = 'RUNNING'; goal.updatedAt = nowIso(stamp); }
    event(state, 'pulse-granted', { moduleId: moduleId, goalId: lease.goalId, leaseId: lease.leaseId }, stamp);
    return { state: state, granted: true, reason: 'bounded-pulse-granted', lease: clone(lease), module: clone(module), body: clone(state.body) };
  }

  function completePulse(rawState, input, now) {
    var state = normalize(rawState);
    var lease = state.leases.find(function (item) { return item.leaseId === text(input && input.leaseId, 100); });
    if (!lease) throw new Error('active pulse lease not found');
    var module = state.modules[lease.moduleId];
    var outcome = input && input.outcome === 'FAILED' ? 'FAILED' : 'COMPLETED';
    lease.status = outcome;
    lease.completedAt = nowIso(now);
    var goal = lease.goalId && state.goals[lease.goalId];
    if (goal) {
      goal.usedPulses += 1;
      goal.status = goal.usedPulses >= goal.maxPulses ? 'HELD' : 'OPEN';
      goal.updatedAt = nowIso(now);
    }
    if (module) { module.lastStatus = outcome; module.lastReason = text(input && input.summary || outcome, 240); }
    var receipt = { schema: RECEIPT_SCHEMA, receiptId: id('pulse-receipt', lease.leaseId), leaseId: lease.leaseId, moduleId: lease.moduleId, goalId: lease.goalId, outcome: outcome, completedAt: lease.completedAt, summary: text(input && input.summary || outcome, 500), effect: text(input && input.effect || 'module-local-candidate-only', 160), promotionAuthority: 'NONE' };
    state.receipts.push(receipt);
    state.receipts = state.receipts.slice(-state.config.receiptLimit);
    state.leases = state.leases.filter(function (item) { return item.status === 'ACTIVE'; });
    event(state, 'pulse-completed', { moduleId: receipt.moduleId, goalId: receipt.goalId, receiptId: receipt.receiptId, outcome: outcome }, now);
    return { state: state, receipt: clone(receipt) };
  }

  function status(rawState, now) {
    var state = normalize(rawState);
    pruneLeases(state, now);
    var archivedGoals = Object.keys(state.goals).map(function (key) { return state.goals[key]; }).filter(function (goal) { return ['DONE', 'CANCELLED'].indexOf(goal.status) >= 0; });
    var archivedGoalIds = archivedGoals.map(function (goal) { return goal.goalId; });
    var archivedReceipts = state.receipts.filter(function (receipt) { return archivedGoalIds.indexOf(receipt.goalId) >= 0; });
    var archivedEvents = state.events.filter(function (entry) { return archivedGoalIds.indexOf(entry.goalId) >= 0; });
    var archiveBytes = archivedGoals.length ? approximateBytes({ goals: archivedGoals, receipts: archivedReceipts, events: archivedEvents }) : 0;
    return {
      schema: 'axm.body-pulse.status/v1',
      version: VERSION,
      mode: state.mode,
      body: clone(state.body),
      config: clone(state.config),
      modules: Object.keys(state.modules).map(function (key) {
        var module = clone(state.modules[key]);
        module.openGoals = activeGoals(state, key).length;
        module.activeLease = state.leases.some(function (lease) { return lease.moduleId === key; });
        return module;
      }),
      goals: Object.keys(state.goals).map(function (key) { return clone(state.goals[key]); }),
      leases: clone(state.leases),
      recentReceipts: clone(state.receipts.slice(-20)),
      recentEvents: clone(state.events.slice(-30)),
      retention: {
        archivedGoalCount: archivedGoals.length,
        linkedReceiptCount: archivedReceipts.length,
        linkedEventCount: archivedEvents.length,
        approximateBytes: archiveBytes,
        policy: 'manual-forget',
        warning: archivedGoals.length >= 250 || archiveBytes >= 5242880 ? 'ARCHIVE_GROWING' : 'CLEAR'
      },
      truth: 'A pulse lease allocates bounded compute opportunity only. It grants no file, network, tool, promotion or real-world authority.'
    };
  }

  return {
    VERSION: VERSION,
    STATE_SCHEMA: STATE_SCHEMA,
    MODULE_SCHEMA: MODULE_SCHEMA,
    GOAL_SCHEMA: GOAL_SCHEMA,
    LEASE_SCHEMA: LEASE_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    MODES: MODES.slice(),
    createState: createState,
    normalize: normalize,
    registerModule: registerModule,
    setMode: setMode,
    upsertGoal: upsertGoal,
    deleteGoals: deleteGoals,
    sampleBody: sampleBody,
    requestPulse: requestPulse,
    completePulse: completePulse,
    status: status
  };
});
