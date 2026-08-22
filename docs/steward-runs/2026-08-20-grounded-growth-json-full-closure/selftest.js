#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Builder = require('./build-current-full-closure');
const Baseline = require('./capture-v03-before-state');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

const before = Baseline.verifyRecorded();
const result = Builder.checkRecorded();
check(result.status === 'TEST' && result.state === 'ALL_FIFTEEN_GROUNDED_GROWTH_SERIALIZERS_STRICT_ON_REVIEW_BRANCH', 'full closure identity remains branch-only TEST');
check(result.scope.representationClosureOnly && !result.scope.workshopWideSerializationClaimed, 'scope is exact and not Workshop-wide');
check(before.counts.consumers === 11 && before.counts.invalidCanonicalText === 6 && before.counts.silentFieldLoss === 5, 'v0.3 before-state is exact');
check(before.counts.safeFixtureComparisons === 66 && before.counts.safeFixtureStrictCoreExact === 66, 'all before-state safe samples already matched the strict core');
check(result.before.strictConsumers === 4 && result.before.remainingUnsafeConsumers === 11, 'rollout begins from the sealed v0.3 state');
check(result.migration.length === 11 && result.migration.map((item) => item.id).join(',') === Builder.IDS.join(','), 'exact eleven-consumer migration is bound');
check(result.migration.every((item) => item.beforeSourceSha256 !== item.afterSourceSha256), 'all eleven source changes are visible');
check(result.migration.every((item) => ['INVALID_CANONICAL_TEXT', 'SILENT_FIELD_LOSS'].includes(item.beforeBehavior)), 'every migrated consumer had an unsafe before behavior');
check(result.migration.every((item) => item.afterBehavior === 'REFUSED_UNSAFE_VALUE'), 'every migrated consumer now refuses unsafe state');
check(result.after.consumers === 15 && result.after.strictUnsafeRefusal === 15, 'all fifteen inventoried consumers are strict');
check(result.after.invalidCanonicalText === 0 && result.after.silentFieldLoss === 0 && result.after.remainingUnsafeConsumers === 0, 'no inventoried unsafe behavior remains');
check(result.after.scopedRolloutComplete === true, 'the dated fifteen-consumer rollout is complete');
check(result.structuralClosure.length === 11 && result.structuralClosure.every((item) => item.importsExistingCore && item.cloneUsesStrictCanonicalText && item.stableStringifyUsesExistingCore), 'all source seams use the existing strict core');
check(result.structuralClosure.every((item) => item.contractRequiresExistingCore && item.contractRefusesUnsafeState), 'all eleven contracts declare strict closure');
check(result.structuralClosure.find((item) => item.consumerId === 'grounded-growth-phone-evidence-gate').phoneNativeDigestCompatibilityValidatedFirst, 'phone native-order compatibility validates strict JSON first');
check(result.unsafeFixtureResults.length === 143 && result.unsafeFixtureResults.every((item) => item.state === 'REFUSED'), 'all 143 unsafe fixture/consumer pairs fail closed');
check(result.safeCompatibility.length === 66 && result.safeCompatibility.every((item) => item.canonicalExact && item.objectDigestExact), 'all 66 before-state safe bytes and digests remain exact');
check(result.persistence.length === 11 && result.persistence.every((item) => item.canonicalExactAfterRead && item.digestExactAfterRead), 'eleven write/read persistence journeys remain exact');
check(result.persistence.every((item) => item.temporaryFileRetained === false), 'temporary persistence files are not retained');
check(result.historicalEvidencePolicy.datedReceiptsRewritten === false, 'historical dated receipts remain immutable');
check(result.requirements.filter((item) => item.verdict === 'PASS').length === 5, 'five implemented closure requirements pass');
check(result.requirements.filter((item) => item.verdict === 'NOT_RUN').length === 2, 'full matrix and fresh checkout stay open until final verification');
check(!result.limits.humanBenefitEstablished && !result.limits.modelLearningImprovementEstablished && !result.limits.modelReasoningEquivalenceProved, 'human, learning, and reasoning claims remain unmade');
check(!result.limits.browserParityTested && !result.limits.humanReviewRun && !result.limits.shadowCloneCandidateEvaluated, 'browser, human, and future shadow work remain unrun');
check(result.authority.branchOnly && !result.authority.installed && !result.authority.promoted && !result.authority.merged && !result.authority.canonized && !result.authority.foundationMutation, 'Mike retains lifecycle and CANON authority');
check(result.authority.consumersEditedThisLane === 11, 'authority receipt names the exact edit count');
check(/^sha256:[a-f0-9]{64}$/.test(result.closureDigest), 'full closure receipt is digest-bound');

console.log('PASS Grounded Growth JSON full closure selftest (' + checks + ' assertions)');
