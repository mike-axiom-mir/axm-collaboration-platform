'use strict';

const crypto = require('crypto');
const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const OutputAdapterPlanner = require('./foundation-development-capability-output-adapter-planner-organ');

const ORGAN_ID = 'axm.mirror.foundation-evidence-envelope-adapter-organ/v1';
const INPUT_SCHEMA = 'axm.mirror.foundation-capability-native-output-envelope-input/v1';
const OUTPUT_SCHEMA = 'axm.mirror.foundation-evidence-candidate/v1';
const HAND_SCHEMA = 'axm.mirror.foundation-development-hand-request/v1';
const OUTPUT_KIND = 'CONTENT_DIGESTED_FOUNDATION_EVIDENCE_CANDIDATE';
const MAX_ARTIFACT_BYTES = 1024 * 1024;
const MAX_DEPTH = 32;
const MAX_NODES = 10000;
const HIDDEN_KEYS = new Set(['chainofthought', 'chain_of_thought', 'hiddenthoughts', 'hidden_reasoning', 'hiddenreasoning', 'internalscratchpad', 'internal_scratchpad', 'privatereasoning', 'private_reasoning', 'scratchpad']);

function stable(value) { return KeySafeJson.stable(value); }
function digest(value) {
  if (typeof value === 'string' || Buffer.isBuffer(value)) return crypto.createHash('sha256').update(value).digest('hex');
  return KeySafeJson.digest(value);
}
function same(left, right) { return KeySafeJson.same(left, right); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (!same(actual, expected)) throw new Error(`${label} fields changed`);
}
function clean(value, limit = 2000) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > limit) throw new Error('foundation evidence envelope text boundary changed');
  return text;
}
function withoutDigest(value, key) { return Object.assign({}, value, { [key]: null }); }

function assertJsonArtifact(value) {
  try {
    KeySafeJson.canonicalize(value, {
      maxBytes: MAX_ARTIFACT_BYTES,
      maxDepth: MAX_DEPTH,
      maxNodes: MAX_NODES,
      rejectKey(key) {
        const normalized = key.toLowerCase().replace(/[-\s]/g, '');
        return HIDDEN_KEYS.has(key.toLowerCase()) || HIDDEN_KEYS.has(normalized);
      },
      rejectedKeyMessage: 'native artifact contains hidden reasoning'
    });
  } catch (error) {
    if (error && error.code === 'BOUNDED_JSON_STRUCTURE_LIMIT') throw new Error('native artifact exceeds the bounded JSON structure');
    if (error && error.code === 'BOUNDED_JSON_SIZE_LIMIT') throw new Error('native artifact exceeds the bounded JSON envelope');
    if (error && error.code === 'NON_FINITE_NUMBER') throw new Error('native artifact contains a non-finite number');
    if (error && error.code === 'KEY_POLICY_REFUSAL') throw error;
    if (error && ['NON_PLAIN_ARRAY', 'NON_PLAIN_OBJECT', 'PROXY_REFUSED', 'ACCESSOR_OR_HIDDEN_PROPERTY', 'SYMBOL_KEY', 'NON_JSON_ARRAY_SHAPE'].includes(error.code)) {
      throw new Error(`native artifact is not inert plain JSON: ${error.code}`);
    }
    throw error;
  }
  return true;
}

function verifyHand(hand) {
  if (!hand || hand.schema !== HAND_SCHEMA) throw new Error('foundation evidence envelope hand schema changed');
  const expected = digest(Object.assign({}, hand, { handRequestDigest: null }));
  if (hand.handRequestDigest !== expected) throw new Error('foundation evidence envelope hand digest changed');
  if (!hand.proposedContract || hand.proposedContract.outputKind !== OUTPUT_KIND) throw new Error('foundation evidence envelope hand output kind changed');
  if (!hand.evidenceNeed || !String(hand.evidenceNeed.evidenceKind || '').trim()) throw new Error('foundation evidence envelope evidence need changed');
  if (!hand.authority || Object.values(hand.authority).some(value => value !== false)) throw new Error('foundation evidence envelope hand authority changed');
  return true;
}

