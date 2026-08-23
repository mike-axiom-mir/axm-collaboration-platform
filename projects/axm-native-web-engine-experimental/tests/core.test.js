'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../src/engine');
const Source = require('../src/source-record');
const Canonical = require('../src/canonical-json');

const root = path.resolve(__dirname, '..');
function fixture(name) { return fs.readFileSync(path.join(root, 'fixtures', name)); }

test('source bytes are recoverable and digest-bound', function () {
  const bytes = fixture('simple.html');
  const processed = Engine.processBytes(bytes, { requestedUrl: 'fixtures/simple.html' });
  assert.deepEqual(Source.recoverBytes(processed.source), bytes);
  const changed = Object.assign({}, processed.source, { rawSourceBase64: Buffer.from('changed').toString('base64') });
  assert.throws(function () { Source.recoverBytes(changed); }, /byte binding failed/);
});

test('same deterministic inputs produce exact same typed outputs and digests', function () {
  const bytes = fixture('simple.html');
  const first = Engine.processBytes(bytes, { requestedUrl: 'fixtures/simple.html' });
  const second = Engine.processBytes(bytes, { requestedUrl: 'fixtures/simple.html' });
  assert.equal(Canonical.stringify(first), Canonical.stringify(second));
  assert.equal(first.documentTree.documentDigest, second.documentTree.documentDigest);
  assert.equal(first.pageModel.pageModelDigest, second.pageModel.pageModelDigest);
  assert.notEqual(first.documentTree.schema, first.pageModel.schema);
});

test('held elements remain visible without JavaScript execution', function () {
  delete globalThis.AXM_SHOULD_NOT_RUN;
  const processed = Engine.processBytes(fixture('held-elements.html'), { requestedUrl: 'fixtures/held-elements.html' });
  assert.equal(globalThis.AXM_SHOULD_NOT_RUN, undefined);
  assert.ok(processed.documentTree.unsupported.some(function (item) { return item.feature === 'element:script' && item.state === 'HELD'; }));
  assert.ok(processed.documentTree.unsupported.some(function (item) { return item.feature === 'element:future-card' && item.state === 'UNSUPPORTED'; }));
  assert.match(processed.pageModel.plainText, /Content remains readable/);
  assert.doesNotMatch(processed.pageModel.plainText, /AXM_SHOULD_NOT_RUN/);
});

test('malformed input returns typed warnings instead of silent correction', function () {
  const processed = Engine.processBytes(fixture('malformed.html'), { requestedUrl: 'fixtures/malformed.html' });
  const codes = new Set(processed.documentTree.warnings.map(function (warning) { return warning.code; }));
  ['DUPLICATE_ATTRIBUTE_IGNORED', 'UNCLOSED_COMMENT', 'IMPLICIT_CLOSE_FOR_MISMATCH', 'UNMATCHED_END_TAG', 'UNCLOSED_ELEMENT_AT_EOF'].forEach(function (code) {
    assert.ok(codes.has(code), 'missing warning ' + code);
  });
});

test('invalid UTF-8 and configured source limits fail visibly', function () {
  assert.throws(function () {
    Engine.processBytes(Buffer.from([0xc3, 0x28]), { requestedUrl: 'invalid.html' });
  }, function (error) { return error.code === 'INVALID_UTF8'; });
  assert.throws(function () {
    Engine.processBytes(Buffer.from('12345'), { requestedUrl: 'large.html', maxBytes: 4 });
  }, function (error) { return error.code === 'SOURCE_BYTES_LIMIT'; });
  assert.throws(function () {
    Engine.processBytes(Buffer.from('<div><div><div>x</div></div></div>'), { requestedUrl: 'deep.html', maxNesting: 2 });
  }, function (error) { return error.code === 'TREE_NESTING_LIMIT'; });
});
