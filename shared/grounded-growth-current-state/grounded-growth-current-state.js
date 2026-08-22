'use strict';

const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Participation = require('../grounded-growth-participation-frontier/grounded-growth-participation-frontier');

const RECEIPT_SCHEMA = 'axm.grounded-growth-current-state-receipt/v1';
const DETACHED_VERIFICATION_SCHEMA = 'axm.grounded-growth-current-state-detached-verification/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  return Growth.stableStringify(value);
}

function sha256(value) {
  return Growth.sha256(value);
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unsupported field(s): ' + extras.join(', '));
}

function requiredText(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > (maximum || 180)) throw new Error(label + ' is too long');
  return result;
}

function exactTimestamp(value, label) {
  const result = requiredText(value, label, 80);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime())) throw new Error(label + ' is not a timestamp');
  return parsed.toISOString();
}

function reference(value, idField, digestField, label) {
  if (!value || typeof value !== 'object') throw new Error(label + ' source is required');
  const result = {
    id: requiredText(value[idField], label + ' id'),
    schema: requiredText(value.schema, label + ' schema', 240),
    sha256: requiredText(value[digestField], label + ' digest', 80).toLowerCase()
  };
  if (!DIGEST.test(result.sha256)) throw new Error(label + ' digest is not SHA-256');
  return result;
}

function participationPortfolio(input) {
  const portfolio = input
    && input.knowledgeFrontierInput
    && input.knowledgeFrontierInput.stewardshipFrontierInput
    && input.knowledgeFrontierInput.stewardshipFrontierInput.evidenceFrontierInput
    && input.knowledgeFrontierInput.stewardshipFrontierInput.evidenceFrontierInput.frontierInput
    && input.knowledgeFrontierInput.stewardshipFrontierInput.evidenceFrontierInput.frontierInput.portfolio;
  const check = Growth.verifyPortfolio(portfolio);
  if (!check.pass) throw new Error('participation source portfolio invalid: ' + check.errors.join('; '));
  return portfolio;
}

function compareExtension(basePortfolio, currentPortfolio, protectedCapabilities) {
  const base = basePortfolio.outcomes || [];
  const current = currentPortfolio.outcomes || [];
  if (current.length < base.length) throw new Error('current portfolio cannot remove historical outcomes');
  for (let index = 0; index < base.length; index += 1) {
    if (stableStringify(base[index]) !== stableStringify(current[index])) {
      throw new Error('current portfolio rewrites or reorders historical outcome index ' + index);
    }
  }
  const appended = current.slice(base.length);
  const protectedSet = new Set(protectedCapabilities || []);
  const affectedProtectedCapabilities = Array.from(new Set(
    appended.filter((outcome) => protectedSet.has(outcome.capabilityId)).map((outcome) => outcome.capabilityId)
  )).sort();
  return {
    state: appended.length ? 'VALID_FORWARD_EXTENSION' : 'NO_NEW_INFORMATION',
    baseOutcomeCount: base.length,
    currentOutcomeCount: current.length,
    appendedOutcomeCount: appended.length,
    appended,
    affectedProtectedCapabilities,
    historicalOutcomeBytesPreserved: true
  };
}

function humanHandoffCapabilities(frontier) {
  return Array.from(new Set((frontier.lanes || [])
    .filter((lane) => lane && lane.capabilityId && lane.humanClaimId && lane.targetScope)
    .map((lane) => lane.capabilityId))).sort();
}

function effectiveClaims(portfolio) {
  return portfolio.latest.flatMap((latest) => {
    const matches = portfolio.outcomes.filter((outcome) => outcome.receiptDigest === latest.effectiveReceiptDigest);
    if (matches.length !== 1) throw new Error('portfolio effective outcome reference is not unique: ' + latest.capabilityId);
    return matches[0].claims;
  });
}

function verdictCounts(claims) {
  const result = {};
  claims.forEach((claim) => {
    const key = claim.beneficiary + ':' + claim.admittedVerdict;
    result[key] = (result[key] || 0) + 1;
  });
  return result;
}

