'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const State = require('../kernel/state-language');

test('normalization preserves evidence lineage and unknowns', () => {
  const request = State.normalizeRequest({
    goal: 'Compare two bounded options.',
    actor: { id: 'mike', kind: 'human' },
    evidence: [{ id: 'observed-a', kind: 'observation', status: 'observed', statement: 'A test returned 7.', source: { kind: 'test', id: 'test-7', who: 'Codex' } }],
    unknowns: [{ id: 'cause', question: 'Why did the test return 7?', blocking: true }]
  });
  assert.equal(request.evidence[0].source.id, 'test-7');
  assert.equal(request.evidence[0].source.who, 'Codex');
  assert.equal(request.unknowns[0].blocking, true);
});

test('unknown critical fields are rejected instead of silently ignored', () => {
  assert.throws(() => State.normalizeRequest({ goal: 'Test.', hiddenAuthority: true }), /unknown critical request fields/);
});

test('canonical digests do not depend on object key order', () => {
  assert.equal(State.digest({ a: 1, b: 2 }), State.digest({ b: 2, a: 1 }));
});
