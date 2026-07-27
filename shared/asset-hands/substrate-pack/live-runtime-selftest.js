#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const Codec = require('../accessible-document-codec');
const Validators = require('../upgrade-program/external-validators');
const NativeAdapters = require('../upgrade-program/native-adapters');
const BlenderCapabilities = require('./blender-capability-executor');
const BlenderLive = require('./blender-live-executor');
const GodotLive = require('./godot-live-executor');
const FfmpegCapabilities = require('./ffmpeg-capability-executor');
const EmbroideryCapabilities = require('./embroidery-capability-executor');
const ThreeMfCapabilities = require('./three-mf-capability-executor');
const BrepStepCapabilities = require('./brep-step-capability-executor');
const Pack = require('./pack-core');
const Live = require('./live-executor');

function argument(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; }
const root = argument('--root');
if (!root) throw new Error('usage: node live-runtime-selftest.js --root <installed substrate root>');
const inventorySnapshot = Pack.inventory({ root });
const executor = Live.createExecutor({ root, inventory: inventorySnapshot });

function validate(profileName, artifact) {
  const profile = Validators.PROFILES[profileName];
  const resolution = executor.resolve(profile);
  assert.equal(resolution.status, 'READY', profileName + ' substrate must be ready');
  return Validators.run(profile, resolution, artifact, executor);
}

const only = argument('--only');
if (only === 'gltf') {
  const content = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: 'AXM live substrate selftest' }, nodes: [{ name: 'Root' }], scenes: [{ nodes: [0] }], scene: 0 }));
  const receipt = validate('gltf', { id: 'valid-gltf', mime: 'model/gltf+json', content });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exit(receipt.status === 'PASS' ? 0 : 1);
}
if (only === 'materialx') {
  const content = Buffer.from('<materialx version="1.39"><standard_surface name="SR" type="surfaceshader" base_color="0.4, 0.2, 0.1"/><surfacematerial name="MAT" type="material"><input name="surfaceshader" type="surfaceshader" nodename="SR"/></surfacematerial></materialx>');
  const receipt = validate('materialx', { id: 'valid-materialx', mime: 'application/mtlx+xml', content });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exit(receipt.status === 'PASS' ? 0 : 1);
}
if (only === 'godot') {
  const bundle = NativeAdapters.createGodotProjectBundle({ project_name: 'AXM Live Probe', resource_path: 'res://assets/texture.png', budgets: { max_frame_ms: 1000, max_texture_memory_bytes: 1048576, max_draw_calls: 100 } });
  const content = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const receipt = GodotLive.createExecutor({ root, inventory: inventorySnapshot, visual: true }).run(bundle, { path: bundle.resource_path, mime: 'image/png', content });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exit(receipt.status === 'PASS' ? 0 : 1);
}
if (only === 'blender') {
  const receipt = BlenderLive.createExecutor({ root, inventory: inventorySnapshot }).run();
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exit(receipt.status === 'PASS' ? 0 : 1);
}
if (only === 'blender-capabilities') {
  const receipt = BlenderCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exit(receipt.status === 'PASS' ? 0 : 1);
}
if (only === 'ffmpeg') {
  const receipt = FfmpegCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exit(receipt.status === 'PASS' ? 0 : 1);
}
if (only === 'embroidery') {
  const receipt = EmbroideryCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exit(receipt.status === 'PASS' ? 0 : 1);
}
if (only === 'three-mf') {
  const receipt = ThreeMfCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exit(receipt.status === 'PASS' ? 0 : 1);
}
if (only === 'brep-step') {
  const receipt = BrepStepCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exit(receipt.status === 'PASS' ? 0 : 1);
}

const document = {
  schema: 'axm.accessible-document/v1', version: '1.0.0', id: 'live-substrate-test', title: 'Live substrate test', language: 'en', direction: 'ltr',
  sections: [{ id: 'heading', role: 'heading-1', text: 'Live substrate test', alt_text: null }, { id: 'body', role: 'paragraph', text: 'Independent validator evidence.', alt_text: null }],
  reading_order: ['heading', 'body'], accessibility: { reading_order: true, alternative_text: true, structural_navigation: true, keyboard_navigation: true }
};

const epubBytes = Buffer.from(Codec.epub(document).bytes);
const invalidEpub = Buffer.from(epubBytes); invalidEpub[invalidEpub.indexOf('application/epub+zip')] = 0x58;
const epubProfile = Validators.PROFILES.epubcheck;
const epubCorpus = Validators.runCorpus(epubProfile, executor.resolve(epubProfile), {
  valid: { id: 'valid-epub', mime: 'application/epub+zip', content: epubBytes },
  invalid: { id: 'invalid-epub', mime: 'application/epub+zip', content: invalidEpub }
}, executor);
assert.equal(epubCorpus.status, 'PASS', JSON.stringify(epubCorpus));