function validateInput(input, request, hand) {
  exactKeys(input, ['schema', 'capabilityId', 'declarationDigest', 'nativeOutputKind', 'nativeArtifact', 'nativeArtifactDigest', 'permission', 'provenance', 'authority', 'boundary'], 'native envelope input');
  if (input.schema !== INPUT_SCHEMA) throw new Error('native envelope input schema changed');
  OutputAdapterPlanner.verifyRequest(request);
  verifyHand(hand);
  if (request.source.handRequestId !== hand.handRequestId || request.source.handRequestDigest !== hand.handRequestDigest) throw new Error('native envelope hand binding changed');
  if (input.capabilityId !== request.source.capabilityId || input.declarationDigest !== request.source.declarationDigest) throw new Error('native envelope declaration binding changed');
  if (!(request.adapterContract.inputKinds || []).includes(input.nativeOutputKind)) throw new Error('native envelope input kind is not declared by the adapter request');
  if (request.adapterContract.outputKind !== OUTPUT_KIND) throw new Error('native envelope requested output kind changed');
  assertJsonArtifact(input.nativeArtifact);
  if (input.nativeArtifactDigest !== digest(input.nativeArtifact)) throw new Error('native envelope artifact digest changed');
  exactKeys(input.permission, ['status', 'basis', 'attribution'], 'native envelope permission');
  if (!['ALLOWED', 'UNKNOWN', 'FORBIDDEN'].includes(input.permission.status)) throw new Error('native envelope permission status changed');
  if (input.permission.status === 'FORBIDDEN') throw new Error('native envelope refuses forbidden source material');
  if (hand.evidenceNeed.permissionRequired === true && input.permission.status !== 'ALLOWED') throw new Error('native envelope requires explicit allowed permission');
  if (input.permission.status === 'ALLOWED') {
    clean(input.permission.basis, 2000);
    clean(input.permission.attribution, 1000);
  } else if (input.permission.basis !== null || input.permission.attribution !== null) {
    throw new Error('native envelope unknown or forbidden permission cannot carry an inferred basis');
  }
  exactKeys(input.provenance, ['sourceClass', 'authorshipDeclaration', 'authorshipState', 'independenceDeclaration', 'independenceState', 'observedOutcome', 'nativeAcceptanceState'], 'native envelope provenance');
  if (!['REAL_LOCAL', 'OUTSIDE_SUBMISSION', 'SYNTHETIC_FIXTURE', 'UNKNOWN'].includes(input.provenance.sourceClass)) throw new Error('native envelope source class changed');
  if (!['DECLARED_NOT_CERTIFIED', 'UNKNOWN'].includes(input.provenance.authorshipState)) throw new Error('native envelope authorship state changed');
  if (!['DECLARED_NOT_CERTIFIED', 'UNKNOWN'].includes(input.provenance.independenceState)) throw new Error('native envelope independence state changed');
  if (!['POSITIVE', 'NEGATIVE', 'UNKNOWN', 'NOT_APPLICABLE'].includes(input.provenance.observedOutcome)) throw new Error('native envelope observed outcome changed');
  if (input.provenance.authorshipState === 'DECLARED_NOT_CERTIFIED') clean(input.provenance.authorshipDeclaration, 2000);
  else if (input.provenance.authorshipDeclaration !== null) throw new Error('native envelope unknown authorship cannot carry an inferred declaration');
  if (input.provenance.independenceState === 'DECLARED_NOT_CERTIFIED' && typeof input.provenance.independenceDeclaration !== 'boolean') throw new Error('native envelope declared independence requires a boolean declaration');
  if (input.provenance.independenceState === 'UNKNOWN' && input.provenance.independenceDeclaration !== null) throw new Error('native envelope unknown independence cannot carry an inferred declaration');
  clean(input.provenance.nativeAcceptanceState, 500);
  exactKeys(input.authority, ['evidenceAdmission', 'evidenceRelabeling', 'operationalFitClaim', 'newOrganNeedClaim', 'permissionGrant', 'trainingAdmission', 'runtimePromotion', 'canonChange', 'worldAction'], 'native envelope authority');
  if (Object.values(input.authority).some(value => value !== false)) throw new Error('native envelope input requests authority');
  clean(input.boundary, 3000);
  return true;
}

