'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { interactWithCityLife } = require('../server/city-life-system');
const {
  collectCombatDrop,
  gearSummaryForActor,
  startCombatDrill,
  syncActorGearStats,
  updateCombatGear,
} = require('../server/combat-gear-system');
const { createHostileNpc } = require('../server/npc-factory');
const { updateNpcs } = require('../server/npc-system');
const { applyActorDamage, applyNpcDamage, spawnProjectile } = require('../server/projectile-system');
const { applyGroupSaveToWorld, createGroupSaveSnapshot } = require('../server/group-save-store');

const ROOT = path.join(__dirname, '..');

function makeWorld() {
  return createWorldState({
    projectRoot: ROOT,
    players: [{ actorId: 'actor-1', seatId: 'seat_1', slot: 1, displayName: 'Mike', controllerType: 'human', partyId: 'party_a' }],
  });
}

function buyArmoryOption(world, index) {
  const actor = world.actors['actor-1'];
  actor.position = { x: 6240, y: 4190 };
  if (!world.cityLife.menus[actor.id]) interactWithCityLife(world, actor);
  world.cityLife.menus[actor.id].selectedIndex = index;
  return interactWithCityLife(world, actor);
}

test('Armory purchases create real equipped weapons, ammo, armor and boots', () => {
  const world = makeWorld(), actor = world.actors['actor-1'];
  actor.walletCents = 30000;
  const weapon = buyArmoryOption(world, 0);
  assert.equal(weapon.ok, true);
  assert.equal(actor.inventory.equipment.ranged.metadata.gearKey, 'pulseRepeater');
  assert.equal(actor.inventory.equipment.ammo.quantity, 48);
  assert.equal(actor.cityUpgrades.weaponTier, 1);
  assert.equal(actor.walletCents, 27500);

  const armor = buyArmoryOption(world, 4);
  assert.equal(armor.ok, true);
  assert.equal(actor.inventory.equipment.body.metadata.gearKey, 'streetWeave');
  assert.equal(actor.maxHealth, 125);
  assert.equal(actor.gearSummary.damageReduction, 0.12);

  const boots = buyArmoryOption(world, 6);
  assert.equal(boots.ok, true);
  assert.equal(actor.inventory.equipment.shoes.metadata.gearKey, 'kineticBoots');
  assert.equal(actor.gearSummary.moveSpeedMultiplier, 1.12);
});

test('three Armory guns produce distinct host-owned projectile profiles', () => {
  const world = makeWorld(), actor = world.actors['actor-1'];
  actor.walletCents = 50000;
  actor.facing = { x: 1, y: 0 };
  buyArmoryOption(world, 0);
  delete world.cityLife.menus[actor.id]; actor.cityMenuOpen = false;
  let shot = spawnProjectile(world, actor);
  assert.equal(shot.damage, 7);
  assert.equal(shot.visualStyle, 'repeater');
  assert.equal(Math.round(Math.hypot(shot.velocity.x, shot.velocity.y)), 430);

  world.projectiles = {}; world.tick = actor.nextAttackTick;
  buyArmoryOption(world, 1);
  delete world.cityLife.menus[actor.id]; actor.cityMenuOpen = false;
  shot = spawnProjectile(world, actor);
  assert.equal(shot.damage, 4);
  assert.equal(shot.visualStyle, 'scatter');
  assert.equal(Object.keys(world.projectiles).length, 3);

  world.projectiles = {}; world.tick = actor.nextAttackTick;
  buyArmoryOption(world, 2);
  delete world.cityLife.menus[actor.id]; actor.cityMenuOpen = false;
  shot = spawnProjectile(world, actor);
  assert.equal(shot.damage, 10);
  assert.equal(shot.visualStyle, 'arc');
  assert.equal(shot.pierceRemaining, 1);
});

test('equipped armor visibly raises health and actually mitigates host damage', () => {
  const world = makeWorld(), actor = world.actors['actor-1'];
  actor.walletCents = 10000;
  buyArmoryOption(world, 4);
  actor.shield = 0;
  actor.health = actor.maxHealth;
  const enemy = createHostileNpc({ id: 'armor-test-enemy', role: 'sapper', position: { x: actor.position.x + 30, y: actor.position.y } });
  const result = applyActorDamage(world, enemy, actor, {
    id: 'armor-test-hit', ownerNpcId: enemy.id, damage: 10, channel: 'projectileDamage', velocity: { x: -100, y: 0 },
  });
  assert.equal(result.rawDamage, 10);
  assert.equal(result.damage, 8);
  assert.equal(result.armorAbsorbed, 2);
  assert.equal(actor.health, 117);
});

test('rival roles drop deterministic pickups that heal, refill or equip persistent gear', () => {
  const world = makeWorld(), actor = world.actors['actor-1'];
  actor.position = { x: 6200, y: 4200 };
  const blocker = createHostileNpc({ id: 'loot-blocker', role: 'blocker', position: { ...actor.position }, source: 'mission' });
  world.npcs[blocker.id] = blocker;
  applyNpcDamage(world, actor, blocker, { id: 'loot-hit', damage: 50, channel: 'projectileDamage', velocity: { x: 1, y: 0 } });
  assert.equal(Object.values(world.gearDrops).length, 1);
  const collected = collectCombatDrop(world, actor);
  assert.equal(collected.ok, true);
  assert.equal(actor.inventory.equipment.body.metadata.gearKey, 'rivalGuardVest');
  assert.equal(actor.maxHealth, 118);
  assert.equal(world.combatGear.counters.dropsCollected, 1);
});

