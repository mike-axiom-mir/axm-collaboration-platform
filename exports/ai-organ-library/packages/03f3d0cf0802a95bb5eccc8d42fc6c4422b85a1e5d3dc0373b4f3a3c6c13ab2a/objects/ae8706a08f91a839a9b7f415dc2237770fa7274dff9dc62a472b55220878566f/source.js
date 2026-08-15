'use strict';

const crypto = require('crypto');
const Steward = require('./clone-role-steward-organ');

const ORGAN_ID = 'axm.mirror.organ/code-story-corpus-intake-v1';
const PACK_SCHEMA = 'axm.mirror.code-story-evidence-pack/v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-story-corpus-intake-receipt/v1';
const PARTITIONS = Object.freeze(['TRAIN', 'VALIDATION', 'HELD_OUT']);
const STATES = Object.freeze(['PASS', 'FAIL', 'NOT_RUN']);
const VERDICTS = Object.freeze([
  'ELIGIBLE_SHADOW_CORPUS_CANDIDATE',
  'DUPLICATE_REPLAY_NO_NEW_CANDIDATE',
  'HOLD_PARTITION_CONFLICT',
  'HOLD_ROLE_OR_LINEAGE',
  'HOLD_REPAIR_CONTAMINATION',
  'REFUSED_PACK_AUTHORITY',
  'HOLD_SOURCE_PERMISSION',
  'HOLD_TRACE_MISMATCH',
  'HOLD_EXECUTION_ISOLATION_UNPROVEN',
  'HOLD_BEHAVIOR_UNVERIFIED',
  'HOLD_REGRESSION_UNVERIFIED',
  'HOLD_STORY_REVIEW',
  'HOLD_NOVELTY_UNVERIFIED',
  'HOLD_USEFULNESS_REVIEW',
  'HOLD_REVIEWER_DEPENDENCE',
  'HOLD_NEGATIVE_CURRICULUM_NOT_BUILT'
]);
const REQUEST_AUTHORITY_KEYS = Object.freeze([
  'candidateExecution', 'evidenceAdmission', 'trainingAdmission', 'sourceWrite',
  'permissionGrant', 'installation', 'promotion', 'canon', 'worldAction'
]);
const OUTPUT_AUTHORITY = Object.freeze({
  privateCorpusWrite: false,
  candidateExecution: false,
  evidenceAdmission: false,
  trainingAdmission: false,
  mirrorSourceWrite: false,
  workshopSourceWrite: false,
  permissionGrant: false,
  installation: false,
  promotion: false,
  canon: false,
  worldAction: false
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex');
}

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, ...keys) { const result = copy(value); for (const key of keys) delete result[key]; return result; }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys.slice().sort())) throw new Error(label + ' fields changed');
}
function text(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u001f]/.test(value)) throw new Error(label + ' is invalid');
  return value;
}
function identity(value, label) {
  text(value, 160, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value)) throw new Error(label + ' is invalid');
  return value;
}
function sha(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value || ''))) throw new Error(label + ' must be a SHA-256 digest');
  return value;
}
function exactBooleanAuthority(value, keys, label) {
  exactKeys(value, keys, label);
  for (const key of keys) if (typeof value[key] !== 'boolean') throw new Error(label + ' flags must be boolean');
}
function state(value, label) {
  if (!STATES.includes(value)) throw new Error(label + ' changed');
}

function validateSource(source) {
  exactKeys(source, ['sourceId', 'sourceGroupId', 'authorKind', 'authorId', 'permission'], 'Code Story source');
  identity(source.sourceId, 'Code Story source identity');
  identity(source.sourceGroupId, 'Code Story source-group identity');
  if (!['HUMAN_STEWARD', 'AI_STEWARD_WITH_HUMAN_DIRECTION', 'INDEPENDENT_EXAMPLE_AUTHOR'].includes(source.authorKind)) throw new Error('Code Story author kind changed');
  identity(source.authorId, 'Code Story author identity');
  exactKeys(source.permission, ['state', 'scope', 'grantedByKind', 'grantedById', 'identityCertified', 'basis'], 'Code Story permission');
  if (!['ALLOWED', 'NOT_ALLOWED', 'UNKNOWN'].includes(source.permission.state)) throw new Error('Code Story permission state changed');
  if (source.permission.scope !== 'FUTURE_CODE_MIRROR_SHADOW_RESEARCH_ONLY') throw new Error('Code Story permission scope changed');
  if (source.permission.grantedByKind !== 'HUMAN_DECLARED_LOCAL' || source.permission.identityCertified !== false) throw new Error('Code Story permission attribution changed');
  identity(source.permission.grantedById, 'Code Story permission grantor');
  text(source.permission.basis, 1000, 'Code Story permission basis');
}

