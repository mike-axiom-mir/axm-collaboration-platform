#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
const core = read('evidence-chain-recovery-snapshot-staging-core.js');
const materializer = read('snapshot-staging-materializer.js');
const cli = read('cli.js');
const html = read('index.html');

assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.status, 'TEST');
assert.equal(manifest.risk, 'HIGH');
assert.deepEqual(manifest.permissions, []);
assert.equal(contract.schema, 'axm.module-contract/v1');
assert(contract.provides.includes('capability.stage.evidence-chain-recovery-snapshot/v1'));
assert(contract.consumes.includes('capability.plan.evidence-chain-recovery-adapter-integration/v1'));
assert(contract.boundaries.refuses.includes('Workshop-Packager-output-write'));
assert(contract.boundaries.refuses.includes('live-snapshot-placement'));
assert(contract.boundaries.refuses.includes('root-or-target-path-in-stdout-receipt'));
assert(core.includes("PLACE_CAPABILITY = 'capability.place.evidence-chain-recovery-snapshot/v1'"));
assert(core.includes("SNAPSHOT_PREFIX = 'axm-workshop-full-evidence-repair-'"));
assert(core.includes("target must be a JSONL file under state/evidence-retention"));
assert(materializer.includes("schema: 'axm.workshop-package/v1'"));
assert(materializer.includes("fs.rmSync(outputRoot, { recursive: true, force: true })"));
assert(materializer.includes("WorkshopPackagerOutputWritten: false"));
assert(cli.includes("'--retain-staging'"));
assert(cli.includes("'--no-live-placement'"));
assert(html.includes('No Recovery Center request is sent'));
console.log('Evidence Chain Recovery Snapshot Staging Foundry discovery seam: PASS');
