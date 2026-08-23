(function () {
  'use strict';

  var O = AXMOps;
  var notice = document.getElementById('notice');
  var started = Date.now();
  var latestPhoneEvidenceId = null;
  var observationFields = [
    ['physicalPhonePresent', 'phonePresent'],
    ['controllerJoined', 'controllerJoined'],
    ['seatIdentityMatched', 'seatMatched'],
    ['actionObservedOnSharedScreen', 'actionObserved'],
    ['disconnectObserved', 'disconnectObserved'],
    ['recoveredAfterDisconnect', 'recoveredObserved']
  ];

  function load() {
    O.get('/api/qa-lab').then(function (state) {
      var latestPhone = state.deviceEvidence.find(function (item) { return item.phoneObservation; }) || null;
      var handoff = state.latestPhoneReviewHandoff || null;
      latestPhoneEvidenceId = latestPhone ? latestPhone.id : null;
      document.getElementById('openPhoneReview').disabled = !latestPhoneEvidenceId;
      document.getElementById('reviewInbox').hidden = !(handoff && handoff.reviewItem);
      document.getElementById('facts').innerHTML =
        '<span>' + state.profiles.length + ' profiles</span>' +
        '<span>' + state.journeys.length + ' journeys</span>' +
        '<span>' + state.deviceEvidence.length + ' device receipts</span>' +
        '<span>arbitrary URL ' + state.arbitraryUrlTesting + '</span>';
      document.getElementById('out').textContent = O.pretty({
        latestJourney: state.latestJourney,
        latestDeviceEvidence: state.latestDeviceEvidence,
        latestPhoneObservationCandidate: latestPhone && {
          id: latestPhone.id,
          digest: latestPhone.digest,
          gameId: latestPhone.phoneObservation.gameId,
          complete: latestPhone.phoneObservation.complete,
          reviewState: latestPhone.phoneObservation.reviewState
        },
        latestPhoneReviewHandoff: handoff
      });
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  }

  function collectDeviceFacts() {
    var samples = [];
    var sequence = Promise.resolve();
    for (var index = 0; index < 3; index += 1) {
      sequence = sequence.then(function () {
        var tick = performance.now();
        return fetch('/api/health', { cache: 'no-store' }).then(function () {
          samples.push(Math.round((performance.now() - tick) * 10) / 10);
        });
      });
    }
    return sequence.then(function () {
      var pads = navigator.getGamepads
        ? Array.from(navigator.getGamepads()).filter(Boolean).map(function (gamepad) {
          return {
            index: gamepad.index,
            id: gamepad.id,
            mapping: gamepad.mapping,
            axes: gamepad.axes.length,
            buttons: gamepad.buttons.length
          };
        })
        : [];
      return {
        viewport: { width: innerWidth, height: innerHeight, devicePixelRatio: devicePixelRatio },
        userAgent: navigator.userAgent,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        highContrast: matchMedia('(prefers-contrast: more)').matches,
        gamepads: pads,
        latencyMs: samples,
        sessionDurationMs: Date.now() - started,
        errors: []
      };
    });
  }

  function readPhoneObservation() {
    var gameId = String(document.getElementById('phoneGame').value || '').trim().toLowerCase();
    if (!/^\d{3}-[a-z0-9][a-z0-9-]{0,95}$/.test(gameId)) throw new Error('Enter a bounded campaign game id such as 002-robo-pong.');
    if (!document.getElementById('phoneVoluntary').checked) throw new Error('Confirm that this observation is voluntary before saving a candidate.');
    var observations = {};
    observationFields.forEach(function (binding) {
      observations[binding[0]] = document.getElementById(binding[1]).checked === true;
    });
    return {
      gameId: gameId,
      slot: gameId.slice(0, 3),
      voluntaryHumanObservation: true,
      observations: observations
    };
  }

  function capture(phoneObservation) {
    return collectDeviceFacts().then(function (data) {
      if (phoneObservation) data.phoneObservation = phoneObservation;
      return O.post('/api/qa-lab/evidence', data, { 'x-axm-qa': 'device-evidence' });
    }).then(function (receipt) {
      var phone = receipt.phoneObservation;
      O.notice(
        notice,
        phone
          ? (phone.complete ? 'Phone observation candidate captured for separate review.' : 'Incomplete phone candidate saved; retry or stop is allowed.')
          : 'Device evidence captured.',
        phone && !phone.complete ? 'warn' : 'ok'
      );
      load();
      return receipt;
    });
  }

  document.getElementById('run').onclick = function () {
    O.post('/api/qa-lab/run', { profile: document.getElementById('profile').value }, { 'x-axm-qa': 'explicit-run' })
      .then(function (result) {
        O.notice(notice, result.pass ? 'Journey passed.' : 'Journey recorded failures.', result.pass ? 'ok' : 'warn');
        load();
      })
      .catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  document.getElementById('capture').onclick = function () {
    return capture(null).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  document.getElementById('capturePhone').onclick = function () {
    try {
      var observation = readPhoneObservation();
      return capture(observation).catch(function (error) { O.notice(notice, error.message, 'bad'); });
    } catch (error) {
      O.notice(notice, error.message, 'bad');
      return Promise.resolve();
    }
  };

  document.getElementById('openPhoneReview').onclick = function () {
    if (!latestPhoneEvidenceId) {
      O.notice(notice, 'Capture a phone observation candidate before opening review.', 'bad');
      return Promise.resolve();
    }
    return O.post('/api/qa-lab/phone-review/open', {
      evidenceId: latestPhoneEvidenceId,
      confirmation: 'OPEN EXACT PHONE CANDIDATE REVIEW'
    }, { 'x-axm-qa': 'explicit-phone-review-open' }).then(function (handoff) {
      O.notice(notice, 'Exact candidate sent to the Review Inbox. No warning was cleared.', 'ok');
      document.getElementById('reviewInbox').hidden = false;
      load();
      return handoff;
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };

  document.getElementById('refresh').onclick = load;
  load();
})();
