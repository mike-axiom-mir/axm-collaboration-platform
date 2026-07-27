'use strict';

const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { serializeWorldState } = require('../server/display-state');
const {
  activeDeliveryZones,
  applyResultChoice,
  claimPackage,
  completeMission,
  deliverPackage,
  layoutsFor,
  openMissionBoard,
  reserveMissionLayout,
  startMission,
  updateMission,
} = require('../server/mission-system');
const { collidesObstacle } = require('../server/spatial-index');
const { createWorldState } = require('../server/world-state');

const projectRoot = path.join(__dirname, '..');
const missionModes = ['supply_sweep', 'hold_relay', 'courier_chaos', 'chaos_call'];

function makeWorld(count = 8) {
  return createWorldState({
    projectRoot,
    players: Array.from({ length: count }, (_, index) => ({
      actorId: `actor-seat-${index + 1}`,
      seatId: `seat_${index + 1}`,
      slot: index + 1,
      displayName: `P${index + 1}`,
      controllerType: 'human',
      partyId: index < 4 ? 'party_a' : 'party_b',
    })),
  });
}

test('all four casual mission modes expose four data-driven Tilburg locations', () => {
  const world = makeWorld(1);
  for (const mode of missionModes) {
    const layouts = layoutsFor(world, mode);
    assert.equal(layouts.length, 4, `${mode} has four layouts`);
    assert.equal(new Set(layouts.map((layout) => layout.id)).size, 4, `${mode} layout IDs are unique`);
    assert.equal(new Set(layouts.map((layout) => `${layout.start.x}:${layout.start.y}`)).size, 4, `${mode} starts are distinct`);
    assert.ok(layouts.every((layout) => layout.label && layout.twist), `${mode} layouts explain their location and twist`);
  }
  assert.equal(world.staticMap.mission.catalog.layoutSelection, 'host-shuffled-route-deck-no-immediate-repeat');
});

test('host route deck visits every layout before reshuffling and never immediately repeats', () => {
  const world = makeWorld(1);
  world.missionDirector.seed = 0x12345678;
  for (const mode of missionModes) {
    const firstDeck = Array.from({ length: 4 }, () => reserveMissionLayout(world, mode));
    assert.equal(new Set(firstDeck.map((layout) => layout.id)).size, 4, `${mode} first deck is complete`);
    const next = reserveMissionLayout(world, mode);
    assert.notEqual(next.id, firstDeck.at(-1).id, `${mode} avoids a deck-boundary repeat`);
  }
  assert.equal(world.missionDirector.totalRuns, missionModes.length * 5);
});

test('every mission layout safely places eight actors and its host-owned objectives', () => {
  const world = makeWorld(8);
  for (const mode of missionModes) {
    for (const layout of layoutsFor(world, mode)) {
      startMission(world, mode, { layoutId: layout.id });
      assert.equal(world.mission.layout.id, layout.id);
      assert.match(world.mission.title, new RegExp(layout.label));
      for (const actor of Object.values(world.actors)) {
        assert.equal(collidesObstacle(world, actor.position, actor.radius), false, `${mode}/${layout.id}/${actor.id} is open`);
      }
      for (const item of world.mission.packages || []) {
        assert.equal(collidesObstacle(world, item.position, 8), false, `${mode}/${layout.id}/${item.id} is open`);
      }
      if (world.mission.relay) assert.equal(collidesObstacle(world, world.mission.relay.position, 14), false, `${layout.id} relay is open`);
      for (const npc of Object.values(world.npcs).filter((entry) => entry.source === 'mission')) {
        assert.equal(collidesObstacle(world, npc.position, npc.radius), false, `${mode}/${layout.id}/${npc.id} is open`);
      }
    }
  }
});

