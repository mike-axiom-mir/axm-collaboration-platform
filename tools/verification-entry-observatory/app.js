'use strict';

(function () {
  const map = window.AXM_VERIFICATION_ENTRY_MAP;
  const summaryGrid = document.getElementById('summary-grid');
  const moduleList = document.getElementById('module-list');
  const request = window.AXM_VERIFICATION_RUN_REQUEST;
  const requestBody = document.getElementById('run-request');

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function summary(label, value, tone) {
    const card = make('article', 'summary-card ' + tone);
    card.append(make('strong', null, value), make('span', null, label));
    summaryGrid.appendChild(card);
  }

  if (!map || map.schema !== 'axm.verification-entry-map/v1') {
    moduleList.appendChild(make('p', 'empty', 'Verification entry map unavailable. Generate current-verification-entry-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('Modules', map.summary.modules, 'neutral');
  summary('Conventional selftests', map.summary.modulesWithConventionalSelftest, 'good');
  summary('Name-matched files', map.summary.nameMatchedFiles, 'good');
  summary('Declared scripts', map.summary.declaredPackageScripts, 'hold');
  summary('Read issues', map.summary.readIssues, 'unknown');

  if (!request || request.schema !== 'axm.verification-run-request/v1') {
    requestBody.appendChild(make('p', 'empty', 'No bounded run request loaded. Select one exact mapped entry when generating the request.'));
  } else {
    const requestHead = make('div', 'request-head');
    requestHead.append(
      make('strong', null, request.selectedModule.id + ' · ' + request.selectedEntry.path),
      make('code', null, request.summary.checksRequested + ' REQUEST_NOT_RUN')
    );
    const checkList = make('div', 'check-list');
    request.checks.forEach(item => {
      const checkRow = make('div', 'check-row');
      checkRow.append(make('span', null, item.id.replaceAll('_', ' ')), make('code', null, item.state.replaceAll('_', ' ')));
      checkList.appendChild(checkRow);
    });
    requestBody.append(requestHead, checkList);
  }

  map.modules.filter(module => module.entries.length || module.packageScripts.length).forEach(module => {
    const row = make('article', 'row');
    const identity = make('div', 'identity');
    identity.append(make('strong', null, module.id), make('code', null, module.status + ' · ' + module.version));
    const counts = make('div', 'counts');
    counts.append(
      make('span', null, module.entries.length + ' name match(es)'),
      make('span', null, module.packageScripts.length + ' declared script(s)')
    );
    const details = make('div', 'details');
    module.entries.slice(0, 4).forEach(entry => details.appendChild(make('span', null, entry.path + ' · ' + entry.role.replaceAll('_', ' '))));
    module.packageScripts.slice(0, 2).forEach(script => details.appendChild(make('span', null, 'package script ' + script.name + ' · DECLARED NOT RUN')));
    if (module.entries.length > 4) details.appendChild(make('span', null, '+' + (module.entries.length - 4) + ' more name match(es)'));
    row.append(identity, counts, details);
    moduleList.appendChild(row);
  });
  if (!moduleList.children.length) moduleList.appendChild(make('p', 'empty', 'No verification-shaped entries observed.'));
}());
