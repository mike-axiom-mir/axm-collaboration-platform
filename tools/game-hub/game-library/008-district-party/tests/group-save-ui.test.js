'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('shared party screen contains one unsplit nine-slot group-save computer overlay', () => {
  const html = read('client/game/game.html');
  const css = read('client/game/game.css');
  const hud = read('client/game/ui/hud.js');
  assert.match(html, /id="save-computer"/);
  assert.match(html, /id="save-slot-grid"/);
  assert.match(html, /NO PROFILES/);
  assert.match(html, /absent saved seats become Host AI/);
  assert.match(css, /grid-template-columns:\s*repeat\(3/);
  assert.match(hud, /Array\.from\(\{ length: 9 \}/);
  assert.doesNotMatch(html, /iframe[^>]+save/i);
});

test('controller exposes save navigation through the existing semantic input vocabulary', () => {
  const controller = read('client/controller/controller.js');
  const html = read('client/controller/controller.html');
  assert.match(controller, /SELECT SLOT · LEFT SAVE · RIGHT LOAD/);
  assert.match(controller, /saveComputer\.controlActorId === actor\.id/);
  assert.match(controller, /CLOSE COMPUTER/);
  assert.match(html, /save computer/);
  assert.doesNotMatch(controller, /fetch\([^)]*save-slot/i, 'phone never submits save contents');
});

test('host join board refreshes after load so AI-filled seats lose stale human QR cards', () => {
  const launcher = read('client/launcher/launcher.js');
  assert.match(launcher, /refreshLoadedRoster/);
  assert.match(launcher, /controllerSeats/);
  assert.match(launcher, /hostAiFilledSeats/);
  assert.match(launcher, /setInterval\(refreshLoadedRoster, 1000\)/);
});

test('map and renderer expose a visible Party House save terminal from structured map data', () => {
  const map = JSON.parse(read('data/map.json'));
  const renderer = read('client/game/rendering/entity-renderer.js');
  const cityMap = read('client/game/ui/city-map.js');
  assert.equal(map.layers.save_terminals.length, 1);
  assert.equal(map.layers.save_terminals[0].saveSlotCount, 9);
  assert.match(renderer, /drawSaveTerminal/);
  assert.match(cityMap, /save_terminal/);
});
