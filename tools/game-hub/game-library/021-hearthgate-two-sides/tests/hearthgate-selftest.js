#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('../runtime/game-core');

function running(mode, seed) {
  const state = Core.createState({ mode: mode || 'single', seed: seed || 21 });
  Core.startGame(state, mode || 'single');
  state.prepTime = 0;
  state.enemies.length = 0;
  state.spawnClock = 999;
  return state;
}

{
  const state = Core.createState({ mode: 'coop', seed: 21 });
  Core.startGame(state, 'coop');
  assert.strictEqual(state.playerResources[0].metal, 170, 'north starts with its own opening wallet');
  assert.strictEqual(state.playerResources[1].metal, 170, 'south starts with an equal independent wallet');
  assert.strictEqual(state.buildings.length, 8, 'each side gets four building plots');
  Core.step(state, 0.1);
  assert.strictEqual(state.time, 0, 'survival time must not advance during setup');
  assert.ok(state.prepTime < Core.CONFIG.prepSeconds, 'the visible setup countdown must advance');
}

{
  const state = running('coop');
  const northBefore = Object.assign({}, state.playerResources[0]);
  const southBefore = Object.assign({}, state.playerResources[1]);
  assert.strictEqual(Core.build(state, 0, 'forge').ok, true);
  assert.strictEqual(Core.build(state, 4, 'market').ok, true);
  assert.strictEqual(state.playerResources[0].metal, northBefore.metal - Core.BUILDING_TYPES.forge.cost, 'north building spends only north metal');
  assert.strictEqual(state.playerResources[1].metal, southBefore.metal - Core.BUILDING_TYPES.market.cost, 'south building spends only south metal');
  const beforeIncome = state.playerResources.map(wallet => Object.assign({}, wallet));
  for (let i = 0; i < 100; i += 1) Core.step(state, 0.1);
  assert.ok(state.playerResources[0].metal > beforeIncome[0].metal, 'north forge pays north wallet');
  assert.strictEqual(state.playerResources[1].metal, beforeIncome[1].metal, 'north forge does not leak metal to south');
  assert.ok(state.playerResources[1].gold > beforeIncome[1].gold, 'south market pays south wallet');
  assert.strictEqual(state.playerResources[0].gold, beforeIncome[0].gold, 'south market does not leak gold to north');
}

{
  const state = running('coop');
  const before = state.playerResources.map(wallet => wallet.metal);
  const result = Core.fortifyGate(state);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(before[0] - state.playerResources[0].metal, Math.ceil(result.cost / 2), 'north pays half of the shared gate');
  assert.strictEqual(before[1] - state.playerResources[1].metal, Math.floor(result.cost / 2), 'south pays half of the shared gate');
}

{
  const state = running('coop');
  state.nextSurgeAt = 0.1;
  Core.step(state, 0.11);
  assert.strictEqual(state.enemies.filter(enemy => enemy.kind === 'skitter').length, 2, 'surges send a fast runner down both lanes');
  assert.strictEqual(state.enemies.filter(enemy => enemy.kind === 'brute').length, 1, 'surges add an announced heavy threat');
}

{
  assert.ok(Core.buildingSummary('forge', 2).includes('metal/sec'));
  assert.ok(Core.buildingSummary('ballista', 2).includes('lane damage'));
  assert.strictEqual(Core.buildingChoiceFromVector(0, -1, 'market'), 'forge', 'wheel up chooses metal income');
  assert.strictEqual(Core.buildingChoiceFromVector(1, 0, 'forge'), 'ballista', 'wheel right chooses lane attack');
  assert.strictEqual(Core.buildingChoiceFromVector(0, 1, 'forge'), 'market', 'wheel down chooses gold income');
  assert.strictEqual(Core.buildingChoiceFromVector(-1, 0, 'forge'), 'alchemist', 'wheel left chooses breach splash');
  assert.strictEqual(Core.buildingChoiceFromVector(0.1, 0.1, 'ballista'), 'ballista', 'wheel deadzone keeps the last choice');
}

