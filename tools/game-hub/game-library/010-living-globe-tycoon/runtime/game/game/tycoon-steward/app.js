(function () {
  'use strict';

  var STORAGE_KEY = 'axm.tycoon-steward.v0.1.palace-polish-v1';
  var PRIOR_STORAGE_KEY = 'axm.tycoon-steward.v0.1.emergence-memory-v1';
  var LEGACY_STORAGE_KEY = 'axm.tycoon-steward.v0.1';
  var PRIOR_IGNORE_KEY = 'axm.tycoon-steward.v0.1.palace-polish-ignore-prior';
  var LEGACY_IGNORE_KEY = 'axm.tycoon-steward.v0.1.palace-polish-ignore-legacy';
  var STARTER_SEED = 'axm-hearth-001';
  var selectedCells = new Set();
  var pendingProposal = null;
  var engine = window.AXMTycoonSteward.createSteward(STARTER_SEED);
  var painting = false;
  var hostBridgePacket = null;
  var toastSequence = 0;

  function byId(id) { return document.getElementById(id); }
  function state() { return engine.observeState(); }
  function reason(fallback) { return byId('reasonInput').value.trim() || fallback; }
  function nextDecisionId(label) { return 'ui-' + label + '-r' + state().revision + '-t' + state().turn; }
  function clearNode(node) { node.replaceChildren(); }
  function textNode(tag, value, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = String(value == null ? '' : value);
    return node;
  }
  function button(label, action, className) {
    var node = document.createElement('button');
    node.type = 'button'; node.textContent = label;
    if (className) node.className = className;
    node.addEventListener('click', action);
    return node;
  }
  function showToast(title, detail, tone, icon) {
    var harbor = byId('toastHarbor'); if (!harbor) return;
    var toast = document.createElement('div'); toast.className = 'island-toast' + (tone === 'error' ? ' error' : '');
    toast.dataset.icon = icon || (tone === 'error' ? '!' : '☀'); toast.dataset.toastId = String(++toastSequence);
    toast.appendChild(textNode('strong', title)); toast.appendChild(textNode('span', detail || 'The island keeps the receipt.'));
    harbor.appendChild(toast); while (harbor.children.length > 3) harbor.firstElementChild.remove();
    window.setTimeout(function () { toast.classList.add('leaving'); window.setTimeout(function () { toast.remove(); }, 300); }, 2800);
  }
  function setStatus(message, isError) {
    var node = byId('statusMessage');
    node.textContent = message;
    node.classList.toggle('error', !!isError);
    node.classList.remove('fresh'); void node.offsetWidth; node.classList.add('fresh');
  }
  function resultMessage(result, success) {
    if (result.ok) { setStatus(success || 'Decision recorded with a receipt.', false); return true; }
    var refused = (result.errors || []).map(function (error) { return error.message || error; }).join(' · ') || 'Action refused.';
    setStatus(refused, true); showToast('Palace clerk says no', refused, 'error', '✕');
    return false;
  }
  function celebrateDecision(type) {
    var moments = {
      PAINT_ZONE: ['New direction painted', 'Buildings still have to earn their way in.', '🖌'],
      ALLOCATE: ['Envelope funded', 'Real stock is reserved; exact development remains emergent.', '¤'],
      SET_POLICY: ['Compass adjusted', 'New candidates will feel the priority and its constraints.', '🧭'],
      CAPTURE_EMERGENCE: ['Lightning bottled', 'A real emerged pattern is remembered as evidence, not copied.', '✦'],
      APPLY_GOAL_LAYER: ['Goal layer raised', 'Selected cells can learn from the pattern without skipping costs.', '⚑'],
      SET_GOAL_LAYER_MODE: ['Goal mode changed', 'The same evidence now follows the new Preserve or Evolve instruction.', '↗'],
      RETIRE_GOAL_LAYER: ['Overlay retired', 'Its evidence and history remain in the palace files.', '✓'],
      REPAIR_DISTRICT: ['Repair crew dispatched', 'The recorded cause was addressed; the district keeps its history.', '🔧']
    };
    var moment = moments[type]; if (moment) showToast(moment[0], moment[1], 'good', moment[2]);
  }
  function applyDecision(type, payload, label, fallbackReason) {
    var result = engine.applyStewardDecision({
      schema: window.AXMTycoonSteward.DECISION_SCHEMA,
      id: nextDecisionId(label),
      type: type,
      expectedRevision: state().revision,
      reason: reason(fallbackReason),
      payload: payload
    }, { actor: { id: 'local-human-steward', type: 'HUMAN', displayName: 'Local steward' } });
    if (resultMessage(result)) { pendingProposal = null; render(); celebrateDecision(type); }
    return result;
  }

  function renderMeta(current) {
    byId('turnValue').textContent = current.turn;
    byId('revisionValue').textContent = current.revision;
    byId('seedValue').textContent = 'Seed ' + current.seed;
    byId('policyPriority').value = current.policies.priority;
    byId('protectNatureCheck').checked = current.policies.constraints.protectNature;
    byId('natureOverrideCheck').checked = current.policies.constraints.natureRouteOverride;
  }

  function terrainMark(kind) {
    return { MEADOW: 'meadow', CLAY: 'clay', WOODLAND: 'woodland', WETLAND: 'wetland', RIDGE: 'ridge' }[kind] || kind.toLowerCase();
  }
  function mapGlyph(cell, structure) {
    if (structure) return { HOUSING: '⌂', INDUSTRY: '⚙', ENTERTAINMENT: '♪', NATURE: '♣', INFRASTRUCTURE: '↔', NEUTRAL: '★' }[structure.category] || '◆';
    return { MEADOW: '·', CLAY: '●', WOODLAND: '♣', WETLAND: '≈', RIDGE: '▲' }[cell.terrain.kind] || '·';
  }
  function renderMap(current) {
    var grid = byId('regionGrid'); clearNode(grid);
    current.map.cells.forEach(function (cell) {
      var node = document.createElement('button');
      node.type = 'button'; node.className = 'map-cell'; node.dataset.zone = cell.zone; node.dataset.terrain = cell.terrain.kind; node.setAttribute('role', 'gridcell');
      var goalLayer = current.emergenceMemory.goalLayers.filter(function (layer) { return layer.status !== 'RETIRED' && layer.cellIds.indexOf(cell.id) >= 0; })[0] || null;
      node.classList.toggle('selected', selectedCells.has(cell.id)); node.classList.toggle('protected', cell.protected);
      node.classList.toggle('goal-target', !!goalLayer); node.classList.toggle('goal-preserve', !!goalLayer && goalLayer.mode === 'PRESERVE'); node.classList.toggle('goal-evolve', !!goalLayer && goalLayer.mode === 'EVOLVE');
      node.setAttribute('aria-pressed', selectedCells.has(cell.id) ? 'true' : 'false');
      node.setAttribute('aria-label', cell.id + ', ' + cell.zone + ', ' + cell.terrain.kind + (cell.protected ? ', protected' : '') + (goalLayer ? ', captured goal ' + goalLayer.mode + ', progress ' + goalLayer.progress.percent + '%' : ''));
      node.appendChild(textNode('span', cell.x + ',' + cell.y, 'cell-coordinate'));
      node.appendChild(textNode('span', terrainMark(cell.terrain.kind), 'cell-terrain'));
      var deposits = current.supplyChain.deposits[cell.id], strongest = Object.keys(deposits).sort(function (a, b) { return deposits[b].quality - deposits[a].quality || a.localeCompare(b); })[0];
      node.appendChild(textNode('span', strongest + ' ' + Math.round(deposits[strongest].quality), 'cell-deposit'));
      var structure = current.structures.filter(function (item) { return cell.structureIds.indexOf(item.id) >= 0; })[0];
      node.classList.toggle('has-structure', !!structure);
      node.appendChild(textNode('span', structure ? structure.label : cell.zone.toLowerCase(), 'cell-content'));
      var glyph = textNode('span', mapGlyph(cell, structure), 'cell-glyph'); glyph.setAttribute('aria-hidden', 'true'); node.appendChild(glyph);
      if (goalLayer) node.appendChild(textNode('span', goalLayer.mode === 'PRESERVE' ? '◎ hold ' + goalLayer.progress.percent + '%' : '↗ evolve ' + goalLayer.progress.percent + '%', 'cell-goal'));
      if (cell.roadIds.length) node.appendChild(textNode('span', '', 'cell-road'));
      function choose(event) {
        if (event) event.preventDefault();
        if (selectedCells.has(cell.id)) selectedCells.delete(cell.id); else selectedCells.add(cell.id);
        inspectCell(cell.id); renderMap(state()); renderSelection();
      }
      node.addEventListener('pointerdown', function (event) { painting = true; choose(event); });
      node.addEventListener('pointerenter', function (event) {
        if (!painting || event.buttons === 0 || selectedCells.has(cell.id)) return;
        selectedCells.add(cell.id); renderMap(state()); renderSelection();
      });
      node.addEventListener('click', function (event) { if (event.detail === 0) choose(event); });
      grid.appendChild(node);
    });
  }
  function renderSelection() { byId('selectionCount').textContent = selectedCells.size + (selectedCells.size === 1 ? ' cell selected' : ' cells selected'); }

  function prettyName(name) {
    return String(name).replace(/([A-Z])/g, ' $1').replace(/^./, function (char) { return char.toUpperCase(); });
  }
  function renderVitals(current) {
    var list = byId('vitalsList'); clearNode(list);
    window.AXMTycoonConsequences.VITALS.forEach(function (name) {
      var row = document.createElement('div'); row.className = 'vital-row';
      row.appendChild(textNode('b', prettyName(name)));
      var meter = document.createElement('div'); meter.className = 'meter'; meter.setAttribute('aria-hidden', 'true');
      var fill = document.createElement('span'); fill.style.width = current.vitals[name] + '%'; meter.appendChild(fill); row.appendChild(meter);
      var output = document.createElement('output'); output.textContent = current.vitals[name]; row.appendChild(output); list.appendChild(row);
    });
  }
  function renderResources(current) {
    var list = byId('resourceList'); clearNode(list);
    window.AXMTycoonLedger.RESOURCE_ORDER.forEach(function (name) {
      var item = current.resources[name], row = document.createElement('div'); row.className = 'resource-row';
      row.appendChild(textNode('b', prettyName(name))); row.appendChild(textNode('span', item.available + ' available'));
      row.appendChild(textNode('small', item.stock + ' stock · ' + item.reserved + ' reserved · ' + item.committed + ' committed · ' + item.unit));
      list.appendChild(row);
    });
  }
  function renderSupply(current) {
    var supply = current.supplyChain, list = byId('supplyList'); clearNode(list);
    byId('supplyPriceIndex').textContent = 'product index ' + supply.pricesIndex;
    byId('supplyHeadline').textContent = supply.lastQuarter.headline + ' Typed surplus is prepared, never exported automatically.';
    window.AXMTycoonSupply.GOOD_ORDER.slice().sort(function (a, b) {
      var aa = supply.goods[a], bb = supply.goods[b]; return bb.price / bb.referencePrice - aa.price / aa.referencePrice || a.localeCompare(b);
    }).forEach(function (id) {
      var item = supply.goods[id], row = document.createElement('button'); row.type = 'button'; row.className = 'supply-row';
      row.appendChild(textNode('b', item.label)); row.appendChild(textNode('span', item.stock + '/' + item.capacity + ' · ¤' + item.price));
      row.appendChild(textNode('small', prettyName(item.stage) + (item.lastShortfall ? ' · short ' + item.lastShortfall : item.lastProduced ? ' · made ' + item.lastProduced : ' · steady')));
      row.addEventListener('click', function () { byId('inspectorPanel').textContent = item.label + '\nStock ' + item.stock + '/' + item.capacity + '\nPrice ¤' + item.price + ' · reference ¤' + item.referencePrice + '\nProduced ' + item.lastProduced + ' · consumed ' + item.lastConsumed + ' · unfilled ' + item.lastShortfall; });
      list.appendChild(row);
    });
    byId('tradeReadyLine').textContent = supply.tradeReady.length ? supply.tradeReady.length + ' lots ready for later trade: ' + supply.tradeReady.slice(0, 4).map(function (lot) { return lot.label + ' ' + lot.quantity; }).join(' · ') : 'No typed product is above its protected trade reserve.';
  }
  function renderNeeds(current) {
    var list = byId('needsList'); clearNode(list);
    current.needs.slice(0, 6).forEach(function (need) {
      var card = document.createElement('div'); card.className = 'need-card';
      var head = document.createElement('div'); head.className = 'need-head'; head.appendChild(textNode('strong', need.rank + '. ' + need.label)); head.appendChild(textNode('span', 'pressure ' + need.pressure)); card.appendChild(head);
      card.appendChild(textNode('p', need.evidence.map(function (entry) { return entry.metric + ': ' + entry.value; }).join(' · ')));
      var details = document.createElement('details'); details.appendChild(textNode('summary', 'What could disconfirm this?'));
      details.appendChild(textNode('p', need.couldBeDisconfirmedBy.join(' '))); card.appendChild(details); list.appendChild(card);
    });
  }

  function renderPatterns(current) {
    var memory = current.emergenceMemory;
    byId('patternHeadline').textContent = memory.headline;
    var sourceSelect = byId('patternSourceDistrict'), priorSource = sourceSelect.value; clearNode(sourceSelect);
    current.districts.forEach(function (district) {
      var emerged = current.structures.filter(function (structure) { return structure.districtId === district.id && structure.createdTurn > 0 && structure.lifecycle !== 'FAILED'; }).length;
      var option = document.createElement('option'); option.value = district.id; option.textContent = district.name + ' · ' + emerged + ' observed emergence' + (emerged === 1 ? '' : 's') + ' · ' + district.lifecycleState; sourceSelect.appendChild(option);
    });
    if (current.districts.some(function (district) { return district.id === priorSource; })) sourceSelect.value = priorSource;

    var patternSelect = byId('goalPattern'), priorPattern = patternSelect.value; clearNode(patternSelect);
    memory.patterns.forEach(function (pattern) { var option = document.createElement('option'); option.value = pattern.id; option.textContent = pattern.label + ' · ' + pattern.profile.sourceStructureCount + ' roles'; patternSelect.appendChild(option); });
    if (memory.patterns.some(function (pattern) { return pattern.id === priorPattern; })) patternSelect.value = priorPattern;
    byId('applyGoalButton').disabled = !memory.patterns.length;

    var patternList = byId('patternList'); clearNode(patternList);
    if (!memory.patterns.length) patternList.appendChild(textNode('div', 'First let at least one post-starter structure emerge in an operating district. Then capture what made that district work.', 'empty'));
    memory.patterns.slice().reverse().forEach(function (pattern) {
      var card = document.createElement('div'); card.className = 'pattern-card';
      card.appendChild(textNode('strong', pattern.label));
      card.appendChild(textNode('p', pattern.sourceDistrictName + ' · captured T' + pattern.capturedTurn + ' · density ' + Math.round(pattern.profile.density * 100) + '%'));
      card.appendChild(textNode('small', pattern.profile.structureMix.map(function (row) { return row.label + ' ×' + row.count; }).join(' · ')));
      card.appendChild(button('Inspect evidence', function () { inspect(pattern.id); }, 'quiet'));
      patternList.appendChild(card);
    });

    var layerList = byId('goalLayerList'); clearNode(layerList);
    var active = memory.goalLayers.filter(function (layer) { return layer.status !== 'RETIRED'; });
    if (!active.length) layerList.appendChild(textNode('div', 'No active goal overlay. Capturing alone never changes another zone.', 'empty'));
    active.slice().reverse().forEach(function (layer) {
      var card = document.createElement('div'); card.className = 'goal-card'; card.dataset.mode = layer.mode;
      var head = document.createElement('div'); head.className = 'goal-head'; head.appendChild(textNode('strong', layer.label)); head.appendChild(textNode('span', layer.progress.percent + '%')); card.appendChild(head);
      card.appendChild(textNode('p', layer.status + ' · ' + layer.cellIds.length + ' cells · ' + layer.progress.matched + '/' + layer.progress.target + ' functional roles'));
      card.appendChild(textNode('small', layer.progress.explanation));
      var actions = document.createElement('div'); actions.className = 'goal-actions';
      actions.appendChild(button('Inspect', function () { inspect(layer.id); }, 'quiet'));
      actions.appendChild(button(layer.mode === 'PRESERVE' ? 'Let it evolve' : 'Preserve here', function () {
        applyDecision('SET_GOAL_LAYER_MODE', { layerId: layer.id, mode: layer.mode === 'PRESERVE' ? 'EVOLVE' : 'PRESERVE' }, 'goal-mode-' + layer.id, layer.mode === 'PRESERVE' ? 'Allow this captured baseline to evolve beyond itself.' : 'Preserve this goal at its captured functional baseline.');
      }));
      actions.appendChild(button('Retire overlay', function () { applyDecision('RETIRE_GOAL_LAYER', { layerId: layer.id }, 'goal-retire-' + layer.id, 'Retire this goal overlay while keeping its evidence.'); }, 'danger'));
      card.appendChild(actions); layerList.appendChild(card);
    });
  }

  function inspect(id) {
    var explanation = engine.explainChange(id);
    byId('inspectorPanel').textContent = explanation.readable + (explanation.data ? '\n\n' + window.AXMTycoonCanonical.stableStringify(explanation.data) : '');
  }
  function inspectCell(cellId) {
    var current = state(), cell = current.map.cells.filter(function (item) { return item.id === cellId; })[0];
    var structure = cell.structureIds.length ? current.structures.filter(function (item) { return item.id === cell.structureIds[0]; })[0] : null;
    if (structure) { inspect(structure.id); return; }
    var district = current.districts.filter(function (item) { return item.id === cell.districtId; })[0];
    var deposits = current.supplyChain.deposits[cell.id];
    var layer = current.emergenceMemory.goalLayers.filter(function (entry) { return entry.status !== 'RETIRED' && entry.cellIds.indexOf(cell.id) >= 0; })[0];
    byId('inspectorPanel').textContent = cell.id + ' · ' + cell.zone + '\n' + cell.terrain.kind + ' · slope ' + cell.terrain.slope + ' · habitat ' + cell.terrain.habitat + '\nUnderfoot: ' + Object.keys(deposits).sort(function (a, b) { return deposits[b].quality - deposits[a].quality || a.localeCompare(b); }).map(function (id) { return id + ' quality ' + deposits[id].quality + ' · remaining ' + deposits[id].remaining; }).join('\n') + '\nDistrict: ' + district.name + ' (' + district.lifecycleState + ')' + (cell.protected ? '\nProtected terrain constraint is active.' : '') + (layer ? '\nGoal overlay: ' + layer.label + ' · ' + layer.status + ' · ' + layer.progress.percent + '%\nThis remains guidance, never a cost or zone exemption.' : '');
  }

  function renderDistricts(current) {
    var list = byId('districtList'); clearNode(list);
    current.districts.forEach(function (district) {
      var card = document.createElement('div'); card.className = 'district-card';
      var head = document.createElement('div'); head.className = 'district-head'; head.appendChild(textNode('strong', district.name)); head.appendChild(textNode('span', district.lifecycleState, 'district-state')); card.appendChild(head);
      card.appendChild(textNode('p', 'Stress ' + district.stress + (district.failureCause ? ' · cause ' + district.failureCause : '') + ' · ' + district.history.length + ' retained history entries'));
      var actions = document.createElement('div'); actions.className = 'district-actions';
      actions.appendChild(button('Inspect', function () { inspect(district.id); }, 'quiet'));
      if (!district.held) actions.appendChild(button('Hold', function () { applyDecision('HOLD_DISTRICT', { districtId: district.id }, 'hold-' + district.id, 'Hold this district for review.'); }));
      if (district.held) actions.appendChild(button('Release', function () { applyDecision('RELEASE_DISTRICT', { districtId: district.id }, 'release-' + district.id, 'Release this district with its history intact.'); }));
      if (!district.held && ['FAILED', 'STALLED'].indexOf(district.lifecycleState) >= 0 && district.failureCause) actions.appendChild(button('Repair cause', function () { applyDecision('REPAIR_DISTRICT', { districtId: district.id, addressedCause: district.failureCause }, 'repair-' + district.id, 'Repair the recorded cause ' + district.failureCause + '.'); }, 'primary'));
      card.appendChild(actions); list.appendChild(card);
    });
  }

  function renderReceipts(current) {
    var list = byId('receiptList'); clearNode(list);
    var receipts = current.receipts.slice(-8).reverse();
    if (!receipts.length) { list.appendChild(textNode('div', 'No receipt yet. Decisions and turns append here.', 'empty')); return; }
    receipts.forEach(function (receipt) {
      var card = document.createElement('div'); card.className = 'receipt-card'; card.tabIndex = 0;
      var head = document.createElement('div'); head.className = 'receipt-head'; head.appendChild(textNode('strong', receipt.kind)); head.appendChild(textNode('span', 'T' + receipt.logicalTurn + ' · #' + receipt.sequence)); card.appendChild(head);
      card.appendChild(textNode('p', receipt.readableExplanation.slice(1, 3).join(' ')));
      card.addEventListener('click', function () { inspect(receipt.receiptId); });
      card.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspect(receipt.receiptId); } });
      list.appendChild(card);
    });
  }

  function renderNovelty(current) {
    var list = byId('noveltyList'); clearNode(list);
    current.noveltyReview.forEach(function (item) {
      var card = document.createElement('div'); card.className = 'novelty-card';
      card.appendChild(textNode('strong', item.label));
      card.appendChild(textNode('p', item.status + ' · proposed bindings: ' + window.AXMTycoonCanonical.stableStringify(item.proposedEffects)));
      var actions = document.createElement('div'); actions.className = 'novelty-actions'; actions.appendChild(button('Inspect', function () { inspect(item.id); }, 'quiet'));
      if (item.status === 'UNSCORED_REVIEW_REQUIRED') {
        actions.appendChild(button('Approve shown bindings', function () { applyDecision('REVIEW_NOVELTY', { noveltyId: item.id, action: 'APPROVE', metricBindings: item.proposedEffects }, 'approve-' + item.id, 'Approve these visible bounded bindings for later proposals.'); }));
        actions.appendChild(button('Reject and retain', function () { applyDecision('REVIEW_NOVELTY', { noveltyId: item.id, action: 'REJECT' }, 'reject-' + item.id, 'Reject this novelty while retaining its review history.'); }, 'danger'));
      }
      card.appendChild(actions); list.appendChild(card);
    });
  }

  function renderProposal() {
    var panel = byId('proposalPanel'), accept = byId('acceptAllocationButton');
    if (!pendingProposal) { panel.textContent = 'No allocation proposal yet. Previewing never spends.'; accept.disabled = true; return; }
    panel.textContent = (pendingProposal.affordable ? 'Affordable preview.' : 'Not currently affordable.') + '\nKnown candidates: ' + pendingProposal.forecastRange.knownCandidateTypes.join(', ') + '\nGuarantee: 0 automatic developments.\n' + pendingProposal.assumptions.join('\n') + (pendingProposal.warnings.length ? '\nWarnings: ' + pendingProposal.warnings.join(' ') : '');
    accept.disabled = !pendingProposal.affordable || pendingProposal.errors.length > 0;
  }

  function render() {
    var current = state(); renderMeta(current); renderMap(current); renderSelection(); renderVitals(current); renderResources(current); renderSupply(current); renderNeeds(current); renderDistricts(current); renderPatterns(current); renderReceipts(current); renderNovelty(current); renderProposal(); renderHostBridge();
  }

  function allocationAmounts() {
    var values = {
      population: Number(byId('allocationPopulation').value), energy: Number(byId('allocationEnergy').value), materials: Number(byId('allocationMaterials').value),
      funds: Number(byId('allocationFunds').value), attention: Number(byId('allocationAttention').value)
    };
    var out = {}; Object.keys(values).forEach(function (name) { if (values[name] > 0) out[name] = values[name]; }); return out;
  }
  function advance(count) {
    var before = state(), priorIds = new Set(before.structures.map(function (item) { return item.id; }));
    var result = engine.advanceTurn({ count: count, expectedRevision: state().revision, actionId: 'ui-advance-' + count + '-r' + state().revision, actor: { id: 'local-human-steward', type: 'HUMAN' } });
    if (resultMessage(result, 'Advanced ' + count + (count === 1 ? ' turn.' : ' turns.') + ' One receipt was appended per turn.')) {
      render();
      var after = state(), emerged = after.structures.filter(function (item) { return !priorIds.has(item.id); });
      if (emerged.length) showToast('The island built ' + emerged[0].label, (emerged.length > 1 ? '+' + (emerged.length - 1) + ' more · ' : '') + 'Paid from actual products, labor and reserved resources.', 'good', '🏗');
      else showToast(count === 1 ? 'A turn passes' : count + ' turns pass', after.supplyChain.lastQuarter.headline, 'good', '🌴');
    }
  }
  function downloadJson(filename, value) {
    var blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  function reset(seed) { engine = window.AXMTycoonSteward.createSteward(seed || STARTER_SEED); selectedCells.clear(); pendingProposal = null; render(); }

  function runSample() {
    if (!window.confirm('Reset to the deterministic starter and explicitly replay the 24-turn sample? Current unsaved screen state will be replaced.')) return;
    reset('axm-sample-24');
    var actions = [
      ['sample-fund-housing', 'ALLOCATE', { zone: 'HOUSING', amounts: { population: 5, energy: 18, materials: 28, funds: 36, attention: 4 } }, 'Fund housing as a broad envelope.'],
      ['sample-fund-infrastructure', 'ALLOCATE', { zone: 'INFRASTRUCTURE', amounts: { energy: 16, materials: 28, funds: 38, attention: 4 } }, 'Fund connection and energy options.'],
      ['sample-fund-neutral', 'ALLOCATE', { zone: 'NEUTRAL', amounts: { population: 4, energy: 14, materials: 24, funds: 32, attention: 4 } }, 'Let neutral land answer visible needs.'],
      ['sample-policy', 'SET_POLICY', { priority: 'HOMES_FIRST', constraints: { protectNature: true, natureRouteOverride: false } }, 'Prioritize housing while retaining nature protection.'],
      ['sample-hold', 'HOLD_DISTRICT', { districtId: 'district-westfold' }, 'Hold the failed edge while reviewing its cause.'],
      ['sample-release', 'RELEASE_DISTRICT', { districtId: 'district-westfold' }, 'Release only for a targeted repair.'],
      ['sample-repair', 'REPAIR_DISTRICT', { districtId: 'district-westfold', addressedCause: 'ENERGY_ISOLATION' }, 'Repair the recorded energy isolation.']
    ];
    for (var i = 0; i < actions.length; i += 1) {
      var action = actions[i];
      var result = engine.applyStewardDecision({ schema: window.AXMTycoonSteward.DECISION_SCHEMA, id: action[0], type: action[1], expectedRevision: state().revision, reason: action[3], payload: action[2] }, { actor: { id: 'sample-human', type: 'HUMAN' } });
      if (!result.ok) { setStatus('Sample stopped: ' + result.errors.map(function (error) { return error.message; }).join(' · '), true); render(); return; }
    }
    var turns = engine.advanceTurn({ count: 20, actionId: 'sample-turns-01-20', actor: { id: 'sample-human', type: 'HUMAN' } });
    if (!turns.ok) { resultMessage(turns); render(); return; }
    turns = engine.advanceTurn({ count: 4, actionId: 'sample-turns-21-24', actor: { id: 'sample-human', type: 'HUMAN' } });
    if (resultMessage(turns, '24-turn sample replayed explicitly. Inspect the receipts and tradeoffs.')) render();
  }

  function hostDistricts() {
    if (!hostBridgePacket || !hostBridgePacket.hostSnapshots || !hostBridgePacket.hostSnapshots.settlements) return [];
    return hostBridgePacket.hostSnapshots.settlements.data || [];
  }
  function renderHostBridge() {
    var status = byId('hostBridgeStatus'), controls = byId('hostBridgeControls');
    if (!status || !controls) return;
    if (!hostBridgePacket) { status.textContent = 'Load a bridge packet exported by the host world. Nothing connects or applies automatically.'; controls.hidden = true; return; }
    controls.hidden = false;
    var hostSummary = hostBridgePacket.summary;
    status.textContent = 'Loaded ' + hostSummary.worldId + ' · revision ' + hostSummary.revision +
      (Number.isFinite(hostSummary.publicApproval) ? ' · approval ' + Math.round(hostSummary.publicApproval) + '%' : '') +
      (hostSummary.economy && Number.isFinite(hostSummary.economy.treasuryNet) ? ' · treasury ' + (hostSummary.economy.treasuryNet > 0 ? '+' : '') + hostSummary.economy.treasuryNet : '') +
      (hostSummary.economy && Number.isFinite(hostSummary.economy.consumerPriceIndex) ? ' · living costs ' + hostSummary.economy.consumerPriceIndex : '') +
      (Number.isFinite(hostSummary.waterQuality) ? ' · lake water ' + Math.round(hostSummary.waterQuality) + '%' : '') +
      ' · host remains authoritative.';
    var districts = hostDistricts(), prior = byId('hostDistrict').value, priorRoad = byId('hostRoadTo').value;
    clearNode(byId('hostDistrict')); clearNode(byId('hostRoadTo'));
    districts.forEach(function (district) {
      var a = document.createElement('option'); a.value = district.id; a.textContent = district.name; byId('hostDistrict').appendChild(a);
      var b = document.createElement('option'); b.value = district.id; b.textContent = district.name; byId('hostRoadTo').appendChild(b);
    });
    if (districts.some(function (district) { return district.id === prior; })) byId('hostDistrict').value = prior;
    if (districts.some(function (district) { return district.id === priorRoad; })) byId('hostRoadTo').value = priorRoad;
    if (byId('hostRoadTo').value === byId('hostDistrict').value && districts.length > 1) byId('hostRoadTo').selectedIndex = (byId('hostDistrict').selectedIndex + 1) % districts.length;
    var type = byId('hostOperation').value;
    byId('hostServiceLabel').hidden = type !== 'PROPOSE_SERVICE';
    byId('hostZoneLabel').hidden = type !== 'PROPOSE_DISTRICT';
    byId('hostRoadLabel').hidden = type !== 'PROPOSE_ROAD';
  }
  function hostOperation() {
    var type = byId('hostOperation').value, districtId = byId('hostDistrict').value;
    if (type === 'PROPOSE_SERVICE') return { type: type, payload: { districtId: districtId, service: byId('hostService').value } };
    if (type === 'PROPOSE_DISTRICT') return { type: type, payload: { districtId: districtId, zone: byId('hostZone').value } };
    if (type === 'PROPOSE_ROAD') return { type: type, payload: { fromDistrictId: districtId, toDistrictId: byId('hostRoadTo').value } };
    return { type: type, payload: { districtId: districtId } };
  }
  function exportHostProposal() {
    if (!hostBridgePacket) { setStatus('Load a host bridge packet first.', true); return; }
    var summary = hostBridgePacket.summary;
    var adapter = new window.AXMTycoonGlobeAdapter.GlobeAdapter({
      mode: 'proposal_only', worldId: summary.worldId, revision: summary.revision,
      fixture: hostBridgePacket.hostSnapshots
    });
    var operation = hostOperation();
    var input = {
      id: 'tycoon-to-host-' + state().simulationId + '-t' + state().turn + '-r' + summary.revision + '-' + operation.type.toLowerCase(),
      targetWorldId: summary.worldId,
      targetRevision: summary.revision,
      preconditions: [{ field: 'revision', equals: summary.revision }, { field: 'hostStateOwner', equals: 'living-world' }],
      requestedOperations: [operation],
      causeCostTrace: { sourceSimulationId: state().simulationId, sourceTurn: state().turn, sourceRevision: state().revision, sourceReceiptHead: state().receiptHead, visibleReason: reason('Create a host-world proposal from the Tycoon Steward ruleset.') },
      reversibilityStatement: 'The host may discard this packet. Any apply or undo is governed by the host world.',
      risks: ['The host recalculates costs, terrain constraints and ecological consequences.'],
      unknowns: ['File handoff may be stale if the host changed after export.'],
      consentReference: 'local-human-review-required'
    };
    var result = adapter.submitCityPatchProposal(input);
    if (!result.ok) { setStatus((result.errors || ['Host proposal refused.']).join(' · '), true); return; }
    downloadJson('axm-tycoon-host-proposal-rev-' + summary.revision + '.json', result.proposal);
    setStatus('Host proposal exported. It was not applied; import it in the host-world Steward console for review.', false);
  }

  function wire() {
    document.addEventListener('pointerup', function () { painting = false; });
    document.addEventListener('pointercancel', function () { painting = false; });
    byId('advanceOneButton').addEventListener('click', function () { advance(1); });
    byId('advanceFiveButton').addEventListener('click', function () { advance(5); });
    byId('sampleButton').addEventListener('click', runSample);
    byId('clearSelectionButton').addEventListener('click', function () { selectedCells.clear(); renderMap(state()); renderSelection(); });
    byId('paintButton').addEventListener('click', function () {
      if (!selectedCells.size) { setStatus('Select one or more cells first.', true); return; }
      var result = applyDecision('PAINT_ZONE', { cellIds: Array.from(selectedCells).sort(), zone: byId('brushZone').value }, 'paint', 'Paint a broad zone direction.');
      if (result.ok) selectedCells.clear(); render();
    });
    byId('previewAllocationButton').addEventListener('click', function () {
      pendingProposal = engine.proposeAllocation({ zone: byId('allocationZone').value, amounts: allocationAmounts() }, { id: 'local-human-steward', type: 'HUMAN' });
      renderProposal(); setStatus('Allocation preview created. No resource was reserved or spent.', false);
    });
    byId('acceptAllocationButton').addEventListener('click', function () {
      if (!pendingProposal) return;
      var draft = pendingProposal.decisionDraft; draft.reason = reason(draft.reason);
      var result = engine.applyStewardDecision(draft, { actor: { id: 'local-human-steward', type: 'HUMAN' } });
      if (resultMessage(result, 'Allocation reserved. Exact development remains emergent.')) { pendingProposal = null; render(); celebrateDecision('ALLOCATE'); }
    });
    byId('applyPolicyButton').addEventListener('click', function () {
      applyDecision('SET_POLICY', { priority: byId('policyPriority').value, constraints: { protectNature: byId('protectNatureCheck').checked, natureRouteOverride: byId('natureOverrideCheck').checked } }, 'policy', 'Set a visible policy direction.');
    });
    byId('capturePatternButton').addEventListener('click', function () {
      applyDecision('CAPTURE_EMERGENCE', { districtId: byId('patternSourceDistrict').value, label: byId('patternName').value }, 'capture-pattern', 'Capture this district\'s observed emergence as a causal pattern, not a cloned blueprint.');
    });
    byId('applyGoalButton').addEventListener('click', function () {
      if (!selectedCells.size) { setStatus('Select one or more target cells on the map first.', true); return; }
      if (!byId('goalPattern').value) { setStatus('Capture a pattern first.', true); return; }
      var result = applyDecision('APPLY_GOAL_LAYER', { patternId: byId('goalPattern').value, cellIds: Array.from(selectedCells).sort(), mode: byId('goalMode').value }, 'apply-goal', 'Guide these cells toward the captured pattern without bypassing local conditions.');
      if (result.ok) { selectedCells.clear(); render(); }
    });
    byId('exportStateButton').addEventListener('click', function () { downloadJson('axm-tycoon-steward-state-turn-' + state().turn + '.json', engine.exportState()); setStatus('State export prepared locally.', false); });
    byId('exportReceiptsButton').addEventListener('click', function () { downloadJson('axm-tycoon-steward-receipts-turn-' + state().turn + '.json', engine.exportReceipt()); setStatus('Receipt export prepared locally.', false); });
    byId('importStateButton').addEventListener('click', function () { byId('importFileInput').click(); });
    byId('importFileInput').addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0]; event.target.value = '';
      if (!file) return;
      if (file.size > window.AXMTycoonCanonical.MAX_IMPORT_BYTES) { setStatus('Import refused: file exceeds 1 MB.', true); return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var packet = JSON.parse(String(reader.result));
          if (!window.confirm('Validated import will replace the current screen state. Continue?')) return;
          var result = engine.importState(packet);
          if (resultMessage(result, 'Validated state imported.')) { selectedCells.clear(); pendingProposal = null; render(); }
        } catch (error) { setStatus('Import refused: ' + error.message, true); }
      };
      reader.onerror = function () { setStatus('Import refused: file could not be read.', true); };
      reader.readAsText(file);
    });
    byId('saveLocalButton').addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.exportState())); localStorage.setItem(PRIOR_IGNORE_KEY, '1'); localStorage.setItem(LEGACY_IGNORE_KEY, '1'); setStatus('State saved under the isolated palace-polish key by your explicit action.', false); }
      catch (error) { setStatus('Local save failed: ' + error.message, true); }
    });
    byId('loadLocalButton').addEventListener('click', function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY), usedPrior = false, usedLegacy = false;
        if (!raw && localStorage.getItem(PRIOR_IGNORE_KEY) !== '1') { raw = localStorage.getItem(PRIOR_STORAGE_KEY); usedPrior = !!raw; }
        if (!raw && localStorage.getItem(LEGACY_IGNORE_KEY) !== '1') { raw = localStorage.getItem(LEGACY_STORAGE_KEY); usedLegacy = !!raw; }
        if (!raw) { setStatus('No local palace-polish save or eligible older fallback exists.', true); return; }
        if (!window.confirm('Load the validated browser-local save and replace the current screen state?')) return;
        var result = engine.importState(JSON.parse(raw));
        if (resultMessage(result, usedLegacy ? 'Older Tycoon save loaded with visible empty emergence-memory migration.' : usedPrior ? 'v0.6 emergence-memory save loaded into the v0.7 screen explicitly.' : 'Browser-local palace-polish save loaded explicitly.')) { selectedCells.clear(); pendingProposal = null; render(); }
      } catch (error) { setStatus('Local load failed: ' + error.message, true); }
    });
    byId('clearLocalButton').addEventListener('click', function () {
      if (!window.confirm('Delete this module\'s browser-local save? Export first if you need a recovery copy.')) return;
      try { localStorage.removeItem(STORAGE_KEY); localStorage.setItem(PRIOR_IGNORE_KEY, '1'); localStorage.setItem(LEGACY_IGNORE_KEY, '1'); setStatus('Palace-polish save cleared; older fallbacks remain untouched and ignored.', false); } catch (error) { setStatus('Clear failed: ' + error.message, true); }
    });
    byId('resetButton').addEventListener('click', function () { if (window.confirm('Reset the screen to the deterministic starter? Export first if needed.')) { reset(STARTER_SEED); setStatus('Reset to starter. No saved file was deleted.', false); } });
    byId('loadHostBridgeButton').addEventListener('click', function () { byId('hostBridgeFileInput').click(); });
    byId('hostBridgeFileInput').addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0]; event.target.value = ''; if (!file) return;
      if (file.size > window.AXMTycoonCanonical.MAX_IMPORT_BYTES) { setStatus('Host bridge import refused: file exceeds 1 MB.', true); return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var packet = JSON.parse(String(reader.result));
          if (!packet || ['axm.living-world.steward-bridge/v0.1','axm.living-world.steward-bridge/v0.2','axm.living-world.steward-bridge/v0.3','axm.living-world.steward-bridge/v0.4'].indexOf(packet.schema) < 0 || !packet.summary || !packet.hostSnapshots || !packet.hostSnapshots.settlements) throw new Error('unsupported host bridge packet');
          var settlements = packet.hostSnapshots.settlements;
          if (settlements.sourceWorldId !== packet.summary.worldId || settlements.sourceRevision !== packet.summary.revision || !Array.isArray(settlements.data)) throw new Error('host bridge identity or revision mismatch');
          hostBridgePacket = packet; renderHostBridge(); setStatus('Host bridge packet loaded for proposal export. No connection or world change occurred.', false);
        } catch (error) { setStatus('Host bridge import refused: ' + error.message, true); }
      };
      reader.onerror = function () { setStatus('Host bridge import refused: file could not be read.', true); };
      reader.readAsText(file);
    });
    byId('hostOperation').addEventListener('change', renderHostBridge);
    byId('hostDistrict').addEventListener('change', function () { if (byId('hostRoadTo').value === byId('hostDistrict').value && byId('hostRoadTo').options.length > 1) byId('hostRoadTo').selectedIndex = (byId('hostDistrict').selectedIndex + 1) % byId('hostRoadTo').options.length; });
    byId('exportHostProposalButton').addEventListener('click', exportHostProposal);
  }

  wire();
  render();
})();
