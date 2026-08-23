'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../src/engine');
const Canonical = require('../src/canonical-json');
const GoldenBuilder = require('../scripts/update-goldens');

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

test('simple Structure Layout, Display List, and Modification Ledger match committed goldens', function () {
  const result = process('simple.html');
  const structure = Engine.deriveStructure(result, { requestedBy: 'golden-test' });
  assert.equal(Canonical.stringify(structure.structureIndex), Canonical.stringify(readJson('golden/simple.structure-index.json')));
  assert.equal(Canonical.stringify(structure.layout), Canonical.stringify(readJson('golden/simple.structure-layout.json')));
  assert.equal(Canonical.stringify(structure.displayList), Canonical.stringify(readJson('golden/simple.display-list.json')));
  assert.equal(Canonical.stringify(structure.modificationLedger), Canonical.stringify(readJson('golden/simple.modification-ledger.json')));
});

test('malformed warning tree and held Page Model match committed goldens', function () {
  assert.equal(Canonical.stringify(process('malformed.html').documentTree), Canonical.stringify(readJson('golden/malformed.document-tree.json')));
  assert.equal(Canonical.stringify(process('held-elements.html').pageModel), Canonical.stringify(readJson('golden/held.page-model.json')));
});

test('local navigation, history, and reload receipts match the committed session golden', function () {
  assert.equal(
    Canonical.stringify(GoldenBuilder.localSessionGolden()),
    Canonical.stringify(readJson('golden/local-session.navigation.json'))
  );
});

test('AI, web-search, and image-search plans match committed schema-validation goldens', function () {
  const plans = GoldenBuilder.capabilityPlanGoldens();
  assert.equal(Canonical.stringify(plans.ai), Canonical.stringify(readJson('golden/ai-plan.json')));
  assert.equal(Canonical.stringify(plans.search), Canonical.stringify(readJson('golden/search-plan.json')));
  assert.equal(Canonical.stringify(plans.imageSearch), Canonical.stringify(readJson('golden/image-search-plan.json')));
});
