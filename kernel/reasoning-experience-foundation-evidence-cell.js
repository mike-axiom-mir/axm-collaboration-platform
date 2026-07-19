'use strict';

const Experience = require('../organs/reasoning-experience-organ');
const EnvelopeAdapter = require('../organs/foundation-evidence-envelope-adapter-organ');

const CELL_ID = 'axm.mirror.reasoning-experience-foundation-evidence-cell/v1';
const TARGET_CAPABILITY = 'axm.mirror.declared-capability/reasoning-experience-negative-observation/v1';
const TARGET_OUTPUT_KIND = 'axm.mirror.reasoning-experience-receipt/v4';
const TARGET_OUTPUT_KINDS = Object.freeze([TARGET_OUTPUT_KIND, 'axm.mirror.reasoning-experience-receipt/v5']);
const TARGET_HAND_FAMILY = 'NON_INDUCING_LOCAL_EVENT_OBSERVATION_HAND';
const TARGET_EVIDENCE_KIND = 'PASSIVE_VERIFIED_REAL_LOCAL_NEGATIVE_EPISODE';
const TARGET_ACQUISITION_MODE = 'PASSIVE_LOCAL_OBSERVATION';
const ELIGIBLE_STATE = 'ELIGIBLE_PASSIVE_VERIFIED_REAL_LOCAL_NEGATIVE_EPISODE_CANDIDATE';

