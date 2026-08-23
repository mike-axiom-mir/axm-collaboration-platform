'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Semantic = require('./semantic-candidate-generator-v1');
const Readiness = require('./code-capability-readiness-v1');
const DeterministicJson = require('../../tools/deterministic-json-core');
const Nursery = require('../../tools/detached-candidate-nursery/core/nursery-core');

const VERSION = '0.1.0';
const TRUST_POLICY_SCHEMA = 'axm.human-decision-trust-policy/v1';
const SUBJECT_SCHEMA = 'axm.semantic-candidate-materialization-subject/v1';
const DECISION_SCHEMA = 'axm.authenticated-human-decision/v1';
const REVOCATION_SCHEMA = 'axm.human-decision-revocation-snapshot/v1';
const EVALUATION_SCHEMA = 'axm.authenticated-human-decision-evaluation/v1';
const RESERVATION_SCHEMA = 'axm.human-decision-replay-reservation/v1';
const RECEIPT_SCHEMA = 'axm.semantic-candidate-materialization-receipt/v1';
const SCOPE = 'TIER_1_CREATE_ONE_DETACHED_CANDIDATE';
const LEDGER_DIRECTORY = '.axm-tier1-nonce-ledger';
const ROOT_PREFIX = 'axm-semantic-candidate-';
const MAX_DECISION_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REVOCATION_AGE_MS = 60 * 60 * 1000;
const ROOTS = Object.freeze(['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);
const CHOICES = Object.freeze(['AUTHORIZE', 'HOLD', 'REJECT']);
const READY_STATUS = 'READY_FOR_REPLAY_RESERVATION';
const EVALUATION_STATUSES = Object.freeze([
  READY_STATUS, 'TRUST_POLICY_HOLD', 'SUBJECT_HOLD', 'SIGNATURE_HOLD', 'TIME_HOLD',
  'ROOTS_HOLD', 'REVOCATION_HOLD', 'REVOKED', 'HUMAN_HOLD', 'HUMAN_REJECTED'
]);
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const ROOT_NAME = /^axm-semantic-candidate-[a-z0-9][a-z0-9-]{1,79}-[a-f0-9]{12}$/;

const LIMITATIONS = Object.freeze([
  'AUTHENTICATION_IS_RELATIVE_TO_THE_HOST_SELECTED_TRUST_POLICY',
  'NATURAL_PERSON_IDENTITY_NOT_PROVEN',
  'INFORMED_UNDERSTANDING_NOT_PROVEN',
  'HOST_CLOCK_NOT_INDEPENDENTLY_TRUSTED',
  'REPLAY_PREVENTION_IS_SCOPED_TO_ONE_HOST_BOUND_NURSERY_LEDGER',
  'FOUR_ROOT_EVIDENCE_CONTENT_NOT_REVERIFIED',
  'ONE_NATIVE_REVIEW_CARD_RECIPE_ONLY',
  'BOUNDED_PROGRAM_TO_SEMANTIC_REQUEST_BRIDGE_NOT_IMPLEMENTED',
  'GENERATED_SOURCE_DIRECT_REUSE_RIGHTS_HELD',
  'CANDIDATE_CODE_NOT_EXECUTED',
  'RUNTIME_BEHAVIOR_NOT_PROVEN',
  'VISUAL_BEHAVIOR_NOT_PROVEN',
  'DURATION_NOT_INDEPENDENTLY_ENFORCED',
  'MEMORY_NOT_INDEPENDENTLY_ENFORCED',
  'INSTALLATION_NOT_AUTHORIZED',
  'INTEGRATION_NOT_AUTHORIZED',
  'PUBLICATION_NOT_AUTHORIZED',
  'PERSISTENT_LEARNING_NOT_AUTHORIZED',
  'PHYSICAL_ACTUATION_NOT_AUTHORIZED',
  'PROMOTION_NOT_AUTHORIZED',
  'CANON_CHANGE_NOT_AUTHORIZED'
]);

const EVALUATION_TRUTH_FIELDS = Object.freeze([
  'generationRebuilt',
  'exactCandidateBound',
  'hostTrustPolicyDigestMatched',
  'decisionSeatKeyBound',
  'decisionSignatureVerified',
  'decisionWindowCurrent',
  'fourRootPassDecisionsBound',
  'revocationSignatureVerified',
  'revocationSnapshotCurrent',
  'revocationClear',
  'naturalPersonIdentityProven',
  'informedUnderstandingProven',
  'hostClockIndependentlyTrusted',
  'candidateCodeExecuted',
  'installed',
  'integrated',
  'published',
  'persistentLearningAdmitted',
  'promoted',
  'canonChanged'
]);

function canonicalJson(value) {
  return DeterministicJson.canonicalJson(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sha256Value(value) {
  return 'sha256:' + crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function sha256Bytes(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}

function exactKeys(value, fields, label) {
  object(value, label);
  const actual = Object.keys(value).sort(compareText);
  const expected = fields.slice().sort(compareText);
  if (!same(actual, expected)) throw new Error(label + ' fields must be exactly: ' + expected.join(', '));
}

function identifier(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(label + ' must be a portable identifier');
  return value;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a lowercase SHA-256 digest');
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !UTC.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(label + ' must be a canonical UTC millisecond timestamp');
  }
  return value;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum);
  }
  return value;
}

function canonicalBase64(value, label, bytes) {
  if (typeof value !== 'string' || !BASE64.test(value)) throw new Error(label + ' must be canonical base64');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== bytes || decoded.toString('base64') !== value) throw new Error(label + ' has the wrong decoded bytes');
  return value;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  if (typeof value.schema !== 'string' || value.schema.length < 1 || value.schema.length > 220) {
    throw new Error(label + '.schema is invalid');
  }
  return { id: identifier(value.id, label + '.id'), schema: value.schema, sha256: digest(value.sha256, label + '.sha256') };
}

function artifactReference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256', 'byteLength'], label);
  return {
    ...reference({ id: value.id, schema: value.schema, sha256: value.sha256 }, label),
    byteLength: integer(value.byteLength, label + '.byteLength', 1, 1048576)
  };
}

function seatReference(value, label) {
  const ref = reference(value, label);
  if (ref.schema !== 'axm.human-review-seat/v1') throw new Error(label + ' must name a human review seat contract');
  return ref;
}

function uniqueSorted(values, label, normalizer, maximum = 1024) {
  if (!Array.isArray(values) || values.length > maximum) throw new Error(label + ' must be a bounded array');
  const result = values.map((item, index) => normalizer(item, label + '[' + index + ']'))
    .sort((left, right) => compareText(
      typeof left === 'string' ? left : canonicalJson(left),
      typeof right === 'string' ? right : canonicalJson(right)
    ));
  if (new Set(result.map((item) => typeof item === 'string' ? item : canonicalJson(item))).size !== result.length) {
    throw new Error(label + ' contains duplicates');
  }
  return result;
}

function normalizeRoots(values, label) {
  if (!Array.isArray(values) || values.length !== ROOTS.length) throw new Error(label + ' must contain four roots');
  return values.map((item, index) => {
    exactKeys(item, ['root', 'verdict', 'evidenceRefs'], label + '[' + index + ']');
    if (item.root !== ROOTS[index] || item.verdict !== 'PASS') throw new Error(label + ' must preserve four ordered PASS decisions');
    const evidenceRefs = uniqueSorted(item.evidenceRefs, label + '[' + index + '].evidenceRefs', reference, 8);
    if (!evidenceRefs.length) throw new Error(label + ' root evidence cannot be empty');
    return { root: item.root, verdict: 'PASS', evidenceRefs };
  });
}

function normalizeLifecycle(value, label) {
  const fields = ['install', 'integrate', 'publish', 'learn', 'train', 'physicalActuation', 'promote', 'canon'];
  exactKeys(value, fields, label);
  const result = {};
  fields.forEach((field) => {
    if (value[field] !== false) throw new Error(label + '.' + field + ' must remain false');
    result[field] = false;
  });
  return result;
}

