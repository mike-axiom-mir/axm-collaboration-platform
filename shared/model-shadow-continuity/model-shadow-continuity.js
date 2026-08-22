'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

const SNAPSHOT_SCHEMA = 'axm.model-shadow-snapshot/v1';
const RECEIPT_SCHEMA = 'axm.model-shadow-continuity-receipt/v1';
const COMPARISON_SCHEMA = 'axm.model-shadow-comparison/v1';
const PROJECTION_SCHEMA = 'axm.model-shadow-simulation-projection/v1';
const REVIEW_PROJECTION_SCHEMA = 'axm.model-shadow-review-projection/v1';
const REVIEW_ACTION_SCHEMA = 'axm.model-shadow-review-action/v1';
const VERSION = '0.1.0';
const STATUS = 'TEST';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const COMMITMENT_KINDS = ['CLAIM', 'CONSTRAINT', 'DECISION', 'UNKNOWN'];
const POSITIONS = ['AFFIRM', 'REJECT', 'HOLD', 'UNKNOWN', 'NOT_APPLICABLE'];
const EVIDENCE_STAGES = ['OBSERVED', 'SIMULATED', 'INFERENCE', 'UNKNOWN'];
const UNCERTAINTY_STATES = ['DECLARED', 'NOT_DECLARED', 'UNKNOWN'];
const IDENTITY_DISCLOSURES = ['EXACT', 'PARTIAL', 'UNDISCLOSED'];
const EXPOSURES = ['NONE', 'PARTIAL', 'FULL', 'UNKNOWN'];
const AUTHORITY_ACTIONS = [
  'EXECUTE', 'INSTALL', 'GRANT_PERMISSION', 'PROMOTE', 'CANON',
  'ROOT_MUTATION', 'FOUNDATION_MUTATION', 'MODEL_WEIGHT_TRAINING',
  'PUBLISH', 'PUSH'
];

