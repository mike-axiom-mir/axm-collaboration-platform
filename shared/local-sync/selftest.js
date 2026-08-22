'use strict';

const assert = require('assert');
const Sync = require('./local-sync-core');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }
function snap(id, namespace, value, authorityDomain) { return Sync.snapshot({ id, namespace, valueSchema: 'axm.test-state/v1', value, revision: 1, parentDigests: [], authorityDomain: authorityDomain || 'owner:mike' }); }
function rule(namespace, semantics, strategy) { return Sync.rule({ id: `${namespace}:${semantics}`, namespace, semantics, strategy, owner: 'owner:mike' }); }

function run() {
  const left = snap('left', 'projects.game-22', [{ id: 'a', value: 1 }]);
  const right = snap('right', 'projects.game-22', [{ id: 'b', value: 2 }]);
  check(Sync.verifySnapshot(left), 'snapshot digest verifies');
  check(Sync.merge(left, left, rule(left.namespace, 'IMMUTABLE')).state === 'IDENTICAL', 'identical snapshots remain identical');
  check(Sync.merge(left, right, rule(left.namespace, 'APPEND_ONLY')).candidate.value.length === 2, 'append-only union retains both entries');
  const conflictRight = snap('right-conflict', left.namespace, [{ id: 'a', value: 9 }]);
  check(Sync.merge(left, conflictRight, rule(left.namespace, 'APPEND_ONLY')).state === 'CONFLICT', 'append-only id mutation is a conflict');
  const gLeft = snap('g-left', 'tags', ['b', 'a']);
  const gRight = snap('g-right', 'tags', ['b', 'c']);
  const gSet = Sync.merge(gLeft, gRight, rule('tags', 'CRDT_MERGEABLE', 'G_SET'));
  check(gSet.state === 'CANDIDATE' && gSet.candidate.value.join(',') === 'a,b,c', 'proven grow-only set merge is deterministic');
  expect('UNPROVEN_CRDT_STRATEGY', () => rule('tags', 'CRDT_MERGEABLE', 'GENERIC_CRDT'));
  check(Sync.merge(left, right, rule(left.namespace, 'LAST_WRITER_NOT_ALLOWED')).state === 'HOLD', 'last-writer selection is refused');
  check(Sync.merge(left, right, rule(left.namespace, 'HUMAN_RECONCILIATION_REQUIRED')).reconciliation.requiresHuman, 'human reconciliation emits an exact packet');
  check(Sync.merge(left, right, rule(left.namespace, 'SINGLE_AUTHORITY')).state === 'HOLD', 'single-authority divergence does not auto-select a side');
  const foundationLeft = snap('f1', 'axm.foundation.roots', { value: 1 });
  const foundationRight = snap('f2', 'axm.foundation.roots', { value: 2 });
  const sensitive = Sync.merge(foundationLeft, foundationRight, rule('axm.foundation.roots', 'CRDT_MERGEABLE', 'G_SET'));
  check(sensitive.state === 'HOLD' && sensitive.reconciliation.reason.includes('sensitive'), 'Foundation and roots never auto-merge');
  check(Sync.merge(left, right, rule(left.namespace, 'IMMUTABLE')).state === 'CONFLICT', 'different immutable snapshots conflict');
  check(gSet.applied === false, 'merge result is only a candidate and is never applied');
  process.stdout.write(`local-sync selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
