#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Core = require('../runtime/game-core');

const state = Core.createState({ mode: 'single', seed: 210821 });
Core.startGame(state, 'single');
const seenEnemies = new Map();
let nextDecisionAt = 0;
let loops = 0;

while (state.status === 'running' && state.time < 365 && loops < 200000) {
  if (state.prepTime > 0) {
    Core.build(state, 0, 'forge');
    Core.build(state, 1, 'market');
    Core.build(state, 4, 'ballista');
    Core.build(state, 5, 'alchemist');
  }

  if (state.time >= nextDecisionAt) {
    nextDecisionAt = state.time + 0.6;
    ['north', 'south'].forEach(side => {
      const tower = Core.getTower(state, side);
      if (tower.down || tower.hp < tower.maxHp * 0.7) Core.repairOrRebuild(state, side);
      else if (state.playerResources[0].gold >= Core.towerUpgradeCost(tower.level) + 35 && tower.level < 8) Core.upgradeTower(state, side);
      if (!tower.down && tower.powerCooldown <= 0) Core.powerShot(state, side);
    });

    const buildOrder = ['forge', 'market', 'ballista', 'alchemist'];
    state.buildings.forEach((building, index) => {
      if (!building && state.playerResources[0].metal > 170) Core.build(state, index, buildOrder[index % buildOrder.length]);
      else if (building && state.playerResources[0].metal >= Core.buildingUpgradeCost(building) + 180 && building.level < 5) Core.upgradeBuilding(state, index);
    });
    if (state.playerResources[0].metal >= Core.gateUpgradeCost(state.gateLevel) + 300 && state.gateLevel < 5) Core.fortifyGate(state);
  }

  const priority = enemy => (enemy.kind === 'hexer' ? 3000 : enemy.kind === 'warlord' ? 2500 : enemy.breached ? 2000 : 0) + enemy.x;
  const target = state.enemies.filter(enemy => !enemy.dead).sort((a, b) => priority(b) - priority(a))[0];
  if (target) {
    const warden = state.wardens[0];
    const dx = target.x - warden.x;
    const dy = target.y - warden.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    Core.updateWarden(state, 0, { aimX: dx / magnitude, aimY: dy / magnitude, fire: true, preserveAim: true }, 0.05);
  }

  Core.step(state, 0.05);
  state.enemies.forEach(enemy => { if (!seenEnemies.has(enemy.id)) seenEnemies.set(enemy.id, enemy.kind); });
  loops += 1;
}

const kinds = new Set(seenEnemies.values());
assert.strictEqual(state.status, 'running', 'a deterministic, resource-aware solo defense must survive the authored siege');
assert.ok(state.time >= 365, 'the semantic run must continue beyond the six-minute oath boundary');
assert.strictEqual(state.chronicle.completed, true, 'the full Oathbound arc must complete through ordinary player commands');
assert.strictEqual(state.chronicle.receipts.length, 5, 'the playthrough must earn all five bounded receipts');
assert.strictEqual(state.chronicle.currentChapterId, 'endless-vigil', 'the completed defense must remain in the same endless run');
assert.ok(['raider', 'skitter', 'brute', 'relic', 'hexer', 'warlord'].every(kind => kinds.has(kind)), 'the semantic run must encounter every tactical enemy class');
assert.ok(state.stats.commandersDefeated >= 2, 'the twin final Warlords must be defeatable in a competent run');
assert.ok(state.buildings.filter(Boolean).length >= 6 && state.gateLevel >= 3, 'the passing route must actually exercise the expanded build economy');

console.log(`Hearthgate semantic playtest: PASS · ${Core.formatTime(state.time)} · 5/5 oaths · ${state.stats.defeated} defeated · gate ${state.gateLevel} · endless vigil active`);
