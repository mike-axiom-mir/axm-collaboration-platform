#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const Hands = require('../asset-hands');
const U = require('./foundation-utils');
const Foundation = require('./foundation-index');

function throwsMatch(fn, pattern) {
  assert.throws(fn, pattern);
}

const canvasDigest = U.sha256({ medium: 'ui', dimensions: { width: 128, height: 128, unit: 'px' } });

// #1: human visual quality gate. Machine evidence cannot occupy the human seat.
const benchmark = Foundation.qualityGate.createBenchmark({
  id: 'ui-icon-floor',
  title: 'UI icon visual floor',
  intended_use: 'icon',
  target_canvas_digest: canvasDigest,
  minimum_overall: 0.75,
  criteria: [
    { id: 'clarity', label: 'Clarity', weight: 2, minimum: 0.7, evidence_kind: 'visual' },
    { id: 'coherence', label: 'Coherence', weight: 1, minimum: 0.7, evidence_kind: 'visual' },
    { id: 'finish', label: 'Finish', weight: 1, minimum: 0.7, evidence_kind: 'visual' },
  ],
  references: [{ id: 'owned-reference', title: 'Owned reference', digest: U.sha256('reference'), mime: 'image/png', role: 'quality-floor', rights: 'original' }],
});
const technicalReceipt = { status: 'PASS', receipt_id: 'technical-1', digest: U.sha256('technical') };
const gate = Foundation.qualityGate.openGate({ candidate_id: 'candidate-1', candidate_digest: U.sha256('candidate'), target_canvas_digest: canvasDigest, benchmark, technical_receipts: [technicalReceipt] });
assert.equal(gate.status, 'PENDING_HUMAN_REVIEW');
assert.equal(gate.promotion.automatic, false);
const observed = Foundation.qualityGate.addMachineObservation(gate, { id: 'machine-1', candidate_digest: gate.candidate_digest, observer: { id: 'visual-probe' }, summary: 'Automated measurements only', measurements: { contrast: 5.2 } });
assert.equal(observed.status, 'PENDING_HUMAN_REVIEW');
throwsMatch(() => Foundation.qualityGate.submitHumanReview(gate, { schema: Foundation.qualityGate.REVIEW_SCHEMA, candidate_digest: gate.candidate_digest, benchmark_digest: benchmark.digest, reviewer: { id: 'robot', kind: 'machine' } }), /human seat/);
const tamperedBenchmark = U.clone(benchmark);
tamperedBenchmark.minimum_overall = 0;
throwsMatch(() => Foundation.qualityGate.openGate({ candidate_id: 'forged', candidate_digest: U.sha256('forged'), target_canvas_digest: canvasDigest, benchmark: tamperedBenchmark, technical_receipts: [technicalReceipt] }), /digest mismatch/);
const reviewed = Foundation.qualityGate.submitHumanReview(gate, {
  schema: Foundation.qualityGate.REVIEW_SCHEMA,
  id: 'human-review-1',
  candidate_digest: gate.candidate_digest,
  benchmark_digest: benchmark.digest,
  reviewer: { id: 'human-reviewer', kind: 'human' },
  consent_receipt: { granted: true, action: 'review-visual-quality', candidate_digest: gate.candidate_digest },
  verdict: 'ACCEPT_FOR_TEST',
  scores: [{ criterion_id: 'clarity', score: 0.9 }, { criterion_id: 'coherence', score: 0.8 }, { criterion_id: 'finish', score: 0.8 }],
  summary: 'Accepted for bounded testing, not canon.',
  reviewed_at: '2026-07-19T18:00:00.000Z',
});
assert.equal(reviewed.status, 'ACCEPTED_FOR_TEST');
assert.equal(reviewed.promotion.status, 'ELIGIBLE_FOR_EXISTING_DUAL_REVIEW');
assert.equal(reviewed.promotion.canon, false);

