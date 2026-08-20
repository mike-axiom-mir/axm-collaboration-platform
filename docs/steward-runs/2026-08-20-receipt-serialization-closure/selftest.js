'use strict';

const assert = require('assert');
const Builder = require('./build-current-serialization-closure');

let assertions = 0;
function check(condition, message) { assertions += 1; assert.ok(condition, message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

const current = Builder.build();
check(Builder.verify(current.evaluation, current.migration).pass, 'current evaluation and migration profile verify');
check(current.evaluation.status === 'TEST', 'evaluation remains TEST');
check(current.evaluation.counts.consumers === 15, 'all fifteen current Grounded Growth serializer consumers are inventoried');
check(current.evaluation.counts.invalidCanonicalText > 0, 'invalid canonical text exposure is visible');
check(current.evaluation.counts.silentFieldLoss > 0, 'silent field loss exposure is visible');
check(current.evaluation.counts.unsafeFixtures === 13, 'thirteen unsafe held-out fixtures are exercised');
check(current.evaluation.counts.unsafeFixturesRefused === 13, 'all unsafe held-out fixtures are refused');
check(current.evaluation.counts.safeFixtures === 6, 'six safe regression fixtures are exercised');
check(current.evaluation.counts.safeFixturesRoundtripExact === 6, 'all safe regression fixtures roundtrip exactly');
check(current.evaluation.observedFailure.sequence === 14 && current.evaluation.observedFailure.recordedOutcomes === 10, 'the actual prior failure is bound');
check(current.evaluation.capability.implementationCreatedByThisLane === false, 'no duplicate serializer is claimed');
check(current.evaluation.capability.publishedCommit === '71a7f7bf9f1b2f1c526713431779ab1325c3eadf', 'the exact published snapshot commit is named');
check(current.evaluation.capability.sources.every((row) => row.canonicalTextIdentity && row.normalization === 'UTF8_LF' && row.sha256 === row.publishedSnapshotSha256), 'every recovered core file has canonical text identity with the published snapshot');
check(current.evaluation.decision.adoption === 'REVIEW_CANDIDATE_NOT_AUTHORIZED', 'reuse is a review candidate only');
check(current.evaluation.authority.consumerEdits === 0, 'no consumer migration is claimed');
check(current.evaluation.limits.humanBenefitEstablished === false, 'human benefit remains unproved');
check(current.evaluation.limits.modelReasoningEquivalenceProved === false, 'model reasoning equivalence remains unproved');
check(current.migration.consumers.every((row) => row.migrationState === 'NOT_AUTHORIZED'), 'every consumer migration remains unauthorized');
check(current.migration.deferredContinuityDirection.state === 'DIRECTION_ONLY_WAIT_FOR_PLATFORM_CANDIDATE', 'continuity mirror remains deferred');

const mutations = [
  (x) => { x.evaluation.observedFailure.sequence = 99; },
  (x) => { x.evaluation.capability.sources[0].sha256 = 'sha256:' + '0'.repeat(64); },
  (x) => { x.evaluation.capability.sources[0].canonicalTextIdentity = false; },
  (x) => { x.evaluation.counts.consumers = 14; },
  (x) => { x.evaluation.counts.unsafeFixturesRefused = 12; },
  (x) => { x.evaluation.counts.safeFixturesRoundtripExact = 5; },
  (x) => { x.evaluation.limits.humanBenefitEstablished = true; },
  (x) => { x.evaluation.limits.modelReasoningEquivalenceProved = true; },
  (x) => { x.evaluation.authority.consumerEdits = 1; },
  (x) => { x.evaluation.authority.promoted = true; },
  (x) => { x.migration.consumers[0].migrationState = 'MIGRATED'; },
  (x) => { x.migration.deferredContinuityDirection.state = 'ACTIVE'; }
];
mutations.forEach((mutate, index) => {
  const changed = clone(current);
  mutate(changed);
  check(!Builder.verify(changed.evaluation, changed.migration).pass, 'hostile mutation ' + index + ' is refused');
});

process.stdout.write('receipt-serialization-closure selftest: PASS (' + assertions + ' assertions)\n');
