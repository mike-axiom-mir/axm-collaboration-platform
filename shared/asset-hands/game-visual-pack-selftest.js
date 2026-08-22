#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Core = require('./game-visual-pack-core');

const game = Core.createPilotGameContract();
const packs = Core.createPilotPacks(game);
const hardware = Core.createHardwareProfiles();
const inventory = Core.createInventory(game, packs);
const save = Core.createPilotSave();

assert.equal(game.schema, 'axm.game-visual-contract/v1');
assert.equal(packs.length, 4);
assert.equal(hardware.length, 3);
assert(!Object.prototype.hasOwnProperty.call(save, 'active_visual_pack'), 'save truth must not own presentation selection');

const baseline = Core.verifyBaseline(game, packs, inventory, hardware[0]);
assert.equal(baseline.status, 'PASS', 'bundled baseline must run on declared minimum hardware');

const recommend = Core.createSelectionRequest({ id: 'recommend-only', mode: 'recommend', game_contract: game, packs, hardware_profile: hardware[1], inventory, save_state: save });
const recommended = Core.resolveSelection(recommend);
assert.equal(recommended.status, 'READY_FOR_CHOICE');
assert.equal(recommended.recommendation.pack_id, 'axm.visual-pack.theme-park.festival-16');
assert.equal(recommended.selection, null, 'recommendation must not activate a pack');
assert.equal(recommended.active_pack_changed, false);

const oldMachine = Core.createSelectionRequest({ id: 'old-machine', mode: 'select', game_contract: game, packs, hardware_profile: hardware[0], inventory, save_state: save });
oldMachine.requested_pack_id = 'axm.visual-pack.theme-park.festival-16';
const refused = Core.resolveSelection(oldMachine);
assert.equal(refused.status, 'INCOMPATIBLE_VISUAL_PACK');
assert.equal(refused.selection, null);
assert.equal(refused.fallback_used, false);
assert.equal(refused.save_digest_before, refused.save_digest_after);

const override = Core.createSelectionRequest({ id: 'player-override', mode: 'select', game_contract: game, packs, hardware_profile: hardware[2], inventory, save_state: save });
override.requested_pack_id = game.baseline_policy.pack_id;
const selected = Core.resolveSelection(override);
assert.equal(selected.status, 'SELECTED');
assert.equal(selected.selection.pack_id, game.baseline_policy.pack_id, 'capable hardware may still choose the baseline layer');
assert.equal(selected.selection.activated_by, 'explicit-player-choice');
assert.equal(selected.save_digest_before, selected.save_digest_after);

const future = Core.createSelectionRequest({ id: 'future-missing', mode: 'select', game_contract: game, packs, hardware_profile: hardware[2], inventory, save_state: save });
future.requested_pack_id = 'axm.visual-pack.theme-park.cinematic';
const missing = Core.resolveSelection(future);
assert.equal(missing.status, 'MISSING_VISUAL_PACK');
assert.equal(missing.selection, null);
assert.equal(missing.fallback_used, false);

const tamperedPacks = Core.createPilotPacks(game);
tamperedPacks[0].title = 'Mutated after sealing';
const tampered = Core.createSelectionRequest({ id: 'tampered-pack', mode: 'select', game_contract: game, packs: tamperedPacks, hardware_profile: hardware[0], inventory, save_state: save });
tampered.requested_pack_id = tamperedPacks[0].id;
assert.equal(Core.resolveSelection(tampered).status, 'PACK_CONTRACT_MISMATCH', 'pack content must match its sealed digest');

const proof = Core.buildPilotScenarioProof();
assert.equal(proof.status, 'PASS');
Object.values(proof.assertions).forEach(value => assert.equal(value, true));
proof.scenarios.forEach(scenario => {
  assert.equal(scenario.deterministic_replay, true);
  assert.equal(scenario.save_unchanged, true);
  assert.equal(scenario.no_fallback, true);
});

console.log('Game visual pack selftest PASS (' + proof.scenarios.length + ' deterministic scenarios, baseline + player authority + typed refusal)');
