#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const html = read('runtime/index.html');
const app = read('runtime/app.js');
const renderer = read('runtime/hearthgate-three.js');
const styles = read('runtime/styles.css');
const manifest = JSON.parse(read('game.manifest.json'));
const packageJson = JSON.parse(read('package.json'));

assert.ok(html.includes('id="game3d"') && html.includes('id="game"'), 'the stage must contain both presentation and authoritative canvases');
assert.ok(html.indexOf('game-core.js') < html.indexOf('hearthgate-three.js') && html.indexOf('hearthgate-three.js') < html.indexOf('app.js'), 'core, WebGL presentation, and app authority must load in dependency order');
assert.ok(renderer.includes("getContext('webgl'") && renderer.includes('gl.enable(gl.DEPTH_TEST)'), 'the presentation layer must use a depth-tested WebGL context');
assert.ok(renderer.includes('floor(lit * 15.0 + 0.5) / 15.0') && renderer.includes("canvas.dataset.paletteSteps = '16'"), 'the WebGL fragment output must be quantized to sixteen channel steps');
assert.ok(renderer.includes('const OCTAHEDRON = facetedVertices(') && renderer.includes('const PYRAMID = facetedVertices('), 'the WebGL actor kit must include flat-shaded faceted meshes instead of cubes alone');
assert.ok(renderer.includes("canvas.dataset.modelProfile = 'faceted-models-v1'") && renderer.includes('canvas.dataset.triangles = String(triangles)'), 'the live canvas must disclose its model profile and submitted triangle count');
assert.ok(renderer.includes("canvas.dataset.motion = reducedMotion ? 'reduced-static' : 'animated-drift-bob'"), 'reduced-motion state must be visible in live renderer diagnostics');
assert.ok(renderer.includes("hexer") && renderer.includes("warlord") && renderer.includes('aura('), 'new tactical enemies and their readable auras must reach the 3D renderer');
assert.ok(app.includes('ctx.globalAlpha = 0.44;'), 'the authoritative Canvas actor accents must leave the faceted WebGL bodies visible');
assert.ok(app.includes('stage3d.render(timeMs, app.state, app.reducedMotion)') && app.includes("canvas.dataset.visualAuthority = stage3d.available ? 'hybrid-webgl-canvas' : 'canvas-fallback'"), 'the render loop must feed live simulation state into WebGL and disclose fallback authority');
assert.ok(styles.includes('#game3d{z-index:0') && styles.includes('#game{z-index:1'), 'the WebGL scene must sit behind the interactive Canvas layer');
assert.ok(html.includes('ENDLESS VIGIL') && html.includes('THE FIVE OATHS'), 'the player-facing route must explain the authored-to-endless progression');
assert.ok(app.includes("qaRoute === 'oath'") && app.includes("addQa('oathQaThreats'") && app.includes("addQa('oathQaComplete'") && app.includes("addQa('oathQaFall'"), 'the localhost-only visual route must expose bounded tactical, completion, and result states for live verification');
assert.strictEqual(manifest.version, packageJson.version, 'manifest and package version must agree');
assert.strictEqual(manifest.session.authored_siege_minutes, 6, 'the package must declare the bounded authored arc');
assert.ok(manifest.package.required_paths.includes('runtime/hearthgate-three.js') && manifest.package.required_paths.includes('tests/hearthgate-3d-selftest.js'), 'the package verifier must require its 3D implementation and proof');

console.log('Hearthgate 3D selftest: PASS · depth-tested low-poly WebGL, 16-step quantization, tactical auras, Canvas fallback authority, and six-minute Oathbound route');
