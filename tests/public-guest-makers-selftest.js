#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const Core = require(path.join(root, 'site/guest/makers-core.js'));

const html = read('site/guest/index.html');
const makers = read('site/guest/makers.js');
const coreSource = read('site/guest/makers-core.js');
const app = read('site/guest/app.js');
const styles = read('site/guest/styles.css');
const gate = read('site/guest/demo-gate.js');
const studioEngine = read('site/guest/full/tools/studio/engine.html');
const publicStudioAdapter = read('site/guest/full/tools/studio/public-demo.js');
const audioStudio = read('site/guest/full/tools/audio-studio/index.html');
const gameForge = read('site/guest/full/tools/game-forge/index.html');
const shapeableBuilder = read('site/guest/full/tools/shapeable-builder/index.html');
const publicGameAdapter = read('site/guest/full/tools/game-forge/public-demo.js');

for (const id of ['makerStudio', 'makerSfx', 'makerGame', 'makerSite', 'studioCanvas', 'sfxCanvas', 'gameCanvas', 'sitePreview', 'artifactList']) {
  assert(html.includes(`id="${id}"`), `public maker room must include #${id}`);
}
assert(html.indexOf('makers-core.js') < html.indexOf('makers.js'));
assert(html.indexOf('makers.js') < html.indexOf('app.js'));
assert(html.includes("connect-src 'none'"), 'public maker room must keep the no-network CSP');
assert(styles.includes('.maker-deck') && styles.includes('.site-preview') && styles.includes('.game-preview'));
assert(app.includes("document.addEventListener('axm:makers-change'"), 'maker state must enter the existing session/export record');
assert(app.includes('Guest maker deck source'), 'portable project must preserve maker source');
for (const id of ['studioFullFrame', 'sfxFullFrame', 'gameFullFrame', 'siteFullFrame']) {
  assert(html.includes(`id="${id}"`), `public maker room must expose the full timed tool frame #${id}`);
}
assert(html.includes('Four real AXM workspaces. Thirty active minutes.'));
assert(makers.includes("type: 'axm:demo-session'") && makers.includes('updateDemoFrames'), 'parent session must lock and unlock every full tool');
assert(makers.includes("matchMedia('(max-width: 650px)')") && makers.includes('usesCompactMaker()'), 'phone route must choose the compact maker without changing the canonical tool');
assert(makers.includes('if (usesCompactMaker())') && makers.includes('quickMaker.open = true'), 'phone route must keep desktop iframes dormant and reveal the touch-capable maker');
assert(makers.includes('active: editable === true && !usesCompactMaker()'), 'a loaded desktop engine must pause when the viewport changes to the phone route');
assert((html.match(/data-open-quick=/g) || []).length === 4, 'every production workspace must expose an explicit phone-maker action');
assert(styles.includes('.full-tool-frame-wrap.is-mobile-route') && styles.includes('overflow-x: clip'), 'phone route must contain the desktop surface without page-level horizontal escape');
assert(gate.includes('window.top === window') && gate.includes("event.source !== window.parent"), 'full tools must refuse direct untimed entry and accept only their parent gate');
for (const [name, entry] of [['Studio', studioEngine], ['Audio Studio', audioStudio], ['Game Forge', gameForge], ['Shapeable Builder', shapeableBuilder]]) {
  assert(entry.includes("connect-src 'none'"), `${name} public route must block network transport`);
  assert(entry.includes('../../../demo-gate.js'), `${name} public route must carry the timed session gate`);
}
assert(studioEngine.includes('TOOL_REGISTRY') && studioEngine.includes('vectorObjects') && studioEngine.includes('animationFrames'), 'public Studio must be the layered/vector/animation engine');
assert(studioEngine.includes("if (!new URLSearchParams(location.search).has('public-demo')) await loadGameAssetTargets()"), 'public Studio must not probe a server-backed Game Hub through its no-network boundary');
assert(publicStudioAdapter.includes('complete browser canvas') && publicStudioAdapter.includes('local AXM'), 'public Studio must label model bridges and Game Hub installation as local-only');
assert(audioStudio.includes('sound-lab-engine.html?embedded=1') && audioStudio.includes('id="synthView"'), 'public Audio Studio must include Sound Lab and synthesis');
assert(gameForge.includes('knowledgeFrame') && gameForge.includes('physics-lab.css') && gameForge.includes('previewFrame'), 'public Game Forge must include Atlas, physics and playable preview routes');
assert(publicGameAdapter.includes('Local Workshop required') && publicGameAdapter.includes('local-required.html'), 'server-backed game assembly and LAN play must remain an explicit local boundary');
assert(shapeableBuilder.includes('id="exportHtmlButton"') && shapeableBuilder.includes('Standalone working build'), 'public Shapeable Builder must expose its real one-file exporter');

for (const [relative, source] of [['makers-core.js', coreSource], ['makers.js', makers]]) {
  for (const forbidden of [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bEventSource\b/, /\bsendBeacon\b/]) {
    assert(!forbidden.test(source), `${relative} must not contain network transport: ${forbidden}`);
  }
  new Function(source);
}
new Function(app);

const state = Core.defaultState();
assert.strictEqual(state.schema, 'axm.guest-makers/v1');
assert.deepStrictEqual(Object.keys(state).sort(), ['activeTool', 'artifacts', 'game', 'schema', 'sfx', 'site', 'studio', 'version']);

for (const preset of Object.keys(Core.SFX_PRESETS)) {
  const config = Core.preset(preset);
  const samples = Core.generateSfxSamples(config, 22050);
  assert(samples.length > 1000, `${preset} must generate audible samples`);
  assert(Array.from(samples).every(Number.isFinite), `${preset} samples must stay finite`);
  assert(Array.from(samples).every(sample => sample >= -1 && sample <= 1), `${preset} samples must stay normalized`);
  const wav = Core.encodeWav(samples, 22050);
  assert.strictEqual(Buffer.from(wav.slice(0, 4)).toString('ascii'), 'RIFF');
  assert.strictEqual(Buffer.from(wav.slice(8, 12)).toString('ascii'), 'WAVE');
}

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const gameHtml = Core.generateGameHtml({ title: '<Signal & Catch>', goal: 5, useArtwork: true }, { artworkData: onePixelPng, sfx: Core.preset('coin') });
const siteHtml = Core.generateWebsiteHtml({ brand: '<Small & Safe>', headline: 'One page', useArtwork: true }, { artworkData: onePixelPng });
assert(siteHtml.includes('overflow-wrap:anywhere'), 'website output must keep long visitor text inside narrow screens');
assert(siteHtml.includes('@media(max-width:560px)'), 'website output must carry a phone breakpoint');

for (const [kind, standalone] of [['game', gameHtml], ['website', siteHtml]]) {
  assert(standalone.startsWith('<!doctype html>'), `${kind} output must be standalone HTML`);
  assert(standalone.includes("connect-src 'none'"), `${kind} output must explicitly block connections`);
  assert(!/https?:\/\//i.test(standalone), `${kind} output must not require an external URL`);
  assert(standalone.includes(onePixelPng), `${kind} output must embed selected Studio artwork`);
  assert(!standalone.includes('<Small & Safe>') && !standalone.includes('<Signal & Catch>'), `${kind} output must escape user text`);
  const scripts = Array.from(standalone.matchAll(/<script>([\s\S]*?)<\/script>/g), match => match[1]);
  assert(scripts.length >= 1, `${kind} output must contain its local runtime`);
  scripts.forEach(script => new Function(script));
}

console.log('public guest makers selftest: PASS (full Studio, Audio Studio, Game Forge, Shapeable Builder, timed offline exports)');
