#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const U = require('./foundation-utils');
const F = require('./foundation-index');

const keyPair = crypto.generateKeyPairSync('ed25519');
const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' });
const privateKeyPem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
const signedManifest = F.extensionSandbox.createSignedManifest({ id: 'native-adapter-extension', version: '1.0.0', source: 'function () { return { planned: true }; }', public_key_pem: publicKeyPem, capabilities: [], limits: { timeout_ms: 100, max_output_bytes: 1024 } }, privateKeyPem);
const trust = { allowed_key_fingerprints: [signedManifest.key_fingerprint], revoked_manifest_digests: [], revoked_extension_ids: [] };

// #11 and #13: signed native adapter transactions, Godot project fixture, conflict protection and rollback.
const adapter = F.nativeAdapters.createAdapter({ id: 'godot-native', version: '1.0.0', host: 'godot', signed_manifest: signedManifest, trust, operations: ['import_asset', 'bind_material', 'configure_collision'], runtime_request: { id: 'godot', runtime_version: 'reviewed' } });
const baselineDigest = U.sha256('clean-godot-project');
const transaction = F.nativeAdapters.plan(adapter, { id: 'godot-import-1', baseline_digest: baselineDigest, operations: [{ type: 'import_asset', artifact_digest: U.sha256('texture') }, { type: 'bind_material', slot: 0 }], expected: { visible: true }, rollback: { baseline_digest: baselineDigest } });
assert.equal(F.nativeAdapters.apply(adapter, transaction, { current_baseline_digest: baselineDigest, runtime_resolution: { status: 'MISSING' } }).status, 'MISSING_SUBSTRATE');
assert.equal(F.nativeAdapters.apply(adapter, transaction, { current_baseline_digest: U.sha256('changed'), runtime_resolution: { status: 'READY' } }).status, 'BASELINE_CONFLICT');
const savedDigest = U.sha256('saved-godot-project');
let rollbackCalls = 0;
const fixtureExecutor = {
  identity: { kind: 'test-fixture', fresh_process: true, id: 'fixture-godot' },
  apply: () => ({ status: 'SAVED', saved_project_digest: savedDigest }),
  inspect_fresh: (request) => ({ status: 'PASS', fresh_process: true, saved_project_digest: request.saved_project_digest, transaction_digest: request.transaction_digest, visible_frame_digest: U.sha256('frame') }),
  rollback: () => { rollbackCalls += 1; return { status: rollbackCalls === 1 ? 'RESTORED' : 'UNCHANGED', current_digest: baselineDigest }; },
};
const runtimeReady = { status: 'READY', selected: { id: 'godot', runtime_version: '4.x-reviewed', artifact_sha256: U.sha256('godot-runtime') } };
const fixtureApply = F.nativeAdapters.apply(adapter, transaction, { current_baseline_digest: baselineDigest, runtime_resolution: runtimeReady, executor: fixtureExecutor });
assert.equal(fixtureApply.status, 'TEST_ONLY');
const rolledBack = F.nativeAdapters.rollback(adapter, transaction, fixtureApply, { executor: fixtureExecutor });
assert.equal(rolledBack.rollback.idempotent, true);
const godotBundle = F.nativeAdapters.createGodotProjectBundle({ project_name: 'AXM Asset Probe', resource_path: 'res://assets/texture.png', budgets: { max_frame_ms: 16.67, max_texture_memory_bytes: 8388608, max_draw_calls: 50 } });
assert.equal(godotBundle.status, 'PROJECT_FIXTURE_ONLY_NATIVE_RUN_REQUIRED');
assert.ok(godotBundle.files.find((item) => item.path === 'project.godot').text.includes('run/main_scene'));
assert.ok(godotBundle.files.find((item) => item.path === 'main.tscn').text.includes('Texture2D'));

