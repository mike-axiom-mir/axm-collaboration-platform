'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'client', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'client', 'index.html'), 'utf8');

test('Escape reverses user-controlled overlays before opening the journey menu', () => {
  for (const id of ['menuPanel', 'profilePanel', 'settingsPanel', 'workbenchPanel', 'discoveryReveal']) {
    assert.match(app, new RegExp("ESCAPE_CLOSE_ORDER[^;]+['\"]" + id + "['\"]"));
  }
  assert.match(app, /function dismissTopOverlay\(\)[\s\S]*ESCAPE_CLOSE_ORDER\.find\(panelIsOpen\)[\s\S]*closePanel\(panelId\)/);
  assert.match(app, /if \(key === 'escape' && !event\.repeat\) \{ event\.preventDefault\(\); handleEscape\(\); return; \}/);
  assert.match(app, /function handleEscape\(\)[\s\S]*if \(dismissTopOverlay\(\)\) return;[\s\S]*openPanel\('menuPanel'\)/);
});

test('state-bound starter and encounter blockers bridge to the reversible journey menu', () => {
  for (const id of ['starterPanel', 'encounterPanel']) {
    assert.match(html, new RegExp('id="' + id + '"'));
    assert.match(app, new RegExp("SESSION_BOUND_BLOCKERS[^;]+['\"]" + id + "['\"]"));
  }
  assert.match(app, /app\.running \|\| SESSION_BOUND_BLOCKERS\.some\(panelIsOpen\)/);
  assert.match(html, /id="menuPanel"[\s\S]*id="resumeButton"[\s\S]*id="endSessionButton"/);
});
