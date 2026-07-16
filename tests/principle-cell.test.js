'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reason } = require('../kernel/principle-cell');

function request(overrides = {}) {
  return Object.assign({
    goal: 'Choose only from supplied candidates.',
    evidence: [{ id: 'proof', kind: 'test', status: 'tested', statement: 'The reversible dry run passed.', source: { kind: 'test', id: 'dry-run-1' } }],
    unknowns: [], constraints: [], permissions: [],
    actions: [{ id: 'bounded', kind: 'proposal', label: 'Apply the bounded reversible change', supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'Restore the prior checkpoint.' }]
  }, overrides);
}

test('supported reversible candidate can pass', () => {
  const trace = reason(request());
  assert.equal(trace.decision.value, 1);
  assert.equal(trace.decision.selectedActionId, 'bounded');
  assert.equal(trace.epistemic.factsPromotedByLanguage, 0);
});

test('unsupported fluent proposal holds rather than becoming confident', () => {
  const trace = reason(request({ evidence: [], actions: [{ id: 'guess', kind: 'proposal', label: 'Ship it because it sounds right', risk: 'low', reversible: false }] }));
  assert.equal(trace.decision.value, 0);
  assert.match(trace.human.summary, /holding/i);
});

test('missing explicit permission refuses candidate', () => {
  const trace = reason(request({ actions: [{ id: 'write', kind: 'proposal', label: 'Write outside the body', requiredPermissions: ['external-write'], supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'Restore.' }] }));
  assert.equal(trace.decision.value, -1);
  assert.match(trace.candidates[0].checks[0].detail, /Missing permissions/);
});

test('contradictory supporting evidence remains visible and causes a hold', () => {
  const trace = reason(request({
    evidence: [
      { id: 'yes', kind: 'test', status: 'tested', statement: 'Passed.', source: { kind: 'test', id: 'a' }, contradicts: ['no'] },
      { id: 'no', kind: 'test', status: 'contradicted', statement: 'Failed.', source: { kind: 'test', id: 'b' }, contradicts: ['yes'] }
    ],
    actions: [{ id: 'act', kind: 'proposal', label: 'Proceed', supportingEvidence: ['yes'], risk: 'low', reversible: true, recovery: 'Restore.' }]
  }));
  assert.equal(trace.decision.value, 0);
  assert.deepEqual(trace.epistemic.contradictions, [['no', 'yes']]);
});

test('no candidates creates an explicit non-mutating hold', () => {
  const trace = reason(request({ actions: [] }));
  assert.equal(trace.decision.value, 1);
  assert.equal(trace.decision.selectedActionId, 'hold-no-candidate');
  assert.match(trace.human.selected, /Hold and request/);
});
