'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Engine = require('../runtime/game-engine');
const Server = require('../runtime/server');

const content = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'content', 'adventure-content.v0.2.json'), 'utf8'));
const digest = Server.digestBytes(fs.readFileSync(path.resolve(__dirname, '..', 'content', 'adventure-content.v0.2.json')));
let state = Engine.createInitialState(content, digest);

function pathTo(targetX, targetY) {
  const zone = Engine.zoneById(content, state.zoneId);
  const key = (x, y) => x + ',' + y;
  const queue = [{ x: state.x, y: state.y, moves: [] }];
  const seen = new Set([key(state.x, state.y)]);
  const directions = [['up', 0, -1], ['left', -1, 0], ['right', 1, 0], ['down', 0, 1]];
  while (queue.length) {
    const current = queue.shift();
    if (current.x === targetX && current.y === targetY) return current.moves;
    for (const [direction, dx, dy] of directions) {
      const x = current.x + dx, y = current.y + dy;
      if (zone.map[y]?.[x] !== '.' || seen.has(key(x, y))) continue;
      seen.add(key(x, y)); queue.push({ x, y, moves: current.moves.concat(direction) });
    }
  }
  throw new Error('no path to ' + targetX + ',' + targetY + ' in ' + zone.id);
}
function moveToActor(actorId) {
  const entry = Engine.actorById(content, actorId);
  assert(entry, 'missing actor ' + actorId);
  assert.strictEqual(entry.zone.id, state.zoneId, 'actor is not in current zone: ' + actorId);
  for (const direction of pathTo(entry.actor.x, entry.actor.y)) state = Engine.applyAction(content, state, { action: 'move', direction });
  assert.strictEqual(state.x, entry.actor.x); assert.strictEqual(state.y, entry.actor.y);
}
function interact(actorId) {
  moveToActor(actorId);
  state = Engine.applyAction(content, state, { action: 'interact' });
  assert.strictEqual(state.lastActorId, actorId);
}

// Countertest: Agency remains closed even after the introduction if Truth has
// not returned. Moving onto the portal and interacting must preserve zone.
interact('archivist-luma');
moveToActor('agency-path');
state = Engine.applyAction(content, state, { action: 'interact' });
assert.strictEqual(state.zoneId, 'crossroads');
assert.match(state.message, /refuses to skip Truth/);

interact('truth-path');
assert.strictEqual(state.zoneId, 'truth-hollow');
interact('clear-witness');
interact('echo-witness');
interact('keeper-verity');
assert.deepStrictEqual(state.roots, ['truth']);
interact('truth-return');

interact('agency-path');
assert.strictEqual(state.zoneId, 'agency-garden');
interact('north-lantern');
interact('middle-lantern');
interact('south-lantern');
interact('keeper-iora');
assert.deepStrictEqual(state.roots, ['truth', 'agency-non-domination']);
interact('agency-return');

interact('continuity-path');
assert.strictEqual(state.zoneId, 'continuity-archive');
interact('memory-before');
interact('memory-after');
interact('memory-bridge');
interact('keeper-anamnesis');
assert.deepStrictEqual(state.roots, ['truth', 'agency-non-domination', 'continuity']);
interact('continuity-return');

interact('wisdom-path');
assert.strictEqual(state.zoneId, 'wisdom-grove');
interact('still-pool');
interact('dissent-tree');
interact('consequence-stone');
interact('keeper-serein');
assert.deepStrictEqual(state.roots, Engine.ROOT_ORDER);
interact('wisdom-return');

interact('workshop-gate');
assert.strictEqual(state.completed, true);
assert.strictEqual(state.flags.includes('journey-complete'), true);
const view = Engine.publicSnapshot(content, state, { mode: 'TEST', contentBound: true, reload: 'RESUME', restart: 'RESUME', resetAvailable: true });
assert.strictEqual(view.ending.title, 'A Door Into Review');
assert.strictEqual(view.progress.quests.every((quest) => quest.complete), true);
assert.strictEqual(view.progress.inventory.length, 10);
assert.strictEqual(view.progress.roots.every((root) => root.acquired), true);
assert.strictEqual(view.authority.generatedCodeCanCanonize, false);
assert.strictEqual(view.authority.finalMergeGate, 'MIKE_TOBI');
assert.ok(state.moves > 100, 'complete journey should require real exploration movement');

console.log('PASS Four Roots Adventure complete semantic journey (' + state.moves + ' moves, 25 interactions, 6 quests)');
