(function () {
  'use strict';

  var Gate = window.AXMEvidenceChainReviewCore;
  var Inspector = window.AXMEvidenceChainCore;
  var sourceFile = document.getElementById('sourceFile');
  var inspectionFile = document.getElementById('inspectionFile');
  var candidateFile = document.getElementById('candidateFile');
  var recoveryFile = document.getElementById('recoveryFile');
  var bindButton = document.getElementById('bindButton');
  var exampleButton = document.getElementById('exampleButton');
  var clearButton = document.getElementById('clearButton');
  var assessButton = document.getElementById('assessButton');
  var assessmentDownload = document.getElementById('assessmentDownload');
  var decisionChoice = document.getElementById('decisionChoice');
  var noAuthorityAck = document.getElementById('noAuthorityAck');
  var authenticityAck = document.getElementById('authenticityAck');
  var decisionButton = document.getElementById('decisionButton');
  var decisionDownload = document.getElementById('decisionDownload');
  var bundleSummary = document.getElementById('bundleSummary');
  var status = document.getElementById('status');
  var assessmentPreview = document.getElementById('assessmentPreview');
  var decisionPreview = document.getElementById('decisionPreview');
  var bundle = null;
  var assessment = null;
  var decision = null;

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function resetDecision() {
    decision = null;
    decisionDownload.disabled = true;
    decisionPreview.textContent = 'No decision recorded.';
  }

  function resetAssessment() {
    assessment = null;
    assessmentDownload.disabled = true;
    assessmentPreview.textContent = 'No assessment produced.';
    decisionButton.disabled = true;
    resetDecision();
  }

  function setBundle(next, summary) {
    bundle = next;
    resetAssessment();
    assessButton.disabled = false;
    bundleSummary.textContent = summary;
    setStatus('Four artifacts are held in memory. Run the independent assessment next.', 'ready');
  }

  async function bindSelected() {
    var files = [sourceFile.files && sourceFile.files[0], inspectionFile.files && inspectionFile.files[0], candidateFile.files && candidateFile.files[0], recoveryFile.files && recoveryFile.files[0]];
    if (files.some(function (file) { return !file; })) {
      setStatus('Select all four artifacts before binding.', 'error');
      return;
    }
    if (files[0].size > Inspector.MAX_BYTES || files[2].size > Inspector.MAX_BYTES) {
      setStatus('A JSONL input exceeds the 10 MiB limit.', 'error');
      return;
    }
    if (files[1].size > 2 * 1024 * 1024 || files[3].size > 2 * 1024 * 1024) {
      setStatus('A receipt exceeds the 2 MiB limit.', 'error');
      return;
    }
    try {
      var next = {
        source: await files[0].text(),
        inspection: JSON.parse(await files[1].text()),
        candidate: await files[2].text(),
        recovery: JSON.parse(await files[3].text())
      };
      Gate.parseInspectionReceipt(next.inspection);
      Gate.parseRecoveryReceipt(next.recovery);
      setBundle(next, 'Exact bundle bound · file names are not copied into receipts');
    } catch (error) {
      bundle = null;
      assessButton.disabled = true;
      resetAssessment();
      bundleSummary.textContent = 'Bundle rejected.';
      setStatus(error.message, 'error');
    }
  }

  async function loadExample() {
    try {
      var sample = await Gate.example();
      sourceFile.value = '';
      inspectionFile.value = '';
      candidateFile.value = '';
      recoveryFile.value = '';
      noAuthorityAck.checked = false;
      authenticityAck.checked = false;
      setBundle(sample, sample.inspection.source.sha256 + ' · synthetic bundle · no private state');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function assessBundle() {
    if (!bundle) return;
    try {
      assessment = await Gate.assess(bundle.source, bundle.inspection, bundle.candidate, bundle.recovery);
      assessmentPreview.textContent = JSON.stringify(assessment, null, 2);
      assessmentDownload.disabled = false;
      decisionButton.disabled = false;
      resetDecision();
      if (assessment.verdict === 'PASS') setStatus('Assessment PASS. You may record a fixed decision; application authority remains false.', 'ready');
      else setStatus('Assessment FAIL. Only Hold or Reject can be recorded.', 'error');
    } catch (error) {
      resetAssessment();
      setStatus(error.message, 'error');
    }
  }

  async function recordDecision() {
    if (!assessment) return;
    try {
      decision = await Gate.decide(assessment, decisionChoice.value, {
        acknowledgeNoAuthority: noAuthorityAck.checked,
        acknowledgeAuthenticityUnknown: authenticityAck.checked
      });
      decisionPreview.textContent = JSON.stringify(decision, null, 2);
      decisionDownload.disabled = false;
      setStatus('Fixed decision recorded in memory. Nothing was applied or persisted.', 'ready');
    } catch (error) {
      resetDecision();
      setStatus(error.message, 'error');
    }
  }

  function download(name, value) {
    var blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
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
    inspectionFile.value = '';
    candidateFile.value = '';
    recoveryFile.value = '';
    noAuthorityAck.checked = false;
    authenticityAck.checked = false;
    decisionChoice.value = 'HOLD_FOR_MORE_EVIDENCE';
    bundle = null;
    assessButton.disabled = true;
    bundleSummary.textContent = 'No bundle bound.';
    resetAssessment();
    setStatus('Review gate cleared. Nothing was persisted or applied.', 'neutral');
    sourceFile.focus();
  }

  bindButton.addEventListener('click', bindSelected);
  exampleButton.addEventListener('click', loadExample);
  clearButton.addEventListener('click', clearAll);
  assessButton.addEventListener('click', assessBundle);
  decisionButton.addEventListener('click', recordDecision);
  decisionChoice.addEventListener('change', resetDecision);
  noAuthorityAck.addEventListener('change', resetDecision);
  authenticityAck.addEventListener('change', resetDecision);
  assessmentDownload.addEventListener('click', function () { if (assessment) download(Gate.downloadNames().assessment, assessment); });
  decisionDownload.addEventListener('click', function () { if (decision) download(Gate.downloadNames().decision, decision); });
  loadExample();
})();
