'use strict';

const State = require('./state-language');

const SCHEMA = 'axm.mirror.frontier-assessment/v1';
const CELL_ID = 'axm.mirror.cell.frontier/seed-0';

const BASE_CAPABILITIES = Object.freeze([
  { id: 'evidence-evaluation', coversSeams: ['missing-evidence', 'blocking-unknowns', 'unsupported-claims'] },
  { id: 'permission-boundary', coversSeams: ['missing-permissions', 'access-boundary'] },
  { id: 'contradiction-preservation', coversSeams: ['unresolved-contradictions', 'contradiction'] },
  { id: 'recovery-reasoning', coversSeams: ['missing-recovery', 'irreversible-action'] },
  { id: 'lineage-verification', coversSeams: ['lineage', 'source-integrity'] }
]);

function clean(value, max = 1000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function list(value) { return Array.isArray(value) ? value : []; }
function unique(value) { return Array.from(new Set(value.filter(Boolean))).sort(); }
function slug(value) {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unnamed';
}

function observation(value, index) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    id: clean(source.id || `observation-${index + 1}`, 160),
    domain: slug(source.domain || 'unknown-domain'),
    statement: clean(source.statement, 1600),
    perspective: ['HUMAN_STEWARD', 'MACHINE_NATIVE', 'SHARED', 'UNKNOWN'].includes(source.perspective) ? source.perspective : 'UNKNOWN',
    patternTags: unique(list(source.patternTags).map(slug)),
    evidenceRef: clean(source.evidenceRef || source.sourceRef || '', 500) || null
  };
}

function capability(value, index) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    id: slug(source.id || `capability-${index + 1}`),
    statement: clean(source.statement || source.id, 1200),
    domains: unique(list(source.domains).map(slug)),
    coversSeams: unique(list(source.coversSeams).map(slug)),
    examIds: unique(list(source.examIds).map(item => clean(item, 160)))
  };
}

function exam(value, index) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    id: clean(source.id || `exam-${index + 1}`, 160),
    capabilityIds: unique(list(source.capabilityIds).map(slug)),
    domains: unique(list(source.domains).map(slug)),
    heldOut: source.heldOut === true,
    independentEvaluator: source.independentEvaluator === true,
    falsifiable: source.falsifiable === true,
    stewardReviewRequired: source.stewardReviewRequired !== false
  };
}

function crossDomainLinks(observations) {
  const byTag = new Map();
  observations.forEach(item => item.patternTags.forEach(tag => {
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push(item);
  }));
  return Array.from(byTag.entries()).map(([pattern, rows]) => ({
    pattern,
    domains: unique(rows.map(row => row.domain)),
    evidenceIds: unique(rows.map(row => row.id)),
    perspectives: unique(rows.map(row => row.perspective))
  })).filter(link => link.domains.length >= 2).sort((a, b) => a.pattern.localeCompare(b.pattern));
}

