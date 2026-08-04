(function () {
  'use strict';

  var Core = window.AXMCapabilityGapWorkbenchCore;
  var requirementsInput = document.getElementById('requirementsInput');
  var inventoryInput = document.getElementById('inventoryInput');
  var analyzeButton = document.getElementById('analyzeButton');
  var exampleButton = document.getElementById('exampleButton');
  var clearButton = document.getElementById('clearButton');
  var downloadButton = document.getElementById('downloadButton');
  var status = document.getElementById('status');
  var summary = document.getElementById('summary');
  var requirementResults = document.getElementById('requirementResults');
  var contractResults = document.getElementById('contractResults');
  var truthNote = document.getElementById('truthNote');
  var currentReport = null;

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function empty(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function statusClass(value) {
    return 'state state-' + String(value || 'UNKNOWN').toLowerCase().replace(/_/g, '-');
  }

  function appendMetric(label, value, tone) {
    var card = element('div', 'metric' + (tone ? ' metric-' + tone : ''));
    card.appendChild(element('span', 'metric-label', label));
    card.appendChild(element('strong', 'metric-value', value));
    summary.appendChild(card);
  }

  function appendCapabilityGroup(parent, label, values, tone) {
    if (!values || !values.length) return;
    var wrap = element('div', 'capability-group');
    wrap.appendChild(element('span', 'capability-group-label', label));
    var list = element('ul', 'chip-list chip-list-' + tone);
    values.forEach(function (value) {
      list.appendChild(element('li', 'chip', value));
    });
    wrap.appendChild(list);
    parent.appendChild(wrap);
  }

  function renderRequirement(row) {
    var article = element('article', 'result-card');
    var header = element('header', 'result-header');
    var titleWrap = element('div');
    titleWrap.appendChild(element('h3', null, row.id));
    titleWrap.appendChild(element('span', 'requirement-kind', row.required ? 'Required' : 'Optional'));
    header.appendChild(titleWrap);
    header.appendChild(element('span', statusClass(row.status), row.status));
    article.appendChild(header);
    appendCapabilityGroup(article, 'Available', row.available, 'ready');
    appendCapabilityGroup(article, 'Degraded', row.degraded, 'degraded');
    appendCapabilityGroup(article, 'Unknown', row.unknown, 'unknown');
    appendCapabilityGroup(article, 'Missing', row.missing, 'blocked');
    return article;
  }

  function renderContract(contract) {
    var article = element('article', 'contract-card');
    var header = element('header', 'contract-header');
    var titleWrap = element('div');
    titleWrap.appendChild(element('h3', null, contract.capabilityId));
    titleWrap.appendChild(element('span', 'gap-type', contract.gapType + ' gap'));
    header.appendChild(titleWrap);
    header.appendChild(element('span', 'state state-spec', contract.contractState));
    article.appendChild(header);
    appendCapabilityGroup(article, 'Required by', contract.requiredBy, 'unknown');
    appendCapabilityGroup(article, 'Contract fields still required', contract.requiredFields, 'degraded');
    return article;
  }

  function render(report) {
    empty(summary);
    empty(requirementResults);
    empty(contractResults);
    var tone = report.overall === 'READY' ? 'ready' : report.overall === 'BLOCKED' ? 'blocked' : report.overall.toLowerCase();
    appendMetric('Overall route', report.overall, tone);
    appendMetric('Requirements', report.requirements.length);
    appendMetric('Missing capabilities', report.missingCapabilities.length, report.missingCapabilities.length ? 'blocked' : 'ready');
    appendMetric('Contract drafts', report.proposedContracts.length);
    report.requirements.forEach(function (row) {
      requirementResults.appendChild(renderRequirement(row));
    });
    if (report.proposedContracts.length) {
      report.proposedContracts.forEach(function (contract) {
        contractResults.appendChild(renderContract(contract));
      });
    } else {
      contractResults.appendChild(element('p', 'empty-state', 'No missing-capability contract drafts are required by this comparison.'));
    }
    truthNote.textContent = 'Exact identifier comparison only. ' +
      'Automatic install: ' + (report.automaticInstall ? 'yes' : 'no') +
      ' · automatic permission: ' + (report.automaticPermission ? 'yes' : 'no') +
      ' · declarations treated as runtime proof: no.';
    downloadButton.disabled = false;
  }

  function analyze() {
    try {
      currentReport = Core.analyze(requirementsInput.value, inventoryInput.value);
      render(currentReport);
      setStatus('Comparison complete: ' + currentReport.overall + '.', currentReport.overall.toLowerCase());
    } catch (error) {
      currentReport = null;
      downloadButton.disabled = true;
      setStatus(error.message, 'error');
    }
  }

  function loadExample() {
    var sample = Core.example();
    requirementsInput.value = sample.requirements;
    inventoryInput.value = sample.inventory;
    analyze();
  }

  function clearAll() {
    requirementsInput.value = '';
    inventoryInput.value = '';
    currentReport = null;
    downloadButton.disabled = true;
    empty(summary);
    empty(requirementResults);
    empty(contractResults);
    truthNote.textContent = 'No comparison has been run.';
    setStatus('Inputs cleared. Nothing was persisted.', 'neutral');
    requirementsInput.focus();
  }

  function downloadReport() {
    if (!currentReport) return;
    var blob = new Blob([JSON.stringify(currentReport, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = Core.downloadName(currentReport.workbench.generatedAt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('Gap report download prepared by explicit request.', 'ready');
  }

  analyzeButton.addEventListener('click', analyze);
  exampleButton.addEventListener('click', loadExample);
  clearButton.addEventListener('click', clearAll);
  downloadButton.addEventListener('click', downloadReport);
  loadExample();
})();
