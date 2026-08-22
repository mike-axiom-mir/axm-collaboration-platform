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
const contract = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-challenger-gate/module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(root, 'shared/model-shadow-challenger-gate/model-shadow-challenger-gate.js'), 'utf8');
const proposalSchema = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-challenger-gate/model-shadow-challenger-proposal.schema.json'), 'utf8'));
const handoffSchema = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-challenger-gate/model-shadow-challenger-reviewed-handoff.schema.json'), 'utf8'));

check(requirements.requirements.length === 10 && requirements.requirements.filter(item => item.required).length === 8, 'requirements cover eight required routes and two optional real-world routes');
check(before.overall === 'BLOCKED' && before.requirements.filter(item => item.required).every(item => item.status === 'BLOCKED'), 'before report records the missing shadow-to-challenger contract');
check(after.overall === 'DEGRADED' && after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'after report closes every required route while real-world evidence stays optional');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains explicitly unrun');
check(after.requirements.find(item => item.id === 'executed-benefit-evidence').status === 'OPTIONAL_UNKNOWN', 'execution, evaluation, and human benefit remain explicitly unrun');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains a permissionless write-free TEST leaf');
check(contract.boundaries.refuses.includes('critical-authority-drift-as-challenger') && contract.boundaries.refuses.includes('review-approval-as-execution-authority'), 'contract refuses authority substitution');
check(contract.boundaries.refuses.includes('declared-human-seat-as-authenticated-human') && contract.boundaries.refuses.includes('ai-workflow-win-as-human-benefit'), 'contract refuses human identity and benefit overclaims');
check(proposalSchema.$id === 'axm.model-shadow-challenger-proposal/v1' && handoffSchema.$id === 'axm.model-shadow-challenger-reviewed-handoff/v1', 'schema identities bind proposal and reviewed handoff contracts');
check(implementation.includes("state: 'HOLD_CRITICAL_AUTHORITY_DRIFT'") && implementation.includes("state: 'HOLD_INVALID_COMPARISON'"), 'implementation has typed critical and invalid-comparison holds');
check(implementation.includes("state: 'CHALLENGER_PLAN_READY_FOR_EXPLICIT_REVIEW'") && implementation.includes('Challenger.buildPlan'), 'implementation reuses the native Challenger Lab plan');
check(implementation.includes('actualHumanParticipationProven: false') && implementation.includes('executionAuthorized: false'), 'implementation keeps review identity and execution claims bounded');
check(!implementation.includes('fetch(') && !implementation.includes('child_process') && !implementation.includes('writeFile'), 'implementation contains no provider call, process launch, or file-write route');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 9, 'source snapshot declares nine normalized TEST inputs');
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
  check(results.status === 'PASS' && results.summary.commands === 18 && results.summary.failed === 0, 'all focused and required commands passed');
  check(results.resultsDigest === digest, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow Challenger Gate evidence selftest: PASS (' + checks + ' checks)');
