(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical,
    typeof module === 'object' && module.exports ? require('./deterministic-rng') : root.AXMTycoonRng,
    typeof module === 'object' && module.exports ? require('./zone-model') : root.AXMTycoonZones,
    typeof module === 'object' && module.exports ? require('./resource-ledger') : root.AXMTycoonLedger,
    typeof module === 'object' && module.exports ? require('./supply-chain') : root.AXMTycoonSupply,
    typeof module === 'object' && module.exports ? require('./needs-model') : root.AXMTycoonNeeds,
    typeof module === 'object' && module.exports ? require('./emergence-patterns') : root.AXMTycoonPatterns,
    typeof module === 'object' && module.exports ? require('./emergence-engine') : root.AXMTycoonEmergence,
    typeof module === 'object' && module.exports ? require('./consequence-model') : root.AXMTycoonConsequences,
    typeof module === 'object' && module.exports ? require('./receipt-log') : root.AXMTycoonReceipts,
    typeof module === 'object' && module.exports ? require('./globe-adapter') : root.AXMTycoonGlobeAdapter
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonSteward = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical, Rng, Zones, Ledger, Supply, Needs, Patterns, Emergence, Consequences, Receipts, GlobeAdapter) {
  'use strict';

  var VERSION = '0.1.0';
  var DECISION_SCHEMA = 'axm.tycoon-steward.decision/v0.1';
  var PRIORITIES = ['BALANCED', 'HOMES_FIRST', 'LOCAL_WORK', 'ACCESS_FIRST', 'CIVIC_CARE', 'ECOLOGICAL_REPAIR'];
  var DECISION_TYPES = ['ALLOCATE', 'PAINT_ZONE', 'SET_POLICY', 'HOLD_DISTRICT', 'RELEASE_DISTRICT', 'REDIRECT_DISTRICT', 'REPAIR_DISTRICT', 'REVIEW_NOVELTY', 'CAPTURE_EMERGENCE', 'APPLY_GOAL_LAYER', 'SET_GOAL_LAYER_MODE', 'RETIRE_GOAL_LAYER'];

  function initialNovelty() {
    return {
      id: 'novelty-civic-weave',
      label: 'Civic weave pavilion',
      status: 'UNSCORED_REVIEW_REQUIRED',
      proposedCellId: 'cell-5-4',
      proposedEffects: { livability: 3, diversity: 4, resilience: 1 },
      metricBindings: null,
      source: 'STARTER_REVIEW_PROPOSAL',
      mayAffectVitals: false,
      mayEnterGlobeProposal: false,
      reviewHistory: []
    };
  }

  function createStarterState(seed) {
    var sourceSeed = String(seed == null ? 'axm-hearth-001' : seed).slice(0, 120);
    var map = Zones.createStarterMap(sourceSeed);
    var state = {
      schema: Canonical.STATE_SCHEMA,
      version: VERSION,
      status: 'EXPERIMENTAL',
      simulationId: 'steward-' + Canonical.sha256(sourceSeed).slice(0, 12),
      seed: sourceSeed,
      prng: Rng.create(sourceSeed + ':simulation').snapshot(),
      turn: 0,
      revision: 0,
      receiptSequence: 0,
      map: map,
      districts: Zones.createStarterDistricts(),
      structures: Emergence.createStarterStructures(map),
      roads: [],
      resources: Ledger.createResources(),
      ledger: Ledger.createLedger(),
      policies: { priority: 'BALANCED', constraints: { protectNature: true, natureRouteOverride: false, debtAllowed: false } },
      needs: [],
      vitals: Canonical.clone(Consequences.BASELINE),
      decisions: { accepted: [] },
      proposals: [],
      noveltyReview: [initialNovelty()],
      governance: { reasonsRecorded: 0, repairsCompleted: 0, commitmentsKept: 0, hiddenCostWarnings: 0, protectedOverrides: 0, staleAttempts: 0 },
      lastTurnShortages: [],
      receipts: [],
      receiptHead: null,
      boundaries: {
        localFirst: true,
        noNetworkDependency: true,
        noAutomaticTurns: true,
        globeMode: 'disconnected',
        globeLiveMutationSupported: false,
        proposalsAreChanges: false,
        typedGoodsConserved: true,
        externalTradeConnected: false,
        supplyAffectsEmergence: true,
        capturedEmergenceRequiresExplicitDecision: true,
        goalLayersCannotBypassCosts: true
      }
    };
    Supply.initialize(state);
    Patterns.initialize(state);
    state.needs = Needs.calculate(state);
    state.vitals = Consequences.calculate(state);
    return state;
  }

  function duplicateIds(items) {
    var seen = {}, duplicates = [];
    (items || []).forEach(function (item) { if (seen[item.id]) duplicates.push(item.id); seen[item.id] = true; });
    return duplicates;
  }

  function validateState(state) {
    var errors = [], warnings = [];
    if (!state || typeof state !== 'object' || Array.isArray(state)) return { ok: false, errors: ['state must be an object'], warnings: [] };
    if (state.schema !== Canonical.STATE_SCHEMA) errors.push('unsupported state schema');
    if (state.version !== VERSION) errors.push('unsupported state version');
    if (!Number.isInteger(state.turn) || state.turn < 0) errors.push('turn must be a non-negative integer');
    if (!Number.isInteger(state.revision) || state.revision < 0) errors.push('revision must be a non-negative integer');
    if (!state.map || state.map.width !== 8 || state.map.height !== 8 || !Array.isArray(state.map.cells) || state.map.cells.length !== 64) errors.push('8×8 map with 64 cells required');
    ['districts', 'structures', 'roads', 'needs', 'noveltyReview', 'receipts'].forEach(function (field) { if (!Array.isArray(state[field])) errors.push(field + ' must be an array'); });
    if (!state.decisions || !Array.isArray(state.decisions.accepted)) errors.push('decisions.accepted[] required');
    if (state.map && duplicateIds(state.map.cells).length) errors.push('duplicate cell IDs');
    if (duplicateIds(state.structures).length) errors.push('duplicate structure IDs');
    if (duplicateIds(state.roads).length) errors.push('duplicate road IDs');
    if (duplicateIds(state.districts).length) errors.push('duplicate district IDs');
    var ledgerCheck = Ledger.validateTable(state.resources);
    if (!ledgerCheck.ok) errors = errors.concat(ledgerCheck.errors);
    var supplyCheck = Supply.validate(state);
    if (!supplyCheck.ok) errors = errors.concat(supplyCheck.errors);
    var patternCheck = Patterns.validate(state);
    if (!patternCheck.ok) errors = errors.concat(patternCheck.errors);
    var receiptCheck = Receipts.verify(state.receipts);
    if (!receiptCheck.ok) errors = errors.concat(receiptCheck.errors);
    if (receiptCheck.head !== state.receiptHead) errors.push('receipt head mismatch');
    if (state.receipts.length && state.receipts[state.receipts.length - 1].postStateHash !== Canonical.hashState(state)) errors.push('last receipt post-state hash mismatch');
    (state.structures || []).forEach(function (structure) {
      if (!structure.cause || !structure.cause.ruleId) errors.push('structure ' + structure.id + ' lacks traceable cause');
      if (structure.metricStatus === 'UNSCORED_REVIEW_REQUIRED') {
        if (structure.vitalBindings && Object.keys(structure.vitalBindings).length) errors.push('unscored structure ' + structure.id + ' has metric bindings');
      } else if (!Consequences.bindingFor(structure)) errors.push('structure ' + structure.id + ' has no known/reviewed metric binding');
    });
    (state.roads || []).forEach(function (road) { if (!road.cause || !road.cause.ruleId || !Array.isArray(road.cause.resourceTransactionIds)) errors.push('road ' + road.id + ' lacks cause/cost trace'); });
    var finiteErrors = []; Canonical.validateFinite(state, '$', finiteErrors); errors = errors.concat(finiteErrors);
    if (Canonical.findUnsafeKey(state)) errors.push('unsafe object key refused');
    if (state.boundaries && state.boundaries.globeLiveMutationSupported !== false) errors.push('live globe mutation must remain unsupported');
    if (!state.boundaries || state.boundaries.typedGoodsConserved !== true || state.boundaries.externalTradeConnected !== false || state.boundaries.supplyAffectsEmergence !== true || state.boundaries.capturedEmergenceRequiresExplicitDecision !== true || state.boundaries.goalLayersCannotBypassCosts !== true) errors.push('typed supply or captured-goal boundaries were weakened');
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function failure(state, code, errors, warnings) {
    return { ok: false, state: Canonical.clone(state), receipt: null, warnings: warnings || [], errors: (errors || []).map(function (message) { return { code: code, message: message }; }) };
  }

  function actorFrom(context) {
    var input = context && context.actor || context || {};
    return { id: String(input.id || 'human-steward').slice(0, 100), type: String(input.type || 'HUMAN').toUpperCase().slice(0, 30), displayName: String(input.displayName || 'Local steward').slice(0, 120) };
  }

  function findDistrict(state, id) { return state.districts.filter(function (district) { return district.id === id; })[0] || null; }
  function findNovelty(state, id) { return state.noveltyReview.filter(function (item) { return item.id === id; })[0] || null; }
  function requireReason(decision) { return typeof decision.reason === 'string' && decision.reason.trim().length >= 4; }

  function StewardEngine(seedOrState) {
    this.state = seedOrState && typeof seedOrState === 'object' ? Canonical.clone(seedOrState) : createStarterState(seedOrState);
    if (!this.state.emergenceMemory && this.state.turn === 0 && Array.isArray(this.state.receipts) && this.state.receipts.length === 0) Patterns.initialize(this.state);
    this.globeAdapter = new GlobeAdapter.DisconnectedGlobeAdapter();
    var check = validateState(this.state);
    if (!check.ok) throw new Error('Invalid initial steward state: ' + check.errors.join('; '));
  }

  /**
   * @param {{districtId?:string,cellId?:string,summary?:boolean}=} query
   * @returns {object} Complete or filtered plain JSON-compatible world truth.
   */
  StewardEngine.prototype.observeState = function (query) {
    var options = query || {};
    if (!Object.keys(options).length) return Canonical.clone(this.state);
    if (options.summary) return Canonical.clone({ schema: this.state.schema, version: this.state.version, turn: this.state.turn, revision: this.state.revision, seed: this.state.seed, resources: this.state.resources, supplyChain: this.state.supplyChain, emergenceMemory: this.state.emergenceMemory, policies: this.state.policies, vitals: this.state.vitals, needs: this.state.needs, districts: this.state.districts, receiptHead: this.state.receiptHead, boundaries: this.state.boundaries });
    var districtId = options.districtId;
    if (options.cellId) {
      var selectedCell = this.state.map.cells.filter(function (cell) { return cell.id === options.cellId; })[0];
      districtId = selectedCell && selectedCell.districtId;
    }
    if (!districtId) return Canonical.clone(this.state);
    var cellIds = this.state.map.cells.filter(function (cell) { return cell.districtId === districtId; }).map(function (cell) { return cell.id; });
    return Canonical.clone({
      schema: this.state.schema, turn: this.state.turn, revision: this.state.revision,
      district: findDistrict(this.state, districtId),
      cells: this.state.map.cells.filter(function (cell) { return cell.districtId === districtId; }),
      structures: this.state.structures.filter(function (structure) { return structure.districtId === districtId; }),
      roads: this.state.roads.filter(function (road) { return road.path.some(function (cellId) { return cellIds.indexOf(cellId) >= 0; }); }),
      needs: Needs.query(this.state, { districtId: districtId }),
      capturedPatterns: this.state.emergenceMemory.patterns.filter(function (pattern) { return pattern.sourceDistrictId === districtId; }),
      goalLayers: this.state.emergenceMemory.goalLayers.filter(function (layer) { return layer.cellIds.some(function (id) { return cellIds.indexOf(id) >= 0; }); }),
      vitals: this.state.vitals, receipts: this.state.receipts
    });
  };

  /** @param {{kind?:string,districtId?:string,minPressure?:number}=} query @returns {Array<object>} */
  StewardEngine.prototype.listNeeds = function (query) { return Canonical.clone(Needs.query(this.state, query)); };

  /**
   * Pure preview; never reserves or spends.
   * @param {{zone:string,amounts:object}} input
   * @param {{id?:string,type?:string}=} actor
   * @returns {{schema:string,id:string,applied:false,affordable:boolean,forecastRange:object,warnings:string[],assumptions:string[],decisionDraft:object}}
   */
  StewardEngine.prototype.proposeAllocation = function (input, actor) {
    var zone = String(input && input.zone || '').toUpperCase();
    var amounts = Canonical.clone(input && input.amounts || {});
    var warnings = [], assumptions = [], errors = [];
    if (!Zones.validateZone(zone)) errors.push('supported zone required');
    var names = Object.keys(amounts).sort();
    if (!names.length) errors.push('one or more allocation amounts required');
    names.forEach(function (name) {
      if (Ledger.ALLOCATABLE.indexOf(name) < 0) errors.push('resource not allocatable: ' + name);
      if (!Number.isFinite(amounts[name]) || amounts[name] <= 0) errors.push(name + ' must be finite and greater than zero');
    });
    var affordable = !errors.length && names.every(function (name) { return this.state.resources[name].available >= amounts[name]; }, this);
    if (!affordable && !errors.length) warnings.push('Current unreserved stocks cannot cover this allocation.');
    if (zone === 'NATURE') warnings.push('Nature work can improve ecology while consuming funds, materials and attention.');
    if (zone === 'INDUSTRY') warnings.push('Industry can improve circulation while increasing energy and ecological pressure.');
    assumptions.push('A funded zone is permission to consider rule candidates, not a promise that development will occur.');
    assumptions.push('Labor, terrain, holds, needs and policy constraints are checked again at turn time.');
    var matching = Emergence.RULES.filter(function (rule) { return rule.zones.indexOf(zone) >= 0; });
    var proposalId = 'allocation-proposal-' + Canonical.sha256(Canonical.stableStringify([this.state.revision, zone, amounts, actor || {}])).slice(0, 14);
    return {
      schema: 'axm.tycoon-steward.allocation-proposal/v0.1', id: proposalId, actor: actorFrom(actor), expectedRevision: this.state.revision,
      zone: zone, amounts: amounts, affordable: affordable, errors: errors, warnings: warnings, assumptions: assumptions, applied: false,
      forecastRange: { knownCandidateTypes: matching.map(function (rule) { return rule.type; }).sort(), guaranteedDevelopments: 0, maximumDevelopmentsPerTurn: 1 },
      decisionDraft: { schema: DECISION_SCHEMA, id: 'decision-' + proposalId, type: 'ALLOCATE', expectedRevision: this.state.revision, reason: 'Fund broad ' + zone.toLowerCase() + ' stewardship envelope.', payload: { zone: zone, amounts: amounts, proposalId: proposalId } }
    };
  };

  function validateDecision(state, decision) {
    var errors = [];
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return ['decision must be an object'];
    if (decision.schema !== DECISION_SCHEMA) errors.push('unsupported decision schema');
    if (!/^[a-z0-9][a-z0-9._:-]{2,119}$/i.test(String(decision.id || ''))) errors.push('decision id must be 3–120 safe characters');
    if (DECISION_TYPES.indexOf(decision.type) < 0) errors.push('unsupported decision type');
    if (!Number.isInteger(decision.expectedRevision)) errors.push('expectedRevision integer required');
    else if (decision.expectedRevision !== state.revision) errors.push('stale decision revision');
    if (state.decisions.accepted.some(function (record) { return record.id === decision.id; })) errors.push('duplicate decision refused');
    if (!requireReason(decision)) errors.push('visible reason of at least four characters required');
    if (Canonical.findUnsafeKey(decision)) errors.push('unsafe decision key refused');
    var finiteErrors = []; Canonical.validateFinite(decision, '$decision', finiteErrors); errors = errors.concat(finiteErrors);
    return errors;
  }

  /**
   * @param {{schema:string,id:string,type:string,expectedRevision:number,reason:string,payload:object}} decision
   * @param {{actor?:object}=} context
   * @returns {{ok:boolean,state:object,receipt:?object,warnings:string[],errors:Array<object>}}
   */
  StewardEngine.prototype.applyStewardDecision = function (decision, context) {
    var errors = validateDecision(this.state, decision);
    if (errors.length) return failure(this.state, errors.some(function (message) { return message.indexOf('stale') >= 0; }) ? 'STALE_DECISION' : 'INVALID_DECISION', errors);
    var before = this.state;
    var draft = Canonical.clone(before);
    var payload = decision.payload || {};
    var changes = [], transactions = [], warnings = [];
    var receiptKind = decision.type === 'REVIEW_NOVELTY' && payload.action === 'APPROVE' ? 'INTERNAL_PROMOTION' : 'DECISION';
    var receiptReference = Receipts.predictId(before, receiptKind, before.turn);
    var result;

    if (decision.type === 'ALLOCATE') {
      var amounts = {};
      Object.keys(payload.amounts || {}).sort().forEach(function (name) { if (Number(payload.amounts[name]) > 0) amounts[name] = Number(payload.amounts[name]); });
      if (!Zones.validateZone(payload.zone)) return failure(before, 'INVALID_ALLOCATION', ['supported zone required']);
      result = Ledger.reserve(draft, {
        reservationId: 'allocation-' + decision.id, amounts: amounts, zone: String(payload.zone).toUpperCase(),
        transactionId: 'tx-' + decision.id + '-reserve', cause: 'STEWARD_ZONE_ALLOCATION/v1', turn: draft.turn,
        decisionReference: decision.id, receiptReference: receiptReference
      });
      if (!result.ok) return failure(before, 'ALLOCATION_REFUSED', result.errors);
      draft = result.state; transactions = result.transactions;
      changes.push({ type: 'ALLOCATION_RESERVED', id: result.reservation.id, summary: 'Reserved a broad ' + result.reservation.zone + ' stewardship envelope; nothing was built yet.' });
    } else if (decision.type === 'PAINT_ZONE') {
      result = Ledger.spendAvailable(draft, { amounts: { attention: 1 }, transactionId: 'tx-' + decision.id + '-paint', cause: 'BROAD_ZONE_DIRECTION/v1', destination: 'steward:zone-direction', turn: draft.turn, decisionReference: decision.id, receiptReference: receiptReference });
      if (!result.ok) return failure(before, 'PAINT_REFUSED', result.errors);
      draft = result.state; transactions = result.transactions;
      var painted = Zones.paintZones(draft, payload.cellIds, payload.zone);
      if (!painted.ok) return failure(before, 'PAINT_REFUSED', painted.errors);
      changes = painted.changes.map(function (change) { return { type: 'ZONE_CHANGED', id: change.cellId, from: change.from, to: change.to, summary: change.cellId + ': ' + change.from + ' → ' + change.to }; });
      if (!changes.length) warnings.push('Zone brush made no changes because every selected cell already had that zone.');
    } else if (decision.type === 'SET_POLICY') {
      result = Ledger.spendAvailable(draft, { amounts: { attention: 1 }, transactionId: 'tx-' + decision.id + '-policy', cause: 'STEWARD_POLICY_DIRECTION/v1', destination: 'steward:policy', turn: draft.turn, decisionReference: decision.id, receiptReference: receiptReference });
      if (!result.ok) return failure(before, 'POLICY_REFUSED', result.errors);
      draft = result.state; transactions = result.transactions;
      if (payload.priority != null) {
        if (PRIORITIES.indexOf(payload.priority) < 0) return failure(before, 'POLICY_REFUSED', ['unsupported priority']);
        changes.push({ type: 'POLICY_PRIORITY', from: draft.policies.priority, to: payload.priority, summary: 'Priority: ' + draft.policies.priority + ' → ' + payload.priority });
        draft.policies.priority = payload.priority;
      }
      if (payload.constraints) {
        ['protectNature', 'natureRouteOverride', 'debtAllowed'].forEach(function (name) {
          if (payload.constraints[name] != null) {
            if (typeof payload.constraints[name] !== 'boolean') errors.push(name + ' must be boolean');
            else {
              if (name === 'debtAllowed' && payload.constraints[name]) errors.push('debt is not implemented in v0.1');
              else {
                if (name === 'natureRouteOverride' && payload.constraints[name] && !draft.policies.constraints[name]) draft.governance.protectedOverrides += 1;
                changes.push({ type: 'POLICY_CONSTRAINT', id: name, from: draft.policies.constraints[name], to: payload.constraints[name], summary: name + ': ' + draft.policies.constraints[name] + ' → ' + payload.constraints[name] });
                draft.policies.constraints[name] = payload.constraints[name];
              }
            }
          }
        });
        if (errors.length) return failure(before, 'POLICY_REFUSED', errors);
      }
    } else if (decision.type === 'HOLD_DISTRICT') {
      var hold = findDistrict(draft, payload.districtId);
      if (!hold || hold.held) return failure(before, 'HOLD_REFUSED', [!hold ? 'district not found' : 'district already held']);
      hold.held = true; hold.heldFrom = hold.lifecycleState; hold.lifecycleState = 'HELD';
      hold.history.push({ turn: draft.turn, state: 'HELD', previous: hold.heldFrom, cause: decision.id, note: decision.reason });
      changes.push({ type: 'DISTRICT_HELD', id: hold.id, summary: hold.name + ' is held; emergence pauses while history remains.' });
    } else if (decision.type === 'RELEASE_DISTRICT') {
      var release = findDistrict(draft, payload.districtId);
      if (!release || !release.held) return failure(before, 'RELEASE_REFUSED', [!release ? 'district not found' : 'district is not held']);
      var restored = release.heldFrom || 'STRAINED'; release.held = false; release.lifecycleState = restored; release.heldFrom = null;
      release.history.push({ turn: draft.turn, state: restored, previous: 'HELD', cause: decision.id, note: decision.reason });
      changes.push({ type: 'DISTRICT_RELEASED', id: release.id, summary: release.name + ' returned to ' + restored + '.' });
    } else if (decision.type === 'REDIRECT_DISTRICT') {
      var redirect = findDistrict(draft, payload.districtId);
      if (!redirect) return failure(before, 'REDIRECT_REFUSED', ['district not found']);
      if (!Zones.validateZone(payload.towardZone)) return failure(before, 'REDIRECT_REFUSED', ['supported towardZone required']);
      result = Ledger.spendAvailable(draft, { amounts: { attention: 2 }, transactionId: 'tx-' + decision.id + '-redirect', cause: 'DISTRICT_REDIRECTION/v1', destination: 'district:' + redirect.id, turn: draft.turn, decisionReference: decision.id, receiptReference: receiptReference });
      if (!result.ok) return failure(before, 'REDIRECT_REFUSED', result.errors);
      draft = result.state; redirect = findDistrict(draft, payload.districtId); transactions = result.transactions;
      redirect.direction = { towardZone: payload.towardZone, reason: decision.reason, decisionId: decision.id, turn: draft.turn };
      changes.push({ type: 'DISTRICT_REDIRECTED', id: redirect.id, summary: redirect.name + ' is redirected toward ' + payload.towardZone + '; exact development remains emergent.' });
    } else if (decision.type === 'REPAIR_DISTRICT') {
      var repair = findDistrict(draft, payload.districtId);
      if (!repair) return failure(before, 'REPAIR_REFUSED', ['district not found']);
      if (repair.held) return failure(before, 'REPAIR_REFUSED', ['release the district before repair']);
      if (['FAILED', 'STALLED'].indexOf(repair.lifecycleState) < 0) return failure(before, 'REPAIR_REFUSED', ['only failed or stalled districts can begin repair']);
      if (payload.addressedCause !== repair.failureCause) return failure(before, 'REPAIR_REFUSED', ['addressedCause must match the recorded failure cause: ' + repair.failureCause]);
      result = Ledger.spendAvailable(draft, { amounts: { labor: 3, materials: 12, funds: 18, attention: 4 }, transactionId: 'tx-' + decision.id + '-repair', cause: 'DISTRICT_REPAIR/v1:' + repair.failureCause, destination: 'district:' + repair.id, turn: draft.turn, decisionReference: decision.id, receiptReference: receiptReference });
      if (!result.ok) return failure(before, 'REPAIR_REFUSED', result.errors);
      draft = result.state; repair = findDistrict(draft, payload.districtId); transactions = result.transactions;
      var previousState = repair.lifecycleState;
      repair.lifecycleState = 'REPAIRING';
      repair.repair = { decisionId: decision.id, addressedCause: payload.addressedCause, startedTurn: draft.turn, turnsRemaining: 2, transactionIds: transactions.map(function (tx) { return tx.transactionId; }) };
      repair.history.push({ turn: draft.turn, state: 'REPAIRING', previous: previousState, cause: decision.id, note: decision.reason });
      changes.push({ type: 'DISTRICT_REPAIR_STARTED', id: repair.id, summary: repair.name + ' began a costed repair addressing ' + payload.addressedCause + '.' });
    } else if (decision.type === 'REVIEW_NOVELTY') {
      var novelty = findNovelty(draft, payload.noveltyId);
      if (!novelty || novelty.status !== 'UNSCORED_REVIEW_REQUIRED') return failure(before, 'NOVELTY_REVIEW_REFUSED', [!novelty ? 'novelty not found' : 'novelty is no longer awaiting review']);
      if (payload.action === 'REJECT') {
        novelty.status = 'REJECTED_RETAINED'; novelty.mayAffectVitals = false; novelty.mayEnterGlobeProposal = false;
        novelty.reviewHistory.push({ turn: draft.turn, decisionId: decision.id, action: 'REJECT', reason: decision.reason });
        changes.push({ type: 'NOVELTY_REJECTED', id: novelty.id, summary: novelty.label + ' was rejected and retained in review history.' });
      } else if (payload.action === 'APPROVE') {
        var bindings = payload.metricBindings;
        if (!bindings || !Object.keys(bindings).length) return failure(before, 'NOVELTY_REVIEW_REFUSED', ['explicit metricBindings required for approval']);
        Object.keys(bindings).forEach(function (vital) {
          if (Consequences.VITALS.indexOf(vital) < 0 || !Number.isFinite(bindings[vital])) errors.push('invalid novelty binding: ' + vital);
        });
        if (errors.length) return failure(before, 'NOVELTY_REVIEW_REFUSED', errors);
        novelty.status = 'REVIEWED_WITH_BINDINGS'; novelty.metricBindings = Canonical.clone(bindings); novelty.mayAffectVitals = true; novelty.mayEnterGlobeProposal = true;
        novelty.reviewHistory.push({ turn: draft.turn, decisionId: decision.id, action: 'APPROVE', reason: decision.reason, metricBindings: Canonical.clone(bindings) });
        changes.push({ type: 'NOVELTY_REVIEW_PROMOTION', id: novelty.id, summary: novelty.label + ' received explicit bindings for future standalone proposals; it was not placed automatically.' });
      } else return failure(before, 'NOVELTY_REVIEW_REFUSED', ['action must be APPROVE or REJECT']);
    } else if (decision.type === 'CAPTURE_EMERGENCE') {
      result = Ledger.spendAvailable(draft, { amounts: { attention: 1 }, transactionId: 'tx-' + decision.id + '-capture', cause: 'CAPTURE_OBSERVED_EMERGENCE/v1', destination: 'steward:emergence-memory', turn: draft.turn, decisionReference: decision.id, receiptReference: receiptReference });
      if (!result.ok) return failure(before, 'PATTERN_CAPTURE_REFUSED', result.errors);
      draft = result.state; transactions = result.transactions;
      result = Patterns.capture(draft, { districtId: payload.districtId, label: payload.label, decisionId: decision.id });
      if (!result.ok) return failure(before, 'PATTERN_CAPTURE_REFUSED', result.errors, result.warnings);
      changes = result.changes; warnings = result.warnings;
    } else if (decision.type === 'APPLY_GOAL_LAYER') {
      result = Ledger.spendAvailable(draft, { amounts: { attention: 2 }, transactionId: 'tx-' + decision.id + '-goal', cause: 'APPLY_CAPTURED_GOAL_LAYER/v1', destination: 'steward:goal-layer', turn: draft.turn, decisionReference: decision.id, receiptReference: receiptReference });
      if (!result.ok) return failure(before, 'GOAL_LAYER_REFUSED', result.errors);
      draft = result.state; transactions = result.transactions;
      result = Patterns.applyGoal(draft, { patternId: payload.patternId, cellIds: payload.cellIds, mode: payload.mode, decisionId: decision.id });
      if (!result.ok) return failure(before, 'GOAL_LAYER_REFUSED', result.errors, result.warnings);
      changes = result.changes; warnings = result.warnings;
    } else if (decision.type === 'SET_GOAL_LAYER_MODE') {
      result = Ledger.spendAvailable(draft, { amounts: { attention: 1 }, transactionId: 'tx-' + decision.id + '-goal-mode', cause: 'SET_CAPTURED_GOAL_MODE/v1', destination: 'steward:goal-layer', turn: draft.turn, decisionReference: decision.id, receiptReference: receiptReference });
      if (!result.ok) return failure(before, 'GOAL_MODE_REFUSED', result.errors);
      draft = result.state; transactions = result.transactions;
      result = Patterns.setMode(draft, { layerId: payload.layerId, mode: payload.mode, decisionId: decision.id });
      if (!result.ok) return failure(before, 'GOAL_MODE_REFUSED', result.errors, result.warnings);
      changes = result.changes; warnings = result.warnings;
    } else if (decision.type === 'RETIRE_GOAL_LAYER') {
      result = Ledger.spendAvailable(draft, { amounts: { attention: 1 }, transactionId: 'tx-' + decision.id + '-goal-retire', cause: 'RETIRE_CAPTURED_GOAL/v1', destination: 'steward:goal-layer', turn: draft.turn, decisionReference: decision.id, receiptReference: receiptReference });
      if (!result.ok) return failure(before, 'GOAL_RETIRE_REFUSED', result.errors);
      draft = result.state; transactions = result.transactions;
      result = Patterns.retire(draft, { layerId: payload.layerId, decisionId: decision.id });
      if (!result.ok) return failure(before, 'GOAL_RETIRE_REFUSED', result.errors, result.warnings);
      changes = result.changes; warnings = result.warnings;
    }

    draft.revision += 1;
    draft.governance.reasonsRecorded += 1;
    draft.needs = Needs.calculate(draft);
    var previousVitals = Canonical.clone(before.vitals);
    draft.vitals = Consequences.calculate(draft);
    var acceptedRecord = { id: decision.id, type: decision.type, reason: decision.reason, turn: draft.turn, revision: draft.revision, actor: actorFrom(context), receiptReference: receiptReference };
    draft.decisions.accepted.push(acceptedRecord);
    var appended = Receipts.append(draft, {
      kind: receiptKind, logicalTurn: draft.turn, actor: actorFrom(context), decisionReferences: [decision.id],
      preStateHash: Canonical.hashState(before), seedPreState: before.prng, seedPostState: draft.prng,
      needsObserved: before.needs, proposalsConsidered: payload.proposalId ? [{ id: payload.proposalId, accepted: true }] : [],
      candidates: [], resourceTransactions: transactions, changes: changes,
      vitalDeltas: Consequences.delta(previousVitals, draft.vitals), unmetNeeds: draft.needs,
      noveltyFlags: draft.noveltyReview.filter(function (item) { return item.status === 'UNSCORED_REVIEW_REQUIRED'; }).map(function (item) { return item.id; }),
      warnings: warnings, limitations: ['Decision changes only the standalone experimental simulation.'], adapterProposals: []
    });
    this.state = appended.state;
    return { ok: true, state: Canonical.clone(this.state), receipt: appended.receipt, warnings: warnings, errors: [] };
  };

  /** @param {{count?:number,actor?:object,expectedRevision?:number}=} input @returns {{ok:boolean,state:object,receipts:Array<object>,warnings:string[],errors:Array<object>}} */
  StewardEngine.prototype.advanceTurn = function (input) {
    var options = input || {};
    var count = options.count == null ? 1 : Number(options.count);
    if (!Number.isInteger(count) || count < 1 || count > 20) return { ok: false, state: Canonical.clone(this.state), receipts: [], warnings: [], errors: [{ code: 'INVALID_TURN_COUNT', message: 'count must be an integer from 1 to 20' }] };
    if (options.expectedRevision != null && options.expectedRevision !== this.state.revision) return { ok: false, state: Canonical.clone(this.state), receipts: [], warnings: [], errors: [{ code: 'STALE_TURN_REQUEST', message: 'expectedRevision does not match current revision' }] };
    var produced = [], warnings = [];
    for (var i = 0; i < count; i += 1) {
      var before = this.state;
      var receiptReference = Receipts.predictId(before, 'TURN', before.turn + 1);
      var turnResult = Emergence.runTurn(before, receiptReference);
      if (!turnResult.ok) return { ok: false, state: Canonical.clone(this.state), receipts: produced, warnings: warnings, errors: turnResult.errors || [{ code: 'TURN_FAILED', message: 'turn pipeline failed' }] };
      var draft = turnResult.state;
      draft.revision += 1;
      var appended = Receipts.append(draft, {
        kind: 'TURN', logicalTurn: draft.turn, actor: actorFrom(options.actor), decisionReferences: options.actionId ? [String(options.actionId)] : [],
        preStateHash: Canonical.hashState(before), seedPreState: turnResult.seedPreState, seedPostState: turnResult.seedPostState,
        needsObserved: turnResult.needsObserved, proposalsConsidered: turnResult.proposalsConsidered,
        candidates: turnResult.candidates, resourceTransactions: turnResult.transactions, changes: turnResult.changes,
        vitalDeltas: turnResult.vitalDeltas, unmetNeeds: draft.needs, noveltyFlags: turnResult.noveltyFlags,
        warnings: turnResult.warnings, limitations: turnResult.limitations, adapterProposals: []
      });
      this.state = appended.state;
      produced.push(appended.receipt); warnings = warnings.concat(turnResult.warnings);
    }
    return { ok: true, state: Canonical.clone(this.state), receipts: produced, warnings: warnings, errors: [] };
  };

  /** @param {string|object} reference @returns {object} structured and readable cause/cost/consequence chain */
  StewardEngine.prototype.explainChange = function (reference) {
    var id = typeof reference === 'string' ? reference : reference && (reference.id || reference.receiptId || reference.transactionId);
    var receipt = this.state.receipts.filter(function (item) { return item.receiptId === id; })[0];
    if (receipt) return { found: true, type: 'RECEIPT', id: id, readable: Receipts.explain(receipt), data: Canonical.clone(receipt) };
    var structure = this.state.structures.filter(function (item) { return item.id === id; })[0];
    if (structure) return { found: true, type: 'STRUCTURE', id: id, readable: structure.label + ' appeared through ' + structure.cause.ruleId + (structure.cause.triggerNeedId ? ' in response to ' + structure.cause.triggerNeedId : '') + '.', data: Canonical.clone(structure) };
    var road = this.state.roads.filter(function (item) { return item.id === id; })[0];
    if (road) return { found: true, type: 'ROAD', id: id, readable: 'Road pressure ' + road.cause.connectionPressure + ' crossed threshold ' + road.cause.threshold + '; deterministic path ' + road.path.join(' → ') + '.', data: Canonical.clone(road) };
    var district = findDistrict(this.state, id);
    if (district) return { found: true, type: 'DISTRICT', id: id, readable: district.name + ' is ' + district.lifecycleState + '. History has ' + district.history.length + ' retained entries.', data: Canonical.clone(district) };
    var transaction = this.state.ledger.transactions.filter(function (item) { return item.transactionId === id; })[0];
    if (transaction) return { found: true, type: 'RESOURCE_TRANSACTION', id: id, readable: transaction.amount + ' ' + transaction.unit + ' moved from ' + transaction.source + ' to ' + transaction.destination + ' because ' + transaction.cause + '.', data: Canonical.clone(transaction) };
    var goodsTransaction = this.state.supplyChain.transactions.filter(function (item) { return item.transactionId === id; })[0];
    if (goodsTransaction) return { found: true, type: 'GOODS_TRANSACTION', id: id, readable: goodsTransaction.amount + ' ' + goodsTransaction.good + ' moved from ' + goodsTransaction.source + ' to ' + goodsTransaction.destination + ' because ' + goodsTransaction.cause + '.', data: Canonical.clone(goodsTransaction) };
    var pattern = Patterns.patternById(this.state, id);
    if (pattern) return { found: true, type: 'EMERGENCE_PATTERN', id: id, readable: pattern.label + ' captured ' + pattern.profile.sourceStructureCount + ' observed role(s) from ' + pattern.sourceDistrictName + ' at turn ' + pattern.capturedTurn + '. It contains evidence, not cloned inventory or buildings.', data: Canonical.clone(pattern) };
    var goalLayer = Patterns.layerById(this.state, id);
    if (goalLayer) return { found: true, type: 'GOAL_LAYER', id: id, readable: goalLayer.label + ' is ' + goalLayer.status + ' at ' + goalLayer.progress.percent + '% in ' + goalLayer.mode + ' mode. ' + goalLayer.progress.explanation, data: Canonical.clone(goalLayer) };
    var novelty = findNovelty(this.state, id);
    if (novelty) return { found: true, type: 'NOVELTY_REVIEW', id: id, readable: novelty.label + ' is ' + novelty.status + ' and may affect vitals: ' + novelty.mayAffectVitals + '.', data: Canonical.clone(novelty) };
    return { found: false, type: null, id: id || null, readable: 'No matching receipt, structure, road, district, generic/typed transaction, captured pattern, goal layer or novelty item.', data: null };
  };

  /** @param {{kind?:string,turn?:number,id?:string,limit?:number}=} query @returns {object} */
  StewardEngine.prototype.exportReceipt = function (query) {
    var selected = Receipts.query(this.state, query);
    return { schema: 'axm.tycoon-steward.receipt-export/v0.1', simulationId: this.state.simulationId, receiptHead: this.state.receiptHead, receipts: Canonical.clone(selected), chainValid: Receipts.verify(this.state.receipts).ok };
  };

  /** @returns {{schema:string,stateSchema:string,checksum:object,state:object}} */
  StewardEngine.prototype.exportState = function () { return Canonical.makeExportPacket(this.state); };

  /** @param {object} packet @returns {{ok:boolean,state:object,warnings:string[],errors:Array<object>}} */
  StewardEngine.prototype.importState = function (packet) {
    var packetCheck = Canonical.validateExportPacket(packet);
    if (!packetCheck.ok) return { ok: false, state: Canonical.clone(this.state), warnings: [], errors: packetCheck.errors.map(function (message) { return { code: 'IMPORT_REFUSED', message: message }; }) };
    var candidate = Canonical.clone(packet.state), warnings = [];
    if (!candidate.supplyChain && candidate.turn === 0 && Array.isArray(candidate.receipts) && candidate.receipts.length === 0) {
      candidate.boundaries = candidate.boundaries || {};
      candidate.boundaries.typedGoodsConserved = true; candidate.boundaries.externalTradeConnected = false; candidate.boundaries.supplyAffectsEmergence = true;
      Supply.initialize(candidate);
      warnings.push('Starter fixture gained a deterministic typed supply ledger; no simulated history was invented.');
    }
    if (!candidate.emergenceMemory) {
      var legacyReceiptCheck = Receipts.verify(candidate.receipts || []);
      if (!legacyReceiptCheck.ok || legacyReceiptCheck.head !== candidate.receiptHead || (candidate.receipts.length && candidate.receipts[candidate.receipts.length - 1].postStateHash !== Canonical.hashState(candidate))) {
        return { ok: false, state: Canonical.clone(this.state), warnings: [], errors: [{ code: 'IMPORT_REFUSED', message: 'legacy receipt/state boundary is invalid before emergence-memory migration' }] };
      }
      var legacyHash = Canonical.hashState(candidate);
      Patterns.initialize(candidate);
      if (candidate.turn > 0 || candidate.receipts.length) {
        var migrated = Receipts.append(candidate, {
          kind: 'STATE_MIGRATION', logicalTurn: candidate.turn, actor: { id: 'migration-v0.6', type: 'SYSTEM', displayName: 'Emergence-memory migration' },
          decisionReferences: [], preStateHash: legacyHash, seedPreState: candidate.prng, seedPostState: candidate.prng,
          needsObserved: candidate.needs || [], proposalsConsidered: [], candidates: [], resourceTransactions: [],
          changes: [{ type: 'EMERGENCE_MEMORY_INITIALIZED', id: 'emergence-memory', summary: 'Initialized empty captured-pattern memory; no earlier pattern or goal history was invented.' }],
          vitalDeltas: {}, unmetNeeds: candidate.needs || [], noveltyFlags: [], warnings: [],
          limitations: ['Migration adds an empty evidence layer only; prior development is not retroactively captured.'], adapterProposals: []
        });
        candidate = migrated.state;
        warnings.push('Older Tycoon state gained empty captured-emergence memory through one visible migration receipt; no past goal history was invented.');
      } else warnings.push('Starter fixture gained empty captured-emergence memory; no simulated history was invented.');
    }
    var stateCheck = validateState(candidate);
    if (!stateCheck.ok) return { ok: false, state: Canonical.clone(this.state), warnings: stateCheck.warnings, errors: stateCheck.errors.map(function (message) { return { code: 'IMPORT_REFUSED', message: message }; }) };
    this.state = candidate;
    return { ok: true, state: Canonical.clone(this.state), warnings: warnings.concat(stateCheck.warnings), errors: [] };
  };

  StewardEngine.prototype.getGlobeAdapter = function () { return this.globeAdapter; };

  function createSteward(seed) { return new StewardEngine(seed); }

  return {
    VERSION: VERSION,
    DECISION_SCHEMA: DECISION_SCHEMA,
    PRIORITIES: PRIORITIES,
    DECISION_TYPES: DECISION_TYPES,
    GOOD_ORDER: Supply.GOOD_ORDER,
    PATTERN_SCHEMA: Patterns.SCHEMA,
    GOAL_MODES: Patterns.MODES,
    createStarterState: createStarterState,
    validateState: validateState,
    StewardEngine: StewardEngine,
    createSteward: createSteward
  };
});