{
  const a = running('single', 99);
  const b = running('single', 99);
  for (let i = 0; i < 300; i += 1) { Core.step(a, 1 / 30); Core.step(b, 1 / 30); }
  assert.deepStrictEqual(Core.snapshot(a), Core.snapshot(b), 'the same seed and inputs must stay deterministic');
}

{
  const state = running();
  const north = Core.getTower(state, 'north');
  const oldDamage = Core.towerDamage(north.level);
  const result = Core.upgradeTower(state, 'north');
  assert.strictEqual(result.ok, true);
  assert.ok(Core.towerDamage(north.level) > oldDamage, 'gold tower upgrades must increase damage');
  assert.ok(state.resources.gold < 145, 'tower upgrade spends gold');
}

{
  const state = running();
  state.resources.metal = 500;
  const oldMax = Core.getTower(state, 'north').maxHp;
  const result = Core.fortifyGate(state);
  assert.strictEqual(result.ok, true);
  assert.ok(Core.getTower(state, 'north').maxHp > oldMax, 'gate fortification must make both halves bulkier');
  assert.strictEqual(Core.getTower(state, 'north').maxHp, Core.getTower(state, 'south').maxHp);
}

{
  const state = running();
  state.resources.metal = 500;
  const tower = Core.getTower(state, 'north');
  tower.down = true; tower.hp = 0; tower.rebuildTimer = 7;
  const quick = Core.repairOrRebuild(state, 'north');
  assert.strictEqual(quick.ok, true);
  assert.strictEqual(quick.quick, true);
  assert.strictEqual(tower.down, false);
  const quickCost = quick.cost;
  tower.down = true; tower.hp = 0; tower.rebuildTimer = 0;
  const late = Core.repairOrRebuild(state, 'north');
  assert.ok(late.cost > quickCost, 'missing the rebuild timer must make a later rebuild more expensive');
}

{
  const state = running();
  state.resources.metal = 1000;
  assert.strictEqual(Core.build(state, 0, 'forge').ok, true);
  assert.strictEqual(Core.build(state, 1, 'market').ok, true);
  const before = Object.assign({}, state.resources);
  for (let i = 0; i < 100; i += 1) Core.step(state, 0.1);
  assert.ok(state.resources.metal > before.metal, 'forge gathers metal');
  assert.ok(state.resources.gold > before.gold, 'market gathers gold');
}

{
  const state = running();
  const enemy = Core.spawnEnemy(state, 'raider', 'north');
  const normalDamage = enemy.damage;
  enemy.x = Core.WORLD.gateX;
  Core.getTower(state, 'north').down = true;
  Core.step(state, 0.05);
  assert.strictEqual(enemy.breached, true);
  assert.strictEqual(enemy.damage, normalDamage * 2, 'enemies must deal double damage after entering the gate');
  assert.ok([184, 270, 356].includes(enemy.targetY), 'breached enemies must spread onto inner routes');
}

{
  const state = running();
  const special = Core.spawnEnemy(state, 'relic', 'south');
  const before = Object.assign({}, state.resources);
  Core.damageEnemy(state, special, special.hp + 1, 'test');
  assert.strictEqual(state.stats.specialsDefeated, 1);
  assert.ok(state.resources.gold - before.gold >= 68, 'special enemy grants extra gold');
  assert.ok(state.resources.metal - before.metal >= 44, 'special enemy grants extra metal');
}

{
  assert.ok(Core.enemyHealthAt(240, 'raider') > Core.enemyHealthAt(0, 'raider') * 2, 'enemy bulk must escalate with time');
}

