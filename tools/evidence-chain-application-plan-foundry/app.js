(function () {
  'use strict';

  var Plan = window.AXMEvidenceChainApplicationPlanCore;
  var Inspector = window.AXMEvidenceChainCore;
  var sourceFile = document.getElementById('sourceFile');
  var candidateFile = document.getElementById('candidateFile');
  var assessmentFile = document.getElementById('assessmentFile');
  var decisionFile = document.getElementById('decisionFile');
  var posture = document.getElementById('posture');
  var digestAck = document.getElementById('digestAck');
  var backupAck = document.getElementById('backupAck');
  var permissionAck = document.getElementById('permissionAck');
  var authorityAck = document.getElementById('authorityAck');
  var bindButton = document.getElementById('bindButton');
  var exampleButton = document.getElementById('exampleButton');
  var clearButton = document.getElementById('clearButton');
  var buildButton = document.getElementById('buildButton');
  var downloadButton = document.getElementById('downloadButton');
  var bundleSummary = document.getElementById('bundleSummary');
  var status = document.getElementById('status');
  var planPreview = document.getElementById('planPreview');
  var bundle = null;
  var currentPlan = null;

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function resetPlan() {
    currentPlan = null;
    downloadButton.disabled = true;
    planPreview.textContent = 'No plan produced.';
  }

  function setBundle(next, summary) {
    bundle = next;
    resetPlan();
    buildButton.disabled = false;
    bundleSummary.textContent = summary;
    setStatus('Accepted review bundle is held in memory. Choose a posture and acknowledge every planning gate.', 'ready');
  }

  async function bindSelected() {
    var files = [sourceFile.files && sourceFile.files[0], candidateFile.files && candidateFile.files[0], assessmentFile.files && assessmentFile.files[0], decisionFile.files && decisionFile.files[0]];
    if (files.some(function (file) { return !file; })) {
      setStatus('Select all four artifacts before binding.', 'error');
      return;
    }
    if (files[0].size > Inspector.MAX_BYTES || files[1].size > Inspector.MAX_BYTES) {
      setStatus('A JSONL input exceeds the 10 MiB limit.', 'error');
      return;
    }
    if (files[2].size > 2 * 1024 * 1024 || files[3].size > 2 * 1024 * 1024) {
      setStatus('A receipt exceeds the 2 MiB limit.', 'error');
      return;
    }
    try {
      var next = {
        source: await files[0].text(),
        candidate: await files[1].text(),
        assessment: JSON.parse(await files[2].text()),
        decision: JSON.parse(await files[3].text())
      };
      Plan.parseAssessment(next.assessment);
      Plan.parseDecision(next.decision);
      setBundle(next, 'Exact accepted bundle bound · file names are not copied into the plan');
    } catch (error) {
      bundle = null;
      buildButton.disabled = true;
      resetPlan();
      bundleSummary.textContent = 'Bundle rejected.';
      setStatus(error.message, 'error');
    }
  }

  async function loadExample() {
    try {
      var sample = await Plan.example();
      sourceFile.value = '';
      candidateFile.value = '';
      assessmentFile.value = '';
      decisionFile.value = '';
      digestAck.checked = false;
      backupAck.checked = false;
      permissionAck.checked = false;
      authorityAck.checked = false;
      setBundle(sample, sample.assessment.source.sha256 + ' · synthetic accepted bundle · no private state');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function buildPlan() {
    if (!bundle) return;
    try {
      currentPlan = await Plan.build(bundle.source, bundle.candidate, bundle.assessment, bundle.decision, {
        posture: posture.value,
        acknowledgeCurrentDigestRecheck: digestAck.checked,
        acknowledgeSafetyCopyRequired: backupAck.checked,
        acknowledgeFreshPermissionRequired: permissionAck.checked,
        acknowledgeNoAuthority: authorityAck.checked
      });
      planPreview.textContent = JSON.stringify(currentPlan, null, 2);
      downloadButton.disabled = false;
      setStatus('Plan built for trusted operator review. No live target was read and nothing is ready to apply.', 'ready');
    } catch (error) {
      resetPlan();
      setStatus(error.message, 'error');
    }
  }

  function downloadPlan() {
    if (!currentPlan) return;
    var blob = new Blob([JSON.stringify(currentPlan, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = Plan.downloadName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('Plan receipt prepared by explicit request. No target state was changed.', 'ready');
  }

  function clearAll() {
    sourceFile.value = '';
    candidateFile.value = '';
    assessmentFile.value = '';
    decisionFile.value = '';
    posture.value = 'ISOLATED_REPLACEMENT_COPY';
    digestAck.checked = false;
    backupAck.checked = false;
    permissionAck.checked = false;
    authorityAck.checked = false;
    bundle = null;
    buildButton.disabled = true;
    bundleSummary.textContent = 'No bundle bound.';
    resetPlan();
    setStatus('Foundry cleared. Nothing was persisted or applied.', 'neutral');
    sourceFile.focus();
  }

  [posture, digestAck, backupAck, permissionAck, authorityAck].forEach(function (control) { control.addEventListener('change', resetPlan); });
  bindButton.addEventListener('click', bindSelected);
  exampleButton.addEventListener('click', loadExample);
  clearButton.addEventListener('click', clearAll);
  buildButton.addEventListener('click', buildPlan);
  downloadButton.addEventListener('click', downloadPlan);
  loadExample();
})();
