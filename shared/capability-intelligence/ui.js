(function () {
  'use strict';

  const root = document.documentElement;
  const moduleId = root.dataset.module;
  const base = '../../shared/capability-intelligence/';

  function text(id, value, fallback) {
    const node = document.getElementById(id);
    if (node) node.textContent = value == null || value === '' ? (fallback || 'UNKNOWN') : String(value);
  }

  function list(id, values, fallback) {
    const node = document.getElementById(id);
    if (!node) return;
    node.replaceChildren();
    const entries = values && values.length ? values : [fallback || 'None declared.'];
    entries.forEach(value => {
      const item = document.createElement('li');
      item.textContent = String(value);
      node.appendChild(item);
    });
  }

  function fetchJson(path) {
    return fetch(path, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(path + ' returned ' + response.status);
      return response.json();
    });
  }

  function addCopy(parent, tag, value, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null || value === '' ? 'UNKNOWN' : String(value);
    parent.appendChild(node);
    return node;
  }

  function addFieldList(parent, title, values, fallback) {
    addCopy(parent, 'h4', title);
    const items = values && values.length ? values : [fallback || 'None declared.'];
    const node = document.createElement('ul');
    items.forEach(value => addCopy(node, 'li', value));
    parent.appendChild(node);
  }

  function sourceLinks(id, rows, fallback) {
    const node = document.getElementById(id);
    if (!node) return;
    node.replaceChildren();
    const sources = [];
    (rows || []).forEach(row => {
      if (!row || sources.some(source => source.source_id === row.source_id)) return;
      sources.push(row);
    });
    if (!sources.length) {
      const item = document.createElement('li');
      item.textContent = fallback || 'No source is currently applicable.';
      node.appendChild(item);
      return;
    }
    sources.forEach(source => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = source.source_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.source_title;
      const kind = document.createElement('small');
      kind.textContent = source.source_class.replaceAll('_', ' ').toLowerCase();
      item.append(link, kind);
      node.appendChild(item);
    });
  }

  function readableTime(value) {
    if (!value) return 'Not checked yet';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  }

  function worldFit(item) {
    return item && item.module2 && item.module2.world_fit ? item.module2.world_fit : {
      state: 'FRESHNESS_UNKNOWN',
      applicable_signal_count: 0,
      applicable_source_count: 0,
      applicable_signals: [],
      change_source_ids: [],
      unavailable_source_ids: [],
      contextual_signal_ids_held: [],
      last_checked_at: null
    };
  }

  function setupModulePicker(catalog, onSelect) {
    const search = document.getElementById('moduleSearch');
    const chooser = document.getElementById('moduleChooser');
    const count = document.getElementById('moduleMatchCount');
    const empty = document.getElementById('moduleEmpty');
    const body = document.getElementById('moduleResultBody') || document.getElementById('capabilityPreview');
    const items = (catalog.items || []).slice();
    let preferred = moduleId;

    function choose(item) {
      if (!item) return;
      preferred = item.module_id;
      onSelect(item);
    }

    function refresh() {
      const query = search ? search.value.trim().toLowerCase() : '';
      const matches = items.filter(item => [
        item.module_id,
        item.module_name,
        item.module1 && item.module1.plain_explanation,
        item.module1 && item.module1.why_it_matters
      ].join(' ').toLowerCase().includes(query));

      chooser.replaceChildren();
      matches.forEach(item => {
        const option = document.createElement('option');
        option.value = item.module_id;
        option.textContent = item.module_name + ' · ' + item.status;
        chooser.appendChild(option);
      });
      chooser.disabled = matches.length === 0;
      if (count) count.textContent = query
        ? matches.length + ' matching module' + (matches.length === 1 ? '' : 's') + ' · ' + items.length + ' verified total'
        : items.length + ' verified modules · ' + catalog.source.declared_capabilities + ' declared capabilities';
      if (empty) empty.hidden = matches.length !== 0;
      if (body) body.hidden = matches.length === 0;
      if (!matches.length) return;

      const selected = matches.find(item => item.module_id === preferred) || matches[0];
      chooser.value = selected.module_id;
      choose(selected);
    }

    if (search) search.addEventListener('input', refresh);
    chooser.addEventListener('change', () => choose(items.find(item => item.module_id === chooser.value)));
    refresh();
  }

  function loadStatus() {
    return fetchJson(base + 'status.json').then(status => {
      const module = (status.modules || []).find(item => item.id === moduleId);
      const statusLabels = {
        INTEGRATED_WITH_NATIVE_CONTRACT_HOLD: 'INTEGRATED · NATIVE HOLD',
        WORKING_WITH_CONTRACT_HOLD: 'WORKING · NATIVE HOLD'
      };
      text('moduleVersion', module && module.version);
      text('moduleState', module && module.status);
      text('platformState', statusLabels[status.overall] || status.overall);
      text('contractState', status.contract_seam && status.contract_seam.overall);
      text('mergeState', status.merge_gate && status.merge_gate.status);
      text('adapterState', status.platform_adapter && status.platform_adapter.status);
      text('statusDigest', status.status_sha256);
    });
  }

  function setupAtlas(catalog, receipt) {
    const filter = document.getElementById('detailFilter');
    const view = document.getElementById('capabilityView');
    let currentItem = null;

    function renderView() {
      if (!currentItem || !view) return;
      const card = currentItem.module1 || {};
      const selected = filter ? filter.value : 'quick';
      view.replaceChildren();
      if (selected === 'quick') {
        addCopy(view, 'h4', 'Quick truth check');
        addCopy(view, 'p', currentItem.status + ' registry record · ' + currentItem.risk + ' risk. This guide explains declared purpose; it does not prove live behavior or grant authority.');
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Read full source-grounded context';
        details.appendChild(summary);
        addCopy(details, 'p', card.why_it_matters);
        view.appendChild(details);
      } else if (selected === 'practical') {
        addFieldList(view, 'What it needs', card.inputs, 'No inputs declared.');
        addFieldList(view, 'What it produces', card.outputs, 'No outputs declared.');
        addFieldList(view, 'Limits to keep visible', card.known_limitations, 'No limitations declared.');
      } else {
        addCopy(view, 'h4', 'Source-bound identity');
        const details = document.createElement('dl');
        details.className = 'inline-metadata';
        [
          ['Capability ID', card.capability_id],
          ['Capability record SHA-256', card.capability_record_sha256],
          ['Manifest', currentItem.source && currentItem.source.manifest],
          ['Manifest SHA-256', currentItem.source && currentItem.source.manifest_sha256]
        ].forEach(([label, value]) => {
          const row = document.createElement('div');
          addCopy(row, 'dt', label);
          addCopy(row, 'dd', value);
          details.appendChild(row);
        });
        view.appendChild(details);
        addFieldList(view, 'Unknown fields', card.unknown_fields, 'No material unknown fields declared.');
        addCopy(view, 'p', 'This record is advisory TEST material. It does not prove runtime behavior, execute work, or grant CANON.', 'truth-note');
      }
    }

    function render(item) {
      currentItem = item;
      const card = item.module1 || {};
      text('module1Proof', catalog.coverage.guided_modules + ' source-bound guides');
      text('capabilityName', card.human_name);
      text('capabilityExplanation', card.plain_explanation);
      text('capabilityRisk', item.risk);
      text('capabilityMaturity', item.status);
      text('capabilitySource', item.source && item.source.manifest_sha256);
      text('pipelineReceipt', receipt.receipt_sha256);
      const world = worldFit(item);
      text('atlasWorldState', world.state);
      text('atlasWorldSummary', world.applicable_signal_count + ' advisory checks from ' + world.applicable_source_count + ' relevant official sources. Context-specific design systems stay held unless the module declares that platform.');
      list('atlasWorldSignals', world.applicable_signals.slice(0, 4).map(signal => signal.fit_check), 'No applicable world-interface checks are available.');
      renderView();
    }

    if (filter) filter.addEventListener('change', renderView);
    setupModulePicker(catalog, render);
  }

  function setupInterface(catalog) {
    setupModulePicker(catalog, item => {
      const result = item.module2 || {};
      const proven = item.truth && item.truth.interface_implementation_proven;
      text('module2Proof', result.assurance_status + ' assurance');
      text('patternName', result.interface_name || 'No safe interface selected');
      text('patternId', result.interface_pattern_id || 'NONE');
      text('recommendationState', result.recommendation_status);
      text('recommendationConfidence', 'Confidence ' + result.confidence);
      text('applicationState', proven ? 'VERIFIED' : 'NOT VERIFIED');
      text('applicationNote', proven ? 'Live implementation evidence retained' : 'Recommendation only · native UI still needs proof');
      list('recommendationWhy', result.why, 'Missing information prevents a safe recommendation.');
      list('requiredControls', result.required_controls, 'No controls recommended until missing information is resolved.');
      const world = worldFit(item);
      text('worldFitState', world.state);
      const held = world.contextual_signal_ids_held.length;
      text('worldFitSummary', world.applicable_signal_count + ' advisory checks apply from ' + world.applicable_source_count + ' official sources. ' + held + ' ecosystem-specific signal' + (held === 1 ? ' is' : 's are') + ' held until matching platform context is declared.');
      list('worldFitChecks', world.applicable_signals.slice(0, 6).map(signal => signal.fit_check), 'No world-interface checks apply to this pattern yet.');
      sourceLinks('worldFitSources', world.applicable_signals, 'No relevant official source is currently bound.');
    });
  }

  function setupEvolution(catalog, receipt) {
    setupModulePicker(catalog, item => {
      const result = item.module3 || {};
      const world = worldFit(item);
      text('module3Proof', result.gap_state === 'GUIDANCE_READY' ? 'GUIDANCE READY' : 'REVIEW REQUIRED');
      text('signalCount', '1 module signal · ' + world.applicable_signal_count + ' world-fit checks');
      text('needCandidate', result.candidate_id || 'None · guidance ready');
      text('candidateNote', result.candidate_id ? 'A review proposal, never an automatic need.' : 'No new candidate is needed for this guidance-ready record.');
      text('authorityState', result.authority_granted ? 'REVIEW' : 'CLOSED');
      text('signalChain', receipt.module_chain.module3.signal_chain_head);
      text('module23Digest', item.module2 && item.module2.recommendation_sha256);
      text('worldChangeState', world.state);
      text('worldSourceCount', world.applicable_source_count + ' sources · ' + world.applicable_signal_count + ' checks');
      text('worldCheckedAt', readableTime(world.last_checked_at));
      if (world.state === 'REVIEW_REQUIRED') {
        text('worldChangeSummary', 'A relevant official source changed since its comparison baseline. Applicability review is required; no interface change was applied.');
      } else if (world.state === 'FRESHNESS_UNKNOWN') {
        text('worldChangeSummary', 'One or more relevant sources could not be refreshed. Existing guidance remains advisory and freshness is unknown.');
      } else {
        text('worldChangeSummary', 'Relevant official sources match their observed comparison baselines. Repeated unchanged checks are aggregated.');
      }
      sourceLinks('worldChangeSources', world.applicable_signals, 'No relevant official source is currently bound.');
    });
  }

  function loadPlatformGuidance() {
    return Promise.all([
      fetchJson(base + 'generated/platform-usability/catalog.json'),
      fetchJson(base + 'generated/platform-usability/coverage-receipt.json')
    ]).then(([catalog, receipt]) => {
      if (moduleId === 'human-capability-atlas') setupAtlas(catalog, receipt);
      if (moduleId === 'human-interface-intelligence') setupInterface(catalog, receipt);
      if (moduleId === 'grounded-evolution-intelligence') setupEvolution(catalog, receipt);
    });
  }

  Promise.allSettled([loadStatus(), loadPlatformGuidance()]).then(results => {
    const errors = results.filter(result => result.status === 'rejected');
    if (errors.length) {
      text('platformState', 'EVIDENCE UNAVAILABLE');
      text('module1Proof', 'Run pipeline');
      text('module2Proof', 'Run pipeline');
      text('module3Proof', 'Run pipeline');
    }
  });
}());
