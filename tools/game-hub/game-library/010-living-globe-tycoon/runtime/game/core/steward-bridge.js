(function (root, factory) {
  'use strict';
  var api = factory(
    typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical,
    typeof module === 'object' && module.exports ? require('./living-state') : root.AXMLivingState
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMGlobeStewardBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical, LivingState) {
  'use strict';

  var BRIDGE_SCHEMA = 'axm.living-world.steward-bridge/v0.4';

  function clone(value) { return Canonical.clone(value); }

  function Bridge(options) {
    var config = options || {};
    if (!config.engine || !(config.engine instanceof LivingState.Engine)) throw new TypeError('LivingState.Engine required');
    this.engine = config.engine;
    this.nativeProvider = typeof config.nativeProvider === 'function' ? config.nativeProvider : function () { return {}; };
    this.onChange = typeof config.onChange === 'function' ? config.onChange : function () {};
  }

  Bridge.prototype._notify = function (result, kind) {
    if (result && result.ok) this.onChange({ kind: kind, result: clone(result), summary: this.engine.summary() });
    return result;
  };

  Bridge.prototype.syncNativeObservation = function () {
    var result = this.engine.syncNativeObservation(this.nativeProvider(), { actor: { id: 'living-globe-runtime', type: 'WORLD' } });
    return result.changed ? this._notify(result, 'NATIVE_SYNC') : result;
  };

  Bridge.prototype.describe = function () {
    return {
      schema: BRIDGE_SCHEMA,
      status: 'EXPERIMENTAL LOCAL TEST',
      worldId: this.engine.state.worldId,
      worldStateOwner: 'living-world',
      supportedOperations: clone(LivingState.OPERATIONS),
      approvalSeparateFromApplication: true,
      automaticApply: false,
      automaticTurns: false,
      automaticDilemmaChoices: false,
      oneDilemmaAtATime: true,
      fictionalPoliticalSatire: true,
      causalEconomy: true,
      typedGoodsEconomy: true,
      supplyAwareEmergence: true,
      externalTypedTradeConnected: false,
      dynamicCostBreakdown: true,
      privateRevenueSeparateFromTreasury: true,
      modeledHabitats: clone(LivingState.HABITAT_ORDER),
      modeledInhabitants: clone(LivingState.SPECIES_ORDER),
      supportedEdicts: clone(LivingState.EDICT_ORDER),
      reversibleLatestApply: true,
      compatibleProposalSchema: LivingState.PROPOSAL_SCHEMA,
      limitations: clone(this.engine.state.limitations)
    };
  };

  Bridge.prototype.observeState = function () { return this.engine.observeState(); };
  Bridge.prototype.summary = function () { return this.engine.summary(); };
  Bridge.prototype.getHostSnapshots = function () {
    this.syncNativeObservation();
    return this.engine.hostSnapshots();
  };

  Bridge.prototype.previewOperations = function (operations) {
    this.syncNativeObservation();
    var inspected = this.engine.estimateOperations(operations);
    return {
      schema: 'axm.living-world.operation-preview/v0.1',
      targetWorldId: this.engine.state.worldId,
      targetRevision: this.engine.state.revision,
      operations: clone(operations),
      affordable: inspected.ok,
      errors: inspected.errors,
      estimatedCosts: inspected.costs,
      economicBreakdowns: inspected.economicBreakdowns,
      expectedEffects: inspected.effects,
      risks: inspected.risks,
      unknowns: inspected.unknowns,
      applied: false
    };
  };

  Bridge.prototype.createProposal = function (operations, reason, actor) {
    var preview = this.previewOperations(operations);
    if (preview.errors.length) return { ok: false, applied: false, errors: preview.errors, preview: preview, state: this.engine.observeState() };
    var input = {
      schema: LivingState.PROPOSAL_SCHEMA,
      id: 'globe-city-patch-' + Canonical.sha256(Canonical.stableStringify([preview.targetRevision, operations, reason || ''])).slice(0, 16),
      targetWorldId: preview.targetWorldId,
      targetRevision: preview.targetRevision,
      preconditions: [{ field: 'revision', equals: preview.targetRevision }, { field: 'worldStateOwner', equals: 'living-world' }],
      requestedOperations: clone(operations),
      causeCostTrace: { source: 'living-globe-steward-console', visibleReason: String(reason || ''), costs: preview.estimatedCosts },
      reversibilityStatement: 'Discard before apply. After apply, undo is available only while this remains the latest world revision.',
      risks: preview.risks,
      unknowns: preview.unknowns,
      consentReference: 'local-human-review-required'
    };
    return this._notify(this.engine.submitCityPatchProposal(input, { actor: actor || { id: 'local-human-steward', type: 'HUMAN' } }), 'PROPOSAL_CREATED');
  };

  Bridge.prototype.submitCityPatchProposal = function (packet, actor) {
    this.syncNativeObservation();
    return this._notify(this.engine.submitCityPatchProposal(packet, { actor: actor || { id: 'external-tycoon-steward', type: 'RULESET' } }), 'EXTERNAL_PROPOSAL_RECEIVED');
  };

  Bridge.prototype.reviewProposal = function (proposalId, decision, reason, actor) {
    return this._notify(this.engine.reviewProposal({
      proposalId: proposalId,
      decision: decision,
      expectedRevision: this.engine.state.revision,
      reason: reason,
      actor: actor || { id: 'local-human-steward', type: 'HUMAN' }
    }), 'PROPOSAL_REVIEWED');
  };

  Bridge.prototype.applyApprovedProposal = function (proposalId, approvalToken, reason, actor) {
    return this._notify(this.engine.applyApprovedProposal({
      proposalId: proposalId,
      approvalToken: approvalToken,
      reason: reason,
      actor: actor || { id: 'local-human-steward', type: 'HUMAN' }
    }), 'PROPOSAL_APPLIED');
  };

  Bridge.prototype.undoProposal = function (proposalId, reason, actor) {
    return this._notify(this.engine.undoProposal({
      proposalId: proposalId,
      reason: reason,
      actor: actor || { id: 'local-human-steward', type: 'HUMAN' }
    }), 'PROPOSAL_UNDONE');
  };

  Bridge.prototype.advanceQuarter = function (reason, actor) {
    this.syncNativeObservation();
    return this._notify(this.engine.advanceQuarter({
      expectedRevision: this.engine.state.revision,
      reason: reason,
      actor: actor || { id: 'local-human-steward', type: 'HUMAN' }
    }), 'QUARTER_ADVANCED');
  };

  Bridge.prototype.previewEdict = function (id) {
    return this.engine.previewEdict(id);
  };

  Bridge.prototype.issueEdict = function (id, reason, actor) {
    return this._notify(this.engine.issueEdict({
      id: id,
      expectedRevision: this.engine.state.revision,
      reason: reason,
      actor: actor || { id: 'local-human-steward', type: 'HUMAN' }
    }), 'EDICT_ISSUED');
  };

  Bridge.prototype.resolveDilemma = function (dilemmaId, choiceId, reason, actor) {
    return this._notify(this.engine.resolveDilemma({
      dilemmaId: dilemmaId,
      choiceId: choiceId,
      expectedRevision: this.engine.state.revision,
      reason: reason,
      actor: actor || { id: 'local-human-steward', type: 'HUMAN' }
    }), 'DILEMMA_RESOLVED');
  };

  Bridge.prototype.exportPacket = function () {
    this.syncNativeObservation();
    return {
      schema: BRIDGE_SCHEMA,
      bridge: this.describe(),
      summary: this.engine.summary(),
      hostSnapshots: this.engine.hostSnapshots(),
      strategicState: this.engine.exportState()
    };
  };

  return { BRIDGE_SCHEMA: BRIDGE_SCHEMA, Bridge: Bridge };
});
