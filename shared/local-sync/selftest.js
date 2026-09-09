'use strict';

const assert = require('assert');
const Sync = require('./local-sync-core');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }
function snap(id, namespace, value, authorityDomain) { return Sync.snapshot({ id, namespace, valueSchema: 'axm.test-state/v1', value, revision: 1, parentDigests: [], authorityDomain: authorityDomain || 'owner:mike' }); }
function rule(namespace, semantics, strategy) { return Sync.rule({ id: `${namespace}:${semantics}`, namespace, semantics, strategy, owner: 'owner:mike' }); }
function admit(mergeRule, namespace) { return Sync.admission({ namespace: namespace || mergeRule.namespace, ruleDigest: mergeRule.ruleDigest }); }
function merge(local, remote, mergeRule, admission) { return Sync.merge(local, remote, mergeRule, admission || admit(mergeRule)); }

function run() {
  const left = snap('left', 'projects.game-22', [{ id: 'a', value: 1 }]);
  const right = snap('right', 'projects.game-22', [{ id: 'b', value: 2 }]);
  check(Sync.verifySnapshot(left), 'snapshot digest verifies');
  const immutableRule = rule(left.namespace, 'IMMUTABLE');
  check(Sync.verifyRule(immutableRule), 'merge-rule digest verifies');
  check(merge(left, left, immutableRule).state === 'IDENTICAL', 'identical snapshots remain identical');
  const appendRule = rule(left.namespace, 'APPEND_ONLY');
  const appendAdmission = admit(appendRule);
  check(Sync.verifyAdmission(appendAdmission), 'merge admission digest verifies');
  check(merge(left, right, appendRule, appendAdmission).candidate.value.length === 2, 'append-only union retains both entries');
  const conflictRight = snap('right-conflict', left.namespace, [{ id: 'a', value: 9 }]);
  check(merge(left, conflictRight, appendRule).state === 'CONFLICT', 'append-only id mutation is a conflict');
  const gLeft = snap('g-left', 'tags', ['b', 'a']);
  const gRight = snap('g-right', 'tags', ['b', 'c']);
  const gSetRule = rule('tags', 'CRDT_MERGEABLE', 'G_SET');
  const gSet = merge(gLeft, gRight, gSetRule);
  check(gSet.state === 'CANDIDATE' && gSet.candidate.value.join(',') === 'a,b,c', 'proven grow-only set merge is deterministic');
  expect('UNPROVEN_CRDT_STRATEGY', () => rule('tags', 'CRDT_MERGEABLE', 'GENERIC_CRDT'));
  const noLastWriter = rule(left.namespace, 'LAST_WRITER_NOT_ALLOWED');
  check(merge(left, right, noLastWriter).state === 'HOLD', 'last-writer selection is refused');
  const humanRule = rule(left.namespace, 'HUMAN_RECONCILIATION_REQUIRED');
  check(merge(left, right, humanRule).reconciliation.requiresHuman, 'human reconciliation emits an exact packet');
  const singleAuthorityRule = rule(left.namespace, 'SINGLE_AUTHORITY');
  check(merge(left, right, singleAuthorityRule).state === 'HOLD', 'single-authority divergence does not auto-select a side');
  const foundationLeft = snap('f1', 'axm.foundation.roots', { value: 1 });
  const foundationRight = snap('f2', 'axm.foundation.roots', { value: 2 });
  const sensitiveRule = rule('axm.foundation.roots', 'CRDT_MERGEABLE', 'G_SET');
  const sensitive = merge(foundationLeft, foundationRight, sensitiveRule);
  check(sensitive.state === 'HOLD' && sensitive.reconciliation.reason.includes('sensitive'), 'Foundation and roots never auto-merge');
  check(merge(left, right, immutableRule).state === 'CONFLICT', 'different immutable snapshots conflict');
  check(gSet.applied === false, 'merge result is only a candidate and is never applied');
  check(merge(left, right, appendRule).resultDigest === merge(left, right, appendRule).resultDigest, 'repeated admission and merge is deterministic');

  const mutatedState = JSON.parse(JSON.stringify(left));
  mutatedState.value[0].value = 8;
  expect('SNAPSHOT_DIGEST_DRIFT', () => merge(mutatedState, right, appendRule));
  const unsealedState = { ...left };
  delete unsealedState.snapshotDigest;
  expect('SNAPSHOT_ENVELOPE_DRIFT', () => merge(unsealedState, right, appendRule));
  expect('SNAPSHOT_SCHEMA_DRIFT', () => Sync.verifySnapshot({ ...left, schema: 'axm.state-snapshot/v0' }));
  expect('SNAPSHOT_ENVELOPE_DRIFT', () => Sync.verifySnapshot({ ...left, projection: true }));

  const tamperedRule = { ...immutableRule, semantics: 'LAST_WRITER_NOT_ALLOWED' };
  expect('RULE_DIGEST_DRIFT', () => merge(left, right, tamperedRule, admit(immutableRule)));
  const unsealedRule = { ...appendRule };
  delete unsealedRule.ruleDigest;
  expect('RULE_ENVELOPE_DRIFT', () => merge(left, right, unsealedRule, appendAdmission));
  expect('RULE_SCHEMA_DRIFT', () => Sync.verifyRule({ ...appendRule, schema: 'axm.merge-rule/v0' }));
  expect('RULE_ENVELOPE_DRIFT', () => Sync.verifyRule({ ...appendRule, grantsAuthority: true }));
  expect('UNEXPECTED_MERGE_STRATEGY', () => Sync.rule({ id: 'bad-strategy', namespace: 'tags', semantics: 'APPEND_ONLY', strategy: 'G_SET', owner: 'owner:mike' }));
  expect('INVALID_MERGE_ADMISSION', () => Sync.merge(left, right, appendRule));
  expect('ADMISSION_RULE_MISMATCH', () => merge(left, right, appendRule, admit(immutableRule)));
  expect('ADMISSION_NAMESPACE_MISMATCH', () => merge(left, right, appendRule, admit(appendRule, 'projects.other')));
  expect('ADMISSION_DIGEST_DRIFT', () => merge(left, right, appendRule, { ...appendAdmission, namespace: 'projects.other' }));
  expect('ADMISSION_SCHEMA_DRIFT', () => Sync.verifyAdmission({ ...appendAdmission, schema: 'axm.merge-admission/v0' }));

  const parentA = 'a'.repeat(64);
  const parentB = 'b'.repeat(64);
  const child = Sync.snapshot({ id: 'child', namespace: 'projects.game-22', valueSchema: 'axm.test-state/v1', value: {}, revision: 2, parentDigests: [parentB, parentA], authorityDomain: 'owner:mike' });
  check(child.parentDigests.join(',') === [parentA, parentB].join(','), 'snapshot constructor canonicalizes parent order');
  expect('SNAPSHOT_PARENT_ORDER_DRIFT', () => Sync.verifySnapshot({ ...child, parentDigests: [parentB, parentA] }));
  expect('INVALID_SNAPSHOT_PARENTS', () => Sync.snapshot({ ...child, parentDigests: [parentA, parentA] }));

  expect('INVALID_CANONICAL_VALUE', () => snap('nan', 'tags', [Number.NaN]));
  expect('INVALID_CANONICAL_VALUE', () => snap('undefined', 'tags', { present: undefined }));
  const sparse = [];
  sparse[1] = 'value';
  expect('INVALID_CANONICAL_VALUE', () => snap('sparse', 'tags', sparse));
  expect('INVALID_CANONICAL_VALUE', () => snap('date', 'tags', new Date(0)));
  const accessor = {};
  Object.defineProperty(accessor, 'value', { enumerable: true, get() { throw new Error('must not execute'); } });
  expect('INVALID_CANONICAL_VALUE', () => snap('accessor', 'tags', accessor));
  const cyclic = {};
  cyclic.self = cyclic;
  expect('INVALID_CANONICAL_VALUE', () => snap('cycle', 'tags', cyclic));
  const concealed = { ...left };
  Object.defineProperty(concealed, 'hidden', { value: true });
  expect('SNAPSHOT_ENVELOPE_DRIFT', () => Sync.verifySnapshot(concealed));
  const activeEnvelope = { ...left };
  Object.defineProperty(activeEnvelope, 'schema', { enumerable: true, get() { throw new Error('must not execute'); } });
  expect('SNAPSHOT_ENVELOPE_DRIFT', () => Sync.verifySnapshot(activeEnvelope));
  const numericEntry = snap('numeric-entry', left.namespace, [{ id: 2, value: 'ambiguous' }]);
  expect('INVALID_APPEND_ONLY_ENTRY', () => merge(left, numericEntry, appendRule));
  expect('INVALID_STATE_SNAPSHOT', () => Sync.snapshot({ id: 42, namespace: 'tags', valueSchema: 'axm.test-state/v1', value: [], revision: 0, parentDigests: [], authorityDomain: 'owner:mike' }));
  process.stdout.write(`local-sync selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
