#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const Rig = require('../runtime/hero-rig-contract.js');

const root = path.resolve(__dirname, '..');
const asset = Rig.assetFor('human');
const names = [
  'HumanArmature|Man_Clapping', 'HumanArmature|Man_Death',
  'HumanArmature|Man_Idle', 'HumanArmature|Man_Jump',
  'HumanArmature|Man_Punch', 'HumanArmature|Man_Run',
  'HumanArmature|Man_RunningJump', 'HumanArmature|Man_Sitting',
  'HumanArmature|Man_Standing', 'HumanArmature|Man_SwordSlash',
  'HumanArmature|Man_Walk'
];

test('Human selects one valid relocatable CC0 production asset', () => {
  assert.ok(Rig.validateAsset(asset));
  assert.equal(path.isAbsolute(asset.relativePath), false);
  assert.equal(asset.relativePath.includes('..'), false);
  assert.equal(asset.license, 'CC0-1.0');
});

test('Toon remains an intentional code-native rig', () => {
  assert.equal(Rig.assetFor('toon'), null);
});

test('the declared binary and local provenance note are packaged', () => {
  const assetPath = path.join(root, 'runtime', asset.relativePath);
  assert.ok(fs.existsSync(assetPath));
  assert.ok(fs.existsSync(path.join(root, 'runtime/assets/characters/quaternius/animated-men/LICENSE.txt')));
  assert.equal(fs.statSync(assetPath).size, 493196);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(assetPath)).digest('hex'), asset.sha256);
});

test('semantic clip resolution is exporter-prefix neutral', () => {
  const clips = Rig.resolveClips(names);
  assert.equal(clips.idle, 'HumanArmature|Man_Idle');
  assert.equal(clips.walk, 'HumanArmature|Man_Walk');
  assert.equal(clips.slash, 'HumanArmature|Man_SwordSlash');
  assert.equal(clips.punch, 'HumanArmature|Man_Punch');
});

test('every class binds attack, special and dodge to authored clips', () => {
  for (const classId of ['panzer', 'pun-slinger', 'gear-shepherd']) {
    const clips = Rig.resolveClips(names);
    for (const kind of ['attack', 'special', 'dodge']) assert.ok(clips[Rig.roleFor(classId, kind)], classId + ' ' + kind);
  }
});

test('unknown class action binding fails safely to Panzer', () => {
  assert.equal(Rig.roleFor('unknown', 'attack'), 'slash');
  assert.equal(Rig.roleFor('unknown', 'unknown'), 'idle');
});

test('incomplete clip sets are explicit instead of guessed', () => {
  const clips = Rig.resolveClips(['Man_Idle']);
  assert.equal(clips.idle, 'Man_Idle');
  assert.equal(clips.walk, null);
  assert.equal(clips.slash, null);
});
