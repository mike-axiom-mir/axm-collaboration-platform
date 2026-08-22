#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const policy = require('./universal-control-policy');

function game(overrides) {
  return Object.assign({
    game_id: 'test-coop', name: 'Test Co-op', description: 'Shared couch co-op', max_players: 2,
    controls: { shared_screen: true }, rules: { team_mode: 'coop' }
  }, overrides || {});
}

assert.strictEqual(policy.evaluateUniversalGamepad(game()).status, 'mapping-required');
assert.strictEqual(policy.evaluateUniversalGamepad(game({ controls: { shared_screen: true, gamepad: true, profile_id: 'game-actions-v1' } })).status, 'adapter-migration-required');
assert.strictEqual(policy.evaluateUniversalGamepad(game({ controls: { shared_screen: true, gamepad: true, gamepad_profile: policy.DEFAULT_INPUT_PROFILE } })).status, 'integrated');
assert.strictEqual(policy.evaluateUniversalGamepad(game({ controls: { shared_screen: true, universal_gamepad: false, universal_gamepad_opt_out_reason: 'turn-based accessibility review' } })).status, 'opted-out');
assert.strictEqual(policy.evaluateUniversalGamepad(game({ name: 'Competitive Racer', description: 'Local versus racing', controls: { shared_screen: true }, rules: { team_mode: 'competitive' } })).status, 'not-applicable');
assert.strictEqual(policy.evaluateUniversalGamepad(game({ max_players: 1 })).status, 'not-applicable');

const library = path.join(__dirname, 'game-library');
const manifests = fs.readdirSync(library, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(library, entry.name, 'game.manifest.json')))
  .map(entry => JSON.parse(fs.readFileSync(path.join(library, entry.name, 'game.manifest.json'), 'utf8')));
const byId = new Map(manifests.map(manifest => [manifest.game_id, policy.evaluateUniversalGamepad(manifest)]));
assert.strictEqual(byId.get('004-relaybound').status, 'integrated');
assert.strictEqual(byId.get('013-toonfall-gatewatch').status, 'integrated');
assert.strictEqual(byId.get('006-lumenwake').required, true);
assert.strictEqual(byId.get('015-axm-mirrorshift').required, false);

console.log('universal control policy selftest: PASS · ' + manifests.length + ' installed manifests inspected');
