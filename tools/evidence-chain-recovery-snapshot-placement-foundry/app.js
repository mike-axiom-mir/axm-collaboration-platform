(function () {
  'use strict';

  var Core = window.AXMEvidenceChainRecoverySnapshotPlacementCore;
  var state = { receiptText: null, manifestText: null, candidateText: null, receipt: null, request: null };
  var receiptFile = document.getElementById('stagingReceiptFile');
  var manifestFile = document.getElementById('manifestFile');
  var candidateFile = document.getElementById('candidateFile');
  var outputBinding = document.getElementById('outputBinding');
  var confirmSnapshot = document.getElementById('confirmSnapshot');
  var outputAck = document.getElementById('outputAck');
  var privateAck = document.getElementById('privateAck');
  var retainAck = document.getElementById('retainAck');
  var authorityAck = document.getElementById('authorityAck');
  var prepareButton = document.getElementById('prepareButton');
  var downloadButton = document.getElementById('downloadButton');
  var status = document.getElementById('status');
  var summary = document.getElementById('packageSummary');
  var preview = document.getElementById('requestPreview');

  function message(text, tone) { status.textContent = text; status.dataset.tone = tone || ''; }
  function resetRequest() { state.request = null; preview.textContent = 'No placement request prepared.'; downloadButton.disabled = true; updateGate(); }
  function updateGate() {
    prepareButton.disabled = !(state.receiptText && state.manifestText && state.candidateText !== null && state.receipt && outputBinding.value.trim() && confirmSnapshot.value.trim() && outputAck.checked && privateAck.checked && retainAck.checked && authorityAck.checked);
  }
  function read(file, label, limit) {
    if (!file) return Promise.reject(new Error(label + ' file is required'));
    if (file.size > limit) return Promise.reject(new Error(label + ' exceeds its size limit'));
    return file.text();
  }
  function bindInputs() {
    message('Reading and binding the exact staged files...', '');
    Promise.all([
      read(receiptFile.files[0], 'Staging receipt', 2 * 1024 * 1024),
      read(manifestFile.files[0], 'Package manifest', 4 * 1024 * 1024),
      read(candidateFile.files[0], 'Candidate', 16 * 1024 * 1024)
    ]).then(function (values) {
      state.receiptText = values[0];
      state.manifestText = values[1];
      state.candidateText = values[2];
      state.receipt = Core.parseStagingReceipt(values[0]);
      state.request = null;
      confirmSnapshot.value = state.receipt.snapshotId;
      [outputAck, privateAck, retainAck, authorityAck].forEach(function (box) { box.checked = false; });
      summary.textContent = 'Snapshot ' + state.receipt.snapshotId + ' - ' + state.receipt.candidateEvents + ' reviewed event(s)';
      resetRequest();
      message('Staged evidence bound. Confirm the private destination and all four boundaries.', 'ready');
    }).catch(function (error) {
      state = { receiptText: null, manifestText: null, candidateText: null, receipt: null, request: null };
      summary.textContent = 'No staging package bound.'; resetRequest(); message(error.message, 'error');
    });
  }
  function prepare() {
    resetRequest();
    message('Rehashing the staged ledger and preparing placement...', '');
    Core.prepare(state.receiptText, state.manifestText, state.candidateText, outputBinding.value, {
      confirmSnapshotId: confirmSnapshot.value,
      acknowledgePackagerOutputPlacement: outputAck.checked,
      acknowledgePrivateLocalData: privateAck.checked,
      acknowledgeRetainedStaging: retainAck.checked,
      acknowledgeNoRestoreAuthority: authorityAck.checked,
      now: new Date().toISOString()
    }).then(function (request) {
      state.request = request;
      preview.textContent = JSON.stringify(request, null, 2);
      downloadButton.disabled = false;
      message('Placement request ready. The Node CLI must independently re-read the physical staging root.', 'ready');
    }).catch(function (error) { message(error.message, 'error'); });
  }
  function download() {
    if (!state.request) return;
    var blob = new Blob([JSON.stringify(state.request, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url; anchor.download = Core.downloadName(); document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }
  function clear() {
    state = { receiptText: null, manifestText: null, candidateText: null, receipt: null, request: null };
    [receiptFile, manifestFile, candidateFile].forEach(function (input) { input.value = ''; });
    [outputAck, privateAck, retainAck, authorityAck].forEach(function (box) { box.checked = false; });
    outputBinding.value = ''; confirmSnapshot.value = ''; summary.textContent = 'No staging package bound.'; resetRequest(); message('Foundry cleared.', '');
  }

  document.getElementById('bindButton').addEventListener('click', bindInputs);
  document.getElementById('clearButton').addEventListener('click', clear);
  prepareButton.addEventListener('click', prepare);
  downloadButton.addEventListener('click', download);
  [outputAck, privateAck, retainAck, authorityAck].forEach(function (box) { box.addEventListener('change', resetRequest); });
  [receiptFile, manifestFile, candidateFile, outputBinding, confirmSnapshot].forEach(function (input) { input.addEventListener('change', resetRequest); input.addEventListener('input', resetRequest); });
  if (!Core) message('Placement core failed to load.', 'error');
})();
