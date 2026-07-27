'use strict';

const assert = require('assert');
const Eye = require('../eye-accessibility-inspector');
const Runtime = require('../runtime-route');
const ComputedStyle = require('../../ai-native-hands/computed-style-hand');

const passing = {
  contrastPairs: [{ id: 'body-copy', foreground: '#ffffff', background: '#000000', role: 'normal-text' }],
  interactiveTargets: [{ id: 'save-button', widthPx: 48, heightPx: 44 }],
  criticalText: [{ id: 'status-label', fontSizePx: 12 }],
  signals: [{ id: 'completion-tone', usesSound: true, visibleEquivalent: true }]
};

async function run() {
  const eye = Eye.create({ maxElements: 12 });
  const positive = await eye.inspect({ claim: 'The measured surface meets the AXM floor.', targetId: 'sensorium-lab', measuredProperties: passing, observedAt: '2026-07-23T12:00:00.000Z' });
  const failing = await eye.inspect({ claim: 'The measured surface meets the AXM floor.', targetId: 'sensorium-lab', measuredProperties: {
    contrastPairs: [{ id: 'muted-copy', foreground: '#777777', background: '#888888', role: 'normal-text' }],
    interactiveTargets: [{ id: 'tiny-button', widthPx: 30, heightPx: 28 }],
    criticalText: [{ id: 'critical-nine-pixel', fontSizePx: 9 }],
    signals: [{ id: 'sound-only-alert', usesSound: true, visibleEquivalent: false }]
  }, observedAt: '2026-07-23T12:00:01.000Z' });
  const partial = await eye.inspect({ claim: 'Partial surface.', targetId: 'sensorium-lab', measuredProperties: { contrastPairs: [] }, observedAt: '2026-07-23T12:00:02.000Z' });
  const invalid = await eye.inspect({ claim: 'Invalid colour.', targetId: 'sensorium-lab', measuredProperties: Object.assign({}, passing, { contrastPairs: [{ id: 'bad-colour', foreground: 'white', background: '#000000' }] }), observedAt: '2026-07-23T12:00:03.000Z' });
  const missing = await eye.inspect({ claim: 'Live surface.', targetId: 'sensorium-lab', observedAt: '2026-07-23T12:00:04.000Z' });
  const oversized = await Eye.create({ maxElements: 2 }).inspect({ claim: 'Oversized surface.', targetId: 'sensorium-lab', measuredProperties: { contrastPairs: [], interactiveTargets: [1, 2, 3].map(function (n) { return { id: 'target-' + n, widthPx: 44, heightPx: 44 }; }), criticalText: [], signals: [] }, observedAt: '2026-07-23T12:00:05.000Z' });
  const mismatch = await Eye.create({ readComputedStyles: async function () { return { schema: ComputedStyle.RESULT_SCHEMA, capability: ComputedStyle.CAPABILITY, version: '1.0.0', targetId: 'other-surface', measuredProperties: passing, coverage: { complete: true, inspectedElements: 1, discoveredElements: 1, measurementCount: 4, maxElements: 12 }, namedSeams: [], contentInspected: false, rawPixelsRetained: false, mutatedSurface: false }; } }).inspect({ claim: 'Exact live surface.', targetId: 'sensorium-lab', observedAt: '2026-07-23T12:00:06.000Z' });
  const malformedAdapter = await Eye.create({ readComputedStyles: async function () { return { targetId: 'sensorium-lab', measuredProperties: passing }; } }).inspect({ claim: 'Exact live surface.', targetId: 'sensorium-lab', observedAt: '2026-07-23T12:00:07.000Z' });
  function fakeElement(tagName, id, attributes, style, box) {
    attributes = attributes || {};
    return { tagName, id: id || '', parentElement: null, _style: style || {}, _box: box || { width: 100, height: 24 }, _children: [], getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null; }, getBoundingClientRect: function () { return this._box; }, querySelectorAll: function (selector) { return selector === '*' ? this._children.slice() : []; } };
  }
  const fixture = fakeElement('MAIN', 'sensorium-live-fixture', {}, { display: 'block', visibility: 'visible', opacity: '1', backgroundColor: 'rgb(0, 0, 0)', backgroundImage: 'none', color: 'rgb(255, 255, 255)', fontSize: '16px', fontWeight: '400' }, { width: 640, height: 480 });
  const copy = fakeElement('P', 'live-copy', { 'data-axm-critical-text': 'true' }, { display: 'block', visibility: 'visible', opacity: '1', backgroundColor: 'transparent', backgroundImage: 'none', color: 'rgb(255, 255, 255)', fontSize: '16px', fontWeight: '400' }, { width: 300, height: 24 });
  const button = fakeElement('BUTTON', 'live-button', {}, { display: 'block', visibility: 'visible', opacity: '1', backgroundColor: 'rgb(32, 32, 32)', backgroundImage: 'none', color: 'rgb(255, 255, 255)', fontSize: '16px', fontWeight: '700' }, { width: 96, height: 48 });
  const signal = fakeElement('DIV', 'live-signal', { 'data-axm-uses-sound': 'true', 'data-axm-visible-equivalent': 'true' }, { display: 'block', visibility: 'visible', opacity: '1', backgroundColor: 'transparent', backgroundImage: 'none', color: 'rgb(255, 255, 255)', fontSize: '16px', fontWeight: '400' }, { width: 100, height: 24 });
  copy.parentElement = fixture; button.parentElement = fixture; signal.parentElement = fixture; fixture._children = [copy, button, signal];
  const computed = ComputedStyle.create({ document: { getElementById: function (id) { return id === 'sensorium-live-fixture' ? fixture : null; }, querySelectorAll: function () { return []; } }, getComputedStyle: function (element) { return element._style; }, maxElements: 12 });
  const live = await Eye.create({ readComputedStyles: computed.readComputedStyles, maxElements: 12 }).inspect({ claim: 'The live measured surface meets the AXM floor.', targetId: 'sensorium-live-fixture', observedAt: '2026-07-23T12:00:08.000Z' });
  const truncatedComputed = ComputedStyle.create({ document: { getElementById: function (id) { return id === 'sensorium-live-fixture' ? fixture : null; }, querySelectorAll: function () { return []; } }, getComputedStyle: function (element) { return element._style; }, maxElements: 2 });
  const truncated = await Eye.create({ readComputedStyles: truncatedComputed.readComputedStyles, maxElements: 2 }).inspect({ claim: 'The whole live surface meets the AXM floor.', targetId: 'sensorium-live-fixture', observedAt: '2026-07-23T12:00:09.000Z' });
  fixture._style.backgroundImage = 'linear-gradient(rgb(0, 0, 0), rgb(32, 32, 32))';
  const complexBackground = await Eye.create({ readComputedStyles: computed.readComputedStyles, maxElements: 12 }).inspect({ claim: 'The gradient-backed surface meets the AXM floor.', targetId: 'sensorium-live-fixture', observedAt: '2026-07-23T12:00:10.000Z' });
  fixture._style.backgroundImage = 'none';
  assert.equal(positive.verdict, 'PASS');
  assert.equal(positive.rules.contrast.checks[0].ratio, 21);
  assert.equal(failing.verdict, 'FAIL');
  assert.equal(failing.violations.length, 4);
  assert.ok(failing.namedSeams.includes('ACCESSIBILITY_FLOOR_VIOLATION'));
  assert.equal(partial.verdict, 'UNKNOWN');
  assert.equal(invalid.verdict, 'UNKNOWN');
  assert.equal(missing.verdict, 'UNKNOWN');
  assert.ok(missing.namedSeams.includes('COMPUTED_STYLE_ADAPTER_NOT_INJECTED'));
  assert.equal(oversized.verdict, 'UNKNOWN');
  assert.equal(mismatch.verdict, 'UNKNOWN');
  assert.equal(malformedAdapter.verdict, 'UNKNOWN');
  assert.ok(malformedAdapter.namedSeams.includes('COMPUTED_STYLE_ADAPTER_CONTRACT_MISMATCH'));
  assert.equal(live.verdict, 'PASS');
  assert.equal(live.measurementSource, 'host-adapter');
  assert.equal(live.measurementCoverage.complete, true);
  assert.ok(/^[a-f0-9]{64}$/.test(live.adapterReceiptDigest));
  assert.equal(truncated.verdict, 'UNKNOWN');
  assert.ok(truncated.namedSeams.includes('MEASUREMENT_BUDGET_EXCEEDED'));
  assert.equal(complexBackground.verdict, 'UNKNOWN');
  assert.ok(complexBackground.namedSeams.includes('COMPLEX_BACKGROUND_UNRESOLVED'));
  assert.equal(positive.contentInspected, false);
  assert.equal(positive.rawPixelsRetained, false);
  assert.equal(positive.measuredPropertiesRetained, false);
  assert.equal(eye.status().rawRetainedBytes, 0);

  async function use(n, measuredProperties) {
    return Runtime.invoke('eye-accessibility-inspector', { claim: 'Runtime accessibility floor', targetId: 'sensorium-lab', measuredProperties, observedAt: '2026-07-23T12:01:0' + n + '.000Z' }, { claimId: 'claim-eye-accessibility-' + n, seatId: 'seat-test', targetId: 'sensorium-lab' });
  }
  const first = await use(1, passing), second = await use(2, { contrastPairs: [], interactiveTargets: [], criticalText: [{ id: 'critical-nine-pixel', fontSizePx: 9 }], signals: [] });
  const third = await Runtime.invoke('eye-accessibility-inspector', { claim: 'Runtime live accessibility floor', targetId: 'sensorium-live-fixture', observedAt: '2026-07-23T12:01:03.000Z' }, { claimId: 'claim-eye-accessibility-3', seatId: 'seat-test', targetId: 'sensorium-live-fixture', adapters: { readComputedStyles: computed.readComputedStyles } });
  assert.equal(first.envelope.verdict, 'PASS');
  assert.equal(second.envelope.verdict, 'FAIL');
  assert.equal(third.envelope.verdict, 'PASS');
  return { senseId: 'eye-accessibility-inspector', verdict: 'PASS', positive: live, negative: [failing, partial, invalid, missing, oversized, mismatch, malformedAdapter, truncated, complexBackground], envelopes: [first.envelope, second.envelope, third.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