function clone(value) {
  return JSON.parse(DeterministicJson.canonicalJson(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}

function exactKeys(value, allowed, label) {
  object(value, label);
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unsupported field(s): ' + extras.join(', '));
}

function text(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function portableId(value, label, maximum) {
  const result = text(value, label, maximum || 180);
  if (/^[a-z]:[\\/]/i.test(result) || /^[/\\]{1,2}/.test(result) || /^file:/i.test(result) || result.includes('\\')) {
    throw new Error(label + ' must be a portable logical identifier, not a machine path');
  }
  return result;
}

function timestamp(value, label) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(label + ' must be a valid timestamp');
  return parsed.toISOString();
}

function digest(value, label) {
  const result = String(value || '').toLowerCase();
  if (!DIGEST.test(result)) throw new Error(label + ' must be a lowercase SHA-256 digest');
  return result;
}

function normalizeReference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: portableId(value.id, label + '.id', 180),
    schema: text(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function referenceKey(value) {
  return value.id + '|' + value.schema + '|' + value.sha256;
}

function sameReference(left, right) {
  return referenceKey(left) === referenceKey(right);
}

function normalizeReferences(values, label, maximum) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  if (values.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' entries');
  const result = values.map((value, index) => normalizeReference(value, label + '[' + index + ']'));
  const keys = result.map(referenceKey);
  if (new Set(keys).size !== keys.length) throw new Error(label + ' contains duplicate references');
  return result.sort((left, right) => referenceKey(left).localeCompare(referenceKey(right)));
}

function normalizeIds(values, label, maximum) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  if (values.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' entries');
  const result = values.map((value, index) => portableId(value, label + '[' + index + ']', 180));
  if (new Set(result).size !== result.length) throw new Error(label + ' contains duplicate identifiers');
  return result.sort();
}

function enumValue(value, allowed, label) {
  const result = String(value || '').toUpperCase();
  if (!allowed.includes(result)) throw new Error(label + ' is unsupported');
  return result;
}

function normalizeSeat(value) {
  exactKeys(value, [
    'id', 'kind', 'role', 'providerFamily', 'modelId', 'identityDisclosure',
    'priorOutputExposure', 'provenanceRef', 'proofAuthority'
  ], 'seat');
  if (String(value.kind || '').toUpperCase() !== 'MODEL') throw new Error('seat.kind must be MODEL');
  if (value.proofAuthority !== 'NONE') throw new Error('seat.proofAuthority must be NONE');
  return {
    id: portableId(value.id, 'seat.id', 180),
    kind: 'MODEL',
    role: text(value.role, 'seat.role', 240),
    providerFamily: value.providerFamily == null ? null : portableId(value.providerFamily, 'seat.providerFamily', 120),
    modelId: value.modelId == null ? null : portableId(value.modelId, 'seat.modelId', 180),
    identityDisclosure: enumValue(value.identityDisclosure, IDENTITY_DISCLOSURES, 'seat.identityDisclosure'),
    priorOutputExposure: enumValue(value.priorOutputExposure, EXPOSURES, 'seat.priorOutputExposure'),
    provenanceRef: normalizeReference(value.provenanceRef, 'seat.provenanceRef'),
    proofAuthority: 'NONE'
  };
}

function normalizeCommitments(values) {
  if (!Array.isArray(values)) throw new Error('commitments must be an array');
  if (values.length > 32) throw new Error('commitments exceeds 32 entries');
  const result = values.map((value, index) => {
    const label = 'commitments[' + index + ']';
    exactKeys(value, [
      'id', 'kind', 'position', 'evidenceStage', 'contentDigest',
      'sourceRefs', 'uncertaintyState', 'authorityRequests'
    ], label);
    const authorityRequests = (value.authorityRequests || []).map((action, actionIndex) =>
      enumValue(portableId(action, label + '.authorityRequests[' + actionIndex + ']', 180), AUTHORITY_ACTIONS, label + '.authorityRequests')
    ).sort();
    if (authorityRequests.length > 16) throw new Error(label + '.authorityRequests exceeds 16 entries');
    if (new Set(authorityRequests).size !== authorityRequests.length) throw new Error(label + '.authorityRequests contains duplicate actions');
    return {
      id: portableId(value.id, label + '.id', 180),
      kind: enumValue(value.kind, COMMITMENT_KINDS, label + '.kind'),
      position: enumValue(value.position, POSITIONS, label + '.position'),
      evidenceStage: enumValue(value.evidenceStage, EVIDENCE_STAGES, label + '.evidenceStage'),
      contentDigest: digest(value.contentDigest, label + '.contentDigest'),
      sourceRefs: normalizeReferences(value.sourceRefs || [], label + '.sourceRefs', 16),
      uncertaintyState: enumValue(value.uncertaintyState, UNCERTAINTY_STATES, label + '.uncertaintyState'),
      authorityRequests
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('commitments contains duplicate identifiers');
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

function snapshotInput(snapshot) {
  return {
    snapshotId: snapshot.snapshotId,
    capturedAt: snapshot.capturedAt,
    taskRef: snapshot.taskRef,
    contextRef: snapshot.contextRef,
    seat: snapshot.seat,
    outputRef: snapshot.outputRef,
    commitments: snapshot.commitments,
    capabilities: snapshot.capabilities,
    requestedPermissions: snapshot.requestedPermissions
  };
}

function createSnapshot(input) {
  exactKeys(input, [
    'snapshotId', 'capturedAt', 'taskRef', 'contextRef', 'seat', 'outputRef',
    'commitments', 'capabilities', 'requestedPermissions'
  ], 'snapshot input');
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    snapshotId: portableId(input.snapshotId, 'snapshotId', 180),
    capturedAt: timestamp(input.capturedAt, 'capturedAt'),
    taskRef: normalizeReference(input.taskRef, 'taskRef'),
    contextRef: normalizeReference(input.contextRef, 'contextRef'),
    seat: normalizeSeat(input.seat),
    outputRef: normalizeReference(input.outputRef, 'outputRef'),
    commitments: normalizeCommitments(input.commitments),
    capabilities: normalizeIds(input.capabilities || [], 'capabilities', 32),
    requestedPermissions: normalizeIds(input.requestedPermissions || [], 'requestedPermissions', 16),
    truth: {
      structuredTraceOnly: true,
      rawOutputEmbedded: false,
      privateContextEmbedded: false,
      semanticMappingVerifiedByObserver: false,
      modelInvokedByObserver: false,
      proofAuthority: 'NONE'
    },
    snapshotDigest: null
  };
  const payload = clone(snapshot);
  delete payload.snapshotDigest;
  snapshot.snapshotDigest = sha256(payload);
  return snapshot;
}

function verifySnapshot(snapshot) {
  const errors = [];
  if (!snapshot || snapshot.schema !== SNAPSHOT_SCHEMA) return { pass: false, errors: ['snapshot schema mismatch'] };
  if (snapshot.version !== VERSION) errors.push('snapshot version mismatch');
  let rebuilt = null;
  try {
    rebuilt = createSnapshot(snapshotInput(snapshot));
  } catch (error) {
    errors.push('snapshot content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(snapshot)) errors.push('snapshot content or digest mismatch');
  return { pass: errors.length === 0, errors, rebuilt };
}

function snapshotReference(snapshot) {
  return { id: snapshot.snapshotId, schema: snapshot.schema, sha256: snapshot.snapshotDigest };
}

function arrayDifference(left, right) {
  const other = new Set(right);
  return left.filter(value => !other.has(value));
}

function identitySummary(snapshot) {
  const seat = snapshot.seat;
  const exact = seat.identityDisclosure === 'EXACT' && Boolean(seat.providerFamily) && Boolean(seat.modelId);
  return {
    seatId: seat.id,
    providerFamily: seat.providerFamily,
    modelId: seat.modelId,
    identityDisclosure: seat.identityDisclosure,
    provenanceRef: seat.provenanceRef,
    exact
  };
}

function identityMatches(left, right) {
  return left.exact && right.exact && left.seatId === right.seatId &&
    left.providerFamily === right.providerFamily && left.modelId === right.modelId &&
    sameReference(left.provenanceRef, right.provenanceRef);
}

function changedField(changes, field, before, after) {
  if (stableStringify(before) !== stableStringify(after)) changes.push({ field, before, after });
}

function commitmentDrift(baseline, candidate) {
  const before = new Map(baseline.commitments.map(value => [value.id, value]));
  const after = new Map(candidate.commitments.map(value => [value.id, value]));
  const ids = Array.from(new Set([...before.keys(), ...after.keys()])).sort();
  return ids.flatMap(id => {
    const left = before.get(id) || null;
    const right = after.get(id) || null;
    if (!left) return [{ commitmentId: id, state: 'ADDED', severity: right.authorityRequests.length ? 'CRITICAL' : 'REVIEW', changes: [] }];
    if (!right) return [{ commitmentId: id, state: 'REMOVED', severity: left.kind === 'CONSTRAINT' && left.position === 'AFFIRM' ? 'CRITICAL' : 'HIGH', changes: [] }];
    const changes = [];
    changedField(changes, 'kind', left.kind, right.kind);
    changedField(changes, 'position', left.position, right.position);
    changedField(changes, 'evidenceStage', left.evidenceStage, right.evidenceStage);
    changedField(changes, 'contentDigest', left.contentDigest, right.contentDigest);
    changedField(changes, 'sourceRefs', left.sourceRefs, right.sourceRefs);
    changedField(changes, 'uncertaintyState', left.uncertaintyState, right.uncertaintyState);
    changedField(changes, 'authorityRequests', left.authorityRequests, right.authorityRequests);
    if (!changes.length) return [];
    const authorityAdded = arrayDifference(right.authorityRequests, left.authorityRequests).length > 0;
    const boundaryLost = left.kind === 'CONSTRAINT' && left.position === 'AFFIRM' &&
      (right.kind !== 'CONSTRAINT' || right.position !== 'AFFIRM');
    const high = changes.some(change => ['kind', 'position', 'evidenceStage', 'uncertaintyState'].includes(change.field));
    return [{
      commitmentId: id,
      state: 'CHANGED',
      severity: authorityAdded || boundaryLost ? 'CRITICAL' : high ? 'HIGH' : 'REVIEW',
      changes
    }];
  });
}

function hold(code, detail) {
  return { code, detail };
}

function comparisonSignalRows(comparison) {
  const rows = comparison.commitmentDrift.map(row => ({
    kind: 'COMMITMENT',
    key: row.commitmentId,
    severity: row.severity,
    statement: 'Structured commitment ' + row.commitmentId + ' was ' + row.state + ' between exact snapshots.'
  }));
  if (comparison.capabilityDrift.added.length || comparison.capabilityDrift.removed.length) {
    rows.push({
      kind: 'CAPABILITY_SET',
      key: 'declared-capabilities',
      severity: 'REVIEW',
      statement: 'The declared capability identifier set changed between exact snapshots.'
    });
  }
  if (comparison.permissionDrift.added.length || comparison.permissionDrift.removed.length) {
    rows.push({
      kind: 'PERMISSION_SET',
      key: 'requested-permissions',
      severity: comparison.permissionDrift.added.length ? 'CRITICAL' : 'HIGH',
      statement: 'The requested permission identifier set changed between exact snapshots.'
    });
  }
  return rows;
}

function buildProjection(baseline, candidate, comparisonRef, comparison, validComparison) {
  const signals = validComparison ? comparisonSignalRows(comparison).map((row, index) => ({
    id: 'model-shadow-signal-' + String(index + 1).padStart(3, '0'),
    statement: row.statement,
    evidenceStage: 'INFERENCE',
    sourceRefs: [comparisonRef],
    seatIds: [candidate.seat.id],
    cheapestTest: 'Repeat the same declared task and exact context with an independently captured structured snapshot, then compare exact digests.',
    uncertainty: 'The structured difference is visible; its cause, semantic correctness, generality, and human impact remain unknown.',
    solutionAlternatives: [
      'Preserve the baseline behavior while gathering separate evidence.',
      'Review the candidate behavior with independent tests before any adoption.'
    ],
    contradictions: [],
    wildcard: false
  })) : [];
  return {
    schema: PROJECTION_SCHEMA,
    baselineSnapshotRef: snapshotReference(baseline),
    candidateSnapshotRef: snapshotReference(candidate),
    newInformationRefs: validComparison && signals.length ? [comparisonRef] : [],
    seats: [candidate.seat],
    signals,
    truth: {
      baselineRunBuilt: false,
      evidenceReceiptBuilt: false,
      rawOutputEmbedded: false,
      privateContextEmbedded: false,
      modelInvoked: false,
      driftClaimedAsFailure: false,
      agreementClaimedAsProof: false,
      semanticCorrectnessProven: false,
      learningImprovementProven: false,
      humanBenefitProven: false,
      readyToExecute: false,
      automaticAction: false
    }
  };
}

function buildReviewProjection(observationId, baseline, candidate, comparisonRef, classification) {
  return {
    schema: REVIEW_PROJECTION_SCHEMA,
    kind: 'model-shadow-continuity-observation',
    sourceRef: 'model-shadow-continuity:' + observationId,
    artifactDigest: comparisonRef.sha256.slice('sha256:'.length),
    title: 'Model shadow continuity · ' + candidate.seat.id,
    summary: classification === 'STRUCTURED_TRACE_MATCH'
      ? 'The declared structured trace matched. Raw output equivalence, correctness, persistent identity, and human value were not tested.'
      : 'Structured snapshot comparison needs review. No raw output, private context, or review note is embedded.',
    requiredSeats: 1,
    action: {
      schema: REVIEW_ACTION_SCHEMA,
      observationId,
      baselineSnapshotDigest: baseline.snapshotDigest,
      candidateSnapshotDigest: candidate.snapshotDigest,
      comparisonDigest: comparisonRef.sha256,
      classification,
      semanticCorrectnessProven: false,
      humanBenefitProven: false,
      adoptionAuthorized: false
    },
    truth: {
      submittedToReviewInbox: false,
      reviewNoteIncluded: false,
      humanDecisionRecorded: false,
      automaticAction: false
    }
  };
}

function buildObservation(input) {
  exactKeys(input, ['observationId', 'observedAt', 'baselineSnapshot', 'candidateSnapshot'], 'observation input');
  const baselineVerification = verifySnapshot(input.baselineSnapshot);
  const candidateVerification = verifySnapshot(input.candidateSnapshot);
  if (!baselineVerification.pass) throw new Error('baseline snapshot is invalid: ' + baselineVerification.errors.join('; '));
  if (!candidateVerification.pass) throw new Error('candidate snapshot is invalid: ' + candidateVerification.errors.join('; '));
  const baseline = baselineVerification.rebuilt;
  const candidate = candidateVerification.rebuilt;
  const observationId = portableId(input.observationId, 'observationId', 180);
  const observedAt = timestamp(input.observedAt, 'observedAt');
  const holds = [];
  const taskMatch = sameReference(baseline.taskRef, candidate.taskRef);
  const contextMatch = sameReference(baseline.contextRef, candidate.contextRef);
  const outputArtifactMatch = sameReference(baseline.outputRef, candidate.outputRef);
  const baselineIdentity = identitySummary(baseline);
  const candidateIdentity = identitySummary(candidate);
  const identityMatch = identityMatches(baselineIdentity, candidateIdentity);
  const forwardSequence = Date.parse(candidate.capturedAt) > Date.parse(baseline.capturedAt) &&
    Date.parse(observedAt) >= Date.parse(candidate.capturedAt);
  if (!taskMatch) holds.push(hold('TASK_REFERENCE_MISMATCH', 'Snapshots do not bind the same exact task reference.'));
  if (!contextMatch) holds.push(hold('CONTEXT_REFERENCE_MISMATCH', 'Snapshots do not bind the same exact context reference.'));
  if (!baselineIdentity.exact || !candidateIdentity.exact) holds.push(hold('MODEL_IDENTITY_NOT_EXACT', 'Both snapshots need exact declared provider and model identity.'));
  else if (!identityMatch) holds.push(hold('MODEL_SEAT_IDENTITY_MISMATCH', 'Snapshots do not bind the same exact model seat identity and provenance.'));
  if (!forwardSequence) holds.push(hold('NON_FORWARD_SEQUENCE', 'Candidate capture and observation times must follow the baseline capture.'));

  const commitmentRows = commitmentDrift(baseline, candidate);
  const capabilityDrift = {
    removed: arrayDifference(baseline.capabilities, candidate.capabilities),
    added: arrayDifference(candidate.capabilities, baseline.capabilities)
  };
  const permissionDrift = {
    removed: arrayDifference(baseline.requestedPermissions, candidate.requestedPermissions),
    added: arrayDifference(candidate.requestedPermissions, baseline.requestedPermissions)
  };
  const sourceDrift = commitmentRows.filter(row => row.changes.some(change => change.field === 'sourceRefs')).map(row => row.commitmentId);
  const criticalRows = commitmentRows.filter(row => row.severity === 'CRITICAL').map(row => row.commitmentId);
  const criticalAuthorityDrift = permissionDrift.added.length > 0 || criticalRows.length > 0;
  let classification;
  if (!taskMatch) classification = 'HOLD_TASK_MISMATCH';
  else if (!contextMatch) classification = 'CONTEXT_CHANGED_COMPARISON_NOT_VALID';
  else if (!identityMatch) classification = 'IDENTITY_CHANGED_COMPARISON_NOT_VALID';
  else if (!forwardSequence) classification = 'HOLD_NON_FORWARD_SEQUENCE';
  else if (criticalAuthorityDrift) classification = 'CRITICAL_DRIFT';
  else if (commitmentRows.length || capabilityDrift.removed.length || capabilityDrift.added.length || permissionDrift.removed.length) classification = 'DRIFT_DETECTED';
  else classification = 'STRUCTURED_TRACE_MATCH';
  const validComparison = holds.length === 0;
  const comparisonCore = {
    schema: COMPARISON_SCHEMA,
    scope: 'DECLARED_STRUCTURED_TRACE_ONLY',
    baselineSnapshotRef: snapshotReference(baseline),
    candidateSnapshotRef: snapshotReference(candidate),
    taskMatch,
    contextMatch,
    outputArtifactMatch,
    identityMatch,
    forwardSequence,
    holds,
    commitmentDrift: commitmentRows,
    capabilityDrift,
    permissionDrift,
    sourceLineageDriftCommitmentIds: sourceDrift,
    criticalCommitmentIds: criticalRows,
    criticalAuthorityDrift,
    validComparison
  };
  const comparisonRef = {
    id: 'model-shadow-comparison:' + observationId,
    schema: COMPARISON_SCHEMA,
    sha256: sha256(comparisonCore)
  };
  const projection = buildProjection(baseline, candidate, comparisonRef, comparisonCore, validComparison);
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    observationId,
    observedAt,
    status: STATUS,
    baselineSnapshot: baseline,
    candidateSnapshot: candidate,
    comparison: comparisonCore,
    comparisonRef,
    decision: {
      classification,
      validComparison,
      reviewRequired: classification !== 'STRUCTURED_TRACE_MATCH',
      currentBestAction: classification === 'STRUCTURED_TRACE_MATCH'
        ? 'PRESERVE_MATCH_RECEIPT_AND_CONTINUE_ONLY_ON_NEW_INFORMATION'
        : validComparison
          ? 'REVIEW_STRUCTURED_DRIFT_WITH_NATIVE_EVIDENCE'
          : 'REPAIR_COMPARISON_INPUTS_BEFORE_INTERPRETING_DRIFT',
      autonomousActionCount: 0
    },
    projection,
    reviewProjection: buildReviewProjection(observationId, baseline, candidate, comparisonRef, classification),
    truth: {
      structuredTraceOnly: true,
      rawOutputEmbedded: false,
      privateContextEmbedded: false,
      rawOutputArtifactCompared: false,
      freeTextSemanticEquivalenceInferred: false,
      sameModelMindClaimed: false,
      modelInvoked: false,
      providerTransportPerformed: false,
      reviewSubmitted: false,
      humanReviewPerformed: false,
      semanticCorrectnessProven: false,
      learningImprovementProven: false,
      humanBenefitProven: false,
      modelWeightTrainingPerformed: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return receipt;
}

function verifyObservation(input, receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA) return { pass: false, errors: ['receipt schema mismatch'] };
  let rebuilt = null;
  try {
    rebuilt = buildObservation(input);
  } catch (error) {
    errors.push('observation input invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('receipt content or digest mismatch');
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  SNAPSHOT_SCHEMA,
  RECEIPT_SCHEMA,
  COMPARISON_SCHEMA,
  PROJECTION_SCHEMA,
  REVIEW_PROJECTION_SCHEMA,
  REVIEW_ACTION_SCHEMA,
  VERSION,
  STATUS,
  AUTHORITY_ACTIONS,
  clone,
  stableStringify,
  sha256,
  createSnapshot,
  verifySnapshot,
  buildObservation,
  verifyObservation
};
