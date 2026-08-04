(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MirrorShiftLanQualification = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SCHEMA = 'axm.four-phone-lan-qualification/v1';
  const PREFLIGHT_SCHEMA = 'axm.four-phone-lan-preflight/v1';
  const VERSION = '0.16.0';
  const SEATS = Object.freeze(['p1', 'p2', 'p3', 'p4']);
  const MAX_EVENTS = 128;
  const DEFAULT_THRESHOLDS = Object.freeze({
    connectedRatio: .95,
    roundTripP95Ms: 80,
    roundTripSamplesPerSeat: 10,
    meaningfulDriveActionsPerSeat: 1,
    itemAttemptsPerSeat: 1,
    heartbeatsPerSeat: 10,
    reconnectsTotal: 1,
    ignoredActionsTotal: 1
  });

  function round(value, places) {
    if (!Number.isFinite(Number(value))) return null;
    const scale = Math.pow(10, places == null ? 2 : places);
    return Math.round(Number(value) * scale) / scale;
  }

  function safeCount(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function inspectPreflight(packet) {
    const transport = packet && packet.ok !== false ? packet.transport : null;
    const telemetryHealthy = Boolean(transport && Array.isArray(transport.sessions));
    const sessions = telemetryHealthy ? transport.sessions : [];
    const seats = SEATS.map(function (seatId) {
      const controllers = sessions.filter(function (session) {
        return session && session.player === seatId && session.clientKind === 'controller';
      });
      const connectedControllers = controllers.filter(function (session) { return session.connected === true; }).length;
      const confirmedControllers = controllers.filter(function (session) { return session.connected === true && session.seatConfirmed === true; }).length;
      const controllerSessions = controllers.length;
      const ready = controllerSessions === 1 && connectedControllers === 1 && confirmedControllers === 1;
      const status = ready ? 'ready' : (controllerSessions > 1 ? 'duplicate' : (controllerSessions === 1 && connectedControllers === 1 ? 'unconfirmed' : 'missing'));
      return {
        seat: seatId,
        controllerSessions: controllerSessions,
        connectedControllers: connectedControllers,
        confirmedControllers: confirmedControllers,
        status: status,
        ready: ready
      };
    });
    const missingSeats = seats.filter(function (seat) { return seat.status === 'missing'; }).map(function (seat) { return seat.seat; });
    const duplicateSeats = seats.filter(function (seat) { return seat.status === 'duplicate'; }).map(function (seat) { return seat.seat; });
    const unconfirmedSeats = seats.filter(function (seat) { return seat.status === 'unconfirmed'; }).map(function (seat) { return seat.seat; });
    return {
      schema: PREFLIGHT_SCHEMA,
      ready: telemetryHealthy && seats.every(function (seat) { return seat.ready; }),
      telemetryHealthy: telemetryHealthy,
      connectedSeatCount: seats.filter(function (seat) { return seat.controllerSessions === 1 && seat.connectedControllers === 1; }).length,
      confirmedSeatCount: seats.filter(function (seat) { return seat.ready; }).length,
      duplicateSeatCount: duplicateSeats.length,
      missingSeats: missingSeats,
      duplicateSeats: duplicateSeats,
      unconfirmedSeats: unconfirmedSeats,
      seats: seats,
      privacy: { sessionIdsRetained: false, networkAddressesRetained: false, userAgentRetained: false },
      evidenceBoundary: 'One connected and confirmed controller session per seat does not prove four independent physical phones or human identity.'
    };
  }

  function sanitizeStartPreflight(value) {
    const supplied = Boolean(value && value.schema === PREFLIGHT_SCHEMA);
    const sourceSeats = supplied && Array.isArray(value.seats) ? value.seats : [];
    const seats = SEATS.map(function (seatId) {
      const source = sourceSeats.find(function (seat) { return seat && seat.seat === seatId; }) || {};
      const controllerSessions = safeCount(source.controllerSessions);
      const connectedControllers = safeCount(source.connectedControllers);
      const confirmedControllers = safeCount(source.confirmedControllers);
      const ready = controllerSessions === 1 && connectedControllers === 1 && confirmedControllers === 1;
      const status = ready ? 'ready' : (controllerSessions > 1 ? 'duplicate' : (controllerSessions === 1 && connectedControllers === 1 ? 'unconfirmed' : 'missing'));
      return {
        seat: seatId,
        controllerSessions: controllerSessions,
        connectedControllers: connectedControllers,
        confirmedControllers: confirmedControllers,
        status: status,
        ready: ready
      };
    });
    const telemetryHealthy = supplied && value.telemetryHealthy === true;
    const ready = telemetryHealthy && value.ready === true && seats.every(function (seat) { return seat.ready; });
    return {
      schema: PREFLIGHT_SCHEMA,
      required: true,
      supplied: supplied,
      ready: ready,
      telemetryHealthy: telemetryHealthy,
      connectedSeatCount: seats.filter(function (seat) { return seat.controllerSessions === 1 && seat.connectedControllers === 1; }).length,
      confirmedSeatCount: seats.filter(function (seat) { return seat.ready; }).length,
      duplicateSeatCount: seats.filter(function (seat) { return seat.status === 'duplicate'; }).length,
      seats: seats
    };
  }

  function createSeatState(id) {
    return {
      id: id,
      connectedSnapshots: 0,
      maxConcurrentControllers: 0,
      currentControllerCount: 0,
      sessions: new Map(),
      wasConnected: false
    };
  }

  function createQualification(options) {
    const settings = options || {};
    const now = typeof settings.now === 'function' ? settings.now : function () { return Date.now(); };
    const wallNow = typeof settings.wallNow === 'function' ? settings.wallNow : function () { return Date.now(); };
    const requestedDurationMs = Math.min(1800000, Math.max(10000, Number(settings.requestedDurationMs) || 1800000));
    const thresholds = Object.assign({}, DEFAULT_THRESHOLDS, settings.thresholds || {});
    const startPreflight = sanitizeStartPreflight(settings.startPreflight);
    const seats = Object.fromEntries(SEATS.map(function (id) { return [id, createSeatState(id)]; }));
    const events = [];
    const attestations = {
      fourIndependentPhysicalPhones: false,
      intendedRouterLan: false,
      seatIdentityConfirmed: false
    };
    let active = false;
    let startedAt = null;
    let startedWall = null;
    let stoppedAt = null;
    let snapshots = 0;
    let allFourConnectedSnapshots = 0;
    let baselineCaptured = false;
    let telemetryFailures = 0;
    let globalBaseline = null;
    let globalLatest = null;
    let allFourWasConnected = false;

    function event(type, detail, at) {
      const clean = {};
      Object.keys(detail || {}).slice(0, 6).forEach(function (key) {
        const value = detail[key];
        if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) clean[String(key).slice(0, 32)] = value;
        else if (typeof value === 'string') clean[String(key).slice(0, 32)] = value.slice(0, 64);
      });
      events.push({ atMs: round(Math.max(0, Number(at == null ? now() : at) - (startedAt == null ? now() : startedAt)), 2), type: String(type || '').slice(0, 48), detail: clean });
      if (events.length > MAX_EVENTS) events.shift();
    }

    function start() {
      if (active || startedAt != null) return false;
      active = true;
      startedAt = now();
      startedWall = wallNow();
      event('qualification-start', { requestedDurationMs: requestedDurationMs }, startedAt);
      return true;
    }

    function sessionCounter(session, key) {
      return safeCount(session && session[key]);
    }

    function recordSession(seat, session, firstSnapshot) {
      const sessionId = String(session.sessionId || '');
      if (!sessionId) return;
      let record = seat.sessions.get(sessionId);
      if (!record) {
        const baselineIsCurrent = firstSnapshot;
        record = {
          baseline: {
            resumes: baselineIsCurrent ? sessionCounter(session, 'resumes') : 0,
            meaningful: baselineIsCurrent ? sessionCounter(session, 'appliedMeaningfulDriveActions') : 0,
            items: baselineIsCurrent ? sessionCounter(session, 'itemAttempts') : 0,
            heartbeats: baselineIsCurrent ? sessionCounter(session, 'heartbeatCount') : 0,
            accepted: baselineIsCurrent ? sessionCounter(session, 'acceptedActions') : 0,
            rejected: baselineIsCurrent ? sessionCounter(session, 'rejectedActions') : 0,
            ignored: baselineIsCurrent ? sessionCounter(session, 'ignoredActions') : 0
          },
          latest: {},
          maxRttP95: null,
          maxRttSamples: 0
        };
        seat.sessions.set(sessionId, record);
      }
      record.latest = {
        resumes: sessionCounter(session, 'resumes'),
        meaningful: sessionCounter(session, 'appliedMeaningfulDriveActions'),
        items: sessionCounter(session, 'itemAttempts'),
        heartbeats: sessionCounter(session, 'heartbeatCount'),
        accepted: sessionCounter(session, 'acceptedActions'),
        rejected: sessionCounter(session, 'rejectedActions'),
        ignored: sessionCounter(session, 'ignoredActions')
      };
      const rtt = session.roundTripMs || {};
      const rttSamples = safeCount(rtt.sampleCount);
      const rttP95 = Number(rtt.p95);
      record.maxRttSamples = Math.max(record.maxRttSamples, rttSamples);
      if (rttSamples && Number.isFinite(rttP95)) record.maxRttP95 = record.maxRttP95 == null ? rttP95 : Math.max(record.maxRttP95, rttP95);
    }

    function globalCounters(transport) {
      const actions = transport && transport.actionReceipts || {};
      return {
        accepted: sessionCounter(actions, 'accepted'),
        rejected: sessionCounter(actions, 'rejected'),
        applied: sessionCounter(actions, 'applied'),
        ignored: sessionCounter(actions, 'ignored')
      };
    }

    function recordTelemetry(packet) {
      if (!active || !packet || packet.ok === false || !packet.transport) return false;
      const transport = packet.transport;
      const transportSessions = Array.isArray(transport.sessions) ? transport.sessions : [];
      const firstSnapshot = !baselineCaptured;
      snapshots += 1;
      const connectedBySeat = {};
      SEATS.forEach(function (seatId) {
        const seat = seats[seatId];
        const controllers = transportSessions.filter(function (session) { return session.player === seatId && session.clientKind === 'controller'; });
        const connected = controllers.filter(function (session) { return session.connected; });
        seat.currentControllerCount = connected.length;
        connectedBySeat[seatId] = connected.length === 1;
        if (connected.length === 1) seat.connectedSnapshots += 1;
        seat.maxConcurrentControllers = Math.max(seat.maxConcurrentControllers, connected.length);
        controllers.forEach(function (session) { recordSession(seat, session, firstSnapshot); });
        const isConnected = connected.length === 1;
        if (isConnected !== seat.wasConnected) event(isConnected ? 'seat-connected' : 'seat-disconnected', { seat: seatId, activeControllers: connected.length });
        seat.wasConnected = isConnected;
      });
      const allFourConnected = SEATS.every(function (seatId) { return connectedBySeat[seatId]; });
      if (allFourConnected) allFourConnectedSnapshots += 1;
      if (allFourConnected !== allFourWasConnected) event(allFourConnected ? 'all-four-connected' : 'all-four-interrupted', {});
      allFourWasConnected = allFourConnected;
      const globals = globalCounters(transport);
      if (!globalBaseline) globalBaseline = globals;
      globalLatest = globals;
      baselineCaptured = true;
      return true;
    }

    function markTelemetryFailure() {
      if (!active) return false;
      telemetryFailures += 1;
      event('telemetry-failure', {});
      return true;
    }

    function setAttestations(next) {
      const source = next || {};
      Object.keys(attestations).forEach(function (key) { attestations[key] = Boolean(source[key]); });
      if (active) event('host-attestations-updated', Object.assign({}, attestations));
      return Object.assign({}, attestations);
    }

    function delta(latest, baseline, key) {
      return Math.max(0, safeCount(latest && latest[key]) - safeCount(baseline && baseline[key]));
    }

    function summarizeSeat(seat) {
      const sessions = Array.from(seat.sessions.values());
      const totals = { resumes: 0, meaningfulDrive: 0, itemAttempts: 0, heartbeats: 0, accepted: 0, rejected: 0, ignored: 0 };
      let rttSamples = 0;
      let rttP95 = null;
      sessions.forEach(function (session) {
        totals.resumes += delta(session.latest, session.baseline, 'resumes');
        totals.meaningfulDrive += delta(session.latest, session.baseline, 'meaningful');
        totals.itemAttempts += delta(session.latest, session.baseline, 'items');
        totals.heartbeats += delta(session.latest, session.baseline, 'heartbeats');
        totals.accepted += delta(session.latest, session.baseline, 'accepted');
        totals.rejected += delta(session.latest, session.baseline, 'rejected');
        totals.ignored += delta(session.latest, session.baseline, 'ignored');
        rttSamples = Math.max(rttSamples, session.maxRttSamples);
        if (session.maxRttP95 != null) rttP95 = rttP95 == null ? session.maxRttP95 : Math.max(rttP95, session.maxRttP95);
      });
      const connectedRatio = snapshots ? seat.connectedSnapshots / snapshots : 0;
      const checks = {
        stableSingleSession: sessions.length === 1 && seat.maxConcurrentControllers <= 1,
        connectedRatio: connectedRatio >= thresholds.connectedRatio,
        meaningfulDrive: totals.meaningfulDrive >= thresholds.meaningfulDriveActionsPerSeat,
        itemAttempt: totals.itemAttempts >= thresholds.itemAttemptsPerSeat,
        heartbeats: totals.heartbeats >= thresholds.heartbeatsPerSeat,
        roundTripSamples: rttSamples >= thresholds.roundTripSamplesPerSeat,
        roundTripBudget: rttP95 != null && rttP95 <= thresholds.roundTripP95Ms
      };
      return {
        seat: seat.id,
        controllerSessionCount: sessions.length,
        maxConcurrentControllers: seat.maxConcurrentControllers,
        currentlyConnected: seat.currentControllerCount === 1,
        connectedSamples: seat.connectedSnapshots,
        connectedRatio: round(connectedRatio, 4),
        appliedMeaningfulDriveActions: totals.meaningfulDrive,
        itemAttempts: totals.itemAttempts,
        heartbeats: totals.heartbeats,
        resumes: totals.resumes,
        acceptedActions: totals.accepted,
        rejectedActions: totals.rejected,
        ignoredActions: totals.ignored,
        roundTripMs: { samples: rttSamples, p95WorstObserved: round(rttP95, 2), budgetP95: thresholds.roundTripP95Ms },
        checks: checks,
        machineReady: Object.values(checks).every(Boolean)
      };
    }

    function buildReceipt(reason, at) {
      const end = Number(at == null ? (stoppedAt == null ? now() : stoppedAt) : at);
      const elapsedMs = startedAt == null ? 0 : Math.max(0, end - startedAt);
      const durationComplete = elapsedMs >= requestedDurationMs * .99;
      const seatReceipts = SEATS.map(function (seatId) { return summarizeSeat(seats[seatId]); });
      const globalDelta = {
        accepted: delta(globalLatest, globalBaseline, 'accepted'),
        rejected: delta(globalLatest, globalBaseline, 'rejected'),
        applied: delta(globalLatest, globalBaseline, 'applied'),
        ignored: delta(globalLatest, globalBaseline, 'ignored')
      };
      const totalResumes = seatReceipts.reduce(function (sum, seat) { return sum + seat.resumes; }, 0);
      const totalSessionIgnored = seatReceipts.reduce(function (sum, seat) { return sum + seat.ignoredActions; }, 0);
      const allFourRatio = snapshots ? allFourConnectedSnapshots / snapshots : 0;
      const machineChecks = {
        startPreflightReady: startPreflight.ready,
        controllerSeatConfirmationsReady: startPreflight.confirmedSeatCount === SEATS.length,
        allSeatsReady: seatReceipts.every(function (seat) { return seat.machineReady; }),
        allFourConnectedRatio: allFourRatio >= thresholds.connectedRatio,
        reconnectObserved: totalResumes >= thresholds.reconnectsTotal,
        inputOwnershipProtectionObserved: Math.max(globalDelta.ignored, totalSessionIgnored) >= thresholds.ignoredActionsTotal,
        telemetryHealthy: telemetryFailures === 0
      };
      const attestationsComplete = Object.values(attestations).every(Boolean);
      const eligibleForStewardReview = requestedDurationMs >= 1800000 && durationComplete && attestationsComplete && Object.values(machineChecks).every(Boolean);
      return {
        schema: SCHEMA,
        recorderVersion: VERSION,
        status: durationComplete ? 'complete' : 'partial',
        durationClass: requestedDurationMs >= 1800000 ? 'thirty-minute-four-phone-gate' : 'bounded-smoke',
        requestedDurationMs: requestedDurationMs,
        elapsedMs: round(elapsedMs, 2),
        startedAt: startedWall == null ? null : new Date(startedWall).toISOString(),
        endedAt: startedWall == null ? null : new Date(startedWall + elapsedMs).toISOString(),
        stopReason: String(reason || 'snapshot').slice(0, 64),
        telemetrySnapshots: snapshots,
        telemetryFailures: telemetryFailures,
        startPreflight: startPreflight,
        allFourConnected: { samples: allFourConnectedSnapshots, ratio: round(allFourRatio, 4), requiredRatio: thresholds.connectedRatio },
        seats: seatReceipts,
        transportDelta: globalDelta,
        totalReconnects: totalResumes,
        machineChecks: machineChecks,
        hostAttestations: Object.assign({}, attestations),
        eligibleForStewardReview: eligibleForStewardReview,
        physicalGateVerdict: 'requires-external-steward-review',
        recentTransitions: events.slice(),
        privacy: { sessionIdsRetained: false, networkAddressesRetained: false, userAgentRetained: false, rawActionsRetained: false, eventLimit: MAX_EVENTS },
        evidenceBoundaries: [
          'JavaScript controller sessions do not prove that four independent physical phones were present.',
          'Start preflight requires exactly one connected controller session and one explicit controller-side seat confirmation on P1-P4 before the qualification clock begins.',
          'A controller-side confirmation gesture does not prove a physical phone, a human identity, or truthful host attestation.',
          'Host attestations are declarations for steward review, not machine-verified hardware facts.',
          'Only a complete requested 30-minute receipt can become eligible for external steward review.',
          'The physical four-phone LAN gate remains open until the intended router and devices are externally observed.'
        ]
      };
    }

    function stop(reason) {
      if (!active) return buildReceipt(reason || 'already-stopped');
      stoppedAt = now();
      active = false;
      event('qualification-stop', { reason: String(reason || 'manual').slice(0, 64) }, stoppedAt);
      return buildReceipt(reason || 'manual', stoppedAt);
    }

    return {
      start: start,
      stop: stop,
      snapshot: function () { return buildReceipt('snapshot'); },
      isActive: function () { return active; },
      recordTelemetry: recordTelemetry,
      markTelemetryFailure: markTelemetryFailure,
      setAttestations: setAttestations
    };
  }

  return Object.freeze({
    SCHEMA: SCHEMA,
    PREFLIGHT_SCHEMA: PREFLIGHT_SCHEMA,
    VERSION: VERSION,
    SEATS: SEATS,
    MAX_EVENTS: MAX_EVENTS,
    DEFAULT_THRESHOLDS: DEFAULT_THRESHOLDS,
    inspectPreflight: inspectPreflight,
    createQualification: createQualification
  });
});
