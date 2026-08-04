(function () {
  'use strict';

  var Bridge = window.AXMHandForgeBridgeCore;
  var Foundry = window.AXMHandSpecificationCore;
  var Verification = window.AXMHandVerificationCore;
  var Zip = window.AXMZipStore;
  var specificationInput = document.getElementById('specificationInput');
  var planInput = document.getElementById('planInput');
  var sourceButton = document.getElementById('sourceButton');
  var exampleButton = document.getElementById('exampleButton');
  var buildButton = document.getElementById('buildButton');
  var reviewButton = document.getElementById('reviewButton');
  var receiptButton = document.getElementById('receiptButton');
  var zipButton = document.getElementById('zipButton');
  var clearButton = document.getElementById('clearButton');
  var status = document.getElementById('status');
  var sourceStatus = document.getElementById('sourceStatus');
  var fileList = document.getElementById('fileList');
  var filePreview = document.getElementById('filePreview');
  var receiptPreview = document.getElementById('receiptPreview');
  var currentResult = null;

  var configFields = {
    id: document.getElementById('draftId'),
    name: document.getElementById('draftName'),
    kind: document.getElementById('draftKind'),
    risk: document.getElementById('draftRisk'),
    capabilities: document.getElementById('capabilities')
  };

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function empty(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function resetResult() {
    currentResult = null;
    empty(fileList);
    filePreview.textContent = 'No package built.';
    receiptPreview.textContent = 'No bridge receipt built.';
    reviewButton.disabled = true;
    receiptButton.disabled = true;
    zipButton.disabled = true;
  }

  function parseSources() {
    var specification = Verification.parseSpecification(specificationInput.value);
    var plan;
    try {
      plan = JSON.parse(planInput.value);
    } catch (error) {
      throw new Error('verification plan JSON is invalid: ' + error.message);
    }
    var bound = Bridge.bindSources(specification, plan);
    return { specification: bound.specification, plan: bound.plan, fingerprint: bound.specificationFingerprint };
  }

  function fillConfig(config) {
    configFields.id.value = config.id;
    configFields.name.value = config.name;
    configFields.kind.value = config.kind;
    configFields.risk.value = config.risk;
    configFields.capabilities.value = config.capabilities.join('\n');
  }

  function readSources() {
    try {
      var sources = parseSources();
      fillConfig(Bridge.suggestConfig(sources.specification));
      resetResult();
      sourceStatus.textContent = sources.specification.capabilityId + ' · exact binding ' + sources.fingerprint;
      setStatus('Sources are exactly bound. Review the conservative route mapping before packaging.', 'ready');
      buildButton.disabled = false;
    } catch (error) {
      resetResult();
      sourceStatus.textContent = 'Source binding failed.';
      buildButton.disabled = true;
      setStatus(error.message, 'error');
    }
  }

  function config() {
    return {
      id: configFields.id.value,
      name: configFields.name.value,
      kind: configFields.kind.value,
      risk: configFields.risk.value,
      capabilities: configFields.capabilities.value,
      actor: { id: 'local-user', type: 'human' }
    };
  }

  function showFile(path) {
    if (!currentResult) return;
    filePreview.textContent = currentResult.package.files[path];
    Array.from(fileList.querySelectorAll('button')).forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.path === path ? 'true' : 'false');
    });
  }

  function renderFiles() {
    empty(fileList);
    var paths = Object.keys(currentResult.package.files).sort();
    paths.forEach(function (path) {
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.path = path;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = path;
      button.addEventListener('click', function () { showFile(path); });
      fileList.appendChild(button);
    });
    if (paths.length) showFile(paths[0]);
  }

  function buildPackage() {
    try {
      var sources = parseSources();
      currentResult = Bridge.build(sources.specification, sources.plan, config());
      renderFiles();
      receiptPreview.textContent = JSON.stringify(currentResult.receipt, null, 2);
      reviewButton.disabled = false;
      receiptButton.disabled = false;
      zipButton.disabled = false;
      var output = currentResult.receipt.output;
      setStatus('EXPERIMENTAL review package built · ' + output.fileCount + ' files · ' + output.forgePackageFingerprint.slice(0, 16) + '… · install remains NO.', 'ready');
    } catch (error) {
      resetResult();
      setStatus(error.message, 'error');
    }
  }

  function download(name, data, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function loadExample() {
    var sample = Foundry.example();
    var specification = Foundry.buildSpecification(sample.draft);
    var plan = Verification.buildPlan(specification);
    specificationInput.value = JSON.stringify(specification, null, 2);
    planInput.value = JSON.stringify(plan, null, 2);
    readSources();
  }

  function clearAll() {
    specificationInput.value = '';
    planInput.value = '';
    Object.keys(configFields).forEach(function (key) { configFields[key].value = ''; });
    configFields.kind.value = 'machine-capability';
    configFields.risk.value = 'MEDIUM';
    sourceStatus.textContent = 'No sources loaded.';
    resetResult();
    buildButton.disabled = true;
    setStatus('Bridge cleared. Nothing was persisted.', 'neutral');
    specificationInput.focus();
  }

  sourceButton.addEventListener('click', readSources);
  exampleButton.addEventListener('click', loadExample);
  buildButton.addEventListener('click', buildPackage);
  reviewButton.addEventListener('click', function () {
    if (!currentResult) return;
    download(Bridge.downloadNames(currentResult).review, JSON.stringify(currentResult, null, 2) + '\n', 'application/json');
    setStatus('Review JSON prepared by explicit request.', 'ready');
  });
  receiptButton.addEventListener('click', function () {
    if (!currentResult) return;
    download(Bridge.downloadNames(currentResult).receipt, JSON.stringify(currentResult.receipt, null, 2) + '\n', 'application/json');
    setStatus('Bridge receipt prepared by explicit request.', 'ready');
  });
  zipButton.addEventListener('click', function () {
    if (!currentResult) return;
    download(Bridge.downloadNames(currentResult).zip, Zip.blob(currentResult.package.files, currentResult.package.draft.id), 'application/zip');
    setStatus('EXPERIMENTAL review ZIP prepared by explicit request. It remains uninstalled.', 'ready');
  });
  clearButton.addEventListener('click', clearAll);
  loadExample();
})();
