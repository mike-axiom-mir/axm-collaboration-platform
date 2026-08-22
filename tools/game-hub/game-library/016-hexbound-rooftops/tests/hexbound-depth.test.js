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
const depth = fs.readFileSync(path.join(root, 'runtime', 'hexbound-depth.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'game.manifest.json'), 'utf8'));
let checks = 0;

function check(value, message) { checks += 1; assert(value, message); }

check(/id="battlefield"[\s\S]*id="rooftop-depth"/.test(index), 'depth canvas must follow the authoritative battlefield');
check(index.indexOf('hexbound-depth.js') < index.indexOf('app.js'), 'depth module must load before integration');
check(/#rooftop-depth\s*\{[\s\S]*pointer-events:\s*none/.test(styles), 'depth layer must not intercept commands');
check(/image-rendering:\s*pixelated/.test(styles), 'low-poly layer must retain hard edges');
check(/getContext\('webgl'/.test(depth), 'module must request real WebGL');
check(/antialias:\s*false/.test(depth), 'module must avoid soft multisampling');
check(/gl\.DEPTH_TEST/.test(depth) && /gl\.TRIANGLES/.test(depth), 'module must render depth-tested triangles');
check(/function prism\(/.test(depth) && /function segmentBox\(/.test(depth), 'roof and bridge geometry must be explicit');
check(/visible-territory-only/.test(depth), 'diagnostics must disclose the fog policy');
check(/if \(!a \|\| !b\) return/.test(depth), 'bridges with hidden endpoints must not render');
check(/anchor\.visible/.test(depth), 'roof geometry must require current visibility');
check(/SYS\.exploredAt\(state\.visible/.test(app), 'integration must filter against temporary visible cells');
check(/depthRenderer\.render/.test(app), 'battle draw must feed the depth layer');
check(/teamColor\(building\.team/.test(app) && /teamColor\(squad\.team/.test(app), 'presentation colors must follow visible teams');
check(/changesAuthority:\s*false/.test(depth), 'depth diagnostics must refuse authority impact');
check(/changesCollision:\s*false/.test(depth), 'depth diagnostics must refuse collision impact');
check(!/Math\.random/.test(depth), 'depth geometry must be deterministic');
check(!/https?:\/\//.test(depth), 'depth layer must not fetch remote assets');
check(manifest.package.required_paths.includes('runtime/hexbound-depth.js'), 'manifest must retain the depth module');
check(manifest.package.required_paths.includes('tests/hexbound-depth.test.js'), 'manifest must retain the verifier');

const sandbox = { window: {} };
vm.runInNewContext(depth, sandbox, { filename: 'hexbound-depth.js' });
const fallbackCanvas = { dataset: {}, getContext: () => null };
const fallbackHost = { dataset: {} };
const fallback = sandbox.window.HexboundDepth.create({ canvas: fallbackCanvas, host: fallbackHost });
check(fallback === null, 'missing WebGL must preserve Canvas play');
check(fallbackCanvas.dataset.depthState === 'fallback', 'fallback canvas must disclose state');
check(fallbackHost.dataset.depthRenderer === 'canvas-fallback', 'fallback host must disclose retained renderer');

console.log('HEXBOUND depth pass PASS · ' + checks + ' checks');
