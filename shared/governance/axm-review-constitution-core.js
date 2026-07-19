(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMReviewConstitution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.1.0';
  var CONSTITUTION_SCHEMA = 'axm.review-constitution/v1';
  var RECEIPT_SCHEMA = 'axm.review-receipt/v1';
  var DECISION_SCHEMA = 'axm.review-decision/v1';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 200); }
  function slug(value) { return text(value, 100).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''); }
  function unique(values) { return values.filter(function (value, index) { return values.indexOf(value) === index; }); }

  function create(input) {
    input = input || {};
    var mode = input.mode === 'SHARED' ? 'SHARED' : 'SOLO';
    var seats = (Array.isArray(input.seats) ? input.seats : []).map(function (seat, index) {
      var seatId = slug(seat && seat.seatId || ('seat-' + (index + 1)));
      if (!seatId) throw new Error('seatId required');
      return {
        seatId: seatId,
        label: text(seat && seat.label || seatId, 100),
        required: seat && seat.required === false ? false : true,
        assignedIdentityId: text(seat && seat.assignedIdentityId, 120) || null,
        perspective: text(seat && seat.perspective || 'independent-review', 120)
      };
    });
    if (unique(seats.map(function (seat) { return seat.seatId; })).length !== seats.length) throw new Error('seatId values must be unique');
    var rule = input.rule === 'QUORUM' ? 'QUORUM' : 'ALL_REQUIRED';
    var requiredCount = seats.filter(function (seat) { return seat.required; }).length;
    var quorum = Math.max(1, Math.min(seats.length || 1, Math.round(Number(input.quorum) || requiredCount || 1)));
    var governedActions = Array.isArray(input.governedActions) ? unique(input.governedActions.map(function (action) { return slug(action); }).filter(Boolean)) : (mode === 'SHARED' ? ['shared-promotion'] : []);
    return {
      schema: CONSTITUTION_SCHEMA,
      version: VERSION,
      constitutionId: slug(input.constitutionId || ('constitution-' + Date.now())) || 'constitution-local',
      title: text(input.title || (mode === 'SOLO' ? 'Solo use' : 'Shared review'), 180),
      mode: mode,
      governedActions: governedActions,
      seats: seats,
      rule: rule,
      quorum: quorum,
      requireIndependentIdentities: input.requireIndependentIdentities !== false,
      reviewWindow: { maxOpenItemsPerGoal: Math.max(1, Math.min(1000, Math.round(Number(input.reviewWindow && (input.reviewWindow.maxOpenItemsPerGoal || input.reviewWindow.maxOpenItems)) || 8))) },
      identityPolicy: 'identity-kind-neutral',
      createdBy: text(input.createdBy || 'local-steward', 120),
      createdAt: input.createdAt || new Date().toISOString()
    };
  }

  function receipt(constitution, input) {
    input = input || {};
    if (!constitution || constitution.schema !== CONSTITUTION_SCHEMA) throw new Error('review constitution required');
    var seatId = slug(input.seatId);
    var seat = constitution.seats.find(function (candidate) { return candidate.seatId === seatId; });
    if (!seat) throw new Error('review seat is not declared by this constitution');
    var identityId = text(input.reviewer && input.reviewer.identityId, 120);
    if (!identityId) throw new Error('reviewer identityId required');
    if (seat.assignedIdentityId && seat.assignedIdentityId !== identityId) throw new Error('reviewer is not assigned to this seat');
    var verdict = ['UP', 'DOWN', 'HOLD'].indexOf(input.verdict) >= 0 ? input.verdict : null;
    if (!verdict) throw new Error('verdict must be UP, DOWN or HOLD');
    var artifactId = text(input.artifact && input.artifact.artifactId, 160);
    var digest = text(input.artifact && input.artifact.digest, 200);
    if (!artifactId || !digest) throw new Error('artifact id and digest required');
    var summary = text(input.evidence && input.evidence.summary, 1000);
    if (!summary) throw new Error('review evidence summary required');
    return {
      schema: RECEIPT_SCHEMA,
      receiptId: text(input.receiptId || ('review-' + seatId + '-' + Date.now()), 160),
      constitutionId: constitution.constitutionId,
      action: slug(input.action || 'shared-promotion'),
      seatId: seatId,
      reviewer: {
        identityId: identityId,
        kind: text(input.reviewer.kind || 'unspecified', 80),
        displayName: text(input.reviewer.displayName || identityId, 120)
      },
      artifact: { artifactId: artifactId, digest: digest },
      verdict: verdict,
      evidence: { summary: summary, refs: Array.isArray(input.evidence.refs) ? clone(input.evidence.refs) : [] },
      issuedAt: input.issuedAt || new Date().toISOString()
    };
  }

  function evaluate(constitution, artifact, receipts, action) {
    if (!constitution || constitution.schema !== CONSTITUTION_SCHEMA) throw new Error('review constitution required');
    var artifactId = text(artifact && artifact.artifactId, 160);
    var digest = text(artifact && artifact.digest, 200);
    if (!artifactId || !digest) throw new Error('artifact id and digest required');
    action = slug(action || 'shared-promotion');
    var governed = constitution.governedActions.indexOf(action) >= 0;
    if (!governed) return {
      schema: DECISION_SCHEMA,
      constitutionId: constitution.constitutionId,
      artifact: { artifactId: artifactId, digest: digest },
      action: action,
      permitted: true,
      status: 'UNREVIEWED_BY_CHOICE',
      label: 'No review gate selected for this action.',
      approvals: [],
      holds: [],
      issues: []
    };

    var matching = (Array.isArray(receipts) ? receipts : []).filter(function (item) {
      return item && item.schema === RECEIPT_SCHEMA && item.constitutionId === constitution.constitutionId && item.action === action && item.artifact && item.artifact.artifactId === artifactId && item.artifact.digest === digest;
    }).sort(function (a, b) { return Date.parse(a.issuedAt) - Date.parse(b.issuedAt); });
    var bySeat = {};
    matching.forEach(function (item) { bySeat[item.seatId] = item; });
    var usedIdentities = {};
    var issues = [];
    var valid = [];
    constitution.seats.forEach(function (seat) {
      var item = bySeat[seat.seatId];
      if (!item) return;
      if (seat.assignedIdentityId && seat.assignedIdentityId !== item.reviewer.identityId) { issues.push('wrong-identity:' + seat.seatId); return; }
      if (constitution.requireIndependentIdentities && usedIdentities[item.reviewer.identityId]) { issues.push('identity-filled-multiple-seats:' + item.reviewer.identityId); return; }
      usedIdentities[item.reviewer.identityId] = true;
      valid.push(item);
    });
    var approvals = valid.filter(function (item) { return item.verdict === 'UP'; });
    var holds = valid.filter(function (item) { return item.verdict !== 'UP'; });
    var required = constitution.seats.filter(function (seat) { return seat.required; });
    var requiredApproved = required.every(function (seat) { return approvals.some(function (item) { return item.seatId === seat.seatId; }); });
    var permitted = constitution.rule === 'QUORUM' ? approvals.length >= constitution.quorum && holds.length === 0 : requiredApproved && holds.length === 0;
    return {
      schema: DECISION_SCHEMA,
      constitutionId: constitution.constitutionId,
      artifact: { artifactId: artifactId, digest: digest },
      action: action,
      permitted: permitted,
      status: permitted ? 'REVIEW_GATE_PASSED' : 'HELD_FOR_REVIEW',
      label: permitted ? 'Selected review constitution satisfied.' : 'Selected review constitution not yet satisfied.',
      approvals: approvals.map(function (item) { return item.receiptId; }),
      holds: holds.map(function (item) { return item.receiptId; }),
      issues: issues
    };
  }

  return {
    VERSION: VERSION,
    CONSTITUTION_SCHEMA: CONSTITUTION_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    DECISION_SCHEMA: DECISION_SCHEMA,
    create: create,
    receipt: receipt,
    evaluate: evaluate
  };
});
