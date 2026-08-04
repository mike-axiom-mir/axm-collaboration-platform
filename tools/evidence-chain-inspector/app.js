(function () {
  'use strict';

  var Core = window.AXMEvidenceChainCore;
  var pastedInput = document.getElementById('pastedInput');
  var fileInput = document.getElementById('fileInput');
  var pasteButton = document.getElementById('pasteButton');
  var fileButton = document.getElementById('fileButton');
  var exampleButton = document.getElementById('exampleButton');
  var downloadButton = document.getElementById('downloadButton');
  var clearButton = document.getElementById('clearButton');
  var status = document.getElementById('status');
  var verdict = document.getElementById('verdict');
  var metrics = document.getElementById('metrics');
  var findings = document.getElementById('findings');
  var receiptPreview = document.getElementById('receiptPreview');
  var currentReport = null;

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function empty(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function render(report) {
    currentReport = report;
    verdict.textContent = report.verdict + ' · ' + report.chainState;
    verdict.dataset.verdict = report.verdict;
    metrics.textContent = report.summary.parsedEvents + ' parsed · ' + report.summary.errors + ' errors · ' + report.summary.warnings + ' warnings · ' + report.source.bytes + ' bytes';
    empty(findings);
    if (!report.findings.length) {
      var clean = document.createElement('li');
      clean.textContent = 'No chain or metadata anomalies detected within the supplied segment.';
      clean.dataset.tone = 'ready';
      findings.appendChild(clean);
    } else {
      report.findings.forEach(function (entry) {
        var row = document.createElement('li');
        row.dataset.tone = entry.severity === 'ERROR' ? 'error' : 'warning';
        var title = document.createElement('strong');
        title.textContent = 'Line ' + entry.line + ' · ' + entry.code;
        var detail = document.createElement('span');
        detail.textContent = entry.detail;
        row.appendChild(title);
        row.appendChild(detail);
        findings.appendChild(row);
      });
    }
    receiptPreview.textContent = JSON.stringify(report, null, 2);
    downloadButton.disabled = false;
    setStatus('Inspection complete: ' + report.verdict + '. Payloads, sources, raw lines and full paths were not emitted.', report.verdict === 'FAIL' ? 'error' : 'ready');
  }

  async function inspectPasted() {
    try {
      render(await Core.inspect(pastedInput.value, { label: 'pasted-text' }));
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function inspectFile() {
    var file = fileInput.files && fileInput.files[0];
    if (!file) {
      setStatus('Select one JSONL segment first.', 'error');
      return;
    }
    if (file.size > Core.MAX_BYTES) {
      setStatus('Selected file exceeds the 10 MiB inspection limit.', 'error');
      return;
    }
    try {
      render(await Core.inspect(await file.text(), { label: 'browser-selected-file' }));
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function loadExample() {
    pastedInput.value = await Core.example();
    await inspectPasted();
  }

  function downloadReceipt() {
    if (!currentReport) return;
    var blob = new Blob([JSON.stringify(currentReport, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'axm-evidence-chain-inspection.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('Digest-only inspection receipt prepared by explicit request.', 'ready');
  }

  function clearAll() {
    pastedInput.value = '';
    fileInput.value = '';
    currentReport = null;
    verdict.textContent = 'NOT INSPECTED';
    verdict.dataset.verdict = 'UNKNOWN';
    metrics.textContent = 'No input inspected.';
    empty(findings);
    receiptPreview.textContent = 'No receipt built.';
    downloadButton.disabled = true;
    setStatus('Inspector cleared. Nothing was persisted.', 'neutral');
    pastedInput.focus();
  }

  pasteButton.addEventListener('click', inspectPasted);
  fileButton.addEventListener('click', inspectFile);
  exampleButton.addEventListener('click', loadExample);
  downloadButton.addEventListener('click', downloadReceipt);
  clearButton.addEventListener('click', clearAll);
  loadExample().catch(function (error) { setStatus(error.message, 'error'); });
})();
