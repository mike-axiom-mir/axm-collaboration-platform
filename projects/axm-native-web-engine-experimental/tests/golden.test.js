'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../src/engine');
const Canonical = require('../src/canonical-json');

const root = path.resolve(__dirname, '..');
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
function process(name) {
  return Engine.processBytes(fs.readFileSync(path.join(root, 'fixtures', name)), { requestedUrl: 'fixtures/' + name });
}

test('simple Document Tree and Page Model match committed goldens', function () {
  const result = process('simple.html');
  assert.equal(Canonical.stringify(result.documentTree), Canonical.stringify(readJson('golden/simple.document-tree.json')));
  assert.equal(Canonical.stringify(result.pageModel), Canonical.stringify(readJson('golden/simple.page-model.json')));
});

test('malformed warning tree and held Page Model match committed goldens', function () {
  assert.equal(Canonical.stringify(process('malformed.html').documentTree), Canonical.stringify(readJson('golden/malformed.document-tree.json')));
  assert.equal(Canonical.stringify(process('held-elements.html').pageModel), Canonical.stringify(readJson('golden/held.page-model.json')));
});