function policyCore(value) {
  exactKeys(value, [
    'schema', 'version', 'id', 'status', 'seatRef', 'decisionKey', 'revocationKey',
    'nurseryRef', 'scope', 'tier', 'allowedRecipeIds', 'validFrom', 'expiresAt',
    'maximumDecisionWindowMs', 'maximumRevocationAgeMs', 'resources',
    'allowedPermissions', 'allowedNetworkDomains', 'lifecycle', 'authority'
  ], 'decision trust policy');
  if (value.schema !== TRUST_POLICY_SCHEMA || value.version !== VERSION || value.status !== 'TEST' ||
    value.scope !== SCOPE || value.tier !== 1 || value.authority !== 'HOST_TRUST_ANCHOR_DECLARATION') {
    throw new Error('decision trust policy identity, tier, scope, or authority mismatch');
  }
  const decisionKey = Readiness.normalizeTrustKey(value.decisionKey);
  const revocationKey = Readiness.normalizeTrustKey(value.revocationKey);
  const decisionKeyRef = Readiness.buildTrustKeyRef(decisionKey);
  const revocationKeyRef = Readiness.buildTrustKeyRef(revocationKey);
  if (decisionKeyRef.id === revocationKeyRef.id || decisionKeyRef.sha256 === revocationKeyRef.sha256) {
    throw new Error('decision and revocation keys must be independent');
  }
  const nurseryRef = reference(value.nurseryRef, 'decision trust policy.nurseryRef');
  if (nurseryRef.schema !== 'axm.detached-candidate-nursery/v1') throw new Error('decision trust policy nursery contract mismatch');
  const allowedRecipeIds = uniqueSorted(value.allowedRecipeIds, 'decision trust policy.allowedRecipeIds', identifier, 8);
  if (!same(allowedRecipeIds, [Semantic.RECIPE_ID])) throw new Error('v0.9 allows only the existing native Review-Card recipe');
  const validFrom = timestamp(value.validFrom, 'decision trust policy.validFrom');
  const expiresAt = timestamp(value.expiresAt, 'decision trust policy.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(validFrom)) throw new Error('decision trust policy window is invalid');
  exactKeys(value.resources, [
    'maxCandidateFiles', 'maxCandidateBytes', 'maxEvidenceBytes', 'maxTotalBytes',
    'maxAttempts', 'maxProcesses', 'maxCostMinorUnits'
  ], 'decision trust policy.resources');
  const resources = {
    maxCandidateFiles: integer(value.resources.maxCandidateFiles, 'decision trust policy.resources.maxCandidateFiles', 7, 17),
    maxCandidateBytes: integer(value.resources.maxCandidateBytes, 'decision trust policy.resources.maxCandidateBytes', 1, 1048576),
    maxEvidenceBytes: integer(value.resources.maxEvidenceBytes, 'decision trust policy.resources.maxEvidenceBytes', 1024, 131072),
    maxTotalBytes: integer(value.resources.maxTotalBytes, 'decision trust policy.resources.maxTotalBytes', 2048, 1179648),
    maxAttempts: integer(value.resources.maxAttempts, 'decision trust policy.resources.maxAttempts', 1, 1),
    maxProcesses: integer(value.resources.maxProcesses, 'decision trust policy.resources.maxProcesses', 1, 1),
    maxCostMinorUnits: integer(value.resources.maxCostMinorUnits, 'decision trust policy.resources.maxCostMinorUnits', 0, 0)
  };
  if (resources.maxTotalBytes < resources.maxCandidateBytes + resources.maxEvidenceBytes) {
    throw new Error('decision trust policy total byte ceiling cannot cover candidate and evidence ceilings');
  }
  if (!same(value.allowedPermissions, []) || !same(value.allowedNetworkDomains, [])) {
    throw new Error('v0.9 trust policy must remain permissionless and networkless');
  }
  return {
    schema: TRUST_POLICY_SCHEMA,
    version: VERSION,
    id: identifier(value.id, 'decision trust policy.id'),
    status: 'TEST',
    seatRef: seatReference(value.seatRef, 'decision trust policy.seatRef'),
    decisionKey,
    revocationKey,
    nurseryRef,
    scope: SCOPE,
    tier: 1,
    allowedRecipeIds,
    validFrom,
    expiresAt,
    maximumDecisionWindowMs: integer(value.maximumDecisionWindowMs, 'decision trust policy.maximumDecisionWindowMs', 1, MAX_DECISION_WINDOW_MS),
    maximumRevocationAgeMs: integer(value.maximumRevocationAgeMs, 'decision trust policy.maximumRevocationAgeMs', 1, MAX_REVOCATION_AGE_MS),
    resources,
    allowedPermissions: [],
    allowedNetworkDomains: [],
    lifecycle: normalizeLifecycle(value.lifecycle, 'decision trust policy.lifecycle'),
    authority: 'HOST_TRUST_ANCHOR_DECLARATION'
  };
}

function sealTrustPolicy(value) {
  const core = policyCore(value);
  return { ...core, policyDigest: sha256Value(core) };
}

function normalizeTrustPolicy(value) {
  exactKeys(value, [
    'schema', 'version', 'id', 'status', 'seatRef', 'decisionKey', 'revocationKey',
    'nurseryRef', 'scope', 'tier', 'allowedRecipeIds', 'validFrom', 'expiresAt',
    'maximumDecisionWindowMs', 'maximumRevocationAgeMs', 'resources',
    'allowedPermissions', 'allowedNetworkDomains', 'lifecycle', 'authority', 'policyDigest'
  ], 'decision trust policy');
  const { policyDigest, ...candidateCore } = value;
  const sealed = sealTrustPolicy(candidateCore);
  if (sealed.policyDigest !== digest(policyDigest, 'decision trust policy.policyDigest') || !same(sealed, value)) {
    throw new Error('decision trust policy digest or canonical form mismatch');
  }
  return sealed;
}

function policyRef(policy) {
  const normalized = normalizeTrustPolicy(policy);
  return { id: normalized.id, schema: normalized.schema, sha256: normalized.policyDigest };
}

function packetRef(packet) {
  return { id: packet.candidate.id, schema: packet.schema, sha256: packet.packetDigest };
}

function reviewCardRef(card, candidateId) {
  return { id: candidateId + '-review-card', schema: card.schema, sha256: card.cardDigest };
}

function candidateRootName(packet) {
  return ROOT_PREFIX + packet.candidate.id + '-' + packet.packetDigest.slice('sha256:'.length, 'sha256:'.length + 12);
}

function candidateFileEntries(packet) {
  const normalized = Semantic.normalizeModuleBundle(packet.moduleBundle, packet.candidate.id);
  const entries = normalized.bundle.files.map((file) => {
    const bytes = Buffer.from(file.content, 'base64');
    return { path: file.path, bytes, sha256: 'sha256:' + file.sha256, byteLength: bytes.length };
  });
  const bundleBytes = jsonBytes(normalized.bundle);
  entries.push({ path: 'module-bundle.json', bytes: bundleBytes, sha256: sha256Bytes(bundleBytes), byteLength: bundleBytes.length });
  entries.sort((left, right) => compareText(left.path, right.path));
  const expected = [...Semantic.REQUIRED_CANDIDATE_FILES, 'module-bundle.json'].sort(compareText);
  if (!same(entries.map((file) => file.path), expected)) throw new Error('materializer candidate file set drifted');
  return entries;
}

function prepare(requestInput, trustPolicyInput) {
  const policy = normalizeTrustPolicy(trustPolicyInput);
  const generated = Semantic.generate(requestInput);
  if (generated.request.mode !== 'NATIVE_ONLY' || generated.packets.length !== 1 || generated.reviewCards.length !== 1) {
    throw new Error('v0.9 materialization accepts one native candidate only');
  }
  const packet = generated.packets[0];
  const card = generated.reviewCards[0];
  if (packet.lane !== 'NATIVE' || packet.generator.recipeId !== Semantic.RECIPE_ID ||
    !policy.allowedRecipeIds.includes(packet.generator.recipeId)) {
    throw new Error('native candidate recipe is outside the exact trust policy');
  }
  if (packet.declaredAuthority.permissions.length || packet.declaredAuthority.networkDomains.length ||
    packet.declaredAuthority.lifecycleEffects.length) {
    throw new Error('candidate authority exceeds Tier 1 materialization');
  }
  if (packet.reuseRights.state !== 'RESEARCH_ONLY_HOLD' || packet.reuseRights.directReuseAllowed !== false) {
    throw new Error('generated source reuse rights must remain held');
  }
  const files = candidateFileEntries(packet);
  const candidateBytes = files.reduce((sum, file) => sum + file.byteLength, 0);
  if (files.length > policy.resources.maxCandidateFiles || candidateBytes > policy.resources.maxCandidateBytes) {
    throw new Error('candidate exceeds the trust-policy file or byte ceiling');
  }
  const rootName = candidateRootName(packet);
  if (!ROOT_NAME.test(rootName)) throw new Error('derived candidate root name is not portable');
  const core = {
    schema: SUBJECT_SCHEMA,
    version: VERSION,
    id: packet.candidate.id + '-tier1-materialization',
    status: 'PREPARED_FOR_HUMAN_DECISION',
    generationRequestRef: packet.requestRef,
    candidateRef: packetRef(packet),
    moduleBundleRef: packet.moduleBundleRef,
    reviewCardRef: reviewCardRef(card, packet.candidate.id),
    recipeLibraryRef: packet.generator.recipeLibraryRef,
    trustPolicyRef: policyRef(policy),
    nurseryRef: policy.nurseryRef,
    candidateRootName: rootName,
    scope: SCOPE,
    tier: 1,
    rootsGate: normalizeRoots(packet.rootsGate, 'candidate rootsGate'),
    declaredAuthority: { permissions: [], networkDomains: [], lifecycleEffects: [] },
    resources: {
      candidateFileCount: files.length,
      candidateBytes,
      evidenceByteCeiling: policy.resources.maxEvidenceBytes,
      totalByteCeiling: policy.resources.maxTotalBytes,
      maxAttempts: 1,
      maxProcesses: 1,
      maxCostMinorUnits: 0
    },
    reuseRights: { state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false },
    truth: {
      semanticGenerationRebuilt: true,
      exactCandidateBytesBound: true,
      candidateCodeExecuted: false,
      hostWriteAuthorityGranted: false,
      authenticatedHumanDecisionVerified: false,
      installed: false,
      integrated: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  };
  const candidateId = core.candidateRef.id;
  if (core.generationRequestRef.schema !== Semantic.REQUEST_SCHEMA || core.candidateRef.schema !== Semantic.PACKET_SCHEMA ||
    core.moduleBundleRef.id !== candidateId + '-module-bundle' || core.moduleBundleRef.schema !== 'axm.module-bundle/v1' ||
    core.reviewCardRef.id !== candidateId + '-review-card' || core.reviewCardRef.schema !== Semantic.REVIEW_CARD_SCHEMA ||
    core.recipeLibraryRef.schema !== Semantic.RECIPE_LIBRARY_SCHEMA ||
    core.trustPolicyRef.schema !== TRUST_POLICY_SCHEMA || core.nurseryRef.schema !== 'axm.detached-candidate-nursery/v1' ||
    core.id !== candidateId + '-tier1-materialization' || !core.candidateRootName.startsWith(ROOT_PREFIX + candidateId + '-') ||
    core.resources.candidateFileCount !== 7 ||
    core.resources.totalByteCeiling < core.resources.candidateBytes + core.resources.evidenceByteCeiling) {
    throw new Error('materialization subject references, identity, or resource relationships conflict');
  }
  const subject = { ...core, subjectDigest: sha256Value(core) };
  return { request: generated.request, packet, reviewCard: card, subject, files };
}

function normalizeSubject(value) {
  exactKeys(value, [
    'schema', 'version', 'id', 'status', 'generationRequestRef', 'candidateRef',
    'moduleBundleRef', 'reviewCardRef', 'recipeLibraryRef', 'trustPolicyRef',
    'nurseryRef', 'candidateRootName', 'scope', 'tier', 'rootsGate',
    'declaredAuthority', 'resources', 'reuseRights', 'truth', 'authority', 'subjectDigest'
  ], 'materialization subject');
  if (value.schema !== SUBJECT_SCHEMA || value.version !== VERSION || value.status !== 'PREPARED_FOR_HUMAN_DECISION' ||
    value.scope !== SCOPE || value.tier !== 1 || value.authority !== 'NONE' || !ROOT_NAME.test(value.candidateRootName)) {
    throw new Error('materialization subject identity, scope, or authority mismatch');
  }
  exactKeys(value.declaredAuthority, ['permissions', 'networkDomains', 'lifecycleEffects'], 'materialization subject.declaredAuthority');
  if (!same(value.declaredAuthority, { permissions: [], networkDomains: [], lifecycleEffects: [] })) {
    throw new Error('materialization subject authority must remain empty');
  }
  exactKeys(value.resources, ['candidateFileCount', 'candidateBytes', 'evidenceByteCeiling', 'totalByteCeiling', 'maxAttempts', 'maxProcesses', 'maxCostMinorUnits'], 'materialization subject.resources');
  const resources = {
    candidateFileCount: integer(value.resources.candidateFileCount, 'materialization subject.resources.candidateFileCount', 7, 17),
    candidateBytes: integer(value.resources.candidateBytes, 'materialization subject.resources.candidateBytes', 1, 1048576),
    evidenceByteCeiling: integer(value.resources.evidenceByteCeiling, 'materialization subject.resources.evidenceByteCeiling', 1024, 131072),
    totalByteCeiling: integer(value.resources.totalByteCeiling, 'materialization subject.resources.totalByteCeiling', 2048, 1179648),
    maxAttempts: integer(value.resources.maxAttempts, 'materialization subject.resources.maxAttempts', 1, 1),
    maxProcesses: integer(value.resources.maxProcesses, 'materialization subject.resources.maxProcesses', 1, 1),
    maxCostMinorUnits: integer(value.resources.maxCostMinorUnits, 'materialization subject.resources.maxCostMinorUnits', 0, 0)
  };
  exactKeys(value.reuseRights, ['state', 'directReuseAllowed'], 'materialization subject.reuseRights');
  if (!same(value.reuseRights, { state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false })) throw new Error('materialization subject reuse rights drifted');
  const truth = {
    semanticGenerationRebuilt: true,
    exactCandidateBytesBound: true,
    candidateCodeExecuted: false,
    hostWriteAuthorityGranted: false,
    authenticatedHumanDecisionVerified: false,
    installed: false,
    integrated: false,
    promoted: false,
    canonChanged: false
  };
  exactKeys(value.truth, Object.keys(truth), 'materialization subject.truth');
  if (!same(value.truth, truth)) throw new Error('materialization subject truth ceiling drifted');
  const core = {
    schema: SUBJECT_SCHEMA,
    version: VERSION,
    id: identifier(value.id, 'materialization subject.id'),
    status: 'PREPARED_FOR_HUMAN_DECISION',
    generationRequestRef: reference(value.generationRequestRef, 'materialization subject.generationRequestRef'),
    candidateRef: reference(value.candidateRef, 'materialization subject.candidateRef'),
    moduleBundleRef: artifactReference(value.moduleBundleRef, 'materialization subject.moduleBundleRef'),
    reviewCardRef: reference(value.reviewCardRef, 'materialization subject.reviewCardRef'),
    recipeLibraryRef: reference(value.recipeLibraryRef, 'materialization subject.recipeLibraryRef'),
    trustPolicyRef: reference(value.trustPolicyRef, 'materialization subject.trustPolicyRef'),
    nurseryRef: reference(value.nurseryRef, 'materialization subject.nurseryRef'),
    candidateRootName: value.candidateRootName,
    scope: SCOPE,
    tier: 1,
    rootsGate: normalizeRoots(value.rootsGate, 'materialization subject.rootsGate'),
    declaredAuthority: { permissions: [], networkDomains: [], lifecycleEffects: [] },
    resources,
    reuseRights: { state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false },
    truth,
    authority: 'NONE'
  };
  const subjectDigest = digest(value.subjectDigest, 'materialization subject.subjectDigest');
  if (sha256Value(core) !== subjectDigest) throw new Error('materialization subject digest mismatch');
  const normalized = { ...core, subjectDigest };
  if (!same(normalized, value)) throw new Error('materialization subject is not canonical');
  return normalized;
}

function subjectRef(subject) {
  const normalized = normalizeSubject(subject);
  return { id: normalized.id, schema: normalized.schema, sha256: normalized.subjectDigest };
}

function buildDecision(input) {
  exactKeys(input, ['subject', 'trustPolicy', 'choice', 'issuedAt', 'expiresAt', 'nonce'], 'decision builder input');
  const subject = normalizeSubject(input.subject);
  const policy = normalizeTrustPolicy(input.trustPolicy);
  if (!same(subject.trustPolicyRef, policyRef(policy)) || !same(subject.nurseryRef, policy.nurseryRef)) {
    throw new Error('decision subject does not bind the exact trust policy and nursery');
  }
  if (!CHOICES.includes(input.choice)) throw new Error('human decision choice is unsupported');
  const issuedAt = timestamp(input.issuedAt, 'human decision.issuedAt');
  const expiresAt = timestamp(input.expiresAt, 'human decision.expiresAt');
  const window = Date.parse(expiresAt) - Date.parse(issuedAt);
  if (window <= 0 || window > policy.maximumDecisionWindowMs) throw new Error('human decision window exceeds policy');
  const core = {
    schema: DECISION_SCHEMA,
    version: VERSION,
    status: 'SIGNED_DECISION',
    id: subject.id + '-decision',
    subjectRef: subjectRef(subject),
    candidateRef: subject.candidateRef,
    seatRef: policy.seatRef,
    trustPolicyRef: policyRef(policy),
    choice: input.choice,
    scope: SCOPE,
    tier: 1,
    issuedAt,
    expiresAt,
    nonce: identifier(input.nonce, 'human decision.nonce'),
    rootsGate: subject.rootsGate,
    authority: 'DECISION_ONLY'
  };
  if (core.id !== core.subjectRef.id + '-decision' || core.subjectRef.schema !== SUBJECT_SCHEMA ||
    core.candidateRef.schema !== Semantic.PACKET_SCHEMA || core.trustPolicyRef.schema !== TRUST_POLICY_SCHEMA) {
    throw new Error('human decision reference identities conflict');
  }
  return { ...core, decisionDigest: sha256Value(core) };
}

function normalizeUnsignedDecision(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'id', 'subjectRef', 'candidateRef', 'seatRef',
    'trustPolicyRef', 'choice', 'scope', 'tier', 'issuedAt', 'expiresAt', 'nonce',
    'rootsGate', 'authority', 'decisionDigest'
  ], 'unsigned human decision');
  if (value.schema !== DECISION_SCHEMA || value.version !== VERSION || value.status !== 'SIGNED_DECISION' ||
    value.scope !== SCOPE || value.tier !== 1 || value.authority !== 'DECISION_ONLY' || !CHOICES.includes(value.choice)) {
    throw new Error('human decision identity, scope, choice, or authority mismatch');
  }
  const issuedAt = timestamp(value.issuedAt, 'human decision.issuedAt');
  const expiresAt = timestamp(value.expiresAt, 'human decision.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) throw new Error('human decision window is invalid');
  const core = {
    schema: DECISION_SCHEMA,
    version: VERSION,
    status: 'SIGNED_DECISION',
    id: identifier(value.id, 'human decision.id'),
    subjectRef: reference(value.subjectRef, 'human decision.subjectRef'),
    candidateRef: reference(value.candidateRef, 'human decision.candidateRef'),
    seatRef: seatReference(value.seatRef, 'human decision.seatRef'),
    trustPolicyRef: reference(value.trustPolicyRef, 'human decision.trustPolicyRef'),
    choice: value.choice,
    scope: SCOPE,
    tier: 1,
    issuedAt,
    expiresAt,
    nonce: identifier(value.nonce, 'human decision.nonce'),
    rootsGate: normalizeRoots(value.rootsGate, 'human decision.rootsGate'),
    authority: 'DECISION_ONLY'
  };
  const decisionDigest = digest(value.decisionDigest, 'human decision.decisionDigest');
  if (sha256Value(core) !== decisionDigest) throw new Error('human decision digest mismatch');
  return { ...core, decisionDigest };
}

function buildDecisionSignaturePayload(value) {
  const unsigned = clone(value);
  delete unsigned.signatureBase64;
  return Buffer.from(canonicalJson(normalizeUnsignedDecision(unsigned)), 'utf8');
}

function attachDecisionSignature(value, signatureBase64) {
  const decision = normalizeUnsignedDecision(value);
  return { ...decision, signatureBase64: canonicalBase64(signatureBase64, 'human decision.signatureBase64', 64) };
}

function normalizeDecision(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'id', 'subjectRef', 'candidateRef', 'seatRef',
    'trustPolicyRef', 'choice', 'scope', 'tier', 'issuedAt', 'expiresAt', 'nonce',
    'rootsGate', 'authority', 'decisionDigest', 'signatureBase64'
  ], 'authenticated human decision');
  const { signatureBase64, ...unsigned } = value;
  const normalized = attachDecisionSignature(unsigned, signatureBase64);
  if (!same(normalized, value)) throw new Error('authenticated human decision is not canonical');
  return normalized;
}

