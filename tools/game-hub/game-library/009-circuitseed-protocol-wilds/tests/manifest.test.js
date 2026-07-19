'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const manifest = require('../game.manifest.json');
const { validateManifest, verifyGameDir } = require('../../../game-package-verifier');

const gameDir = path.join(__dirname, '..');

test('PR14 package verifier accepts slot 009 manifest and runtime evidence', () => {
  assert.deepEqual(validateManifest(manifest, { gameDir }), []);
  const result = verifyGameDir(gameDir);
  assert.equal(result.slot, '009');
  assert.deepEqual(result.errors, []);
});

test('manifest locks local authority and one-to-eight visible occupancy', () => {
  assert.equal(manifest.min_players, 1);
  assert.equal(manifest.max_players, 8);
  assert.equal(manifest.launch.start_command, 'managed-by-game-hub');
  assert.equal(manifest.launch.local_only_default, true);
  assert.equal(manifest.rules.no_hidden_players, true);
  assert.equal(manifest.rules.host_ai_fill_empty_seats_default, false);
  assert.equal(manifest.session.drop_in_out_implemented, true);
  assert.equal(manifest.launch.port, 8799);
});

test('verifier refuses an invalid slot, port and hidden-player rule', () => {
  const broken = JSON.parse(JSON.stringify(manifest));
  broken.slot = '9'; broken.launch.port = 80; broken.rules.no_hidden_players = false;
  const errors = validateManifest(broken, { gameDir, syntaxCheck: false });
  assert.ok(errors.some(value => value.includes('slot')));
  assert.ok(errors.some(value => value.includes('port')));
  assert.ok(errors.some(value => value.includes('no_hidden_players')));
});