function validateTrace(trace) {
  exactKeys(trace, ['activityId', 'activityDigest', 'roleRegistryDigest', 'storySourceId', 'storySourceDigest', 'capabilityContractId', 'capabilityContractDigest', 'candidateDigest', 'candidateAuthorId'], 'Code Story trace');
  if (!/^clone-role-activity-[a-f0-9]{24}$/.test(trace.activityId)) throw new Error('Code Story activity identity is invalid');
  sha(trace.activityDigest, 'Code Story activity digest');
  sha(trace.roleRegistryDigest, 'Code Story role registry digest');
  identity(trace.storySourceId, 'Code Story story source identity');
  sha(trace.storySourceDigest, 'Code Story story source digest');
  identity(trace.capabilityContractId, 'Code Story capability contract identity');
  sha(trace.capabilityContractDigest, 'Code Story capability contract digest');
  sha(trace.candidateDigest, 'Code Story candidate digest');
  identity(trace.candidateAuthorId, 'Code Story candidate author identity');
}

function validateExecution(value) {
  exactKeys(value, ['candidateDigest', 'environmentId', 'environmentDigest', 'executorId', 'relationToCandidateAuthor', 'isolationState', 'state', 'receiptDigest'], 'Code Story execution evidence');
  sha(value.candidateDigest, 'execution candidate digest');
  identity(value.environmentId, 'execution environment identity');
  sha(value.environmentDigest, 'execution environment digest');
  identity(value.executorId, 'execution identity');
  if (!['SEPARATE_EXECUTOR', 'SAME_AUTHOR', 'UNKNOWN'].includes(value.relationToCandidateAuthor)) throw new Error('execution relation changed');
  if (!['VERIFIED_BOUNDED_ISOLATION', 'DECLARED_NOT_CERTIFIED', 'UNKNOWN'].includes(value.isolationState)) throw new Error('execution isolation state changed');
  state(value.state, 'execution state');
  sha(value.receiptDigest, 'execution receipt digest');
}

function validateBehavior(value) {
  exactKeys(value, ['candidateDigest', 'verifierId', 'relationToCandidateAuthor', 'state', 'receiptDigest'], 'Code Story behavior evidence');
  sha(value.candidateDigest, 'behavior candidate digest');
  identity(value.verifierId, 'behavior verifier identity');
  if (!['INDEPENDENT', 'SAME_BUILDER', 'UNKNOWN'].includes(value.relationToCandidateAuthor)) throw new Error('behavior verifier relation changed');
  state(value.state, 'behavior state');
  sha(value.receiptDigest, 'behavior receipt digest');
}

function validateRegression(value) {
  exactKeys(value, ['baselineId', 'baselineDigest', 'candidateDigest', 'verifierId', 'state', 'receiptDigest'], 'Code Story regression evidence');
  identity(value.baselineId, 'regression baseline identity');
  sha(value.baselineDigest, 'regression baseline digest');
  sha(value.candidateDigest, 'regression candidate digest');
  identity(value.verifierId, 'regression verifier identity');
  state(value.state, 'regression state');
  sha(value.receiptDigest, 'regression receipt digest');
}

function validateHumanReview(value, label) {
  exactKeys(value, ['reviewerKind', 'reviewerId', 'identityCertified', 'criteriaDigest', 'state'], label);
  if (value.reviewerKind !== 'HUMAN_DECLARED_LOCAL' || value.identityCertified !== false) throw new Error(label + ' attribution changed');
  identity(value.reviewerId, label + ' reviewer identity');
  sha(value.criteriaDigest, label + ' criteria digest');
  if (!['PASS', 'HOLD', 'NOT_REVIEWED'].includes(value.state)) throw new Error(label + ' state changed');
}

