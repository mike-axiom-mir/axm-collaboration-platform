#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../src/engine');
const Svg = require('../src/svg-renderer');
const BrowserSnapshot = require('../src/browser-snapshot');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'examples');

function build() {
  const processed = Engine.processBytes(fs.readFileSync(path.join(root, 'fixtures/simple.html')), {
    requestedUrl: 'fixtures/simple.html'
  });
  const bundle = Engine.deriveStructure(processed, {
    requestedBy: 'committed-example-build',
    viewport: { width: 1120, height: 760 }
  });
  return {
    'simple.structure.svg': Svg.renderSvg(bundle.displayList, { title: bundle.layout.chrome.title }),
    'simple.browser-snapshot.html': BrowserSnapshot.renderBrowserSnapshot(bundle)
  };
}

function main(argv) {
  const outputs = build();
  const write = argv.includes('--write');
  const verify = argv.includes('--verify');
  if (write === verify) throw new Error('choose exactly one of --write or --verify');
  if (write) fs.mkdirSync(outputDir, { recursive: true });
  Object.keys(outputs).sort().forEach(function (name) {
    const output = path.join(outputDir, name);
    if (write) {
      fs.writeFileSync(output, outputs[name], 'utf8');
      return;
    }
    const actual = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
    if (actual !== outputs[name]) throw new Error('example mismatch: ' + name + '; run npm run examples:update after reviewed changes');
  });
  process.stdout.write((write ? 'wrote ' : 'verified ') + Object.keys(outputs).length + ' deterministic visual examples\n');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { build, main };
