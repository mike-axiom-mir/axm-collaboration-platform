'use strict';

(function () {
  const map = window.AXM_STORAGE_NAMESPACE_MAP;
  const request = window.AXM_STORAGE_NAMESPACE_REVIEW_REQUEST;
  const summaryGrid = document.getElementById('summary-grid');
  const groupList = document.getElementById('group-list');
  const occurrenceList = document.getElementById('occurrence-list');

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

  if (!map || map.schema !== 'axm.storage-namespace-map/v1') {
    groupList.appendChild(make('p', 'empty', 'Generate current-storage-namespace-map.js.'));
    return;
  }
  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · graph ' + map.source.graphFingerprint.slice(0, 12);
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('Occurrences', map.summary.occurrences, 'neutral');
  summary('Resolved names', map.summary.literalOrResolved, 'good');
  summary('Dynamic holds', map.summary.dynamicNotResolved, 'hold');
  summary('Repeated groups', map.summary.exactCollisionGroups, 'review');
  summary('Verified sources', map.summary.verifiedSources, 'good');
  summary('Read issues', map.summary.readIssues, 'issue');

  if (request && request.schema === 'axm.storage-namespace-review-request/v1') {
    document.getElementById('request-state').textContent = request.summary.questionsAnswered + ' ANSWERED · ' + request.summary.questionsRequested + ' REQUESTED';
    const detail = document.getElementById('request-detail');
    detail.replaceChildren();
    detail.append(
      make('strong', null, request.selectedGroup.storageKind + ' · ' + request.selectedGroup.namespace),
      make('p', null, request.selectedGroup.ownershipScopes.length + ' ownership scopes · request only · no values included')
    );
  }

  if (!map.collisionGroups.length) groupList.appendChild(make('p', 'empty', 'No exact cross-owner repeated namespace group was observed.'));
  map.collisionGroups.forEach(group => {
    const row = make('article', 'row group-row');
    row.append(
      make('code', null, group.storageKind),
      make('strong', null, group.namespace),
      make('span', null, group.ownershipScopes.length + ' scopes'),
      make('small', null, group.state.replaceAll('_', ' '))
    );
    groupList.appendChild(row);
  });

  map.occurrences.forEach(item => {
    const row = make('article', 'row occurrence-row');
    row.append(
      make('code', null, item.storageKind + ' · ' + item.operation),
      make('strong', null, item.namespace === null ? 'dynamic / whole store' : item.namespace),
      make('span', null, item.sourceOwner || 'shared source'),
      make('small', null, item.path + ':' + item.line + ' · ' + item.resolution.replaceAll('_', ' '))
    );
    occurrenceList.appendChild(row);
  });
}());
