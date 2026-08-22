(function () {
  'use strict';

  var O = AXMOps;
  var notice = document.getElementById('notice');
  var started = Date.now();
  var pendingGames = [];

  function setBusy(button, busy) {
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
  }

  function renderStatus(state) {
    document.getElementById('facts').innerHTML =
      '<span>' + state.profiles.length + ' profiles</span>' +
      '<span>' + state.journeys.length + ' journeys</span>' +
      '<span>' + state.deviceEvidence.length + ' device receipts</span>' +
      '<span>' + (state.phoneObservationCandidates || 0) + ' phone candidates</span>' +
      '<span>' + pendingGames.length + ' phone gaps</span>' +
      '<span>arbitrary URL ' + state.arbitraryUrlTesting + '</span>';
    document.getElementById('out').textContent = O.pretty({
      latestJourney: state.latestJourney,
      latestDeviceEvidence: state.latestDeviceEvidence,
      latestPhoneObservation: state.latestPhoneObservation || null
    });
  }

  function loadStatus() {
    return O.get('/api/qa-lab').then(renderStatus).catch(function (error) {
      O.notice(notice, error.message, 'bad');
    });
  }

  function addGameOption(game) {
    var option = document.createElement('option');
    option.value = game.game;
    option.textContent = game.slot + ' · ' + game.game;
    document.getElementById('game').appendChild(option);
  }

  function loadPendingGames() {
    return fetch('/exports/game-night-seam-report.json', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('pending-game report returned ' + response.status);
      return response.json();
    }).then(function (report) {
      pendingGames = (Array.isArray(report.games) ? report.games : []).filter(function (game) {
        return Array.isArray(game.warnings) && game.warnings.includes('physical phone qa is pending');
      }).map(function (game) {
        return { game: String(game.game || ''), slot: String(game.slot || '') };
      }).filter(function (game) {
        return /^\d{3}-[a-z0-9][a-z0-9-]{0,95}$/.test(game.game) && /^\d{3}$/.test(game.slot);
      });
      pendingGames.forEach(addGameOption);
      document.getElementById('queue').textContent = pendingGames.length + ' verifier-confirmed phone gap(s). Capture preserves a candidate for external review; it does not close the gap.';
      return loadStatus();
    }).catch(function (error) {
      document.getElementById('queue').textContent = 'Pending-game queue unavailable. Run the Workshop verifier, then refresh this page. ' + error.message;
      O.notice(notice, 'Pending phone queue is unavailable.', 'warn');
    });
  }

  function browserGamepads() {
    return navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean).map(function (gamepad) {
      return { index: gamepad.index, id: gamepad.id, mapping: gamepad.mapping, axes: gamepad.axes.length, buttons: gamepad.buttons.length };
    }) : [];
  }

  async function captureDevice(phoneObservation) {
    var samples = [];
    for (var i = 0; i < 3; i += 1) {
      var tick = performance.now();
      var response = await fetch('/api/health', { cache: 'no-store' });
      if (!response.ok) throw new Error('loopback health sample returned ' + response.status);
      samples.push(Math.round((performance.now() - tick) * 10) / 10);
    }
    var data = {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio: devicePixelRatio },
      userAgent: navigator.userAgent,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      highContrast: matchMedia('(prefers-contrast: more)').matches,
      gamepads: browserGamepads(),
      latencyMs: samples,
      sessionDurationMs: Date.now() - started,
      disconnectObserved: !!(phoneObservation && phoneObservation.disconnectObserved),
      recoveredAfterDisconnect: !!(phoneObservation && phoneObservation.recoveredAfterDisconnect),
      errors: [],
      phoneObservation: phoneObservation || null
    };
    return O.post('/api/qa-lab/evidence', data, { 'x-axm-qa': 'device-evidence' });
  }

  document.getElementById('run').onclick = function () {
    var button = this;
    setBusy(button, true);
    O.post('/api/qa-lab/run', { profile: document.getElementById('profile').value }, { 'x-axm-qa': 'explicit-run' }).then(function (receipt) {
      O.notice(notice, receipt.pass ? 'Journey passed.' : 'Journey recorded failures.', receipt.pass ? 'ok' : 'warn');
      return loadStatus();
    }).catch(function (error) {
      O.notice(notice, error.message, 'bad');
    }).finally(function () {
      setBusy(button, false);
    });
  };

  document.getElementById('capture').onclick = async function () {
    var button = this;
    setBusy(button, true);
    try {
      await captureDevice(null);
      O.notice(notice, 'Device evidence captured.', 'ok');
      await loadStatus();
    } catch (error) {
      O.notice(notice, error.message, 'bad');
    } finally {
      setBusy(button, false);
    }
  };

  document.getElementById('capture-phone').onclick = async function () {
    var gameId = document.getElementById('game').value;
    if (!gameId) {
      O.notice(notice, 'Choose a pending game before capturing a phone observation.', 'warn');
      return;
    }
    var button = this;
    var observation = {
      gameId: gameId,
      slot: gameId.slice(0, 3),
      physicalPhonePresent: document.getElementById('phone-present').checked,
      controllerJoined: document.getElementById('controller-joined').checked,
      seatIdentityMatched: document.getElementById('seat-matched').checked,
      actionObservedOnSharedScreen: document.getElementById('action-observed').checked,
      disconnectObserved: document.getElementById('disconnect-observed').checked,
      recoveredAfterDisconnect: document.getElementById('recovery-observed').checked,
      notes: document.getElementById('observation-notes').value
    };
    setBusy(button, true);
    try {
      await captureDevice(observation);
      O.notice(notice, 'Candidate phone observation captured. External review is still required.', 'ok');
      await loadStatus();
    } catch (error) {
      O.notice(notice, error.message, 'bad');
    } finally {
      setBusy(button, false);
    }
  };

  document.getElementById('refresh').onclick = loadStatus;
  loadStatus();
  loadPendingGames();
}());
