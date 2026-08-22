(function () {
  'use strict';

  var Foundry = window.AXMEvidenceChainRecoveryCore;
  var sourceFile = document.getElementById('sourceFile');
  var receiptFile = document.getElementById('receiptFile');
  var bindButton = document.getElementById('bindButton');
  var exampleButton = document.getElementById('exampleButton');
  var buildButton = document.getElementById('buildButton');
  var acknowledgement = document.getElementById('acknowledgement');
  var candidateButton = document.getElementById('candidateButton');
  var receiptButton = document.getElementById('receiptButton');
  var clearButton = document.getElementById('clearButton');
  var status = document.getElementById('status');
  var sourceSummary = document.getElementById('sourceSummary');
  var receiptPreview = document.getElementById('receiptPreview');
  var currentSource = null;
  var currentInspection = null;
  var currentResult = null;

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function resetResult() {
    currentResult = null;
    candidateButton.disabled = true;
    receiptButton.disabled = true;
    receiptPreview.textContent = 'No recovery candidate built.';
  }

  async function bindSelected() {
    var segment = sourceFile.files && sourceFile.files[0];
    var receipt = receiptFile.files && receiptFile.files[0];
    if (!segment || !receipt) {
      setStatus('Select both the source JSONL and its inspection receipt.', 'error');
      return;
    }
    if (segment.size > window.AXMEvidenceChainCore.MAX_BYTES) {
      setStatus('Source segment exceeds the 10 MiB limit.', 'error');
      return;
    }
    if (receipt.size > 2 * 1024 * 1024) {
      setStatus('Inspection receipt exceeds the 2 MiB limit.', 'error');
      return;
    }
    try {
      currentSource = await segment.text();
      currentInspection = JSON.parse(await receipt.text());
      var eligible = await Foundry.eligibility(currentSource, currentInspection);
      resetResult();
      sourceSummary.textContent = eligible.currentInspection.source.sha256 + ' · ' + eligible.currentInspection.summary.parsedEvents + ' events · ' + eligible.currentInspection.summary.errors + ' correctable errors';
      buildButton.disabled = false;
      setStatus('Exact source and receipt are bound. Read and acknowledge the authenticity boundary before building.', 'ready');
    } catch (error) {
      currentSource = null;
      currentInspection = null;
      buildButton.disabled = true;
      resetResult();
      sourceSummary.textContent = 'Inputs are not eligible.';
      setStatus(error.message, 'error');
    }
  }

  async function loadExample() {
    try {
      var sample = await Foundry.example();
      currentSource = sample.source;
      currentInspection = sample.inspection;
      acknowledgement.checked = false;
      resetResult();
      sourceSummary.textContent = sample.inspection.source.sha256 + ' · synthetic broken chain · no private state';
      buildButton.disabled = false;
      setStatus('Synthetic broken example loaded. Acknowledgement remains deliberately unchecked.', 'ready');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function buildCandidate() {
    if (!currentSource || !currentInspection) return;
    try {
      currentResult = await Foundry.build(currentSource, currentInspection, {
        acknowledgeAuthenticityUnknown: acknowledgement.checked
      });
      receiptPreview.textContent = JSON.stringify(currentResult.receipt, null, 2);
      candidateButton.disabled = false;
      receiptButton.disabled = false;
      setStatus('Structural candidate built and independently re-inspected: PASS. It remains unapplied and authenticity remains unproven.', 'ready');
    } catch (error) {
      resetResult();
      setStatus(error.message, 'error');
    }
  }

  function download(name, data, type) {
    var blob = new Blob([data], { type: type });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    sourceFile.value = '';
    receiptFile.value = '';
    acknowledgement.checked = false;
    currentSource = null;
    currentInspection = null;
    sourceSummary.textContent = 'No inputs bound.';
    buildButton.disabled = true;
    resetResult();
    setStatus('Foundry cleared. Nothing was persisted or applied.', 'neutral');
    sourceFile.focus();
  }

  bindButton.addEventListener('click', bindSelected);
  exampleButton.addEventListener('click', loadExample);
  buildButton.addEventListener('click', buildCandidate);
  candidateButton.addEventListener('click', function () {
    if (!currentResult) return;
    download(Foundry.downloadNames(currentResult).candidate, currentResult.candidateJsonl, 'application/x-ndjson');
    setStatus('Candidate JSONL prepared by explicit request. No live state was changed.', 'ready');
  });
  receiptButton.addEventListener('click', function () {
    if (!currentResult) return;
    download(Foundry.downloadNames(currentResult).receipt, JSON.stringify(currentResult.receipt, null, 2) + '\n', 'application/json');
    setStatus('Digest-only recovery receipt prepared by explicit request.', 'ready');
  });
  clearButton.addEventListener('click', clearAll);
  loadExample();
})();
