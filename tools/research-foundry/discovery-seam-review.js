'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');
const machineRegistry = require('../../shared/deterministic-research/machine-contracts.json');

const expected = ['research.goal.normalize/v1','research.workshop.scan/v1','research.question.compile/v1','research.hypothesis.route/v1','research.experiment.plan/v1','research.backlog.rank/v1','research.evidence.ingest/v1','research.report.compile/v1','research.run.compose/v1','research.ui.observe/v1'];
assert.equal(manifest.id, 'research-foundry');
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.deepEqual(manifest.permissions, []);
assert.equal(contract.id, manifest.id);
expected.forEach(capability => assert.ok(contract.provides.includes(capability), 'missing ' + capability));
assert.equal(machineRegistry.machines.length, 11);
assert.ok(contract.boundaries.refuses.includes('automatic-build'));
assert.ok(contract.boundaries.refuses.includes('semantic-lead-as-exact-match'));
assert.ok(contract.boundaries.refuses.includes('contradiction-averaging'));
assert.ok(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8').includes('/exports/deterministic-research/latest/research-report.json'));
console.log('Deterministic Research Foundry discovery seam: PASS - 11 modular components, observe-only view');
