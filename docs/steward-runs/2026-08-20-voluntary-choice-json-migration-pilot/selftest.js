#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Builder = require('./build-current-migration-pilot');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

const result = Builder.checkRecorded();
check(result.status === 'TEST' && result.state === 'ONE_CONSUMER_MIGRATED_ON_REVIEW_BRANCH', 'pilot identity remains branch-only TEST');
check(result.consumer.id === Builder.CONSUMER_ID && result.consumer.path === Builder.CONSUMER_PATH, 'pilot is bound to one exact consumer');
check(result.consumer.selectionReason === 'ZERO_EXTERNAL_CODE_REFERENCES_IN_SECURED_SOURCE_TREE' && result.consumer.permissionlessLeaf, 'candidate selection preserves low blast radius');
check(result.consumer.before.behavior === 'INVALID_CANONICAL_TEXT', 'before evidence preserves the observed invalid representation');
check(result.consumer.after.behavior === 'REFUSED_UNSAFE_VALUE' && /unsupported undefined/.test(result.consumer.after.error), 'after evidence refuses the observed unsafe value');
check(result.consumer.before.sourceSha256 !== result.consumer.after.sourceSha256, 'source evolution is visible');
check(result.consumer.receiptSchemaChanged === false, 'receipt schema is unchanged');
check(result.exposure.consumers === 15 && result.exposure.strictUnsafeRefusal === 1, 'exactly one of fifteen consumers now refuses unsafe values');
check(result.exposure.remainingInvalidCanonicalText === 9 && result.exposure.remainingSilentFieldLoss === 5, 'fourteen exposed consumers remain visible');
check(result.exposure.migrationCompleteForAllConsumers === false, 'pilot is not mislabeled as full migration');
check(result.historicalCompatibility.recordedFrontierDigest === result.historicalCompatibility.expectedFrontierDigest, 'recorded digest matches pinned history');
check(result.historicalCompatibility.rebuiltFrontierDigest === result.historicalCompatibility.expectedFrontierDigest, 'rebuilt digest preserves pinned history');
check(result.historicalCompatibility.canonicalTextExact && result.historicalCompatibility.payloadDigestExact, 'valid historical canonical text and payload digest remain exact');
check(result.unsafeFixtures.length === 13 && result.unsafeFixtures.every((item) => item.state === 'REFUSED'), 'all thirteen unsafe fixtures fail closed');
check(result.persistence.parsedBeforeWrite && result.persistence.parsedAfterRead, 'canonical JSON parses before and after persistence');
check(result.persistence.writeCompleted && result.persistence.readCompleted, 'fresh temporary persistence journey completes');
check(result.persistence.canonicalExactAfterRead && result.persistence.canonicalDigestBound && result.persistence.payloadDigestBound, 'read-back canonical and digest bindings remain exact');
check(result.persistence.temporaryFileRetained === false, 'temporary persistence evidence is not retained');
check(result.requirements.filter((item) => item.verdict === 'PASS').length === 5, 'five implemented migration requirements pass');
check(result.requirements.find((item) => item.id === 'clean-checkout-full-verification').verdict === 'NOT_RUN', 'full clean-checkout gate remains open until the matrix runs');
check(result.limits.representationClosureOnly && !result.limits.humanBenefitEstablished && !result.limits.modelReasoningEquivalenceProved, 'claim ceiling remains representation-only');
check(!result.limits.browserParityTested && !result.limits.humanReviewRun && !result.limits.shadowCloneCandidateEvaluated, 'browser human and future shadow candidate work remain unclaimed');
check(result.authority.branchOnly && !result.authority.merged && !result.authority.canonized && !result.authority.foundationMutation, 'Mike retains merge and CANON authority');
check(result.authority.otherConsumersEdited === 0, 'other consumers remain untouched');
check(/^sha256:[a-f0-9]{64}$/.test(result.pilotDigest), 'pilot receipt is digest-bound');

console.log('PASS voluntary-choice deterministic JSON migration pilot selftest (' + checks + ' assertions)');
