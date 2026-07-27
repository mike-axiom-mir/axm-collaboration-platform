#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Atrium = require('./sentient-atrium.js');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'sentient-atrium.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'sentient-atrium.js'), 'utf8');
const assetPath = path.join(root, 'assets', 'sentient-atrium-core.webp');
const passes = [];

function ok(value, message) {
  assert.ok(value, message);
  passes.push(message);
}

const first = Atrium.createBlueprint(1280, 720);
const replay = Atrium.createBlueprint(1280, 720);
const alternate = Atrium.createBlueprint(1280, 720, Atrium.SEED + 1);

ok(Atrium.VERSION === '0.1.0' && Atrium.SEED === 0x41584d35, 'versioned fixed visual seed');
ok(JSON.stringify(first) === JSON.stringify(replay), 'same viewport and seed replay exactly');
ok(JSON.stringify(first) !== JSON.stringify(alternate), 'different seed produces a different reviewed field');
ok(first.top.length === 18 && first.flows.length === 7 && first.nodes.length === 32, 'bounded field inventory');
ok(first.width === 1280 && first.height === 720, 'viewport dimensions are normalized explicitly');
ok(JSON.stringify(Atrium.sample(first, 5000, false)) === JSON.stringify(Atrium.sample(first, 5000, false)), 'same time sample replays exactly');
ok(JSON.stringify(Atrium.sample(first, 5000, true)) === JSON.stringify(Atrium.sample(first, 0, true)), 'reduced-motion sample is stable and time independent');
ok(!/Math\.random|fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|setInterval/.test(js), 'renderer has no random, network, storage, or private timer seam');
ok(/requestAnimationFrame/.test(js) && /visibilitychange/.test(js) && /prefers-reduced-motion/.test(js), 'animation is visible-frame bounded, visibility aware, and motion safe');
ok(/enhanceTitle/.test(js) && /createElement\('em'\)/.test(js), 'runtime title accent survives Hub mode hydration deterministically');
ok(/sentientRibbonTime/.test(html) && /MutationObserver\(syncClock\)/.test(js), 'truthful local time reuses observable Hub updates without a private clock interval');
ok(/data-axm-visual-generation="2050"/.test(html) && /id="sentientSignalField"/.test(html), 'Hub declares the 2050 surface and nonsemantic signal canvas');
ok(/sentient-atrium\.css\?v=20260727-atrium-1/.test(html) && /sentient-atrium\.js\?v=20260727-atrium-1/.test(html), 'versioned presentation assets are wired');
ok(/What would you like to <em>make<\/em> today\?/.test(html), 'selected editorial hierarchy is present without changing the prompt');
ok(/sentient-atrium-core\.webp/.test(css) && /prefers-reduced-motion:\s*reduce/.test(css), 'reviewed art and reduced-motion fallback are both present');
ok(/pointer-events:\s*none/.test(css) && /aria-hidden="true"/.test(html), 'visual field cannot intercept input or enter the accessibility tree');
ok(/\.sentient-atrium \.topbar \{ z-index: 12; \}/.test(css) && /\.sentient-atrium \.body \{ z-index: 2; \}/.test(css), 'floating command decks remain above the workspace interaction layer');
ok(/Presentation only/.test(css) && /no state, permission, network, lifecycle/.test(js), 'presentation-only authority boundary is explicit');

ok(fs.existsSync(assetPath), 'Sentient Atrium art asset exists');
const stat = fs.statSync(assetPath);
const header = fs.readFileSync(assetPath).subarray(0, 12);
ok(stat.size > 50000 && stat.size < 250000, 'art asset is detailed but public-launch lightweight');
ok(header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP', 'art asset is a valid WebP container');

console.log('AXM Sentient Atrium selftest: PASS (' + passes.length + ' checks)');
passes.forEach(message => console.log('PASS ' + message));