test('supply layouts vary crate geometry and add only their declared light guards', () => {
  const world = makeWorld(4);
  const signatures = new Set();
  for (const layout of layoutsFor(world, 'supply_sweep')) {
    startMission(world, 'supply_sweep', { layoutId: layout.id });
    const relative = world.mission.packages.map((item) => `${Math.round(item.position.x - world.mission.missionStart.x)}:${Math.round(item.position.y - world.mission.missionStart.y)}`).join('|');
    signatures.add(relative);
    assert.equal(world.mission.guardCount, layout.guardCount);
    assert.equal(Object.values(world.npcs).filter((npc) => npc.source === 'mission').length, layout.guardCount);
  }
  assert.equal(signatures.size, 4, 'each supply location has a distinct crate pattern');
});

test('courier layouts enforce only their active delivery zones', () => {
  const world = makeWorld(2);
  startMission(world, 'courier_chaos', { layoutId: 'central-depot-dispatch' });
  assert.deepEqual(world.mission.activeDeliveryZoneIds, ['delivery-centre', 'delivery-north', 'delivery-east', 'delivery-south']);
  assert.deepEqual(
    activeDeliveryZones(world).map((zone) => zone.id).sort(),
    [...world.mission.activeDeliveryZoneIds].sort(),
  );
  const actor = world.actors['actor-seat-1'];
  const item = world.mission.packages[0];
  actor.position = { ...item.position };
  assert.equal(claimPackage(world, actor.id, item.id).ok, true);
  const inactive = world.staticMap.mission.deliveryZones.find((zone) => zone.id === 'delivery-west');
  actor.position = { x: inactive.x + 10, y: inactive.y + 10 };
  assert.equal(deliverPackage(world, actor.id, inactive.id).reason, 'not-ready');
  const active = world.mission.deliveryZones[0];
  actor.position = { x: active.x + 10, y: active.y + 10 };
  assert.equal(deliverPackage(world, actor.id, active.id).ok, true);
});

test('Replay mission reserves a different location while preserving the results break', () => {
  const world = makeWorld(1);
  world.missionDirector.seed = 0x4567;
  const first = startMission(world, 'hold_relay').layout.id;
  completeMission(world, true, 'test-complete');
  assert.equal(world.mission.status, 'results');
  const result = applyResultChoice(world, 'replay', 'actor-seat-1');
  assert.equal(result.kind, 'mission-countdown');
  assert.notEqual(world.mission.pendingLayout.id, first);
  world.tick = world.mission.countdownEndsAtTick;
  updateMission(world);
  assert.equal(world.mission.status, 'active');
  assert.equal(world.mission.layout.id, result.layout.id);
});

test('shared state names routes and route counts without exposing the host deck', () => {
  const world = makeWorld(1);
  const actor = world.actors['actor-seat-1'];
  openMissionBoard(world, actor);
  const session = { id: 'session-test', roomCode: 'AXM1', status: 'running', world };
  const boardPayload = serializeWorldState(session, 'party_a');
  assert.ok(boardPayload.world.mission.menuOptions.slice(0, 4).every((entry) => entry.label.includes('4 locations')));
  startMission(world, 'courier_chaos', { layoutId: 'north-ring-dispatch' });
  const activePayload = serializeWorldState(session, 'party_a');
  assert.equal(activePayload.world.mission.layout.label, 'North Ring Dispatch');
  assert.match(activePayload.world.mission.hint, /North Ring Dispatch/);
  assert.equal(JSON.stringify(activePayload).includes('missionDirector'), false);
});

test('shared renderer visibly marks active dispatch and drop zones', () => {
  const renderer = fs.readFileSync(path.join(projectRoot, 'client/game/rendering/entity-renderer.js'), 'utf8');
  const hud = fs.readFileSync(path.join(projectRoot, 'client/game/ui/hud.js'), 'utf8');
  assert.match(renderer, /ACTIVE DISPATCH/);
  assert.match(renderer, /DROP ·/);
  assert.match(renderer, /mission\.deliveryZones/);
  assert.match(hud, /host-owned route deck/);
  assert.match(hud, /mission\.layout\?\.label/);
});
