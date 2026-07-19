(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonPatterns = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  var VERSION = '0.1.0';
  var SCHEMA = 'axm.tycoon-steward.emergence-memory/v0.1';
  var MODES = ['PRESERVE', 'EVOLVE'];
  var ACTIVE_STATUSES = ['ACTIVE', 'TARGET_HELD', 'BASELINE_REACHED'];
  var PATTERN_CAP = 12;
  var LAYER_CAP = 16;
  var HISTORY_CAP = 120;
  var TYPE_TIERS = {
    COTTAGE_CLUSTER: 1, SMALL_SETTLEMENT: 1, POCKET_PARK: 1, WETLAND_BUFFER: 1,
    TIMBER_CAMP: 1, CLAY_PIT: 1, TRADE_PATH: 1, ECO_BUFFER: 1,
    COURTYARD_HOMES: 2, WORKSHOP_YARD: 2, REPAIR_COOPERATIVE: 2,
    FESTIVAL_GREEN: 2, COMMON_HALL: 2, CIVIC_STOP: 2, MIXED_QUARTER: 2,
    PUBLIC_SERVICE: 2, STONE_QUARRY: 2, ORE_YARD: 2, SAWMILL: 2,
    BRICKWORKS: 2, MARKET_ROW: 2, FOOD_HALL: 2,
    ENERGY_COOP: 3, METALWORKS: 3, CANNERY: 3,
    FURNITURE_WORKSHOP: 3, CONSTRUCTION_YARD: 3
  };

  function clone(value) { return Canonical.clone(value); }
  function round(value, digits) { return Canonical.round(value, digits == null ? 3 : digits); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function sum(values) { return values.reduce(function (total, value) { return total + value; }, 0); }
  function byId(items, id) { return (items || []).filter(function (item) { return item.id === id; })[0] || null; }
  function tierForType(type) { return TYPE_TIERS[type] || 1; }
  function safeLabel(value, fallback) {
    var label = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return label || fallback;
  }
  function addMap(target, values) {
    Object.keys(values || {}).forEach(function (id) { target[id] = round(Number(target[id] || 0) + Number(values[id] || 0), 4); });
  }
  function countBy(items, selector) {
    return (items || []).reduce(function (out, item) { var id = selector(item); out[id] = Number(out[id] || 0) + 1; return out; }, {});
  }
  function sortedCountRows(table, labelFor) {
    return Object.keys(table || {}).sort().map(function (id) { return { id: id, label: labelFor ? labelFor(id) : id, count: table[id] }; });
  }
  function record(memory, event) {
    memory.history.push(event);
    if (memory.history.length > HISTORY_CAP) memory.history.splice(0, memory.history.length - HISTORY_CAP);
  }

  function initialize(state) {
    state.emergenceMemory = {
      schema: SCHEMA,
      version: VERSION,
      patterns: [],
      goalLayers: [],
      history: [],
      headline: 'Nothing has been copied. The island is waiting to remember something worth repeating.',
      boundaries: {
        captureRequiresObservedEmergence: true,
        goalIsScoringPressureNotBlueprint: true,
        goalNeverBypassesZoneTerrainSupplyLaborOrCost: true,
        preserveStopsNewGrowthAtCapturedBaseline: true,
        evolveAllowsDevelopmentBeyondBaseline: true,
        sourceHistoryIsNeverRewritten: true
      }
    };
    state.boundaries = state.boundaries || {};
    state.boundaries.capturedEmergenceRequiresExplicitDecision = true;
    state.boundaries.goalLayersCannotBypassCosts = true;
    return state.emergenceMemory;
  }

  function ensure(state) { return state.emergenceMemory || initialize(state); }
  function patternById(state, id) { return byId(ensure(state).patterns, id); }
  function layerById(state, id) { return byId(ensure(state).goalLayers, id); }
  function districtById(state, id) { return byId(state.districts, id); }
  function cellById(state, id) { return byId(state.map && state.map.cells, id); }
  function sourceStructures(state, districtId) {
    return state.structures.filter(function (structure) {
      return structure.districtId === districtId && structure.lifecycle !== 'FAILED' && Number(structure.createdTurn || 0) > 0 &&
        structure.cause && structure.cause.ruleId !== 'STARTER_WORLD_SEED/v1';
    }).sort(function (a, b) { return a.id.localeCompare(b.id); });
  }

  function captureProfile(state, district, structures) {
    var cells = state.map.cells.filter(function (cell) { return cell.districtId === district.id; }).sort(function (a, b) { return a.id.localeCompare(b.id); });
    var typeCounts = countBy(structures, function (structure) { return structure.type; });
    var categoryCounts = countBy(structures, function (structure) { return structure.category; });
    var labels = {}; structures.forEach(function (structure) { labels[structure.type] = structure.label; });
    var inputs = {}, outputs = {}, capacities = {};
    structures.forEach(function (structure) {
      addMap(inputs, structure.operatingGoods || {}); addMap(outputs, structure.outputGoods || {}); addMap(capacities, structure.capacity || {});
    });
    var deposits = {};
    cells.forEach(function (cell) {
      Object.keys(state.supplyChain.deposits[cell.id] || {}).forEach(function (id) {
        var item = state.supplyChain.deposits[cell.id][id];
        if (!deposits[id]) deposits[id] = { quality: 0, remaining: 0 };
        deposits[id].quality += item.quality; deposits[id].remaining += item.remaining;
      });
    });
    Object.keys(deposits).forEach(function (id) {
      deposits[id].quality = round(deposits[id].quality / Math.max(1, cells.length), 2);
      deposits[id].remaining = round(deposits[id].remaining / Math.max(1, cells.length), 2);
    });
    var roadCells = cells.filter(function (cell) { return cell.roadIds.length; }).length;
    var weightedTier = sum(structures.map(function (structure) { return tierForType(structure.type); })) / structures.length;
    return {
      sourceCellCount: cells.length,
      sourceStructureCount: structures.length,
      density: round(structures.length / Math.max(1, cells.length), 4),
      structureMix: sortedCountRows(typeCounts, function (id) { return labels[id] || id; }).map(function (row) {
        row.category = structures.filter(function (structure) { return structure.type === row.id; })[0].category;
        row.tier = tierForType(row.id); row.share = round(row.count / structures.length, 4); return row;
      }),
      categoryMix: sortedCountRows(categoryCounts).map(function (row) { row.share = round(row.count / structures.length, 4); return row; }),
      zoneMix: sortedCountRows(countBy(cells, function (cell) { return cell.zone; })),
      terrainMix: sortedCountRows(countBy(cells, function (cell) { return cell.terrain.kind; })),
      operatingInputs: inputs,
      outputs: outputs,
      capacities: capacities,
      deposits: deposits,
      accessRatio: round(roadCells / Math.max(1, cells.length), 4),
      baselineTier: round(weightedTier, 3)
    };
  }

  function capture(state, input) {
    var memory = ensure(state), district = districtById(state, input && input.districtId), errors = [], warnings = [];
    if (!district) errors.push('source district not found');
    if (district && ['FAILED', 'STALLED', 'HELD', 'REPAIRING'].indexOf(district.lifecycleState) >= 0) errors.push('source district must be operating, recovered or merely strained before its pattern can be trusted');
    var structures = district ? sourceStructures(state, district.id) : [];
    if (!structures.length) errors.push('source district has no observed post-starter emergence to capture');
    if (memory.patterns.length >= PATTERN_CAP) errors.push('captured-pattern cap reached');
    if (errors.length) return { ok: false, errors: errors, warnings: warnings, changes: [] };
    var label = safeLabel(input.label, district.name + ' pattern');
    var sourceIds = structures.map(function (structure) { return structure.id; });
    var id = 'pattern-' + Canonical.sha256(Canonical.stableStringify([state.simulationId, state.turn, state.revision, district.id, sourceIds, label])).slice(0, 14);
    if (patternById(state, id)) return { ok: false, errors: ['identical pattern was already captured at this revision'], warnings: [], changes: [] };
    var pattern = {
      id: id,
      schema: 'axm.tycoon-steward.emergence-pattern/v0.1',
      label: label,
      sourceDistrictId: district.id,
      sourceDistrictName: district.name,
      sourceStructureIds: sourceIds,
      capturedTurn: state.turn,
      capturedRevision: state.revision,
      status: 'CAPTURED_EVIDENCE',
      profile: captureProfile(state, district, structures),
      successEvidence: {
        lifecycleState: district.lifecycleState,
        stress: district.stress,
        receiptHead: state.receiptHead,
        vitals: clone(state.vitals)
      },
      cause: {
        ruleId: 'CAPTURE_OBSERVED_EMERGENCE/v1',
        decisionId: input.decisionId,
        note: 'This freezes observed roles and conditions as evidence; it does not clone buildings, inventory or money.'
      }
    };
    memory.patterns.push(pattern);
    memory.headline = district.name + ' has been remembered. The paperwork insists this is not nostalgia.';
    record(memory, { turn: state.turn, revision: state.revision, type: 'PATTERN_CAPTURED', patternId: id, districtId: district.id, decisionId: input.decisionId });
    if (district.lifecycleState === 'STRAINED') warnings.push('The captured district is strained; its pattern records that weakness instead of declaring it ideal.');
    return { ok: true, pattern: pattern, errors: [], warnings: warnings, changes: [{ type: 'EMERGENCE_PATTERN_CAPTURED', id: id, summary: label + ' captured ' + structures.length + ' observed emergent role(s) from ' + district.name + '.' }] };
  }

  function desiredCounts(pattern, targetCount) {
    var rows = pattern.profile.structureMix.map(function (entry) {
      var raw = entry.share * targetCount;
      return { type: entry.id, label: entry.label, category: entry.category, tier: entry.tier, count: Math.floor(raw), remainder: raw - Math.floor(raw) };
    });
    var assigned = sum(rows.map(function (row) { return row.count; }));
    rows.slice().sort(function (a, b) { return b.remainder - a.remainder || a.type.localeCompare(b.type); }).forEach(function (row) {
      if (assigned >= targetCount) return;
      var original = rows.filter(function (item) { return item.type === row.type; })[0]; original.count += 1; assigned += 1;
    });
    return rows.filter(function (row) { return row.count > 0; }).map(function (row) { delete row.remainder; return row; });
  }

  function applyGoal(state, input) {
    var memory = ensure(state), pattern = patternById(state, input && input.patternId), errors = [], warnings = [];
    var mode = String(input && input.mode || '').toUpperCase();
    var cellIds = Array.from(new Set((input && input.cellIds || []).map(String))).sort();
    if (!pattern) errors.push('captured pattern not found');
    if (MODES.indexOf(mode) < 0) errors.push('mode must be PRESERVE or EVOLVE');
    if (!cellIds.length || cellIds.length > 20) errors.push('choose 1 to 20 target cells');
    var missing = cellIds.filter(function (id) { return !cellById(state, id); });
    if (missing.length) errors.push('unknown target cells: ' + missing.join(', '));
    if (pattern && cellIds.some(function (id) { return cellById(state, id).districtId === pattern.sourceDistrictId; })) errors.push('goal cells must be outside the captured source district');
    var occupied = {};
    memory.goalLayers.filter(function (layer) { return ACTIVE_STATUSES.indexOf(layer.status) >= 0; }).forEach(function (layer) { layer.cellIds.forEach(function (id) { occupied[id] = layer.id; }); });
    var overlap = cellIds.filter(function (id) { return occupied[id]; });
    if (overlap.length) errors.push('target cells already belong to another active goal layer: ' + overlap.join(', '));
    if (memory.goalLayers.filter(function (layer) { return layer.status !== 'RETIRED'; }).length >= LAYER_CAP) errors.push('active goal-layer cap reached');
    if (errors.length) return { ok: false, errors: errors, warnings: warnings, changes: [] };
    var targetCount = Math.max(1, Math.min(cellIds.length, Math.round(pattern.profile.density * cellIds.length)));
    var id = 'goal-' + Canonical.sha256(Canonical.stableStringify([state.simulationId, state.turn, state.revision, pattern.id, cellIds, mode])).slice(0, 14);
    var layer = {
      id: id,
      schema: 'axm.tycoon-steward.goal-layer/v0.1',
      label: pattern.label + (mode === 'PRESERVE' ? ' · held character' : ' · living launchpad'),
      patternId: pattern.id,
      mode: mode,
      status: 'ACTIVE',
      cellIds: cellIds,
      createdTurn: state.turn,
      createdRevision: state.revision,
      targetStructureCount: targetCount,
      desiredTypes: desiredCounts(pattern, targetCount),
      baselineTier: pattern.profile.baselineTier,
      progress: { percent: 0, matched: 0, exactMatches: 0, adaptedMatches: 0, target: targetCount, missingTypes: [], explanation: 'No target evaluation recorded yet.' },
      completionTurn: null,
      history: [{ turn: state.turn, revision: state.revision, status: 'ACTIVE', mode: mode, cause: input.decisionId }],
      cause: {
        ruleId: 'APPLY_CAPTURED_GOAL_LAYER/v1',
        decisionId: input.decisionId,
        note: 'This changes candidate preference only. Zone, terrain, supply, labor, civic allocation and product bills remain mandatory.'
      }
    };
    memory.goalLayers.push(layer);
    var refreshed = refresh(state);
    memory.headline = mode === 'PRESERVE' ? 'A district character is now protected by several forms and one heroic clipboard.' : 'A remembered district became a launchpad; improvement is permitted after resemblance.';
    record(memory, { turn: state.turn, revision: state.revision, type: 'GOAL_LAYER_APPLIED', layerId: id, patternId: pattern.id, mode: mode, cellIds: clone(cellIds), decisionId: input.decisionId });
    if (cellIds.filter(function (cellId) { return cellById(state, cellId).structureIds.length; }).length === cellIds.length) warnings.push('Every target cell is already occupied; the layer can measure the pattern but has no empty site for new emergence.');
    return { ok: true, layer: layer, errors: [], warnings: warnings.concat(refreshed.warnings), changes: [{ type: 'CAPTURED_GOAL_LAYER_APPLIED', id: id, summary: pattern.label + ' now guides ' + cellIds.length + ' cell(s) in ' + mode + ' mode without placing anything.' }].concat(refreshed.changes) };
  }

  function evaluateLayer(state, layer) {
    var pattern = patternById(state, layer.patternId);
    var structures = state.structures.filter(function (structure) { return layer.cellIds.indexOf(structure.cellId) >= 0 && structure.lifecycle !== 'FAILED'; }).sort(function (a, b) { return a.id.localeCompare(b.id); });
    var remaining = {}; layer.desiredTypes.forEach(function (row) { remaining[row.type] = row.count; });
    var exact = 0, adapted = 0, unused = [];
    structures.forEach(function (structure) {
      if (remaining[structure.type] > 0) { remaining[structure.type] -= 1; exact += 1; }
      else unused.push(structure);
    });
    var desiredCategories = {};
    layer.desiredTypes.forEach(function (row) { desiredCategories[row.category] = true; });
    unused.forEach(function (structure) { if (desiredCategories[structure.category] && exact + adapted < layer.targetStructureCount) adapted += 1; });
    var matched = Math.min(layer.targetStructureCount, exact + adapted);
    var percent = round(clamp(matched / Math.max(1, layer.targetStructureCount) * 100, 0, 100), 1);
    var missingTypes = Object.keys(remaining).filter(function (id) { return remaining[id] > 0; }).sort().map(function (id) { return { type: id, remaining: remaining[id] }; });
    var previousStatus = layer.status;
    if (layer.status !== 'RETIRED') {
      if (matched >= layer.targetStructureCount) layer.status = layer.mode === 'PRESERVE' ? 'TARGET_HELD' : 'BASELINE_REACHED';
      else layer.status = 'ACTIVE';
    }
    if (layer.status !== 'ACTIVE' && layer.completionTurn == null) layer.completionTurn = state.turn;
    if (layer.status === 'ACTIVE') layer.completionTurn = null;
    layer.progress = {
      percent: percent,
      matched: matched,
      exactMatches: exact,
      adaptedMatches: adapted,
      target: layer.targetStructureCount,
      missingTypes: missingTypes,
      explanation: matched >= layer.targetStructureCount ? (layer.mode === 'PRESERVE' ? 'Captured baseline reached; further new growth in these cells is held.' : 'Captured baseline reached; higher-tier development may now grow beyond it.') : matched + ' of ' + layer.targetStructureCount + ' functional role(s) currently match. Local substitutes count as adapted rather than exact.'
    };
    return { pattern: pattern, previousStatus: previousStatus, nextStatus: layer.status };
  }

  function refresh(state) {
    var memory = ensure(state), changes = [], warnings = [];
    memory.goalLayers.forEach(function (layer) {
      if (layer.status === 'RETIRED') return;
      var evaluation = evaluateLayer(state, layer);
      if (!evaluation.pattern) { warnings.push('Goal layer ' + layer.id + ' has no captured pattern.'); return; }
      if (evaluation.previousStatus !== evaluation.nextStatus) {
        layer.history.push({ turn: state.turn, revision: state.revision, status: evaluation.nextStatus, mode: layer.mode, cause: 'GOAL_PROGRESS_EVALUATION/v1' });
        if (layer.history.length > 40) layer.history.splice(0, layer.history.length - 40);
        changes.push({ type: 'GOAL_LAYER_STATUS', id: layer.id, from: evaluation.previousStatus, to: evaluation.nextStatus, summary: layer.label + ': ' + evaluation.previousStatus + ' → ' + evaluation.nextStatus + '.' });
        record(memory, { turn: state.turn, revision: state.revision, type: 'GOAL_LAYER_STATUS', layerId: layer.id, from: evaluation.previousStatus, to: evaluation.nextStatus });
      }
    });
    return { changes: changes, warnings: warnings };
  }

  function setMode(state, input) {
    var memory = ensure(state), layer = layerById(state, input && input.layerId), mode = String(input && input.mode || '').toUpperCase();
    if (!layer || layer.status === 'RETIRED') return { ok: false, errors: [!layer ? 'goal layer not found' : 'retired goal layer cannot change mode'], warnings: [], changes: [] };
    if (MODES.indexOf(mode) < 0) return { ok: false, errors: ['mode must be PRESERVE or EVOLVE'], warnings: [], changes: [] };
    if (layer.mode === mode) return { ok: false, errors: ['goal layer already uses ' + mode + ' mode'], warnings: [], changes: [] };
    var previous = layer.mode; layer.mode = mode;
    layer.history.push({ turn: state.turn, revision: state.revision, status: layer.status, mode: mode, cause: input.decisionId });
    var refreshed = refresh(state);
    memory.headline = mode === 'EVOLVE' ? 'The preserved district has been informed that history may continue.' : 'The palace has put a tasteful ceiling on this particular kind of progress.';
    record(memory, { turn: state.turn, revision: state.revision, type: 'GOAL_LAYER_MODE', layerId: layer.id, from: previous, to: mode, decisionId: input.decisionId });
    return { ok: true, layer: layer, errors: [], warnings: refreshed.warnings, changes: [{ type: 'GOAL_LAYER_MODE_CHANGED', id: layer.id, from: previous, to: mode, summary: layer.label + ': ' + previous + ' → ' + mode + '.' }].concat(refreshed.changes) };
  }

  function retire(state, input) {
    var memory = ensure(state), layer = layerById(state, input && input.layerId);
    if (!layer || layer.status === 'RETIRED') return { ok: false, errors: [!layer ? 'goal layer not found' : 'goal layer is already retired'], warnings: [], changes: [] };
    var previous = layer.status; layer.status = 'RETIRED';
    layer.history.push({ turn: state.turn, revision: state.revision, status: 'RETIRED', mode: layer.mode, cause: input.decisionId });
    memory.headline = 'A goal layer retired with full honours and no mysterious demolition crew.';
    record(memory, { turn: state.turn, revision: state.revision, type: 'GOAL_LAYER_RETIRED', layerId: layer.id, decisionId: input.decisionId });
    return { ok: true, layer: layer, errors: [], warnings: [], changes: [{ type: 'GOAL_LAYER_RETIRED', id: layer.id, from: previous, to: 'RETIRED', summary: layer.label + ' retired; its evidence remains in memory.' }] };
  }

  function overlapCount(left, right) {
    var rightMap = {}; Object.keys(right || {}).forEach(function (id) { rightMap[id] = true; });
    return Object.keys(left || {}).filter(function (id) { return rightMap[id]; }).length;
  }

  function influenceForCandidate(state, cell, rule) {
    var memory = ensure(state), active = memory.goalLayers.filter(function (layer) { return ACTIVE_STATUSES.indexOf(layer.status) >= 0 && layer.cellIds.indexOf(cell.id) >= 0; });
    if (!active.length) return { blocked: false, reasons: [], bonus: 0, components: { capturedGoal: 0 }, layerRefs: [], match: 'NONE' };
    var layer = active[0], pattern = patternById(state, layer.patternId);
    if (!pattern) return { blocked: true, reasons: ['GOAL_PATTERN_MISSING'], bonus: 0, components: { capturedGoal: 0 }, layerRefs: [layer.id], match: 'INVALID' };
    if (layer.mode === 'PRESERVE' && layer.status === 'TARGET_HELD') {
      return { blocked: true, reasons: ['PRESERVE_GOAL_BASELINE_REACHED'], bonus: 0, components: { capturedGoal: 0 }, layerRefs: [layer.id], patternId: pattern.id, mode: layer.mode, match: 'PRESERVED_CAP' };
    }
    var missing = {}; (layer.progress.missingTypes || []).forEach(function (row) { missing[row.type] = row.remaining; });
    var desiredCategories = {}; layer.desiredTypes.forEach(function (row) { desiredCategories[row.category] = true; });
    var bonus = 0, match = 'CONTEXT';
    if (layer.status === 'ACTIVE' && missing[rule.type] > 0) { bonus += 20; match = 'EXACT'; }
    else if (layer.status === 'ACTIVE' && desiredCategories[rule.category]) { bonus += 11; match = 'ADAPTED_ROLE'; }
    var economy = pattern.profile;
    var specInputs = rule.operatingGoods || {};
    var specOutputs = rule.outputGoods || {};
    var supplyOverlap = overlapCount(specInputs, economy.operatingInputs) + overlapCount(specOutputs, economy.outputs);
    bonus += Math.min(4, supplyOverlap * 2);
    if (layer.status === 'BASELINE_REACHED' && layer.mode === 'EVOLVE') {
      var tier = tierForType(rule.type);
      if (tier > layer.baselineTier) { bonus += 8; match = 'EVOLUTION_STEP'; }
      else if (desiredCategories[rule.category]) { bonus += 3; match = 'HERITAGE_CONTINUITY'; }
    }
    bonus = round(Math.min(24, bonus), 3);
    return {
      blocked: false,
      reasons: [],
      bonus: bonus,
      components: { capturedGoal: bonus },
      layerRefs: [layer.id],
      patternId: pattern.id,
      mode: layer.mode,
      status: layer.status,
      match: match,
      explanation: 'Goal preference is additive only; ordinary zone, terrain, supply, labor, allocation and exact product-bill checks remain authoritative.'
    };
  }

  function summary(state) {
    var memory = ensure(state), active = memory.goalLayers.filter(function (layer) { return ACTIVE_STATUSES.indexOf(layer.status) >= 0; });
    return { patterns: memory.patterns.length, activeGoalLayers: active.length, preserved: active.filter(function (layer) { return layer.mode === 'PRESERVE'; }).length, evolving: active.filter(function (layer) { return layer.mode === 'EVOLVE'; }).length, headline: memory.headline };
  }

  function validate(state) {
    var memory = state.emergenceMemory, errors = [], seen = {}, occupied = {};
    if (!memory || memory.schema !== SCHEMA) return { ok: false, errors: ['emergence memory state required'] };
    if (!Array.isArray(memory.patterns) || memory.patterns.length > PATTERN_CAP) errors.push('captured patterns missing or over cap');
    if (!Array.isArray(memory.goalLayers) || memory.goalLayers.length > LAYER_CAP + HISTORY_CAP) errors.push('goal layers missing or unbounded');
    if (!Array.isArray(memory.history) || memory.history.length > HISTORY_CAP) errors.push('emergence-memory history missing or unbounded');
    (memory.patterns || []).forEach(function (pattern) {
      if (seen[pattern.id]) errors.push('duplicate emergence-memory ID ' + pattern.id); seen[pattern.id] = true;
      if (!districtById(state, pattern.sourceDistrictId)) errors.push('pattern source district missing ' + pattern.id);
      if (!pattern.profile || !Array.isArray(pattern.profile.structureMix) || !pattern.profile.structureMix.length || !Number.isFinite(pattern.profile.density) || pattern.profile.density <= 0) errors.push('invalid pattern profile ' + pattern.id);
      if (!Array.isArray(pattern.sourceStructureIds) || !pattern.sourceStructureIds.length) errors.push('pattern source evidence missing ' + pattern.id);
    });
    (memory.goalLayers || []).forEach(function (layer) {
      if (seen[layer.id]) errors.push('duplicate emergence-memory ID ' + layer.id); seen[layer.id] = true;
      if (!patternById(state, layer.patternId)) errors.push('goal pattern missing ' + layer.id);
      if (MODES.indexOf(layer.mode) < 0 || ACTIVE_STATUSES.concat(['RETIRED']).indexOf(layer.status) < 0) errors.push('invalid goal mode/status ' + layer.id);
      if (!Array.isArray(layer.cellIds) || !layer.cellIds.length || layer.cellIds.length > 20 || new Set(layer.cellIds).size !== layer.cellIds.length) errors.push('invalid goal cells ' + layer.id);
      (layer.cellIds || []).forEach(function (id) {
        if (!cellById(state, id)) errors.push('unknown goal cell ' + id);
        if (ACTIVE_STATUSES.indexOf(layer.status) >= 0 && occupied[id]) errors.push('overlapping active goal cells ' + id);
        if (ACTIVE_STATUSES.indexOf(layer.status) >= 0) occupied[id] = layer.id;
      });
      if (!layer.progress || !Number.isFinite(layer.progress.percent) || layer.progress.percent < 0 || layer.progress.percent > 100 || !Number.isFinite(layer.targetStructureCount) || layer.targetStructureCount < 1 || layer.targetStructureCount > layer.cellIds.length) errors.push('invalid goal progress ' + layer.id);
      if (!Array.isArray(layer.history) || layer.history.length > 40) errors.push('goal history missing or unbounded ' + layer.id);
    });
    if (!memory.boundaries || memory.boundaries.goalIsScoringPressureNotBlueprint !== true || memory.boundaries.goalNeverBypassesZoneTerrainSupplyLaborOrCost !== true || memory.boundaries.preserveStopsNewGrowthAtCapturedBaseline !== true || memory.boundaries.evolveAllowsDevelopmentBeyondBaseline !== true) errors.push('emergence-memory boundaries weakened');
    if (!state.boundaries || state.boundaries.capturedEmergenceRequiresExplicitDecision !== true || state.boundaries.goalLayersCannotBypassCosts !== true) errors.push('state goal-layer boundaries weakened');
    Canonical.validateFinite(memory, '$.emergenceMemory', errors);
    return { ok: errors.length === 0, errors: errors };
  }

  return {
    SCHEMA: SCHEMA,
    VERSION: VERSION,
    MODES: MODES,
    ACTIVE_STATUSES: ACTIVE_STATUSES,
    TYPE_TIERS: clone(TYPE_TIERS),
    initialize: initialize,
    ensure: ensure,
    patternById: patternById,
    layerById: layerById,
    tierForType: tierForType,
    sourceStructures: sourceStructures,
    capture: capture,
    applyGoal: applyGoal,
    setMode: setMode,
    retire: retire,
    refresh: refresh,
    influenceForCandidate: influenceForCandidate,
    summary: summary,
    validate: validate
  };
});