function buildCandidate(input, request, hand) {
  validateInput(input, request, hand);
  const candidate = {
    schema: OUTPUT_SCHEMA,
    candidateId: null,
    candidateDigest: null,
    organ: {
      id: ORGAN_ID,
      learnedWeights: false,
      capabilitySpecificRouting: false,
      nativeArtifactInterpretation: false,
      nativeVerificationClaim: false
    },
    source: {
      adapterRequestId: request.adapterRequestId,
      adapterRequestDigest: request.adapterRequestDigest,
      handRequestId: hand.handRequestId,
      handRequestDigest: hand.handRequestDigest,
      capabilityId: input.capabilityId,
      declarationDigest: input.declarationDigest
    },
    native: {
      outputKind: input.nativeOutputKind,
      artifactDigest: input.nativeArtifactDigest,
      artifact: stable(input.nativeArtifact),
      verification: 'NOT_RECHECKED_BY_GENERIC_ENVELOPE_ADAPTER'
    },
    permission: stable(input.permission),
    provenance: stable(input.provenance),
    requestedEvidence: {
      evidenceKind: hand.evidenceNeed.evidenceKind,
      sourceConstraint: hand.evidenceNeed.sourceConstraint,
      independentFromCandidate: hand.evidenceNeed.independentFromCandidate,
      eventInductionAllowed: hand.evidenceNeed.eventInductionAllowed,
      classificationState: 'REQUESTED_NOT_PROVEN'
    },
    assessment: {
      evidenceAdmission: 'NOT_ADMITTED',
      acceptanceState: 'UNASSESSED',
      operationalFit: 'UNTESTED',
      newOrganNeed: 'UNASSESSED',
      realEvidenceProduced: false
    },
    authority: {
      privateCandidateTraceWrite: false,
      nativeSourceExecution: false,
      nativeVerificationClaim: false,
      evidenceAdmission: false,
      evidenceRelabeling: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This is a content-sealed opaque native-output envelope and Foundation evidence candidate only. The generic adapter does not interpret or re-verify the native artifact, certify authorship or independence, prove the requested evidence class, admit evidence, claim operational fit, decide organ need, grant permission, train, promote, change canon, or act.'
  };
  const basis = Object.assign({}, candidate, { candidateId: null, candidateDigest: null });
  candidate.candidateId = `foundation-evidence-candidate-${digest(basis).slice(0, 24)}`;
  candidate.candidateDigest = digest(withoutDigest(candidate, 'candidateDigest'));
  return candidate;
}

function verifyCandidate(candidate, input, request, hand) {
  if (!candidate || candidate.schema !== OUTPUT_SCHEMA || candidate.candidateDigest !== digest(withoutDigest(candidate, 'candidateDigest'))) throw new Error('foundation evidence candidate digest changed');
  const expectedId = `foundation-evidence-candidate-${digest(Object.assign({}, candidate, { candidateId: null, candidateDigest: null })).slice(0, 24)}`;
  if (candidate.candidateId !== expectedId) throw new Error('foundation evidence candidate id changed');
  if (!candidate.organ || candidate.organ.id !== ORGAN_ID || candidate.organ.learnedWeights !== false || candidate.organ.capabilitySpecificRouting !== false || candidate.organ.nativeArtifactInterpretation !== false || candidate.organ.nativeVerificationClaim !== false) throw new Error('foundation evidence envelope organ boundary changed');
  if (!candidate.assessment || candidate.assessment.evidenceAdmission !== 'NOT_ADMITTED' || candidate.assessment.acceptanceState !== 'UNASSESSED' || candidate.assessment.operationalFit !== 'UNTESTED' || candidate.assessment.newOrganNeed !== 'UNASSESSED' || candidate.assessment.realEvidenceProduced !== false) throw new Error('foundation evidence candidate assessment changed');
  if (!candidate.authority || Object.values(candidate.authority).some(value => value !== false)) throw new Error('foundation evidence candidate authority changed');
  if (input && request && hand && !same(buildCandidate(input, request, hand), candidate)) throw new Error('foundation evidence candidate content changed');
  return true;
}

module.exports = {
  ORGAN_ID, INPUT_SCHEMA, OUTPUT_SCHEMA, HAND_SCHEMA, OUTPUT_KIND, MAX_ARTIFACT_BYTES, MAX_DEPTH, MAX_NODES,
  stable, digest, assertJsonArtifact, verifyHand, validateInput, buildCandidate, verifyCandidate
};
