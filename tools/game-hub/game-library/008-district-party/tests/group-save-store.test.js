'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { SessionManager } = require('../server/session-manager');
const { advanceWorld } = require('../server/world-loop');
const {
  GROUP_SAVE_SLOT_COUNT,
  GroupSaveStore,
  createGroupSaveSnapshot,
  validateGroupSave,
} = require('../server/group-save-store');
const { pickupItem } = require('../server/inventory-system');
const { terminalCentre } = require('../server/group-save-system');

const projectRoot = path.join(__dirname, '..');

function tempStore(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-group-save-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return new GroupSaveStore({ storageDirectory: root });
}

function managerWithStore(store, players) {
  const manager = new SessionManager({ projectRoot, groupSaveStore: store });
  const launch = manager.createSession({ players });
  return { manager, launch, session: manager.getSession(launch.sessionId) };
}

function humans(count) {
  return Array.from({ length: count }, (_, index) => ({
    slot: index + 1,
    displayName: `Human ${index + 1}`,
    controllerType: 'human',
  }));
}

function markConnected(session, slots) {
  for (const actor of Object.values(session.world.actors)) {
    actor.connected = slots.includes(actor.slot);
    actor.lastInputAt = actor.connected ? Date.now() : 0;
  }
  for (const player of session.players) player.connected = slots.includes(player.slot);
}

