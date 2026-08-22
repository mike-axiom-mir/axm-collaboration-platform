'use strict';

const crypto = require('crypto');

const BUNDLE_SCHEMA = 'axm.research-contribution-bundle/v1';
const ASSESSMENT_SCHEMA = 'axm.research-contribution-assessment/v1';
const PROJECTION_SCHEMA = 'axm.research-contribution-simulation-projection/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SEAT_KINDS = ['HUMAN', 'MODEL', 'TOOL'];
const DISCLOSURE_STATES = ['EXACT', 'PARTIAL', 'UNDISCLOSED'];
const EXPOSURES = ['NONE', 'PARTIAL', 'FULL', 'UNKNOWN'];
const SIGNAL_STAGES = ['OBSERVED', 'SIMULATED', 'INFERENCE', 'UNKNOWN'];
const EVIDENCE_SURFACES = [
  'file-inspection', 'schema-validation', 'focused-execution',
  'live-visual-observation', 'frame-sequence', 'live-interaction',
  'restart-reload', 'sender-and-receiver-receipts',
  'allowed-and-denied-attempts', 'measured-telemetry',
  'hardware-telemetry', 'held-out-evaluation', 'acceptance-review',
  'human-steward-judgment', 'declared-evidence'
];
const PROPOSAL_DISPOSITIONS = [
  'REJECTED', 'REJECTED_AS_REDUNDANT', 'DEFERRED',
  'CANDIDATE_FOR_TEST', 'REUSE_EXISTING', 'UNKNOWN'
];
const TRUTH_KEYS = [
  'artifactBytesEmbedded', 'packageCodeExecuted', 'modelInvoked',
  'crossModelAgreementIsProof', 'automaticAcceptance', 'automaticBuild',
  'automaticPromotion', 'automaticCanon'
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}

function exactKeys(value, allowed, label) {
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(label + ' has unsupported field(s): ' + extra.join(', '));
}

function text(value, label, maximum) {
  const result = String(value == null ? '' : value).trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function portableId(value, label) {
  const result = text(value, label, 180);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(result)) throw new Error(label + ' is not a portable identifier');
  return result;
}

function timestamp(value, label) {
  const result = text(value, label, 80);
  if (!Number.isFinite(Date.parse(result))) throw new Error(label + ' is not a timestamp');
  return result;
}

function digest(value, label) {
  const result = String(value || '').toLowerCase();
  if (!DIGEST.test(result)) throw new Error(label + ' is not a sha256 digest');
  return result;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum);
  }
  return value;
}

function normalizeReference(value, label) {
  value = object(value, label);
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: portableId(value.id, label + ' id'),
    schema: text(value.schema, label + ' schema', 240),
    sha256: digest(value.sha256, label + ' digest')
  };
}

function reference(value, input) {
  input = input || {};
  return {
    id: portableId(input.id, 'reference id'),
    schema: text(input.schema, 'reference schema', 240),
    sha256: sha256(value)
  };
}

function normalizeIdList(values, label, maximum) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  if (values.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' entries');
  const result = values.map((value, index) => portableId(value, label + '[' + index + ']'));
  if (new Set(result).size !== result.length) throw new Error(label + ' contains duplicate ids');
  return result.sort();
}

function normalizeTextList(values, label, minimum, maximum) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  if (values.length < minimum || values.length > maximum) throw new Error(label + ' must contain ' + minimum + ' to ' + maximum + ' entries');
  const result = values.map((value, index) => text(value, label + '[' + index + ']', 800));
  if (new Set(result).size !== result.length) throw new Error(label + ' contains duplicate entries');
  return result.sort();
}

