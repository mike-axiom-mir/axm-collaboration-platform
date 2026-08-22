'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { staticFileForPath } = require('../server/server');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('registered shared screen mounts a local presentation-only Three relief', () => {
  const html = read('client/game/game.html');
  const css = read('client/game/game.css');
  const scene = read('client/game/scenes/CityScene.js');
  const depth = read('client/game/rendering/district-depth-stage.js');

  assert.match(html, /id="city-depth-canvas"/);
  assert.match(html, /data-renderer="three-r160"/);
  assert.match(scene, /new DistrictDepthStage/);
  assert.match(depth, /from '\/vendor\/three\.module\.js'/);
  assert.match(depth, /dataset\.authority = 'presentation-only'/);
  assert.match(depth, /world\?\.actors/);
  assert.match(depth, /world\?\.vehicles/);
  assert.match(css, /\.map-open #city-depth-canvas \{ opacity: 0; \}/);
  assert.match(css, /\.map-open #city-canvas/);
});

test('Three runtime is served from the retained Workshop MIT vendor', () => {
  const vendorPath = staticFileForPath(ROOT, '/vendor/three.module.js');
  const expected = path.resolve(ROOT, '../../../..', 'shared', 'vendor', 'three-r160', 'three.module.js');
  assert.equal(vendorPath, expected);
  assert.equal(fs.statSync(vendorPath).isFile(), true);
  assert.equal(fs.statSync(path.join(path.dirname(vendorPath), 'LICENSE')).isFile(), true);
});
