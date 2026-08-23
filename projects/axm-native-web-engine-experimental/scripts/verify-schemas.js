#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../src/engine');
const BrowserSession = require('../src/browser-session');

const root = path.resolve(__dirname, '..');
const schemaDir = path.join(root, 'schemas');

function assert(condition, message) { if (!condition) throw new Error(message); }

function refsIn(value, out) {
  out = out || [];
  if (!value || typeof value !== 'object') return out;
  if (typeof value.$ref === 'string') out.push(value.$ref);
  Object.keys(value).forEach(function (key) { refsIn(value[key], out); });
  return out;
}

function main() {
  const names = fs.readdirSync(schemaDir).filter(function (name) { return name.endsWith('.schema.json'); }).sort();
  const ids = new Set();
  names.forEach(function (name) {
    const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, name), 'utf8'));
    assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', name + ' draft mismatch');
    assert(typeof schema.$id === 'string' && schema.$id, name + ' missing $id');
    assert(!ids.has(schema.$id), 'duplicate $id ' + schema.$id);
    ids.add(schema.$id);
    refsIn(schema).filter(function (ref) { return !ref.startsWith('#'); }).forEach(function (ref) {
      const file = ref.split('#')[0];
      assert(fs.existsSync(path.join(schemaDir, file)), name + ' missing referenced schema ' + file);
    });
  });
  const result = Engine.run(fs.readFileSync(path.join(root, 'fixtures/simple.html')), {
    command: 'full', requestedUrl: 'fixtures/simple.html'
  });
  assert(result.schema === 'axm.web.headless-result/v1', 'headless representative schema mismatch');
  assert(result.source.schema === 'axm.web.source-record/v1', 'source representative schema mismatch');
  assert(result.tokenStream.schema === 'axm.web.token-stream/v1', 'token representative schema mismatch');
  assert(result.document.schema === 'axm.web.document-tree/v1', 'document representative schema mismatch');
  assert(result.page.schema === 'axm.web.page-model/v1', 'page representative schema mismatch');
  const structure = Engine.run(fs.readFileSync(path.join(root, 'fixtures/simple.html')), {
    command: 'display', requestedUrl: 'fixtures/simple.html', requestedBy: 'schema-verifier'
  });
  const outline = Engine.run(fs.readFileSync(path.join(root, 'fixtures/simple.html')), {
    command: 'outline', requestedUrl: 'fixtures/simple.html', requestedBy: 'schema-verifier'
  });
  assert(structure.mode === 'axm-structure', 'structure representative mode mismatch');
  assert(outline.structureIndex.schema === 'axm.web.structure-index/v1', 'structure-index representative schema mismatch');
  assert(outline.structureIndexDigest === structure.structureIndexDigest, 'structure-index representative lineage mismatch');
  assert(structure.displayList.schema === 'axm.web.display-list/v1', 'display-list representative schema mismatch');
  assert(structure.modificationLedger.schema === 'axm.web.modification-ledger/v1', 'ledger representative schema mismatch');
  const localSession = new BrowserSession.LocalBrowserSession(
    path.join(root, 'fixtures/session-home.html'),
    [path.join(root, 'fixtures/session-about.html'), path.join(root, 'fixtures/session-details.html')]
  ).snapshot();
  assert(localSession.schema === 'axm.web.local-browser-session/v1', 'local session representative schema mismatch');
  assert(localSession.bundle.schema === 'axm.web.local-browser-bundle/v1', 'local bundle representative schema mismatch');
  assert(localSession.bundle.pages.every(function (page) { return page.structureIndexDigest; }), 'local bundle lineage missing');
  process.stdout.write('parsed ' + names.length + ' schema documents and checked representative schema identities\n');
}

if (require.main === module) main();
module.exports = { main };
