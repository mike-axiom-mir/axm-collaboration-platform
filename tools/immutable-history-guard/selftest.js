'use strict';
const assert = require('assert');
const api = require('./index.js');
const policy = {
  id: 'mainline-v1',
  allowed_migration_types: ['compatibility', 'explicit_fork'],
  pinned_fields: ['seed', 'identity'],
  forbidden_flags: ['rewrite_history', 'destroy_evidence']
};

const accepted = api.assess({
  policy_id: 'mainline-v1', migration_type: 'compatibility',
  source_pin: { seed: 's1', identity: 'i1' }, requested_changes: { skin: '4k' },
  rollback_plan: 'retain the original'
}, policy);
assert.strictEqual(accepted.verdict, 'ACCEPT');

const rejected = api.assess({
  policy_id: 'mainline-v1', migration_type: 'compatibility',
  source_pin: { seed: 's1' }, requested_changes: { seed: 's2', rewrite_history: true },
  rollback_plan: 'retain the original'
}, policy);
assert.strictEqual(rejected.verdict, 'REJECT');
assert.strictEqual(rejected.source_pin_preserved, false);

const held = api.assess({
  policy_id: 'mainline-v1', migration_type: 'explicit_fork',
  source_pin: {}, requested_changes: {}, rollback_plan: ''
}, policy);
assert.strictEqual(held.verdict, 'HOLD');
assert.strictEqual(held.holds.length, 2);
console.log('immutable-history-guard: PASS');
