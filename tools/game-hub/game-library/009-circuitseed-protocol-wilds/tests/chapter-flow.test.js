'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const missions = require('../data/missions.json');
const { remove, runtimeWithSession } = require('./helpers');

function recordObjectives(system, session, objectives) {
  let result = null;
  for (const objective of objectives) {
    const parts = objective.split(':');
    const required = /^\d+$/.test(parts.at(-1)) ? Number(parts.pop()) : 1;
    result = system.record(session, parts.join(':'), required);
  }
  return result;
}

function resolveEncounter(runtime, session, encounterId) {
  runtime.encounterSystem.start(session, encounterId);
  let turns = 0;
  const actions = ['Scan', 'Shield', 'Synchronize', 'Reroute', 'Anchor'];
  while (session.encounter.status === 'running' && turns < 160) {
    runtime.encounterSystem.apply(session, 'seat_1', actions[turns % actions.length]);
    turns += 1;
  }
  assert.equal(session.encounter.status, 'resolved');
}

test('the opening-to-Rootsignal chapter commits all ten participant and world envelopes', t => {
  const fixture = runtimeWithSession(1, ['human']);
  t.after(() => remove(fixture.root));
  const { runtime, session } = fixture;
  const actor = session.actors.seat_1;
  const committedIds = [];

  for (const expected of missions.stages) {
    const current = runtime.missionSystem.current(session);
    assert.equal(current.id, expected.id);
    let progress;

    if (current.id === 'm02-unfinished-need') {
      runtime.circuitkinSystem.recruitStarter(actor.profileId, 'trace', 'chapter-flow-test');
      actor.circuitkinId = 'trace';
    }
    if (current.id === 'm03-relayborn-route') {
      runtime.profileStore.mutate(actor.profileId, profile => {
        profile.inventory.materials['conductive-filament'] = 2;
        profile.inventory.materials['machine-moss'] = 1;
      });
    }
    if (current.id === 'm05-corewild-breach') resolveEncounter(runtime, session, 'corewild-breach');
    if (current.id === 'm06-workbench') {
      runtime.economySystem.craft(actor.profileId, 'service-kit');
      runtime.economySystem.chooseBusiness(actor.profileId, 'repair');
    }
    if (current.id === 'm07-first-order') {
      runtime.economySystem.setOpen(actor.profileId, true);
      runtime.economySystem.fulfill(actor.profileId, session.worldId, 'order-service');
      session.worldRuntime = runtime.worldStore.get(session.worldId);
    }
    if (current.id === 'm08-world-response') progress = runtime.missionSystem.resolveDynamic(session, 'isolate');
    else if (current.id === 'm09-shared-pulse') progress = runtime.missionSystem.cooperativePulse(session, 'seat_1');
    else {
      if (current.id === 'm10-rootsignal') resolveEncounter(runtime, session, 'rootsignal-fracture');
      progress = recordObjectives(runtime.missionSystem, session, current.objectives);
    }

    assert.equal(progress.complete, true, current.id + ' did not complete');
    const envelope = runtime.missionSystem.commitEnvelope(session, runtime.missionSystem.createEnvelope(session));
    assert.equal(envelope.commits.participants[actor.profileId].status, 'committed');
    assert.equal(envelope.commits.world.status, 'committed');
    committedIds.push(envelope.missionId);
  }

  const world = runtime.worldStore.get(session.worldId);
  const profile = runtime.profileStore.get(actor.profileId);
  assert.deepEqual(committedIds, missions.stages.map(stage => stage.id));
  assert.deepEqual(world.story.completedStages, committedIds);
  assert.equal(world.story.stageIndex, 10);
  assert.equal(world.story.rootSignalState, 'heard-with-conflict-preserved');
  assert.equal(world.instability.core, 30);
  assert.equal(profile.receipts.filter(receipt => receipt.startsWith('mission:')).length, 10);
  assert.ok(profile.achievements.includes('rootsignal-witness'));
  assert.equal(session.ledger.validate().ok, true);

  const result = runtime.sessionManager.end({ chapter: 1, returnedTo: 'Lumen Yard' });
  assert.equal(result.ledger.ok, true);
  assert.equal(result.ledger.count, session.ledger.entries.length);
  assert.equal(session.ledger.entries.at(-1).type, 'session-end');
});