function detachedIssues(receipt) {
  const issues = [];
  const issue = (section, code, detail) => issues.push({ section, code, detail });
  const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const exactShape = (value, keys, label) => {
    if (!isObject(value)) {
      issue('STRUCTURE', 'OBJECT_REQUIRED', label + ' must be an object');
      return false;
    }
    const actual = Object.keys(value).sort();
    const expected = keys.slice().sort();
    if (stableStringify(actual) !== stableStringify(expected)) {
      issue('STRUCTURE', 'EXACT_FIELDS_REQUIRED', label + ' fields do not match the receipt contract');
      return false;
    }
    return true;
  };
  const integer = (value, label) => {
    if (!Number.isInteger(value) || value < 0) issue('COHERENCE', 'NONNEGATIVE_INTEGER_REQUIRED', label + ' must be a non-negative integer');
  };
  const boolean = (value, label) => {
    if (typeof value !== 'boolean') issue('STRUCTURE', 'BOOLEAN_REQUIRED', label + ' must be boolean');
  };
  const text = (value, label, maximum) => {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) issue('STRUCTURE', 'TEXT_REQUIRED', label + ' must be bounded non-empty text');
  };
  const stringSet = (value, label) => {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
      issue('STRUCTURE', 'STRING_SET_REQUIRED', label + ' must be a string array');
      return [];
    }
    const normalized = Array.from(new Set(value)).sort();
    if (stableStringify(normalized) !== stableStringify(value)) issue('COHERENCE', 'SORTED_UNIQUE_SET_REQUIRED', label + ' must be sorted and unique');
    return normalized;
  };
  const referenceShape = (value, label) => {
    if (!exactShape(value, ['id', 'schema', 'sha256'], label)) return;
    text(value.id, label + '.id', 180);
    text(value.schema, label + '.schema', 240);
    if (!DIGEST.test(String(value.sha256 || '').toLowerCase())) issue('STRUCTURE', 'REFERENCE_DIGEST_INVALID', label + '.sha256 is not SHA-256');
  };

  if (!exactShape(receipt, [
    'schema', 'version', 'receiptId', 'generatedAt', 'status', 'state', 'sourceRefs',
    'portfolioEvolution', 'participationBinding', 'currentEvidence', 'decision', 'truth', 'receiptDigest'
  ], 'receipt')) return issues;
  if (receipt.schema !== RECEIPT_SCHEMA) issue('STRUCTURE', 'SCHEMA_MISMATCH', 'receipt schema mismatch');
  if (receipt.version !== VERSION) issue('STRUCTURE', 'VERSION_MISMATCH', 'receipt version mismatch');
  if (receipt.status !== 'TEST') issue('AUTHORITY', 'STATUS_MUST_REMAIN_TEST', 'receipt status must remain TEST');
  text(receipt.receiptId, 'receiptId', 180);
  try {
    if (exactTimestamp(receipt.generatedAt, 'generatedAt') !== receipt.generatedAt) issue('STRUCTURE', 'TIMESTAMP_NOT_CANONICAL', 'generatedAt must be canonical ISO-8601');
  } catch (error) {
    issue('STRUCTURE', 'TIMESTAMP_INVALID', error.message);
  }
  if (!['CURRENT_CONVERGED', 'CURRENT_NO_NEW_INFORMATION', 'HOLD_PARTICIPATION_REBIND_REQUIRED'].includes(receipt.state)) {
    issue('STRUCTURE', 'STATE_UNSUPPORTED', 'receipt state is unsupported');
  }

  if (exactShape(receipt.sourceRefs, ['participationFrontier', 'participationPortfolio', 'latestPortfolio'], 'sourceRefs')) {
    referenceShape(receipt.sourceRefs.participationFrontier, 'sourceRefs.participationFrontier');
    referenceShape(receipt.sourceRefs.participationPortfolio, 'sourceRefs.participationPortfolio');
    referenceShape(receipt.sourceRefs.latestPortfolio, 'sourceRefs.latestPortfolio');
  }

  const evolution = receipt.portfolioEvolution;
  if (exactShape(evolution, [
    'state', 'baseOutcomeCount', 'currentOutcomeCount', 'appendedOutcomeCount', 'appendedOutcomeRefs',
    'capabilityCountBefore', 'capabilityCountCurrent', 'historicalOutcomeBytesPreserved'
  ], 'portfolioEvolution')) {
    if (!['VALID_FORWARD_EXTENSION', 'NO_NEW_INFORMATION'].includes(evolution.state)) issue('STRUCTURE', 'EVOLUTION_STATE_UNSUPPORTED', 'portfolio evolution state is unsupported');
    ['baseOutcomeCount', 'currentOutcomeCount', 'appendedOutcomeCount', 'capabilityCountBefore', 'capabilityCountCurrent']
      .forEach((key) => integer(evolution[key], 'portfolioEvolution.' + key));
    if (!Array.isArray(evolution.appendedOutcomeRefs)) issue('STRUCTURE', 'APPENDED_REFS_ARRAY_REQUIRED', 'appendedOutcomeRefs must be an array');
    else evolution.appendedOutcomeRefs.forEach((ref, index) => referenceShape(ref, 'appendedOutcomeRefs[' + index + ']'));
    boolean(evolution.historicalOutcomeBytesPreserved, 'portfolioEvolution.historicalOutcomeBytesPreserved');
    if (evolution.currentOutcomeCount !== evolution.baseOutcomeCount + evolution.appendedOutcomeCount) issue('COHERENCE', 'OUTCOME_COUNT_MISMATCH', 'current outcome count must equal base plus appended');
    if (Array.isArray(evolution.appendedOutcomeRefs) && evolution.appendedOutcomeRefs.length !== evolution.appendedOutcomeCount) issue('COHERENCE', 'APPENDED_REF_COUNT_MISMATCH', 'appended outcome reference count mismatch');
    if (evolution.state === 'VALID_FORWARD_EXTENSION' && evolution.appendedOutcomeCount < 1) issue('COHERENCE', 'FORWARD_EXTENSION_REQUIRES_APPEND', 'forward extension requires at least one appended outcome');
    if (evolution.state === 'NO_NEW_INFORMATION' && evolution.appendedOutcomeCount !== 0) issue('COHERENCE', 'NO_NEW_INFORMATION_CANNOT_APPEND', 'no-new-information cannot append outcomes');
    if (evolution.capabilityCountCurrent < evolution.capabilityCountBefore) issue('COHERENCE', 'CAPABILITY_COUNT_CANNOT_SHRINK', 'detached receipt cannot declare fewer current capability chains');
    if (evolution.historicalOutcomeBytesPreserved !== true) issue('COHERENCE', 'HISTORY_PRESERVATION_REQUIRED', 'historical outcome preservation must remain true');
  }

  const participation = receipt.participationBinding;
  if (exactShape(participation, [
    'state', 'protectedCapabilityIds', 'affectedProtectedCapabilityIds', 'optionalReviewCandidates',
    'humanEvidencePresent', 'humanBenefitEstablished', 'reviewIsParticipation', 'readinessIsHumanEvidence'
  ], 'participationBinding')) {
    if (!['PRESERVED', 'REQUIRES_REBIND'].includes(participation.state)) issue('STRUCTURE', 'PARTICIPATION_STATE_UNSUPPORTED', 'participation binding state is unsupported');
    const protectedIds = stringSet(participation.protectedCapabilityIds, 'participationBinding.protectedCapabilityIds');
    const affectedIds = stringSet(participation.affectedProtectedCapabilityIds, 'participationBinding.affectedProtectedCapabilityIds');
    integer(participation.optionalReviewCandidates, 'participationBinding.optionalReviewCandidates');
    ['humanEvidencePresent', 'humanBenefitEstablished', 'reviewIsParticipation', 'readinessIsHumanEvidence']
      .forEach((key) => boolean(participation[key], 'participationBinding.' + key));
    if (affectedIds.some((id) => !protectedIds.includes(id))) issue('COHERENCE', 'AFFECTED_CAPABILITY_NOT_PROTECTED', 'affected capabilities must be a subset of protected capabilities');
    if (participation.state === 'PRESERVED' && affectedIds.length) issue('COHERENCE', 'PRESERVED_BINDING_CANNOT_BE_AFFECTED', 'preserved binding cannot list affected protected capabilities');
    if (participation.state === 'REQUIRES_REBIND' && !affectedIds.length) issue('COHERENCE', 'REBIND_REQUIRES_AFFECTED_CAPABILITY', 'rebind requires an affected protected capability');
    if (participation.state === 'REQUIRES_REBIND' && participation.optionalReviewCandidates !== 0) issue('AUTHORITY', 'STALE_REVIEW_CANDIDATE_REFUSED', 'rebind hold cannot expose a stale review candidate');
    if (participation.reviewIsParticipation !== false || participation.readinessIsHumanEvidence !== false) issue('AUTHORITY', 'READINESS_BOUNDARY_VIOLATION', 'review and readiness cannot become participation or human evidence');
  }

  const evidence = receipt.currentEvidence;
  if (exactShape(evidence, [
    'capabilityChains', 'outcomes', 'effectiveBeneficiaryVerdicts', 'sharedSystemPass', 'aiWorkflowPass',
    'humanPass', 'humanNotRun', 'portfolioOverall', 'unresolvedEvidence'
  ], 'currentEvidence')) {
    ['capabilityChains', 'outcomes', 'sharedSystemPass', 'aiWorkflowPass', 'humanPass', 'humanNotRun']
      .forEach((key) => integer(evidence[key], 'currentEvidence.' + key));
    text(evidence.portfolioOverall, 'currentEvidence.portfolioOverall', 120);
    stringSet(evidence.unresolvedEvidence, 'currentEvidence.unresolvedEvidence');
    if (!isObject(evidence.effectiveBeneficiaryVerdicts)) issue('STRUCTURE', 'BENEFICIARY_VERDICTS_OBJECT_REQUIRED', 'effectiveBeneficiaryVerdicts must be an object');
    else Object.entries(evidence.effectiveBeneficiaryVerdicts).forEach(([key, value]) => {
      if (!/^(HUMAN|AI_WORKFLOW|SHARED_SYSTEM):(PASS|FAIL|UNKNOWN|NOT_RUN)$/.test(key)) issue('STRUCTURE', 'BENEFICIARY_VERDICT_KEY_INVALID', 'unsupported beneficiary verdict key: ' + key);
      integer(value, 'effectiveBeneficiaryVerdicts.' + key);
    });
    const verdicts = evidence.effectiveBeneficiaryVerdicts || {};
    if (evidence.sharedSystemPass !== (verdicts['SHARED_SYSTEM:PASS'] || 0)) issue('COHERENCE', 'SHARED_SYSTEM_COUNT_MISMATCH', 'shared-system pass count mismatch');
    if (evidence.aiWorkflowPass !== (verdicts['AI_WORKFLOW:PASS'] || 0)) issue('COHERENCE', 'AI_WORKFLOW_COUNT_MISMATCH', 'AI-workflow pass count mismatch');
    if (evidence.humanPass !== (verdicts['HUMAN:PASS'] || 0)) issue('COHERENCE', 'HUMAN_PASS_COUNT_MISMATCH', 'human pass count mismatch');
    if (evidence.humanNotRun !== (verdicts['HUMAN:NOT_RUN'] || 0)) issue('COHERENCE', 'HUMAN_NOT_RUN_COUNT_MISMATCH', 'human not-run count mismatch');
    if (evolution && evidence.outcomes !== evolution.currentOutcomeCount) issue('COHERENCE', 'EVIDENCE_OUTCOME_COUNT_MISMATCH', 'current evidence and evolution outcome counts disagree');
    if (evolution && evidence.capabilityChains !== evolution.capabilityCountCurrent) issue('COHERENCE', 'EVIDENCE_CAPABILITY_COUNT_MISMATCH', 'current evidence and evolution capability counts disagree');
  }

  const decision = receipt.decision;
  if (exactShape(decision, ['state', 'autonomousActionCount', 'reviewableActionCount', 'currentBestAction', 'participationRequiresNewEvent'], 'decision')) {
    if (decision.state !== 'BOUNDED_CURRENT_STATE_DECISION') issue('STRUCTURE', 'DECISION_STATE_MISMATCH', 'decision state mismatch');
    integer(decision.autonomousActionCount, 'decision.autonomousActionCount');
    integer(decision.reviewableActionCount, 'decision.reviewableActionCount');
    text(decision.currentBestAction, 'decision.currentBestAction', 240);
    boolean(decision.participationRequiresNewEvent, 'decision.participationRequiresNewEvent');
    if (decision.autonomousActionCount !== 0) issue('AUTHORITY', 'AUTONOMOUS_ACTION_REFUSED', 'current-state receipt cannot grant autonomous action');
    if (participation && decision.reviewableActionCount !== participation.optionalReviewCandidates) issue('COHERENCE', 'REVIEW_COUNT_MISMATCH', 'decision and participation review counts disagree');
    if (decision.participationRequiresNewEvent !== true) issue('AUTHORITY', 'PARTICIPATION_EVENT_REQUIRED', 'participation must require a new event');
    if (participation && participation.state === 'REQUIRES_REBIND' && decision.currentBestAction !== 'HOLD_FOR_PARTICIPATION_REBIND') issue('AUTHORITY', 'REBIND_HOLD_ACTION_REQUIRED', 'rebind state must hold the action');
  }

  const truth = receipt.truth;
  const truthKeys = [
    'sourceReceiptsVerifiedByExactRebuild', 'latestPortfolioVerifiedNatively', 'historicalOutcomeBytesPreserved',
    'priorFrontierRewritten', 'portfolioCurrentnessRewritesParticipation', 'reviewIsParticipation',
    'readinessIsHumanEvidence', 'aiWorkflowPassIsHumanBenefit', 'humanBenefitClaimed', 'sharedGrowthClaimed',
    'automaticParticipation', 'automaticExecution', 'automaticWrite', 'automaticInstall',
    'automaticPermissionGrant', 'automaticPromotion', 'automaticMerge', 'automaticCanon', 'foundationMutation'
  ];
  if (exactShape(truth, truthKeys, 'truth')) {
    truthKeys.forEach((key) => boolean(truth[key], 'truth.' + key));
    ['sourceReceiptsVerifiedByExactRebuild', 'latestPortfolioVerifiedNatively', 'historicalOutcomeBytesPreserved']
      .forEach((key) => { if (truth[key] !== true) issue('COHERENCE', 'REQUIRED_TRUTH_DECLARATION_MISSING', key + ' must remain true'); });
    [
      'priorFrontierRewritten', 'portfolioCurrentnessRewritesParticipation', 'reviewIsParticipation',
      'readinessIsHumanEvidence', 'aiWorkflowPassIsHumanBenefit', 'automaticParticipation', 'automaticExecution',
      'automaticWrite', 'automaticInstall', 'automaticPermissionGrant', 'automaticPromotion', 'automaticMerge',
      'automaticCanon', 'foundationMutation'
    ].forEach((key) => { if (truth[key] !== false) issue('AUTHORITY', 'BOUNDARY_MUST_REMAIN_FALSE', key + ' must remain false'); });
    if (evidence && truth.humanBenefitClaimed !== (evidence.humanPass > 0)) issue('COHERENCE', 'HUMAN_BENEFIT_TRUTH_MISMATCH', 'human benefit truth must match native human pass count');
    if (evidence && truth.sharedGrowthClaimed !== (evidence.portfolioOverall === 'GROUNDED_SHARED_GROWTH_PRESENT')) issue('COHERENCE', 'SHARED_GROWTH_TRUTH_MISMATCH', 'shared growth truth must match portfolio overall');
    if (participation && evidence && participation.humanEvidencePresent !== (evidence.humanPass > 0)) issue('COHERENCE', 'PARTICIPATION_HUMAN_EVIDENCE_MISMATCH', 'participation human-evidence presence must match human pass count');
    if (participation && evidence && participation.humanBenefitEstablished !== (evidence.humanPass > 0)) issue('COHERENCE', 'PARTICIPATION_HUMAN_BENEFIT_MISMATCH', 'participation human benefit must match human pass count');
  }

  if (participation && evolution) {
    if (participation.state === 'REQUIRES_REBIND' && receipt.state !== 'HOLD_PARTICIPATION_REBIND_REQUIRED') issue('COHERENCE', 'REBIND_RECEIPT_STATE_MISMATCH', 'rebind requires receipt hold state');
    if (participation.state === 'PRESERVED' && evolution.appendedOutcomeCount > 0 && receipt.state !== 'CURRENT_CONVERGED') issue('COHERENCE', 'CONVERGED_RECEIPT_STATE_MISMATCH', 'preserved forward extension requires current-converged state');
    if (participation.state === 'PRESERVED' && evolution.appendedOutcomeCount === 0 && receipt.state !== 'CURRENT_NO_NEW_INFORMATION') issue('COHERENCE', 'NO_NEW_RECEIPT_STATE_MISMATCH', 'preserved no-new information requires current-no-new state');
  }

  if (!DIGEST.test(String(receipt.receiptDigest || '').toLowerCase())) issue('DIGEST', 'RECEIPT_DIGEST_INVALID', 'receiptDigest is not SHA-256');
  else {
    const payload = clone(receipt);
    delete payload.receiptDigest;
    if (sha256(payload) !== receipt.receiptDigest) issue('DIGEST', 'RECEIPT_DIGEST_MISMATCH', 'receipt self-digest does not rebuild');
  }
  return issues;
}

