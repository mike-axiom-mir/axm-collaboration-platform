#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const Hands = require('../asset-hands');
const {
  ReferenceValidatorRegistry,
  RECEIPT_SCHEMA,
  ENVELOPE_SCHEMA,
  validateReceipt,
  validateEnvelope,
} = require('./registry');

const createdAt = '2026-07-19T14:00:00.000Z';
const canvas = {
  schema: 'axm.target-canvas/v1',
  medium: 'screen',
  dimensions: { width: 64, height: 64, unit: 'px' },
  colour: { space: 'srgb', transparency: 'opaque' },
  behaviour: ['static'],
  intended_use: 'fixture',
};

function artifact(overrides) {
  return Object.assign({
    schema: 'axm.asset-artifact/v1', id: 'fixture', role: 'fixture-delivery', name: 'Fixture', filename: 'fixture.test',
    mime: 'application/x-axm-test', format: 'TEST', editable: false, text: 'AXM-REFERENCE-OK', digest: 'portable-digest', metadata: {},
  }, overrides || {});
}

function provider(overrides) {
  return Object.assign({
    id: 'fixture-validator', version: '1.0.0', priority: 10,
    implementation: 'separate fixture parser', tool: 'fixture-parser', assurance_scope: 'structural-corroboration',
    independence_basis: 'The test parser reads staged bytes outside the fixture writer.', independent_from_writers: ['fixture-writer'],
    claims: ['fixture.structure'], mimes: ['application/x-axm-test'], mediums: ['screen'],
    probe: function () { return { available: true, version: '9.1.0' }; },
    execute: function (input) {
      const pass = fs.readFileSync(input.staged, 'utf8') === 'AXM-REFERENCE-OK';
      return { pass, checks: [{ name: 'separate-byte-parse', pass }], evidence: { bounded: true } };
    },
  }, overrides || {});
}

const registry = new ReferenceValidatorRegistry({ providers: [provider()] });
const pass = registry.verifyArtifact({ artifact: artifact(), claim: 'fixture.structure', target_canvas: canvas, target_canvas_digest: 'canvas-portable-digest', createdAt });
assert.equal(pass.schema, RECEIPT_SCHEMA);
assert.equal(pass.status, 'PASS');
assert.equal(pass.assurance_scope, 'structural-corroboration');
assert.equal(pass.target_canvas_digest, 'canvas-portable-digest');
assert.match(pass.target_canvas_sha256, /^[a-f0-9]{64}$/);
assert.match(pass.artifact.sha256, /^[a-f0-9]{64}$/);
assert.equal(pass.validator.id, 'fixture-validator');
assert.equal(pass.runtime.tool_version, '9.1.0');
assert.equal(pass.runtime.network_used, false);
assert(validateReceipt(pass).pass);

const tampered = registry.verifyArtifact({ artifact: artifact({ text: 'AXM-REFERENCE-BROKEN' }), claim: 'fixture.structure', target_canvas: canvas, createdAt });
assert.equal(tampered.status, 'FAIL');
assert.notEqual(tampered.artifact.sha256, pass.artifact.sha256);
const otherCanvas = registry.verifyArtifact({ artifact: artifact(), claim: 'fixture.structure', target_canvas: Object.assign({}, canvas, { dimensions: { width: 65, height: 64, unit: 'px' } }), createdAt });
assert.notEqual(otherCanvas.target_canvas_sha256, pass.target_canvas_sha256);

const missing = registry.verifyArtifact({ artifact: artifact(), claim: 'fixture.external-certification', target_canvas: canvas, createdAt });
assert.equal(missing.status, 'MISSING_VALIDATOR');
assert.equal(missing.assurance_scope, 'unavailable');
assert.equal(missing.runtime.available, false);
const wrongMime = registry.verifyArtifact({ artifact: artifact({ mime: 'image/svg+xml', format: 'SVG', filename: 'fixture.svg' }), claim: 'fixture.structure', target_canvas: canvas, createdAt });
assert.equal(wrongMime.status, 'UNSUPPORTED_ARTIFACT');
const wrongCanvas = registry.verifyArtifact({ artifact: artifact(), claim: 'fixture.structure', target_canvas: Object.assign({}, canvas, { medium: 'game-world' }), createdAt });
assert.equal(wrongCanvas.status, 'UNSUPPORTED_ARTIFACT');
const missingRuntime = new ReferenceValidatorRegistry({ providers: [provider({ probe: function () { return { available: false, version: null, reason: 'fixture runtime absent' }; } })] }).verifyArtifact({ artifact: artifact(), claim: 'fixture.structure', target_canvas: canvas, createdAt });
assert.equal(missingRuntime.status, 'MISSING_VALIDATOR');
assert.equal(missingRuntime.validator.id, 'fixture-validator');
const toolError = new ReferenceValidatorRegistry({ providers: [provider({ execute: function () { return { toolError: true, checks: [{ name: 'tool', pass: false }] }; } })] }).verifyArtifact({ artifact: artifact(), claim: 'fixture.structure', target_canvas: canvas, createdAt });
assert.equal(toolError.status, 'TOOL_ERROR');

