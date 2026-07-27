'use strict';

(function () {
  const surface = window.AXM_PROTOCOL_VERSION_SURFACE;
  const summaryGrid = document.getElementById('summary-grid');
  const familyList = document.getElementById('family-list');
  const tokenList = document.getElementById('token-list');

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

  function row(title, state, details, paths) {
    const item = make('article', 'row ' + state.toLowerCase().replaceAll('_', '-'));
    const identity = make('div', 'identity');
    identity.append(make('strong', null, title), make('code', null, state.replaceAll('_', ' ')));
    const detail = make('div', 'detail');
    details.forEach(value => detail.appendChild(make('span', null, value)));
    const sources = make('div', 'paths');
    paths.forEach(value => sources.appendChild(make('span', null, value)));
    item.append(identity, detail, sources);
    return item;
  }

  if (!surface || surface.schema !== 'axm.protocol-version-surface/v1') {
    familyList.appendChild(make('p', 'empty', 'Protocol surface unavailable. Run protocol-cli.js with --browser-output current-protocol-surface.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + surface.measuredAt + ' · ' + surface.source.label;
  document.getElementById('fingerprint').textContent = surface.source.fingerprint.slice(0, 20);
  summary('Unique tokens', surface.summary.uniqueTokens, 'neutral');
  summary('Slash-versioned tokens', surface.summary.slashVersionedTokens, 'good');
  summary('Version families', surface.summary.versionFamilies, 'neutral');
  summary('Multiple-version families', surface.summary.multipleVersionFamilies, 'hold');
  summary('Future occurrences', surface.summary.futureTokenOccurrences, 'unknown');

  const stateOrder = {
    MIXED_VERSIONED_AND_UNPARSED_FAMILY: 0,
    MULTIPLE_DECLARED_VERSIONS: 1,
    SINGLE_DECLARED_VERSION: 2
  };
  surface.families
    .slice()
    .sort((left, right) => stateOrder[left.state] - stateOrder[right.state] || left.family.localeCompare(right.family))
    .forEach(family => familyList.appendChild(row(
      family.family,
      family.state,
      [
        family.versions.join(', '),
        family.modules.length + ' declaring module(s)',
        family.futureTokens.length + ' future token(s)'
      ],
      family.tokens.concat(family.mixedUnparsedTokens).slice(0, 6)
    )));
  if (!surface.families.length) familyList.appendChild(make('p', 'empty', 'No AXM slash-version family observed.'));

  surface.tokens
    .filter(token => token.convention === 'UNPARSED_VERSION_CONVENTION')
    .forEach(token => tokenList.appendChild(row(
      token.token,
      token.convention,
      [token.modules.length + ' module(s)', token.roles.length + ' declaration role(s)'],
      token.roles
    )));
  if (!surface.tokens.some(token => token.convention === 'UNPARSED_VERSION_CONVENTION')) {
    tokenList.appendChild(make('p', 'empty', 'No unparsed protocol token observed.'));
  }
}());