function decisionRef(decision) {
  const normalized = normalizeDecision(decision);
  return { id: normalized.id, schema: normalized.schema, sha256: normalized.decisionDigest };
}

function buildRevocationSnapshot(input) {
  exactKeys(input, ['trustPolicy', 'observedAt', 'expiresAt', 'revokedSeatIds', 'revokedDecisionKeyDigests', 'revokedNonces', 'revokedDecisionDigests'], 'revocation snapshot builder input');
  const policy = normalizeTrustPolicy(input.trustPolicy);
  const observedAt = timestamp(input.observedAt, 'revocation snapshot.observedAt');
  const expiresAt = timestamp(input.expiresAt, 'revocation snapshot.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(observedAt)) throw new Error('revocation snapshot window is invalid');
  const core = {
    schema: REVOCATION_SCHEMA,
    version: VERSION,
    status: 'SIGNED_HOST_SNAPSHOT',
    id: policy.id + '-revocation-snapshot',
    trustPolicyRef: policyRef(policy),
    observedAt,
    expiresAt,
    revokedSeatIds: uniqueSorted(input.revokedSeatIds, 'revocation snapshot.revokedSeatIds', identifier),
    revokedDecisionKeyDigests: uniqueSorted(input.revokedDecisionKeyDigests, 'revocation snapshot.revokedDecisionKeyDigests', digest),
    revokedNonces: uniqueSorted(input.revokedNonces, 'revocation snapshot.revokedNonces', identifier),
    revokedDecisionDigests: uniqueSorted(input.revokedDecisionDigests, 'revocation snapshot.revokedDecisionDigests', digest),
    authority: 'REVOCATION_STATUS_ONLY'
  };
  return { ...core, snapshotDigest: sha256Value(core) };
}

function normalizeUnsignedRevocation(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'id', 'trustPolicyRef', 'observedAt', 'expiresAt',
    'revokedSeatIds', 'revokedDecisionKeyDigests', 'revokedNonces',
    'revokedDecisionDigests', 'authority', 'snapshotDigest'
  ], 'unsigned revocation snapshot');
  if (value.schema !== REVOCATION_SCHEMA || value.version !== VERSION || value.status !== 'SIGNED_HOST_SNAPSHOT' ||
    value.authority !== 'REVOCATION_STATUS_ONLY') throw new Error('revocation snapshot identity or authority mismatch');
  const observedAt = timestamp(value.observedAt, 'revocation snapshot.observedAt');
  const expiresAt = timestamp(value.expiresAt, 'revocation snapshot.expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(observedAt)) throw new Error('revocation snapshot window is invalid');
  const core = {
    schema: REVOCATION_SCHEMA,
    version: VERSION,
    status: 'SIGNED_HOST_SNAPSHOT',
    id: identifier(value.id, 'revocation snapshot.id'),
    trustPolicyRef: reference(value.trustPolicyRef, 'revocation snapshot.trustPolicyRef'),
    observedAt,
    expiresAt,
    revokedSeatIds: uniqueSorted(value.revokedSeatIds, 'revocation snapshot.revokedSeatIds', identifier),
    revokedDecisionKeyDigests: uniqueSorted(value.revokedDecisionKeyDigests, 'revocation snapshot.revokedDecisionKeyDigests', digest),
    revokedNonces: uniqueSorted(value.revokedNonces, 'revocation snapshot.revokedNonces', identifier),
    revokedDecisionDigests: uniqueSorted(value.revokedDecisionDigests, 'revocation snapshot.revokedDecisionDigests', digest),
    authority: 'REVOCATION_STATUS_ONLY'
  };
  const snapshotDigest = digest(value.snapshotDigest, 'revocation snapshot.snapshotDigest');
  if (sha256Value(core) !== snapshotDigest) throw new Error('revocation snapshot digest mismatch');
  return { ...core, snapshotDigest };
}