// #14-17: real validator routes remain visibly missing; fixture execution cannot become conformance.
const validEpub = { id: 'valid-epub', mime: 'application/epub+zip', content: Buffer.from('valid epub fixture') };
const invalidEpub = { id: 'invalid-epub', mime: 'application/epub+zip', content: Buffer.from('invalid epub fixture') };
assert.equal(F.externalValidators.run(F.externalValidators.PROFILES.epubcheck, { status: 'MISSING' }, validEpub).status, 'MISSING_SUBSTRATE');
const validatorRuntime = { status: 'READY', selected: { id: 'epubcheck', runtime_version: '5-reviewed', artifact_sha256: U.sha256('epubcheck-runtime') } };
const validatorFixture = {
  identity: { kind: 'test-fixture', fresh_process: true, id: 'fixture-epubcheck' },
  run(request) {
    const pass = !request.artifact.content.toString('utf8').includes('invalid');
    return { validator_id: request.profile.id, artifact_digest: request.artifact.digest, runtime_artifact_sha256: request.runtime.artifact_sha256, pass, report: { format: 'fixture-json', messages: pass ? [] : ['deliberate invalid publication'] }, checks: [{ name: 'fixture-case', pass }] };
  },
};
const corpus = F.externalValidators.runCorpus(F.externalValidators.PROFILES.epubcheck, validatorRuntime, { valid: validEpub, invalid: invalidEpub }, validatorFixture);
assert.equal(corpus.status, 'TEST_ONLY');
for (const profileName of ['verapdf', 'pdfx', 'openimageio', 'gltf', 'ktx', 'ocio', 'materialx']) {
  const profile = F.externalValidators.PROFILES[profileName];
  const mime = profile.mimes[0];
  assert.equal(F.externalValidators.run(profile, { status: 'MISSING' }, { id: profileName + '-candidate', mime, content: Buffer.from('candidate') }).status, 'MISSING_SUBSTRATE');
}

// #12: independent renderer matrix is computed from actual captured pixels, never an SVG stand-in.
const scene = F.rendererMatrix.createScene({ id: 'material-sphere', target_canvas_digest: U.sha256('3d-canvas'), dimensions: { width: 2, height: 2 }, camera: { projection: 'perspective', position: [0, 0, 4] }, lights: [{ kind: 'area', intensity: 1 }], geometry: [{ kind: 'sphere' }], materials: [{ kind: 'standard-surface' }], colour_pipeline: { working: 'scene-linear', display: 'srgb' }, deterministic_seed: 'renderer-matrix' });
const pixelsA = Buffer.from([10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255]);
const pixelsB = Buffer.from(pixelsA);
pixelsB[0] += 1;
const captureA = F.rendererMatrix.capture(scene, { renderer: { id: 'renderer-a', version: '1', backend_family: 'raster-a' }, authority: { kind: 'native-renderer', fresh_process: true }, rgba8: pixelsA });
const captureB = F.rendererMatrix.capture(scene, { renderer: { id: 'renderer-b', version: '2', backend_family: 'raster-b' }, authority: { kind: 'native-renderer', fresh_process: true }, rgba8: pixelsB });
const renderMatrix = F.rendererMatrix.compare(scene, [captureA, captureB], { rmse: 0.01, max_channel_delta: 0.01, changed_pixel_ratio: 0.3 });
assert.equal(renderMatrix.status, 'PASS');
assert.equal(renderMatrix.pairs[0].metrics.changed_pixel_ratio, 0.25);
const fixtureCapture = F.rendererMatrix.capture(scene, { renderer: { id: 'fixture-renderer', version: '1', backend_family: 'fixture-family' }, authority: { kind: 'fixture', fresh_process: false }, rgba8: pixelsA });
assert.equal(F.rendererMatrix.compare(scene, [captureA, fixtureCapture], { rmse: 0.01, max_channel_delta: 0.01, changed_pixel_ratio: 0.3 }).status, 'TEST_ONLY');

// #18: OCIO/ACES claims require both an external processor and changed numeric pixels.
const missingColour = F.rendererMatrix.assessColourPipeline({ config: { id: 'aces', digest: U.sha256('aces-config'), version: '2' }, source_space: 'ACEScg', destination_space: 'sRGB', tolerance: 0.001, samples: [{ input: [0.1, 0.2, 0.3], expected: [0.2, 0.3, 0.4], actual: [0.2, 0.3, 0.4] }, { input: [0.2, 0.3, 0.4], expected: [0.3, 0.4, 0.5], actual: [0.3, 0.4, 0.5] }, { input: [0.4, 0.5, 0.6], expected: [0.5, 0.6, 0.7], actual: [0.5, 0.6, 0.7] }], external_receipt: { status: 'MISSING_SUBSTRATE', digest: U.sha256('missing-ocio') }, render_matrix: renderMatrix });
assert.equal(missingColour.status, 'MISSING_SUBSTRATE');
const colourPass = F.rendererMatrix.assessColourPipeline({ config: { id: 'aces', digest: U.sha256('aces-config'), version: '2' }, source_space: 'ACEScg', destination_space: 'sRGB', tolerance: 0.001, samples: [{ input: [0.1, 0.2, 0.3], expected: [0.2, 0.3, 0.4], actual: [0.2, 0.3, 0.4] }, { input: [0.2, 0.3, 0.4], expected: [0.3, 0.4, 0.5], actual: [0.3, 0.4, 0.5] }, { input: [0.4, 0.5, 0.6], expected: [0.5, 0.6, 0.7], actual: [0.5, 0.6, 0.7] }], external_receipt: { status: 'PASS', digest: U.sha256('ocio-pass') }, render_matrix: renderMatrix });
assert.equal(colourPass.status, 'PASS');

