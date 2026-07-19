'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Projection = require('../kernel/schema-structural-feature-projection-cell');
const Organ = require('../organs/reasoning-structural-feature-organ');

function context(recoveryPresent) {
  const action = { id: 'candidate-a', kind: 'ask', risk: 'low' };
  if (recoveryPresent) action.recovery = 'Return to the prior state.';
  return {
    problemState: { goal: { statement: 'unselected prose must stay inert' } },
    pathSet: { profiles: [{ actionId: 'candidate-a', approach: 'also unselected prose' }] },
    principleTrace: { candidates: [{ action }] }
  };
}

function selector(pathValue, mode, positiveValues, allowedValues) {
  return {
    schema: Projection.SELECTOR_SCHEMA,
    selectorId: 'axm.mirror.selector/test-novel-machine-field-v1',
    sourceSchema: Organ.SOURCE_SCHEMA,
    rules: [{ path: pathValue, mode, ...(allowedValues ? { allowedValues } : {}), positiveValues }],
    boundary: 'Test-owned finite machine selector.'
  };
}

function reorderKeys(value) {
  if (Array.isArray(value)) return value.map(reorderKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = reorderKeys(value[key]);
    return output;
  }, {});
}

test('the production selector projects missing recovery as one positive machine fact', () => {
  const projection = Organ.create(context(false));
  assert.equal(Organ.verify(projection, context(false)), true);
  assert.deepEqual(projection.features, [
    'structural-fact:reasoning-feature-source-v1:principletrace.candidates.any.action.recovery:missing'
  ]);
  assert.deepEqual(projection.negativeFeatures, []);
  assert.deepEqual(projection.unknowns, []);
  assert.equal(projection.source.fullSourcePersisted, false);
  assert.equal(projection.summary.proseFieldsRead, 0);
  assert.equal(projection.authority.decisionAuthority, false);
});

test('present recovery is visible only as a non-bindable negative observation', () => {
  const projection = Organ.create(context(true));
  assert.deepEqual(projection.features, []);
  assert.deepEqual(projection.negativeFeatures, [
    'structural-negative:reasoning-feature-source-v1:principletrace.candidates.any.action.recovery:present'
  ]);
  assert.deepEqual(projection.unknowns, []);
});

test('canonical verification ignores JSON object-key serialization order but not content', () => {
  const originalContext = context(false);
  const projection = Organ.create(originalContext);
  const reordered = reorderKeys(projection);
  assert.equal(Organ.verify(reordered, originalContext), true);
});

test('unselected prose, identifiers, references and throwing getters are never read', () => {
  const first = context(false);
  const second = context(false);
  second.problemState.goal.statement = 'a completely different persuasive story';
  second.pathSet.profiles[0].approach = 'another narrative';
  second.principleTrace.candidates[0].action.id = 'different-id';
  Object.defineProperty(second.principleTrace.candidates[0].action, 'explanation', {
    enumerable: true,
    get() { throw new Error('unselected prose was read'); }
  });
  const left = Organ.create(first);
  const right = Organ.create(second);
  assert.equal(right.projectionId, left.projectionId);
  assert.equal(right.projectionDigest, left.projectionDigest);
  assert.equal(right.source.selectionDigest, left.source.selectionDigest);
  assert.deepEqual(right.features, left.features);
});

test('a new finite machine path can become a feature without projector code changes', () => {
  const declared = selector(['problemState', 'novelSignal'], 'BOOLEAN', [true]);
  const source = { schema: Organ.SOURCE_SCHEMA, problemState: { novelSignal: true, prose: 'ignored' } };
  const projected = Projection.project(source, declared);
  assert.deepEqual(projected.features, [
    'structural-fact:reasoning-feature-source-v1:problemstate.novelsignal:true'
  ]);
  assert.equal(projected.summary.proseFieldsRead, 0);

  const negative = Projection.project({ schema: Organ.SOURCE_SCHEMA, problemState: { novelSignal: false } }, declared);
  assert.deepEqual(negative.features, []);
  assert.deepEqual(negative.negativeFeatures, [
    'structural-negative:reasoning-feature-source-v1:problemstate.novelsignal:false'
  ]);
});

test('selectors are closed, finite, lineage-bound and cannot traverse prototypes', () => {
  const base = selector(['problemState', 'state'], 'ENUM', ['READY'], ['READY', 'HOLD']);
  const normalized = Projection.normalizeSelector(base);
  assert.throws(() => Projection.normalizeSelector({ ...base, prompt: 'interpret this prose' }), /unknown fields/);
  assert.throws(() => Projection.normalizeSelector(selector(['problemState', '__proto__', 'unsafe'], 'BOOLEAN', [true])), /path is invalid/);
  assert.throws(() => Projection.project({ schema: Organ.SOURCE_SCHEMA, problemState: { state: 'UNKNOWN' } }, base), /outside its declaration/);

  const changed = JSON.parse(JSON.stringify(normalized));
  changed.rules[0].positiveValues = ['hold'];
  assert.throws(() => Projection.normalizeSelector(changed), /digest changed/);

  const authority = JSON.parse(JSON.stringify(normalized));
  authority.authority.decisionAuthority = true;
  assert.throws(() => Projection.normalizeSelector(authority), /digest changed|authority changed/);
});

test('the projection contract is closed and the organ is absent from active runtime', () => {
  const root = path.resolve(__dirname, '..');
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'reasoning-structural-feature-projection.schema.json'), 'utf8'));
  const runtime = fs.readFileSync(path.join(root, 'runtime', 'server.js'), 'utf8');
  const command = fs.readFileSync(path.join(root, 'scripts', 'run-reasoning-structural-feature-projection.js'), 'utf8');
  assert.equal(contract.$id, Organ.SCHEMA);
  assert.equal(contract.additionalProperties, false);
  assert.ok(command.includes('Organ.verify(projection, session)'));
  assert.equal(runtime.includes('reasoning-structural-feature-organ'), false);
});