function buildRevocationSignaturePayload(value) {
  const unsigned = clone(value);
  delete unsigned.signatureBase64;
  return Buffer.from(canonicalJson(normalizeUnsignedRevocation(unsigned)), 'utf8');
}

function attachRevocationSignature(value, signatureBase64) {
  const snapshot = normalizeUnsignedRevocation(value);
  return { ...snapshot, signatureBase64: canonicalBase64(signatureBase64, 'revocation snapshot.signatureBase64', 64) };
}

function normalizeRevocationSnapshot(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'id', 'trustPolicyRef', 'observedAt', 'expiresAt',
    'revokedSeatIds', 'revokedDecisionKeyDigests', 'revokedNonces',
    'revokedDecisionDigests', 'authority', 'snapshotDigest', 'signatureBase64'
  ], 'human decision revocation snapshot');
  const { signatureBase64, ...unsigned } = value;
  const normalized = attachRevocationSignature(unsigned, signatureBase64);
  if (!same(normalized, value)) throw new Error('revocation snapshot is not canonical');
  return normalized;
}

function revocationRef(snapshot) {
  const normalized = normalizeRevocationSnapshot(snapshot);
  return { id: normalized.id, schema: normalized.schema, sha256: normalized.snapshotDigest };
}

function verifySignature(key, payload, signatureBase64) {
  try {
    const normalized = Readiness.normalizeTrustKey(key);
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(normalized.publicKeySpkiDerBase64, 'base64'),
      format: 'der',
      type: 'spki'
    });
    return crypto.verify(null, payload, publicKey, Buffer.from(signatureBase64, 'base64'));
  } catch (_) {
    return false;
  }
}

function emptyEvaluationTruth() {
  return Object.fromEntries(EVALUATION_TRUTH_FIELDS.map((field) => [field, false]));
}

function sealEvaluation(status, details) {
  const truth = { ...emptyEvaluationTruth(), ...(details.truth || {}) };
  const holds = (details.holds || []).slice();
  const core = {
    schema: EVALUATION_SCHEMA,
    version: VERSION,
    status,
    subjectRef: details.subjectRef,
    decisionRef: details.decisionRef,
    trustPolicyRef: details.trustPolicyRef,
    revocationSnapshotRef: details.revocationSnapshotRef,
    evaluatedAt: details.evaluatedAt,
    holds,
    nextGate: status === READY_STATUS ? 'HOST_ATOMIC_REPLAY_RESERVATION_AND_DETACHED_WRITE' : 'NEW_OR_REPAIRED_HUMAN_DECISION_REQUIRED',
    truth,
    authority: 'NONE'
  };
  return { ...core, evaluationDigest: sha256Value(core) };
}