test('local group save store exposes exactly nine empty slots without accounts or profiles', (t) => {
  const store = tempStore(t);
  const catalog = store.catalog();
  assert.equal(GROUP_SAVE_SLOT_COUNT, 9);
  assert.equal(catalog.length, 9);
  assert.deepEqual(catalog.map((entry) => entry.slot), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(catalog.every((entry) => entry.status === 'empty'));
});

test('save snapshot persists per-slot funds and inventory but omits names, controller tokens and transient health', (t) => {
  const store = tempStore(t);
  const { session } = managerWithStore(store, humans(4));
  const p1 = session.world.actors['actor-seat-1'];
  p1.walletCents = 12_345;
  p1.health = 7;
  p1.shield = 0;
  session.world.economy.partyFunds.party_a = 54_321;
  session.world.rivalGang.pressure = 23;
  const pickup = pickupItem(p1.inventory, {
    id: 'save-test-hat', displayName: 'Saved Hat', equipSlot: 'hat',
  });
  assert.equal(pickup.ok, true);
  const snapshot = createGroupSaveSnapshot(session.world, 1, { buildVersion: 'test-build', now: '2026-07-19T12:00:00.000Z' });
  assert.equal(validateGroupSave(snapshot, 1).ok, true);
  store.writeSlot(1, snapshot);
  const loaded = store.readSlot(1);
  assert.equal(loaded.status, 'ready');
  assert.equal(loaded.save.roster.seatCount, 4);
  assert.deepEqual(loaded.save.roster.seatSlots, [1, 2, 3, 4]);
  assert.equal(loaded.save.perSeat[0].walletCents, 12_345);
  assert.equal(loaded.save.perSeat[0].inventory.equipment.hat.id, 'save-test-hat');
  assert.equal(loaded.save.group.partyFunds.party_a, 54_321);
  assert.equal(loaded.save.group.rivalGang.pressure, 23);
  const serialized = fs.readFileSync(store.slotPath(1), 'utf8');
  assert.doesNotMatch(serialized, /Human 1/);
  assert.doesNotMatch(serialized, /seat-token|hostToken|controllerType|adapterId/);
  assert.doesNotMatch(serialized, /"health"|"shield"|"position"/);
});

test('an occupied save slot keeps its original roster and rejects a different player count', (t) => {
  const store = tempStore(t);
  const first = managerWithStore(store, humans(4)).session;
  store.writeSlot(2, createGroupSaveSnapshot(first.world, 2));
  const smaller = managerWithStore(store, humans(3)).session;
  assert.throws(
    () => store.writeSlot(2, createGroupSaveSnapshot(smaller.world, 2)),
    (error) => error.code === 'SAVE_ROSTER_LOCKED',
  );
  assert.equal(store.readSlot(2).save.roster.seatCount, 4);
});

test('malformed or hand-corrupted saves are listed as corrupt and never partially loaded', (t) => {
  const store = tempStore(t);
  fs.mkdirSync(store.directory, { recursive: true });
  fs.writeFileSync(store.slotPath(3), '{"broken":', 'utf8');
  assert.deepEqual(store.readSlot(3), { slot: 3, status: 'corrupt', error: 'malformed-save-json' });
  assert.equal(store.catalog()[2].status, 'corrupt');
});

test('loading preserves connected external seats and fills only missing saved seats with Host AI', (t) => {
  const store = tempStore(t);
  const { manager, session } = managerWithStore(store, humans(4));
  session.world.actors['actor-seat-1'].walletCents = 11_111;
  session.world.actors['actor-seat-2'].walletCents = 22_222;
  session.world.actors['actor-seat-3'].walletCents = 33_333;
  session.world.actors['actor-seat-4'].walletCents = 44_444;
  session.world.economy.partyFunds.party_a = 88_888;
  store.writeSlot(4, createGroupSaveSnapshot(session.world, 4));
  const saved = store.readSlot(4).save;
  const oldSeatOneToken = session.seatTokens.seat_1;
  const oldSeatThreeToken = session.seatTokens.seat_3;
  markConnected(session, [1, 3]);

  const result = manager.loadGroupSaveIntoSession(session, saved);
  assert.equal(result.ok, true);
  assert.equal(result.connectedExternalSeats, 2);
  assert.equal(result.hostAiFilledSeats, 2);
  assert.deepEqual(session.players.map((player) => player.controllerType), ['human', 'ai', 'human', 'ai']);
  assert.deepEqual(session.controllerLinks.map((link) => link.seatId), ['seat_1', 'seat_3']);
  assert.equal(session.seatTokens.seat_1, oldSeatOneToken);
  assert.equal(session.seatTokens.seat_3, oldSeatThreeToken);
  assert.equal(session.seatTokens.seat_2, undefined);
  assert.equal(session.seatTokens.seat_4, undefined);
  assert.equal(session.world.actors['actor-seat-1'].displayName, 'Human 1');
  assert.equal(session.world.actors['actor-seat-2'].displayName, 'Group AI 2');
  assert.equal(session.world.actors['actor-seat-2'].controller, 'ai');
  assert.equal(session.world.actors['actor-seat-2'].aiState, 'follow_party');
  assert.equal(session.world.actors['actor-seat-4'].controller, 'ai');
  assert.equal(session.world.actors['actor-seat-4'].walletCents, 44_444);
  assert.equal(session.world.actors['actor-seat-1'].health, 100, 'transient injury is not restored');
  assert.equal(session.world.actors['actor-seat-1'].shield, 1, 'load starts at the base shield default');
  assert.equal(session.world.economy.partyFunds.party_a, 88_888);
  assert.equal(session.world.loadedGroupSave.slot, 4);
});

test('a connected seat outside the fixed save roster blocks load instead of silently dropping a player', (t) => {
  const store = tempStore(t);
  const twoSeatSession = managerWithStore(store, humans(2)).session;
  store.writeSlot(5, createGroupSaveSnapshot(twoSeatSession.world, 5));
  const saved = store.readSlot(5).save;
  const { manager, session } = managerWithStore(store, humans(3));
  markConnected(session, [1, 3]);
  assert.throws(
    () => manager.loadGroupSaveIntoSession(session, saved),
    (error) => error.code === 'SAVE_CONNECTED_ROSTER_MISMATCH',
  );
  assert.equal(Object.keys(session.world.actors).length, 3, 'failed load leaves current world untouched');
});

test('Party House computer pauses the city, requires double confirmation, and saves through the host', (t) => {
  const store = tempStore(t);
  const { manager, session } = managerWithStore(store, humans(2));
  markConnected(session, [1]);
  const actor = session.world.actors['actor-seat-1'];
  const centre = terminalCentre(session.world.groupSaveComputer.terminal);
  actor.position = { ...centre };
  const npc = Object.values(session.world.npcs)[0];
  const npcBefore = { ...npc.position };

  actor.input.action = true;
  advanceWorld(session.world);
  assert.equal(session.world.groupSaveComputer.open, true);
  assert.deepEqual(npc.position, npcBefore, 'world AI is paused as soon as the group computer opens');

  actor.input.action = true;
  advanceWorld(session.world);
  assert.deepEqual(session.world.groupSaveComputer.confirmation, {
    operation: 'save', slot: 1, armedAtTick: 2, expiresAtTick: 152,
  });
  actor.input.action = true;
  advanceWorld(session.world);
  assert.equal(session.world.groupSaveComputer.pendingOperation.operation, 'save');
  const saved = manager.processPendingGroupSaveOperation(session);
  assert.equal(saved.ok, true);
  assert.equal(store.readSlot(1).status, 'ready');
  assert.equal(store.readSlot(1).save.roster.seatCount, 2);
  assert.equal(session.world.groupSaveComputer.catalog.length, 9);
  assert.equal(session.world.groupSaveComputer.catalog[0].status, 'ready');
});

test('all eight saved seat records initialise and restore without P1-P4-only assumptions', (t) => {
  const store = tempStore(t);
  const { manager, session } = managerWithStore(store, humans(8));
  session.world.actors['actor-seat-8'].walletCents = 98_765;
  session.world.economy.partyFunds.party_b = 76_543;
  store.writeSlot(9, createGroupSaveSnapshot(session.world, 9));
  markConnected(session, [1, 5]);
  const result = manager.loadGroupSaveIntoSession(session, store.readSlot(9).save);
  assert.equal(result.seatCount, 8);
  assert.equal(result.hostAiFilledSeats, 6);
  assert.equal(Object.keys(session.world.actors).length, 8);
  assert.equal(session.world.actors['actor-seat-8'].walletCents, 98_765);
  assert.equal(session.world.actors['actor-seat-8'].partyId, 'party_b');
  assert.equal(session.world.economy.partyFunds.party_b, 76_543);
});
