'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const app = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'app.js'), 'utf8');
const html = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'index.html'), 'utf8');

test('blocking modal has one dismissal path that preserves guide and outcome authority', () => {
  assert.match(html, /id="modal" class="modal hidden" role="dialog" aria-modal="true"/);
  assert.match(html, /id="modal-close"[\s\S]*id="modal-primary"/);
  assert.match(app, /function dismissBlockingOverlay\(\)\{if\(ui\.modal\.classList\.contains\('hidden'\)\)return false;if\(state\.gameOver\)\{\$\('#modal-primary'\)\.click\(\);return true;\}ui\.modal\.classList\.add\('hidden'\);state\.paused=false;return true;\}/);
  assert.match(app, /\$\('#modal-close'\)\.addEventListener\('click',dismissBlockingOverlay\)/);
});

test('single Escape cancels placement, dismisses a blocker, or opens the battle guide in that order', () => {
  const handler = app.match(/function hotkey\(event,down\)\{[\s\S]*?\n  function focusBattle/);
  assert.ok(handler, 'hotkey handler should remain present');
  const source = handler[0];
  assert.match(source, /if\(key==='escape'\)\{if\(event\.repeat\)return;event\.preventDefault\(\);/);
  const placement = source.indexOf('if(state.placement){cancelPlacement();return;}');
  const blocker = source.indexOf('if(dismissBlockingOverlay())return;');
  const guide = source.indexOf("if(state.phase==='battle'&&!state.gameOver)showGuide();return;");
  assert.ok(placement >= 0 && placement < blocker && blocker < guide, 'Escape priorities should be placement, blocker, then active-battle guide');
});
