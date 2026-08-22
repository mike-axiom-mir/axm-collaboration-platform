#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Builder = require('./build-current-root-cohort');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

const result = Builder.checkRecorded();
check(result.status === 'TEST' && result.state === 'THREE_CONSUMER_ROOT_COHORT_MIGRATED_ON_REVIEW_BRANCH', 'cohort identity remains branch-only TEST');
check(result.dependencyReason.root === 'grounded-growth-outcomes' && result.dependencyReason.directCloneSeamsClosedTogether.length === 2, 'dependency-root cohort is explicit');
check(result.before.strictUnsafeRefusal === 1 && result.before.remainingUnsafeConsumers === 14, 'sealed one-consumer before state is exact');
check(result.cohort.length === 3 && result.cohort.map((item) => item.id).join(',') === Builder.IDS.join(','), 'exact three-module cohort is bound');
check(result.cohort.every((item) => item.beforeSourceSha256 !== item.afterSourceSha256), 'all cohort source changes are visible');
check(result.cohort.every((item) => item.beforeBehavior === 'INVALID_CANONICAL_TEXT' && item.afterBehavior === 'REFUSED_UNSAFE_VALUE'), 'all cohort behavior transitions are exact');
check(result.cohort.every((item) => item.receiptSchemaChanged === false), 'no receipt schema changed');
check(result.after.consumers === 15 && result.after.strictUnsafeRefusal === 4, 'four of fifteen consumers now refuse unsafe state');
check(result.after.remainingInvalidCanonicalText === 6 && result.after.remainingSilentFieldLoss === 5, 'eleven remaining unsafe consumers are classified');
check(result.after.remaining.length === 11 && result.after.rolloutComplete === false, 'cohort is not mislabeled as complete rollout');
check(result.structuralClosure.length === 3 && result.structuralClosure.every((item) => Object.entries(item).every(([key, value]) => key === 'consumerId' || value === true)), 'source and contract closure is exact');
check(result.unsafeFixtureResults.length === 39 && result.unsafeFixtureResults.every((item) => item.state === 'REFUSED'), 'all thirty-nine unsafe fixture/module pairs fail closed');
check(result.buildPathResults.length === 3 && result.buildPathResults.every((item) => item.state === 'REFUSED_BEFORE_CLONE_COMPLETION'), 'three real build paths refuse injected unsafe state');
check(result.historicalProductCompatibility.length === 3 && result.historicalProductCompatibility.every((item) => item.canonicalExact && item.nativeVerification === 'PASS'), 'three historical product receipts remain exact');
check(result.persistence.length === 3 && result.persistence.every((item) => item.canonicalExactAfterRead && item.canonicalDigestBound && item.payloadDigestBound), 'three persistence journeys retain canonical and digest bindings');
check(result.persistence.every((item) => item.temporaryFileRetained === false), 'temporary persistence files are not retained');
check(result.knownSourceEvolution.length === 3 && result.knownSourceEvolution.every((item) => item.verdict === 'EXPECTED_STALE_AFTER_SOURCE_CHANGE'), 'old source-identity receipt failures remain explicit');
check(result.requirements.filter((item) => item.verdict === 'PASS').length === 5, 'five implemented cohort requirements pass');
check(result.requirements.find((item) => item.id === 'clean-checkout-full-verification').verdict === 'NOT_RUN', 'full clean-checkout gate stays open until the final matrix');
check(result.limits.representationClosureOnly && !result.limits.humanBenefitEstablished && !result.limits.modelReasoningEquivalenceProved, 'claim ceiling remains representation-only');
check(!result.limits.humanReviewRun && !result.limits.browserParityTested && !result.limits.shadowCloneCandidateEvaluated, 'unrun human browser and future shadow work remains unclaimed');
check(result.authority.branchOnly && !result.authority.merged && !result.authority.canonized && !result.authority.foundationMutation, 'Mike retains merge and CANON authority');
check(result.authority.consumersEditedThisCohort === 3, 'authority receipt names the exact edit count');
check(/^sha256:[a-f0-9]{64}$/.test(result.cohortDigest), 'cohort receipt is digest-bound');

console.log('PASS Grounded Growth JSON root cohort selftest (' + checks + ' assertions)');
