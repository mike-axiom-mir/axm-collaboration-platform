'use strict';

(function () {
  const map = window.AXM_HOST_ASSUMPTION_MAP;
  const summaryGrid = document.getElementById('summary-grid');
  const assumptionList = document.getElementById('assumption-list');
  const request = window.AXM_ENVIRONMENT_PROBE_REQUEST;
  const requestBody = document.getElementById('probe-request');

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

  if (!map || map.schema !== 'axm.host-assumption-map/v1') {
    assumptionList.appendChild(make('p', 'empty', 'Host assumption map unavailable. Run host-assumption-cli.js with --browser-output current-host-assumption-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('Modules', map.summary.modules, 'neutral');
  summary('Assumption occurrences', map.summary.assumptionOccurrences, 'good');
  summary('Unique assumptions', map.summary.uniqueAssumptions, 'good');
  summary('Contract unknown', map.summary.contractUnknown, 'hold');
  summary('Read issues', map.summary.readIssues, 'unknown');

  if (!request || request.schema !== 'axm.environment-probe-request/v1') {
    requestBody.appendChild(make('p', 'empty', 'No bounded probe request loaded. Select exactly one module when generating the browser request.'));
  } else {
    const requestHead = make('div', 'request-head');
    requestHead.append(
      make('strong', null, request.selectedModule.id),
      make('code', null, request.summary.checksRequested + ' REQUEST_NOT_RUN')
    );
    const checkList = make('div', 'check-list');
    request.checks.forEach(item => {
      const checkRow = make('div', 'check-row');
      checkRow.append(
        make('span', null, item.id.replaceAll('_', ' ')),
        make('code', null, item.state.replaceAll('_', ' '))
      );
      checkList.appendChild(checkRow);
    });
    requestBody.append(requestHead, checkList);
  }

  map.assumptions.forEach(assumption => {
    const row = make('article', 'row');
    const identity = make('div', 'identity');
    identity.append(make('strong', null, assumption.token), make('code', null, assumption.state.replaceAll('_', ' ')));
    const kinds = make('div', 'kinds');
    assumption.kinds.forEach(kind => kinds.appendChild(make('span', null, kind.replaceAll('_', ' '))));
    const details = make('div', 'details');
    details.append(
      make('span', null, 'Modules · ' + assumption.modules.join(', ')),
      make('span', null, 'Fields · ' + assumption.roles.join(', ')),
      make('span', null, assumption.occurrences.length + ' declaration occurrence(s)')
    );
    row.append(identity, kinds, details);
    assumptionList.appendChild(row);
  });
  if (!map.assumptions.length) assumptionList.appendChild(make('p', 'empty', 'No matching declaration syntax observed.'));
}());
