(function () {
  'use strict';

  var Drill = window.AXMEvidenceChainApplicationDrillCore;
  var Inspector = window.AXMEvidenceChainCore;
  var sourceFile = document.getElementById('sourceFile');
  var candidateFile = document.getElementById('candidateFile');
  var planFile = document.getElementById('planFile');
  var planAck = document.getElementById('planAck');
  var sandboxAck = document.getElementById('sandboxAck');
  var cleanupAck = document.getElementById('cleanupAck');
  var bindButton = document.getElementById('bindButton');
  var exampleButton = document.getElementById('exampleButton');
  var clearButton = document.getElementById('clearButton');
  var prepareButton = document.getElementById('prepareButton');
  var downloadButton = document.getElementById('downloadButton');
  var bundleSummary = document.getElementById('bundleSummary');
  var status = document.getElementById('status');
  var requestPreview = document.getElementById('requestPreview');
  var bundle = null;
  var request = null;

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function resetRequest() {
    request = null;
    downloadButton.disabled = true;
    requestPreview.textContent = 'No drill request prepared.';
  }

  function setBundle(next, summary) {
    bundle = next;
    resetRequest();
    prepareButton.disabled = false;
    bundleSummary.textContent = summary;
    setStatus('Plan inputs are held in memory. Confirm all three drill gates before preparing the request.', 'ready');
  }

  async function bindSelected() {
    var files = [sourceFile.files && sourceFile.files[0], candidateFile.files && candidateFile.files[0], planFile.files && planFile.files[0]];
    if (files.some(function (file) { return !file; })) {
      setStatus('Select source, candidate, and plan before binding.', 'error');
      return;
    }
    if (files[0].size > Inspector.MAX_BYTES || files[1].size > Inspector.MAX_BYTES) {
      setStatus('A JSONL input exceeds the 10 MiB limit.', 'error');
      return;
    }
    if (files[2].size > 2 * 1024 * 1024) {
      setStatus('The plan exceeds the 2 MiB limit.', 'error');
      return;
    }
    try {
      var next = {
        source: await files[0].text(),
        candidate: await files[1].text(),
        plan: JSON.parse(await files[2].text())
      };
      Drill.parsePlan(next.plan);
      setBundle(next, next.plan.planId + ' · exact plan bound · file names are not retained');
    } catch (error) {
      bundle = null;
      prepareButton.disabled = true;
      resetRequest();
      bundleSummary.textContent = 'Bundle rejected.';
      setStatus(error.message, 'error');
    }
  }

  async function loadExample() {
    try {
      var sample = await Drill.example();
      sourceFile.value = '';
      candidateFile.value = '';
      planFile.value = '';
      planAck.checked = false;
      sandboxAck.checked = false;
      cleanupAck.checked = false;
      setBundle(sample, sample.plan.planId + ' · fresh synthetic plan · no private state');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function prepareRequest() {
    if (!bundle) return;
    try {
      request = await Drill.prepare(bundle.source, bundle.candidate, bundle.plan, {
        confirmPlanId: planAck.checked ? bundle.plan.planId : '',
        acknowledgeSandboxOnly: sandboxAck.checked,
        acknowledgeEphemeralCleanup: cleanupAck.checked
      });
      requestPreview.textContent = JSON.stringify(request, null, 2);
      downloadButton.disabled = false;
      setStatus('Drill request prepared. Use the Node hand for real owned-sandbox filesystem evidence.', 'ready');
    } catch (error) {
      resetRequest();
      setStatus(error.message, 'error');
    }
  }

  function downloadRequest() {
    if (!request) return;
    var blob = new Blob([JSON.stringify(request, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = Drill.downloadName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('Request prepared by explicit download. No filesystem drill ran in the browser.', 'ready');
  }

  function clearAll() {
    sourceFile.value = '';
    candidateFile.value = '';
    planFile.value = '';
    planAck.checked = false;
    sandboxAck.checked = false;
    cleanupAck.checked = false;
    bundle = null;
    prepareButton.disabled = true;
    bundleSummary.textContent = 'No bundle bound.';
    resetRequest();
    setStatus('Runner cleared. Nothing was persisted or executed.', 'neutral');
    sourceFile.focus();
  }

  [planAck, sandboxAck, cleanupAck].forEach(function (control) { control.addEventListener('change', resetRequest); });
  bindButton.addEventListener('click', bindSelected);
  exampleButton.addEventListener('click', loadExample);
  clearButton.addEventListener('click', clearAll);
  prepareButton.addEventListener('click', prepareRequest);
  downloadButton.addEventListener('click', downloadRequest);
  loadExample();
})();
