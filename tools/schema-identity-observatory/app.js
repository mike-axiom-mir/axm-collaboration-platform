'use strict';

(function () {
  const map = window.AXM_SCHEMA_IDENTITY_MAP;
  const summaryGrid = document.getElementById('summary-grid');
  const definitionList = document.getElementById('definition-list');
  const referenceList = document.getElementById('reference-list');

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

  function groupRow(group, definition) {
    const row = make('article', 'row ' + group.state.toLowerCase().replaceAll('_', '-'));
    const identity = make('div', 'identity');
    identity.append(
      make('strong', null, group.identity),
      make('code', null, group.state.replaceAll('_', ' '))
    );
    const detail = make('div', 'detail');
    if (definition) {
      detail.append(
        make('span', null, group.occurrences.length + ' occurrence(s)'),
        make('span', null, group.definitionDigests.length + ' exact body digest(s)')
      );
    } else {
      detail.append(
        make('span', null, group.occurrences.length + ' reference occurrence(s)'),
        make('span', null, group.state === 'LOCAL_DEFINITION_OBSERVED'
          ? 'definition seen in this bounded scan'
          : 'no local definition observed')
      );
    }
    const paths = make('div', 'paths');
    group.occurrences.slice(0, 4).forEach(item => {
      paths.appendChild(make('span', null, item.path + ' ' + item.pointer));
    });
    if (group.occurrences.length > 4) {
      paths.appendChild(make('span', null, '+' + (group.occurrences.length - 4) + ' more'));
    }
    row.append(identity, detail, paths);
    return row;
  }

  if (!map || map.schema !== 'axm.schema-identity-map/v1') {
    definitionList.appendChild(make('p', 'empty', 'Schema identity map unavailable. Run schema-cli.js with --browser-output current-schema-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('Definition IDs', map.summary.uniqueDefinitionIds, 'neutral');
  summary('Identical reuse groups', map.summary.repeatedIdenticalDefinitions, 'good');
  summary('Divergent same-ID groups', map.summary.divergentSameIdDefinitions, 'hold');
  summary('Reference IDs', map.summary.uniqueReferenceIds, 'neutral');
  summary('No local definition observed', map.summary.referencesWithoutLocalDefinition, 'unknown');

  const stateOrder = {
    DIVERGENT_SAME_ID_DEFINITIONS: 0,
    REPEATED_IDENTICAL_DEFINITION: 1,
    UNIQUE_DEFINITION: 2
  };
  map.definitionGroups
    .slice()
    .sort((left, right) => stateOrder[left.state] - stateOrder[right.state] || left.identity.localeCompare(right.identity))
    .forEach(group => definitionList.appendChild(groupRow(group, true)));
  if (!map.definitionGroups.length) definitionList.appendChild(make('p', 'empty', 'No $id definitions observed.'));

  map.referenceGroups
    .slice()
    .sort((left, right) => right.state.localeCompare(left.state) || left.identity.localeCompare(right.identity))
    .forEach(group => referenceList.appendChild(groupRow(group, false)));
  if (!map.referenceGroups.length) referenceList.appendChild(make('p', 'empty', 'No schema reference fields observed.'));
}());
