(function () {
  'use strict';

  var Core = window.AXMExternalPatternObservatory;
  var report = null;
  var selectedId = null;
  var elements = {};

  function byId(id) { return document.getElementById(id); }
  function element(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  }

  function unique(values) {
    return Array.from(new Set(values)).sort();
  }

  function addOptions(select, values) {
    values.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value.replace(/_/g, ' ');
      select.appendChild(option);
    });
  }

  function listBlock(title, values) {
    var fragment = document.createDocumentFragment();
    fragment.appendChild(element('h3', '', title));
    var list = element('ul');
    values.forEach(function (value) { list.appendChild(element('li', '', value)); });
    fragment.appendChild(list);
    return fragment;
  }

  function fact(term, description) {
    var row = element('div', 'fact');
    row.appendChild(element('dt', '', term));
    row.appendChild(element('dd', '', description));
    return row;
  }

  function inspect(card) {
    selectedId = card.id;
    elements.inspectionTitle.textContent = card.id.replace('pattern:', '');
    elements.inspectionBody.replaceChildren();
    var description = element('p', '', card.summary);
    var facts = element('dl');
    facts.appendChild(fact('Family', card.family));
    facts.appendChild(fact('Priority', card.priority.replace(/_/g, ' ')));
    facts.appendChild(fact('Integration', card.integrationMode.replace(/_/g, ' ')));
    facts.appendChild(fact('Source', card.source.assertionState));
    facts.appendChild(fact('Freshness', card.source.freshness));
    facts.appendChild(fact('License hint', card.license.reportedHint + ' (unverified)'));
    facts.appendChild(fact('Reuse', card.license.reuseDecision));
    elements.inspectionBody.appendChild(description);
    elements.inspectionBody.appendChild(facts);
    elements.inspectionBody.appendChild(listBlock('Possible AXM use', card.axmUse));
    elements.inspectionBody.appendChild(listBlock('Warnings carried forward', card.warnings));
    elements.inspectionBody.appendChild(element('h3', '', 'Semantic digest'));
    elements.inspectionBody.appendChild(element('p', 'digest-box', card.semanticDigest));
    renderCards();
  }

  function clearInspection(message) {
    selectedId = null;
    elements.inspectionTitle.textContent = 'Choose a visible pattern';
    elements.inspectionBody.replaceChildren(element('p', '', message));
  }

  function cardButton(card) {
    var button = element('button', 'card');
    button.type = 'button';
    button.setAttribute('aria-pressed', selectedId === card.id ? 'true' : 'false');
    var meta = element('div', 'card-meta');
    meta.appendChild(element('span', 'tag', card.family));
    meta.appendChild(element('span', 'tag tag-priority', card.priority.replace(/_/g, ' ')));
    button.appendChild(meta);
    button.appendChild(element('h3', '', card.id.replace('pattern:', '')));
    button.appendChild(element('p', '', card.summary));
    var gates = element('div', 'gate-row');
    gates.appendChild(element('span', 'gate', '● SOURCE UNPINNED'));
    gates.appendChild(element('span', 'gate', '● LICENSE BLOCKED'));
    button.appendChild(gates);
    button.addEventListener('click', function () { inspect(card); });
    return button;
  }

  function renderCards() {
    if (!report) return;
    var cards = Core.filterCards(report, {
      query: elements.query.value,
      family: elements.family.value,
      priority: elements.priority.value
    });
    if (selectedId && !cards.some(function (card) { return card.id === selectedId; })) {
      clearInspection('The previous selection is outside the active filters. Choose a visible card to inspect it.');
    }
    elements.cards.replaceChildren();
    cards.forEach(function (card) { elements.cards.appendChild(cardButton(card)); });
    if (!cards.length) elements.cards.appendChild(element('p', 'empty', 'No pattern cards match these filters.'));
    elements.metricVisible.textContent = cards.length;
  }

  function machineSummary(value) {
    return {
      schema: value.schema,
      status: value.status,
      reportDigest: value.reportDigest,
      input: value.input,
      summary: value.summary,
      truth: value.truth,
      cardIndex: value.cards.map(function (card) {
        return { id: card.id, semanticDigest: card.semanticDigest, reuseDecision: card.license.reuseDecision };
      })
    };
  }

  async function start() {
    elements = {
      cards: byId('patterns'),
      query: byId('query'),
      family: byId('family'),
      priority: byId('priority'),
      metricCards: byId('metric-cards'),
      metricUnpinned: byId('metric-unpinned'),
      metricLicenses: byId('metric-licenses'),
      metricVisible: byId('metric-visible'),
      reportDigest: byId('report-digest'),
      inspectionTitle: byId('inspection-title'),
      inspectionBody: byId('inspection-body'),
      machineOutput: byId('machine-output'),
      fatal: byId('fatal')
    };
    if (!Core) throw new Error('External Pattern Observatory core is unavailable.');
    var response = await fetch('data/source-reported-matrix.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the local research matrix (' + response.status + ').');
    var matrix = await response.json();
    report = await Core.compileMatrix(matrix, {
      sourcePackSha256: '5960f537fbc0def1d5014ca8ea4b1813c03e36141a3a20207794aec8c3be630f'
    });
    elements.metricCards.textContent = report.summary.cards;
    elements.metricUnpinned.textContent = report.summary.sourceUnpinned;
    elements.metricLicenses.textContent = report.summary.licenseReuseBlocked;
    elements.reportDigest.textContent = report.reportDigest;
    elements.machineOutput.textContent = JSON.stringify(machineSummary(report), null, 2);
    addOptions(elements.family, unique(report.cards.map(function (card) { return card.family; })));
    addOptions(elements.priority, unique(report.cards.map(function (card) { return card.priority; })));
    document.getElementById('filters').addEventListener('input', renderCards);
    renderCards();
  }

  start().catch(function (error) {
    var fatal = byId('fatal');
    fatal.hidden = false;
    fatal.textContent = error && error.message ? error.message : String(error);
  });
})();
