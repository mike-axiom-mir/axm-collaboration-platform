#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Hands = require('../asset-hands');
const { ReferenceValidatorRegistry } = require('./registry');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const python = argument('--python');
if (!python) throw new Error('usage: node real-runtime-selftest.js --python <absolute Python executable> [--python-path <usd-core root>] [--musicxml-xsd <musicxml.xsd>] [--usdchecker <executable>] [--epubcheck <executable>]');
const createdAt = '2026-07-19T14:30:00.000Z';
const registry = new ReferenceValidatorRegistry({
  python,
  pythonPath: argument('--python-path'),
  musicXmlXsd: argument('--musicxml-xsd'),
  usdchecker: argument('--usdchecker'),
  epubcheck: argument('--epubcheck'),
});

const host = {
  capabilities: ['json', 'svg'], permissions: [],
  accepts: [Hands.RESULT_SCHEMA, 'application/json', 'image/svg+xml', 'application/pdf', 'application/epub+zip', 'audio/midi', 'application/vnd.recordare.musicxml+xml', 'audio-device+json', 'model/vnd.usd', 'model/vnd.usdz+zip'],
};

function audioBrief() {
  return {
    id: 'reference-audio', title: 'Reference validator score', kind: 'device-ui', intended_use: 'device-ui',
    target_canvas: {
      medium: 'audio-device', dimensions: { width: 640, height: 360, unit: 'px' }, colour: { space: 'srgb', transparency: 'opaque', minimum_contrast_ratio: 4.5 },
      temporal: { tempo_bpm: 120, time_signature_numerator: 4, time_signature_denominator: 4, ticks_per_quarter: 480, midi_channel: 1, note_min: 48, note_max: 84 },
      accessibility: { keyboard: true, focus_visible: true }, behaviour: ['interactive'], performance: { max_duration_seconds: 4, max_file_bytes: 1000000 }, intended_use: 'device-ui',
    },
    required_outputs: ['audio/midi', 'application/vnd.recordare.musicxml+xml', 'audio-device+json'], editable_recipe_formats: ['axm.audio-notation-recipe/v1'],
  };
}

function accessibleBrief() {
  return {
    id: 'reference-accessible', title: 'Reference accessible document', kind: 'document', intended_use: 'document', purpose: 'Separate parser evidence.',
    target_canvas: { medium: 'screen', dimensions: { width: 768, height: 1024, unit: 'px' }, colour: { space: 'srgb', transparency: 'opaque' }, responsive: { locale: 'en-GB', direction: 'ltr' }, accessibility: { standard: 'bounded structural preflight', reading_order: true, alternative_text: true, keyboard: true }, behaviour: ['responsive'], performance: { max_file_bytes: 1000000 }, intended_use: 'document' },
    required_outputs: ['application/pdf', 'application/epub+zip'], editable_recipe_formats: ['axm.accessible-document-recipe/v1'],
  };
}

function pdfxBrief() {
  return {
    id: 'reference-pdfx', title: 'Reference PDFX poster', kind: 'poster', intended_use: 'poster',
    target_canvas: {
      medium: 'print', dimensions: { width: 210, height: 297, unit: 'mm' },
      colour: { space: 'cmyk', transparency: 'opaque', printable_colours: true, profile: 'Chemical proof', rendering_intent: 'relative-colorimetric' },
      physical: { bleed: 3, minimum_stroke: 0.25 }, behaviour: ['static'], performance: { max_file_bytes: 3000000 },
      print: { safe_margin: 5, crop_marks: true, registration_marks: true, output_condition: 'Chemical proof' }, intended_use: 'poster',
    },
    required_outputs: ['application/pdf'], editable_recipe_formats: ['axm.pdfx-production-recipe/v1'],
  };
}

function usdBrief() {
  return {
    id: 'reference-usd', title: 'Reference USD scene', kind: 'scene', intended_use: 'scene',
    target_canvas: { medium: '3d-surface', dimensions: { width: 10, height: 4, depth: 8, unit: 'm' }, colour: { space: 'linear-srgb', transparency: 'opaque' }, spatial: { up_axis: 'y', handedness: 'right', world_scale: 1 }, behaviour: ['static', 'interactive'], performance: { max_polygon_count: 100, max_vertices: 100, max_file_bytes: 1000000 }, intended_use: 'scene' },
    required_outputs: ['model/vnd.usd', 'model/vnd.usdz+zip', 'scene-composition-report'], editable_recipe_formats: ['axm.openusd-scene-recipe/v1'],
  };
}