function decisionHold(status, base, message) {
  return sealEvaluation(status, { ...base, holds: [...(base.holds || []), message] });
}

function evaluateDecision(input, options) {
  exactKeys(input, ['generationRequest', 'decision', 'trustPolicy', 'revocationSnapshot', 'evaluatedAt'], 'decision evaluation input');
  exactKeys(options, ['trustedPolicyDigest'], 'decision evaluation options');
  const policy = normalizeTrustPolicy(input.trustPolicy);
  const prepared = prepare(input.generationRequest, policy);
  const decision = normalizeDecision(input.decision);
  const evaluatedAt = timestamp(input.evaluatedAt, 'decision evaluation.evaluatedAt');
  const base = {
    subjectRef: subjectRef(prepared.subject),
    decisionRef: decisionRef(decision),
    trustPolicyRef: policyRef(policy),
    revocationSnapshotRef: null,
    evaluatedAt,
    truth: { generationRebuilt: true }
  };
  if (digest(options.trustedPolicyDigest, 'trustedPolicyDigest') !== policy.policyDigest) {
    return decisionHold('TRUST_POLICY_HOLD', base, 'HOST_TRUST_POLICY_DIGEST_MISMATCH');
  }
  base.truth.hostTrustPolicyDigestMatched = true;
  if (!same(decision.subjectRef, subjectRef(prepared.subject)) || !same(decision.candidateRef, prepared.subject.candidateRef) ||
    !same(decision.trustPolicyRef, policyRef(policy)) || !same(decision.seatRef, policy.seatRef)) {
    return decisionHold('SUBJECT_HOLD', base, 'DECISION_SUBJECT_CANDIDATE_SEAT_OR_POLICY_MISMATCH');
  }
  base.truth.exactCandidateBound = true;
  base.truth.decisionSeatKeyBound = true;
  if (!verifySignature(policy.decisionKey, buildDecisionSignaturePayload(decision), decision.signatureBase64)) {
    return decisionHold('SIGNATURE_HOLD', base, 'DECISION_SIGNATURE_INVALID');
  }
  base.truth.decisionSignatureVerified = true;
  const now = Date.parse(evaluatedAt);
  const policyCurrent = now >= Date.parse(policy.validFrom) && now < Date.parse(policy.expiresAt);
  const decisionCurrent = now >= Date.parse(decision.issuedAt) && now < Date.parse(decision.expiresAt) &&
    Date.parse(decision.expiresAt) - Date.parse(decision.issuedAt) <= policy.maximumDecisionWindowMs;
  if (!policyCurrent || !decisionCurrent) return decisionHold('TIME_HOLD', base, 'POLICY_OR_DECISION_WINDOW_NOT_CURRENT');
  base.truth.decisionWindowCurrent = true;
  if (!same(decision.rootsGate, prepared.subject.rootsGate)) return decisionHold('ROOTS_HOLD', base, 'FOUR_ROOT_DECISIONS_DRIFTED');
  base.truth.fourRootPassDecisionsBound = true;
  const snapshot = normalizeRevocationSnapshot(input.revocationSnapshot);
  base.revocationSnapshotRef = revocationRef(snapshot);
  if (!same(snapshot.trustPolicyRef, policyRef(policy)) ||
    !verifySignature(policy.revocationKey, buildRevocationSignaturePayload(snapshot), snapshot.signatureBase64)) {
    return decisionHold('REVOCATION_HOLD', base, 'REVOCATION_POLICY_OR_SIGNATURE_INVALID');
  }
  base.truth.revocationSignatureVerified = true;
  const snapshotCurrent = Date.parse(snapshot.observedAt) <= now && now < Date.parse(snapshot.expiresAt) &&
    now - Date.parse(snapshot.observedAt) <= policy.maximumRevocationAgeMs;
  if (!snapshotCurrent) return decisionHold('REVOCATION_HOLD', base, 'REVOCATION_SNAPSHOT_NOT_CURRENT');
  base.truth.revocationSnapshotCurrent = true;
  const decisionKeyDigest = Readiness.buildTrustKeyRef(policy.decisionKey).sha256;
  const revoked = snapshot.revokedSeatIds.includes(policy.seatRef.id) ||
    snapshot.revokedDecisionKeyDigests.includes(decisionKeyDigest) ||
    snapshot.revokedNonces.includes(decision.nonce) ||
    snapshot.revokedDecisionDigests.includes(decision.decisionDigest);
  if (revoked) return decisionHold('REVOKED', base, 'DECISION_SEAT_KEY_NONCE_OR_DIGEST_REVOKED');
  base.truth.revocationClear = true;
  if (decision.choice === 'HOLD') return decisionHold('HUMAN_HOLD', base, 'HUMAN_CHOICE_HOLD');
  if (decision.choice === 'REJECT') return decisionHold('HUMAN_REJECTED', base, 'HUMAN_CHOICE_REJECT');
  return sealEvaluation(READY_STATUS, base);
}

function normalizeEvaluation(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'subjectRef', 'decisionRef', 'trustPolicyRef',
    'revocationSnapshotRef', 'evaluatedAt', 'holds', 'nextGate', 'truth',
    'authority', 'evaluationDigest'
  ], 'authenticated decision evaluation');
  if (value.schema !== EVALUATION_SCHEMA || value.version !== VERSION || value.authority !== 'NONE') {
    throw new Error('authenticated decision evaluation identity or authority mismatch');
  }
  if (!EVALUATION_STATUSES.includes(value.status)) throw new Error('authenticated decision evaluation status is unsupported');
  const ready = value.status === READY_STATUS;
  const expectedNext = ready ? 'HOST_ATOMIC_REPLAY_RESERVATION_AND_DETACHED_WRITE' : 'NEW_OR_REPAIRED_HUMAN_DECISION_REQUIRED';
  if (value.nextGate !== expectedNext) throw new Error('authenticated decision evaluation next gate mismatch');
  if (!Array.isArray(value.holds) || value.holds.length > 16 || value.holds.some((item) => typeof item !== 'string' || !item.length || item.length > 200)) {
    throw new Error('authenticated decision evaluation holds are invalid');
  }
  if (ready !== (value.holds.length === 0)) throw new Error('only a ready evaluation may be hold-free');
  exactKeys(value.truth, EVALUATION_TRUTH_FIELDS, 'authenticated decision evaluation.truth');
  const truth = {};
  EVALUATION_TRUTH_FIELDS.forEach((field) => {
    if (typeof value.truth[field] !== 'boolean') throw new Error('authenticated decision evaluation.truth.' + field + ' must be boolean');
    truth[field] = value.truth[field];
  });
  const forbidden = EVALUATION_TRUTH_FIELDS.slice(10);
  forbidden.forEach((field) => {
    if (truth[field]) throw new Error('authenticated decision evaluation truth ceiling exceeded: ' + field);
  });
  if (ready && EVALUATION_TRUTH_FIELDS.slice(0, 10).some((field) => !truth[field])) {
    throw new Error('ready decision evaluation lacks required proof');
  }
  const staged = EVALUATION_TRUTH_FIELDS.slice(0, 10);
  const firstFalse = staged.findIndex((field) => !truth[field]);
  if (firstFalse >= 0 && staged.slice(firstFalse + 1).some((field) => truth[field])) {
    throw new Error('authenticated decision evaluation proof stages cannot skip a failed gate');
  }
  const core = {
    schema: EVALUATION_SCHEMA,
    version: VERSION,
    status: value.status,
    subjectRef: reference(value.subjectRef, 'authenticated decision evaluation.subjectRef'),
    decisionRef: reference(value.decisionRef, 'authenticated decision evaluation.decisionRef'),
    trustPolicyRef: reference(value.trustPolicyRef, 'authenticated decision evaluation.trustPolicyRef'),
    revocationSnapshotRef: value.revocationSnapshotRef == null ? null : reference(value.revocationSnapshotRef, 'authenticated decision evaluation.revocationSnapshotRef'),
    evaluatedAt: timestamp(value.evaluatedAt, 'authenticated decision evaluation.evaluatedAt'),
    holds: value.holds.slice(),
    nextGate: expectedNext,
    truth,
    authority: 'NONE'
  };
  if (core.subjectRef.schema !== SUBJECT_SCHEMA || core.decisionRef.schema !== DECISION_SCHEMA ||
    core.trustPolicyRef.schema !== TRUST_POLICY_SCHEMA || core.decisionRef.id !== core.subjectRef.id + '-decision' ||
    (core.revocationSnapshotRef && core.revocationSnapshotRef.schema !== REVOCATION_SCHEMA) ||
    (truth.fourRootPassDecisionsBound && core.revocationSnapshotRef === null)) {
    throw new Error('authenticated decision evaluation references conflict with its proof stage');
  }
  const evaluationDigest = digest(value.evaluationDigest, 'authenticated decision evaluation.evaluationDigest');
  if (sha256Value(core) !== evaluationDigest) throw new Error('authenticated decision evaluation digest mismatch');
  const normalized = { ...core, evaluationDigest };
  if (!same(normalized, value)) throw new Error('authenticated decision evaluation is not canonical');
  return normalized;
}