// #2: coherent reference-family generator emits real, distinct SVG artifacts.
const style = Foundation.familyCoherence.createStyleContract({
  id: 'soft-machines', title: 'Soft machines', target_canvas_digest: canvasDigest,
  palette: ['#1a2238', '#9daaf2', '#ff6a3d'], shape_language: ['rounded', 'geometric'],
  material_language: ['matte', 'soft glow'], detail_density: 0.6, seed: 'family-seed',
});
const family = Foundation.familyCoherence.createReferenceFamily({
  id: 'machine-family', title: 'Machine family', style, width: 128, height: 128,
  members: [
    { id: 'builder', role: 'builder', intended_use: 'character', label: 'Builder' },
    { id: 'validator', role: 'validator', intended_use: 'character', label: 'Validator' },
    { id: 'porter', role: 'porter', intended_use: 'character', label: 'Porter' },
  ],
});
assert.equal(family.artifacts.length, 3);
assert.equal(new Set(family.artifacts.map((item) => item.digest)).size, 3);
assert.ok(family.artifacts.every((item) => item.mime === 'image/svg+xml' && item.format === 'SVG' && item.text.startsWith('<svg')));
assert.equal(family.coherence_receipt.human_visual_review, 'PENDING');
assert.equal(family.coherence_receipt.automatic_promotion, false);

// #3: conformance is claim-by-claim and absent evidence remains UNPROVEN.
const descriptor = Hands.list().find((item) => item.id === 'ui-component');
const claims = Foundation.conformance.claimIds(descriptor);
const proof = {};
claims.forEach((id) => { proof[id] = { status: 'PASS', receipt_id: 'proof-' + U.sha256(id).slice(0, 10), digest: U.sha256(id) }; });
const conformant = Foundation.conformance.buildMatrix([descriptor], [{ hand_id: descriptor.id, hand_version: descriptor.version, claims: proof }], { validateDescriptor: Hands.validateDescriptor });
assert.equal(conformant.status, 'CONFORMANT');
const missingProof = U.clone(proof);
delete missingProof[claims[0]];
assert.equal(Foundation.conformance.buildMatrix([descriptor], [{ hand_id: descriptor.id, hand_version: descriptor.version, claims: missingProof }], { validateDescriptor: Hands.validateDescriptor }).status, 'UNPROVEN');
const fakeSvg = U.clone(descriptor);
fakeSvg.output_types[0].format = 'SVG';
fakeSvg.output_types[0].mime = 'image/png';
assert.equal(Foundation.conformance.lintDescriptor(fakeSvg).pass, false);

// #4: universal edit kernel is immutable, undoable, and cycle-safe.
const document = Foundation.editKernel.createDocument({
  id: 'edit-doc', target_canvas: { medium: 'ui' },
  nodes: [
    { id: 'a', kind: 'shape', bounds: { x: 0, y: 0, width: 10, height: 10 } },
    { id: 'b', kind: 'shape', bounds: { x: 20, y: 5, width: 10, height: 10 } },
    { id: 'c', kind: 'shape', bounds: { x: 40, y: 10, width: 10, height: 10 } },
  ],
});
let session = Foundation.editKernel.createSession(document, 10);
session = Foundation.editKernel.apply(session, { type: 'select', ids: ['a', 'b', 'c'] });
session = Foundation.editKernel.apply(session, { type: 'align', axis: 'y', mode: 'center' });
session = Foundation.editKernel.apply(session, { type: 'group', id: 'group-1' });
assert.equal(document.nodes.length, 3, 'source document must remain immutable');
assert.equal(session.document.nodes.length, 4);
const groupedDigest = Foundation.editKernel.documentDigest(session.document);
session = Foundation.editKernel.undo(session);
assert.equal(session.document.nodes.length, 3);
session = Foundation.editKernel.redo(session);
assert.equal(Foundation.editKernel.documentDigest(session.document), groupedDigest);
const cycleDoc = Foundation.editKernel.createDocument({ id: 'cycle-doc', nodes: [
  { id: 'root', bounds: { x: 0, y: 0, width: 10, height: 10 } },
  { id: 'child', parent_id: 'root', bounds: { x: 0, y: 0, width: 5, height: 5 } },
] });
throwsMatch(() => Foundation.editKernel.apply(Foundation.editKernel.createSession(cycleDoc), { type: 'reparent', id: 'root', parent_id: 'child' }), /parent cycle/);

