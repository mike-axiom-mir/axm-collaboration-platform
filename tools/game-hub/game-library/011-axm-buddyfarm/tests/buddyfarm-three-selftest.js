#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const runtime = require('../runtime/server');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'runtime', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'runtime', 'index.html'), 'utf8');
const stage = fs.readFileSync(path.join(root, 'runtime', 'buddyfarm-three.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'runtime', 'styles.css'), 'utf8');
const vendor = runtime.safeFile('/vendor/three.module.js');

assert.match(html, /buddyfarm-three\.js/);
assert.match(app, /window\.BuddyFarmThree\.render/);
assert.match(app, /farm-depth/);
assert.match(app, /farm-semantic/);
assert.match(css, /depth-ready/);
assert.match(css, /data-overview/);
assert.match(stage, /import\('\/vendor\/three\.module\.js'\)/);
assert.match(stage, /new THREE\.WebGLRenderer/);
assert.match(stage, /new THREE\.PerspectiveCamera/);
assert.match(stage, /new THREE\.InstancedMesh/);
assert.match(stage, /class BuddyFarmStage/);
assert.doesNotMatch(stage, /https?:\/\//);
assert.ok(vendor && fs.existsSync(vendor), 'retained Three.js module must resolve locally');
assert.ok(fs.statSync(vendor).size > 1000000, 'retained Three.js module should be complete');
assert.strictEqual(runtime.safeFile('/vendor/../LICENSE'), null, 'vendor route must stay exact');
assert.strictEqual(runtime.safeFile('/games/011/../../server.js'), null, 'runtime traversal must stay blocked');

console.log('BuddyFarm low-poly Three.js selftest: PASS');