function validateReviews(reviews) {
  exactKeys(reviews, ['storyCoherence', 'novelty', 'usefulness'], 'Code Story reviews');
  validateHumanReview(reviews.storyCoherence, 'story coherence review');
  exactKeys(reviews.novelty, ['evaluatorId', 'relationToCandidateAuthor', 'heldOut', 'priorBoundaryDigest', 'state', 'receiptDigest'], 'novelty review');
  identity(reviews.novelty.evaluatorId, 'novelty evaluator identity');
  if (!['INDEPENDENT', 'SAME_AUTHOR', 'UNKNOWN'].includes(reviews.novelty.relationToCandidateAuthor) || typeof reviews.novelty.heldOut !== 'boolean') throw new Error('novelty review relation changed');
  sha(reviews.novelty.priorBoundaryDigest, 'novelty prior boundary digest');
  state(reviews.novelty.state, 'novelty review state');
  sha(reviews.novelty.receiptDigest, 'novelty review receipt digest');
  validateHumanReview(reviews.usefulness, 'usefulness review');
}

function validatePack(pack) {
  exactKeys(pack, ['schema', 'packId', 'packDigest', 'status', 'specialistId', 'source', 'partition', 'exampleClass', 'failureAxes', 'trace', 'execution', 'behavior', 'regression', 'reviews', 'requestedAuthority', 'boundary'], 'Code Story evidence pack');
  if (pack.schema !== PACK_SCHEMA || pack.status !== 'EXPERIMENTAL' || pack.specialistId !== 'future-code-mirror') throw new Error('Code Story pack identity changed');
  if (!PARTITIONS.includes(pack.partition)) throw new Error('Code Story partition changed');
  if (!['POSITIVE_INNOVATION', 'NEGATIVE_COUNTEREXAMPLE'].includes(pack.exampleClass)) throw new Error('Code Story example class changed');
  if (!Array.isArray(pack.failureAxes) || pack.failureAxes.length > 6 || new Set(pack.failureAxes).size !== pack.failureAxes.length || pack.failureAxes.some(axis => !['ROLE', 'STORY_COHERENCE', 'EXECUTION', 'BEHAVIOR', 'REGRESSION', 'NOVELTY', 'USEFULNESS'].includes(axis))) throw new Error('Code Story failure axes changed');
  if (pack.exampleClass === 'POSITIVE_INNOVATION' && pack.failureAxes.length) throw new Error('positive Code Story pack cannot declare failure axes');
  if (pack.exampleClass === 'NEGATIVE_COUNTEREXAMPLE' && !pack.failureAxes.length) throw new Error('negative Code Story pack needs a failure axis');
  validateSource(pack.source);
  validateTrace(pack.trace);
  validateExecution(pack.execution);
  validateBehavior(pack.behavior);
  validateRegression(pack.regression);
  validateReviews(pack.reviews);
  exactBooleanAuthority(pack.requestedAuthority, REQUEST_AUTHORITY_KEYS, 'Code Story requested authority');
  text(pack.boundary, 1600, 'Code Story pack boundary');
  const expected = digest(without(pack, 'packId', 'packDigest'));
  if (pack.packDigest !== expected || pack.packId !== 'code-story-pack-' + expected.slice(0, 24)) throw new Error('Code Story pack content address changed');
  return pack;
}

function sealPack(input) {
  exactKeys(input, ['status', 'specialistId', 'source', 'partition', 'exampleClass', 'failureAxes', 'trace', 'execution', 'behavior', 'regression', 'reviews', 'requestedAuthority', 'boundary'], 'unsealed Code Story pack');
  const pack = Object.assign({ schema: PACK_SCHEMA, packId: null, packDigest: null }, copy(input));
  pack.packDigest = digest(without(pack, 'packId', 'packDigest'));
  pack.packId = 'code-story-pack-' + pack.packDigest.slice(0, 24);
  return validatePack(pack);
}

function validateHistory(value) {
  if (!Array.isArray(value) || value.length > 1024) throw new Error('Code Story prior assignments are invalid');
  return value.map((item, index) => {
    exactKeys(item, ['sourceGroupId', 'partition', 'packDigest'], 'Code Story prior assignment ' + index);
    identity(item.sourceGroupId, 'prior source-group identity');
    if (!PARTITIONS.includes(item.partition)) throw new Error('prior Code Story partition changed');
    sha(item.packDigest, 'prior Code Story pack digest');
    return copy(item);
  });
}

