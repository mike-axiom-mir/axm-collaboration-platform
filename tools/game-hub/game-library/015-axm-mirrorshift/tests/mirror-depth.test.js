#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'runtime', 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'runtime', 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'runtime', 'app.js'), 'utf8');
const depth = fs.readFileSync(path.join(root, 'runtime', 'mirror-depth.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'game.manifest.json'), 'utf8'));
let checks = 0;

function check(value, message) { checks += 1; assert(value, message); }

check(/id="gameCanvas"[\s\S]*id="depthCanvas"/.test(index), 'depth canvas must follow the authoritative Canvas surface');
check(/mirror-depth\.js\?v=0\.1\.0/.test(index), 'local depth module must be packaged');
check(index.indexOf('mirror-depth.js') < index.indexOf('app.js?v='), 'depth module must load before app integration');
check(/#depthCanvas\s*\{[\s\S]*position:\s*absolute/.test(styles), 'depth canvas must overlay the game surface');
check(/#depthCanvas\s*\{[\s\S]*pointer-events:\s*none/.test(styles), 'depth canvas must not intercept play');
check(/image-rendering:\s*pixelated/.test(styles), 'depth surface must preserve low-resolution edges');
check(/canvas-2d\+webgl-depth/.test(app), 'diagnostics must disclose the hybrid renderer');
check(app.indexOf('const reducedMotion =') < app.indexOf('const depthRenderer ='), 'motion preference must exist before depth initialization');
check(/URLSearchParams[\s\S]*motion['"]\)\s*===\s*['"]reduced/.test(app), 'bounded browser verification route must expose reduced motion');
check(/depthRenderer\.render\(state/.test(app), 'render loop must feed authoritative presentation state to depth');
check(/depthRenderer\.clear\(\)/.test(app), 'waiting state must clear stale WebGL output');
check(/mirrorshift-neon-depth-01/.test(depth), 'pass id must be stable');
check(/getContext\('webgl'/.test(depth), 'module must request real WebGL');
check(/antialias:\s*false/.test(depth), 'low-poly surface must avoid soft multisampling');
check(/gl\.DEPTH_TEST/.test(depth), '3D surface must use a depth buffer');
check(/gl\.TRIANGLES/.test(depth), '3D surface must submit triangles');
check(/function prism\(/.test(depth) && /function diamond\(/.test(depth), 'faceted primitives must be explicit');
check(/track\.points/.test(depth), 'depth props must register to authored track geometry');
check(/settingsView\.racers/.test(depth), 'kart canopies must follow presentation racers');
check(/changesAuthority:\s*false/.test(depth), 'diagnostics must refuse authority claims');
check(/changesCollision:\s*false/.test(depth), 'diagnostics must refuse collision claims');
check(/canvas-fallback/.test(depth), 'WebGL failure must expose Canvas fallback');
check(!/Math\.random/.test(depth), 'depth dressing must be deterministic');
check(!/https?:\/\//.test(depth), 'depth module must not fetch remote assets');
check(manifest.package.required_paths.includes('runtime/mirror-depth.js'), 'manifest must retain the depth module');
check(manifest.package.required_paths.includes('tests/mirror-depth.test.js'), 'manifest must retain the depth verifier');

const sandbox = { window: {} };
vm.runInNewContext(depth, sandbox, { filename: 'mirror-depth.js' });
const fallbackCanvas = { dataset: {}, getContext: () => null };
const fallbackHost = { dataset: {} };
const fallback = sandbox.window.MirrorShiftDepth.create({ canvas: fallbackCanvas, host: fallbackHost });
check(fallback === null, 'missing WebGL must preserve the Canvas fallback route');
check(fallbackCanvas.dataset.depthState === 'fallback', 'fallback canvas must disclose its state');
check(fallbackHost.dataset.depthRenderer === 'canvas-fallback', 'fallback host must disclose the retained renderer');

console.log('MIRRORSHIFT depth pass PASS · ' + checks + ' checks');