// #19: glTF fidelity binds independent validation, relevant corpus features and renderer output.
const gltfFidelity = F.rendererMatrix.assessGltfFidelity({ artifact_digest: U.sha256('glb'), validator_receipt: { status: 'PASS', digest: U.sha256('gltf-validator') }, render_matrix: renderMatrix, required_features: ['material', 'animation', 'skin'], corpus_cases: [{ id: 'material-case', features: ['material'], status: 'PASS', receipt_digest: U.sha256('m') }, { id: 'animation-skin-case', features: ['animation', 'skin'], status: 'PASS', receipt_digest: U.sha256('a') }] });
assert.equal(gltfFidelity.status, 'PASS');
assert.equal(F.rendererMatrix.assessGltfFidelity({ artifact_digest: U.sha256('glb'), validator_receipt: { status: 'MISSING_SUBSTRATE', digest: U.sha256('missing') }, render_matrix: renderMatrix, required_features: ['material'], corpus_cases: [{ id: 'case', features: ['material'], status: 'PASS', receipt_digest: U.sha256('case') }] }).status, 'MISSING_SUBSTRATE');

// #20: UASTC/HDR is checked from reference-tool payload facts and multi-target decode receipts.
const sourceTextureDigest = U.sha256('uastc-texture');
const textureMissing = F.textureMatrix.assess({ profile: 'UASTC', source_digest: sourceTextureDigest, reference_tool_receipt: { status: 'MISSING_SUBSTRATE', digest: U.sha256('missing-ktx') }, transcodes: [{ target: 'BC7', status: 'FAIL', source_digest: sourceTextureDigest, decoded_pixel_digest: U.sha256('bc7'), rmse: 1, gpu_bytes: 1024, receipt_digest: U.sha256('bc7-r') }, { target: 'ASTC', status: 'FAIL', source_digest: sourceTextureDigest, decoded_pixel_digest: U.sha256('astc'), rmse: 1, gpu_bytes: 1024, receipt_digest: U.sha256('astc-r') }], budgets: { max_rmse: 0.05, max_gpu_bytes: 4096 } });
assert.equal(textureMissing.status, 'MISSING_SUBSTRATE');
const texturePass = F.textureMatrix.assess({ profile: 'UASTC', source_digest: sourceTextureDigest, reference_tool_receipt: { status: 'PASS', digest: U.sha256('ktx-pass'), report: { encoding: 'UASTC', hdr: false, bit_depth: 8 } }, transcodes: [{ target: 'BC7', status: 'PASS', source_digest: sourceTextureDigest, decoded_pixel_digest: U.sha256('bc7'), rmse: 0.01, gpu_bytes: 1024, receipt_digest: U.sha256('bc7-r') }, { target: 'ASTC', status: 'PASS', source_digest: sourceTextureDigest, decoded_pixel_digest: U.sha256('astc'), rmse: 0.02, gpu_bytes: 1024, receipt_digest: U.sha256('astc-r') }], budgets: { max_rmse: 0.05, max_gpu_bytes: 4096 } });
assert.equal(texturePass.status, 'PASS');

// #21: MaterialX syntax cannot stand in for validator, shader generation and render parity.
const materialPass = F.rendererMatrix.assessMaterialMatrix({ graph_xml: '<materialx version="1.39"><nodegraph name="NG"/></materialx>', declared_version: '1.39', validator_receipt: { status: 'PASS', digest: U.sha256('mx-validator') }, shader_receipts: [{ backend: 'glsl', status: 'PASS', digest: U.sha256('glsl') }, { backend: 'osl', status: 'PASS', digest: U.sha256('osl') }], render_matrix: renderMatrix });
assert.equal(materialPass.status, 'PASS');
assert.equal(F.rendererMatrix.assessMaterialMatrix({ graph_xml: '<materialx version="1.39"/>', declared_version: '1.39', validator_receipt: { status: 'MISSING_SUBSTRATE', digest: U.sha256('mx-missing') }, shader_receipts: [{ backend: 'glsl', status: 'FAIL', digest: U.sha256('g') }, { backend: 'osl', status: 'FAIL', digest: U.sha256('o') }], render_matrix: renderMatrix }).status, 'MISSING_SUBSTRATE');

