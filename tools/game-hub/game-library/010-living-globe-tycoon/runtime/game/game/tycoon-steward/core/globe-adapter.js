(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonGlobeAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  var PROPOSAL_SCHEMA = 'axm.tycoon-steward.city-patch-proposal/v0.1';
  var EVENT_SCHEMA = 'axm.tycoon-steward.globe-event/v0.1';
  var SNAPSHOT_SCHEMA = 'axm.tycoon-steward.host-snapshot/v0.1';
  var RECEIPT_SCHEMA = 'axm.tycoon-steward.adapter-receipt/v0.1';
  var ALLOWED_OPERATIONS = ['PROPOSE_DISTRICT', 'PROPOSE_ROAD', 'PROPOSE_SERVICE', 'PROPOSE_ECO_BUFFER'];
  var ALLOWED_EVENTS = ['RESOURCE_UPDATED', 'SETTLEMENT_CHANGED', 'TERRAIN_REVISION'];

  function validateSnapshot(snapshot) {
    var errors = [];
    if (!snapshot || snapshot.schema !== SNAPSHOT_SCHEMA) errors.push('host snapshot schema unsupported');
    ['sourceWorldId', 'sourceRevision', 'provenance', 'units', 'uncertainty', 'limitations', 'consentReference'].forEach(function (field) {
      if (snapshot && (snapshot[field] == null || snapshot[field] === '')) errors.push('host snapshot requires ' + field);
    });
    return { ok: errors.length === 0, errors: errors };
  }

  function validateProposal(input, knownWorldId, knownRevision) {
    var errors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['proposal input must be an object'] };
    ['targetWorldId', 'targetRevision', 'preconditions', 'requestedOperations', 'causeCostTrace', 'reversibilityStatement', 'risks', 'unknowns'].forEach(function (field) {
      if (input[field] == null) errors.push('proposal requires ' + field);
    });
    if (!Array.isArray(input.requestedOperations) || !input.requestedOperations.length) errors.push('requestedOperations must be a non-empty array');
    else input.requestedOperations.forEach(function (operation, index) {
      if (!operation || ALLOWED_OPERATIONS.indexOf(operation.type) < 0) errors.push('unsupported operation at index ' + index);
      if (Canonical.findUnsafeKey(operation)) errors.push('unsafe operation key refused at index ' + index);
    });
    if (knownWorldId && input.targetWorldId !== knownWorldId) errors.push('target world ID mismatch');
    if (knownRevision == null) errors.push('target revision cannot be verified while disconnected');
    else if (input.targetRevision !== knownRevision) errors.push('stale target revision refused');
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * Proposal-only adapter contract. A host owns its state and supplies explicit,
   * versioned snapshots. This class has no live host mutation method.
   */
  function GlobeAdapter(options) {
    var config = options || {};
    this.mode = config.mode || 'disconnected';
    this.worldId = config.worldId || null;
    this.revision = config.revision == null ? null : config.revision;
    this.fixture = Canonical.clone(config.fixture || {});
    this.sequence = 0;
    this.receipts = [];
  }

  GlobeAdapter.prototype._receipt = function (method, ok, code, detail, packetHash) {
    this.sequence += 1;
    var receipt = {
      schema: RECEIPT_SCHEMA,
      id: 'adapter-receipt-' + String(this.sequence).padStart(5, '0'),
      logicalSequence: this.sequence,
      mode: this.mode,
      method: method,
      ok: !!ok,
      code: code,
      detail: detail,
      packetHash: packetHash || null,
      liveHostMutation: false,
      previousReceiptHash: this.receipts.length ? this.receipts[this.receipts.length - 1].currentReceiptHash : null,
      currentReceiptHash: ''
    };
    receipt.currentReceiptHash = Canonical.sha256(Canonical.stableStringify(receipt));
    this.receipts.push(receipt);
    return Canonical.clone(receipt);
  };

  /** @returns {{ok:boolean,data?:object,receipt:object,code?:string}} */
  GlobeAdapter.prototype.readTerrainSeed = function () {
    if (this.mode === 'disconnected') return { ok: false, code: 'ADAPTER_DISCONNECTED', receipt: this._receipt('readTerrainSeed', false, 'ADAPTER_DISCONNECTED', 'No host snapshot was read.') };
    var check = validateSnapshot(this.fixture.terrain);
    return check.ok ? { ok: true, data: Canonical.clone(this.fixture.terrain), receipt: this._receipt('readTerrainSeed', true, 'SNAPSHOT_RETURNED', 'Host-supplied terrain snapshot returned.') } : { ok: false, code: 'INVALID_HOST_SNAPSHOT', errors: check.errors, receipt: this._receipt('readTerrainSeed', false, 'INVALID_HOST_SNAPSHOT', check.errors.join('; ')) };
  };

  /** @returns {{ok:boolean,data?:object,receipt:object,code?:string}} */
  GlobeAdapter.prototype.readWorldResources = function () {
    if (this.mode === 'disconnected') return { ok: false, code: 'ADAPTER_DISCONNECTED', receipt: this._receipt('readWorldResources', false, 'ADAPTER_DISCONNECTED', 'No host snapshot was read.') };
    var check = validateSnapshot(this.fixture.resources);
    return check.ok ? { ok: true, data: Canonical.clone(this.fixture.resources), receipt: this._receipt('readWorldResources', true, 'SNAPSHOT_RETURNED', 'Host-supplied resource snapshot returned.') } : { ok: false, code: 'INVALID_HOST_SNAPSHOT', errors: check.errors, receipt: this._receipt('readWorldResources', false, 'INVALID_HOST_SNAPSHOT', check.errors.join('; ')) };
  };

  /** @returns {{ok:boolean,data?:object,receipt:object,code?:string}} */
  GlobeAdapter.prototype.readExistingSettlements = function () {
    if (this.mode === 'disconnected') return { ok: false, code: 'ADAPTER_DISCONNECTED', receipt: this._receipt('readExistingSettlements', false, 'ADAPTER_DISCONNECTED', 'No host snapshot was read.') };
    var check = validateSnapshot(this.fixture.settlements);
    return check.ok ? { ok: true, data: Canonical.clone(this.fixture.settlements), receipt: this._receipt('readExistingSettlements', true, 'SNAPSHOT_RETURNED', 'Host-supplied settlement snapshot returned.') } : { ok: false, code: 'INVALID_HOST_SNAPSHOT', errors: check.errors, receipt: this._receipt('readExistingSettlements', false, 'INVALID_HOST_SNAPSHOT', check.errors.join('; ')) };
  };

  /**
   * @param {object} input target/revision/preconditions/operations/cause-cost packet
   * @returns {{ok:boolean,proposal?:object,applied:false,receipt:object,errors?:string[]}}
   */
  GlobeAdapter.prototype.submitCityPatchProposal = function (input) {
    var check = validateProposal(input, this.worldId, this.revision);
    if (!check.ok) return { ok: false, applied: false, errors: check.errors, receipt: this._receipt('submitCityPatchProposal', false, 'PROPOSAL_REFUSED', check.errors.join('; ')) };
    var proposal = {
      schema: PROPOSAL_SCHEMA,
      id: input.id || 'city-patch-' + Canonical.sha256(Canonical.stableStringify(input)).slice(0, 16),
      status: 'PROPOSAL_ONLY',
      targetWorldId: input.targetWorldId,
      targetRevision: input.targetRevision,
      preconditions: Canonical.clone(input.preconditions),
      requestedOperations: Canonical.clone(input.requestedOperations),
      causeCostTrace: Canonical.clone(input.causeCostTrace),
      reversibilityStatement: String(input.reversibilityStatement),
      risks: Canonical.clone(input.risks),
      unknowns: Canonical.clone(input.unknowns),
      consentReference: input.consentReference || null,
      packageHash: input.packageHash || Canonical.sha256(Canonical.stableStringify(input)),
      liveHostMutation: false
    };
    var packetHash = Canonical.sha256(Canonical.stableStringify(proposal));
    return { ok: true, proposal: proposal, applied: false, receipt: this._receipt('submitCityPatchProposal', true, 'PROPOSAL_CREATED_NOT_APPLIED', 'Proposal packet created; target remains unchanged.', packetHash) };
  };

  /** @param {object} event explicitly supplied, allowlisted event packet */
  GlobeAdapter.prototype.receiveWorldEvent = function (event) {
    var errors = [];
    if (!event || event.schema !== EVENT_SCHEMA) errors.push('unsupported globe event schema');
    if (!event || ALLOWED_EVENTS.indexOf(event.type) < 0) errors.push('event type not allowlisted');
    if (!event || event.sourceWorldId !== this.worldId) errors.push('event world ID mismatch');
    if (!event || event.sourceRevision == null || (this.revision != null && event.sourceRevision < this.revision)) errors.push('stale or missing event revision');
    if (Canonical.findUnsafeKey(event)) errors.push('unsafe event key refused');
    if (errors.length) return { ok: false, errors: errors, receipt: this._receipt('receiveWorldEvent', false, 'EVENT_REFUSED', errors.join('; ')) };
    this.revision = event.sourceRevision;
    return { ok: true, accepted: Canonical.clone(event), receipt: this._receipt('receiveWorldEvent', true, 'EVENT_ACCEPTED', 'Explicit event data accepted; no subscription was created.') };
  };

  /** @param {object} content reviewed portable content; performs no host mutation */
  GlobeAdapter.prototype.exportEmergentContent = function (content) {
    if (!content || typeof content !== 'object' || Canonical.findUnsafeKey(content)) return { ok: false, errors: ['safe JSON-compatible content required'], receipt: this._receipt('exportEmergentContent', false, 'EXPORT_REFUSED', 'Unsafe or missing content.') };
    if (content.status === 'UNSCORED_REVIEW_REQUIRED') return { ok: false, errors: ['unscored novelty requires explicit review before proposal export'], receipt: this._receipt('exportEmergentContent', false, 'NOVELTY_REVIEW_REQUIRED', 'Unreviewed novelty was not exported.') };
    var packet = {
      schema: 'axm.tycoon-steward.emergent-content/v0.1',
      sourceModule: 'tycoon-steward',
      targetWorldId: this.worldId,
      targetRevision: this.revision,
      content: Canonical.clone(content),
      proposalOnly: true,
      liveHostMutation: false
    };
    var hash = Canonical.sha256(Canonical.stableStringify(packet));
    packet.packageHash = hash;
    return { ok: true, packet: packet, receipt: this._receipt('exportEmergentContent', true, 'PORTABLE_CONTENT_EXPORTED', 'Portable content exported; no host mutation occurred.', hash) };
  };

  function DisconnectedGlobeAdapter() { GlobeAdapter.call(this, { mode: 'disconnected' }); }
  DisconnectedGlobeAdapter.prototype = Object.create(GlobeAdapter.prototype);
  DisconnectedGlobeAdapter.prototype.constructor = DisconnectedGlobeAdapter;

  return {
    PROPOSAL_SCHEMA: PROPOSAL_SCHEMA,
    EVENT_SCHEMA: EVENT_SCHEMA,
    SNAPSHOT_SCHEMA: SNAPSHOT_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    ALLOWED_OPERATIONS: ALLOWED_OPERATIONS,
    ALLOWED_EVENTS: ALLOWED_EVENTS,
    validateSnapshot: validateSnapshot,
    validateProposal: validateProposal,
    GlobeAdapter: GlobeAdapter,
    DisconnectedGlobeAdapter: DisconnectedGlobeAdapter
  };
});
