(function () {
  'use strict';

  const core = window.MirrorShiftLanQualification;
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('lanlab') === '1';
  const toggle = document.getElementById('lanLabButton');
  const panel = document.getElementById('lanLabPanel');
  const close = document.getElementById('lanCloseButton');
  const start = document.getElementById('lanStartButton');
  const stop = document.getElementById('lanStopButton');
  const download = document.getElementById('lanDownloadButton');
  const duration = document.getElementById('lanDuration');
  const status = document.getElementById('lanStatus');
  const elapsed = document.getElementById('lanElapsed');
  const allFour = document.getElementById('lanAllFour');
  const reconnect = document.getElementById('lanReconnect');
  const ownership = document.getElementById('lanOwnership');
  const physicalVerdict = document.getElementById('lanPhysicalVerdict');
  const gameFrame = document.querySelector('.game-frame');
  const attestationInputs = Array.from(document.querySelectorAll('[data-lan-attestation]'));

  window.__MIRRORSHIFT_LAN_QUALIFICATION__ = {
    schema: core ? core.SCHEMA : 'axm.four-phone-lan-qualification/v1',
    preflightSchema: core ? core.PREFLIGHT_SCHEMA : 'axm.four-phone-lan-preflight/v1',
    recorderVersion: core ? core.VERSION : null,
    enabled,
    active: false,
    preflight: null,
    receipt: null,
    authorityWrites: 0,
    error: core ? null : 'lan-qualification-core-unavailable'
  };

  if (!enabled || !core || !toggle || !panel) return;

  toggle.hidden = false;
  let qualification = null;
  let lastReceipt = null;
  let sampleTimer = null;
  let autoStopTimer = null;
  let preflightTimer = null;
  let preflightBusy = false;
  let lastPreflight = null;
  let pendingAutoStartDuration = null;

  function formatElapsed(ms) {
    const seconds = Math.max(0, Math.floor(Number(ms) / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function attestations() {
    const value = {};
    attestationInputs.forEach(function (input) { value[input.getAttribute('data-lan-attestation')] = input.checked; });
    return value;
  }

  function setCheck(element, pass, label) {
    element.textContent = (pass ? 'PASS · ' : 'WAIT · ') + label;
    element.classList.toggle('is-pass', Boolean(pass));
  }

  function renderSeat(seat) {
    const card = document.querySelector('[data-lan-seat="' + seat.seat + '"]');
    if (!card) return;
    card.classList.remove('is-preflight-ready', 'is-blocked');
    card.classList.toggle('is-connected', seat.currentlyConnected);
    card.classList.toggle('is-ready', seat.machineReady);
    card.querySelector('[data-lan-role="link"]').textContent = seat.currentlyConnected ? 'CONTROLLER LIVE' : 'WAITING FOR PHONE';
    card.querySelector('[data-lan-role="rtt"]').textContent = seat.roundTripMs.p95WorstObserved == null ? 'RTT —' : 'RTT P95 ' + seat.roundTripMs.p95WorstObserved + 'MS';
    card.querySelector('[data-lan-role="session"]').textContent = seat.controllerSessionCount + ' SESSION · MAX ' + seat.maxConcurrentControllers + ' ACTIVE';
    setCheck(card.querySelector('[data-lan-role="drive"]'), seat.checks.meaningfulDrive, 'DRIVE ' + seat.appliedMeaningfulDriveActions);
    setCheck(card.querySelector('[data-lan-role="item"]'), seat.checks.itemAttempt, 'FIRE ' + seat.itemAttempts);
    setCheck(card.querySelector('[data-lan-role="heartbeat"]'), seat.checks.heartbeats, 'HEARTBEAT ' + seat.heartbeats);
    setCheck(card.querySelector('[data-lan-role="latency"]'), seat.checks.roundTripSamples && seat.checks.roundTripBudget, 'RTT SAMPLES ' + seat.roundTripMs.samples);
    setCheck(card.querySelector('[data-lan-role="identity"]'), seat.checks.stableSingleSession, 'STABLE ID');
    card.dataset.lanConnected = String(seat.currentlyConnected);
    card.dataset.lanMachineReady = String(seat.machineReady);
    card.dataset.lanRttP95Ms = String(seat.roundTripMs.p95WorstObserved);
    card.dataset.lanMeaningfulDrive = String(seat.appliedMeaningfulDriveActions);
    card.dataset.lanItemAttempts = String(seat.itemAttempts);
    card.dataset.lanResumes = String(seat.resumes);
  }

  function renderPreflight(preflight, force) {
    if (!preflight) return;
    const publicState = window.__MIRRORSHIFT_LAN_QUALIFICATION__;
    publicState.preflight = preflight;
    gameFrame.dataset.lanPreflightSchema = preflight.schema;
    gameFrame.dataset.lanPreflightReady = String(preflight.ready);
    gameFrame.dataset.lanPreflightConnectedSeats = String(preflight.connectedSeatCount);
    gameFrame.dataset.lanPreflightConfirmedSeats = String(preflight.confirmedSeatCount);
    gameFrame.dataset.lanPreflightDuplicateSeats = String(preflight.duplicateSeatCount);
    start.disabled = !preflight.ready;
    if ((qualification && qualification.isActive()) || (lastReceipt && !force)) return;

    elapsed.textContent = '00:00';
    allFour.textContent = preflight.connectedSeatCount + '/4';
    reconnect.textContent = '0';
    ownership.textContent = 'WAIT';
    physicalVerdict.textContent = 'EXTERNAL REVIEW';
    preflight.seats.forEach(function (seat) {
      const card = document.querySelector('[data-lan-seat="' + seat.seat + '"]');
      if (!card) return;
      const exactlyOneConnected = seat.controllerSessions === 1 && seat.connectedControllers === 1;
      card.classList.toggle('is-connected', exactlyOneConnected);
      card.classList.remove('is-ready');
      card.classList.toggle('is-preflight-ready', seat.ready);
      card.classList.toggle('is-blocked', seat.status === 'duplicate' || seat.status === 'unconfirmed');
      card.querySelector('[data-lan-role="link"]').textContent = seat.ready
        ? 'PREFLIGHT READY'
        : (seat.status === 'duplicate' ? 'DUPLICATE CONTROLLERS' : (seat.status === 'unconfirmed' ? 'CONFIRM ON CONTROLLER' : 'WAITING FOR PHONE'));
      card.querySelector('[data-lan-role="rtt"]').textContent = 'PREFLIGHT';
      card.querySelector('[data-lan-role="session"]').textContent = seat.connectedControllers + ' LIVE · ' + seat.controllerSessions + ' SESSION · ' + seat.confirmedControllers + ' CONFIRM';
      setCheck(card.querySelector('[data-lan-role="drive"]'), false, 'DRIVE AFTER START');
      setCheck(card.querySelector('[data-lan-role="item"]'), false, 'FIRE AFTER START');
      setCheck(card.querySelector('[data-lan-role="heartbeat"]'), false, 'HEARTBEAT AFTER START');
      setCheck(card.querySelector('[data-lan-role="latency"]'), false, 'RTT AFTER START');
      setCheck(card.querySelector('[data-lan-role="identity"]'), seat.ready, seat.status === 'unconfirmed' ? 'TAP CONFIRM P' + seat.seat.slice(1) : 'CONTROLLER + CONFIRM');
      card.dataset.lanPreflightStatus = seat.status;
      card.dataset.lanConnected = String(exactlyOneConnected);
      card.dataset.lanSeatConfirmed = String(seat.confirmedControllers === 1);
      card.dataset.lanMachineReady = 'false';
    });

    if (!preflight.telemetryHealthy) status.textContent = 'PREFLIGHT BLOCKED · TELEMETRY UNAVAILABLE';
    else if (preflight.duplicateSeats.length) status.textContent = 'PREFLIGHT BLOCKED · CLOSE DUPLICATES ON ' + preflight.duplicateSeats.join(' + ').toUpperCase() + ' · CLEARS WITHIN 15S';
    else if (preflight.missingSeats.length) status.textContent = 'PREFLIGHT · CONNECT ' + preflight.missingSeats.join(' + ').toUpperCase() + ' BEFORE START';
    else if (preflight.unconfirmedSeats.length) status.textContent = 'PREFLIGHT · TAP CONFIRM ON ' + preflight.unconfirmedSeats.join(' + ').toUpperCase() + ' CONTROLLERS';
    else status.textContent = 'PREFLIGHT PASS · CONTROLLER SEATS CONFIRMED · VERIFY PHONES + ROUTER';
  }

  function syncPublic(receipt) {
    const publicState = window.__MIRRORSHIFT_LAN_QUALIFICATION__;
    publicState.active = Boolean(qualification && qualification.isActive());
    publicState.receipt = receipt || publicState.receipt;
    gameFrame.dataset.lanSchema = publicState.schema;
    gameFrame.dataset.lanEnabled = 'true';
    gameFrame.dataset.lanActive = String(publicState.active);
    gameFrame.dataset.lanAuthorityWrites = '0';
    if (!receipt) return;
    gameFrame.dataset.lanStatus = receipt.status;
    gameFrame.dataset.lanDurationClass = receipt.durationClass;
    gameFrame.dataset.lanRequestedDurationMs = String(receipt.requestedDurationMs);
    gameFrame.dataset.lanElapsedMs = String(receipt.elapsedMs);
    gameFrame.dataset.lanAllFourRatio = String(receipt.allFourConnected.ratio);
    gameFrame.dataset.lanReconnects = String(receipt.totalReconnects);
    gameFrame.dataset.lanOwnershipProtected = String(receipt.machineChecks.inputOwnershipProtectionObserved);
    gameFrame.dataset.lanSeatConfirmationsReady = String(receipt.machineChecks.controllerSeatConfirmationsReady);
    gameFrame.dataset.lanEligibleForStewardReview = String(receipt.eligibleForStewardReview);
    gameFrame.dataset.lanPhysicalGateVerdict = receipt.physicalGateVerdict;
    gameFrame.dataset.lanSessionIdsRetained = String(receipt.privacy.sessionIdsRetained);
    gameFrame.dataset.lanNetworkAddressesRetained = String(receipt.privacy.networkAddressesRetained);
    gameFrame.dataset.lanRawActionsRetained = String(receipt.privacy.rawActionsRetained);
  }

  function render(receipt) {
    if (!receipt) return;
    elapsed.textContent = formatElapsed(receipt.elapsedMs);
    allFour.textContent = Math.round(receipt.allFourConnected.ratio * 100) + '%';
    reconnect.textContent = String(receipt.totalReconnects);
    ownership.textContent = receipt.machineChecks.inputOwnershipProtectionObserved ? 'PASS' : 'WAIT';
    physicalVerdict.textContent = 'EXTERNAL REVIEW';
    receipt.seats.forEach(renderSeat);
    syncPublic(receipt);
  }

  async function readPreflight() {
    const response = await fetch('/api/telemetry', { cache: 'no-store' });
    if (!response.ok) throw new Error('telemetry-http-' + response.status);
    const packet = await response.json();
    return { packet: packet, preflight: core.inspectPreflight(packet) };
  }

  async function samplePreflight(force) {
    if ((qualification && qualification.isActive()) || preflightBusy) return null;
    preflightBusy = true;
    try {
      const result = await readPreflight();
      lastPreflight = result.preflight;
      window.__MIRRORSHIFT_LAN_QUALIFICATION__.error = null;
      renderPreflight(lastPreflight, force);
      if (pendingAutoStartDuration != null && lastPreflight.ready) {
        const requested = pendingAutoStartDuration;
        pendingAutoStartDuration = null;
        beginQualification(requested, result.packet, lastPreflight);
      }
      return result;
    } catch (_) {
      lastPreflight = core.inspectPreflight({ ok: false });
      window.__MIRRORSHIFT_LAN_QUALIFICATION__.error = 'lan-preflight-telemetry-unavailable';
      renderPreflight(lastPreflight, force);
      return null;
    } finally {
      preflightBusy = false;
    }
  }

  async function sampleTelemetry() {
    if (!qualification || !qualification.isActive()) return;
    try {
      const response = await fetch('/api/telemetry', { cache: 'no-store' });
      if (!response.ok) throw new Error('telemetry-http-' + response.status);
      qualification.recordTelemetry(await response.json());
    } catch (_) {
      qualification.markTelemetryFailure();
    }
    render(qualification.snapshot());
  }

  function stopQualification(reason) {
    if (!qualification || !qualification.isActive()) return lastReceipt;
    clearInterval(sampleTimer);
    clearTimeout(autoStopTimer);
    sampleTimer = autoStopTimer = null;
    qualification.setAttestations(attestations());
    lastReceipt = qualification.stop(reason || 'manual');
    render(lastReceipt);
    status.textContent = lastReceipt.eligibleForStewardReview
      ? 'ELIGIBLE FOR EXTERNAL STEWARD REVIEW · NOT SELF-CERTIFIED'
      : (lastReceipt.status === 'complete' ? 'SMOKE COMPLETE · PHYSICAL GATE STILL OPEN' : 'PARTIAL RECEIPT · PHYSICAL GATE STILL OPEN');
    start.disabled = true;
    stop.disabled = true;
    download.disabled = false;
    duration.disabled = false;
    attestationInputs.forEach(function (input) { input.disabled = false; });
    samplePreflight();
    return lastReceipt;
  }

  function beginQualification(durationOverrideMs, initialPacket, preflight) {
    if (qualification && qualification.isActive()) return;
    const requestedDurationMs = Math.min(1800000, Math.max(10000, Number(durationOverrideMs) || Number(duration.value) || 1800000));
    if (!Array.from(duration.options).some(function (option) { return Number(option.value) === requestedDurationMs; })) {
      const smokeOption = document.createElement('option');
      smokeOption.value = String(requestedDurationMs);
      smokeOption.textContent = Math.round(requestedDurationMs / 1000) + ' SECOND BOUNDED SMOKE';
      duration.prepend(smokeOption);
    }
    duration.value = String(requestedDurationMs);
    qualification = core.createQualification({ requestedDurationMs, startPreflight: preflight });
    qualification.setAttestations(attestations());
    qualification.start();
    if (!qualification.recordTelemetry(initialPacket)) qualification.markTelemetryFailure();
    lastReceipt = null;
    start.disabled = true;
    stop.disabled = false;
    download.disabled = true;
    duration.disabled = true;
    status.textContent = requestedDurationMs >= 1800000 ? 'RECORDING · FOUR-PHONE TARGET GATE' : 'RECORDING · BOUNDED LOCAL SMOKE';
    gameFrame.dataset.lanStartPreflightReady = 'true';
    render(qualification.snapshot());
    sampleTimer = setInterval(sampleTelemetry, 1000);
    autoStopTimer = setTimeout(function () { stopQualification('duration-complete'); }, requestedDurationMs);
    return true;
  }

  async function requestStart(durationOverrideMs) {
    if (qualification && qualification.isActive()) return false;
    start.disabled = true;
    status.textContent = 'PREFLIGHT · VERIFYING FOUR CONTROLLER SEATS';
    const result = await samplePreflight(true);
    if (!result || !result.preflight.ready) return false;
    return beginQualification(durationOverrideMs, result.packet, result.preflight);
  }

  function downloadReceipt() {
    if (!lastReceipt) return;
    const blob = new Blob([JSON.stringify(lastReceipt, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mirrorshift-four-phone-lan-' + Date.now().toString(36) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function openPanel() {
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    close.focus();
  }

  function closePanel() {
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
    toggle.focus();
  }

  toggle.addEventListener('click', openPanel);
  close.addEventListener('click', closePanel);
  start.addEventListener('click', function () { requestStart(); });
  stop.addEventListener('click', function () { stopQualification('manual'); });
  download.addEventListener('click', downloadReceipt);
  attestationInputs.forEach(function (input) {
    input.addEventListener('change', function () { if (qualification) qualification.setAttestations(attestations()); });
  });

  openPanel();
  const seconds = Number(params.get('lanDuration'));
  if (params.get('lanAutostart') === '1') pendingAutoStartDuration = Number.isFinite(seconds) ? seconds * 1000 : 1800000;
  samplePreflight();
  preflightTimer = setInterval(samplePreflight, 1000);
  window.addEventListener('pagehide', function () { clearInterval(preflightTimer); });
})();
