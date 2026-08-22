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
const fabricCss = fs.readFileSync(path.join(root, 'css-skin-fabric-adapter.css'), 'utf8');
const assetPath = path.join(root, 'assets', 'sentient-atrium-core.webp');
const navigationAssetPath = path.join(root, 'assets', 'sentient-navigation-spine.png');
const ribbonAssetPath = path.join(root, 'assets', 'sentient-signal-ribbon.png');
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
ok(/sentient-atrium\.css\?v=20260727-atrium-4/.test(html) && /sentient-atrium\.js\?v=20260727-atrium-1/.test(html), 'versioned presentation assets are wired');
ok(/What would you like to <em>make<\/em> today\?/.test(html), 'selected editorial hierarchy is present without changing the prompt');
ok(/sentient-atrium-core\.webp/.test(css) && /prefers-reduced-motion:\s*reduce/.test(css), 'reviewed art and reduced-motion fallback are both present');
ok(/pointer-events:\s*none/.test(css) && /aria-hidden="true"/.test(html), 'visual field cannot intercept input or enter the accessibility tree');
ok(/\.sentient-atrium \.topbar \{ z-index: 12; \}/.test(css) && /\.sentient-atrium \.body \{ z-index: 2; \}/.test(css), 'floating command decks remain above the workspace interaction layer');
ok(/Presentation only/.test(css) && /no state, permission, network, lifecycle/.test(js), 'presentation-only authority boundary is explicit');
ok(/sentient-navigation-spine\.png/.test(css) && /\.sidebar::after/.test(css), 'reviewed navigation spine is wired as a noninteractive presentation layer');
ok(/#modList \.mod\s*\{[\s\S]*?min-height:\s*46px !important/.test(css), 'generated workspace routes use a compact density contract');
ok(/sidebar-section-title \+ #modList > \.side-cap:first-child/.test(css), 'duplicate first workspace group heading is visually suppressed');
ok(/sentient-signal-ribbon\.png/.test(css) && /\.ai-presence\s*\{[\s\S]*?display:\s*grid/.test(css) && /\.presence-members\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5/.test(css), 'living top ribbon and truthful one-node status lanes are wired');
ok(/QUICK CREATION LANES/.test(css) && /\.hero-meta\s*\{\s*display:\s*none/.test(css), 'creation lanes are labelled and the duplicate guarantee rail is suppressed');
ok(/One front platform/.test(fabricCss) && /\.home-grid::before\s*\{\s*display:\s*none/.test(fabricCss), 'Home and workbench use one continuous platform surface');
ok(/data-sidebar-collapsed="true"\]\s+\.sidebar\s*\{[\s\S]*?width:\s*0\s*!important/.test(fabricCss), 'collapsed phone navigation cannot occlude the platform');
ok(!/atrium-vortex\.(?:css|js)/.test(html), 'the superseded vortex layer is no longer loaded');
ok(/max-width:\s*1050px/.test(css) && /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/.test(css) && /max-width:\s*760px/.test(css), 'compact and mobile flows retain bounded responsive layouts');

ok(fs.existsSync(assetPath), 'Sentient Atrium art asset exists');
const stat = fs.statSync(assetPath);
const header = fs.readFileSync(assetPath).subarray(0, 12);
ok(stat.size > 50000 && stat.size < 250000, 'art asset is detailed but public-launch lightweight');
ok(header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP', 'art asset is a valid WebP container');

ok(fs.existsSync(navigationAssetPath), 'Sentient navigation spine asset exists');
const navigationStat = fs.statSync(navigationAssetPath);
const navigationHeader = fs.readFileSync(navigationAssetPath).subarray(0, 8);
ok(navigationStat.size > 100000 && navigationStat.size < 2500000, 'navigation art retains detailed orbital fibers within a bounded local payload');
ok(navigationHeader.toString('hex') === '89504e470d0a1a0a', 'navigation art is a valid PNG container');

ok(fs.existsSync(ribbonAssetPath), 'Sentient signal ribbon asset exists');
const ribbonStat = fs.statSync(ribbonAssetPath);
const ribbonHeader = fs.readFileSync(ribbonAssetPath).subarray(0, 8);
ok(ribbonStat.size > 100000 && ribbonStat.size < 2500000, 'signal ribbon retains detailed optical fibers within a bounded local payload');
ok(ribbonHeader.toString('hex') === '89504e470d0a1a0a', 'signal ribbon is a valid PNG container');

console.log('AXM Sentient Atrium selftest: PASS (' + passes.length + ' checks)');
passes.forEach(message => console.log('PASS ' + message));
