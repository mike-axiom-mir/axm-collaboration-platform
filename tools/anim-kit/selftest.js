'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildPack } = require('./shapeable-pack.js');

const root = __dirname;
for (const script of ['anim-kit.js', 'locomotion.js', 'morph.js']) {
  const run = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || `${script} failed`);
}
const pack = buildPack();
assert.equal(pack.blocks.length, 10);
assert.equal(new Set(pack.blocks.map((item) => item.type)).size, pack.blocks.length);
assert(pack.blocks.every((item) => item.targets.includes('game')));
const written = JSON.parse(fs.readFileSync(path.join(root, 'shapeable-block-pack.json'), 'utf8'));
assert.deepEqual(written, pack, 'downloadable Shapeable pack must match the governed generator');
for (const proof of ['bounce-filmstrip.svg', 'pop-filmstrip.svg', 'walk-filmstrip.svg', 'run-filmstrip.svg', 'respawn-longReach.svg', 'respawn-stiltLegs.svg']) {
  assert(fs.readFileSync(path.join(root, 'out', proof), 'utf8').includes('<svg'));
}
console.log('Anim Kit selftest: PASS (10 Shapeable blocks, source demos deterministic, static proofs present)');
