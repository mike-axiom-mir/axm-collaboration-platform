'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname,'..');
const read = relative => fs.readFileSync(path.join(root,relative),'utf8');

test('hybrid scene declares genuine low-resolution WebGL with Canvas authority fallback', () => {
  const html=read('runtime/index.html');
  const app=read('runtime/app.js');
  const source=read('runtime/world-three.js');
  const styles=read('runtime/styles.css');
  assert.ok(html.indexOf('id="world3dCanvas"') < html.indexOf('id="worldCanvas"'));
  assert.match(app,/new WorldThreeRenderer/);
  assert.match(source,/getContext\('webgl'/);
  assert.match(source,/gl\.enable\(this\.gl\.DEPTH_TEST\)/);
  assert.match(source,/const INTERNAL_WIDTH = 480/);
  assert.match(source,/const INTERNAL_HEIGHT = 270/);
  assert.match(source,/const PALETTE_STEPS = 16/);
  assert.match(source,/dataset\.authority='visual-only-canvas2d-simulation-authority'/);
  assert.match(source,/dataset\.pass='small-odds-faceted-world-01'/);
  assert.match(source,/dataset\.changesAuthority='false'/);
  assert.match(source,/dataset\.changesCollision='false'/);
  assert.match(source,/octahedronData\(\)/);
  assert.match(source,/dataset\.drawCalls/);
  assert.match(source,/dataset\.triangles/);
  assert.match(source,/dataset\.renderer='canvas2d-fallback'/);
  assert.match(styles,/image-rendering:pixelated/);
  assert.match(styles,/#worldCanvas \{ z-index:1; opacity:\.5; \}/);
});

test('all six locations and three durable aftermath markers have authored 3D forms', () => {
  const source=read('runtime/world-three.js');
  for (const location of ['Shore','Room','Kitchen','District','Market','Starspite']) assert.match(source,new RegExp(`draw${location}\\(`));
  for (const marker of ['solidarity-ribbons','repayment-stamp','breathing-room-lamp']) assert.match(source,new RegExp(marker));
  assert.doesNotMatch(source,/https?:\/\//i);
});
