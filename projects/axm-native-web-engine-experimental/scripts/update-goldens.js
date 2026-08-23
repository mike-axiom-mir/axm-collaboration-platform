#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../src/engine');
const Canonical = require('../src/canonical-json');
const BrowserSession = require('../src/browser-session');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'golden');

function processFixture(name) {
  return Engine.processBytes(fs.readFileSync(path.join(root, 'fixtures', name)), { requestedUrl: 'fixtures/' + name });
}

function write(name, value) {
  fs.writeFileSync(path.join(outDir, name), Canonical.stringify(value, 2) + '\n', 'utf8');
}

function localSessionGolden() {
  const session = new BrowserSession.LocalBrowserSession(
    'fixtures/session-home.html',
    ['fixtures/session-about.html', 'fixtures/session-details.html'],
    { baseDirectory: root }
  );
  session.apply({ type: 'activate', entryRef: 'entry-0003' });
  session.apply({ type: 'back' });
  session.apply({ type: 'forward' });
  session.apply({ type: 'reload' });
  return session.snapshot();
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
  write('local-session.navigation.json', localSessionGolden());
  process.stdout.write('wrote 9 deterministic golden files\n');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { localSessionGolden, main };