// #22: DTCG 2025.10 import, aliases, composite values and unknown extensions are preserved losslessly.
const tokenSource = {
  $extensions: { 'org.example.root': { untouched: true } },
  palette: { $type: 'color', blue: { $value: { colorSpace: 'srgb', components: [0, 0.4, 0.8], alpha: 1 }, $extensions: { 'org.unknown.tool': { control: 17 } } } },
  spacing: { $type: 'dimension', small: { $value: { value: 8, unit: 'px' } } },
  semantic: { primary: { $value: '{palette.blue}' }, primaryPointer: { $ref: '#/palette/blue' } },
  effects: { $type: 'shadow', raised: { $value: { color: '{palette.blue}', offsetX: '{spacing.small}', offsetY: { value: 8, unit: 'px' }, blur: { value: 16, unit: 'px' }, spread: { value: 0, unit: 'px' } } } },
  baseGroup: { $type: 'number', base: { $value: 1 } },
  extendedGroup: { $extends: '{baseGroup}', extra: { $value: 2 } },
};
const parsedTokens = F.dtcgTokens.parse(JSON.stringify(tokenSource));
assert.equal(parsedTokens.validation.pass, true, parsedTokens.validation.errors.join('; '));
assert.deepEqual(parsedTokens.tokens.find((item) => item.path === 'semantic.primary').value, tokenSource.palette.blue.$value);
assert.equal(parsedTokens.tokens.find((item) => item.path === 'semantic.primary').type, 'color');
assert.equal(parsedTokens.tokens.find((item) => item.path === 'semantic.primaryPointer').type, 'color');
assert.equal(parsedTokens.tokens.find((item) => item.path === 'effects.raised').value.offsetX.value, 8);
assert.equal(parsedTokens.original.palette.blue.$extensions['org.unknown.tool'].control, 17);
assert.ok(parsedTokens.tokens.some((item) => item.path === 'extendedGroup.base'));
const tokenTrip = F.roundTripLedger.evaluate(F.dtcgTokens.createRoundTripAdapter(), { mime: F.dtcgTokens.MEDIA_TYPE, content: JSON.stringify(tokenSource) });
assert.equal(tokenTrip.receipt.status, 'LOSSLESS');
const inferredType = F.dtcgTokens.parse({ mystery: { $value: 42 } });
assert.equal(inferredType.validation.pass, false);
assert.ok(inferredType.validation.errors.some((item) => /type cannot be determined/.test(item)));
const cyclicTokens = F.dtcgTokens.parse({ a: { $type: 'number', $value: '{b}' }, b: { $type: 'number', $value: '{a}' } });
assert.equal(cyclicTokens.validation.pass, false);
assert.ok(cyclicTokens.validation.errors.some((item) => /circular token reference/.test(item)));

// #23: WCAG checks require a real fresh-browser journey, not source/schema inspection.
const wcagPlan = F.accessibilityJourney.createPlan({ id: 'ui-component-wcag', target_canvas_digest: U.sha256('ui-canvas'), thresholds: { minimum_contrast_ratio: 4.5, minimum_target_width_css_px: 24, minimum_target_height_css_px: 24, reflow_viewport_width_css_px: 320 } });
const steps = [
  { journey: 'keyboard', focus_id: 'start', focus_visible: true, key: 'Tab', activated: false, contrast_ratio: 7, blocking_overlay: false },
  { journey: 'keyboard', focus_id: 'submit', focus_visible: true, key: 'Enter', activated: true, contrast_ratio: 5, blocking_overlay: false },
  { journey: 'pointer-targets', target_id: 'submit', width_css_px: 44, height_css_px: 44, blocking_overlay: false },
  { journey: 'reflow', viewport_width_css_px: 320, horizontal_scroll: false, content_clipped: false, blocking_overlay: false },
  { journey: 'reduced-motion', prefers_reduced_motion: true, nonessential_motion_running: false, blocking_overlay: false },
];
const liveJourney = F.accessibilityJourney.assess(wcagPlan, { plan_digest: wcagPlan.digest, source: { kind: 'live-browser', fresh_session: true, driver_receipt_digest: U.sha256('driver'), frame_receipt_digests: [U.sha256('1'), U.sha256('2'), U.sha256('3'), U.sha256('4')] }, steps });
assert.equal(liveJourney.status, 'PASS');
const staticJourney = F.accessibilityJourney.assess(wcagPlan, { plan_digest: wcagPlan.digest, source: { kind: 'source-inspection', fresh_session: false, frame_receipt_digests: [] }, steps });
assert.equal(staticJourney.status, 'MISSING_LIVE_EVIDENCE');

console.log('Asset Hands upgrade wave 2 PASS (13 adapters/validators; live-vs-fixture authority boundaries verified)');