function inspectDetached(receipt) {
  const issues = detachedIssues(receipt);
  const status = (section) => issues.some((item) => item.section === section) ? 'FAIL' : 'PASS';
  const pass = issues.length === 0;
  return {
    schema: DETACHED_VERIFICATION_SCHEMA,
    version: VERSION,
    pass,
    verdict: pass ? 'PORTABLE_INTEGRITY_PASS_SOURCE_TRUTH_UNKNOWN' : 'PORTABLE_INTEGRITY_FAIL',
    receiptRef: pass ? { id: receipt.receiptId, schema: receipt.schema, sha256: receipt.receiptDigest } : null,
    checks: {
      structure: status('STRUCTURE'),
      selfDigest: status('DIGEST'),
      internalCoherence: status('COHERENCE'),
      authorityBoundary: status('AUTHORITY')
    },
    sourceVerification: {
      nativeRebuild: 'NOT_RUN',
      sourceTruth: 'UNKNOWN',
      sourceCurrentness: 'UNKNOWN',
      reason: 'A detached receipt carries references, not the referenced source bytes or their exact rebuild inputs.'
    },
    authority: {
      writes: false,
      network: false,
      participation: false,
      installation: false,
      promotion: false,
      merge: false,
      canon: false,
      foundationMutation: false
    },
    issues
  };
}

