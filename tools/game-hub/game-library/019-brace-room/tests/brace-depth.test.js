'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };

const html = read('runtime/index.html');
const css = read('runtime/styles.css');
const app = read('runtime/app.js');
const source = read('runtime/brace-depth.js');
const manifest = JSON.parse(read('game.manifest.json'));

check(html.includes('id="scene-stack"'), 'scene stack exists');
check(html.indexOf('id="scene"') < html.indexOf('id="scene-depth"'), 'authority canvas remains below additive WebGL canvas');
check(html.indexOf('brace-depth.js') < html.indexOf('app.js'), 'depth module loads before app integration');
check(css.includes('#scene-depth'), 'depth surface has a local layout rule');
check(css.includes('pointer-events: none'), 'depth surface cannot intercept input');
check(css.includes('.theme-high-contrast #scene-depth { display: none; }'), 'high contrast explicitly retains Canvas-only presentation');
check(source.includes("PASS_ID = 'brace-room-station-depth-01'"), 'pass id is inspectable');
check(source.includes("getContext('webgl'"), 'module requests genuine WebGL');
check(source.includes('gl.enable(gl.DEPTH_TEST)'), 'depth testing is enabled');
check(source.includes('gl.drawArrays(gl.TRIANGLES'), 'module draws real triangles');
check(source.includes("dataset.authority = 'canvas2d-gameplay'"), 'authority boundary is exposed');
check(source.includes("dataset.changesAuthority = 'false'"), 'authority remains unchanged');
check(source.includes("dataset.changesCollision = 'false'"), 'collision remains unchanged');
check(source.includes("'hidden-canvas2d-only'"), 'high contrast draw route is explicit');
check(source.includes("'reduced-static'"), 'reduced-motion route is explicit');
check(!/https?:\/\//i.test(source), 'depth module is local-only');
check(app.includes('window.AXMBraceDepth.create(depthCanvas)'), 'app creates the presentation renderer');
check(app.includes('depthRenderer.draw({'), 'app registers live state to the renderer');
check(app.includes('Core.stationPosition(station)'), 'station geometry uses authored positions');
check(manifest.package.required_paths.includes('runtime/brace-depth.js'), 'manifest requires depth module');
check(manifest.package.required_paths.includes('tests/brace-depth.test.js'), 'manifest requires depth test');

const fallbackCanvas = {
  hidden: false,
  dataset: {},
  getContext() { return null; }
};
const sandbox = { window: {}, console, Math, Number, String, Object, Array, Boolean, Error, parseInt, Float32Array };
vm.runInNewContext(source, sandbox, { filename: 'brace-depth.js' });
const fallback = sandbox.window.AXMBraceDepth.create(fallbackCanvas);
check(fallback.renderer === 'canvas2d-fallback', 'no-WebGL route returns Canvas fallback');
check(fallbackCanvas.hidden === true, 'failed WebGL surface hides');
check(fallbackCanvas.dataset.renderer === 'canvas2d-fallback', 'fallback is visible in diagnostics');

console.log(`BRACE ROOM depth pass PASS · ${checks} checks`);
