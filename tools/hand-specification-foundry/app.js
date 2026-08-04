(function () {
  'use strict';

  var Core = window.AXMHandSpecificationCore;
  var gapReportInput = document.getElementById('gapReportInput');
  var candidateSelect = document.getElementById('candidateSelect');
  var loadReportButton = document.getElementById('loadReportButton');
  var exampleButton = document.getElementById('exampleButton');
  var buildButton = document.getElementById('buildButton');
  var downloadButton = document.getElementById('downloadButton');
  var clearButton = document.getElementById('clearButton');
  var status = document.getElementById('status');
  var validationList = document.getElementById('validationList');
  var preview = document.getElementById('specPreview');
  var currentReport = null;
  var currentSpecification = null;

  var fields = {
    capabilityId: document.getElementById('capabilityId'),
    gapType: document.getElementById('gapType'),
    sourceRequirementIds: document.getElementById('sourceRequirementIds'),
    purpose: document.getElementById('purpose'),
    inputsAndSchemas: document.getElementById('inputsAndSchemas'),
    outputsAndSchemas: document.getElementById('outputsAndSchemas'),
    sideEffects: document.getElementById('sideEffects'),
    permissionsAndConsent: document.getElementById('permissionsAndConsent'),
    resourceBudget: document.getElementById('resourceBudget'),
    failureAndRecovery: document.getElementById('failureAndRecovery'),
    compatibilityVersionContract: document.getElementById('compatibilityVersionContract'),
    verificationContract: document.getElementById('verificationContract'),
    promotionGate: document.getElementById('promotionGate')
  };

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function setLines(field, value) {
    fields[field].value = Array.isArray(value) ? value.join('\n') : String(value || '');
  }

  function fillForm(draft) {
    Object.keys(fields).forEach(function (field) {
      if (['sourceRequirementIds', 'inputsAndSchemas', 'outputsAndSchemas', 'sideEffects', 'permissionsAndConsent'].includes(field)) {
        setLines(field, draft[field]);
      } else {
        fields[field].value = String(draft[field] || '');
      }
    });
    currentSpecification = null;
    downloadButton.disabled = true;
    preview.textContent = 'Build the draft to preview its portable JSON specification.';
  }

  function readForm() {
    var draft = {};
    Object.keys(fields).forEach(function (field) { draft[field] = fields[field].value; });
    return draft;
  }

  function renderValidation(result) {
    while (validationList.firstChild) validationList.removeChild(validationList.firstChild);
    var rows = result.pass
      ? ['All nine hand-specification fields are explicit.', 'Truth flags preserve DRAFT status and deny automatic authority.']
      : result.errors;
    rows.forEach(function (message) {
      var item = document.createElement('li');
      item.textContent = message;
      item.dataset.tone = result.pass ? 'ready' : 'error';
      validationList.appendChild(item);
    });
  }

  function populateCandidates(report) {
    var candidates = Core.listCandidates(report);
    while (candidateSelect.firstChild) candidateSelect.removeChild(candidateSelect.firstChild);
    candidates.forEach(function (candidate) {
      var option = document.createElement('option');
      option.value = candidate.capabilityId;
      option.textContent = candidate.capabilityId + ' · ' + candidate.gapType;
      candidateSelect.appendChild(option);
    });
    candidateSelect.disabled = candidates.length === 0;
    if (!candidates.length) throw new Error('gap report contains no proposed contracts to specify');
    applyCandidate(candidates[0].capabilityId);
    return candidates.length;
  }

  function applyCandidate(capabilityId) {
    if (!currentReport) return;
    fillForm(Core.seedFromGapReport(currentReport, capabilityId));
    setStatus('Loaded ' + capabilityId + '. Complete every boundary before building the draft.', 'neutral');
  }

  function loadReport() {
    try {
      currentReport = Core.parseGapReport(gapReportInput.value);
      var count = populateCandidates(currentReport);
      setStatus('Loaded ' + count + ' missing-capability candidate' + (count === 1 ? '' : 's') + '.', 'ready');
    } catch (error) {
      currentReport = null;
      currentSpecification = null;
      downloadButton.disabled = true;
      setStatus(error.message, 'error');
    }
  }

  function buildSpecification() {
    var draft = readForm();
    var checked = Core.validateDraft(draft);
    renderValidation(checked);
    if (!checked.pass) {
      currentSpecification = null;
      downloadButton.disabled = true;
      setStatus('Draft is incomplete: ' + checked.errors.length + ' boundary issue' + (checked.errors.length === 1 ? '' : 's') + '.', 'error');
      return;
    }
    currentSpecification = Core.buildSpecification(draft);
    var specCheck = Core.validateSpecification(currentSpecification);
    renderValidation(specCheck);
    preview.textContent = JSON.stringify(currentSpecification, null, 2);
    downloadButton.disabled = false;
    setStatus('Portable DRAFT specification built. No hand was installed or authorized.', 'ready');
  }

  function loadExample() {
    var sample = Core.example();
    gapReportInput.value = JSON.stringify(sample.report, null, 2);
    currentReport = Core.parseGapReport(sample.report);
    populateCandidates(currentReport);
    fillForm(sample.draft);
    buildSpecification();
  }

  function downloadSpecification() {
    if (!currentSpecification) return;
    var blob = new Blob([JSON.stringify(currentSpecification, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = Core.downloadName(currentSpecification);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('Draft specification download prepared by explicit request.', 'ready');
  }

  function clearAll() {
    gapReportInput.value = '';
    currentReport = null;
    currentSpecification = null;
    while (candidateSelect.firstChild) candidateSelect.removeChild(candidateSelect.firstChild);
    candidateSelect.disabled = true;
    Object.keys(fields).forEach(function (field) { fields[field].value = ''; });
    while (validationList.firstChild) validationList.removeChild(validationList.firstChild);
    preview.textContent = 'No specification has been built.';
    downloadButton.disabled = true;
    setStatus('Foundry cleared. Nothing was persisted.', 'neutral');
    gapReportInput.focus();
  }

  loadReportButton.addEventListener('click', loadReport);
  exampleButton.addEventListener('click', loadExample);
  buildButton.addEventListener('click', buildSpecification);
  downloadButton.addEventListener('click', downloadSpecification);
  clearButton.addEventListener('click', clearAll);
  candidateSelect.addEventListener('change', function () { applyCandidate(candidateSelect.value); });
  loadExample();
})();
