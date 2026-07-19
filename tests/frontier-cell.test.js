'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Frontier = require('../kernel/frontier-cell');

function perspectives() {
  return [
    { id: 'mike-pattern', domain: 'human-collaboration', perspective: 'HUMAN_STEWARD', statement: 'New input is linked to earlier patterns and then tested.', patternTags: ['transfer-by-pattern'], evidenceRef: 'session://mike' },
    { id: 'mirror-pattern', domain: 'world-genome', perspective: 'MACHINE_NATIVE', statement: 'A world seam suggests the same transfer pattern outside language.', patternTags: ['transfer-by-pattern'], evidenceRef: 'trace://mirror' }
  ];
}

test('cross-domain attributed evidence originates a deterministic frontier candidate', () => {
  const input = { subject: { id: 'growth', domain: 'mirror-learning', statement: 'Can the prior capability boundary expand?' }, observations: perspectives() };
  const first = Frontier.inspect(input);
  const second = Frontier.inspect(input);
  assert.deepEqual(first, second);
  assert.equal(first.classification, 'FRONTIER_EXAM_REQUIRED');
  assert.equal(first.proposal.candidate.origin, 'MIRROR_FRONTIER_SYNTHESIS');
  assert.equal(first.proposal.noveltyBasis.crossDomainLinks[0].pattern, 'transfer-by-pattern');
  assert.deepEqual(first.perspectiveLedger.humanEvidenceIds, ['mike-pattern']);
  assert.deepEqual(first.perspectiveLedger.machineEvidenceIds, ['mirror-pattern']);
});

test('new candidate cannot grade its own missing exam as growth', () => {
  const result = Frontier.inspect({ observations: perspectives(), candidate: { id: 'new-transfer-organ', statement: 'Transfer patterns across worlds.' }, examCoverage: [{ id: 'self-exam', capabilityIds: ['new-transfer-organ'], heldOut: false, independentEvaluator: false, falsifiable: true }] });
  assert.equal(result.classification, 'FRONTIER_EXAM_REPAIR');
  assert.equal(result.proposal.proposedExam.candidateMayNotAuthorFinalAnswers, true);
  assert.equal(result.proposal.nextGate, 'EXAM_AUTHORING_REVIEW');
});

test('complete independent unseen exam keeps candidate reviewable, never promoted', () => {
  const result = Frontier.inspect({ observations: perspectives(), candidate: { id: 'new-transfer-organ', statement: 'Transfer patterns across worlds.' }, examCoverage: [{ id: 'independent-held-out', capabilityIds: ['new-transfer-organ'], heldOut: true, independentEvaluator: true, falsifiable: true, stewardReviewRequired: true }] });
  assert.equal(result.classification, 'FRONTIER_CANDIDATE_AWAITING_REVIEW');
  assert.equal(result.proposal.state, 'AWAITING_REVIEW');
  assert.equal(result.authority.automaticPromotion, false);
  assert.equal(Object.values(result.authority).every(value => value === false), true);
});

test('known capability is optimization rather than a false novelty claim', () => {
  const result = Frontier.inspect({ observations: [{ id: 'ev', statement: 'Evidence is missing.', domain: 'review', perspective: 'SHARED' }], candidate: { id: 'evidence-evaluation', statement: 'Evaluate evidence.' } });
  assert.equal(result.classification, 'OPTIMIZE_KNOWN');
  assert.equal(result.proposal, null);
});

test('unknown seam becomes a proposed capability and exam, not discarded surprise', () => {
  const result = Frontier.inspect({ observations: [{ id: 'receipt', statement: 'The step produced an unmodelled outcome.', domain: 'workshop', perspective: 'SHARED' }], unexpectedSeams: [{ id: 'unmodelled-state-transition', statement: 'The same input entered a new unmodelled state.', severity: 'high', evidenceRefs: ['receipt://one'] }] });
  assert.equal(result.classification, 'FRONTIER_EXAM_REQUIRED');
  assert.match(result.proposal.candidate.statement, /previously uncovered seam family/);
  assert.equal(result.proposal.proposedExam.requiredFamilies.includes('regression-of-earlier-capabilities'), true);
});

test('no evidence produces a visible hold', () => {
  const result = Frontier.inspect({ candidate: { id: 'unsupported-growth', statement: 'Claim growth without evidence.' } });
  assert.equal(result.classification, 'HOLD_MISSING_EVIDENCE');
  assert.equal(result.authority.runtimeChange, false);
});
