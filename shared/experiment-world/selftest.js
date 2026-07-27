'use strict';

const assert = require('assert');
const Engine = require('./experiment-world');

function world() {
  return Engine.create({
    id: 'proof',
    goal: 'Create something useful without assuming its final form.',
    mode: 'unknown-hunt',
    createdAt: '2026-07-23T00:00:00.000Z',
    budgets: { timeMinutes: 5, storageMb: 50, computePercent: 20, maxArtifacts: 12 }
  });
}

const first = world();
assert.equal(Engine.validate(first).ok, true);
assert.equal(first.truth.canonicalWorkshopChanged, false);
assert.equal(first.truth.mirrorConnected, false);
assert.equal(first.budgets.network, false);
assert.equal(first.truth.resourceUsageMeasured, false);
assert.equal(first.truth.resourceEnvelope, 'declared-intent-budget');

const pulseA = Engine.runPulse(first);
assert.equal(pulseA.ok, true);
assert.equal(pulseA.state.pulse, 1);
assert.equal(pulseA.state.artifacts.length, 2);
assert.equal(pulseA.state.artifacts[1].kind, 'unknown-capsule');
assert.equal(pulseA.state.truth.arbitraryCodeExecuted, false);

const pulseB = Engine.runPulse(world());
assert.equal(pulseA.state.worldDigest, pulseB.state.worldDigest, 'same inputs must replay deterministically');

const denied = Engine.applyIntent(pulseA.state, {
  schema: Engine.INTENT_SCHEMA,
  id: 'escape-attempt',
  type: 'artifact.create',
  actor: { id: 'mirror', kind: 'machine' },
  effects: ['network', 'canonical-write'],
  artifact: { kind: 'code', title: 'Outside action' }
});
assert.equal(denied.ok, false);
assert.equal(denied.refusal.code, 'AUTHORITY_BOUNDARY');
assert.equal(denied.state.truth.externalNetworkUsed, false);
assert.equal(denied.state.truth.canonicalWorkshopChanged, false);

const undeclared = Engine.applyIntent(pulseA.state, {
  schema: Engine.INTENT_SCHEMA,
  id: 'unknown-effect',
  type: 'artifact.create',
  actor: { id: 'mirror', kind: 'machine' },
  effects: ['teleport-outside'],
  artifact: { kind: 'proposal', title: 'Unknown authority request' }
});
assert.equal(undeclared.ok, false);
assert.equal(undeclared.refusal.code, 'UNDECLARED_EFFECT');
assert.equal(undeclared.state.artifacts.length, pulseA.state.artifacts.length);

const overBudget = Engine.applyIntent(first, {
  schema: Engine.INTENT_SCHEMA,
  id: 'too-hot',
  type: 'artifact.create',
  actor: { id: 'mirror', kind: 'machine' },
  resource: { computePercent: 90 },
  artifact: { kind: 'image', title: 'Too expensive' }
});
assert.equal(overBudget.ok, false);
assert.equal(overBudget.refusal.code, 'RESOURCE_BUDGET');

const beforeObserve = pulseA.state.worldDigest;
const frame = Engine.observe(pulseA.state, { id: 'mirror', kind: 'machine' });
assert.equal(frame.schema, Engine.FRAME_SCHEMA);
assert.equal(pulseA.state.worldDigest, beforeObserve, 'observation must not mutate world state');
assert.equal(frame.truth.observerCanMutateWorld, false);

const evidenceTarget = pulseA.state.artifacts[1];
const evidenceAdded = Engine.applyIntent(pulseA.state, {
  schema: Engine.INTENT_SCHEMA,
  id: 'evidence-proof',
  type: 'evidence.record',
  actor: { id: 'verifier-seat', kind: 'machine' },
  sourceIds: [evidenceTarget.id],
  effects: ['candidate-memory'],
  evidence: { claim: 'candidate remains contract only', verdict: 'PASS', surface: 'deterministic-test' },
  resource: { timeMinutes: 0, storageMb: 0, computePercent: 0 }
});
assert.equal(evidenceAdded.ok, true);
assert.notEqual(evidenceAdded.artifact.digest, evidenceTarget.digest, 'artifact digest must change when evidence changes');
assert.equal(evidenceAdded.artifact.evidence.length, 1);

const frozen = Engine.applyIntent(pulseA.state, {
  schema: Engine.INTENT_SCHEMA,
  id: 'freeze',
  type: 'experiment.freeze',
  actor: { id: 'mike', kind: 'human' },
  effects: [],
  resource: { timeMinutes: 0, storageMb: 0, computePercent: 0 }
});
assert.equal(frozen.ok, true);
assert.equal(frozen.state.status, 'FROZEN');
const afterFreeze = Engine.runPulse(frozen.state);
assert.equal(afterFreeze.ok, false);
assert.equal(afterFreeze.refusal.code, 'WORLD_FROZEN');
assert.equal(afterFreeze.state.status, 'FROZEN');
assert.deepEqual(afterFreeze.state.artifacts, frozen.state.artifacts, 'frozen candidate content must remain unchanged');

const checkpoint = Engine.checkpoint(pulseA.state);
const restored = Engine.restore(checkpoint);
assert.equal(restored.worldDigest, pulseA.state.worldDigest);
checkpoint.world.goal = 'tampered';
assert.throws(() => Engine.restore(checkpoint), /digest mismatch/);

console.log('experiment-world selftest: PASS - open artifact kinds, deterministic replay, declared-resource hold, allowlisted authority membrane, resealed evidence, frozen content, observer immutability, explicit checkpoint');