function normalizeSeats(values) {
  if (!Array.isArray(values) || !values.length) throw new Error('bundle seats needs at least one entry');
  if (values.length > 64) throw new Error('bundle seats exceeds 64 entries');
  const result = values.map((raw, index) => {
    const value = object(raw, 'bundle seats[' + index + ']');
    exactKeys(value, [
      'id', 'kind', 'role', 'providerFamily', 'modelId',
      'identityDisclosure', 'priorOutputExposure', 'provenanceRef', 'proofAuthority'
    ], 'bundle seats[' + index + ']');
    const kind = String(value.kind || '').toUpperCase();
    const disclosure = String(value.identityDisclosure || '').toUpperCase();
    const exposure = String(value.priorOutputExposure || '').toUpperCase();
    if (!SEAT_KINDS.includes(kind)) throw new Error('bundle seats[' + index + '] kind is unsupported');
    if (!DISCLOSURE_STATES.includes(disclosure)) throw new Error('bundle seats[' + index + '] identityDisclosure is unsupported');
    if (!EXPOSURES.includes(exposure)) throw new Error('bundle seats[' + index + '] priorOutputExposure is unsupported');
    if (value.proofAuthority !== 'NONE') throw new Error('bundle seats[' + index + '] proofAuthority must be NONE');
    return {
      id: portableId(value.id, 'bundle seats[' + index + '] id'),
      kind,
      role: text(value.role, 'bundle seats[' + index + '] role', 400),
      providerFamily: value.providerFamily == null ? null : text(value.providerFamily, 'bundle seats[' + index + '] providerFamily', 160),
      modelId: value.modelId == null ? null : portableId(value.modelId, 'bundle seats[' + index + '] modelId'),
      identityDisclosure: disclosure,
      priorOutputExposure: exposure,
      provenanceRef: normalizeReference(value.provenanceRef, 'bundle seats[' + index + '] provenanceRef'),
      proofAuthority: 'NONE'
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('bundle seats contains duplicate ids');
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeArtifacts(values, seatIds) {
  if (!Array.isArray(values) || !values.length) throw new Error('bundle artifacts needs at least one entry');
  if (values.length > 256) throw new Error('bundle artifacts exceeds 256 entries');
  const result = values.map((raw, index) => {
    const value = object(raw, 'bundle artifacts[' + index + ']');
    exactKeys(value, ['id', 'label', 'mediaType', 'bytes', 'sha256', 'reportedSeatIds'], 'bundle artifacts[' + index + ']');
    const reportedSeatIds = normalizeIdList(value.reportedSeatIds || [], 'bundle artifacts[' + index + '] reportedSeatIds', 64);
    reportedSeatIds.forEach(id => {
      if (!seatIds.has(id)) throw new Error('bundle artifacts[' + index + '] references unknown seat ' + id);
    });
    return {
      id: portableId(value.id, 'bundle artifacts[' + index + '] id'),
      label: text(value.label, 'bundle artifacts[' + index + '] label', 400),
      mediaType: text(value.mediaType, 'bundle artifacts[' + index + '] mediaType', 200),
      bytes: integer(value.bytes, 'bundle artifacts[' + index + '] bytes', 0, Number.MAX_SAFE_INTEGER),
      sha256: digest(value.sha256, 'bundle artifacts[' + index + '] sha256'),
      reportedSeatIds
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('bundle artifacts contains duplicate ids');
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeEvidenceSources(values) {
  if (!Array.isArray(values)) throw new Error('bundle evidenceSources must be an array');
  if (values.length > 256) throw new Error('bundle evidenceSources exceeds 256 entries');
  const result = values.map((raw, index) => {
    const value = object(raw, 'bundle evidenceSources[' + index + ']');
    exactKeys(value, ['id', 'ref', 'surface', 'claimKinds'], 'bundle evidenceSources[' + index + ']');
    const surface = String(value.surface || '').toLowerCase();
    if (!EVIDENCE_SURFACES.includes(surface)) throw new Error('bundle evidenceSources[' + index + '] surface is unsupported');
    return {
      id: portableId(value.id, 'bundle evidenceSources[' + index + '] id'),
      ref: normalizeReference(value.ref, 'bundle evidenceSources[' + index + '] ref'),
      surface,
      claimKinds: normalizeTextList(value.claimKinds || [], 'bundle evidenceSources[' + index + '] claimKinds', 1, 32)
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('bundle evidenceSources contains duplicate ids');
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeSignals(values, artifactIds, evidenceIds, seatIds, holds, warnings) {
  if (!Array.isArray(values) || !values.length) throw new Error('bundle signals needs at least one entry');
  if (values.length > 256) throw new Error('bundle signals exceeds 256 entries');
  const result = values.map((raw, index) => {
    const value = object(raw, 'bundle signals[' + index + ']');
    exactKeys(value, [
      'id', 'statement', 'evidenceStage', 'artifactIds', 'evidenceSourceIds',
      'seatIds', 'cheapestTest', 'uncertainty', 'solutionAlternatives',
      'contradictions', 'wildcard'
    ], 'bundle signals[' + index + ']');
    const id = portableId(value.id, 'bundle signals[' + index + '] id');
    const evidenceStage = String(value.evidenceStage || '').toUpperCase();
    if (!SIGNAL_STAGES.includes(evidenceStage)) throw new Error('bundle signals[' + index + '] evidenceStage is unsupported');
    const sourceArtifactIds = normalizeIdList(value.artifactIds || [], 'bundle signals[' + index + '] artifactIds', 256);
    const sourceEvidenceIds = normalizeIdList(value.evidenceSourceIds || [], 'bundle signals[' + index + '] evidenceSourceIds', 256);
    const sourceSeatIds = normalizeIdList(value.seatIds || [], 'bundle signals[' + index + '] seatIds', 64);
    sourceArtifactIds.forEach(sourceId => {
      if (!artifactIds.has(sourceId)) throw new Error('bundle signal ' + id + ' references unknown artifact ' + sourceId);
    });
    sourceEvidenceIds.forEach(sourceId => {
      if (!evidenceIds.has(sourceId)) throw new Error('bundle signal ' + id + ' references unknown evidence source ' + sourceId);
    });
    sourceSeatIds.forEach(sourceId => {
      if (!seatIds.has(sourceId)) throw new Error('bundle signal ' + id + ' references unknown seat ' + sourceId);
    });
    if (!sourceArtifactIds.length && !sourceEvidenceIds.length) throw new Error('bundle signal ' + id + ' needs an artifact or evidence source');
    if (!sourceSeatIds.length) warnings.push({ code: 'SIGNAL_ATTRIBUTION_MISSING', signalId: id });
    if (evidenceStage === 'OBSERVED' && !sourceEvidenceIds.length) {
      holds.push({ code: 'OBSERVED_SIGNAL_NATIVE_EVIDENCE_MISSING', signalId: id });
    }
    return {
      id,
      statement: text(value.statement, 'bundle signals[' + index + '] statement', 2400),
      evidenceStage,
      artifactIds: sourceArtifactIds,
      evidenceSourceIds: sourceEvidenceIds,
      seatIds: sourceSeatIds,
      cheapestTest: text(value.cheapestTest, 'bundle signals[' + index + '] cheapestTest', 1600),
      uncertainty: text(value.uncertainty, 'bundle signals[' + index + '] uncertainty', 1600),
      solutionAlternatives: normalizeTextList(value.solutionAlternatives || [], 'bundle signals[' + index + '] solutionAlternatives', 1, 24),
      contradictions: normalizeTextList(value.contradictions || [], 'bundle signals[' + index + '] contradictions', 0, 24),
      wildcard: value.wildcard === true
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('bundle signals contains duplicate ids');
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeProposals(values, artifactIds, evidenceIds, seatIds) {
  if (!Array.isArray(values)) throw new Error('bundle proposals must be an array');
  if (values.length > 256) throw new Error('bundle proposals exceeds 256 entries');
  const result = values.map((raw, index) => {
    const value = object(raw, 'bundle proposals[' + index + ']');
    exactKeys(value, ['id', 'statement', 'disposition', 'reason', 'artifactIds', 'evidenceSourceIds', 'seatIds'], 'bundle proposals[' + index + ']');
    const id = portableId(value.id, 'bundle proposals[' + index + '] id');
    const disposition = String(value.disposition || '').toUpperCase();
    if (!PROPOSAL_DISPOSITIONS.includes(disposition)) throw new Error('bundle proposal ' + id + ' disposition is unsupported');
    const sourceArtifactIds = normalizeIdList(value.artifactIds || [], 'bundle proposals[' + index + '] artifactIds', 256);
    const sourceEvidenceIds = normalizeIdList(value.evidenceSourceIds || [], 'bundle proposals[' + index + '] evidenceSourceIds', 256);
    const sourceSeatIds = normalizeIdList(value.seatIds || [], 'bundle proposals[' + index + '] seatIds', 64);
    sourceArtifactIds.forEach(sourceId => {
      if (!artifactIds.has(sourceId)) throw new Error('bundle proposal ' + id + ' references unknown artifact ' + sourceId);
    });
    sourceEvidenceIds.forEach(sourceId => {
      if (!evidenceIds.has(sourceId)) throw new Error('bundle proposal ' + id + ' references unknown evidence source ' + sourceId);
    });
    sourceSeatIds.forEach(sourceId => {
      if (!seatIds.has(sourceId)) throw new Error('bundle proposal ' + id + ' references unknown seat ' + sourceId);
    });
    return {
      id,
      statement: value.statement == null ? null : text(value.statement, 'bundle proposals[' + index + '] statement', 1600),
      disposition,
      reason: text(value.reason, 'bundle proposals[' + index + '] reason', 1600),
      artifactIds: sourceArtifactIds,
      evidenceSourceIds: sourceEvidenceIds,
      seatIds: sourceSeatIds
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('bundle proposals contains duplicate ids');
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeTruth(value) {
  value = object(value, 'bundle truth');
  exactKeys(value, TRUTH_KEYS, 'bundle truth');
  TRUTH_KEYS.forEach(key => {
    if (value[key] !== false) throw new Error('bundle truth ' + key + ' must be false');
  });
  return Object.fromEntries(TRUTH_KEYS.map(key => [key, false]));
}

function normalizeBundle(raw, holds, warnings) {
  const value = object(raw, 'bundle');
  exactKeys(value, [
    'schema', 'version', 'bundleId', 'baselineRef', 'sourceHandling',
    'artifacts', 'seats', 'evidenceSources', 'signals', 'proposals', 'truth'
  ], 'bundle');
  if (value.schema !== BUNDLE_SCHEMA) throw new Error('bundle schema is unsupported');
  if (value.version !== VERSION) throw new Error('bundle version is unsupported');
  if (value.sourceHandling !== 'DATA_ONLY_NO_PACKAGE_CODE_EXECUTION') throw new Error('bundle sourceHandling must keep package contents inert');
  const seats = normalizeSeats(value.seats);
  const seatIds = new Set(seats.map(item => item.id));
  const artifacts = normalizeArtifacts(value.artifacts, seatIds);
  const artifactIds = new Set(artifacts.map(item => item.id));
  const evidenceSources = normalizeEvidenceSources(value.evidenceSources || []);
  const evidenceIds = new Set(evidenceSources.map(item => item.id));
  const signals = normalizeSignals(value.signals, artifactIds, evidenceIds, seatIds, holds, warnings);
  const proposals = normalizeProposals(value.proposals || [], artifactIds, evidenceIds, seatIds);
  return {
    schema: BUNDLE_SCHEMA,
    version: VERSION,
    bundleId: portableId(value.bundleId, 'bundleId'),
    baselineRef: normalizeReference(value.baselineRef, 'bundle baselineRef'),
    sourceHandling: 'DATA_ONLY_NO_PACKAGE_CODE_EXECUTION',
    artifacts,
    seats,
    evidenceSources,
    signals,
    proposals,
    truth: normalizeTruth(value.truth)
  };
}

function buildProjection(bundle) {
  const artifactsById = new Map(bundle.artifacts.map(value => [value.id, value]));
  const evidenceById = new Map(bundle.evidenceSources.map(value => [value.id, value]));
  return {
    schema: PROJECTION_SCHEMA,
    baselineRef: bundle.baselineRef,
    newInformationRefs: bundle.artifacts.map(artifact => ({
      id: artifact.id,
      schema: artifact.mediaType,
      sha256: artifact.sha256
    })),
    evidenceSourceRefs: bundle.evidenceSources.map(source => source.ref),
    seats: bundle.seats,
    signals: bundle.signals.map(signal => ({
      id: signal.id,
      statement: signal.statement,
      evidenceStage: signal.evidenceStage,
      sourceRefs: signal.artifactIds.map(id => {
        const artifact = artifactsById.get(id);
        return { id: artifact.id, schema: artifact.mediaType, sha256: artifact.sha256 };
      }).concat(signal.evidenceSourceIds.map(id => evidenceById.get(id).ref)),
      seatIds: signal.seatIds,
      cheapestTest: signal.cheapestTest,
      uncertainty: signal.uncertainty,
      solutionAlternatives: signal.solutionAlternatives,
      contradictions: signal.contradictions,
      wildcard: signal.wildcard,
      truthWeight: 'NONE'
    })),
    truth: {
      baselineRunBuilt: false,
      evidenceReceiptBuilt: false,
      sourceExecuted: false,
      modelInvoked: false,
      agreementIsProof: false,
      readyToExecute: false,
      automaticAction: false
    }
  };
}

function buildAssessment(input) {
  input = object(input, 'assessment input');
  exactKeys(input, ['assessmentId', 'generatedAt', 'bundle'], 'assessment input');
  const holds = [];
  const warnings = [];
  const bundle = normalizeBundle(input.bundle, holds, warnings);
  const modelSeats = bundle.seats.filter(seat => seat.kind === 'MODEL');
  const unassignedArtifactIds = bundle.artifacts.filter(artifact => !artifact.reportedSeatIds.length).map(artifact => artifact.id);
  const assignedSeatIds = new Set(bundle.artifacts.flatMap(artifact => artifact.reportedSeatIds));
  const modelSeatsWithoutArtifacts = modelSeats.filter(seat => !assignedSeatIds.has(seat.id)).map(seat => seat.id);
  const artifactToSeatMappingEstablished = unassignedArtifactIds.length === 0;
  const exactModelIdentityEstablished = modelSeats.length > 0 && modelSeats.every(seat => seat.identityDisclosure === 'EXACT' && seat.modelId);
  const priorOutputIsolationEstablished = modelSeats.length > 0 && modelSeats.every(seat => seat.priorOutputExposure === 'NONE');
  const crossModelIndependenceEstablished = artifactToSeatMappingEstablished && exactModelIdentityEstablished && priorOutputIsolationEstablished;

  if (!artifactToSeatMappingEstablished) warnings.push({ code: 'ARTIFACT_TO_SEAT_MAPPING_NOT_ESTABLISHED', artifactIds: unassignedArtifactIds });
  if (!exactModelIdentityEstablished && modelSeats.length) warnings.push({ code: 'MODEL_IDENTITY_DISCLOSURE_GAP', seatIds: modelSeats.filter(seat => seat.identityDisclosure !== 'EXACT' || !seat.modelId).map(seat => seat.id) });
  if (!priorOutputIsolationEstablished && modelSeats.length) warnings.push({ code: 'PRIOR_OUTPUT_EXPOSURE_NOT_EXCLUDED', seatIds: modelSeats.filter(seat => seat.priorOutputExposure !== 'NONE').map(seat => seat.id) });
  if (modelSeats.length && !crossModelIndependenceEstablished) warnings.push({ code: 'CROSS_MODEL_INDEPENDENCE_NOT_ESTABLISHED' });

  warnings.sort((left, right) => (left.code + stableStringify(left)).localeCompare(right.code + stableStringify(right)));
  holds.sort((left, right) => (left.code + stableStringify(left)).localeCompare(right.code + stableStringify(right)));
  const assessment = {
    schema: ASSESSMENT_SCHEMA,
    version: VERSION,
    assessmentId: portableId(input.assessmentId, 'assessmentId'),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    state: holds.length ? 'HELD_FOR_EVIDENCE_REPAIR' : 'READY_FOR_BASELINE_SIMULATION_PLANNING',
    bundle,
    counts: {
      artifacts: bundle.artifacts.length,
      seats: bundle.seats.length,
      modelSeats: modelSeats.length,
      evidenceSources: bundle.evidenceSources.length,
      retainedSignals: bundle.signals.length,
      proposals: bundle.proposals.length,
      holds: holds.length,
      warnings: warnings.length
    },
    attributionAssessment: {
      artifactToSeatMappingEstablished,
      exactModelIdentityEstablished,
      priorOutputIsolationEstablished,
      crossModelIndependenceEstablished,
      unassignedArtifactIds,
      modelSeatsWithoutArtifacts,
      modelAgreementIsProof: false
    },
    holds,
    warnings,
    projection: buildProjection(bundle),
    truth: {
      staticIntegrityOnly: true,
      signalStagesPreservedNotPromoted: true,
      disagreementsPreserved: true,
      proposalDispositionPreserved: true,
      sourceExecuted: false,
      modelInvoked: false,
      baselineRunBuilt: false,
      runtimeBehaviorProven: false,
      learningImprovementProven: false,
      humanBenefitProven: false,
      automaticExecution: false,
      automaticAcceptance: false,
      automaticBuild: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    receiptDigest: null
  };
  const payload = clone(assessment);
  delete payload.receiptDigest;
  assessment.receiptDigest = sha256(payload);
  return assessment;
}

function verifyAssessment(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== ASSESSMENT_SCHEMA) return { pass: false, errors: ['assessment schema mismatch'] };
  if (receipt.version !== VERSION) errors.push('assessment version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildAssessment({
      assessmentId: receipt.assessmentId,
      generatedAt: receipt.generatedAt,
      bundle: receipt.bundle
    });
  } catch (error) {
    errors.push('assessment content invalid: ' + error.message);
  }
  if (rebuilt) {
    if (stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('assessment content or derived state mismatch');
    if (rebuilt.receiptDigest !== receipt.receiptDigest) errors.push('assessment receipt digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  BUNDLE_SCHEMA,
  ASSESSMENT_SCHEMA,
  PROJECTION_SCHEMA,
  VERSION,
  stableStringify,
  sha256,
  reference,
  buildAssessment,
  verifyAssessment
};
