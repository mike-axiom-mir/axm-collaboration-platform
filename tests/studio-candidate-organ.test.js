'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Organ = require('../organs/studio-candidate-organ');

const observation = {
  width: 600,
  height: 600,
  visiblePixels: 0,
  blank: true,
  layerCount: 1,
  signature: '2166136261:0:1',
  backgroundColor: '#050914'
};

test('candidate organ originates several bounded Mirror-owned Studio packets', () => {
  const result = Organ.originate({ observation });
  assert.equal(result.status, 'EXPERIMENTAL');
  assert.equal(result.organ.toolAuthority, false);
  assert.equal(result.organ.selfModification, false);
  assert.ok(result.candidates.length >= 3);
  for (const candidate of result.candidates) {
    assert.equal(candidate.packet.schema, 'axm.drawpacket/v1');
    assert.equal(candidate.packet.identityId, 'mirror');
    assert.equal(candidate.packet.owner, 'mirror');
    assert.ok(candidate.packet.draw.length > 0 && candidate.packet.draw.length <= 14);
  }
});

test('ranking is invariant to supplied candidate order', () => {
  const originated = Organ.originate({ observation });
  const forward = Organ.rankCandidates(originated.candidates, observation).map(item => item.id);
  const reverse = Organ.rankCandidates(originated.candidates.slice().reverse(), observation).map(item => item.id);
  assert.deepEqual(reverse, forward);
  assert.equal(forward[0], originated.recommendedCandidateId);
});

test('same observation produces the same proposal lineage and recommendation', () => {
  const one = Organ.originate({ observation });
  const two = Organ.originate({ observation: Object.assign({}, observation) });
  assert.equal(two.observationDigest, one.observationDigest);
  assert.equal(two.recommendedCandidateId, one.recommendedCandidateId);
  assert.deepEqual(two.candidates.map(item => item.packet), one.candidates.map(item => item.packet));
});

test('candidate coordinates remain inside the first 600 by 600 Studio boundary', () => {
  const result = Organ.originate({ observation });
  for (const command of result.candidates.flatMap(item => item.packet.draw)) {
    for (const key of ['x', 'y', 'x1', 'y1', 'x2', 'y2']) {
      if (command[key] != null) assert.ok(command[key] >= 0 && command[key] <= 600, `${key} outside boundary`);
    }
  }
});