function inspect(input = {}) {
  const subject = {
    id: clean(input.subject && input.subject.id || 'frontier-subject', 160),
    statement: clean(input.subject && input.subject.statement || '', 1600),
    domain: slug(input.subject && input.subject.domain || 'unknown-domain')
  };
  const observations = list(input.observations).map(observation).filter(item => item.statement);
  const capabilities = BASE_CAPABILITIES.map(capability).concat(list(input.currentCapabilities).map(capability));
  const exams = list(input.examCoverage).map(exam);
  const unexpectedSeams = list(input.unexpectedSeams).map((item, index) => ({
    id: slug(item && item.id || `unexpected-seam-${index + 1}`),
    statement: clean(item && item.statement || item && item.id || '', 1200),
    severity: ['low', 'medium', 'high', 'critical'].includes(item && item.severity) ? item.severity : 'medium',
    evidenceRefs: unique(list(item && item.evidenceRefs).map(ref => clean(ref, 500)))
  })).filter(item => item.statement);
  const links = crossDomainLinks(observations);
  const coveredSeams = new Set(capabilities.flatMap(item => item.coversSeams));
  const unknownSeams = unexpectedSeams.filter(item => !coveredSeams.has(item.id));

  let candidate = input.candidate && typeof input.candidate === 'object' ? {
    id: slug(input.candidate.id || input.candidate.statement),
    statement: clean(input.candidate.statement, 1600),
    mechanism: clean(input.candidate.mechanism || 'unspecified', 500),
    origin: 'SUPPLIED_CANDIDATE',
    sourceRefs: unique(list(input.candidate.sourceRefs).map(ref => clean(ref, 300)))
  } : null;

  if (!candidate && (unknownSeams.length || links.length)) {
    const primaryLink = links[0];
    const basis = unknownSeams.length
      ? unknownSeams.map(item => item.statement).join('; ')
      : `the pattern ${primaryLink.pattern} across ${primaryLink.domains.join(', ')}`;
    const mechanism = unknownSeams.length ? 'unexpected-seam-capability' : 'cross-domain-pattern-transfer';
    candidate = {
      id: `frontier-${State.digest({ subject, unknownSeams, links }, 16)}`,
      statement: unknownSeams.length
        ? `Develop a capability to model, test, and repair this previously uncovered seam family: ${basis}`
        : `Test whether ${basis} identifies a transferable capability that the current registry does not contain.`,
      mechanism,
      origin: 'MIRROR_FRONTIER_SYNTHESIS',
      sourceRefs: unique(observations.map(item => item.id).concat(unknownSeams.map(item => item.id)))
    };
  }

  const known = candidate && capabilities.find(item => item.id === candidate.id || (item.statement && item.statement === candidate.statement));
  const matchingExams = candidate ? exams.filter(item => item.capabilityIds.includes(candidate.id)) : [];
  const completeExam = matchingExams.find(item => item.heldOut && item.independentEvaluator && item.falsifiable && item.stewardReviewRequired);
  let classification = 'MAINTAIN_NO_FRONTIER';
  if (!observations.length && !unexpectedSeams.length) classification = 'HOLD_MISSING_EVIDENCE';
  else if (candidate && known) classification = 'OPTIMIZE_KNOWN';
  else if (candidate && !matchingExams.length) classification = 'FRONTIER_EXAM_REQUIRED';
  else if (candidate && !completeExam) classification = 'FRONTIER_EXAM_REPAIR';
  else if (candidate) classification = 'FRONTIER_CANDIDATE_AWAITING_REVIEW';

  const proposal = candidate && !known ? {
    proposalId: `frontier-proposal-${State.digest({ candidate, observations, unexpectedSeams, links }, 20)}`,
    state: 'AWAITING_REVIEW',
    candidate,
    noveltyBasis: {
      crossDomainLinks: links,
      previouslyUncoveredSeams: unknownSeams,
      priorCapabilityBoundary: unique(capabilities.map(item => item.id)),
      claim: 'Novelty is a testable hypothesis, not a capability claim.'
    },
    proposedExam: {
      status: completeExam ? 'SUPPLIED_COMPLETE' : 'NEEDS_INDEPENDENT_AUTHORING',
      suppliedExamIds: matchingExams.map(item => item.id),
      requiredFamilies: ['same-domain-baseline', 'unseen-cross-domain-transfer', 'adversarial-counterpattern', 'delayed-consequence', 'regression-of-earlier-capabilities'],
      heldOutFromCandidate: true,
      independentEvaluatorRequired: true,
      candidateMayNotAuthorFinalAnswers: true,
      stewardReviewRequired: true,
      successRule: 'The new rung must pass an unseen transfer test the prior rung could not pass without regressing established capabilities.'
    },
    nextGate: completeExam ? 'INDEPENDENT_EVALUATION' : 'EXAM_AUTHORING_REVIEW'
  } : null;

  const assessment = {
    schema: SCHEMA,
    cell: { id: CELL_ID, mode: 'LIGHTWEIGHT_FRONTIER_REVIEW', learnedWeights: false },
    subject,
    perspectiveLedger: {
      humanEvidenceIds: observations.filter(item => item.perspective === 'HUMAN_STEWARD').map(item => item.id),
      machineEvidenceIds: observations.filter(item => item.perspective === 'MACHINE_NATIVE').map(item => item.id),
      sharedEvidenceIds: observations.filter(item => item.perspective === 'SHARED').map(item => item.id),
      rule: 'Perspective is attributed evidence. No perspective silently becomes universal truth.'
    },
    observations,
    classification,
    proposal,
    authority: {
      runtimeChange: false,
      canonChange: false,
      identityChange: false,
      permissionChange: false,
      toolChange: false,
      automaticPromotion: false
    },
    limitations: [
      'This cell can originate evidence-linked capability and exam proposals; it does not prove open-ended intelligence.',
      'A new pattern may be spurious. Counterpatterns and unseen transfer tests remain mandatory.',
      'The proposer cannot close its own exam, promote its own capability, or expand its own authority.',
      'Outgrowth is measured against the prior Mirror capability boundary, never against human worth or identity.'
    ]
  };
  assessment.digest = State.digest(assessment, 32);
  return assessment;
}

module.exports = { SCHEMA, CELL_ID, BASE_CAPABILITIES, inspect };