const gltf = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: 'AXM live substrate selftest' }, nodes: [{ name: 'Root' }], scenes: [{ nodes: [0] }], scene: 0 }));
const gltfReceipt = validate('gltf', { id: 'valid-gltf', mime: 'model/gltf+json', content: gltf });
assert.equal(gltfReceipt.status, 'PASS', JSON.stringify(gltfReceipt));
assert.equal(validate('gltf', { id: 'invalid-gltf', mime: 'model/gltf+json', content: Buffer.from('{"asset":{}}') }).status, 'FAIL');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
assert.equal(validate('openimageio', { id: 'valid-png', mime: 'image/png', content: png }).status, 'PASS');
assert.equal(validate('openimageio', { id: 'invalid-png', mime: 'image/png', content: Buffer.from('not-png') }).status, 'FAIL');
const ocio = validate('ocio', { id: 'ocio-png', mime: 'image/png', content: png });
assert.equal(ocio.status, 'PASS', JSON.stringify(ocio));
assert(ocio.report.official.ocio.samples.every((sample) => sample.input.some((value, index) => Math.abs(value - sample.output[index]) > 1e-7)));

const materialx = Buffer.from('<materialx version="1.39"><standard_surface name="SR" type="surfaceshader" base_color="0.4, 0.2, 0.1"/><surfacematerial name="MAT" type="material"><input name="surfaceshader" type="surfaceshader" nodename="SR"/></surfacematerial></materialx>');
const materialReceipt = validate('materialx', { id: 'valid-materialx', mime: 'application/mtlx+xml', content: materialx });
assert.equal(materialReceipt.status, 'PASS', JSON.stringify(materialReceipt));
assert.equal(validate('materialx', { id: 'invalid-materialx', mime: 'application/mtlx+xml', content: Buffer.from('<materialx version="1.39"><broken>') }).status, 'FAIL');

const localRoot = Pack.assertSafeRoot(root);
const corpusRoot = path.resolve(localRoot, '.selftest-corpus');
if (!corpusRoot.startsWith(path.resolve(localRoot) + path.sep)) throw new Error('selftest corpus escaped root');
fs.mkdirSync(corpusRoot, { recursive: true });
const raw = path.join(corpusRoot, 'pixel.rgba');
const ktx = path.join(corpusRoot, 'pixel.ktx2');
const exr = path.join(corpusRoot, 'pixel.exr');
try {
  fs.writeFileSync(raw, Buffer.from([255, 0, 0, 255]));
  const lock = Pack.loadLock();
  const tool = Pack.entrypointPath(localRoot, Pack.entryById(lock, 'ktx-tools'), 'ktx');
  const created = childProcess.spawnSync(tool, ['create', '--testrun', '--raw', '--width', '1', '--height', '1', '--format', 'R8G8B8A8_SRGB', raw, ktx], { encoding: 'utf8', windowsHide: true, shell: false, timeout: 30000 });
  assert.equal(created.status, 0, created.stderr);
  assert.equal(validate('ktx', { id: 'valid-ktx2', mime: 'image/ktx2', content: fs.readFileSync(ktx) }).status, 'PASS');
  assert.equal(validate('ktx', { id: 'invalid-ktx2', mime: 'image/ktx2', content: Buffer.from('not-ktx2') }).status, 'FAIL');
  const python = Pack.entrypointPath(localRoot, Pack.entryById(lock, 'python-cpython'), 'python');
  const exrCode = "import OpenImageIO as o, numpy as n, sys\np=sys.argv[1]\ns=o.ImageSpec(1,1,4,o.FLOAT)\nw=o.ImageOutput.create(p)\nassert w and w.open(p,s)\nassert w.write_image(n.array([[[1.0,0.25,0.0,1.0]]],dtype=n.float32))\nw.close()";
  const exrCreated = childProcess.spawnSync(python, ['-c', exrCode, exr], { encoding: 'utf8', windowsHide: true, shell: false, timeout: 30000 });
  assert.equal(exrCreated.status, 0, exrCreated.stderr);
  const exrReceipt = validate('openimageio', { id: 'valid-exr', mime: 'image/exr', content: fs.readFileSync(exr) });
  assert.equal(exrReceipt.status, 'PASS', JSON.stringify(exrReceipt));
  assert.equal(exrReceipt.report.official.checks.find((check) => check.name === 'openexr-read').pass, true);
} finally {
  fs.rmSync(corpusRoot, { recursive: true, force: true });
}

const godotBundle = NativeAdapters.createGodotProjectBundle({ project_name: 'AXM Live Probe', resource_path: 'res://assets/texture.png', budgets: { max_frame_ms: 1000, max_texture_memory_bytes: 1048576, max_draw_calls: 100 } });
const godotHeadless = GodotLive.createExecutor({ root, inventory: inventorySnapshot }).run(godotBundle, { path: godotBundle.resource_path, mime: 'image/png', content: png });
assert.equal(godotHeadless.status, 'VISUAL_OR_BUDGET_HOLD');
assert.equal(godotHeadless.metrics.texture_loaded, true);
assert.equal(godotHeadless.frame_digest, null);
const godotVisual = GodotLive.createExecutor({ root, inventory: inventorySnapshot, visual: true }).run(godotBundle, { path: godotBundle.resource_path, mime: 'image/png', content: png });
assert.equal(godotVisual.status, 'PASS', JSON.stringify(godotVisual));
assert(godotVisual.frame_digest);

