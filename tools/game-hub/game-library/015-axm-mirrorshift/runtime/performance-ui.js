(function () {
  'use strict';

  const recorderCore = window.MirrorShiftPerformanceRecorder;
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('perf') === '1';
  const toggleButton = document.getElementById('perfLabButton');
  const panel = document.getElementById('performancePanel');
  const startButton = document.getElementById('perfStartButton');
  const stopButton = document.getElementById('perfStopButton');
  const downloadButton = document.getElementById('perfDownloadButton');
  const closeButton = document.getElementById('perfCloseButton');
  const durationSelect = document.getElementById('perfDuration');
  const status = document.getElementById('perfStatus');
  const elapsed = document.getElementById('perfElapsed');
  const frameP95 = document.getElementById('perfFrameP95');
  const renderP95 = document.getElementById('perfRenderP95');
  const tickP95 = document.getElementById('perfTickP95');
  const longTasks = document.getElementById('perfLongTasks');
  const memory = document.getElementById('perfMemory');
  const interruptions = document.getElementById('perfInterruptions');
  const gameFrame = document.querySelector('.game-frame');

  window.__MIRRORSHIFT_PERFORMANCE__ = {
    schema: recorderCore ? recorderCore.SCHEMA : 'axm.target-session-performance/v1',
    recorderVersion: recorderCore ? recorderCore.RECORDER_VERSION : null,
    enabled: enabled,
    active: false,
    receipt: null,
    error: recorderCore ? null : 'recorder-core-unavailable',
    authorityWrites: 0
  };

  if (!enabled || !recorderCore || !panel || !toggleButton) return;

  toggleButton.hidden = false;
  let session = null;
  let lastReceipt = null;
  let frameRequest = null;
  let lastFrameAt = null;
  let sampleTimer = null;
  let telemetryTimer = null;
  let autoStopTimer = null;
  let observer = null;
  let batteryManager = null;
  let sawAuthorityLoss = false;
  let lastConnectionState = null;

  const longTaskSupported = Boolean(window.PerformanceObserver && Array.isArray(PerformanceObserver.supportedEntryTypes) && PerformanceObserver.supportedEntryTypes.includes('longtask'));
  const heapSupported = Boolean(window.performance && window.performance.memory && Number.isFinite(window.performance.memory.usedJSHeapSize));
  const batterySupported = typeof navigator.getBattery === 'function';

  function formatMs(value) {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(1) + ' ms' : 'WAIT';
  }

  function formatBytes(value) {
    return Number.isFinite(Number(value)) ? (Number(value) / 1048576).toFixed(1) + ' MB' : 'UNAVAILABLE';
  }

  function formatElapsed(value) {
    const seconds = Math.max(0, Math.floor(Number(value) / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function syncPublic(receipt) {
    const publicState = window.__MIRRORSHIFT_PERFORMANCE__;
    publicState.active = Boolean(session && session.isActive());
    publicState.receipt = receipt || publicState.receipt;
    gameFrame.dataset.performanceSchema = publicState.schema;
    gameFrame.dataset.performanceEnabled = 'true';
    gameFrame.dataset.performanceActive = String(publicState.active);
    if (receipt) {
      gameFrame.dataset.performanceStatus = receipt.status;
      gameFrame.dataset.performanceElapsedMs = String(receipt.elapsedMs);
      gameFrame.dataset.performanceFrameP95Ms = String(receipt.frameMs.p95);
      gameFrame.dataset.performanceRenderP95Ms = String(receipt.renderMs.p95);
      gameFrame.dataset.performanceServerTickP95Ms = String(receipt.serverTickP95Ms.p95);
      gameFrame.dataset.performanceLongTasks = String(receipt.longTasks.count);
      gameFrame.dataset.performanceAuthorityWrites = '0';
      gameFrame.dataset.performanceThirtyMinuteGate = String(receipt.thirtyMinuteGateEligible);
      gameFrame.dataset.performanceRequestedDurationMs = String(receipt.requestedDurationMs);
      gameFrame.dataset.performanceDurationClass = receipt.durationClass;
      gameFrame.dataset.performanceWorkloadSegments = String(receipt.workloadSegments.length);
      gameFrame.dataset.performanceInterpolationFrames = String(receipt.interpolation.frames);
      gameFrame.dataset.performancePoseSnaps = String(receipt.interpolation.snaps);
      gameFrame.dataset.performancePrivacyRawFrames = String(receipt.privacy.rawFramesRetained);
      gameFrame.dataset.performancePrivacyUserAgent = String(receipt.privacy.userAgentRetained);
      gameFrame.dataset.performancePrivacyNetworkAddresses = String(receipt.privacy.networkAddressesRetained);
    }
  }

  function renderReceipt(receipt) {
    if (!receipt) return;
    elapsed.textContent = formatElapsed(receipt.elapsedMs);
    frameP95.textContent = formatMs(receipt.frameMs.p95);
    renderP95.textContent = formatMs(receipt.renderMs.p95);
    tickP95.textContent = formatMs(receipt.serverTickP95Ms.p95);
    longTasks.textContent = receipt.longTasks.supported ? String(receipt.longTasks.count) : 'UNAVAILABLE';
    memory.textContent = receipt.memory.supported ? formatBytes(receipt.memory.endBytes) : 'UNAVAILABLE';
    interruptions.textContent = String(receipt.interruptions.visibility + receipt.interruptions.focus + receipt.interruptions.offline);
    syncPublic(receipt);
  }

  function snapshot() {
    if (!session) return null;
    const receipt = session.snapshot();
    renderReceipt(receipt);
    return receipt;
  }

  async function sampleServerTelemetry() {
    if (!session || !session.isActive()) return;
    try {
      const response = await fetch('/api/telemetry', { cache: 'no-store' });
      if (!response.ok) throw new Error('telemetry-http-' + response.status);
      session.recordServerTelemetry(await response.json());
    } catch (_) {
      session.increment('serverTelemetryFailures', 'server-telemetry-failure');
    }
  }

  async function sampleBattery() {
    if (!session || !session.isActive() || !batterySupported) return;
    try {
      if (!batteryManager) batteryManager = await navigator.getBattery();
      session.recordBattery(batteryManager.level, batteryManager.charging);
    } catch (_) {}
  }

  function sampleDiagnostics() {
    if (!session || !session.isActive()) return;
    session.recordDiagnostics(window.__MIRRORSHIFT_RENDER__ || {});
    if (heapSupported) session.recordMemory(window.performance.memory.usedJSHeapSize);
    sampleBattery();
    snapshot();
  }

  function recordFrame(frameNow) {
    if (!session || !session.isActive()) return;
    if (lastFrameAt != null) session.recordFrame(frameNow - lastFrameAt);
    lastFrameAt = frameNow;
    frameRequest = requestAnimationFrame(recordFrame);
  }

  function targetMetadata() {
    return {
      label: params.get('perfLabel') || 'UNLABELLED TARGET',
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      reducedMotion: Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemoryGb: navigator.deviceMemory,
      longTaskObserver: longTaskSupported,
      jsHeapApi: heapSupported,
      batteryApi: batterySupported
    };
  }

  function stopSession(reason) {
    if (!session || !session.isActive()) return lastReceipt;
    clearInterval(sampleTimer);
    clearInterval(telemetryTimer);
    clearTimeout(autoStopTimer);
    if (frameRequest != null) cancelAnimationFrame(frameRequest);
    if (observer) observer.disconnect();
    sampleTimer = telemetryTimer = autoStopTimer = frameRequest = null;
    observer = null;
    if (batteryManager) session.recordBattery(batteryManager.level, batteryManager.charging);
    lastReceipt = session.stop(reason || 'manual');
    renderReceipt(lastReceipt);
    status.textContent = lastReceipt.thirtyMinuteGateEligible
      ? '30-MINUTE RECEIPT COMPLETE // JOIN EXTERNAL EVIDENCE'
      : (lastReceipt.status === 'complete' ? 'SMOKE COMPLETE // DOES NOT CLOSE 30-MINUTE GATE' : 'PARTIAL RECEIPT // DOES NOT CLOSE 30-MINUTE GATE');
    startButton.disabled = false;
    stopButton.disabled = true;
    durationSelect.disabled = false;
    downloadButton.disabled = false;
    return lastReceipt;
  }

  function startSession(durationOverrideMs) {
    if (session && session.isActive()) return;
    const requestedDurationMs = Math.min(1800000, Math.max(10000, Number(durationOverrideMs) || Number(durationSelect.value) || 1800000));
    if (!Array.from(durationSelect.options).some(function (option) { return Number(option.value) === requestedDurationMs; })) {
      const smokeOption = document.createElement('option');
      smokeOption.value = String(requestedDurationMs);
      smokeOption.textContent = Math.round(requestedDurationMs / 1000) + ' SECOND BOUNDED SMOKE';
      smokeOption.setAttribute('data-temporary-smoke', 'true');
      durationSelect.prepend(smokeOption);
    }
    durationSelect.value = String(requestedDurationMs);
    session = recorderCore.createSession({
      sessionId: 'mirrorshift-target-' + Date.now().toString(36),
      requestedDurationMs: requestedDurationMs,
      now: function () { return performance.now(); },
      wallNow: function () { return Date.now(); },
      target: targetMetadata()
    });
    session.start();
    lastReceipt = null;
    lastFrameAt = null;
    sawAuthorityLoss = false;
    startButton.disabled = true;
    stopButton.disabled = false;
    downloadButton.disabled = true;
    durationSelect.disabled = true;
    status.textContent = requestedDurationMs >= 1800000 ? 'RECORDING // 30-MINUTE TARGET GATE' : 'RECORDING // BOUNDED SMOKE';
    syncPublic(session.snapshot());
    frameRequest = requestAnimationFrame(recordFrame);
    sampleTimer = setInterval(sampleDiagnostics, 1000);
    telemetryTimer = setInterval(sampleServerTelemetry, 5000);
    autoStopTimer = setTimeout(function () { stopSession('duration-complete'); }, requestedDurationMs);
    sampleDiagnostics();
    sampleServerTelemetry();
    if (longTaskSupported) {
      try {
        observer = new PerformanceObserver(function (list) {
          if (!session || !session.isActive()) return;
          list.getEntries().forEach(function (entry) { session.recordLongTask(entry.duration); });
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (_) { observer = null; }
    }
  }

  function downloadReceipt() {
    if (!lastReceipt) return;
    const blob = new Blob([JSON.stringify(lastReceipt, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mirrorshift-target-session-' + lastReceipt.sessionId + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function openPanel() {
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    closeButton.focus();
  }

  function closePanel() {
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
    toggleButton.focus();
  }

  toggleButton.addEventListener('click', openPanel);
  closeButton.addEventListener('click', closePanel);
  startButton.addEventListener('click', function () { startSession(); });
  stopButton.addEventListener('click', function () { stopSession('manual'); });
  downloadButton.addEventListener('click', downloadReceipt);
  document.addEventListener('visibilitychange', function () {
    if (!session || !session.isActive() || !document.hidden) return;
    session.increment('visibilityInterruptions', 'visibility-hidden');
  });
  window.addEventListener('blur', function () {
    if (session && session.isActive()) session.increment('focusInterruptions', 'window-blur');
  });
  window.addEventListener('offline', function () {
    if (session && session.isActive()) session.increment('offlineEvents', 'network-offline');
  });
  window.addEventListener('online', function () {
    if (session && session.isActive()) session.markEvent('network-online');
  });

  const connectionStatus = document.getElementById('connectionStatus');
  if (connectionStatus && window.MutationObserver) {
    new MutationObserver(function () {
      const connected = connectionStatus.textContent.includes('// LIVE');
      if (lastConnectionState === true && !connected && session && session.isActive()) {
        sawAuthorityLoss = true;
        session.markEvent('authority-link-lost');
      }
      if (lastConnectionState === false && connected && sawAuthorityLoss && session && session.isActive()) {
        session.increment('reconnects', 'authority-restored');
        sawAuthorityLoss = false;
      }
      lastConnectionState = connected;
    }).observe(connectionStatus, { childList: true, characterData: true, subtree: true });
  }

  openPanel();
  const querySeconds = Number(params.get('perfDuration'));
  if (params.get('perfAutostart') === '1') startSession(Number.isFinite(querySeconds) ? querySeconds * 1000 : undefined);
})();
