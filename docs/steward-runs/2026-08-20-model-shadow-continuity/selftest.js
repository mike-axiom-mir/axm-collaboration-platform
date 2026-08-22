#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const root = path.resolve(__dirname, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-continuity/module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(root, 'shared/model-shadow-continuity/model-shadow-continuity.js'), 'utf8');
const snapshotSchema = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-continuity/model-shadow-snapshot.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-continuity/model-shadow-continuity-receipt.schema.json'), 'utf8'));

check(requirements.requirements.length === 10 && requirements.requirements.filter(item => item.required).length === 8, 'requirements cover eight required routes and two optional real-world routes');
check(before.overall === 'BLOCKED' && before.requirements.filter(item => item.required).every(item => item.status === 'BLOCKED'), 'before report records the missing temporal model-shadow contract');
check(after.overall === 'DEGRADED' && after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'after report closes every required route while optional evidence stays open');
check(after.requirements.find(item => item.id === 'live-provider-shadowing').status === 'OPTIONAL_UNKNOWN', 'live provider transport remains explicitly unrun');
check(after.requirements.find(item => item.id === 'human-value-evidence').status === 'OPTIONAL_UNKNOWN', 'actual human review and benefit remain explicitly unrun');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains a permissionless write-free TEST leaf');
check(contract.boundaries.refuses.includes('raw-model-output-ingestion') && contract.boundaries.refuses.includes('private-context-ingestion') && contract.boundaries.refuses.includes('same-model-mind-claim'), 'contract refuses raw/private ingestion and identity overclaim');
check(contract.boundaries.refuses.includes('provider-invocation') && contract.boundaries.refuses.includes('automatic-training') && contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses invocation, training, and canon authority');
check(snapshotSchema.$id === 'axm.model-shadow-snapshot/v1' && receiptSchema.$id === 'axm.model-shadow-continuity-receipt/v1', 'schema identities bind snapshot and receipt contracts');
check(implementation.includes("classification = 'STRUCTURED_TRACE_MATCH'") && implementation.includes("classification = 'CRITICAL_DRIFT'"), 'implementation separates structured match from critical drift');
check(implementation.includes("scope: 'DECLARED_STRUCTURED_TRACE_ONLY'") && implementation.includes('rawOutputArtifactCompared: false'), 'implementation states the comparison scope and raw-output non-comparison');
check(!implementation.includes('fetch(') && !implementation.includes('child_process') && !implementation.includes('writeFile'), 'implementation contains no provider call, process launch, or file-write route');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 8, 'source snapshot declares eight normalized TEST inputs');
  check(snapshot.sources.every(item => {
    const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
    return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
  }), 'source snapshot digests match current normalized source bytes');
}

if (fs.existsSync(path.join(__dirname, 'CHECK_RESULTS.json'))) {
  const results = read('CHECK_RESULTS.json');
  const payload = JSON.parse(Core.canonicalJson(results));
  delete payload.resultsDigest;
  const digest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  check(results.status === 'PASS' && results.summary.commands === 17 && results.summary.failed === 0, 'all focused and required commands passed');
  check(results.resultsDigest === digest, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow Continuity evidence selftest: PASS (' + checks + ' checks)');
