'use strict';

const U = require('./foundation-utils');

const BENCHMARK_SCHEMA = 'axm.visual-quality-benchmark/v1';
const GATE_SCHEMA = 'axm.visual-quality-gate/v1';
const REVIEW_SCHEMA = 'axm.human-art-review-receipt/v1';

function createBenchmark(spec) {
  spec = U.clone(spec || {});
  const criteria = U.boundedArray(spec.criteria, 3, 20, 'criteria').map((item) => ({
    id: U.text(item.id, 60, 'criterion id'),
    label: U.text(item.label, 100, 'criterion label'),
    weight: U.finite(item.weight, 'criterion weight'),
    minimum: U.finite(item.minimum, 'criterion minimum'),
    evidence_kind: U.text(item.evidence_kind || 'visual', 40, 'evidence kind'),
  }));
  U.ensure(new Set(criteria.map((item) => item.id)).size === criteria.length, 'criterion ids must be unique');
  U.ensure(criteria.every((item) => item.weight > 0 && item.minimum >= 0 && item.minimum <= 1), 'criterion weights and minima invalid');
  const references = U.boundedArray(spec.references, 1, 30, 'references').map((item) => ({
    id: U.text(item.id, 80, 'reference id'),
    title: U.text(item.title, 160, 'reference title'),
    digest: U.text(item.digest, 128, 'reference digest'),
    mime: U.text(item.mime, 100, 'reference mime'),
    role: U.text(item.role, 80, 'reference role'),
    rights: U.text(item.rights, 80, 'reference rights'),
  }));
  U.ensure(references.every((item) => /^(original|licensed|public-domain|cc0|internal-review-only)$/.test(item.rights)), 'reference rights must be explicit');
  const body = {
    schema: BENCHMARK_SCHEMA,
    version: '1.0.0',
    id: U.text(spec.id, 100, 'benchmark id'),
    title: U.text(spec.title, 160, 'benchmark title'),
    intended_use: U.text(spec.intended_use, 100, 'intended use'),
    target_canvas_digest: U.text(spec.target_canvas_digest, 128, 'target canvas digest'),
    criteria,
    minimum_overall: U.finite(spec.minimum_overall == null ? 0.72 : spec.minimum_overall, 'minimum overall'),
    references,
    authority: 'human-visual-review-required',
    automatic_promotion: false,
  };
  U.ensure(body.minimum_overall >= 0 && body.minimum_overall <= 1, 'minimum overall outside 0..1');
  body.digest = U.sha256(body);
  return body;
}

function openGate(input) {
  input = U.clone(input || {});
  U.ensure(input.benchmark && input.benchmark.schema === BENCHMARK_SCHEMA, 'quality benchmark required');
  const benchmarkBody = U.clone(input.benchmark);
  delete benchmarkBody.digest;
  U.ensure(U.sha256(benchmarkBody) === input.benchmark.digest, 'benchmark digest mismatch');
  const technicalReceipts = Array.isArray(input.technical_receipts) ? input.technical_receipts : [];
  const technicalStatus = technicalReceipts.length && technicalReceipts.every((item) => item && item.status === 'PASS') ? 'PASS' : technicalReceipts.some((item) => item && item.status === 'FAIL') ? 'FAIL' : 'UNKNOWN';
  const body = {
    schema: GATE_SCHEMA,
    version: '1.0.0',
    candidate_id: U.text(input.candidate_id, 120, 'candidate id'),
    candidate_digest: U.text(input.candidate_digest, 128, 'candidate digest'),
    target_canvas_digest: U.text(input.target_canvas_digest, 128, 'target canvas digest'),
    benchmark_id: input.benchmark.id,
    benchmark_digest: input.benchmark.digest,
    benchmark: U.clone(input.benchmark),
    technical_receipts: U.clone(technicalReceipts),
    technical_status: technicalStatus,
    machine_observations: [],
    human_reviews: [],
    status: 'PENDING_HUMAN_REVIEW',
    promotion: { status: 'BLOCKED', automatic: false, canon: false, reason: 'digest-bound human visual review required' },
  };
  U.ensure(body.target_canvas_digest === input.benchmark.target_canvas_digest, 'candidate and benchmark target canvas mismatch');
  body.digest = U.sha256(body);
  return body;
}

function assertGateBinding(gate) {
  U.ensure(gate && gate.schema === GATE_SCHEMA, 'quality gate schema mismatch');
  U.ensure(gate.benchmark && gate.benchmark.digest === gate.benchmark_digest, 'benchmark binding mismatch');
  const benchmarkBody = U.clone(gate.benchmark);
  delete benchmarkBody.digest;
  U.ensure(U.sha256(benchmarkBody) === gate.benchmark_digest, 'benchmark content digest mismatch');
  U.ensure(gate.target_canvas_digest === gate.benchmark.target_canvas_digest, 'target canvas binding mismatch');
}

