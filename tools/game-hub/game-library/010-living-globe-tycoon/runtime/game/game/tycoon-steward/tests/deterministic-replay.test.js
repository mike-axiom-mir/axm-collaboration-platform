'use strict';

const assert = require('assert');
const H = require('./test-helpers');
const Rng = require('../core/deterministic-rng');

module.exports = ({ test }) => {
  test('identical seed plus decisions yields byte-identical state and receipts', 'R1 deterministic replay', () => {
    const left = H.runPublicSequence('same-seed', 24);
    const right = H.runPublicSequence('same-seed', 24);
    assert.equal(H.Canonical.stableStringify(left.exportState()), H.Canonical.stableStringify(right.exportState()));
    assert.equal(H.Canonical.stableStringify(left.exportReceipt()), H.Canonical.stableStringify(right.exportReceipt()));
  });

  test('different seed can change deterministic terrain without changing schemas', 'R1 deterministic replay', () => {
    const left = H.Steward.createSteward('seed-a').observeState();
    const right = H.Steward.createSteward('seed-b').observeState();
    assert.notEqual(H.Canonical.stableStringify(left.map.cells.map(c => c.terrain)), H.Canonical.stableStringify(right.map.cells.map(c => c.terrain)));
    assert.equal(left.schema, right.schema);
  });

  test('PRNG packet resumes exactly and IDs remain deterministic', 'Deterministic IDs', () => {
    const first = Rng.create('resume-seed');
    first.nextUint32(); first.nextUint32();
    const packet = first.snapshot();
    const a = first.nextUint32();
    const resumed = Rng.create(packet);
    assert.equal(resumed.nextUint32(), a);
    const one = H.runPublicSequence('id-seed', 4).observeState();
    const two = H.runPublicSequence('id-seed', 4).observeState();
    assert.deepEqual(one.structures.map(x => x.id), two.structures.map(x => x.id));
    assert.deepEqual(one.roads.map(x => x.id), two.roads.map(x => x.id));
  });

  test('canonical SHA-256 matches the published abc vector', 'Canonical hashing', () => {
    assert.equal(H.Canonical.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
};
