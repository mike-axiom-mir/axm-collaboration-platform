'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../src/engine');

const root = path.resolve(__dirname, '..');

test('Page Model extracts semantic structures separately from the tree', function () {
  const bytes = fs.readFileSync(path.join(root, 'fixtures/simple.html'));
  const result = Engine.processBytes(bytes, { requestedUrl: 'fixtures/simple.html' });
  const page = result.pageModel;
  assert.equal(page.title, 'AXM & the open web');
  assert.equal(page.language, 'en');
  assert.deepEqual(page.headings.map(function (h) { return [h.level, h.text]; }), [[1, 'One source, two bodies']]);
  assert.equal(page.links[0].href, '/home');
  assert.equal(page.media[0].alt, 'Shared engine diagram');
  assert.deepEqual(page.lists[0].items.map(function (item) { return item.text; }), ['Source truth', 'Reversible views']);
  assert.equal(page.tables[0].rowCount, 2);
  assert.equal(page.tables[0].columnEstimate, 2);
  assert.equal(page.controls[0].label, 'Search term');
  assert.equal(page.controls[1].type, 'submit');
  assert.match(page.pageModelDigest, /^[a-f0-9]{64}$/);
  assert.equal(Object.prototype.hasOwnProperty.call(page, 'root'), false);
});

test('visible text excludes held script and style content', function () {
  const bytes = fs.readFileSync(path.join(root, 'fixtures/held-elements.html'));
  const page = Engine.processBytes(bytes, { requestedUrl: 'fixtures/held-elements.html' }).pageModel;
  assert.doesNotMatch(page.plainText, /color: red/);
  assert.doesNotMatch(page.plainText, /console\.log/);
  assert.match(page.plainText, /Canvas fallback text/);
});
