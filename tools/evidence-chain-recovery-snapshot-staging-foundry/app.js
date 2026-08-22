(function () {
  'use strict';

  var Core = window.AXMEvidenceChainRecoverySnapshotStagingCore;
  var state = { source: null, candidate: null, plan: null, conformance: null, integration: null, request: null };
  var sourceFile = document.getElementById('sourceFile');
  var candidateFile = document.getElementById('candidateFile');
  var planFile = document.getElementById('planFile');
  var conformanceFile = document.getElementById('conformanceFile');
  var integrationFile = document.getElementById('integrationFile');
  var targetRelative = document.getElementById('targetRelative');
  var pathAck = document.getElementById('pathAck');
  var retainAck = document.getElementById('retainAck');
  var placementAck = document.getElementById('placementAck');
  var authorityAck = document.getElementById('authorityAck');
  var prepareButton = document.getElementById('prepareButton');
  var downloadButton = document.getElementById('downloadButton');
  var status = document.getElementById('status');
  var summary = document.getElementById('bundleSummary');
  var preview = document.getElementById('requestPreview');

  function message(text, tone) { status.textContent = text; status.dataset.tone = tone || ''; }

  function resetRequest() {
    state.request = null;
    preview.textContent = 'No staging request prepared.';
    downloadButton.disabled = true;
    updateGate();
  }

  function updateGate() {
    prepareButton.disabled = !(state.source !== null && state.candidate !== null && state.plan && state.conformance && state.integration && targetRelative.value.trim() && pathAck.checked && retainAck.checked && placementAck.checked && authorityAck.checked);
  }

  function read(file, label) {
    if (!file) return Promise.reject(new Error(label + ' file is required'));
    if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error(label + ' exceeds the 2 MiB limit'));
    return file.text();
  }

  function bindInputs() {
    message('Reading and binding the five selected files...', '');
    Promise.all([
      read(sourceFile.files[0], 'Source'),
      read(candidateFile.files[0], 'Candidate'),
      read(planFile.files[0], 'Application plan'),
      read(conformanceFile.files[0], 'Conformance receipt'),
      read(integrationFile.files[0], 'Integration packet')
    ]).then(function (values) {
      state.source = values[0];
      state.candidate = values[1];
      state.plan = JSON.parse(values[2]);
      state.conformance = JSON.parse(values[3]);
      state.integration = Core.parseIntegrationPacket(values[4]);
      [pathAck, retainAck, placementAck, authorityAck].forEach(function (box) { box.checked = false; });
      summary.textContent = 'Plan ' + String(state.plan.planId || '').slice(0, 12) + '... - packet ' + String(state.integration.packetId || '').slice(0, 12) + '...';
      resetRequest();
      message('Inputs bound. Enter the confined target and accept all four boundaries.', 'ready');
    }).catch(function (error) {
      state = { source: null, candidate: null, plan: null, conformance: null, integration: null, request: null };
      summary.textContent = 'No bundle bound.'; resetRequest(); message(error.message, 'error');
    });
  }

  function prepare() {
    resetRequest();
    message('Recomputing lineage and preparing the private staging request...', '');
    Core.prepare(state.source, state.candidate, state.plan, state.conformance, state.integration, targetRelative.value, {
      confirmPacketId: state.integration.packetId,
      acknowledgePrivateTargetPath: pathAck.checked,
      acknowledgeRetainedStaging: retainAck.checked,
      acknowledgeNoLivePlacement: placementAck.checked,
      acknowledgeNoAuthority: authorityAck.checked,
      now: new Date().toISOString()
    }).then(function (request) {
      state.request = request;
      preview.textContent = JSON.stringify(request, null, 2);
      downloadButton.disabled = false;
      message('Private staging request ready. Use the Node CLI with one explicit new root.', 'ready');
    }).catch(function (error) { message(error.message, 'error'); });
  }

  function download() {
    if (!state.request) return;
    var blob = new Blob([JSON.stringify(state.request, null, 2) + '\n'], { type: 'application/json' });
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
    state = { source: null, candidate: null, plan: null, conformance: null, integration: null, request: null };
    [sourceFile, candidateFile, planFile, conformanceFile, integrationFile].forEach(function (input) { input.value = ''; });
    [pathAck, retainAck, placementAck, authorityAck].forEach(function (box) { box.checked = false; });
    targetRelative.value = '';
    summary.textContent = 'No bundle bound.'; resetRequest(); message('Foundry cleared.', '');
  }

  document.getElementById('bindButton').addEventListener('click', bindInputs);
  document.getElementById('clearButton').addEventListener('click', clear);
  prepareButton.addEventListener('click', prepare);
  downloadButton.addEventListener('click', download);
  [pathAck, retainAck, placementAck, authorityAck].forEach(function (box) { box.addEventListener('change', resetRequest); });
  [sourceFile, candidateFile, planFile, conformanceFile, integrationFile, targetRelative].forEach(function (input) { input.addEventListener('change', resetRequest); input.addEventListener('input', resetRequest); });

  if (!Core) message('Staging core failed to load.', 'error');
})();
