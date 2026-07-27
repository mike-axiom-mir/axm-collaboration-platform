'use strict';

(function () {
  const map = window.AXM_DEPENDENCY_DECLARATION_MAP;
  const summaryGrid = document.getElementById('summary-grid');
  const cycleList = document.getElementById('cycle-list');
  const unresolvedList = document.getElementById('unresolved-list');
  const edgeList = document.getElementById('edge-list');
  const review = window.AXM_DEPENDENCY_CYCLE_REVIEW_PACKET;

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

  function dependencyRow(title, state, details, paths) {
    const row = make('article', 'row ' + state.toLowerCase().replaceAll('_', '-'));
    const identity = make('div', 'identity');
    identity.append(make('strong', null, title), make('code', null, state.replaceAll('_', ' ')));
    const detail = make('div', 'detail');
    details.forEach(value => detail.appendChild(make('span', null, value)));
    const sources = make('div', 'paths');
    paths.forEach(value => sources.appendChild(make('span', null, value)));
    row.append(identity, detail, sources);
    return row;
  }

  if (!map || map.schema !== 'axm.dependency-declaration-map/v1') {
    cycleList.appendChild(make('p', 'empty', 'Dependency map unavailable. Run dependency-cli.js with --browser-output current-dependency-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('Modules', map.summary.modules, 'neutral');
  summary('Exact module edges', map.summary.exactModuleRelations, 'good');
  summary('Declared cycles', map.summary.declaredCycles, 'hold');
  summary('Explicit targets outside scope', map.summary.explicitTargetsNotTopLevelModules, 'hold');
  summary('Generic tokens untouched', map.summary.genericTokensUninterpreted, 'unknown');

  map.cycles.forEach(cycle => cycleList.appendChild(dependencyRow(
    cycle.members.join(' ↔ '),
    'DECLARED_CYCLE',
    [cycle.members.length + ' module(s)', cycle.edges.length + ' internal edge(s)'],
    cycle.edges.slice(0, 5).map(edge => edge.from + ' → ' + edge.to)
  )));
  if (!map.cycles.length) cycleList.appendChild(make('p', 'empty', 'No exact declared dependency cycle observed.'));

  if (review && review.schema === 'axm.dependency-cycle-review-packet/v1') {
    document.getElementById('review-title').textContent = review.cycle.members.join(' ↔ ');
    const facts = document.getElementById('review-facts');
    [
      review.cycle.internalEdges.length + ' internal edge(s)',
      review.cycle.incomingEdges.length + ' incoming edge(s)',
      review.cycle.outgoingEdges.length + ' outgoing edge(s)',
      'decision ' + review.humanDecision.state
    ].forEach(value => facts.appendChild(make('span', null, value)));
    review.questions.forEach(question => {
      const row = dependencyRow(
        question.kind,
        'REVIEW_QUESTION',
        [question.prompt],
        question.evidence && question.evidence.tokens || []
      );
      row.classList.add('review-question');
      document.getElementById('review-questions').appendChild(row);
    });
  } else {
    document.getElementById('review-questions').appendChild(make('p', 'empty', 'Generate one packet with --cycle-member and --browser-review-output.'));
  }

  map.explicitTargetsNotTopLevelModules.forEach(item => unresolvedList.appendChild(dependencyRow(
    item.moduleId + ' → ' + item.targetModuleId,
    item.state,
    [item.source],
    [item.token]
  )));
  if (!map.explicitTargetsNotTopLevelModules.length) unresolvedList.appendChild(make('p', 'empty', 'Every explicit target matched a top-level module.'));

  map.edges.forEach(edge => edgeList.appendChild(dependencyRow(
    edge.from + ' → ' + edge.to,
    'EXACT_MODULE_RELATION',
    edge.sources,
    edge.tokens
  )));
  if (!map.edges.length) edgeList.appendChild(make('p', 'empty', 'No exact module edge observed.'));
}());