// #5: runtime resolution is exact, licence-reviewed, digest-bound, and path-free.
const runtimeDigest = U.sha256('runtime-artifact');
const runtimeManifest = Foundation.runtimeSubstrates.createManifest({
  id: 'raster-runtime', runtime_version: '2.0.0', artifact_sha256: runtimeDigest,
  licence: { spdx: 'Apache-2.0', review_status: 'APPROVED', reviewed_by: 'foundation-review', receipt_digest: U.sha256('licence') },
  capabilities: ['decode:png', 'encode:png'], compatibility: { platforms: ['win32-x64'], api_versions: ['1'] },
  network_required: false, source: 'bundled-reviewed-artifact',
});
const runtimeRequest = { id: 'raster-runtime', runtime_version: '2.0.0', platform: 'win32-x64', api_version: '1', capabilities: ['encode:png'] };
assert.equal(Foundation.runtimeSubstrates.resolve([runtimeManifest], [{ id: 'raster-runtime', runtime_version: '2.0.0', present: true, artifact_sha256: runtimeDigest }], runtimeRequest).status, 'READY');
assert.equal(Foundation.runtimeSubstrates.resolve([runtimeManifest], [{ id: 'raster-runtime', runtime_version: '2.0.0', present: true, artifact_sha256: U.sha256('tampered') }], runtimeRequest).status, 'TAMPERED');
assert.equal(Foundation.runtimeSubstrates.resolve([], [], runtimeRequest).status, 'MISSING');
assert.equal(Foundation.runtimeSubstrates.resolve([runtimeManifest], [{ id: 'raster-runtime', runtime_version: '2.0.0', present: true, artifact_sha256: runtimeDigest }], Object.assign({}, runtimeRequest, { platform: 'linux-arm64' })).status, 'INCOMPATIBLE');
throwsMatch(() => Foundation.runtimeSubstrates.createManifest(Object.assign({}, runtimeManifest, { schema: undefined, local_path: 'C:\\secret' })), /private runtime field forbidden/);

// #6: host-neutral negotiation preserves visible honest failure and chooses a real route.
const host = Foundation.negotiationSdk.createHostFixture(['svg', 'json', 'canvas-2d']);
const client = Foundation.negotiationSdk.createClient(Hands, Object.assign({}, host, { permissions: [], accepts: [Hands.RESULT_SCHEMA, 'image/svg+xml', 'application/json'] }));
const uiBrief = {
  id: 'sdk-ui', title: 'SDK UI', kind: 'ui-component', intended_use: 'ui-component',
  target_canvas: { medium: 'ui', dimensions: { width: 128, height: 128, unit: 'px' }, colour: { space: 'srgb', transparency: 'allowed', minimum_contrast_ratio: 4.5 }, behaviour: ['static'], intended_use: 'ui-component' },
  required_outputs: ['image/svg+xml'], editable_recipe_formats: ['axm.ui-component-recipe/v1'],
};
const negotiated = client.negotiate(uiBrief);
assert.equal(negotiated.status, 'READY');
assert.equal(negotiated.selected.id, 'ui-component');
assert.equal(negotiated.fallback_used, false);
const unsupported = Foundation.negotiationSdk.createClient({ diagnose: () => ({ status: 'UNSUPPORTED_CANVAS', reason: '3D surface convention unsupported', missing: ['spatial.uv-convention'] }) }).negotiate(uiBrief);
assert.equal(unsupported.status, 'UNSUPPORTED_CANVAS');
assert.equal(unsupported.selected, null);

