'use strict';
const assert = require('assert');
const F = require('./fabrication-core');
const D = 'a'.repeat(64), R = 'b'.repeat(64);

function receipt(status) { return { status, digest: R }; }
function candidate() {
  return {
    schema: 'axm.fabrication-candidate/v1', id: 'test-token', digest: D,
    source: { id: 'asset-token', version: '1.0.0', digest: D, provenanceDigest: R, licenseId: 'CC0-1.0' },
    adapter: { id: 'vendor-neutral-3mf', version: '1.0.0', processFamily: 'full-colour-3d', vendorNeutral: true, standardInterchangeFormat: 'model/3mf', automaticExecution: false },
    physical: { dimensions: { widthMm: 30, heightMm: 30, depthMm: 4 }, scale: '1:1', orientation: 'flat', geometryIntent: 'watertight token', colourIntent: 'sRGB reference palette', textureIntent: 'embossed face', materialIntent: 'rigid polymer', transparencyIntent: 'opaque', toleranceMm: 0.2, strengthRequirement: 'handheld token', safetyNotes: ['No food-contact claim.'] },
    technical: { sourceIntegrity: receipt('PASS'), formatValidation: receipt('PASS'), geometryValidation: receipt('PASS'), printability: receipt('PASS'), simulation: receipt('PASS'), materialCompatibility: receipt('PASS') },
    reviews: { humanVisual: { action: 'APPROVE', candidateDigest: D, digest: R }, machineCrosscheck: { action: 'RECOMMEND', candidateDigest: D, digest: R }, humanOperator: { action: 'APPROVE_BOUNDED_TEST', candidateDigest: D, digest: R } },
    machine: { evidenceClass: 'INDEPENDENT_TEST', claimsVerified: true, profileDigest: R, vendorAiBypassable: true, coreOfflineCapable: true },
    hardwareCommand: null
  };
}

const ready = F.evaluate(candidate());
assert.equal(ready.status, 'BOUNDED_EXTERNAL_TEST_PACKAGE_READY');
assert.equal(ready.automaticExecution, false);
assert.equal(ready.hardwareCommand, null);
assert.equal(ready.purchaseDecision, 'NONE');
const pkg = F.buildBoundedTestPackage(candidate(), ready);
assert.equal(pkg.scope, 'one-bounded-external-test');
assert.equal(pkg.automaticExecution, false);
assert.equal(pkg.hardwareCommand, null);

const adOnly = candidate(); adOnly.machine = { evidenceClass: 'ADVERTISEMENT', claimsVerified: false, profileDigest: '', vendorAiBypassable: false, coreOfflineCapable: false }; adOnly.reviews = {};
const held = F.evaluate(adOnly);
assert.equal(held.status, 'TECHNICAL_REVIEW_REQUIRED');
assert.ok(held.holds.some((x) => x.id === 'machine-evidence'));
assert.throws(() => F.buildBoundedTestPackage(adOnly, held));

const dangerous = candidate(); dangerous.adapter.automaticExecution = true; dangerous.hardwareCommand = 'PRINT NOW';
const blocked = F.evaluate(dangerous);
assert.equal(blocked.status, 'BLOCKED');
assert.ok(blocked.failed.some((x) => x.id === 'automatic-execution'));
assert.ok(blocked.failed.some((x) => x.id === 'hardware-command'));

console.log('fabrication foundation self-test passed (digital package only; no hardware execution)');
