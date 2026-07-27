'use strict';

const assert = require('assert');
const GameOrganism = require('./game-organism');
const Examples = require('./examples');

const example = Examples.createStreetLifeExample();
assert.equal(example.organs.length, 11, 'example must expose eleven independently typed organs');
example.organs.forEach(organ => assert.equal(GameOrganism.validateOrgan(organ).pass, true, organ.id + ' must validate'));

const ready = GameOrganism.compile(example.blueprint, example.registry);
assert.equal(ready.verdict, 'CANDIDATE_READY');
assert.equal(ready.execution_order.length, 11);
assert.equal(ready.truth.executionStarted, false);
assert.equal(ready.truth.canonicalGameChanged, false);
assert.equal(ready.truth.automaticPromotion, false);
assert.equal(ready.truth.humanReleaseRequired, true);
assert.ok(ready.human_judgments.some(item => item.includes('fun')));

const mismatch = JSON.parse(JSON.stringify(example.blueprint));
mismatch.organs.find(item => item.slot_category === 'physics').slot_category = 'design';
mismatch.digest = require('../asset-hands/native-bridge-codec').sha256((() => { const copy = JSON.parse(JSON.stringify(mismatch)); delete copy.digest; return copy; })());
const heldMismatch = GameOrganism.compile(mismatch, example.registry);
assert.equal(heldMismatch.verdict, 'HELD');
assert.ok(heldMismatch.codes.includes('CATEGORY_CONFLICT'));

const unbound = JSON.parse(JSON.stringify(example.blueprint));
unbound.connections = unbound.connections.filter(item => !(item.to.instance_id === 'organ-04' && item.to.port === 'rules'));
unbound.digest = require('../asset-hands/native-bridge-codec').sha256((() => { const copy = JSON.parse(JSON.stringify(unbound)); delete copy.digest; return copy; })());
const heldUnbound = GameOrganism.compile(unbound, example.registry);
assert.equal(heldUnbound.verdict, 'HELD');
assert.ok(heldUnbound.codes.includes('UNBOUND_INPUT'));

const overBudget = GameOrganism.sealBlueprint(Object.assign({}, example.blueprint, { resource_budget: { cpu_weight: 1, gpu_weight: 1, peak_memory_mb: 1, working_storage_mb: 1 } }));
const heldBudget = GameOrganism.compile(overBudget, example.registry);
assert.equal(heldBudget.verdict, 'HELD');
assert.ok(heldBudget.codes.includes('RESOURCE_BUDGET'));

const missing = JSON.parse(JSON.stringify(example.blueprint));
missing.organs[0].organ_digest = 'f'.repeat(64);
missing.digest = require('../asset-hands/native-bridge-codec').sha256((() => { const copy = JSON.parse(JSON.stringify(missing)); delete copy.digest; return copy; })());
const heldMissing = GameOrganism.compile(missing, example.registry);
assert.equal(heldMissing.verdict, 'HELD');
assert.ok(heldMissing.codes.includes('MISSING_ORGAN'));

console.log('game-organism selftest: PASS · 11 typed organs · fail-closed assembly · no canonical writes');