{
  const state = running('coop', 2121);
  state.nextSurgeAt = 9999;
  state.nextSpecialAt = 9999;
  assert.deepStrictEqual(state.chronicle.enteredChapterIds, ['ember-muster'], 'the first authored oath is announced when the run starts');
  assert.strictEqual(state.chronicle.receipts.length, 0, 'an oath is not cleared merely by entering it');
  const expectedIds = Core.SIEGE_CHAPTERS.map(chapter => chapter.id);
  for (let index = 1; index < Core.SIEGE_CHAPTERS.length; index += 1) {
    const previous = Core.SIEGE_CHAPTERS[index - 1];
    const beforeWallets = state.playerResources.map(wallet => ({ gold: wallet.gold, metal: wallet.metal }));
    state.time = index * Core.CONFIG.oathChapterSeconds - 0.05;
    state.spawnClock = 9999;
    Core.step(state, 0.1);
    assert.strictEqual(state.chronicle.currentChapterId, Core.SIEGE_CHAPTERS[index].id, `chapter ${index + 1} becomes current at its authored boundary`);
    assert.strictEqual(state.chronicle.receipts.length, index, 'each elapsed oath creates exactly one bounded receipt');
    state.playerResources.forEach((wallet, owner) => {
      assert.strictEqual(Math.round(wallet.gold - beforeWallets[owner].gold), previous.reward.gold, 'chapter gold reward reaches each active warden wallet');
      assert.strictEqual(Math.round(wallet.metal - beforeWallets[owner].metal), previous.reward.metal, 'chapter metal reward reaches each active warden wallet');
    });
    state.enemies.length = 0;
  }
  state.time = Core.CONFIG.oathCompleteAt - 0.05;
  state.spawnClock = 9999;
  Core.step(state, 0.1);
  assert.strictEqual(state.chronicle.completed, true, 'the five-oath siege closes at six minutes');
  assert.strictEqual(state.chronicle.currentChapterId, 'endless-vigil', 'completion hands the same run into endless mastery');
  assert.strictEqual(state.chronicle.receipts.length, 5, 'the authored arc produces five and only five receipts');
  assert.deepStrictEqual(state.chronicle.clearedChapterIds, expectedIds, 'receipts preserve the authored chapter order');
  assert.ok(state.chronicle.receipts.every(receipt => receipt.reward.goldPerWarden > 0 && receipt.reward.metalPerWarden > 0), 'every receipt records its per-warden build reward');
}

{
  const state = running('single', 2122);
  state.nextSurgeAt = 9999;
  state.nextSpecialAt = 9999;
  const hexer = Core.spawnEnemy(state, 'hexer', 'north');
  const raider = Core.spawnEnemy(state, 'raider', 'north');
  hexer.x = raider.x = 100;
  hexer.y = raider.y = 236;
  const before = raider.hp;
  Core.damageEnemy(state, raider, 20, 'north');
  assert.strictEqual(raider.hp, before - 20 * Core.CONFIG.hexerDamageMultiplier, 'a nearby Hexer measurably wards ordinary troops');
  assert.strictEqual(Core.isEnemyWarded(state, raider), true, 'Hexer ward state is semantically inspectable');
  hexer.x += Core.CONFIG.hexerWardRadius + 1;
  assert.strictEqual(Core.isEnemyWarded(state, raider), false, 'the ward ends outside its bounded radius');
}

{
  const state = running('single', 2123);
  state.nextSurgeAt = 9999;
  state.nextSpecialAt = 9999;
  const warlord = Core.spawnEnemy(state, 'warlord', 'south');
  const follower = Core.spawnEnemy(state, 'brute', 'south');
  warlord.x = follower.x = 0;
  warlord.y = follower.y = 304;
  const beforeX = follower.x;
  Core.step(state, 0.05);
  assert.ok(follower.x - beforeX > follower.speed * 0.05, 'a Warlord accelerates its nearby formation without mutating base speed');
  assert.strictEqual(Core.snapshot(state).enemies.find(enemy => enemy.id === follower.id).commanded, true, 'command aura is exposed in transport state');
  Core.damageEnemy(state, warlord, warlord.hp + 1, 'south');
  assert.strictEqual(state.stats.commandersDefeated, 1, 'defeating a Warlord records a commander result');
}

