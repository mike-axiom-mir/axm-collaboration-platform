#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stage = fs.readFileSync(path.join(root, 'runtime', 'arena-3d.js'), 'utf8');

assert.match(stage, /constellation-depth-02/);
assert.match(stage, /function buildDynamicGeometry/);
assert.match(stage, /function addCore/);
assert.match(stage, /function addPlayer/);
assert.match(stage, /function addBeat/);
assert.match(stage, /function addGlitch/);
assert.match(stage, /gl\.DYNAMIC_DRAW/);
assert.match(stage, /dynamicVertices/);
assert.match(stage, /worldActors/);
assert.match(stage, /worldBeats/);
assert.match(stage, /dynamic-octahedron/);
assert.match(stage, /31\.0/);
assert.doesNotMatch(stage, /https?:\/\//);
assert.doesNotMatch(stage, /Math\.random\s*\(/);

console.log('Pulse Choir dynamic low-poly WebGL selftest: PASS');
