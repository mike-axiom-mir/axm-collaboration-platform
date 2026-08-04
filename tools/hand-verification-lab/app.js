(function () {
  'use strict';

  var Core = window.AXMHandVerificationCore;
  var sourceInput = document.getElementById('specificationInput');
  var loadButton = document.getElementById('loadButton');
  var exampleButton = document.getElementById('exampleButton');
  var receiptButton = document.getElementById('receiptButton');
  var planDownloadButton = document.getElementById('planDownloadButton');
  var receiptDownloadButton = document.getElementById('receiptDownloadButton');
  var clearButton = document.getElementById('clearButton');
  var status = document.getElementById('status');
  var planSummary = document.getElementById('planSummary');
  var caseList = document.getElementById('caseList');
  var receiptPreview = document.getElementById('receiptPreview');
  var currentPlan = null;
  var currentReceipt = null;

  function setStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'neutral';
  }

  function empty(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function field(labelText, id, element) {
    var label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = labelText;
    element.id = id;
    label.appendChild(element);
    return label;
  }

  function renderPlan(plan) {
    empty(caseList);
    plan.cases.forEach(function (testCase) {
      var card = document.createElement('article');
      card.className = 'case-card';

      var heading = document.createElement('div');
      heading.className = 'case-heading';
      var title = document.createElement('h3');
      title.textContent = testCase.id + ' · ' + testCase.title;
      var family = document.createElement('span');
      family.textContent = testCase.family;
      heading.appendChild(title);
      heading.appendChild(family);
      card.appendChild(heading);

      var claim = document.createElement('p');
      claim.className = 'claim';
      claim.textContent = testCase.claim;
      card.appendChild(claim);

      var details = document.createElement('details');
      var summary = document.createElement('summary');
      summary.textContent = 'Pass condition, counterevidence and required evidence';
      details.appendChild(summary);
      [
        ['Pass condition', testCase.passCondition],
        ['Counterevidence', testCase.counterevidence],
        ['Required evidence', testCase.evidenceRequired.join('; ')]
      ].forEach(function (row) {
        var paragraph = document.createElement('p');
        var strong = document.createElement('strong');
        strong.textContent = row[0] + ': ';
        paragraph.appendChild(strong);
        paragraph.appendChild(document.createTextNode(row[1]));
        details.appendChild(paragraph);
      });
      card.appendChild(details);

      var controls = document.createElement('div');
      controls.className = 'case-controls';
      var verdict = document.createElement('select');
      Core.VERDICTS.forEach(function (value) {
        var option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        verdict.appendChild(option);
      });
      controls.appendChild(field('Operator verdict', testCase.id + '-verdict', verdict));

      var pointer = document.createElement('input');
      pointer.type = 'text';
      pointer.autocomplete = 'off';
      pointer.placeholder = 'Path, URL, receipt ID or other stable locator';
      controls.appendChild(field('Evidence pointer', testCase.id + '-evidence', pointer));

      var observation = document.createElement('textarea');
      observation.placeholder = 'What was directly observed?';
      controls.appendChild(field('Concrete observation', testCase.id + '-observation', observation));
      card.appendChild(controls);
      caseList.appendChild(card);
    });
    planSummary.textContent = plan.target.capabilityId + ' · ' + plan.cases.length + ' required families · ' + plan.target.specificationFingerprint;
  }

  function readObservations() {
    return currentPlan.cases.map(function (testCase) {
      return {
        caseId: testCase.id,
        verdict: document.getElementById(testCase.id + '-verdict').value,
        evidencePointer: document.getElementById(testCase.id + '-evidence').value,
        observation: document.getElementById(testCase.id + '-observation').value
      };
    });
  }

  function loadPlan() {
    try {
      var specification = Core.parseSpecification(sourceInput.value);
      currentPlan = Core.buildPlan(specification);
      currentReceipt = null;
      renderPlan(currentPlan);
      receiptPreview.textContent = 'Record observations, then build an operator evidence receipt.';
      receiptButton.disabled = false;
      planDownloadButton.disabled = false;
      receiptDownloadButton.disabled = true;
      setStatus('Verification plan built. No tests were executed by this lab.', 'ready');
    } catch (error) {
      currentPlan = null;
      currentReceipt = null;
      empty(caseList);
      planSummary.textContent = 'No valid plan loaded.';
      receiptButton.disabled = true;
      planDownloadButton.disabled = true;
      receiptDownloadButton.disabled = true;
      setStatus(error.message, 'error');
    }
  }

  function buildReceipt() {
    if (!currentPlan) return;
    try {
      currentReceipt = Core.buildReceipt(currentPlan, readObservations());
      receiptPreview.textContent = JSON.stringify(currentReceipt, null, 2);
      receiptDownloadButton.disabled = false;
      var summary = currentReceipt.summary;
      var downgraded = currentReceipt.records.filter(function (record) { return record.downgradeReason; }).length;
      setStatus('Receipt recorded: ' + summary.overall + '. ' + summary.evidencedPasses + '/' + summary.requiredCases + ' evidenced passes' + (downgraded ? '; ' + downgraded + ' unevidenced pass downgraded.' : '.') + ' Runtime proof remains false.', summary.overall === 'FAIL' ? 'error' : 'ready');
    } catch (error) {
      currentReceipt = null;
      receiptDownloadButton.disabled = true;
      setStatus(error.message, 'error');
    }
  }

  function download(value, name) {
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

  function loadExample() {
    sourceInput.value = JSON.stringify(Core.example(), null, 2);
    loadPlan();
  }

  function clearAll() {
    sourceInput.value = '';
    currentPlan = null;
    currentReceipt = null;
    empty(caseList);
    planSummary.textContent = 'No valid plan loaded.';
    receiptPreview.textContent = 'No receipt has been recorded.';
    receiptButton.disabled = true;
    planDownloadButton.disabled = true;
    receiptDownloadButton.disabled = true;
    setStatus('Lab cleared. Nothing was persisted.', 'neutral');
    sourceInput.focus();
  }

  loadButton.addEventListener('click', loadPlan);
  exampleButton.addEventListener('click', loadExample);
  receiptButton.addEventListener('click', buildReceipt);
  planDownloadButton.addEventListener('click', function () {
    if (!currentPlan) return;
    download(currentPlan, Core.downloadName(currentPlan, 'plan'));
    setStatus('Plan download prepared by explicit request.', 'ready');
  });
  receiptDownloadButton.addEventListener('click', function () {
    if (!currentReceipt) return;
    download(currentReceipt, Core.downloadName(currentReceipt, 'receipt'));
    setStatus('Receipt download prepared by explicit request.', 'ready');
  });
  clearButton.addEventListener('click', clearAll);
  loadExample();
})();
