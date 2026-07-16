'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize } = require('../training/teacher-artifact');

function valid() {
  return {
    schema: 'axm.mirror.teacher-artifact/v1',
    source: { provider: 'local-research', model: 'teacher-1', usePermission: 'allowed', permissionBasis: 'Owner explicitly approved this output for local research.', capturedBy: 'mike' },
    task: 'Repair one failing test.', evidenceRefs: ['test://failure-1'], alternatives: ['Hold', 'Patch bounded line'],
    decision: 'Patch the bounded line.', verification: ['The targeted test passed.'], corrections: [], outcome: 'Failure repaired.', limitations: ['One fixture only.']
  };
}

test('reviewable permitted artifact becomes candidate, never trained canon', () => {
  const artifact = normalize(valid());
  assert.equal(artifact.review.state, 'CANDIDATE');
  assert.equal(artifact.review.promoted, false);
});

test('unknown training rights are refused', () => {
  const input = valid(); input.source.usePermission = 'unknown';
  assert.throws(() => normalize(input), /explicit usePermission/);
});

test('hidden chain-of-thought fields are refused at any depth', () => {
  const input = valid(); input.source.scratchpad = 'private';
  assert.throws(() => normalize(input), /private reasoning field refused/);
});
