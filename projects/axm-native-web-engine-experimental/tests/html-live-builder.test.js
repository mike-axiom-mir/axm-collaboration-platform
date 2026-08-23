'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Builder = require('../src/html-live-builder');

const SOURCE_A = '<!doctype html><html lang="en"><head><title>Draft One</title></head><body><main><h1>Hello builder</h1><p>Edit me live.</p><a href="https://example.com">held link</a><script>alert(1)</script></main></body></html>';
const SOURCE_B = '<!doctype html><html lang="en"><head><title>Draft Two</title></head><body><main><h1>Changed</h1><p>The compiler saw the edit.</p></main></body></html>';

test('live HTML builder compiles through the shared engine into an inert preview', function () {
  const result = Builder.compileHtmlDraft(SOURCE_A, { viewport: { width: 900, height: 640 } });
  assert.equal(result.schema, 'axm.web.html-builder-preview/v1');
  assert.equal(result.source.bytes, Buffer.byteLength(SOURCE_A));
  assert.equal(result.viewport.width, 900);
  assert.equal(result.viewport.height, 640);
  assert.equal(result.page.title, 'Draft One');
  assert.equal(result.preview.kind, 'INERT_AXM_STRUCTURE_BROWSER_HTML');
  assert.equal(result.preview.activePageCodeExecuted, false);
  assert.equal(result.preview.externalResourcesLoaded, false);
  assert.equal(result.authority.sourceFileMutationAllowed, false);
  assert.equal(result.authority.browserSessionMutationAllowed, false);
  assert.equal(result.authority.pageCodeExecutionAllowed, false);
  assert.match(result.preview.html, /AXM Structure Browser/);
  assert.match(result.preview.html, /PAGE CODE INERT/);
  assert.doesNotMatch(result.preview.html, /<script[^>]*>\s*alert\(1\)/i);
});

test('same draft and viewport compile deterministically while source edits change the lineage', function () {
  const first = Builder.compileHtmlDraft(SOURCE_A, { viewport: { width: 1120, height: 760 } });
  const repeat = Builder.compileHtmlDraft(SOURCE_A, { viewport: { width: 1120, height: 760 } });
  const changed = Builder.compileHtmlDraft(SOURCE_B, { viewport: { width: 1120, height: 760 } });
  assert.equal(first.previewDigest, repeat.previewDigest);
  assert.equal(first.source.sha256, repeat.source.sha256);
  assert.notEqual(first.source.sha256, changed.source.sha256);
  assert.notEqual(first.previewDigest, changed.previewDigest);
  assert.equal(changed.page.title, 'Draft Two');
});

test('live builder keeps viewport and source work inside explicit bounds', function () {
  assert.throws(function () {
    Builder.compileHtmlDraft('<p>x</p>', { viewport: { width: 10, height: 760 } });
  }, function (error) { return error && error.code === 'BUILDER_OPTIONS_INVALID'; });
  assert.throws(function () {
    Builder.compileHtmlDraft('x'.repeat(2049), { maxSourceBytes: 2048 });
  }, function (error) { return error && error.code === 'BUILDER_SOURCE_BYTES_LIMIT'; });
});