// #7: round-trip ledger keeps exact source and distinguishes MIME from semantics.
function jsonImport(content) {
  const documentValue = JSON.parse(content.toString('utf8'));
  return { document: documentValue, facts: documentValue };
}
const jsonAdapter = Foundation.roundTripLedger.createAdapter({
  id: 'json-lossless', version: '1.0.0', input_mime: 'application/json', output_mime: 'application/json',
  known_losses: [], import_content: jsonImport, export_content: (value) => ({ mime: 'application/json', content: JSON.stringify(value), losses: [] }),
});
const roundTrip = Foundation.roundTripLedger.evaluate(jsonAdapter, { mime: 'application/json', content: '{"title":"asset","layers":3}' });
assert.equal(roundTrip.receipt.status, 'LOSSLESS');
assert.equal(Buffer.from(roundTrip.receipt.exact_source.content, 'base64').toString('utf8'), '{"title":"asset","layers":3}');
const lossyAdapter = Foundation.roundTripLedger.createAdapter({
  id: 'json-lossy', version: '1.0.0', input_mime: 'application/json', output_mime: 'application/json', known_losses: ['$.secret'], import_content: jsonImport,
  export_content: (value) => { delete value.secret; return { mime: 'application/json', content: JSON.stringify(value), losses: ['$.secret'] }; },
});
assert.equal(Foundation.roundTripLedger.evaluate(lossyAdapter, { mime: 'application/json', content: '{"title":"asset","secret":true}' }).receipt.status, 'DECLARED_LOSS');
const dishonestAdapter = Foundation.roundTripLedger.createAdapter({
  id: 'json-undisclosed-loss', version: '1.0.0', input_mime: 'application/json', output_mime: 'application/json', known_losses: [], import_content: jsonImport,
  export_content: (value) => { delete value.secret; return { mime: 'application/json', content: JSON.stringify(value), losses: [] }; },
});
assert.equal(Foundation.roundTripLedger.evaluate(dishonestAdapter, { mime: 'application/json', content: '{"title":"asset","secret":true}' }).receipt.status, 'FAIL');
const rasterBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const rasterAdapter = Foundation.roundTripLedger.createAdapter({
  id: 'png-passthrough', version: '1.0.0', input_mime: 'image/png', output_mime: 'image/png', known_losses: [],
  import_content: (content) => ({ document: { base64: content.toString('base64') }, facts: { mime: 'image/png', bytes: content.length } }),
  export_content: (value) => ({ mime: 'image/png', content: Buffer.from(value.base64, 'base64'), losses: [] }),
});
const rasterTrip = Foundation.roundTripLedger.evaluate(rasterAdapter, { mime: 'image/png', content: rasterBytes });
assert.equal(rasterTrip.receipt.status, 'LOSSLESS');
assert.equal(rasterTrip.receipt.input.mime, 'image/png');
assert.equal(rasterTrip.receipt.output.mime, 'image/png');

// #8: benchmark claims are workload- and environment-bound.
const benchmarkPass = Foundation.benchmark.record({
  workload: { id: 'tile-128', digest: U.sha256('tile-128'), description: 'Generate one 128px tile' },
  environment: { runtime: process.version, platform: process.platform, architecture: process.arch, isolation: 'single-process-selftest' },
  repetitions: 10, measurements: { duration_ms: 8, output_bytes: 2048 }, budgets: { duration_ms: 10, output_bytes: 4096 },
});
assert.equal(benchmarkPass.status, 'PASS');
assert.match(benchmarkPass.scope, /only to the named workload/);
assert.equal(Foundation.benchmark.record({
  workload: { id: 'tile-128', digest: U.sha256('tile-128'), description: 'Generate one 128px tile' },
  environment: { runtime: process.version, platform: process.platform, architecture: process.arch, isolation: 'single-process-selftest' },
  measurements: { duration_ms: 12 }, budgets: { duration_ms: 10 },
}).status, 'FAIL');
const measured = Foundation.benchmark.run({
  workload: { id: 'tiny-json', digest: U.sha256('tiny-json'), description: 'Serialize a tiny object' },
  environment: { runtime: process.version, platform: process.platform, architecture: process.arch, isolation: 'single-process-selftest' },
  repetitions: 3, budgets: { output_bytes: 1024, duration_ms: 5000 },
}, (index) => ({ output: { index }, metrics: { objects: 1 } }));
assert.equal(measured.status, 'PASS');
assert.equal(measured.measurements.objects, 3);