function build(input) {
  exactKeys(input, ['receiptId', 'generatedAt', 'participationFrontierReceipt', 'participationFrontierInput', 'latestPortfolio'], 'current state input');
  const frontier = clone(input.participationFrontierReceipt);
  const frontierInput = clone(input.participationFrontierInput);
  const frontierCheck = Participation.verifyParticipationFrontier(frontier, frontierInput);
  if (!frontierCheck.pass) throw new Error('participation frontier invalid: ' + frontierCheck.errors.join('; '));

  const basePortfolio = participationPortfolio(frontierInput);
  const currentPortfolio = clone(input.latestPortfolio);
  const currentCheck = Growth.verifyPortfolio(currentPortfolio);
  if (!currentCheck.pass) throw new Error('latest portfolio invalid: ' + currentCheck.errors.join('; '));

  const protectedCapabilities = humanHandoffCapabilities(frontier);
  const extension = compareExtension(basePortfolio, currentPortfolio, protectedCapabilities);
  const rebindRequired = extension.affectedProtectedCapabilities.length > 0;
  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');
  [frontier.generatedAt, basePortfolio.generatedAt, currentPortfolio.generatedAt].forEach((sourceTime, index) => {
    if (new Date(sourceTime) > new Date(generatedAt)) throw new Error('current state cannot predate source index ' + index);
  });

  const claims = effectiveClaims(currentPortfolio);
  const counts = verdictCounts(claims);
  const appendedOutcomeRefs = extension.appended.map((outcome) => reference(outcome, 'outcomeId', 'receiptDigest', 'appended outcome'));
  const unresolvedEvidence = Array.from(new Set([
    ...(frontier.balance && frontier.balance.unresolvedEvidence || []),
    ...currentPortfolio.latest.flatMap((item) => item.nextEvidenceNeeds || [])
  ])).sort();
  const state = rebindRequired
    ? 'HOLD_PARTICIPATION_REBIND_REQUIRED'
    : (extension.appendedOutcomeCount ? 'CURRENT_CONVERGED' : 'CURRENT_NO_NEW_INFORMATION');

  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    receiptId: requiredText(input.receiptId, 'receiptId'),
    generatedAt,
    status: 'TEST',
    state,
    sourceRefs: {
      participationFrontier: reference(frontier, 'participationFrontierId', 'participationFrontierDigest', 'participation frontier'),
      participationPortfolio: reference(basePortfolio, 'portfolioId', 'portfolioDigest', 'participation portfolio'),
      latestPortfolio: reference(currentPortfolio, 'portfolioId', 'portfolioDigest', 'latest portfolio')
    },
    portfolioEvolution: {
      state: extension.state,
      baseOutcomeCount: extension.baseOutcomeCount,
      currentOutcomeCount: extension.currentOutcomeCount,
      appendedOutcomeCount: extension.appendedOutcomeCount,
      appendedOutcomeRefs,
      capabilityCountBefore: basePortfolio.summary.capabilityCount,
      capabilityCountCurrent: currentPortfolio.summary.capabilityCount,
      historicalOutcomeBytesPreserved: extension.historicalOutcomeBytesPreserved
    },
    participationBinding: {
      state: rebindRequired ? 'REQUIRES_REBIND' : 'PRESERVED',
      protectedCapabilityIds: protectedCapabilities,
      affectedProtectedCapabilityIds: extension.affectedProtectedCapabilities,
      optionalReviewCandidates: rebindRequired ? 0 : frontier.decision.reviewableActionCount,
      humanEvidencePresent: (counts['HUMAN:PASS'] || 0) > 0,
      humanBenefitEstablished: (counts['HUMAN:PASS'] || 0) > 0,
      reviewIsParticipation: false,
      readinessIsHumanEvidence: false
    },
    currentEvidence: {
      capabilityChains: currentPortfolio.summary.capabilityCount,
      outcomes: currentPortfolio.summary.outcomeCount,
      effectiveBeneficiaryVerdicts: counts,
      sharedSystemPass: counts['SHARED_SYSTEM:PASS'] || 0,
      aiWorkflowPass: counts['AI_WORKFLOW:PASS'] || 0,
      humanPass: counts['HUMAN:PASS'] || 0,
      humanNotRun: counts['HUMAN:NOT_RUN'] || 0,
      portfolioOverall: currentPortfolio.summary.overall,
      unresolvedEvidence
    },
    decision: {
      state: 'BOUNDED_CURRENT_STATE_DECISION',
      autonomousActionCount: 0,
      reviewableActionCount: rebindRequired ? 0 : frontier.decision.reviewableActionCount,
      currentBestAction: rebindRequired ? 'HOLD_FOR_PARTICIPATION_REBIND' : frontier.decision.currentBestAction,
      participationRequiresNewEvent: true
    },
    truth: {
      sourceReceiptsVerifiedByExactRebuild: true,
      latestPortfolioVerifiedNatively: true,
      historicalOutcomeBytesPreserved: true,
      priorFrontierRewritten: false,
      portfolioCurrentnessRewritesParticipation: false,
      reviewIsParticipation: false,
      readinessIsHumanEvidence: false,
      aiWorkflowPassIsHumanBenefit: false,
      humanBenefitClaimed: (counts['HUMAN:PASS'] || 0) > 0,
      sharedGrowthClaimed: currentPortfolio.summary.overall === 'GROUNDED_SHARED_GROWTH_PRESENT',
      automaticParticipation: false,
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

function verify(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) throw new Error('current state schema mismatch');
    if (receipt.version !== VERSION) throw new Error('current state version mismatch');
    const rebuilt = build(input);
    if (stableStringify(rebuilt) !== stableStringify(receipt)) throw new Error('current state content, decision, or digest mismatch');
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  RECEIPT_SCHEMA,
  DETACHED_VERIFICATION_SCHEMA,
  VERSION,
  stableStringify,
  sha256,
  compareExtension,
  inspectDetached,
  build,
  verify
};
