'use strict';

(function () {
  const map = window.AXM_BROWSER_GLOBAL_SURFACE;
  const request = window.AXM_BROWSER_GLOBAL_REVIEW_REQUEST;
  const byId = id => document.getElementById(id);
  const make = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  const card = (label, value, tone) => {
    const element = make('article', 'card ' + tone);
    element.append(make('strong', null, value), make('span', null, label));
    byId('summary').appendChild(element);
  };

  if (!map || map.schema !== 'axm.browser-global-surface/v1') {
    byId('groups').appendChild(make('p', 'empty', 'Generate current-browser-global-surface.js.'));
    return;
  }
  byId('measured').textContent = 'Measured ' + map.measuredAt + ' · graph ' + map.source.graphFingerprint.slice(0, 12);
  byId('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  card('Observations', map.summary.observations, 'neutral');
  card('Definitions', map.summary.definitions, 'good');
  card('References', map.summary.references, 'neutral');
  card('Dynamic holds', map.summary.dynamicNotResolved, 'hold');
  card('Review groups', map.summary.multiOwnerDefinitionGroups, 'review');
  card('Read issues', map.summary.readIssues, 'issue');

  if (request && request.schema === 'axm.browser-global-review-request/v1') {
    byId('request-state').textContent = request.summary.questionsAnswered + ' ANSWERED · ' + request.summary.questionsRequested + ' REQUESTED';
    byId('request').replaceChildren(
      make('strong', null, request.selectedGroup.symbol),
      make('p', null, request.selectedGroup.ownershipScopes.length + ' ownership scopes · questions only')
    );
  }
  if (!map.definitionGroups.length) byId('groups').appendChild(make('p', 'empty', 'No exact global symbol was defined across multiple source owners.'));
  map.definitionGroups.forEach(group => {
    const row = make('article', 'row');
    row.append(make('code', null, group.symbol), make('strong', null, group.definitions.length + ' definitions'), make('span', null, group.ownershipScopes.length + ' scopes'), make('small', null, group.state.replaceAll('_', ' ')));
    byId('groups').appendChild(row);
  });
  map.observations.forEach(item => {
    const row = make('article', 'row');
    row.append(make('code', null, item.operation), make('strong', null, item.symbol || 'dynamic name'), make('span', null, item.sourceOwner || 'shared source'), make('small', null, item.path + ':' + item.line + ' · ' + item.resolution.replaceAll('_', ' ')));
    byId('observations').appendChild(row);
  });
}());