test('mixed-role combat drill is repeatable, optional and rewards a completed clear', () => {
  const world = makeWorld(), actor = world.actors['actor-1'];
  actor.position = { x: 6240, y: 4190 };
  const before = actor.walletCents;
  const started = startCombatDrill(world, actor);
  assert.equal(started.ok, true);
  assert.deepEqual(started.enemyIds.map((id) => world.npcs[id].role).sort(), ['blocker', 'rusher', 'sapper', 'skirmisher']);
  const second = startCombatDrill(world, actor);
  assert.equal(second.ok, false);
  started.enemyIds.forEach((id) => { world.npcs[id].alive = false; });
  updateCombatGear(world);
  assert.equal(world.combatGear.drills.party_a.status, 'complete');
  assert.equal(actor.walletCents, before + 800);
  assert.equal(world.combatGear.counters.drillsCompleted, 1);
});

test('enemy roles expose different telegraphs, charge, burst and slow payloads', () => {
  const world = makeWorld(), actor = world.actors['actor-1'];
  actor.position = { x: 6200, y: 4200 };
  for (const npc of Object.values(world.npcs)) if (npc.hostile) npc.alive = false;

  const rusher = createHostileNpc({ id: 'role-rusher', role: 'rusher', position: { x: actor.position.x + 25, y: actor.position.y }, source: 'mission' });
  world.npcs[rusher.id] = rusher;
  updateNpcs(world, 1 / 30);
  assert.equal(rusher.telegraph.kind, 'charge');
  world.tick = rusher.pendingAttack.executeAtTick;
  updateNpcs(world, 1 / 30);
  assert.equal(rusher.state, 'charge');

  rusher.alive = false;
  const skirmisher = createHostileNpc({ id: 'role-skirmisher', role: 'skirmisher', position: { x: actor.position.x + 100, y: actor.position.y }, source: 'mission' });
  world.npcs[skirmisher.id] = skirmisher;
  updateNpcs(world, 1 / 30);
  assert.equal(skirmisher.telegraph.kind, 'burst');
  world.tick = skirmisher.pendingAttack.executeAtTick;
  updateNpcs(world, 1 / 30);
  assert.equal(skirmisher.burstShotsRemaining, 1);
  const firstBurstCount = Object.keys(world.projectiles).length;
  world.tick = skirmisher.nextBurstTick;
  updateNpcs(world, 1 / 30);
  assert.equal(Object.keys(world.projectiles).length, firstBurstCount + 1);

  skirmisher.alive = false; world.projectiles = {};
  const sapper = createHostileNpc({ id: 'role-sapper', role: 'sapper', position: { x: actor.position.x + 100, y: actor.position.y }, source: 'mission' });
  world.npcs[sapper.id] = sapper;
  updateNpcs(world, 1 / 30);
  assert.equal(sapper.telegraph.kind, 'slow-orb');
  world.tick = sapper.pendingAttack.executeAtTick;
  updateNpcs(world, 1 / 30);
  const orb = Object.values(world.projectiles)[0];
  assert.equal(orb.visualStyle, 'sapper-orb');
  assert.equal(orb.slowTicks, 45);
});

test('gear is an inventory item and survives the existing group-save boundary', () => {
  const world = makeWorld(), actor = world.actors['actor-1'];
  actor.walletCents = 20000;
  buyArmoryOption(world, 0);
  buyArmoryOption(world, 4);
  const save = createGroupSaveSnapshot(world, 1, { now: '2026-08-09T00:00:00.000Z', buildVersion: 'combat-gear-test' });
  const restored = makeWorld();
  applyGroupSaveToWorld(restored, save);
  syncActorGearStats(restored.actors['actor-1']);
  const summary = gearSummaryForActor(restored.actors['actor-1']);
  assert.equal(summary.weapon.gearKey, 'pulseRepeater');
  assert.equal(summary.body.gearKey, 'streetWeave');
  assert.equal(restored.actors['actor-1'].maxHealth, 125);
});

test('shared renderer declares animated low-graphics gear, drops and role telegraphs', () => {
  const renderer = fs.readFileSync(path.join(ROOT, 'client', 'game', 'rendering', 'entity-renderer.js'), 'utf8');
  const scene = fs.readFileSync(path.join(ROOT, 'client', 'game', 'scenes', 'CityScene.js'), 'utf8');
  assert.match(renderer, /drawCombatDrops\(ctx, drops\)/);
  assert.match(renderer, /weapon\.visualStyle === 'scatter'/);
  assert.match(renderer, /npc\.telegraph\?\.targetPosition/);
  assert.match(renderer, /shot\.visualStyle === 'sapper-orb'/);
  assert.match(scene, /drawCombatDrops\(ctx, world\.gearDrops\)/);
});
