'use strict';

(function () {
  const census = window.AXM_CENSUS_SNAPSHOT;
  const grid = document.getElementById('scope-grid');
  const scopeSelect = document.getElementById('reference-scope');
  const result = document.getElementById('comparison');

  function text(element, value) {
    element.textContent = String(value);
  }

  function card(item) {
    const article = document.createElement('article');
    article.className = 'scope-card';
    const count = document.createElement('strong');
    count.className = 'scope-count';
    text(count, item.count);
    const name = document.createElement('h3');
    text(name, item.label);
    const definition = document.createElement('p');
    text(definition, item.definition);
    const id = document.createElement('code');
    text(id, item.scopeId);
    article.append(count, name, definition, id);
    return article;
  }

  function setResult(kind, heading, detail) {
    result.className = 'result ' + kind.toLowerCase();
    result.replaceChildren();
    const strong = document.createElement('strong');
    text(strong, heading);
    const span = document.createElement('span');
    text(span, detail);
    result.append(strong, span);
  }

  function referenceFreshness() {
    const raw = document.getElementById('reference-time').value;
    if (!raw) return 'Reference freshness: UNTIMED.';
    const measured = Date.parse(raw);
    if (!Number.isFinite(measured)) return 'Reference freshness: UNTIMED.';
    const age = Math.max(0, Date.now() - measured);
    return 'Reference freshness: ' + (age <= 24 * 60 * 60 * 1000 ? 'LIVE' : 'STALE') + ' against the 24-hour view lifetime.';
  }

  if (!census || census.schema !== 'axm.workshop-census/v1' || !Array.isArray(census.scopes)) {
    setResult('neutral', 'Snapshot unavailable', 'Run census-cli.js with --browser-output current-census.js.');
    return;
  }

  text(document.getElementById('fingerprint'), census.source.fingerprint.slice(0, 16));
  text(document.getElementById('measured-at'), 'Measured ' + census.measuredAt + ' · ' + census.source.label);
  for (const item of census.scopes) {
    grid.appendChild(card(item));
    const option = document.createElement('option');
    option.value = item.scopeId;
    text(option, item.label);
    scopeSelect.appendChild(option);
  }

  document.getElementById('compare-form').addEventListener('submit', event => {
    event.preventDefault();
    const scopeId = scopeSelect.value;
    const rawCount = document.getElementById('reference-count').value;
    const previous = Number(rawCount);
    const selected = census.scopes.find(item => item.scopeId === scopeId);
    if (!selected) {
      setResult('not-comparable', 'NOT COMPARABLE', 'The earlier count has no matching named scope. Preserve both totals; do not subtract them. ' + referenceFreshness());
      return;
    }
    if (rawCount === '' || !Number.isInteger(previous) || previous < 0) {
      setResult('invalid-reference', 'INVALID REFERENCE', 'Enter a whole, non-negative previous count.');
      return;
    }
    const delta = selected.count - previous;
    if (delta === 0) {
      setResult('match', 'MATCH', selected.label + ' remains ' + selected.count + '. ' + referenceFreshness());
      return;
    }
    const direction = delta > 0 ? '+' + delta : String(delta);
    setResult('drift', 'DRIFT ' + direction, selected.label + ' is now ' + selected.count + ', compared with ' + previous + '. ' + referenceFreshness());
  });
}());
