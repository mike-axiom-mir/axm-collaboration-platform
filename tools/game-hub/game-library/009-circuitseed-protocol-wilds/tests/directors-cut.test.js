'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fieldRequests = require('../data/field-requests.json');
const items = require('../data/items.json');
const lore = require('../data/lore.json');
const recipes = require('../data/recipes.json');
const world = require('../data/world.json');
const { buildSeatObservation } = require('../server/observation');
const { processPulses } = require('../server/server');
const { remove, runtimeWithSession } = require('./helpers');

test('director cut content forms one referentially complete archive, request, item and crafting layer', () => {
  assert.equal(lore.entries.length, 10);
  assert.equal(fieldRequests.requests.length, 16);
  assert.equal(recipes.recipes.length, 10);
  assert.equal(recipes.orders.length, 9);
  assert.ok(world.resourceNodes.length >= 30);

  const itemIds = new Set(items.items.map(item => item.id));
  const recipeIds = new Set(recipes.recipes.map(recipe => recipe.id));
  assert.equal(itemIds.size, items.items.length);
  assert.equal(recipeIds.size, recipes.recipes.length);

  const memoryPoints = world.points.filter(point => point.kind === 'memory-echo');
  assert.equal(memoryPoints.length, lore.entries.length);
  assert.deepEqual(new Set(memoryPoints.map(point => point.loreId)), new Set(lore.entries.map(entry => entry.id)));
  for (const entry of lore.entries) {
    assert.equal(itemIds.has(entry.artifactId), true, entry.artifactId);
    if (entry.unlocksRecipe) assert.equal(recipeIds.has(entry.unlocksRecipe), true, entry.unlocksRecipe);
  }
  for (const node of world.resourceNodes) assert.equal(itemIds.has(node.material), true, node.material);
  for (const recipe of recipes.recipes) {
    for (const id of [...Object.keys(recipe.inputs), ...Object.keys(recipe.outputs)]) assert.equal(itemIds.has(id), true, id);
  }
  for (const request of fieldRequests.requests) {
    for (const id of [...Object.keys(request.rewards.materials || {}), ...Object.keys(request.rewards.items || {})]) assert.equal(itemIds.has(id), true, id);
    for (const recipeId of request.rewards.recipes || []) assert.equal(recipeIds.has(recipeId), true, recipeId);
  }
});

test('memory echoes grant a provenance-bearing keepsake and recipe through the authoritative scan path', () => {
  const { root, runtime, session } = runtimeWithSession(1);
  try {
    const actor = session.actors.seat_1;
    actor.position = { x: 600, y: 470 };
    actor.pendingPulses.scan = true;
    processPulses(runtime, session, actor);
    const profile = runtime.profileStore.get(actor.profileId);
    assert.equal(profile.discoveries.some(item => item.id === 'memory-echo-name-first' && item.kind === 'memory-echo'), true);
    assert.equal(profile.inventory.items['blank-nameplate'], 1);
    assert.equal(profile.recipes.includes('kin-cache'), true);
    assert.equal(profile.history.some(item => item.type === 'memory-echo-recovered' && item.loreId === 'echo-name-first'), true);
    assert.equal(session.events.some(item => item.type === 'memory-echo-discovered' && item.loreId === 'echo-name-first'), true);

    const observation = buildSeatObservation(session, 'seat_1', {
      profileStore: runtime.profileStore,
      worldBones: world,
      missionSystem: runtime.missionSystem,
      encounterSystem: runtime.encounterSystem,
      economySystem: runtime.economySystem,
      circuitkinSystem: runtime.circuitkinSystem,
      requestSystem: runtime.requestSystem,
      loreData: lore
    });
    assert.equal(observation.hud.journal.recovered, 1);
    assert.equal(observation.hud.journal.entries[0].title, 'A Name Before a Function');
    assert.equal(observation.hud.inventory.items['blank-nameplate'], 1);
    assert.equal(observation.hud.requests.total, 16);
  } finally { remove(root); }
});

test('optional field requests validate real profile history, pay once and persist the receipt', () => {
  const { root, runtime, session } = runtimeWithSession(1);
  try {
    const actor = session.actors.seat_1;
    runtime.circuitkinSystem.recruitStarter(actor.profileId, 'trace');
    runtime.profileStore.mutate(actor.profileId, profile => {
      for (let index = 0; index < 5; index += 1) profile.discoveries.push({ id: 'proof-' + index, kind: 'relay', regionId: 'lumen-yard' });
    });
    const before = runtime.profileStore.get(actor.profileId);
    const result = runtime.requestSystem.claim(actor.profileId, 'honest-marks');
    assert.equal(result.profile.currency, before.currency + 35);
    assert.equal(result.profile.inventory.items['survey-ribbon'], 1);
    assert.equal(result.profile.receipts.includes('field-request:honest-marks'), true);
    assert.equal(result.request.claimed, true);
    assert.equal(result.board.claimed, 1);
    assert.throws(() => runtime.requestSystem.claim(actor.profileId, 'honest-marks'), /already-claimed/);
    assert.throws(() => runtime.requestSystem.claim(actor.profileId, 'whole-choir'), /requirements-not-met/);
  } finally { remove(root); }
});
