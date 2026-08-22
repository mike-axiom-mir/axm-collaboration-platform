'use strict';

const fs = require('fs');
const path = require('path');
const ReviewService = require('../operations/review-service');
const V29 = require('../model-shadow-retention-audit-review-request/model-shadow-retention-audit-review-request');
const V29Fixture = require('../model-shadow-retention-audit-review-request/selftest-fixture');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function after(value, milliseconds) { return new Date(Date.parse(value) + (milliseconds || 1000)).toISOString(); }

function buildPending(parent, tag, requiredSeats) {
  const fixture = V29Fixture.build(parent, tag);
  const requestInput = V29Fixture.requestInput(fixture, {
    requestId: 'v31-review-request:' + tag,
    requiredSeats: requiredSeats || 2
  });
  const request = V29.buildReviewRequest(copy(requestInput));
  const reviewRoot = path.join(parent, tag + '-review-state');
  fs.mkdirSync(reviewRoot);
  const service = ReviewService.create({ stateRoot: reviewRoot });
  const submitted = copy(service.submit(copy(request.reviewCandidate)));
  const reloaded = copy(ReviewService.create({ stateRoot: reviewRoot }).get(submitted.id));
  const pendingInput = {
    handoffId: 'v31-pending-handoff:' + tag,
    generatedAt: after(reloaded.updatedAt),
    requestInput: copy(requestInput),
    request: copy(request),
    initialReviewItem: copy(submitted),
    reloadedReviewItem: copy(reloaded)
  };
  const pendingHandoff = V29.buildPendingReviewHandoff(copy(pendingInput));
  return { fixture, requestInput, request, reviewRoot, service, submitted, reloaded, pendingInput, pendingHandoff };
}

function outcomeInput(pending, reviewItem, tag) {
  return {
    outcomeId: 'v31-review-outcome:' + tag,
    observedAt: after(reviewItem.updatedAt),
    pendingHandoffInput: copy(pending.pendingInput),
    pendingHandoff: copy(pending.pendingHandoff),
    reviewItem: copy(reviewItem)
  };
}

function approved(parent, tag) {
  const pending = buildPending(parent, tag, 2);
  pending.service.vote(pending.submitted.id, {
    artifactDigest: pending.request.reviewCandidate.artifactDigest,
    actor: 'Alice Reviewer', actorKind: 'human', verdict: 'APPROVE', note: 'Alice exact artifact approval note'
  });
  pending.service.vote(pending.submitted.id, {
    artifactDigest: pending.request.reviewCandidate.artifactDigest,
    actor: 'Machine Seat', actorKind: 'machine', verdict: 'APPROVE', note: 'Machine exact artifact approval note'
  });
  const item = copy(ReviewService.create({ stateRoot: pending.reviewRoot }).get(pending.submitted.id));
  return { pending, item, input: outcomeInput(pending, item, tag) };
}

function held(parent, tag) {
  const pending = buildPending(parent, tag, 2);
  pending.service.vote(pending.submitted.id, {
    artifactDigest: pending.request.reviewCandidate.artifactDigest,
    actor: 'Machine Hold Seat', actorKind: 'machine', verdict: 'HOLD', note: 'More evidence remains required'
  });
  const item = copy(ReviewService.create({ stateRoot: pending.reviewRoot }).get(pending.submitted.id));
  return { pending, item, input: outcomeInput(pending, item, tag) };
}

function rejected(parent, tag) {
  const pending = buildPending(parent, tag, 2);
  pending.service.vote(pending.submitted.id, {
    artifactDigest: pending.request.reviewCandidate.artifactDigest,
    actor: 'Declared Human Rejector', actorKind: 'human', verdict: 'REJECT', note: 'Exact artifact rejected for bounded test'
  });
  const item = copy(ReviewService.create({ stateRoot: pending.reviewRoot }).get(pending.submitted.id));
  return { pending, item, input: outcomeInput(pending, item, tag) };
}

module.exports = { copy, after, buildPending, outcomeInput, approved, held, rejected };