{
  const state = running('coop');
  const warden = state.wardens[0];
  assert.strictEqual(state.wardens[1].active, true, 'co-op activates both wardens');
  Core.updateWarden(state, 0, { moveX: 1, moveY: 0 }, 0.1);
  assert.ok(warden.x > 618, 'left-stick semantic move changes the warden position');
  const enemy = Core.spawnEnemy(state, 'raider', 'north');
  enemy.x = warden.x - 80; enemy.y = warden.y;
  const hp = enemy.hp;
  Core.updateWarden(state, 0, { aimX: -1, aimY: 0, fire: true }, 0.1);
  assert.ok(enemy.hp < hp, 'right-stick/trigger semantic fire damages an aimed enemy');
}

{
  const pointerFallback = { aimX: -420, aimY: 180, fire: false, preserveAim: false };
  const phoneAim = { aimX: 0.64, aimY: -0.38, fire: false, preserveAim: true };
  const combined = Core.prioritizeControllerInput(pointerFallback, phoneAim, true);
  assert.strictEqual(combined.aimX, phoneAim.aimX, 'connected P1 phone aim must override the shared-screen pointer vector');
  assert.strictEqual(combined.aimY, phoneAim.aimY, 'connected P1 phone aim must keep both normalized axes');
  assert.strictEqual(combined.preserveAim, true, 'an idle controller must preserve its last aim instead of falling back to the pointer');
  assert.strictEqual(Core.prioritizeControllerInput(pointerFallback, phoneAim, false), pointerFallback, 'disconnected controllers must leave keyboard/pointer fallback untouched');
}

{
  const gameDir = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(gameDir, 'game.manifest.json'), 'utf8'));
  assert.strictEqual(manifest.slot, '021');
  assert.strictEqual(manifest.controls.gamepad_profile, 'axm-universal-xbox-brawl-v0.2.1');
  assert.strictEqual(manifest.controls.intent_protocol, 'axm-semantic-input-v1');
  assert.strictEqual(manifest.controls.phone_controller, true);
  assert.strictEqual(manifest.join.supports_qr, true);
  assert.strictEqual(manifest.launch.controller_path, '/controller.html?player={player}');
  const profile = JSON.parse(fs.readFileSync(path.join(gameDir, 'runtime', 'control-profile.json'), 'utf8'));
  assert.strictEqual(profile.version, '1.2.0');
  assert.ok(profile.actions.some(action => action.id === 'FORTIFY') && !profile.actions.some(action => action.id === 'BLUEPRINT'), 'LB must fortify instead of cycling blueprints');
  assert.strictEqual(profile.controllerLayout.BUILD, 'rightBumper');
  assert.strictEqual(profile.radialBuild.selectionControl, 'leftStick');
  assert.strictEqual(profile.radialBuild.commit, 'release rightBumper');
  const controller = fs.readFileSync(path.join(gameDir, 'runtime', 'controller.html'), 'utf8');
  assert.ok(controller.includes('viewport-fit=cover'), 'phone controller must respect safe areas');
  assert.ok(controller.includes('id="moveStick"') && controller.includes('id="aimStick"'), 'phone controller must expose twin sticks');
  assert.ok(controller.includes('data-edge="build"') && controller.includes('buildHeld:held.build'), 'phone controller must relay held RB state for the radial build wheel');
  assert.ok(controller.includes('data-edge="fortify"'), 'LB must have one clear gate-fortify job');
  assert.ok(controller.includes("fetch('/api/input'"), 'phone controller must send semantic input to the game relay');
  manifest.package.required_paths.forEach(relative => {
    assert.ok(fs.existsSync(path.join(gameDir, relative)), `required package path missing: ${relative}`);
  });
}

console.log('Hearthgate selftest: PASS · deterministic Oathbound chapters/receipts, Hexer wards, Warlord commands, owned wallets/builds, surges, breach, rebuild, rewards, scaling, and twin-stick controls');