function finding(code, severity, statement) { return { code, severity, statement }; }

function traceMatches(pack, activity, roleAssessment) {
  return pack.trace.activityId === activity.proposalId &&
    pack.trace.activityDigest === activity.proposalDigest &&
    pack.trace.roleRegistryDigest === roleAssessment.registry.registryDigest &&
    activity.story && activity.capability &&
    pack.trace.storySourceId === activity.story.sourceId &&
    pack.trace.storySourceDigest === activity.story.sourceDigest &&
    pack.trace.capabilityContractId === activity.capability.contractId &&
    pack.trace.capabilityContractDigest === activity.capability.contractDigest &&
    pack.trace.candidateDigest === activity.capability.candidateDigest &&
    pack.trace.candidateAuthorId === activity.capability.candidateAuthorId &&
    pack.execution.candidateDigest === activity.capability.candidateDigest &&
    pack.behavior.candidateDigest === activity.capability.candidateDigest &&
    pack.regression.candidateDigest === activity.capability.candidateDigest &&
    pack.behavior.verifierId === activity.capability.verification.verifierId &&
    pack.behavior.relationToCandidateAuthor === activity.capability.verification.relationToCandidateAuthor &&
    pack.behavior.state === activity.capability.verification.state &&
    pack.behavior.receiptDigest === activity.capability.verification.evidenceDigest;
}

