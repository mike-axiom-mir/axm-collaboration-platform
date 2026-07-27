(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMPlatformHeartbeat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.2.0';
  var STATE_SCHEMA = 'axm.platform-heartbeat.state/v1';
  var BEAT_SCHEMA = 'axm.platform-heartbeat.beat/v1';
  var PROFILES = Object.freeze({
    low: { profileId: 'low', label: 'Low', cadenceMs: 3600000, note: 'One shared beat every hour.' },
    quiet: { profileId: 'quiet', label: 'Quiet', cadenceMs: 900000, note: 'One shared beat every fifteen minutes.' },
    steady: { profileId: 'steady', label: 'Steady', cadenceMs: 300000, note: 'One shared beat every five minutes.' },
    lively: { profileId: 'lively', label: 'Lively', cadenceMs: 60000, note: 'One shared beat every minute.' }
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso(now) { return new Date(now == null ? Date.now() : now).toISOString(); }
  function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 160); }
  function boundedCadence(value, fallback) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) parsed = fallback;
    return Math.round(Math.max(5000, Math.min(86400000, parsed)));
  }
  function hasOwn(value, key) { return !!value && Object.prototype.hasOwnProperty.call(value, key); }
  function normalizedAnchor(value, strict) {
    if (value == null || value === '') return null;
    var parsed = Date.parse(String(value));
    if (!Number.isFinite(parsed)) {
      if (strict) throw new Error('Heartbeat anchorAt must be a valid ISO timestamp');
      return null;
    }
    return nowIso(parsed);
  }
  function nextFromAnchor(stamp, cadenceMs, anchorAt) {
    if (!anchorAt) return stamp + cadenceMs;
    var anchor = Date.parse(anchorAt);
    if (!Number.isFinite(anchor)) return stamp + cadenceMs;
    if (anchor >= stamp) return anchor;
    return anchor + (Math.floor((stamp - anchor) / cadenceMs) + 1) * cadenceMs;
  }
  function profileForCadence(cadenceMs) {
    var ids = Object.keys(PROFILES);
    for (var i = 0; i < ids.length; i += 1) if (PROFILES[ids[i]].cadenceMs === cadenceMs) return ids[i];
    return 'custom';
  }
  function createState() {
    return {
      schema: STATE_SCHEMA,
      version: VERSION,
      config: {
        enabled: true,
        profileId: 'low',
        cadenceMs: PROFILES.low.cadenceMs,
        anchorAt: null,
        missedBeatPolicy: 'coalesce',
        resumeAfterRestart: true,
        receiptLimit: 200
      },
      sequence: 0,
      nextDueAt: null,
      lastBeat: null,
      lastChangedAt: null,
      lastChangedBy: null,
      lastReason: 'low-hourly-rhythm-authorized-by-mike',
      receipts: []
    };
  }
  function normalize(raw) {
    var base = createState();
    var state = raw && raw.schema === STATE_SCHEMA ? clone(raw) : base;
    state.version = VERSION;
    state.config = Object.assign({}, base.config, state.config || {});
    state.config.enabled = state.config.enabled === true;
    state.config.cadenceMs = boundedCadence(state.config.cadenceMs, base.config.cadenceMs);
    state.config.profileId = profileForCadence(state.config.cadenceMs);
    state.config.anchorAt = normalizedAnchor(state.config.anchorAt, false);
    state.config.missedBeatPolicy = 'coalesce';
    state.config.resumeAfterRestart = state.config.resumeAfterRestart === true;
    state.config.receiptLimit = Math.round(Math.max(20, Math.min(1000, Number(state.config.receiptLimit) || 200)));
    state.sequence = Math.max(0, Math.round(Number(state.sequence) || 0));
    state.receipts = Array.isArray(state.receipts) ? state.receipts.slice(-state.config.receiptLimit) : [];
    if (!state.config.enabled) state.nextDueAt = null;
    return state;
  }
  function configure(rawState, input, actor, now) {
    var state = normalize(rawState);
    input = input || {};
    var stamp = Number(now == null ? Date.now() : now);
    var previousCadence = state.config.cadenceMs;
    var previousAnchor = state.config.anchorAt;
    var previousEnabled = state.config.enabled;
    var requestedProfile = text(input.profileId, 40).toLowerCase();
    var cadence = input.cadenceMs;
    if (cadence == null && PROFILES[requestedProfile]) cadence = PROFILES[requestedProfile].cadenceMs;
    if (cadence != null) state.config.cadenceMs = boundedCadence(cadence, previousCadence);
    state.config.profileId = profileForCadence(state.config.cadenceMs);
    if (hasOwn(input, 'anchorAt')) state.config.anchorAt = normalizedAnchor(input.anchorAt, true);
    if (input.enabled != null) state.config.enabled = input.enabled === true;
    if (input.resumeAfterRestart != null) state.config.resumeAfterRestart = input.resumeAfterRestart === true;
    state.lastChangedAt = nowIso(stamp);
    state.lastChangedBy = text(actor || input.actorId || 'unknown', 100);
    if (!state.config.enabled) {
      state.nextDueAt = null;
      state.lastReason = 'stopped-explicitly';
    } else if (!previousEnabled || previousCadence !== state.config.cadenceMs || previousAnchor !== state.config.anchorAt || !state.nextDueAt) {
      state.nextDueAt = nowIso(nextFromAnchor(stamp, state.config.cadenceMs, state.config.anchorAt));
      state.lastReason = previousAnchor !== state.config.anchorAt ? 'schedule-anchored' : (previousEnabled ? 'rhythm-changed' : 'armed-explicitly');
    }
    return state;
  }
  function beat(state, input, now) {
    var stamp = Number(now == null ? Date.now() : now);
    state.sequence += 1;
    var receipt = {
      schema: BEAT_SCHEMA,
      beatId: 'beat-' + state.sequence,
      sequence: state.sequence,
      kind: input.kind,
      scheduledAt: input.scheduledAt || nowIso(stamp),
      observedAt: nowIso(stamp),
      profileId: state.config.profileId,
      cadenceMs: state.config.cadenceMs,
      anchorAt: state.config.anchorAt,
      missedBeats: Math.max(0, Math.round(Number(input.missedBeats) || 0)),
      coalesced: Math.max(0, Math.round(Number(input.missedBeats) || 0)) > 0,
      actorId: text(input.actorId || 'platform-clock', 100),
      authority: 'TIME_SIGNAL_ONLY',
      pulseRequested: false,
      actionsActivated: []
    };
    state.lastBeat = receipt;
    state.lastReason = input.kind === 'MANUAL' ? 'manual-step' : 'scheduled-beat';
    state.receipts.push(receipt);
    state.receipts = state.receipts.slice(-state.config.receiptLimit);
    return receipt;
  }
  function advance(rawState, now) {
    var state = normalize(rawState);
    var stamp = Number(now == null ? Date.now() : now);
    if (!state.config.enabled) return { state: state, emitted: false, reason: 'heartbeat-stopped' };
    if (!state.nextDueAt) {
      state.nextDueAt = nowIso(nextFromAnchor(stamp, state.config.cadenceMs, state.config.anchorAt));
      return { state: state, emitted: false, reason: 'next-beat-scheduled' };
    }
    var due = Date.parse(state.nextDueAt);
    if (due > stamp) return { state: state, emitted: false, reason: 'not-due' };
    var dueCount = Math.floor((stamp - due) / state.config.cadenceMs) + 1;
    var receipt = beat(state, { kind: 'SCHEDULED', scheduledAt: nowIso(due), missedBeats: dueCount - 1, actorId: 'platform-clock' }, stamp);
    state.nextDueAt = nowIso(due + dueCount * state.config.cadenceMs);
    return { state: state, emitted: true, reason: 'scheduled-beat', beat: clone(receipt) };
  }
  function manualStep(rawState, actor, now) {
    var state = normalize(rawState);
    var receipt = beat(state, { kind: 'MANUAL', actorId: actor || 'local-steward', missedBeats: 0 }, now);
    return { state: state, beat: clone(receipt) };
  }
  function preview(rawState, count, now) {
    var state = normalize(rawState);
    var total = Math.max(1, Math.min(12, Math.round(Number(count) || 5)));
    var stamp = Number(now == null ? Date.now() : now);
    var start = state.nextDueAt ? Date.parse(state.nextDueAt) : nextFromAnchor(stamp, state.config.cadenceMs, state.config.anchorAt);
    var beats = [];
    for (var i = 0; i < total; i += 1) beats.push({ sequence: state.sequence + i + 1, dueAt: nowIso(start + i * state.config.cadenceMs), authority: 'TIME_SIGNAL_ONLY' });
    return beats;
  }
  function status(rawState, now) {
    var state = normalize(rawState);
    return {
      schema: 'axm.platform-heartbeat.status/v1',
      version: VERSION,
      config: clone(state.config),
      sequence: state.sequence,
      nextDueAt: state.nextDueAt,
      lastBeat: clone(state.lastBeat),
      lastReason: state.lastReason,
      scheduleMode: state.config.anchorAt ? 'ANCHORED' : 'INTERVAL_FROM_CHANGE',
      profiles: clone(PROFILES),
      preview: preview(state, 5, now),
      recentReceipts: clone(state.receipts.slice(-20)),
      pulseBridge: { state: 'UNLINKED', automaticPulseRequests: false },
      truth: 'Heartbeat determines when eligibility is checked. It grants no pulse, action, file, network, promotion or real-world authority.'
    };
  }

  return {
    VERSION: VERSION,
    STATE_SCHEMA: STATE_SCHEMA,
    BEAT_SCHEMA: BEAT_SCHEMA,
    PROFILES: clone(PROFILES),
    createState: createState,
    normalize: normalize,
    configure: configure,
    advance: advance,
    manualStep: manualStep,
    preview: preview,
    status: status
  };
});
