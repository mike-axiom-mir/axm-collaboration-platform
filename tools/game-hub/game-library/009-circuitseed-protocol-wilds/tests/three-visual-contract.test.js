'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('main journey has a local presentation-only Three.js depth stage', () => {
  const html = read('client/index.html');
  const styles = read('client/styles.css');
  const app = read('client/app.js');
  const stage = read('client/circuitseed-three.mjs');
  const server = read('server/server.js');
  const notice = read('THIRD_PARTY_SOFTWARE.md');
  assert.match(html, /id="world-depth"[^>]+data-renderer="three-r160"/);
  assert.match(html, /type="module" src="\/circuitseed-three\.mjs"/);
  assert.match(styles, /body\.three-depth-ready #world[^}]+opacity:/);
  assert.match(app, /window\.CircuitseedThree\?\.render/);
  assert.match(stage, /import \* as THREE from '\/vendor\/three\.module\.js'/);
  assert.match(stage, /flatShading: true/);
  assert.match(stage, /presentation-only/);
  assert.match(stage, /new THREE\.PerspectiveCamera/);
  assert.match(stage, /new THREE\.WebGLRenderer/);
  assert.match(server, /pathname === '\/vendor\/three\.module\.js'/);
  assert.match(notice, /Three\.js r160/);
});
