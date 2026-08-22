'use strict';
const assert = require('assert');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.id, contract.id);
assert.ok(contract.boundaries.refuses.includes('automatic-merge'));
const receipt = require('../../shared/capability-intelligence/generated/verified-workflow/pipeline-receipt.json');
assert.equal(receipt.module2_to_module3.digest_match, true);
assert.equal(receipt.module3.checks.need_candidate_retained, true);
assert.equal(receipt.module3.checks.authority_remains_closed, true);
const html = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
for (const control of ['search', 'results', 'preview']) {
  assert.ok(html.includes(`data-interface-control="${control}"`), `missing Module 3 control: ${control}`);
}
for (const worldField of ['worldChangeState', 'worldChangeSummary', 'worldSourceCount', 'worldCheckedAt', 'worldChangeSources']) {
  assert.ok(html.includes(`id="${worldField}"`), `missing Module 3 world-interface field: ${worldField}`);
}
require('../../shared/capability-intelligence/node-runner').verify(manifest.id);
console.log('Grounded Evolution Intelligence platform selftest: PASS');
