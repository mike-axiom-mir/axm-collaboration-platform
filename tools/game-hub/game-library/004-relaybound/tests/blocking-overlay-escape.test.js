'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const client = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'relaybound-client.html'), 'utf8');

test('ready and upgrade blockers bridge to one reversible Escape menu', () => {
  assert.match(client, /id="readyGate"/);
  assert.match(client, /id="upgrade"/);
  assert.match(client, /id="escapeMenu"[\s\S]*id="resumeEscape"/);
  assert.match(client, /sessionBoundBlockers=\[readyGate,upgradeBox\]/);
  assert.match(client, /function blockerOpen\(\)\{return sessionBoundBlockers\.some\(panel=>panel\.classList\.contains\('show'\)\)\}/);
  assert.match(client, /function handleEscape\(\)\{return closeEscapeMenu\(\)\|\|openEscapeMenu\(\)\}/);
});

test('Escape is single-action, releases local input and stays inert without a blocker', () => {
  assert.match(client, /if\(e\.key==='Escape'&&!e\.repeat\)\{if\(handleEscape\(\)\)\{e\.preventDefault\(\);e\.stopPropagation\(\)\}return\}/);
  assert.match(client, /function openEscapeMenu\(\)\{if\(!blockerOpen\(\)\)return false;[\s\S]*input\.moveX=0;input\.moveY=0;input\.action=false;post\(\)/);
  assert.match(client, /escapeMenu\.classList\.add\('show'\)[\s\S]*resumeEscape\.focus\(\);return true/);
  assert.match(client, /if\(!blockerOpen\(\)\)closeEscapeMenu\(false\)/);
});
