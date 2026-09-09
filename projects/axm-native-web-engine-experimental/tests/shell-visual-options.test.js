'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LocalBrowserHost = require('../src/local-browser-host');

test('trusted shell exposes bounded local-only visual controls', function () {
  const html = LocalBrowserHost.renderShellHtml();
  [
    'id="theme"',
    'id="density"',
    'id="text-scale"',
    'id="focus-mode"',
    'id="metadata"',
    'id="filter"',
    'id="clear-filter"',
    'id="reset-view"',
    'id="visible-count"'
  ].forEach(function (marker) {
    assert.match(html, new RegExp(marker));
  });
  assert.match(html, /Midnight/);
  assert.match(html, /Paper/);
  assert.match(html, /Contrast/);
  assert.match(html, /Focus reading/);
  assert.match(html, /Visual controls affect this shell only/);
  assert.match(html, /data-theme="midnight"/);
  assert.match(html, /data-density="comfortable"/);
  assert.match(html, /data-scale="normal"/);
  assert.match(html, /data-focus="full"/);
  assert.match(html, /data-meta="show"/);
});

test('visual controls do not add storage, page execution, or network routes', function () {
  const source = LocalBrowserHost.CONTROLLER_SOURCE;
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(source, /eval\s*\(|new\s+Function\b/);
  assert.doesNotMatch(source, /WebSocket|EventSource|sendBeacon/);
  const fetchTargets = Array.from(source.matchAll(/\bfetch\(\s*(['"])([^'"]+)\1/g), function (match) { return match[2]; }).sort();
  assert.deepEqual(fetchTargets, ['action', 'state']);
  assert.match(source, /root\.dataset\.theme/);
  assert.match(source, /root\.dataset\.density/);
  assert.match(source, /root\.dataset\.scale/);
  assert.match(source, /root\.dataset\.focus/);
  assert.match(source, /root\.dataset\.meta/);
});
