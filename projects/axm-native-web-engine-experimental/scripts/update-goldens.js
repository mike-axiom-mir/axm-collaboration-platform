#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../src/engine');
const Canonical = require('../src/canonical-json');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'golden');

function processFixture(name) {
  return Engine.processBytes(fs.readFileSync(path.join(root, 'fixtures', name)), { requestedUrl: 'fixtures/' + name });
}

function write(name, value) {
  fs.writeFileSync(path.join(outDir, name), Canonical.stringify(value, 2) + '\n', 'utf8');
}

function main(argv) {
  if (!argv.includes('--write')) throw new Error('refusing to rewrite goldens without --write');
  fs.mkdirSync(outDir, { recursive: true });
  const simple = processFixture('simple.html');
  const structure = Engine.deriveStructure(simple, { requestedBy: 'golden-test' });
  write('simple.document-tree.json', simple.documentTree);
  write('simple.page-model.json', simple.pageModel);
  write('simple.structure-index.json', structure.structureIndex);
  write('simple.structure-layout.json', structure.layout);
  write('simple.display-list.json', structure.displayList);
  write('simple.modification-ledger.json', structure.modificationLedger);
  write('malformed.document-tree.json', processFixture('malformed.html').documentTree);
  write('held.page-model.json', processFixture('held-elements.html').pageModel);
  process.stdout.write('wrote 8 deterministic golden files\n');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { main };
