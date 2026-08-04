(function () {
  'use strict';

  var Core = window.AXMEvidenceChainRecoveryAdapterConformanceCore;
  var state = { source: null, candidate: null, plan: null, profile: null, probe: null };
  var sourceFile = document.getElementById('sourceFile');
  var candidateFile = document.getElementById('candidateFile');
  var planFile = document.getElementById('planFile');
  var profileFile = document.getElementById('profileFile');
  var fixtureAck = document.getElementById('fixtureAck');
  var authorityAck = document.getElementById('authorityAck');
  var prepareButton = document.getElementById('prepareButton');
  var downloadButton = document.getElementById('downloadButton');
  var status = document.getElementById('status');
  var summary = document.getElementById('bundleSummary');
  var preview = document.getElementById('probePreview');

  function message(text, tone) {
    status.textContent = text;
    status.dataset.tone = tone || '';
  }

  function resetProbe() {
    state.probe = null;
    preview.textContent = 'No conformance probe prepared.';
    downloadButton.disabled = true;
    updateGate();
  }

  function updateGate() {
    prepareButton.disabled = !(state.source !== null && state.candidate !== null && state.plan && state.profile && fixtureAck.checked && authorityAck.checked);
  }

  function describeBundle() {
    if (!state.plan || !state.profile) { summary.textContent = 'No bundle bound.'; return; }
    summary.textContent = 'Plan ' + String(state.plan.planId || '').slice(0, 12) + '... - profile ' + String(state.profile.id || 'unknown');
  }

  function readFile(file, maxBytes, label) {
    if (!file) return Promise.reject(new Error(label + ' file is required'));
    if (file.size > maxBytes) return Promise.reject(new Error(label + ' exceeds the ' + Math.floor(maxBytes / 1024) + ' KiB limit'));
    return file.text();
  }

  function bindFiles() {
    message('Reading and binding the selected files...', '');
    Promise.all([
      readFile(sourceFile.files[0], 2 * 1024 * 1024, 'Source'),
      readFile(candidateFile.files[0], 2 * 1024 * 1024, 'Candidate'),
      readFile(planFile.files[0], 2 * 1024 * 1024, 'Application plan'),
      readFile(profileFile.files[0], 128 * 1024, 'Adapter fixture profile')
    ]).then(function (values) {
      state.source = values[0];
      state.candidate = values[1];
      state.plan = JSON.parse(values[2]);
      state.profile = Core.parseProfile(values[3]);
      fixtureAck.checked = false;
      authorityAck.checked = false;
      resetProbe();
      describeBundle();
      message('Bundle bound. Confirm both truth boundaries to prepare a probe.', 'ready');
    }).catch(function (error) {
      state = { source: null, candidate: null, plan: null, profile: null, probe: null };
      describeBundle(); resetProbe(); message(error.message, 'error');
    });
  }

  function loadExample() {
    message('Building a fresh synthetic reviewed-recovery bundle...', '');
    Core.example({ generatedAt: new Date().toISOString() }).then(function (packet) {
      state.source = packet.source;
      state.candidate = packet.candidate;
      state.plan = packet.plan;
      state.profile = packet.profile;
      state.probe = null;
      fixtureAck.checked = false;
      authorityAck.checked = false;
      preview.textContent = 'No conformance probe prepared.';
      downloadButton.disabled = true;
      describeBundle(); updateGate();
      message('Synthetic bundle ready. Confirm both truth boundaries to continue.', 'ready');
    }).catch(function (error) { message(error.message, 'error'); });
  }

  function prepareProbe() {
    resetProbe();
    message('Revalidating every digest and preparing the fixture-only probe...', '');
    Core.prepare(state.source, state.candidate, state.plan, state.profile, {
      confirmPlanId: state.plan.planId,
      acknowledgeFixtureOnly: fixtureAck.checked,
      acknowledgeNoAuthority: authorityAck.checked,
      now: new Date().toISOString()
    }).then(function (probe) {
      state.probe = probe;
      preview.textContent = JSON.stringify(probe, null, 2);
      downloadButton.disabled = false;
      message('Probe ready. A trusted Node host may run it against an already-loaded fixture adapter.', 'ready');
    }).catch(function (error) { message(error.message, 'error'); });
  }

  function downloadProbe() {
    if (!state.probe) return;
    var blob = new Blob([JSON.stringify(state.probe, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = Core.downloadName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function clear() {
    state = { source: null, candidate: null, plan: null, profile: null, probe: null };
    [sourceFile, candidateFile, planFile, profileFile].forEach(function (input) { input.value = ''; });
    fixtureAck.checked = false;
    authorityAck.checked = false;
    describeBundle(); resetProbe(); message('Lab cleared.', '');
  }

  document.getElementById('bindButton').addEventListener('click', bindFiles);
  document.getElementById('exampleButton').addEventListener('click', loadExample);
  document.getElementById('clearButton').addEventListener('click', clear);
  prepareButton.addEventListener('click', prepareProbe);
  downloadButton.addEventListener('click', downloadProbe);
  [fixtureAck, authorityAck].forEach(function (control) { control.addEventListener('change', function () { resetProbe(); }); });
  [sourceFile, candidateFile, planFile, profileFile].forEach(function (input) { input.addEventListener('change', resetProbe); });

  if (!Core) message('Conformance core failed to load.', 'error');
  else loadExample();
})();
