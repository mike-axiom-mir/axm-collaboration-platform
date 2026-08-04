(function () {
  'use strict';

  var Core = window.AXMEvidenceChainRecoveryAdapterIntegrationCore;
  var state = { artifact: null, plan: null, receipt: null, manifest: null, contract: null, packet: null };
  var artifactFile = document.getElementById('artifactFile');
  var planFile = document.getElementById('planFile');
  var receiptFile = document.getElementById('receiptFile');
  var dataAck = document.getElementById('dataAck');
  var authorityAck = document.getElementById('authorityAck');
  var identityAck = document.getElementById('identityAck');
  var rollbackAck = document.getElementById('rollbackAck');
  var buildButton = document.getElementById('buildButton');
  var downloadButton = document.getElementById('downloadButton');
  var status = document.getElementById('status');
  var declarationStatus = document.getElementById('declarationStatus');
  var bundleSummary = document.getElementById('bundleSummary');
  var packetPreview = document.getElementById('packetPreview');

  function message(text, tone) {
    status.textContent = text;
    status.dataset.tone = tone || '';
  }

  function resetPacket() {
    state.packet = null;
    packetPreview.textContent = 'No integration acceptance packet built.';
    downloadButton.disabled = true;
    updateGate();
  }

  function updateGate() {
    buildButton.disabled = !(state.artifact !== null && state.plan && state.receipt && state.manifest && state.contract && dataAck.checked && authorityAck.checked && identityAck.checked && rollbackAck.checked);
  }

  function readText(file, maxBytes, label) {
    if (!file) return Promise.reject(new Error(label + ' file is required'));
    if (file.size > maxBytes) return Promise.reject(new Error(label + ' exceeds its size limit'));
    return file.text();
  }

  function loadRecoveryDeclarations() {
    declarationStatus.textContent = 'Loading served declarations...';
    Promise.all([
      fetch('../recovery-center/manifest.json', { cache: 'no-store' }).then(function (response) { if (!response.ok) throw new Error('Recovery Center manifest returned HTTP ' + response.status); return response.json(); }),
      fetch('../recovery-center/module.contract.json', { cache: 'no-store' }).then(function (response) { if (!response.ok) throw new Error('Recovery Center contract returned HTTP ' + response.status); return response.json(); })
    ]).then(function (values) {
      state.manifest = Core.parseRecoveryManifest(values[0]);
      state.contract = Core.parseRecoveryContract(values[1]);
      declarationStatus.textContent = 'TEST declarations loaded - exactly recovery.apply';
      updateGate();
    }).catch(function (error) {
      state.manifest = null; state.contract = null;
      declarationStatus.textContent = 'Declaration intake stopped';
      message(error.message, 'error'); updateGate();
    });
  }

  function bindInputs() {
    message('Reading inputs as inert text and validating the JSON evidence...', '');
    Promise.all([
      readText(artifactFile.files[0], Core.MAX_ARTIFACT_BYTES, 'Adapter source'),
      readText(planFile.files[0], 2 * 1024 * 1024, 'Application plan'),
      readText(receiptFile.files[0], 1024 * 1024, 'Conformance receipt')
    ]).then(function (values) {
      state.artifact = values[0];
      state.plan = JSON.parse(values[1]);
      state.receipt = Core.parseReceipt(values[2]);
      [dataAck, authorityAck, identityAck, rollbackAck].forEach(function (box) { box.checked = false; });
      bundleSummary.textContent = 'Plan ' + String(state.plan.planId || '').slice(0, 12) + '... - artifact ' + new TextEncoder().encode(state.artifact).length + ' bytes';
      resetPacket();
      message('Inputs bound. Accept all four production blockers to build the packet.', 'ready');
    }).catch(function (error) {
      state.artifact = null; state.plan = null; state.receipt = null;
      bundleSummary.textContent = 'No bundle bound.';
      resetPacket(); message(error.message, 'error');
    });
  }

  function buildPacket() {
    resetPacket();
    message('Recomputing every digest and building the blocked acceptance route...', '');
    Core.build(state.artifact, state.plan, state.receipt, state.manifest, state.contract, {
      acknowledgeArtifactIsData: dataAck.checked,
      acknowledgeNoAuthority: authorityAck.checked,
      acknowledgeIndependentIdentityTests: identityAck.checked,
      acknowledgeLiveRollbackRequired: rollbackAck.checked,
      generatedAt: new Date().toISOString()
    }).then(function (packet) {
      state.packet = packet;
      packetPreview.textContent = JSON.stringify(packet, null, 2);
      downloadButton.disabled = false;
      message('Acceptance packet ready with explicit implementation and live-evidence blockers.', 'ready');
    }).catch(function (error) { message(error.message, 'error'); });
  }

  function downloadPacket() {
    if (!state.packet) return;
    var blob = new Blob([JSON.stringify(state.packet, null, 2) + '\n'], { type: 'application/json' });
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
    state.artifact = null; state.plan = null; state.receipt = null; state.packet = null;
    [artifactFile, planFile, receiptFile].forEach(function (input) { input.value = ''; });
    [dataAck, authorityAck, identityAck, rollbackAck].forEach(function (box) { box.checked = false; });
    bundleSummary.textContent = 'No bundle bound.';
    resetPacket(); message('Foundry cleared. Recovery Center declarations remain loaded.', '');
  }

  document.getElementById('bindButton').addEventListener('click', bindInputs);
  document.getElementById('clearButton').addEventListener('click', clear);
  buildButton.addEventListener('click', buildPacket);
  downloadButton.addEventListener('click', downloadPacket);
  [dataAck, authorityAck, identityAck, rollbackAck].forEach(function (box) { box.addEventListener('change', resetPacket); });
  [artifactFile, planFile, receiptFile].forEach(function (input) { input.addEventListener('change', resetPacket); });

  if (!Core) message('Integration core failed to load.', 'error');
  else loadRecoveryDeclarations();
})();