(async function () {
  const inventory = registry.inventory();
  assert(inventory.find(function (item) { return item.provider.id === 'python-lxml-musicxml-structure'; }).runtime.available);
  assert(inventory.find(function (item) { return item.provider.id === 'python-pypdf-structure'; }).runtime.available);

  const audio = await Hands.createAsync('audio-notation-device', audioBrief(), { seed: 'reference-audio', createdAt, host });
  assert.equal(audio.status, 'READY');
  const audioEnvelope = registry.verifyResult(audio, { createdAt });
  const musicStructure = audioEnvelope.receipts.find(function (receipt) { return receipt.claim === 'musicxml.structure'; });
  assert.equal(musicStructure.status, 'PASS', JSON.stringify(musicStructure));
  assert.equal(musicStructure.validator.id, 'python-lxml-musicxml-structure');
  assert.equal(musicStructure.runtime.network_used, false);
  const musicXsd = audioEnvelope.receipts.find(function (receipt) { return receipt.claim === 'musicxml.w3c-xsd'; });
  assert.equal(musicXsd.status, argument('--musicxml-xsd') ? 'PASS' : 'MISSING_VALIDATOR', JSON.stringify(musicXsd));
  const xmlArtifact = audio.artifacts.find(function (item) { return item.role === 'musicxml-score'; });
  const damagedXml = Object.assign({}, xmlArtifact, { text: xmlArtifact.text.replace('<score-partwise', '<broken-score') });
  const damagedReceipt = registry.verifyArtifact({ artifact: damagedXml, claim: 'musicxml.structure', target_canvas: audio.target_canvas, createdAt });
  assert.equal(damagedReceipt.status, 'FAIL');

  const accessible = Hands.create('accessible-document', accessibleBrief(), { seed: 'reference-accessible', createdAt, host });
  assert.equal(accessible.status, 'READY');
  const accessibleEnvelope = registry.verifyResult(accessible, { createdAt });
  const tagged = accessibleEnvelope.receipts.find(function (receipt) { return receipt.claim === 'pdf.tagged-structure'; });
  assert.equal(tagged.status, 'PASS', JSON.stringify(tagged));
  assert.equal(tagged.validator.id, 'python-pypdf-structure');
  const epub = accessibleEnvelope.receipts.find(function (receipt) { return receipt.claim === 'epub.w3c-epubcheck'; });
  assert.equal(epub.status, argument('--epubcheck') ? 'PASS' : 'MISSING_VALIDATOR', JSON.stringify(epub));

  const pdfx = await Hands.createAsync('pdfx-press-production', pdfxBrief(), { seed: 'reference-pdfx', createdAt, host });
  assert.equal(pdfx.status, 'READY');
  const pdfxEnvelope = registry.verifyResult(pdfx, { createdAt });
  const pdfxStructure = pdfxEnvelope.receipts.find(function (receipt) { return receipt.claim === 'pdfx.bounded-structure'; });
  const pdfxCertification = pdfxEnvelope.receipts.find(function (receipt) { return receipt.claim === 'pdfx.external-conformance'; });
  assert.equal(pdfxStructure.status, 'PASS', JSON.stringify(pdfxStructure));
  assert.equal(pdfxStructure.validator.id, 'python-pypdf-structure');
  assert.equal(pdfxStructure.assurance_scope, 'structural-corroboration');
  assert.equal(pdfxCertification.status, 'MISSING_VALIDATOR');
  assert.equal(pdfxEnvelope.status, 'PARTIAL');

  if (argument('--usdchecker') || argument('--python-path')) {
    const usd = await Hands.createAsync('openusd-scene-composition', usdBrief(), { seed: 'reference-usd', createdAt, host });
    assert.equal(usd.status, 'READY');
    const usdEnvelope = registry.verifyResult(usd, { createdAt });
    const usdcheck = usdEnvelope.receipts.find(function (receipt) { return receipt.claim === 'openusd.usdchecker'; });
    assert.equal(usdcheck.status, 'PASS', JSON.stringify(usdcheck));
    assert.equal(usdEnvelope.status, 'CORROBORATED');
    assert.equal(usdcheck.validator.id, 'python-openusd-compliance-checker');
    const usdzArtifact = usd.artifacts.find(function (item) { return item.role === 'openusd-scene-package'; });
    const match = /^data:([^;,]+);base64,(.+)$/.exec(usdzArtifact.dataUrl);
    const damagedBytes = Buffer.from(match[2], 'base64');
    const layerMarker = damagedBytes.indexOf(Buffer.from('#usda 1.0'));
    assert(layerMarker > 0);
    damagedBytes[layerMarker] = 0x21;
    const damagedUsdz = Object.assign({}, usdzArtifact, { dataUrl: 'data:' + usdzArtifact.mime + ';base64,' + damagedBytes.toString('base64') });
    const damagedUsdReceipt = registry.verifyArtifact({ artifact: damagedUsdz, claim: 'openusd.usdchecker', target_canvas: usd.target_canvas, createdAt });
    assert.equal(damagedUsdReceipt.status, 'FAIL');
  }

  assert(!JSON.stringify([audioEnvelope, accessibleEnvelope, pdfxEnvelope]).match(/[A-Za-z]:[\\/]/));
  console.log('Asset reference-validator real-runtime PASS (lxml MusicXML + pypdf tagged/PDFX structural corroboration; configured W3C XSD/OpenUSD/EPUBCheck providers reported exactly as executed)');
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