function evaluationRef(evaluation) {
  const normalized = normalizeEvaluation(evaluation);
  return { id: normalized.decisionRef.id + '-evaluation', schema: normalized.schema, sha256: normalized.evaluationDigest };
}

function verifyDecisionEvaluation(value, input, options) {
  const errors = [];
  try {
    const normalized = normalizeEvaluation(value);
    const rebuilt = evaluateDecision(input, options);
    if (!same(normalized, rebuilt)) throw new Error('decision evaluation differs from deterministic rebuild');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function pathKey(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function samePath(left, right) {
  return pathKey(path.resolve(left)) === pathKey(path.resolve(right));
}

function overlaps(left, right) {
  const a = pathKey(path.resolve(left));
  const b = pathKey(path.resolve(right));
  const prefixA = a.endsWith(path.sep) ? a : a + path.sep;
  const prefixB = b.endsWith(path.sep) ? b : b + path.sep;
  return a === b || a.startsWith(prefixB) || b.startsWith(prefixA);
}

function existingCanonicalDirectory(value, label) {
  if (typeof value !== 'string' || value.includes('\0') || value.startsWith('\\\\') || value.startsWith('\\\\?\\') ||
    !path.isAbsolute(value) || path.normalize(value) !== value) throw new Error(label + ' must be an absolute canonical non-UNC path');
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(label + ' must be a real directory, not a link');
  const real = fs.realpathSync.native ? fs.realpathSync.native(value) : fs.realpathSync(value);
  if (!samePath(real, value)) throw new Error(label + ' contains an alias, symlink, or junction');
  return real;
}

function validateBoundary(options, subject, allowExisting) {
  exactKeys(options, ['allowedParent', 'rootName', 'protectedRoots', 'trustedPolicyDigest', 'faultAt'], 'materialization options');
  digest(options.trustedPolicyDigest, 'materialization options.trustedPolicyDigest');
  if (options.rootName !== subject.candidateRootName || !ROOT_NAME.test(options.rootName)) {
    throw new Error('materialization root name does not match the signed subject');
  }
  if (options.faultAt !== null && !['AFTER_FIRST_FILE', 'AFTER_CANDIDATE_FILES', 'AFTER_NURSERY_INSPECTION'].includes(options.faultAt)) {
    throw new Error('unsupported bounded fault injection');
  }
  const parent = existingCanonicalDirectory(options.allowedParent, 'materialization allowedParent');
  if (!Array.isArray(options.protectedRoots) || options.protectedRoots.length < 1 || options.protectedRoots.length > 16) {
    throw new Error('materialization protectedRoots must contain 1 to 16 exact directories');
  }
  const protectedRoots = options.protectedRoots.map((item, index) => existingCanonicalDirectory(item, 'materialization protectedRoots[' + index + ']'));
  if (new Set(protectedRoots.map(pathKey)).size !== protectedRoots.length) throw new Error('materialization protectedRoots contains aliases');
  if (protectedRoots.some((root) => overlaps(parent, root))) throw new Error('materialization parent overlaps a protected source, workspace, or evidence root');
  const ledgerRoot = path.join(parent, LEDGER_DIRECTORY);
  const ledger = existingCanonicalDirectory(ledgerRoot, 'materialization replay ledger');
  if (!samePath(path.dirname(ledger), parent)) throw new Error('materialization replay ledger is not a direct child');
  const root = path.join(parent, options.rootName);
  if (!samePath(path.dirname(root), parent)) throw new Error('materialization output is not a direct child');
  if (!allowExisting && fs.existsSync(root)) throw new Error('materialization output root must not already exist');
  if (allowExisting && (!fs.existsSync(root) || fs.lstatSync(root).isSymbolicLink() || !fs.lstatSync(root).isDirectory())) {
    throw new Error('materialization output root is missing or unsafe');
  }
  return { parent, ledgerRoot: ledger, root, rootName: options.rootName };
}

function buildReservation(decision, subject, reservedAt) {
  const core = {
    schema: RESERVATION_SCHEMA,
    version: VERSION,
    status: 'NONCE_RESERVED',
    trustPolicyRef: decision.trustPolicyRef,
    subjectRef: subjectRef(subject),
    decisionRef: decisionRef(decision),
    candidateRef: decision.candidateRef,
    nonceDigest: sha256Value({ nonce: decision.nonce }),
    reservedAt: timestamp(reservedAt, 'replay reservation.reservedAt'),
    authority: 'REPLAY_PREVENTION_ONLY'
  };
  if (core.trustPolicyRef.schema !== TRUST_POLICY_SCHEMA || core.subjectRef.schema !== SUBJECT_SCHEMA ||
    core.decisionRef.schema !== DECISION_SCHEMA || core.candidateRef.schema !== Semantic.PACKET_SCHEMA ||
    core.decisionRef.id !== core.subjectRef.id + '-decision') {
    throw new Error('replay reservation references conflict');
  }
  return { ...core, reservationDigest: sha256Value(core) };
}

function normalizeReservation(value) {
  exactKeys(value, ['schema', 'version', 'status', 'trustPolicyRef', 'subjectRef', 'decisionRef', 'candidateRef', 'nonceDigest', 'reservedAt', 'authority', 'reservationDigest'], 'replay reservation');
  if (value.schema !== RESERVATION_SCHEMA || value.version !== VERSION || value.status !== 'NONCE_RESERVED' ||
    value.authority !== 'REPLAY_PREVENTION_ONLY') throw new Error('replay reservation identity or authority mismatch');
  const core = {
    schema: RESERVATION_SCHEMA,
    version: VERSION,
    status: 'NONCE_RESERVED',
    trustPolicyRef: reference(value.trustPolicyRef, 'replay reservation.trustPolicyRef'),
    subjectRef: reference(value.subjectRef, 'replay reservation.subjectRef'),
    decisionRef: reference(value.decisionRef, 'replay reservation.decisionRef'),
    candidateRef: reference(value.candidateRef, 'replay reservation.candidateRef'),
    nonceDigest: digest(value.nonceDigest, 'replay reservation.nonceDigest'),
    reservedAt: timestamp(value.reservedAt, 'replay reservation.reservedAt'),
    authority: 'REPLAY_PREVENTION_ONLY'
  };
  const reservationDigest = digest(value.reservationDigest, 'replay reservation.reservationDigest');
  if (sha256Value(core) !== reservationDigest) throw new Error('replay reservation digest mismatch');
  const normalized = { ...core, reservationDigest };
  if (!same(normalized, value)) throw new Error('replay reservation is not canonical');
  return normalized;
}

function reservationRef(reservation) {
  const normalized = normalizeReservation(reservation);
  return { id: normalized.decisionRef.id + '-replay-reservation', schema: normalized.schema, sha256: normalized.reservationDigest };
}

function sourceFileRef(entry) {
  return { path: entry.path, sha256: entry.sha256, byteLength: entry.byteLength };
}

function receiptTruth() {
  return {
    semanticGenerationRebuilt: true,
    hostTrustPolicyDigestMatched: true,
    decisionSignatureVerified: true,
    revocationSignatureVerified: true,
    revocationSnapshotCurrentAndClear: true,
    replayNonceExclusivelyReserved: true,
    candidateFilesWritten: true,
    candidateFilesReadBack: true,
    candidateStructureInspected: true,
    naturalPersonIdentityProven: false,
    informedUnderstandingProven: false,
    hostClockIndependentlyTrusted: false,
    fabricGrantedWriteAuthority: false,
    candidateCodeExecuted: false,
    runtimeBehaviorProven: false,
    visualBehaviorProven: false,
    installed: false,
    integrated: false,
    published: false,
    persistentLearningAdmitted: false,
    promoted: false,
    canonChanged: false,
    filesRetained: true
  };
}

function sealReceiptStable(base, reservationBytes, candidateBytes, ceilings) {
  let receiptBytes = 0;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const resourceObservation = {
      candidateFileCount: base.candidateFiles.length,
      candidateBytes,
      replayReservationBytes: reservationBytes,
      receiptBytes,
      evidenceBytes: reservationBytes + receiptBytes,
      totalWrittenBytes: candidateBytes + reservationBytes + receiptBytes,
      fileCountEnforced: true,
      candidateByteCeilingEnforced: true,
      evidenceByteCeilingEnforced: true,
      totalByteCeilingEnforced: true,
      attemptCountEnforced: true,
      durationEnforced: false,
      memoryEnforced: false,
      processesSpawned: 0,
      networkUsed: false
    };
    const core = { ...base, resourceObservation };
    const sealed = { ...core, receiptDigest: sha256Value(core) };
    const measured = jsonBytes(sealed).length;
    if (measured === receiptBytes) {
      if (resourceObservation.evidenceBytes > ceilings.evidenceByteCeiling ||
        resourceObservation.totalWrittenBytes > ceilings.totalByteCeiling) {
        throw new Error('materialization evidence or total bytes exceed signed ceilings');
      }
      return { receipt: sealed, bytes: jsonBytes(sealed) };
    }
    receiptBytes = measured;
  }
  throw new Error('materialization receipt byte measurement did not converge');
}

function normalizeReceipt(value) {
  exactKeys(value, [
    'schema', 'version', 'status', 'subjectRef', 'decisionEvaluationRef', 'decisionRef',
    'revocationSnapshotRef', 'candidateRef', 'moduleBundleRef', 'replayReservationRef',
    'candidate', 'candidateRootName', 'candidateFiles', 'nurseryRecordDigest',
    'nurseryStatus', 'resourceObservation', 'limitations', 'truth', 'authority', 'receiptDigest'
  ], 'materialization receipt');
  if (value.schema !== RECEIPT_SCHEMA || value.version !== VERSION || value.status !== 'DETACHED_CANDIDATE_WRITTEN_FOR_REVIEW' ||
    value.nurseryStatus !== 'READY_FOR_LATER_INTAKE' || value.authority !== 'DISPOSABLE_CANDIDATE_WRITE_ONLY_USED' ||
    !ROOT_NAME.test(value.candidateRootName)) throw new Error('materialization receipt identity, status, or authority mismatch');
  exactKeys(value.candidate, ['id', 'version', 'status'], 'materialization receipt.candidate');
  if (value.candidate.version !== 'v0.1' || value.candidate.status !== 'EXPERIMENTAL') throw new Error('materialization receipt candidate lifecycle mismatch');
  if (!Array.isArray(value.candidateFiles) || value.candidateFiles.length < 7 || value.candidateFiles.length > 17) throw new Error('materialization receipt candidate file count is invalid');
  const candidateFiles = value.candidateFiles.map((file, index) => {
    exactKeys(file, ['path', 'sha256', 'byteLength'], 'materialization receipt.candidateFiles[' + index + ']');
    return {
      path: Semantic.normalizePortablePath(file.path, 'materialization receipt candidate path'),
      sha256: digest(file.sha256, 'materialization receipt candidate digest'),
      byteLength: integer(file.byteLength, 'materialization receipt candidate bytes', 1, 1048576)
    };
  }).sort((left, right) => compareText(left.path, right.path));
  if (!same(candidateFiles, value.candidateFiles) || new Set(candidateFiles.map((file) => file.path.toLowerCase())).size !== candidateFiles.length) {
    throw new Error('materialization receipt candidate files are not canonical and unique');
  }
  const resourceFields = [
    'candidateFileCount', 'candidateBytes', 'replayReservationBytes', 'receiptBytes',
    'evidenceBytes', 'totalWrittenBytes', 'fileCountEnforced',
    'candidateByteCeilingEnforced', 'evidenceByteCeilingEnforced',
    'totalByteCeilingEnforced', 'attemptCountEnforced', 'durationEnforced',
    'memoryEnforced', 'processesSpawned', 'networkUsed'
  ];
  exactKeys(value.resourceObservation, resourceFields, 'materialization receipt.resourceObservation');
  const expectedCandidateBytes = candidateFiles.reduce((sum, file) => sum + file.byteLength, 0);
  const observation = clone(value.resourceObservation);
  ['candidateFileCount', 'candidateBytes', 'replayReservationBytes', 'receiptBytes', 'evidenceBytes', 'totalWrittenBytes', 'processesSpawned'].forEach((field) => {
    integer(observation[field], 'materialization receipt.resourceObservation.' + field, 0, 2097152);
  });
  if (observation.candidateFileCount !== candidateFiles.length || observation.candidateBytes !== expectedCandidateBytes ||
    observation.evidenceBytes !== observation.replayReservationBytes + observation.receiptBytes ||
    observation.totalWrittenBytes !== observation.candidateBytes + observation.evidenceBytes ||
    observation.receiptBytes !== jsonBytes(value).length) throw new Error('materialization receipt resource observation mismatch');
  const requiredTrue = ['fileCountEnforced', 'candidateByteCeilingEnforced', 'evidenceByteCeilingEnforced', 'totalByteCeilingEnforced', 'attemptCountEnforced'];
  const requiredFalse = ['durationEnforced', 'memoryEnforced', 'networkUsed'];
  if (requiredTrue.some((field) => observation[field] !== true) || requiredFalse.some((field) => observation[field] !== false) || observation.processesSpawned !== 0) {
    throw new Error('materialization receipt resource truth ceiling mismatch');
  }
  if (!same(value.limitations, LIMITATIONS.slice())) throw new Error('materialization receipt limitations drifted');
  const truth = receiptTruth();
  exactKeys(value.truth, Object.keys(truth), 'materialization receipt.truth');
  if (!same(value.truth, truth)) throw new Error('materialization receipt truth ceiling drifted');
  const core = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: 'DETACHED_CANDIDATE_WRITTEN_FOR_REVIEW',
    subjectRef: reference(value.subjectRef, 'materialization receipt.subjectRef'),
    decisionEvaluationRef: reference(value.decisionEvaluationRef, 'materialization receipt.decisionEvaluationRef'),
    decisionRef: reference(value.decisionRef, 'materialization receipt.decisionRef'),
    revocationSnapshotRef: reference(value.revocationSnapshotRef, 'materialization receipt.revocationSnapshotRef'),
    candidateRef: reference(value.candidateRef, 'materialization receipt.candidateRef'),
    moduleBundleRef: artifactReference(value.moduleBundleRef, 'materialization receipt.moduleBundleRef'),
    replayReservationRef: reference(value.replayReservationRef, 'materialization receipt.replayReservationRef'),
    candidate: { id: identifier(value.candidate.id, 'materialization receipt.candidate.id'), version: 'v0.1', status: 'EXPERIMENTAL' },
    candidateRootName: value.candidateRootName,
    candidateFiles,
    nurseryRecordDigest: digest(value.nurseryRecordDigest, 'materialization receipt.nurseryRecordDigest'),
    nurseryStatus: 'READY_FOR_LATER_INTAKE',
    resourceObservation: observation,
    limitations: LIMITATIONS.slice(),
    truth,
    authority: 'DISPOSABLE_CANDIDATE_WRITE_ONLY_USED'
  };
  const expectedPaths = [...Semantic.REQUIRED_CANDIDATE_FILES, 'module-bundle.json'].sort(compareText);
  const bundleFile = candidateFiles.find((file) => file.path === 'module-bundle.json');
  if (core.subjectRef.schema !== SUBJECT_SCHEMA || core.decisionEvaluationRef.schema !== EVALUATION_SCHEMA ||
    core.decisionRef.schema !== DECISION_SCHEMA || core.revocationSnapshotRef.schema !== REVOCATION_SCHEMA ||
    core.candidateRef.schema !== Semantic.PACKET_SCHEMA || core.moduleBundleRef.schema !== 'axm.module-bundle/v1' ||
    core.replayReservationRef.schema !== RESERVATION_SCHEMA || core.candidateRef.id !== core.candidate.id ||
    core.subjectRef.id !== core.candidate.id + '-tier1-materialization' ||
    core.decisionRef.id !== core.subjectRef.id + '-decision' ||
    core.decisionEvaluationRef.id !== core.decisionRef.id + '-evaluation' ||
    core.replayReservationRef.id !== core.decisionRef.id + '-replay-reservation' ||
    core.moduleBundleRef.id !== core.candidate.id + '-module-bundle' ||
    !core.candidateRootName.startsWith(ROOT_PREFIX + core.candidate.id + '-') ||
    !same(candidateFiles.map((file) => file.path), expectedPaths) || !bundleFile ||
    bundleFile.sha256 !== core.moduleBundleRef.sha256 || bundleFile.byteLength !== core.moduleBundleRef.byteLength) {
    throw new Error('materialization receipt references, candidate files, or identities conflict');
  }
  const receiptDigest = digest(value.receiptDigest, 'materialization receipt.receiptDigest');
  if (sha256Value(core) !== receiptDigest) throw new Error('materialization receipt digest mismatch');
  const normalized = { ...core, receiptDigest };
  if (!same(normalized, value)) throw new Error('materialization receipt is not canonical');
  return normalized;
}

function safeCleanupOwnedRoot(boundary) {
  if (!boundary || !ROOT_NAME.test(boundary.rootName) || !samePath(path.dirname(boundary.root), boundary.parent) ||
    !samePath(boundary.root, path.join(boundary.parent, boundary.rootName))) throw new Error('materialization cleanup boundary refused');
  if (fs.existsSync(boundary.root)) fs.rmSync(boundary.root, { recursive: true, force: true });
}

function materialize(input, options) {
  const evaluation = normalizeEvaluation(evaluateDecision(input, { trustedPolicyDigest: options.trustedPolicyDigest }));
  if (evaluation.status !== READY_STATUS) throw new Error('materialization held: ' + evaluation.status + ':' + evaluation.holds.join(','));
  const policy = normalizeTrustPolicy(input.trustPolicy);
  const decision = normalizeDecision(input.decision);
  const snapshot = normalizeRevocationSnapshot(input.revocationSnapshot);
  const prepared = prepare(input.generationRequest, policy);
  const boundary = validateBoundary(options, prepared.subject, false);
  const entries = candidateFileEntries(prepared.packet);
  const candidateBytes = entries.reduce((sum, file) => sum + file.byteLength, 0);
  const reservation = buildReservation(decision, prepared.subject, input.evaluatedAt);
  const reservationBytes = jsonBytes(reservation);
  const markerName = reservation.nonceDigest.slice('sha256:'.length) + '.json';
  const markerPath = path.join(boundary.ledgerRoot, markerName);
  const candidateRoot = path.join(boundary.root, prepared.packet.candidate.id);
  let ownedRootCreated = false;
  try {
    fs.writeFileSync(markerPath, reservationBytes, { flag: 'wx' });
    fs.mkdirSync(boundary.root);
    ownedRootCreated = true;
    fs.mkdirSync(candidateRoot);
    entries.forEach((entry, index) => {
      fs.writeFileSync(path.join(candidateRoot, entry.path), entry.bytes, { flag: 'wx' });
      if (options.faultAt === 'AFTER_FIRST_FILE' && index === 0) throw new Error('bounded materialization fault after first file');
    });
    if (options.faultAt === 'AFTER_CANDIDATE_FILES') throw new Error('bounded materialization fault after candidate files');
    entries.forEach((entry) => {
      const readback = fs.readFileSync(path.join(candidateRoot, entry.path));
      if (!readback.equals(entry.bytes)) throw new Error('candidate readback byte drift: ' + entry.path);
    });
    const nurseryRecord = Nursery.inspectCandidate(candidateRoot, prepared.packet.candidate.id);
    if (nurseryRecord.status !== 'READY_FOR_LATER_INTAKE' || nurseryRecord.errors.length) {
      throw new Error('Detached Candidate Nursery rejected the materialized candidate');
    }
    if (options.faultAt === 'AFTER_NURSERY_INSPECTION') throw new Error('bounded materialization fault after Nursery inspection');
    const receiptBase = {
      schema: RECEIPT_SCHEMA,
      version: VERSION,
      status: 'DETACHED_CANDIDATE_WRITTEN_FOR_REVIEW',
      subjectRef: subjectRef(prepared.subject),
      decisionEvaluationRef: evaluationRef(evaluation),
      decisionRef: decisionRef(decision),
      revocationSnapshotRef: revocationRef(snapshot),
      candidateRef: prepared.subject.candidateRef,
      moduleBundleRef: prepared.subject.moduleBundleRef,
      replayReservationRef: reservationRef(reservation),
      candidate: clone(prepared.packet.candidate),
      candidateRootName: boundary.rootName,
      candidateFiles: entries.map(sourceFileRef),
      nurseryRecordDigest: sha256Value(nurseryRecord),
      nurseryStatus: nurseryRecord.status,
      limitations: LIMITATIONS.slice(),
      truth: receiptTruth(),
      authority: 'DISPOSABLE_CANDIDATE_WRITE_ONLY_USED'
    };
    const sealed = sealReceiptStable(receiptBase, reservationBytes.length, candidateBytes, prepared.subject.resources);
    const receiptFile = path.join(boundary.root, 'materialization-receipt.json');
    fs.writeFileSync(receiptFile, sealed.bytes, { flag: 'wx' });
    const readback = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    const receipt = normalizeReceipt(readback);
    return receipt;
  } catch (error) {
    if (ownedRootCreated) safeCleanupOwnedRoot(boundary);
    throw error;
  }
}

function verifyMaterialization(receiptInput, input, options) {
  const errors = [];
  try {
    const receipt = normalizeReceipt(receiptInput);
    const evaluation = normalizeEvaluation(evaluateDecision(input, { trustedPolicyDigest: options.trustedPolicyDigest }));
    if (evaluation.status !== READY_STATUS || !same(receipt.decisionEvaluationRef, evaluationRef(evaluation))) {
      throw new Error('materialization receipt does not bind a current ready decision evaluation');
    }
    const prepared = prepare(input.generationRequest, input.trustPolicy);
    const boundary = validateBoundary(options, prepared.subject, true);
    const reservationFiles = fs.readdirSync(boundary.ledgerRoot).filter((name) => name.endsWith('.json'));
    const reservation = reservationFiles.map((name) => {
      try { return normalizeReservation(JSON.parse(fs.readFileSync(path.join(boundary.ledgerRoot, name), 'utf8'))); } catch (_) { return null; }
    }).find((item) => item && same(reservationRef(item), receipt.replayReservationRef));
    if (!reservation) throw new Error('materialization replay reservation is missing or drifted');
    const candidateRoot = path.join(boundary.root, prepared.packet.candidate.id);
    const entries = candidateFileEntries(prepared.packet);
    const observed = entries.map((entry) => {
      const target = path.join(candidateRoot, entry.path);
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('materialized candidate file is not regular: ' + entry.path);
      const bytes = fs.readFileSync(target);
      return { path: entry.path, sha256: sha256Bytes(bytes), byteLength: bytes.length };
    });
    if (!same(observed, receipt.candidateFiles)) throw new Error('materialized candidate bytes differ from receipt');
    const nurseryRecord = Nursery.inspectCandidate(candidateRoot, prepared.packet.candidate.id);
    if (nurseryRecord.status !== 'READY_FOR_LATER_INTAKE' || sha256Value(nurseryRecord) !== receipt.nurseryRecordDigest) {
      throw new Error('materialized candidate Nursery evidence drifted');
    }
    const receiptFile = path.join(boundary.root, 'materialization-receipt.json');
    if (!same(JSON.parse(fs.readFileSync(receiptFile, 'utf8')), receipt)) throw new Error('materialization receipt file drifted');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function buildExampleTrustPolicy(decisionKey, revocationKey) {
  return sealTrustPolicy({
    schema: TRUST_POLICY_SCHEMA,
    version: VERSION,
    id: 'mike-tier1-candidate-policy',
    status: 'TEST',
    seatRef: { id: 'mike-review-seat', schema: 'axm.human-review-seat/v1', sha256: sha256Value({ id: 'mike-review-seat', kind: 'human-merge-gate' }) },
    decisionKey,
    revocationKey,
    nurseryRef: { id: 'detached-candidate-nursery', schema: 'axm.detached-candidate-nursery/v1', sha256: sha256Value({ id: 'detached-candidate-nursery', version: 'v0.1' }) },
    scope: SCOPE,
    tier: 1,
    allowedRecipeIds: [Semantic.RECIPE_ID],
    validFrom: '2026-08-23T08:00:00.000Z',
    expiresAt: '2026-08-24T08:00:00.000Z',
    maximumDecisionWindowMs: 3600000,
    maximumRevocationAgeMs: 300000,
    resources: {
      maxCandidateFiles: 7,
      maxCandidateBytes: 600000,
      maxEvidenceBytes: 65536,
      maxTotalBytes: 665536,
      maxAttempts: 1,
      maxProcesses: 1,
      maxCostMinorUnits: 0
    },
    allowedPermissions: [],
    allowedNetworkDomains: [],
    lifecycle: { install: false, integrate: false, publish: false, learn: false, train: false, physicalActuation: false, promote: false, canon: false },
    authority: 'HOST_TRUST_ANCHOR_DECLARATION'
  });
}

module.exports = {
  VERSION,
  TRUST_POLICY_SCHEMA,
  SUBJECT_SCHEMA,
  DECISION_SCHEMA,
  REVOCATION_SCHEMA,
  EVALUATION_SCHEMA,
  RESERVATION_SCHEMA,
  RECEIPT_SCHEMA,
  SCOPE,
  LEDGER_DIRECTORY,
  ROOT_PREFIX,
  ROOTS,
  CHOICES,
  LIMITATIONS,
  READY_STATUS,
  canonicalJson,
  sha256Value,
  sha256Bytes,
  jsonBytes,
  sealTrustPolicy,
  normalizeTrustPolicy,
  policyRef,
  prepare,
  normalizeSubject,
  subjectRef,
  buildDecision,
  buildDecisionSignaturePayload,
  attachDecisionSignature,
  normalizeDecision,
  decisionRef,
  buildRevocationSnapshot,
  buildRevocationSignaturePayload,
  attachRevocationSignature,
  normalizeRevocationSnapshot,
  revocationRef,
  evaluateDecision,
  normalizeEvaluation,
  verifyDecisionEvaluation,
  evaluationRef,
  buildReservation,
  normalizeReservation,
  reservationRef,
  candidateRootName,
  candidateFileEntries,
  validateBoundary,
  normalizeReceipt,
  materialize,
  verifyMaterialization,
  buildExampleTrustPolicy,
  clone
};