function addMachineObservation(gate, observation) {
  assertGateBinding(gate);
  const next = U.clone(gate);
  observation = U.clone(observation || {});
  U.ensure(observation.candidate_digest === next.candidate_digest, 'machine observation candidate mismatch');
  next.machine_observations.push({
    id: U.text(observation.id, 120, 'observation id'),
    candidate_digest: observation.candidate_digest,
    observer: { id: U.text(observation.observer && observation.observer.id, 100, 'observer id'), kind: 'machine' },
    summary: U.text(observation.summary, 500, 'observation summary'),
    measurements: U.clone(observation.measurements || {}),
  });
  next.status = 'PENDING_HUMAN_REVIEW';
  next.promotion = { status: 'BLOCKED', automatic: false, canon: false, reason: 'machine observations cannot occupy the human art-review seat' };
  next.digest = U.sha256(Object.assign({}, next, { digest: undefined }));
  return next;
}

function submitHumanReview(gate, review) {
  assertGateBinding(gate);
  const next = U.clone(gate);
  review = U.clone(review || {});
  U.ensure(review.schema === REVIEW_SCHEMA, 'human review schema mismatch');
  U.ensure(review.candidate_digest === next.candidate_digest, 'human review candidate mismatch');
  U.ensure(review.benchmark_digest === next.benchmark_digest, 'human review benchmark mismatch');
  U.ensure(review.reviewer && review.reviewer.kind === 'human', 'reviewer must occupy a human seat');
  U.ensure(review.consent_receipt && review.consent_receipt.granted === true, 'explicit review consent required');
  U.ensure(review.consent_receipt.action === 'review-visual-quality', 'review consent action mismatch');
  U.ensure(review.consent_receipt.candidate_digest === next.candidate_digest, 'review consent candidate mismatch');
  U.ensure(['ACCEPT_FOR_TEST', 'REJECT', 'HOLD'].includes(review.verdict), 'human review verdict invalid');
  const scoreMap = new Map(U.boundedArray(review.scores, next.benchmark.criteria.length, next.benchmark.criteria.length, 'review scores').map((item) => [item.criterion_id, U.finite(item.score, 'criterion score')]));
  U.ensure(scoreMap.size === next.benchmark.criteria.length, 'criterion scores must be unique and complete');
  let weighted = 0;
  let weights = 0;
  const scored = next.benchmark.criteria.map((criterion) => {
    U.ensure(scoreMap.has(criterion.id), 'missing score for ' + criterion.id);
    const score = scoreMap.get(criterion.id);
    U.ensure(score >= 0 && score <= 1, 'criterion score outside 0..1');
    weighted += score * criterion.weight;
    weights += criterion.weight;
    return { criterion_id: criterion.id, score, minimum: criterion.minimum, pass: score >= criterion.minimum };
  });
  const overall = Number((weighted / weights).toFixed(6));
  const criteriaPass = scored.every((item) => item.pass) && overall >= next.benchmark.minimum_overall;
  if (review.verdict === 'ACCEPT_FOR_TEST') {
    U.ensure(next.technical_status === 'PASS', 'technical PASS required before visual acceptance');
    U.ensure(criteriaPass, 'declared visual criteria do not pass');
  }
  const receipt = {
    schema: REVIEW_SCHEMA,
    id: U.text(review.id, 120, 'review id'),
    candidate_digest: next.candidate_digest,
    benchmark_digest: next.benchmark_digest,
    reviewer: { id: U.text(review.reviewer.id, 100, 'reviewer id'), kind: 'human' },
    consent_receipt: U.clone(review.consent_receipt),
    verdict: review.verdict,
    scores: scored,
    overall,
    summary: U.text(review.summary, 1000, 'review summary'),
    reviewed_at: U.text(review.reviewed_at, 60, 'reviewed at'),
  };
  receipt.digest = U.sha256(receipt);
  next.human_reviews.push(receipt);
  if (review.verdict === 'ACCEPT_FOR_TEST') {
    next.status = 'ACCEPTED_FOR_TEST';
    next.promotion = { status: 'ELIGIBLE_FOR_EXISTING_DUAL_REVIEW', automatic: false, canon: false, reason: 'human visual floor passed; existing governance still required' };
  } else if (review.verdict === 'REJECT') {
    next.status = 'REJECTED';
    next.promotion = { status: 'BLOCKED', automatic: false, canon: false, reason: 'human visual review rejected the candidate' };
  } else {
    next.status = 'HOLD';
    next.promotion = { status: 'BLOCKED', automatic: false, canon: false, reason: 'human reviewer requested more evidence or revision' };
  }
  next.digest = U.sha256(Object.assign({}, next, { digest: undefined }));
  return next;
}

module.exports = { BENCHMARK_SCHEMA, GATE_SCHEMA, REVIEW_SCHEMA, createBenchmark, openGate, addMachineObservation, submitHumanReview, assertGateBinding };
