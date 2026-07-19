'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Skill = require('../adapters/workshop/human-discovery-skill');

function fakeCore() {
  return {
    createSession(config) { return { schema: 'fake', id: config.id || 'review-1', config, records: [] }; },
    recordDiscovery(state, stage, value) {
      const next = JSON.parse(JSON.stringify(state)); next.records.push({ stage, value });
      return { ok: true, state: next, errors: [] };
    },
    validate() { return { ok: true, errors: [], warnings: [] }; },
    exportBundle(state) { return { session: state }; }
  };
}

test('human Discovery/Stance is explicit, secondary and advisory', () => {
  assert.throws(() => Skill.run({ subject: 'Studio' }, { core: fakeCore() }), /explicitInvocation/);
  const result = Skill.run({
    explicitInvocation: true, sessionId: 'human-review-1', subject: 'Studio first-use flow',
    entries: [{ stage: 'blindSpots', text: 'A beginner may not know which layer is theirs.' }]
  }, { core: fakeCore(), sourceFile: 'fixture' });
  assert.equal(result.priority, 'secondary');
  assert.equal(result.advisory, true);
  assert.equal(result.mayCloseNativeSeams, false);
  assert.equal(result.mayPromoteLearning, false);
  assert.equal(result.bundle.session.records.length, 1);
});

test('unknown human review stages are refused', () => {
  assert.throws(() => Skill.run({ explicitInvocation: true, subject: 'x', entries: [{ stage: 'invented', text: 'x' }] }, { core: fakeCore() }), /unknown/);
});
