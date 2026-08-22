'use strict';
const assert = require('assert');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.id, contract.id);
assert.equal(manifest.status, 'TEST');
assert.ok(contract.boundaries.refuses.includes('automatic-canon'));
const html = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
for (const control of ['search', 'results', 'filters', 'preview', 'metadata']) {
  assert.ok(html.includes(`data-interface-control="${control}"`), `missing Module 1 control: ${control}`);
}
assert.ok(!html.includes('<pre class="view-output"'), 'human-readable view must not expose raw Markdown as code');
for (const worldField of ['atlasWorldState', 'atlasWorldSummary', 'atlasWorldSignals']) {
  assert.ok(html.includes(`id="${worldField}"`), `missing Module 1 world-interface field: ${worldField}`);
}
require('../../shared/capability-intelligence/node-runner').verify(manifest.id);
console.log('Human Capability Atlas platform selftest: PASS');