function stable(value) { return EnvelopeAdapter.stable(value); }
function digest(value) { return EnvelopeAdapter.digest(value); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

function verifyRoute(hand, adapterRequest) {
  EnvelopeAdapter.verifyHand(hand);
  if (!adapterRequest || adapterRequest.source.handRequestId !== hand.handRequestId || adapterRequest.source.handRequestDigest !== hand.handRequestDigest) {
    throw new Error('reasoning-experience evidence route changed its exact hand binding');
  }
  if (adapterRequest.source.capabilityId !== TARGET_CAPABILITY || !TARGET_OUTPUT_KINDS.some(kind => (adapterRequest.adapterContract.inputKinds || []).includes(kind))) {
    throw new Error('reasoning-experience evidence route changed capability or native output kind');
  }
  if (hand.handFamily !== TARGET_HAND_FAMILY || hand.evidenceNeed.evidenceKind !== TARGET_EVIDENCE_KIND || hand.evidenceNeed.acquisitionMode !== TARGET_ACQUISITION_MODE) {
    throw new Error('reasoning-experience evidence route changed its machine-readable evidence need');
  }
  if (hand.evidenceNeed.permissionRequired !== true || hand.evidenceNeed.independentFromCandidate !== true || hand.evidenceNeed.eventInductionAllowed !== false || hand.evidenceNeed.candidateMayAuthorExpectedResult !== false) {
    throw new Error('reasoning-experience evidence route weakened its evidence boundary');
  }
  return true;
}

function provenance(receipt, nativeVerified) {
  if (!nativeVerified) return {
    sourceClass: 'UNKNOWN',
    authorshipDeclaration: null,
    authorshipState: 'UNKNOWN',
    independenceDeclaration: null,
    independenceState: 'UNKNOWN',
    observedOutcome: 'UNKNOWN',
    nativeAcceptanceState: 'NATIVE_VERIFICATION_REFUSED'
  };
  const real = receipt.source.experienceKind === 'REAL_LOCAL_LESSON';
  const generated = ['SYNTHETIC_COUNTEREXAMPLE', 'CONTRACT_DERIVED_EXAM'].includes(receipt.source.experienceKind);
  return {
    sourceClass: real ? 'REAL_LOCAL' : generated ? 'SYNTHETIC_FIXTURE' : 'UNKNOWN',
    authorshipDeclaration: `Receipt ${receipt.receiptId} declares local production by ${receipt.organ.id} under ${receipt.source.policyId}.`,
    authorshipState: 'DECLARED_NOT_CERTIFIED',
    independenceDeclaration: receipt.source.evaluator.independent === true,
    independenceState: 'DECLARED_NOT_CERTIFIED',
    observedOutcome: receipt.evaluation.result === 'DID_NOT_WORK' ? 'NEGATIVE' : receipt.evaluation.result === 'WORKED' ? 'POSITIVE' : 'UNKNOWN',
    nativeAcceptanceState: receipt.admission.state
  };
}

function permission(receipt, nativeVerified) {
  if (!nativeVerified || !receipt.source || receipt.source.usePermission !== 'allowed' || !String(receipt.source.permissionBasis || '').trim()) {
    return { status: 'UNKNOWN', basis: null, attribution: null };
  }
  return {
    status: 'ALLOWED',
    basis: receipt.source.permissionBasis,
    attribution: receipt.source.provider
  };
}

function evaluate(receipt, artifactDigest, hand, adapterRequest) {
  verifyRoute(hand, adapterRequest);
  const failedCriteria = [];
  let nativeVerified = false;
  let verificationIssue = null;
  try {
    Experience.verify(receipt);
    nativeVerified = TARGET_OUTPUT_KINDS.includes(receipt.schema) && (adapterRequest.adapterContract.inputKinds || []).includes(receipt.schema) && digest(receipt) === artifactDigest;
    if (!nativeVerified) verificationIssue = 'ROOT_SCHEMA_OR_ARTIFACT_DIGEST_MISMATCH';
  } catch (error) {
    verificationIssue = 'NATIVE_REASONING_EXPERIENCE_VERIFICATION_REFUSED';
  }
  const declaredPermission = permission(receipt || {}, nativeVerified);
  const declaredProvenance = provenance(receipt || {}, nativeVerified);
  const noSyntheticLineage = nativeVerified && receipt.source.parentReceiptIds.length === 0 && receipt.source.interventionId === null;
  const verifiedNegative = nativeVerified && receipt.evaluation.outcomeVerified === true && receipt.evaluation.result === 'DID_NOT_WORK' && receipt.evaluation.behaviorMatched === false &&
    receipt.trainingExample.outcome === 'DID_NOT_WORK' && receipt.trainingExample.evidenceRole === 'NEGATIVE_EPISODIC_EXAMPLE' && receipt.trainingExample.prototype === null;
  const closedEpisodeAuthority = nativeVerified && receipt.evaluation.worldMutations === 0 && receipt.evaluation.runtimePointerChanged === false &&
    receipt.authority.toolUse === false && receipt.authority.worldAction === false && receipt.authority.permissionGrant === false &&
    receipt.authority.semanticTruthWrite === false && receipt.authority.activeModelChange === false && receipt.authority.runtimePromotion === false && receipt.authority.canonChange === false;
  const criteria = {
    nativeReceiptVerified: nativeVerified,
    exactEvidenceKind: hand.evidenceNeed.evidenceKind === TARGET_EVIDENCE_KIND,
    passiveAcquisitionMode: hand.evidenceNeed.acquisitionMode === TARGET_ACQUISITION_MODE,
    eventInductionForbidden: hand.evidenceNeed.eventInductionAllowed === false,
    permissionExplicitlyAllowed: declaredPermission.status === 'ALLOWED',
    realLocalSource: declaredProvenance.sourceClass === 'REAL_LOCAL',
    independentEvaluatorDeclared: declaredProvenance.independenceDeclaration === true,
    verifiedNegativeOutcome: verifiedNegative,
    syntheticLineageAbsent: noSyntheticLineage,
    episodeAuthorityClosed: closedEpisodeAuthority
  };
  for (const [key, value] of Object.entries(criteria)) if (value !== true) failedCriteria.push(key);
  const eligible = failedCriteria.length === 0;
  const state = eligible ? ELIGIBLE_STATE
    : !nativeVerified ? 'HOLD_NATIVE_REASONING_EXPERIENCE_VERIFICATION_REFUSED'
      : declaredPermission.status !== 'ALLOWED' ? 'HOLD_EXPLICIT_USE_PERMISSION_NOT_ALLOWED'
        : declaredProvenance.sourceClass !== 'REAL_LOCAL' ? 'HOLD_SYNTHETIC_OR_CONTRACT_DERIVED_EPISODE_NOT_REAL_LOCAL'
          : !verifiedNegative ? 'HOLD_REAL_LOCAL_EPISODE_HAS_NO_VERIFIED_NEGATIVE_OUTCOME'
            : declaredProvenance.independenceDeclaration !== true ? 'HOLD_INDEPENDENT_EVALUATOR_NOT_DECLARED'
              : !noSyntheticLineage ? 'HOLD_SYNTHETIC_LINEAGE_PRESENT'
                : 'HOLD_EPISODE_AUTHORITY_BOUNDARY_OPEN';
  const envelopeInput = eligible ? {
    schema: EnvelopeAdapter.INPUT_SCHEMA,
    capabilityId: TARGET_CAPABILITY,
    declarationDigest: adapterRequest.source.declarationDigest,
    nativeOutputKind: receipt.schema,
    nativeArtifact: stable(receipt),
    nativeArtifactDigest: artifactDigest,
    permission: declaredPermission,
    provenance: declaredProvenance,
    authority: {
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
    boundary: 'A hardcoded verifier projected only explicit compatible v4 or v5 receipt fields into an opaque generic evidence-candidate envelope. Eligibility is bounded to one passive, permissioned, independently evaluated, real-local negative episode and grants no evidence admission or authority.'
  } : null;
  if (envelopeInput) EnvelopeAdapter.validateInput(envelopeInput, adapterRequest, hand);
  return stable({
    state,
    eligible,
    verificationIssue,
    receiptId: nativeVerified ? receipt.receiptId : null,
    receiptDigest: nativeVerified ? receipt.receiptDigest : null,
    permission: declaredPermission,
    provenance: declaredProvenance,
    criteria,
    failedCriteria,
    envelopeInput,
    authority: {
      evidenceAdmission: false,
      evidenceRelabeling: false,
      eventInduction: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This deterministic assessment verifies one existing native receipt and tests one exact machine-readable evidence need. It does not induce failure, certify authorship or independence, admit evidence, select a capability, train, promote, or act.'
  });
}

function verifyAssessment(assessment, receipt, artifactDigest, hand, adapterRequest) {
  if (!assessment || !Object.values(assessment.authority || {}).every(value => value === false)) throw new Error('reasoning-experience evidence assessment gained authority');
  if (receipt && !same(assessment, evaluate(receipt, artifactDigest, hand, adapterRequest))) throw new Error('reasoning-experience evidence assessment changed');
  if (assessment.eligible !== (assessment.state === ELIGIBLE_STATE) || assessment.eligible !== ((assessment.failedCriteria || []).length === 0)) {
    throw new Error('reasoning-experience evidence eligibility state changed');
  }
  if (assessment.eligible && !assessment.envelopeInput) throw new Error('eligible reasoning experience lacks an exact envelope input');
  if (!assessment.eligible && assessment.envelopeInput !== null) throw new Error('held reasoning experience exposed an evidence candidate input');
  return true;
}

module.exports = {
  CELL_ID, TARGET_CAPABILITY, TARGET_OUTPUT_KIND, TARGET_OUTPUT_KINDS, TARGET_HAND_FAMILY, TARGET_EVIDENCE_KIND, TARGET_ACQUISITION_MODE, ELIGIBLE_STATE,
  stable, digest, same, verifyRoute, provenance, permission, evaluate, verifyAssessment
};