const blenderRender = BlenderLive.createExecutor({ root, inventory: inventorySnapshot }).run();
assert.equal(blenderRender.status, 'PASS', JSON.stringify(blenderRender));
assert.equal(blenderRender.deterministic_pixel_match, true);
assert.equal(blenderRender.runs.length, 2);
assert(blenderRender.runs.every((run) => run.editable_source_digest));
const blenderCapabilities = BlenderCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
assert.equal(blenderCapabilities.status, 'PASS', JSON.stringify(blenderCapabilities));
assert.deepEqual(blenderCapabilities.provides_substrates, ['rig-runtime', 'simulation-runtime', 'texture-baker']);
const ffmpegCapabilities = FfmpegCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
assert.equal(ffmpegCapabilities.status, 'PASS', JSON.stringify(ffmpegCapabilities));
assert.deepEqual(ffmpegCapabilities.provides_substrates, ['independent-audio-decoder', 'independent-av-decoder', 'loudness-meter', 'video-muxer']);
const embroideryCapabilities = EmbroideryCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
assert.equal(embroideryCapabilities.status, 'PASS', JSON.stringify(embroideryCapabilities));
assert.deepEqual(embroideryCapabilities.provides_substrates, ['embroidery-parser-or-simulator']);
const threeMfCapabilities = ThreeMfCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
assert.equal(threeMfCapabilities.status, 'PASS', JSON.stringify(threeMfCapabilities));
assert.equal(threeMfCapabilities.known_upstream_headline_bug_observed, true);
assert.deepEqual(threeMfCapabilities.provides_substrates, ['official-3mf-validator']);
const brepStepCapabilities = BrepStepCapabilities.createExecutor({ root, inventory: inventorySnapshot }).run();
assert.equal(brepStepCapabilities.status, 'PASS', JSON.stringify(brepStepCapabilities));
assert.deepEqual(brepStepCapabilities.provides_substrates, ['brep-step-kernel']);

const pdf = Buffer.from(Codec.pdf(document, { width: 612, height: 792, unit: 'px' }).bytes);
const vera = validate('verapdf', { id: 'tagged-non-pdfa-pdf', mime: 'application/pdf', content: pdf });
assert.equal(vera.status, 'FAIL', 'veraPDF must honestly reject a tagged PDF that does not claim PDF/A');
assert.equal(vera.executor.kind, 'external-process');

const inventory = Pack.inventory({ root });
assert.deepEqual(inventory.counts, { READY: 21 });
assert.deepEqual(inventory.composition_counts, { READY: 1 });
assert(inventory.available_substrates.includes('offline-renderer'));
assert(inventory.available_substrates.includes('cross-renderer-runtime'));
assert(inventory.available_substrates.includes('texture-baker'));
assert(inventory.available_substrates.includes('rig-runtime'));
assert(inventory.available_substrates.includes('simulation-runtime'));
assert(inventory.available_substrates.includes('independent-audio-decoder'));
assert(inventory.available_substrates.includes('independent-av-decoder'));
assert(inventory.available_substrates.includes('loudness-meter'));
assert(inventory.available_substrates.includes('video-muxer'));
assert(inventory.available_substrates.includes('embroidery-parser-or-simulator'));
assert(inventory.available_substrates.includes('official-3mf-validator'));
assert(inventory.available_substrates.includes('brep-step-kernel'));
assert.equal(Pack.resolveRequest({ id: 'offline-renderer' }, { root, inventory }).status, 'READY');
assert.equal(Pack.resolveRequest({ id: 'cross-renderer-runtime' }, { root, inventory }).status, 'READY');
assert(!JSON.stringify({ inventory, epubCorpus, ocio, materialReceipt, godotHeadless, godotVisual, blenderRender, blenderCapabilities, ffmpegCapabilities, embroideryCapabilities, threeMfCapabilities, brepStepCapabilities }).includes(path.resolve(root)), 'public receipts must not retain the local root');
assert.equal(fs.existsSync(path.join(localRoot, '.jobs')) && fs.readdirSync(path.join(localRoot, '.jobs')).length > 0, false, 'validator jobs must be removed');
console.log('AXM live substrate PASS (21 exact components; EPUB/glTF/image/EXR/KTX2/MaterialX/OCIO/veraPDF; Godot frame; Blender Cycles plus texture-bake/rig/simulation; FFmpeg mux/decode/loudness; DST parse/simulation; official 3MF validation; B-rep/STEP round-trip; no retained jobs)');
