'use strict';

(function () {
  const map = window.AXM_HANDOFF_WIRING_MAP;
  const summaryGrid = document.getElementById('summary-grid');
  const artifactList = document.getElementById('artifact-list');
  const moduleList = document.getElementById('module-list');

  function make(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = String(value);
    return element;
  }

  function summary(label, value, tone) {
    const card = make('article', 'summary-card ' + tone);
    card.append(make('strong', null, value), make('span', null, label));
    summaryGrid.appendChild(card);
  }

  function artifactRow(record) {
    const row = make('article', 'artifact-row ' + record.state.toLowerCase().replaceAll('_', '-'));
    const identity = make('div', 'artifact-identity');
    identity.append(make('strong', null, record.artifact), make('span', null, record.state.replaceAll('_', ' ')));
    const endpoints = make('div', 'endpoints');
    endpoints.append(
      make('span', null, 'Produces · ' + (record.providers.join(', ') || 'none')),
      make('span', null, 'Accepts · ' + (record.consumers.join(', ') || 'none'))
    );
    row.append(identity, endpoints);
    return row;
  }

  function moduleRow(module) {
    const row = make('article', 'module-row');
    const identity = make('div');
    identity.append(make('strong', null, module.id), make('span', null, module.version + ' · ' + module.status));
    const sources = make('div', 'sources');
    sources.append(
      make('span', null, 'accepts: ' + module.sources.accepts),
      make('span', null, 'produces: ' + module.sources.produces)
    );
    const states = make('div', 'states');
    states.append(
      make('span', 'state', 'IN ' + module.reconciliation.accepts.state),
      make('span', 'state', 'OUT ' + module.reconciliation.emits.state)
    );
    row.append(identity, sources, states);
    return row;
  }

  if (!map || map.schema !== 'axm.handoff-wiring-map/v1') {
    artifactList.appendChild(make('p', 'empty', 'Wiring map unavailable. Run wiring-cli.js with --browser-output current-wiring-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('Modules', map.summary.modules, 'neutral');
  summary('Exact wires', map.summary.exactlyWiredArtifacts, 'wired');
  summary('Producer only', map.summary.producerOnlyArtifacts, 'producer');
  summary('Consumer only', map.summary.consumerOnlyArtifacts, 'consumer');
  summary('Self-loop only', map.summary.selfLoopOnlyArtifacts, 'self');

  const seams = map.artifacts
    .filter(record => record.state !== 'EXACTLY_WIRED')
    .sort((left, right) => left.state.localeCompare(right.state) || left.artifact.localeCompare(right.artifact));
  for (const record of seams) artifactList.appendChild(artifactRow(record));
  if (!seams.length) artifactList.appendChild(make('p', 'empty', 'No unpaired exact-string artifacts.'));

  const modules = map.modules
    .filter(module =>
      module.sources.accepts !== 'manifest' ||
      module.sources.produces !== 'manifest' ||
      module.reconciliation.accepts.state !== 'EXACT' ||
      module.reconciliation.emits.state !== 'EXACT')
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const module of modules) moduleList.appendChild(moduleRow(module));
  if (!modules.length) moduleList.appendChild(make('p', 'empty', 'All authored envelopes reconcile exactly.'));
}());
