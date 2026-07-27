'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const Holodeck = require('./index');
const example = require('./examples/echo-atrium.world.json');

if (process.argv.includes('--digest-only')) {
  process.stdout.write(Holodeck.Compiler.compile(example).planDigest);
  process.exit(0);
}

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function intent(actor, sequence, kind, payload) {
  return { schema: Holodeck.Intents.INTENT_SCHEMA, actor, sequence, kind, payload: payload || {} };
}

function run() {
  const validation = Holodeck.Validator.validate(example);
  check(validation.ok && validation.summary.entities === 10, 'example satisfies the canonical world validator');
  check(validation.summary.actions === 1, 'example exposes one bounded interaction');

  const duplicate = Holodeck.Core.clone(example);
  duplicate.entities.push(Holodeck.Core.clone(duplicate.entities[0]));
  check(!Holodeck.Validator.validate(duplicate).ok, 'duplicate entity identifiers are rejected');
  const missingTarget = Holodeck.Core.clone(example);
  missingTarget.entities.find(item => item.id === 'beacon-core').interaction.actions[0].effects[0].targetEntityId = 'missing-entity';
  check(!Holodeck.Validator.validate(missingTarget).ok, 'missing interaction targets are rejected');

  const firstPlan = Holodeck.Compiler.compile(example);
  const secondPlan = Holodeck.Compiler.compile(example);
  check(Holodeck.Core.same(firstPlan, secondPlan), 'repeated compilation is deep-equal');
  const reordered = Holodeck.Core.clone(example);
  reordered.entities.reverse(); reordered.environment.lights.reverse(); reordered.spawnPoints.reverse();
  const reorderedPlan = Holodeck.Compiler.compile(reordered);
  check(firstPlan.planDigest === reorderedPlan.planDigest && Holodeck.Core.same(firstPlan, reorderedPlan), 'set-like source array order cannot change the plan');
  const changed = Holodeck.Core.clone(example); changed.title = 'Changed semantic world';
  check(firstPlan.planDigest !== Holodeck.Compiler.compile(changed).planDigest, 'semantic world changes alter the plan digest');
  check(firstPlan.coordinateProjection.note.includes('disposable projection'), 'compiled plan keeps canonical and render coordinates distinct');
  check(firstPlan.truth.vrAdapterImplemented === false && firstPlan.truth.hologramHardwareImplemented === false, 'compiler makes no future substrate claim');
  const fresh = spawnSync(process.execPath, [path.resolve(__filename), '--digest-only'], { encoding: 'utf8' });
  check(fresh.status === 0 && fresh.stdout.trim() === firstPlan.planDigest, 'fresh process produces the same plan digest');

  const human = { id: 'mike', kind: 'human', name: 'Mike' };
  const machine = { id: 'deck-ai', kind: 'machine', name: 'Deck AI' };
  const baseState = Holodeck.State.create(firstPlan);
  check(Holodeck.State.verify(firstPlan, baseState).ok, 'initial deck state verifies');
  const humanMove = Holodeck.Intents.dispatch(firstPlan, baseState, intent(human, 1, 'MOVE', { forward: 1, meters: 0.8 }));
  const machineMove = Holodeck.Intents.dispatch(firstPlan, baseState, intent(machine, 1, 'MOVE', { forward: 1, meters: 0.8 }));
  check(Holodeck.Core.same(humanMove.state.player.position, machineMove.state.player.position), 'human and machine movement use identical transition rules');
  check(humanMove.receipt.status === 'APPLIED' && machineMove.receipt.status === 'APPLIED', 'both actor kinds receive the same applied status');
  let invalidActorRejected = false;
  try { Holodeck.Intents.dispatch(firstPlan, baseState, intent({ id: 'ghost', kind: 'superuser' }, 1, 'MOVE', { forward: 1 })); } catch (_) { invalidActorRejected = true; }
  check(invalidActorRejected, 'undeclared actor kinds receive no hidden powers');

  const tooFar = Holodeck.Intents.dispatch(firstPlan, baseState, intent(human, 1, 'INTERACT', { entityId: 'beacon-core', actionId: 'awaken' }));
  check(tooFar.receipt.status === 'REFUSED_RANGE', 'interaction outside declared range is refused');
  let journey = baseState;
  [1, 2, 3].forEach(sequence => { journey = Holodeck.Intents.dispatch(firstPlan, journey, intent(human, sequence, 'MOVE', { forward: 1, meters: 0.8 })).state; });
  check(journey.player.position[2] === 2.6, 'bounded movement reaches the beacon approach point deterministically');
  const awakened = Holodeck.Intents.dispatch(firstPlan, journey, intent(human, 4, 'INTERACT', { entityId: 'beacon-core', actionId: 'awaken' }));
  check(awakened.receipt.status === 'APPLIED', 'in-range beacon interaction is applied');
  check(awakened.state.entities['beacon-core'].active === true && awakened.state.entities['north-gate'].open === true, 'one interaction changes both declared target states');
  check(awakened.state.lastMessage.includes('northern gate is open'), 'interaction message is retained in state');
  const unavailable = Holodeck.Intents.dispatch(firstPlan, awakened.state, intent(human, 5, 'INTERACT', { entityId: 'beacon-core', actionId: 'awaken' }));
  check(unavailable.receipt.status === 'REFUSED_STATE', 'completed one-shot interaction is unavailable by declared world state');
  const replay = Holodeck.Intents.dispatch(firstPlan, awakened.state, intent(human, 4, 'INTERACT', { entityId: 'beacon-core', actionId: 'awaken' }));
  check(replay.receipt.status === 'REFUSED_REPLAY' && replay.state.revision === awakened.state.revision, 'replayed actor sequence is refused without mutation');

  const closedNearGate = Holodeck.Core.clone(baseState);
  closedNearGate.player.position = [0, 0, -10.5]; closedNearGate.player.headingDegrees = 0;
  const sealedNearGate = Holodeck.State.seal(closedNearGate);
  const gateCollision = Holodeck.Intents.dispatch(firstPlan, sealedNearGate, intent(machine, 1, 'MOVE', { forward: 1, meters: 0.8 }));
  check(gateCollision.receipt.status === 'REFUSED_COLLISION', 'closed gate collider blocks both actor kinds');
  const openNearGate = Holodeck.Core.clone(sealedNearGate); openNearGate.entities['north-gate'].open = true;
  const throughGate = Holodeck.Intents.dispatch(firstPlan, Holodeck.State.seal(openNearGate), intent(machine, 1, 'MOVE', { forward: 1, meters: 0.8 }));
  check(throughGate.receipt.status === 'APPLIED', 'world state data disables the gate collider when open');

  const frame = Holodeck.Sensor.observe(firstPlan, awakened.state, machine);
  check(frame.schema === Holodeck.Sensor.SENSOR_SCHEMA && frame.objective.status.complete, 'sensory frame reports objective completion');
  check(frame.truth.cameraPixelsObserved === false && frame.truth.proximityIsNotVision === true, 'structured observation does not pretend to be camera vision');
  check(frame.nearby.some(item => item.entityId === 'beacon-core' && item.state.active === true), 'sensory frame exposes the changed beacon state');
  check(frame.nearby.find(item => item.entityId === 'beacon-core').availableActions.length === 0, 'sensory frame hides actions made unavailable by world state');

  const snapshot = Holodeck.Persistence.create(firstPlan, awakened.state, 'Beacon awakened');
  const serialized = JSON.parse(JSON.stringify(snapshot));
  check(Holodeck.Persistence.verify(firstPlan, serialized).ok, 'snapshot survives serialization');
  const restored = Holodeck.Persistence.restore(firstPlan, serialized);
  check(Holodeck.Core.same(restored, awakened.state), 'fresh controller restore is state-equivalent');
  const tampered = Holodeck.Core.clone(serialized); tampered.payload.entities['north-gate'].open = false;
  check(!Holodeck.Persistence.verify(firstPlan, tampered).ok, 'tampered snapshot is rejected');
  const otherWorld = Holodeck.Core.clone(serialized); otherWorld.worldId = 'world.holodeck.other';
  check(!Holodeck.Persistence.verify(firstPlan, otherWorld).ok, 'cross-world snapshot is rejected');

  console.log('Holodeck kernel selftest: PASS - ' + checks + ' checks');
}

run();