function assess(options = {}) {
  const pack = validatePack(copy(options.pack));
  const activity = Steward.validateActivity(copy(options.activity));
  const priorAssignments = validateHistory(options.priorAssignments || []);
  const roleAssessment = Steward.assess({
    root: options.root,
    workshopRoot: options.workshopRoot,
    registryPath: options.registryPath,
    activity
  });
  const findings = [];
  let verdict = null;

  if (activity.cloneId !== 'future-code-mirror' || activity.activityKind !== 'CAPABILITY_STORY_PROPOSAL' || activity.repair !== null) {
    verdict = 'HOLD_REPAIR_CONTAMINATION';
    findings.push(finding('NOT_FUTURE_CODE_MIRROR_INNOVATION_TRACE', 'HOLD', 'Repair or another clone role cannot enter the Code Story corpus.'));
  } else if (roleAssessment.verdict === 'HOLD_CAPABILITY_UNVERIFIED') {
    verdict = 'HOLD_BEHAVIOR_UNVERIFIED';
    findings.push(finding('CAPABILITY_BEHAVIOR_NOT_INDEPENDENTLY_VERIFIED', 'HOLD', 'The role trace itself lacks a passing verifier distinct from the candidate author.'));
  } else if (roleAssessment.verdict !== 'ROLE_ALIGNED_PROPOSAL_ONLY') {
    verdict = 'HOLD_ROLE_OR_LINEAGE';
    findings.push(finding('ROLE_ASSESSMENT_NOT_ALIGNED', 'HOLD', 'The exact current role lineage did not admit this activity as a Future Code Mirror proposal.'));
  } else if (Object.values(pack.requestedAuthority).some(Boolean)) {
    verdict = 'REFUSED_PACK_AUTHORITY';
    findings.push(finding('PACK_REQUESTED_AUTHORITY', 'REFUSE', 'A Code Story evidence pack cannot request execution, evidence, training, write, permission, installation, promotion, CANON, or world authority.'));
  } else if (pack.source.permission.state !== 'ALLOWED') {
    verdict = 'HOLD_SOURCE_PERMISSION';
    findings.push(finding('SOURCE_USE_NOT_ALLOWED', 'HOLD', 'Exact source use permission for Future Code Mirror shadow research is absent.'));
  } else if (!traceMatches(pack, activity, roleAssessment)) {
    verdict = 'HOLD_TRACE_MISMATCH';
    findings.push(finding('STORY_CAPABILITY_EVIDENCE_TRACE_DIVERGED', 'HOLD', 'Story, capability, candidate, role registry, and behavior evidence must be one exact trace.'));
  }

  const groupHistory = priorAssignments.filter(item => item.sourceGroupId === pack.source.sourceGroupId);
  if (!verdict && groupHistory.some(item => item.partition !== pack.partition)) {
    verdict = 'HOLD_PARTITION_CONFLICT';
    findings.push(finding('SOURCE_GROUP_PARTITION_CHANGED', 'HOLD', 'A Code Story source group cannot move between TRAIN, VALIDATION, and HELD_OUT.'));
  } else if (!verdict && groupHistory.some(item => item.partition === pack.partition && item.packDigest === pack.packDigest)) {
    verdict = 'DUPLICATE_REPLAY_NO_NEW_CANDIDATE';
    findings.push(finding('EXACT_PACK_ALREADY_OBSERVED', 'INFO', 'Exact replay produces no new corpus candidate.'));
  } else if (!verdict && pack.exampleClass === 'NEGATIVE_COUNTEREXAMPLE') {
    verdict = 'HOLD_NEGATIVE_CURRICULUM_NOT_BUILT';
    findings.push(finding('NEGATIVE_CODE_STORY_CURRICULUM_MISSING', 'HOLD', 'The negative-example curriculum and label verifier are not built, so a failed example cannot silently become training data.'));
  } else if (!verdict && (pack.execution.state !== 'PASS' || pack.execution.isolationState !== 'VERIFIED_BOUNDED_ISOLATION' || pack.execution.relationToCandidateAuthor !== 'SEPARATE_EXECUTOR')) {
    verdict = 'HOLD_EXECUTION_ISOLATION_UNPROVEN';
    findings.push(finding('DISPOSABLE_EXECUTION_NOT_VERIFIED', 'HOLD', 'The exact candidate needs a passing receipt from a separately operated verified bounded isolation environment.'));
  } else if (!verdict && (pack.behavior.state !== 'PASS' || pack.behavior.relationToCandidateAuthor !== 'INDEPENDENT')) {
    verdict = 'HOLD_BEHAVIOR_UNVERIFIED';
    findings.push(finding('CAPABILITY_BEHAVIOR_NOT_INDEPENDENTLY_VERIFIED', 'HOLD', 'Working capability behavior needs a passing verifier distinct from the candidate author.'));
  } else if (!verdict && pack.regression.state !== 'PASS') {
    verdict = 'HOLD_REGRESSION_UNVERIFIED';
    findings.push(finding('REGRESSION_EVIDENCE_NOT_PASSING', 'HOLD', 'A new capability cannot enter the corpus without preserving its declared baseline.'));
  } else if (!verdict && pack.reviews.storyCoherence.state !== 'PASS') {
    verdict = 'HOLD_STORY_REVIEW';
    findings.push(finding('STORY_COHERENCE_NOT_HUMAN_APPROVED', 'HOLD', 'A capability does not become a good code story without explicit human coherence review.'));
  } else if (!verdict && (pack.reviews.novelty.state !== 'PASS' || pack.reviews.novelty.heldOut !== true || pack.reviews.novelty.relationToCandidateAuthor !== 'INDEPENDENT')) {
    verdict = 'HOLD_NOVELTY_UNVERIFIED';
    findings.push(finding('NOVELTY_HELD_OUT_EVIDENCE_NOT_PASSING', 'HOLD', 'Novelty needs a separately authored held-out comparison against an exact prior boundary.'));
  } else if (!verdict && pack.reviews.usefulness.state !== 'PASS') {
    verdict = 'HOLD_USEFULNESS_REVIEW';
    findings.push(finding('USEFULNESS_NOT_HUMAN_APPROVED', 'HOLD', 'Usefulness remains a human judgment tied to the verified capability.'));
  }

  const author = pack.trace.candidateAuthorId;
  const dependent = pack.execution.executorId === author ||
    pack.behavior.verifierId === author ||
    pack.regression.verifierId === author ||
    pack.reviews.novelty.evaluatorId === author ||
    pack.reviews.novelty.evaluatorId === pack.behavior.verifierId ||
    pack.reviews.storyCoherence.reviewerId === author ||
    pack.reviews.usefulness.reviewerId === author;
  if (!verdict && dependent) {
    verdict = 'HOLD_REVIEWER_DEPENDENCE';
    findings.push(finding('CANDIDATE_AUTHOR_OR_VERIFIERS_NOT_SEPARATE', 'HOLD', 'Candidate authoring, behavior verification, novelty evaluation, and human judgment seats must not collapse into one self-review.'));
  }

  if (!verdict) {
    verdict = 'ELIGIBLE_SHADOW_CORPUS_CANDIDATE';
    findings.push(finding('COMPLETE_POSITIVE_CODE_STORY_EVIDENCE_SHAPE', 'INFO', 'The pack is structurally eligible for separate shadow-corpus review; it is not admitted to training.'));
  }
  if (!VERDICTS.includes(verdict)) throw new Error('Code Story verdict escaped its closed set');

  const eligible = verdict === 'ELIGIBLE_SHADOW_CORPUS_CANDIDATE';
  const basis = {
    schema: RECEIPT_SCHEMA,
    status: 'TEST',
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    pack: { packId: pack.packId, packDigest: pack.packDigest, sourceId: pack.source.sourceId, sourceGroupId: pack.source.sourceGroupId, partition: pack.partition, exampleClass: pack.exampleClass },
    role: { assessmentId: roleAssessment.assessmentId, assessmentDigest: roleAssessment.assessmentDigest, verdict: roleAssessment.verdict, registryDigest: roleAssessment.registry.registryDigest },
    verdict,
    findings,
    sourceGroupAssignment: { sourceGroupId: pack.source.sourceGroupId, requestedPartition: pack.partition, priorAssignmentsObserved: groupHistory.length, immutableFirstObservedPartitionRequired: true },
    evidenceStates: {
      permission: pack.source.permission.state,
      execution: pack.execution.state,
      isolation: pack.execution.isolationState,
      behavior: pack.behavior.state,
      regression: pack.regression.state,
      storyCoherence: pack.reviews.storyCoherence.state,
      novelty: pack.reviews.novelty.state,
      usefulness: pack.reviews.usefulness.state
    },
    views: {
      human: { story: activity.story ? activity.story.statement : null, coherenceReview: pack.reviews.storyCoherence.state, usefulnessReview: pack.reviews.usefulness.state, nonAuthoritative: true },
      machine: { activityDigest: activity.proposalDigest, candidateDigest: pack.trace.candidateDigest, behaviorReceiptDigest: pack.behavior.receiptDigest, regressionReceiptDigest: pack.regression.receiptDigest, noveltyReceiptDigest: pack.reviews.novelty.receiptDigest, priorBoundaryDigest: pack.reviews.novelty.priorBoundaryDigest }
    },
    corpusCandidate: eligible ? {
      sourceGroupId: pack.source.sourceGroupId,
      partition: pack.partition,
      packDigest: pack.packDigest,
      candidateDigest: pack.trace.candidateDigest,
      exampleClass: pack.exampleClass,
      permittedUse: 'SHADOW_CORPUS_REVIEW_ONLY_NOT_ADMITTED'
    } : null,
    authority: copy(OUTPUT_AUTHORITY),
    limitations: [
      'This organ verifies closed fields, content addresses, declared relations, and current role lineage; it cannot certify that any submitted receipt, identity, permission, isolation, authorship, or human judgment is genuine.',
      'Eligibility is not evidence admission, training admission, a learner update, capability proof, novelty proof, usefulness proof, installation, promotion, CANON, or world authority.',
      'The v1 negative-example curriculum is intentionally not built; failed examples remain held instead of receiving guessed labels.',
      'Complete historical partition discovery is external to this pure organ; callers must supply every prior assignment and a future persistent intake must verify that history.'
    ],
    boundary: 'Classifies one content-addressed positive Code Story evidence pack against current clone-role lineage and supplied partition history. It executes no candidate, writes no corpus or source, admits no evidence or training, changes no model, grants no permission, installs or promotes nothing, changes no CANON, and performs no world action.'
  };
  const receiptDigest = digest(basis);
  return Object.assign({ receiptId: 'code-story-intake-' + receiptDigest.slice(0, 24), receiptDigest }, basis);
}

module.exports = {
  ORGAN_ID,
  PACK_SCHEMA,
  RECEIPT_SCHEMA,
  PARTITIONS,
  STATES,
  VERDICTS,
  REQUEST_AUTHORITY_KEYS,
  OUTPUT_AUTHORITY,
  stable,
  digest,
  validatePack,
  sealPack,
  validateHistory,
  assess
};
