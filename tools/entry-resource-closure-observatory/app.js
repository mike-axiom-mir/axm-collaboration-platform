'use strict';

(function () {
  const map = window.AXM_ENTRY_RESOURCE_CLOSURE_MAP;
  const graph = window.AXM_ENTRY_RESOURCE_GRAPH;
  const summaryGrid = document.getElementById('summary-grid');
  const moduleList = document.getElementById('module-list');

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

  if (!map || map.schema !== 'axm.entry-resource-closure-map/v1') {
    moduleList.appendChild(make('p', 'empty', 'Resource closure map unavailable. Generate current-entry-resource-closure-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('HTML entries parsed', map.summary.entriesPresentHtml, 'good');
  summary('Static local present', map.summary.localPresent, 'good');
  summary('Static local missing', map.summary.localMissing, 'issue');
  summary('Local safety holds', map.summary.localSafetyHolds, 'hold');
  summary('Remote not fetched', map.summary.remoteNotFetched, 'unknown');
  summary('Dynamic unresolved', map.summary.dynamicNotResolved, 'unknown');

  if (graph && graph.schema === 'axm.entry-resource-graph/v1') {
    document.getElementById('graph-state').textContent = graph.summary.limitHolds
      ? graph.summary.limitHolds + ' LIMIT HOLD(S)'
      : 'BOUNDED · COMPLETE';
    const graphSummary = document.getElementById('graph-summary');
    graphSummary.replaceChildren();
    [
      ['Nodes', graph.summary.nodes],
      ['Text bodies', graph.summary.textBodiesRead],
      ['Edges', graph.summary.edges],
      ['Local present', graph.summary.localPresentEdges],
      ['Missing', graph.summary.missingEdges],
      ['Unresolved', graph.summary.unresolvedEdges],
      ['Cycles', graph.summary.cycles],
      ['Read issues', graph.summary.readIssues]
    ].forEach(([label, value]) => {
      const item = make('article', 'graph-stat');
      item.append(make('strong', null, value), make('span', null, label));
      graphSummary.appendChild(item);
    });
  }

  const modules = map.modules.slice().sort((left, right) => (
    Number(right.summary.hasLocalIssues) - Number(left.summary.hasLocalIssues)
    || right.summary.localMissing - left.summary.localMissing
    || left.id.localeCompare(right.id)
  ));
  modules.forEach(module => {
    const row = make('article', 'row' + (module.summary.hasLocalIssues ? ' issue-row' : ''));
    const head = make('div', 'row-head');
    const identity = make('div', 'identity');
    identity.append(
      make('strong', null, module.id),
      make('code', null, module.entry.path || 'entry not declared'),
      make('small', null, module.entry.state.replaceAll('_', ' '))
    );
    const counts = make('div', 'counts');
    counts.append(
      make('span', 'present', module.summary.localPresent + ' present'),
      make('span', 'missing', module.summary.localMissing + ' missing'),
      make('span', 'unresolved', module.summary.unresolvedExternalOrRuntime + ' unresolved')
    );
    head.append(identity, counts);
    row.appendChild(head);

    if (module.references.length) {
      const references = make('div', 'references');
      module.references.forEach(reference => {
        const referenceRow = make('div', 'reference ' + (
          reference.state === 'STATIC_LOCAL_PRESENT' ? 'reference-present'
            : reference.state === 'STATIC_LOCAL_MISSING' ? 'reference-missing'
              : 'reference-unresolved'
        ));
        referenceRow.append(
          make('code', 'source', reference.tag + '[' + reference.attribute + '] · L' + reference.line),
          make('span', 'raw', reference.raw || '(empty)'),
          make('strong', 'state', reference.state.replaceAll('_', ' '))
        );
        references.appendChild(referenceRow);
      });
      row.appendChild(references);
    }
    moduleList.appendChild(row);
  });
}());
