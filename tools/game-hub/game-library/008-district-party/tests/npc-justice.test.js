'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { applyNpcDamage } = require('../server/projectile-system');
const { triggerVoluntaryChaos, updateJustice } = require('../server/justice-system');

function world() {
  return createWorldState({
    projectRoot: path.join(__dirname, '..'),
    players: [{ actorId: 'actor-seat-1', seatId: 'seat_1', slot: 1, displayName: 'P1', controllerType: 'human', partyId: 'party_a' }],
  });
}

test('citizens receive deterministic varied health from 20 through 50 and no gore state', () => {
  const first = world();
  const second = world();
  const health = Object.values(first.npcs).filter((npc) => npc.kind === 'civilian').map((npc) => npc.maxHealth);
  assert.ok(health.every((value) => value >= 20 && value <= 50));
  assert.ok(new Set(health).size > 4, 'civilian health is varied');
  assert.deepEqual(health, Object.values(second.npcs).filter((npc) => npc.kind === 'civilian').map((npc) => npc.maxHealth));
  assert.ok(Object.values(first.npcs).every((npc) => !('gore' in npc)));
});

test('forgiving justice responds to accumulated harm and recency rather than kill stars', () => {
  const state = world();
  const attacker = state.actors['actor-seat-1'];
  const civilians = Object.values(state.npcs).filter((npc) => npc.kind === 'civilian');
  attacker.position = { x: 500, y: 500 };
  civilians.forEach((civilian, index) => { civilian.position = { x: 520 + index * 18, y: 500 }; });
  const hit = (civilian, id) => applyNpcDamage(state, attacker, civilian, { id, damage: 5, channel: 'projectileDamage' });
  hit(civilians[0], 'accidental-hit');
  assert.equal(state.justice.stage, 'caution');
  assert.ok(state.justice.heat < 45, 'one accidental hit does not dispatch justice');
  while (civilians[0].alive) hit(civilians[0], `first-${civilians[0].health}`);
  assert.ok(state.justice.heat < 45, 'one civilian down remains below the response threshold');
  while (civilians[1].alive) hit(civilians[1], `second-${civilians[1].health}`);
  assert.ok(['response', 'pursuit'].includes(state.justice.stage));
  assert.equal(state.justice.civilianDowns, 2);
});

test('voluntary chaos immediately requests pursuit and spawns a bounded justice team', () => {
  const state = world();
  triggerVoluntaryChaos(state);
  assert.equal(state.justice.stage, 'pursuit');
  for (const tick of [30, 60, 90, 120, 150]) {
    state.tick = tick;
    updateJustice(state, 1 / 30);
  }
  assert.equal(Object.values(state.npcs).filter((npc) => npc.source === 'justice').length, 4);
});

test('Neon Rivals keep their low-number roles while the optional territory system stays inactive in co-op', () => {
  const state = world();
  const rivals = Object.values(state.npcs).filter((npc) => npc.source === 'city');
  assert.deepEqual(rivals.map((npc) => npc.role), ['rusher', 'skirmisher', 'blocker']);
  assert.deepEqual(rivals.map((npc) => [npc.maxHealth, npc.damage]), [[10, 2], [10, 2], [20, 3]]);
  assert.equal(state.rivalGang.name, 'Neon Rivals');
  assert.equal(state.rivalGang.territorySystemImplemented, true);
  assert.equal(state.rivalGang.territoryModeActive, false);
  assert.equal(state.territory.enabled, false);
});
