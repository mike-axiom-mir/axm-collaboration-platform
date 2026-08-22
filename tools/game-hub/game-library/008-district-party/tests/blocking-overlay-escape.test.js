'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'client/game/game.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'client/game/game.css'), 'utf8');
const scene = fs.readFileSync(path.join(root, 'client/game/scenes/CityScene.js'), 'utf8');

function methodBody(name) {
  const marker = `  ${name}(`;
  const start = scene.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const signatureEnd = scene.indexOf(') {', start);
  assert.notEqual(signatureEnd, -1, `${name} must have a method signature`);
  const brace = signatureEnd + 2;
  let depth = 0;
  for (let index = brace; index < scene.length; index += 1) {
    if (scene[index] === '{') depth += 1;
    if (scene[index] === '}') {
      depth -= 1;
      if (depth === 0) return scene.slice(start, index + 1);
    }
  }
  assert.fail(`${name} must have a complete method body`);
}

assert.match(html, /id="session-menu"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="session-menu-return"[^>]*type="button"/);
assert.match(html, /NO MISSION, SAVE, PURCHASE, ITEM, RESULT, OR PAUSE AUTHORITY/);
assert.match(css, /\.session-menu\s*\{[^}]*z-index:\s*11/s);
assert.match(css, /\.session-menu-card button:focus-visible/);

const blockingSurface = methodBody('blockingSurface');
const setSurface = methodBody('setSessionMenuSurface');
const openMenu = methodBody('openSessionMenu');
const closeMenu = methodBody('closeSessionMenu');
const syncMenu = methodBody('syncSessionMenu');
const keyHandler = scene.slice(scene.indexOf("addEventListener('keydown'"), scene.indexOf('  blockingSurface()'));

for (const id of ['save-computer', 'results', 'mission-menu', 'city-venue-menu', 'inventory-overlays']) assert.match(blockingSurface, new RegExp(id));
assert.match(setSurface, /setAttribute\('aria-hidden', 'true'\)/);
assert.match(setSurface, /RETURN TO \$\{surface\.label\}/);
assert.match(openMenu, /session-menu-open/);
assert.match(openMenu, /sessionMenuReturn\?\.focus\(\)/);
assert.match(closeMenu, /session-menu-open/);
assert.match(closeMenu, /setSessionMenuSurface\(null\)/);
assert.match(syncMenu, /closeSessionMenu\(\{ restoreFocus: false \}\)/);
assert.doesNotMatch(blockingSurface + setSurface + openMenu + closeMenu + syncMenu, /fetch\(|\/api\//);

assert.ok(keyHandler.indexOf('this.sessionMenuOpen') < keyHandler.indexOf("this.mapMode === 'full'"), 'Escape must close the local bridge before the full map');
assert.ok(keyHandler.indexOf("this.mapMode === 'full'") < keyHandler.indexOf('this.blockingSurface()'), 'Escape must keep the existing local full-map close before bridging blockers');
assert.match(keyHandler, /if \(this\.sessionMenuOpen\) return;/);
assert.match(scene, /this\.hud\.update\(world, this\.state\); this\.syncSessionMenu\(\);/);

console.log('District Party blocking overlay Escape test: PASS');
