(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MirrorShiftPerformanceRecorder = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SCHEMA = 'axm.target-session-performance/v1';
  const RECORDER_VERSION = '0.12.0';
  const MAX_EVENTS = 128;

  function round(value, places) {
    if (!Number.isFinite(value)) return null;
    const scale = Math.pow(10, places == null ? 2 : places);
    return Math.round(value * scale) / scale;
  }

  function createMetric(binWidth, maxValue) {
    const width = Math.max(.01, Number(binWidth) || .5);
    const max = Math.max(width, Number(maxValue) || 500);
    return {
      binWidth: width,
      maxValue: max,
      bins: new Array(Math.ceil(max / width) + 1).fill(0),
      count: 0,
      sum: 0,
      min: null,
      max: null,
      overflow: 0
    };
  }

  function recordMetric(metric, rawValue) {
    const value = Number(rawValue);
    if (!metric || !Number.isFinite(value) || value < 0) return false;
    metric.count += 1;
    metric.sum += value;
    metric.min = metric.min == null ? value : Math.min(metric.min, value);
    metric.max = metric.max == null ? value : Math.max(metric.max, value);
    if (value > metric.maxValue) metric.overflow += 1;
    const index = Math.min(metric.bins.length - 1, Math.floor(value / metric.binWidth));
    metric.bins[index] += 1;
    return true;
  }

  function percentile(metric, ratio) {
    if (!metric || !metric.count) return null;
    const target = Math.max(1, Math.ceil(metric.count * Math.min(1, Math.max(0, Number(ratio) || 0))));
    let seen = 0;
    for (let index = 0; index < metric.bins.length; index += 1) {
      seen += metric.bins[index];
      if (seen >= target) return round(Math.min(metric.maxValue, (index + 1) * metric.binWidth), 2);
    }
    return round(metric.max, 2);
  }

  function summarizeMetric(metric) {
    if (!metric || !metric.count) return { samples: 0, average: null, p50: null, p95: null, p99: null, min: null, max: null, overflow: 0 };
    return {
      samples: metric.count,
      average: round(metric.sum / metric.count, 2),
      p50: percentile(metric, .5),
      p95: percentile(metric, .95),
      p99: percentile(metric, .99),
      min: round(metric.min, 2),
      max: round(metric.max, 2),
      overflow: metric.overflow
    };
  }

  function cleanString(value, limit) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, Number(limit) || 80);
  }

  function cleanDetail(detail) {
    const source = detail && typeof detail === 'object' ? detail : {};
    const clean = {};
    Object.keys(source).slice(0, 8).forEach(function (key) {
      const safeKey = cleanString(key, 32);
      const value = source[key];
      if (!safeKey) return;
      if (typeof value === 'number' && Number.isFinite(value)) clean[safeKey] = round(value, 2);
      else if (typeof value === 'boolean') clean[safeKey] = value;
      else if (typeof value === 'string') clean[safeKey] = cleanString(value, 96);
    });
    return clean;
  }

  function cleanTarget(meta) {
    const source = meta && typeof meta === 'object' ? meta : {};
    return {
      label: cleanString(source.label || 'UNLABELLED TARGET', 64),
      viewport: {
        width: Math.max(0, Math.round(Number(source.viewportWidth) || 0)),
        height: Math.max(0, Math.round(Number(source.viewportHeight) || 0)),
        devicePixelRatio: round(Math.max(0, Number(source.devicePixelRatio) || 0), 2)
      },
      reducedMotion: Boolean(source.reducedMotion),
      hardwareConcurrency: Number.isFinite(Number(source.hardwareConcurrency)) ? Math.max(0, Math.round(Number(source.hardwareConcurrency))) : null,
      deviceMemoryGb: Number.isFinite(Number(source.deviceMemoryGb)) ? round(Math.max(0, Number(source.deviceMemoryGb)), 1) : null,
      longTaskObserver: Boolean(source.longTaskObserver),
      jsHeapApi: Boolean(source.jsHeapApi),
      batteryApi: Boolean(source.batteryApi)
    };
  }

  function createSession(options) {
    const settings = options || {};
    const now = typeof settings.now === 'function' ? settings.now : function () { return Date.now(); };
    const wallNow = typeof settings.wallNow === 'function' ? settings.wallNow : function () { return Date.now(); };
    const requestedDurationMs = Math.min(1800000, Math.max(10000, Number(settings.requestedDurationMs) || 1800000));
    const sessionId = cleanString(settings.sessionId || ('mirrorshift-' + Math.round(wallNow()).toString(36)), 96);
    const metrics = {
      frameMs: createMetric(.5, 500),
      renderMs: createMetric(.1, 250),
      uiUpdateMs: createMetric(.1, 250),
      schedulingWaitMs: createMetric(.5, 500),
      authorityPacketMs: createMetric(.5, 500),
      serverTickAverageMs: createMetric(.05, 25),
      serverTickP95Ms: createMetric(.05, 25),
      clientRttP95Ms: createMetric(.5, 5000),
      serverProcessP95Ms: createMetric(.1, 500),
      longTaskMs: createMetric(1, 1000),
      jsHeapBytes: createMetric(1024 * 1024, 4 * 1024 * 1024 * 1024)
    };
    const counters = {
      framesOver16_7: 0,
      framesOver25: 0,
      framesOver33_4: 0,
      framesOver50: 0,
      frameStallsOver250: 0,
      longTasks: 0,
      interpolationFrames: 0,
      poseSnapFrames: 0,
      visibilityInterruptions: 0,
      focusInterruptions: 0,
      offlineEvents: 0,
      reconnects: 0,
      serverTelemetryFailures: 0
    };
    const events = [];
    const workloads = [];
    let target = cleanTarget(settings.target);
    let active = false;
    let startedAt = null;
    let startedWall = null;
    let stoppedAt = null;
    let currentWorkload = null;
    let lastInterpolation = null;
    let lastSnaps = null;
    let batteryStart = null;
    let batteryEnd = null;
    let memoryStart = null;
    let memoryEnd = null;

    function markEvent(type, detail, at) {
      const event = { atMs: round(Math.max(0, Number(at == null ? now() : at) - (startedAt == null ? now() : startedAt)), 2), type: cleanString(type, 48), detail: cleanDetail(detail) };
      events.push(event);
      if (events.length > MAX_EVENTS) events.shift();
      return event;
    }

    function start(meta) {
      if (active || startedAt != null) return false;
      if (meta) target = cleanTarget(meta);
      startedAt = now();
      startedWall = wallNow();
      active = true;
      markEvent('session-start', { requestedDurationMs: requestedDurationMs }, startedAt);
      return true;
    }

    function recordFrame(deltaMs) {
      if (!active || !recordMetric(metrics.frameMs, deltaMs)) return false;
      const value = Number(deltaMs);
      if (value > 16.7) counters.framesOver16_7 += 1;
      if (value > 25) counters.framesOver25 += 1;
      if (value > 33.4) counters.framesOver33_4 += 1;
      if (value > 50) counters.framesOver50 += 1;
      if (value > 250) counters.frameStallsOver250 += 1;
      return true;
    }

    function updateWorkload(workload, at) {
      const value = cleanString(workload || 'unknown', 128) || 'unknown';
      const when = Number(at == null ? now() : at);
      if (currentWorkload && currentWorkload.id === value) return;
      if (currentWorkload) currentWorkload.endedAtMs = round(Math.max(0, when - startedAt), 2);
      currentWorkload = { id: value, startedAtMs: round(Math.max(0, when - startedAt), 2), endedAtMs: null };
      workloads.push(currentWorkload);
      if (workloads.length > 64) workloads.shift();
      markEvent('workload-change', { workload: value }, when);
    }

    function recordDiagnostics(diagnostics, at) {
      if (!active || !diagnostics || typeof diagnostics !== 'object') return false;
      recordMetric(metrics.renderMs, diagnostics.averageRenderMs);
      recordMetric(metrics.uiUpdateMs, diagnostics.uiUpdateAverageMs);
      recordMetric(metrics.schedulingWaitMs, diagnostics.schedulingWaitMs);
      recordMetric(metrics.authorityPacketMs, diagnostics.authorityPacketMs);
      updateWorkload(diagnostics.workload, at);
      const interpolation = Math.max(0, Number(diagnostics.interpolationFrames) || 0);
      const snaps = Math.max(0, Number(diagnostics.poseSnapFrames) || 0);
      if (lastInterpolation != null) counters.interpolationFrames += interpolation >= lastInterpolation ? interpolation - lastInterpolation : interpolation;
      if (lastSnaps != null) counters.poseSnapFrames += snaps >= lastSnaps ? snaps - lastSnaps : snaps;
      lastInterpolation = interpolation;
      lastSnaps = snaps;
      return true;
    }

    function recordServerTelemetry(packet) {
      if (!active || !packet || packet.ok === false) return false;
      const tick = packet.tickMs || {};
      const transport = packet.transport || {};
      recordMetric(metrics.serverTickAverageMs, tick.average);
      recordMetric(metrics.serverTickP95Ms, tick.p95);
      recordMetric(metrics.clientRttP95Ms, transport.clientReportedRoundTripMs && transport.clientReportedRoundTripMs.p95);
      recordMetric(metrics.serverProcessP95Ms, transport.actionReceipts && transport.actionReceipts.p95);
      return true;
    }

    function recordLongTask(durationMs) {
      if (!active || !recordMetric(metrics.longTaskMs, durationMs)) return false;
      counters.longTasks += 1;
      return true;
    }

    function recordMemory(usedBytes) {
      if (!active || !recordMetric(metrics.jsHeapBytes, usedBytes)) return false;
      if (memoryStart == null) memoryStart = Number(usedBytes);
      memoryEnd = Number(usedBytes);
      return true;
    }

    function recordBattery(level, charging) {
      if (!active) return false;
      const snapshot = { level: Number.isFinite(Number(level)) ? round(Math.min(1, Math.max(0, Number(level))), 3) : null, charging: Boolean(charging) };
      if (!batteryStart) batteryStart = snapshot;
      batteryEnd = snapshot;
      return true;
    }

    function increment(counter, eventType, detail) {
      if (!active || !Object.prototype.hasOwnProperty.call(counters, counter)) return false;
      counters[counter] += 1;
      markEvent(eventType || counter, detail || {});
      return true;
    }

    function receipt(stopReason, stoppedAtOverride) {
      const end = stoppedAtOverride == null ? (stoppedAt == null ? now() : stoppedAt) : Number(stoppedAtOverride);
      const elapsedMs = startedAt == null ? 0 : Math.max(0, end - startedAt);
      const durationComplete = elapsedMs >= requestedDurationMs * .99;
      const thirtyMinuteGateEligible = requestedDurationMs >= 1800000 && durationComplete;
      const frame = summarizeMetric(metrics.frameMs);
      const frameCount = Math.max(1, frame.samples);
      frame.over16_7Rate = round(counters.framesOver16_7 / frameCount * 100, 2);
      frame.over25Rate = round(counters.framesOver25 / frameCount * 100, 2);
      frame.over33_4Rate = round(counters.framesOver33_4 / frameCount * 100, 2);
      frame.over50Rate = round(counters.framesOver50 / frameCount * 100, 2);
      frame.stallsOver250 = counters.frameStallsOver250;
      const memory = summarizeMetric(metrics.jsHeapBytes);
      memory.supported = target.jsHeapApi;
      memory.startBytes = memoryStart == null ? null : Math.round(memoryStart);
      memory.endBytes = memoryEnd == null ? null : Math.round(memoryEnd);
      memory.deltaBytes = memoryStart == null || memoryEnd == null ? null : Math.round(memoryEnd - memoryStart);
      return {
        schema: SCHEMA,
        recorderVersion: RECORDER_VERSION,
        sessionId: sessionId,
        status: durationComplete ? 'complete' : 'partial',
        durationClass: requestedDurationMs >= 1800000 ? 'thirty-minute-target-gate' : 'bounded-smoke',
        thirtyMinuteGateEligible: thirtyMinuteGateEligible,
        stopReason: cleanString(stopReason || 'snapshot', 64),
        requestedDurationMs: requestedDurationMs,
        elapsedMs: round(elapsedMs, 2),
        startedAt: startedWall == null ? null : new Date(startedWall).toISOString(),
        endedAt: startedWall == null ? null : new Date(startedWall + elapsedMs).toISOString(),
        target: target,
        frameMs: frame,
        renderMs: summarizeMetric(metrics.renderMs),
        uiUpdateMs: summarizeMetric(metrics.uiUpdateMs),
        schedulingWaitMs: summarizeMetric(metrics.schedulingWaitMs),
        authorityPacketMs: summarizeMetric(metrics.authorityPacketMs),
        serverTickAverageMs: summarizeMetric(metrics.serverTickAverageMs),
        serverTickP95Ms: summarizeMetric(metrics.serverTickP95Ms),
        clientRttP95Ms: summarizeMetric(metrics.clientRttP95Ms),
        serverProcessP95Ms: summarizeMetric(metrics.serverProcessP95Ms),
        interpolation: { frames: counters.interpolationFrames, snaps: counters.poseSnapFrames },
        longTasks: Object.assign(summarizeMetric(metrics.longTaskMs), { supported: target.longTaskObserver, count: counters.longTasks }),
        memory: memory,
        battery: {
          supported: target.batteryApi,
          start: batteryStart,
          end: batteryEnd,
          levelDelta: batteryStart && batteryEnd && batteryStart.level != null && batteryEnd.level != null ? round(batteryEnd.level - batteryStart.level, 3) : null
        },
        interruptions: {
          visibility: counters.visibilityInterruptions,
          focus: counters.focusInterruptions,
          offline: counters.offlineEvents,
          reconnects: counters.reconnects,
          serverTelemetryFailures: counters.serverTelemetryFailures
        },
        workloadSegments: workloads.map(function (item) { return Object.assign({}, item); }),
        recentEvents: events.slice(),
        privacy: {
          rawFramesRetained: false,
          userAgentRetained: false,
          networkAddressesRetained: false,
          eventLimit: MAX_EVENTS,
          histogramsOnly: true
        },
        evidenceBoundaries: [
          'This receipt measures only the browser and local runtime that produced it.',
          'Thermal and operating-system compositor evidence require an external native profiler.',
          'Perceived motion smoothness requires high-cadence observation on the target display.',
          'Only a complete requested 30-minute receipt can be eligible for the hardware-soak evidence join.'
        ]
      };
    }

    function stop(reason) {
      if (!active) return receipt(reason || 'already-stopped');
      stoppedAt = now();
      active = false;
      if (currentWorkload) currentWorkload.endedAtMs = round(Math.max(0, stoppedAt - startedAt), 2);
      markEvent('session-stop', { reason: cleanString(reason || 'manual', 64) }, stoppedAt);
      return receipt(reason || 'manual', stoppedAt);
    }

    return {
      start: start,
      stop: stop,
      snapshot: function () { return receipt('snapshot'); },
      isActive: function () { return active; },
      recordFrame: recordFrame,
      recordDiagnostics: recordDiagnostics,
      recordServerTelemetry: recordServerTelemetry,
      recordLongTask: recordLongTask,
      recordMemory: recordMemory,
      recordBattery: recordBattery,
      markEvent: markEvent,
      increment: increment
    };
  }

  return Object.freeze({
    SCHEMA: SCHEMA,
    RECORDER_VERSION: RECORDER_VERSION,
    MAX_EVENTS: MAX_EVENTS,
    createMetric: createMetric,
    recordMetric: recordMetric,
    summarizeMetric: summarizeMetric,
    createSession: createSession
  });
});
