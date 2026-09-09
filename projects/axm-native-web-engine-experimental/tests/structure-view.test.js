'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../src/engine');
const Canonical = require('../src/canonical-json');

const root = path.resolve(__dirname, '..');
function fixture(name) { return fs.readFileSync(path.join(root, 'fixtures', name)); }

test('structure derivation is deterministic and keeps one core lineage', function () {
  const processed = Engine.processBytes(fixture('simple.html'), { requestedUrl: 'fixtures/simple.html' });
  const first = Engine.deriveStructure(processed, { requestedBy: 'test' });
  const second = Engine.deriveStructure(processed, { requestedBy: 'test' });
  assert.equal(Canonical.stringify(first), Canonical.stringify(second));
  assert.equal(first.layout.sourceDigest, processed.source.sha256);
  assert.equal(first.layout.documentDigest, processed.documentTree.documentDigest);
  assert.equal(first.layout.pageModelDigest, processed.pageModel.pageModelDigest);
  assert.equal(first.structureIndex.pageModelDigest, processed.pageModel.pageModelDigest);
  assert.equal(first.layout.structureIndexDigest, first.structureIndex.structureIndexDigest);
  assert.equal(first.displayList.layoutDigest, first.layout.layoutDigest);
  assert.equal(first.displayList.structureIndexDigest, first.structureIndex.structureIndexDigest);
  assert.equal(first.modificationLedger.output.structureIndexDigest, first.structureIndex.structureIndexDigest);
  assert.equal(first.modificationLedger.output.displayListDigest, first.displayList.displayListDigest);
  assert.equal(first.modificationLedger.sourceMutation.performed, false);
  assert.equal(first.modificationLedger.sourceMutation.beforeDigest, first.modificationLedger.sourceMutation.afterDigest);
});

test('structure blocks remain in source-node order and expose held behavior', function () {
  const processed = Engine.processBytes(fixture('simple.html'), { requestedUrl: 'fixtures/simple.html' });
  const bundle = Engine.deriveStructure(processed);
  const orders = bundle.layout.items.map(function (item) { return Number(String(item.nodeRef).slice(1)); });
  assert.deepEqual(orders, orders.slice().sort(function (a, b) { return a - b; }));
  assert.ok(bundle.layout.items.some(function (item) { return item.kind === 'heading' && /One source/.test(item.text); }));
  assert.ok(bundle.structureIndex.entries.some(function (entry) { return entry.kind === 'landmark' && /navigation/i.test(entry.label); }));
  assert.deepEqual(bundle.layout.items.map(function (item) { return item.entryRef; }), bundle.structureIndex.entries.map(function (entry) { return entry.entryId; }));
  assert.ok(bundle.layout.items.some(function (item) { return item.kind === 'form' && /submission held/.test(item.meta); }));
  assert.ok(bundle.layout.held.every(function (item) { return item.state === 'HELD'; }));
  assert.equal(bundle.displayList.activeContent, false);
  assert.equal(bundle.displayList.externalResources, false);
});

test('headless outline, layout, and display commands expose one shared index lineage', function () {
  const bytes = fixture('simple.html');
  const outline = Engine.run(bytes, { command: 'outline', requestedUrl: 'fixtures/simple.html', omitSourceBytes: true, requestedBy: 'test' });
  const layout = Engine.run(bytes, { command: 'layout', requestedUrl: 'fixtures/simple.html', omitSourceBytes: true, requestedBy: 'test' });
  const display = Engine.run(bytes, { command: 'display', requestedUrl: 'fixtures/simple.html', omitSourceBytes: true, requestedBy: 'test' });
  assert.equal(outline.mode, 'axm-structure');
  assert.equal(outline.structureIndex.schema, 'axm.web.structure-index/v1');
  assert.equal(outline.structureIndex.entryCount, outline.structureIndex.entries.length);
  assert.equal(outline.structureIndexDigest, layout.structureIndexDigest);
  assert.equal(outline.layoutDigest, undefined);
  assert.equal(layout.mode, 'axm-structure');
  assert.equal(layout.structureLayout.schema, 'axm.web.structure-layout/v1');
  assert.equal(layout.displayList, undefined);
  assert.equal(display.displayList.schema, 'axm.web.display-list/v1');
  assert.equal(display.structureLayout, undefined);
  assert.equal(layout.layoutDigest, display.layoutDigest);
  assert.equal(layout.structureIndexDigest, display.structureIndexDigest);
  assert.equal(layout.displayListDigest, display.displayListDigest);
  assert.equal(layout.ledgerDigest, display.ledgerDigest);
});

test('viewport affects only the derived view and remains bounded', function () {
  const processed = Engine.processBytes(fixture('simple.html'), { requestedUrl: 'fixtures/simple.html' });
  const narrow = Engine.deriveStructure(processed, { viewport: { width: 640, height: 480 } });
  const wide = Engine.deriveStructure(processed, { viewport: { width: 1200, height: 800 } });
  assert.equal(narrow.processed.pageModel.pageModelDigest, wide.processed.pageModel.pageModelDigest);
  assert.equal(narrow.structureIndex.structureIndexDigest, wide.structureIndex.structureIndexDigest);
  assert.notEqual(narrow.layout.layoutDigest, wide.layout.layoutDigest);
  assert.notEqual(narrow.displayList.displayListDigest, wide.displayList.displayListDigest);
  assert.throws(function () {
    Engine.deriveStructure(processed, { viewport: { width: 200, height: 100 } });
  }, function (error) { return error.code === 'AXM_VIEWPORT_LIMIT'; });
});

test('structure-specific item, text, and canvas limits fail visibly', function () {
  const processed = Engine.processBytes(fixture('simple.html'), { requestedUrl: 'fixtures/simple.html' });
  assert.throws(function () { Engine.deriveStructure(processed, { maxLayoutItems: 1 }); }, function (error) {
    return error.code === 'AXM_STRUCTURE_ITEM_LIMIT';
  });
  assert.throws(function () { Engine.deriveStructure(processed, { maxLayoutTextChars: 20 }); }, function (error) {
    return error.code === 'AXM_STRUCTURE_TEXT_LIMIT';
  });
  assert.throws(function () { Engine.deriveStructure(processed, { maxCanvasHeight: 500 }); }, function (error) {
    return error.code === 'AXM_STRUCTURE_HEIGHT_LIMIT';
  });
});
