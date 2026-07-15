'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const helperPath = path.join(__dirname, '..', 'client', 'game', 'ui', 'hud-helpers.js');
const projectRoot = path.join(__dirname, '..');

async function helpers() {
  const source = fs.readFileSync(helperPath, 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('shared HUD formats provisional unlimited and inventory-backed loaded/total ammunition', async () => {
  const { ammoDisplay } = await helpers();
  assert.equal(ammoDisplay({ mode: 'provisional-unlimited', unlimited: true, loaded: null, total: null }), '∞');
  assert.equal(ammoDisplay({ mode: 'inventory', unlimited: false, loaded: 4, reserve: 9, total: 13 }), '4/13');
  assert.equal(ammoDisplay(null), '—');
});

test('shared HUD maps Party B seats to relative corners and stacks both parties in the all view', async () => {
  const { groupActorsByCorner, relativeSlot, waitingPlayerLabel } = await helpers();
  const actors = Array.from({ length: 8 }, (_, index) => ({ id: `actor-${index + 1}`, slot: index + 1 }));
  const groups = groupActorsByCorner(actors);
  assert.deepEqual([relativeSlot({ slot: 5 }), relativeSlot({ slot: 6 }), relativeSlot({ slot: 7 }), relativeSlot({ slot: 8 })], [1, 2, 3, 4]);
  assert.deepEqual([...groups.entries()].map(([corner, entries]) => [corner, entries.map((actor) => actor.slot)]), [
    [1, [1, 5]],
    [2, [2, 6]],
    [3, [3, 7]],
    [4, [4, 8]],
  ]);
  assert.deepEqual([1, 2, 3, 4].map((quarter) => waitingPlayerLabel('party_b', quarter)), ['P5', 'P6', 'P7', 'P8']);
  assert.deepEqual([1, 2, 3, 4].map((quarter) => waitingPlayerLabel('all', quarter)), ['P1/P5', 'P2/P6', 'P3/P7', 'P4/P8']);
});

test('shared-screen markup reserves four fixed corners and keeps mission status centered', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'client/game/game.html'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'client/game/game.css'), 'utf8');
  const inventoryCss = fs.readFileSync(path.join(projectRoot, 'client/game/inventory.css'), 'utf8');
  const hud = fs.readFileSync(path.join(projectRoot, 'client/game/ui/hud.js'), 'utf8');

  for (let quarter = 1; quarter <= 4; quarter += 1) {
    assert.match(html, new RegExp(`id=["']player-card-${quarter}["']`));
  }
  assert.match(html, /id=["']mission-hud["'][^>]*class=["'][^"']*mission-hud/);
  assert.doesNotMatch(html, /id=["']player-list["']/);
  assert.match(css, /\.mission-hud\s*\{[\s\S]*?left:\s*50%;[\s\S]*?transform:\s*translateX\(-50%\);/);
  assert.match(css, /\.player-q1\s*\{[^}]*top:[^}]*left:/);
  assert.match(css, /\.player-q2\s*\{[^}]*top:[^}]*right:/);
  assert.match(css, /\.player-q3\s*\{[^}]*bottom:[^}]*left:/);
  assert.match(css, /\.player-q4\s*\{[^}]*right:[^}]*bottom:/);
  assert.match(hud, /metricLine\('HP'/);
  assert.match(hud, /metricLine\('SHIELD'/);
  assert.match(hud, /AMMO · LOADED\/TOTAL/);
  assert.match(hud, /PLAYER FUND/);
  assert.match(html, /id=["']party-fund["']/);
  assert.match(hud, /Party \$\{summary\.rewardSplit\.partyPercent\}%/);
  assert.doesNotMatch(hud, /innerHTML|fetch\(|addEventListener\(/, 'read-only HUD neither injects HTML nor sends input');
  const inventoryLayer = Number(inventoryCss.match(/#inventory-overlays\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
  const resultsLayer = Number(css.match(/\.results,\s*\.mission-menu\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
  const connectionLayer = Number(css.match(/\.connection-banner\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
  assert.ok(inventoryLayer > 3, 'inventory stays above normal HUD and status banners');
  assert.ok(inventoryLayer < resultsLayer, 'round results stay visible over an open inventory');
  assert.ok(inventoryLayer < connectionLayer, 'connection warnings stay visible over an open inventory');
});