const host = { capabilities: ['json', 'svg'], permissions: [], accepts: [Hands.RESULT_SCHEMA, 'image/svg+xml', 'application/json'] };
const result = Hands.create('vector-form', {
  id: 'reference-envelope', title: 'Reference envelope', kind: 'icon', intended_use: 'icon',
  target_canvas: { medium: 'ui', dimensions: { width: 64, height: 64, unit: 'px' }, colour: { space: 'srgb', transparency: 'required' }, behaviour: ['static'], intended_use: 'icon' },
  required_outputs: ['image/svg+xml'], editable_recipe_formats: ['axm.vector-geometry-recipe/v1'],
}, { seed: 'reference-envelope', createdAt, host });
assert.equal(result.status, 'READY');
const envelopeRegistry = new ReferenceValidatorRegistry({ providers: [provider({ claims: ['svg.fixture'], mimes: ['image/svg+xml'], mediums: ['ui'], execute: function (input) { const pass = fs.readFileSync(input.staged, 'utf8').startsWith('<svg'); return { pass, checks: [{ name: 'separate-svg-root', pass }] }; } })] });
const envelope = envelopeRegistry.verifyResult(result, { createdAt, requirements: [{ claim: 'svg.fixture', artifact_role: result.artifacts[0].role, required: true }, { claim: 'svg.external-certification', artifact_role: result.artifacts[0].role, required: false }] });
assert.equal(envelope.schema, ENVELOPE_SCHEMA);
assert.equal(envelope.status, 'PARTIAL');
assert.equal(envelope.result_digest, result.digest);
assert.equal(envelope.receipts[0].status, 'PASS');
assert.equal(envelope.receipts[1].status, 'MISSING_VALIDATOR');
assert(validateEnvelope(envelope).pass, validateEnvelope(envelope).errors.join('; '));
const attached = envelopeRegistry.attachEnvelope(result, envelope);
assert.equal(attached.reference_validation.result_digest, result.digest);
assert.equal(result.reference_validation, undefined, 'base result must remain unchanged');
assert(Hands.validateResult(attached).pass, Hands.validateResult(attached).errors.join('; '));

const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const rasterRefusal = envelopeRegistry.verifyArtifact({ artifact: artifact({ id: 'png', role: 'raster', mime: 'image/png', format: 'PNG', filename: 'fixture.png', text: undefined, dataUrl: pngDataUrl }), claim: 'svg.fixture', target_canvas: Object.assign({}, canvas, { medium: 'ui' }), createdAt });
assert.equal(rasterRefusal.status, 'UNSUPPORTED_ARTIFACT');
assert.notEqual(rasterRefusal.artifact.mime, 'image/svg+xml');

const defaultRegistry = new ReferenceValidatorRegistry();
const defaultInventory = defaultRegistry.inventory();
assert(defaultInventory.some(function (item) { return item.provider.id === 'openusd-usdchecker' && item.runtime.available === false; }));
assert(defaultInventory.some(function (item) { return item.provider.id === 'w3c-epubcheck' && item.runtime.available === false; }));

function commandFixture(command, args) {
  if (args.includes('--version')) return { status: 0, stdout: 'EPUBCheck 5.2 fixture\n', stderr: '' };
  if (args.includes('--help')) return { status: 0, stdout: 'usdchecker fixture\n', stderr: '' };
  return { status: 0, stdout: '{"checker":"fixture","pass":true}\n', stderr: '' };
}
const epubRegistry = new ReferenceValidatorRegistry({ epubcheck: 'epubcheck-fixture', runner: commandFixture });
const epubReceipt = epubRegistry.verifyArtifact({
  artifact: artifact({ id: 'epub', role: 'epub', mime: 'application/epub+zip', format: 'EPUB 3', filename: 'fixture.epub', text: undefined, dataUrl: 'data:application/epub+zip;base64,UEsDBAoAAAAAAAEAIQAAAAAAAAAAAAAAAAA=' }),
  claim: 'epub.w3c-epubcheck', target_canvas: canvas, createdAt,
});
assert.equal(epubReceipt.status, 'PASS');
assert.equal(epubReceipt.validator.id, 'w3c-epubcheck');
const usdRegistry = new ReferenceValidatorRegistry({ usdchecker: 'usdchecker-fixture', runner: commandFixture });
const usdReceipt = usdRegistry.verifyArtifact({
  artifact: artifact({ id: 'usdz', role: 'usdz', mime: 'model/vnd.usdz+zip', format: 'USDZ', filename: 'fixture.usdz', text: undefined, dataUrl: 'data:model/vnd.usdz+zip;base64,UEsDBAoAAAAAAAEAIQAAAAAAAAAAAAAAAAA=' }),
  claim: 'openusd.usdchecker', target_canvas: Object.assign({}, canvas, { medium: '3d-surface' }), createdAt,
});
assert.equal(usdReceipt.status, 'PASS');
assert.equal(usdReceipt.validator.id, 'openusd-usdchecker');
assert(!JSON.stringify([pass, envelope]).match(/[A-Za-z]:[\\/]/), 'receipts must not expose private absolute paths');

console.log('Asset reference-validator selftest PASS (exact claim/MIME/canvas routing, bound SHA-256 receipts, PASS/FAIL/MISSING/UNSUPPORTED/TOOL_ERROR, optional partial envelope, immutable attachment, SVG/raster distinction, default missing-runtime honesty)');