// #9: deterministic fuzzing rejects malformed cases and exposes accepted garbage/crashes.
function strictTarget() { const error = new Error('invalid fixture'); error.code = 'INVALID_INPUT'; throw error; }
const fuzzPass = Foundation.fuzzHarness.run({ target_id: 'strict-target', seed: 'fixed-seed', cases: 24, base_input: { id: 'valid' }, case_budget_ms: 1000 }, strictTarget);
assert.equal(fuzzPass.status, 'PASS');
const fuzzRepeat = Foundation.fuzzHarness.run({ target_id: 'strict-target', seed: 'fixed-seed', cases: 24, base_input: { id: 'valid' }, case_budget_ms: 1000 }, strictTarget);
assert.deepEqual(fuzzPass.failures.map((item) => item.input_digest), fuzzRepeat.failures.map((item) => item.input_digest));
const fuzzAccepted = Foundation.fuzzHarness.run({ target_id: 'accepts-anything', seed: 'fixed-seed', cases: 8, base_input: { id: 'valid' }, case_budget_ms: 1000 }, () => ({ ok: true }));
assert.equal(fuzzAccepted.status, 'FAIL');
assert.equal(fuzzAccepted.counts.accepted_invalid, 8);
const fuzzCrash = Foundation.fuzzHarness.run({ target_id: 'crashes', seed: 'fixed-seed', cases: 3, base_input: {}, case_budget_ms: 1000 }, () => { throw new Error('boom'); });
assert.equal(fuzzCrash.counts.crashes, 3);

// #10: extension source is digest-bound, signed, revocable, capability-limited, and timed.
const keys = crypto.generateKeyPairSync('ed25519');
const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' });
const privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
function signed(source, capabilities, limits) {
  return Foundation.extensionSandbox.createSignedManifest({ id: 'test-extension', version: '1.0.0', source, public_key_pem: publicKeyPem, capabilities: capabilities || [], limits: limits || { timeout_ms: 100, max_output_bytes: 4096 } }, privateKeyPem);
}
const extension = signed("function (api, input) { return { sum: input.value + api['math.offset'] }; }", ['math.offset']);
const trust = { allowed_key_fingerprints: [extension.key_fingerprint], revoked_manifest_digests: [], revoked_extension_ids: [] };
assert.equal(Foundation.extensionSandbox.verifyManifest(extension, trust).pass, true);
const execution = Foundation.extensionSandbox.execute(extension, { value: 5 }, { trust, capability_values: { 'math.offset': 2 } });
assert.deepEqual(execution.output, { sum: 7 });
assert.equal(execution.receipt.status, 'PASS');
const tamperedExtension = U.clone(extension);
tamperedExtension.source = 'function () { return 999; }';
assert.equal(Foundation.extensionSandbox.verifyManifest(tamperedExtension, trust).pass, false);
throwsMatch(() => Foundation.extensionSandbox.execute(extension, { value: 5 }, { trust, capability_values: {} }), /capability unavailable/);
const revokedTrust = { allowed_key_fingerprints: [extension.key_fingerprint], revoked_manifest_digests: [extension.digest], revoked_extension_ids: [] };
throwsMatch(() => Foundation.extensionSandbox.execute(extension, { value: 5 }, { trust: revokedTrust, capability_values: { 'math.offset': 2 } }), /not-revoked/);
const processProbe = signed('function () { return process.version; }');
const processProbeTrust = { allowed_key_fingerprints: [processProbe.key_fingerprint], revoked_manifest_digests: [], revoked_extension_ids: [] };
assert.equal(Foundation.extensionSandbox.execute(processProbe, {}, { trust: processProbeTrust, capability_values: {} }).receipt.status, 'FAIL');
const loop = signed('function () { while (true) {} }', [], { timeout_ms: 20, max_output_bytes: 128 });
const loopTrust = { allowed_key_fingerprints: [loop.key_fingerprint], revoked_manifest_digests: [], revoked_extension_ids: [] };
const loopExecution = Foundation.extensionSandbox.execute(loop, {}, { trust: loopTrust, capability_values: {} });
assert.equal(loopExecution.receipt.status, 'FAIL');
assert.match(loopExecution.receipt.error.message, /timed out/i);

console.log('Asset Hands upgrade wave 1 PASS (10 foundation upgrades; adversarial refusal paths verified)');
