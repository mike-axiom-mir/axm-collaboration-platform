#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const ContractVerifier = require('../../../hub/module-contract-verifier');
const dir = __dirname;
const root = path.resolve(dir, '../../..');
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome-history-checkpoint');
const parentDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome-ledger');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const readModule = name => JSON.parse(fs.readFileSync(path.join(moduleDir, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const beforeInventory = read('CAPABILITY_INVENTORY_BEFORE.json');
const afterInventory = read('CAPABILITY_INVENTORY_AFTER.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const routes = read('EVIDENCE_ROUTES.json');
const sourceSnapshot = read('SOURCE_SNAPSHOT.json');
const results = read('CHECK_RESULTS.json');
const contract = readModule('module.contract.json');
const parentContract = JSON.parse(fs.readFileSync(path.join(parentDir, 'module.contract.json'), 'utf8'));
const checkpointSchema = readModule('checkpoint.schema.json');
const auditSchema = readModule('audit.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-outcome-history-checkpoint.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const parentSource = fs.readFileSync(path.join(parentDir, 'model-shadow-retention-audit-review-outcome-ledger.js'), 'utf8');
const parentFocused = fs.readFileSync(path.join(parentDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');
const reportBuilder = fs.readFileSync(path.join(dir, 'build-capability-reports.js'), 'utf8');

check(requirements.requirements.length === 35, 'requirements inventory contains thirty-five routes');
check(requirements.requirements.filter(item => item.required).length === 25, 'twenty-five bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 10, 'ten broader routes remain optional');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 34, 'before comparator exposes twenty-four required and ten optional misses');
check(before.requirements.filter(item => item.status === 'READY').length === 1, 'one v3.2 requirement was ready');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 24, 'twenty-four v3.3 requirements were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_GAP').length === 10, 'ten broader routes were optional gaps before implementation');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 25, 'all twenty-five required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 10, 'all ten broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 3, 'before inventory declares three observed v3.2 capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 25, 'after inventory declares twenty-five bounded capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'unknown').length === 10, 'after inventory preserves ten unknown capabilities');
const availableBefore = new Set(beforeInventory.capabilities.filter(item => item.status === 'available').map(item => item.id));
const provided = new Set(parentContract.provides.concat(contract.provides));
check(requirements.requirements.filter(item => item.required).every(item => item.capabilities.every(capability => availableBefore.has(capability) || provided.has(capability))), 'inherited or local declarations cover every bounded capability by exact id');
[
  'checkpoint-retention', 'authenticated-origin', 'independent-custody', 'protected-monotonic',
  'hardware-durability', 'authenticated-review', 'hold-resolution', 'provider-evaluation',
  'benefit-learning', 'promotion-authority'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-outcome-history-checkpoint', 'contract identity is exact');
check(contract.version === 'v3.3' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.lifecycle.state_owner === 'none' && contract.lifecycle.reload === 'not-applicable', 'contract declares caller-owned portable data without module state');
check(contract.boundaries.writes.length === 1 && /transient/.test(contract.boundaries.writes[0]) && /no durable/.test(contract.boundaries.writes[0]), 'contract limits writes to inherited transient lock');
check(contract.boundaries.refuses.includes('joint-ledger-and-checkpoint-replacement-as-original-history'), 'contract refuses joint replacement as original history');
check(contract.boundaries.refuses.includes('approved-history-as-hold-resolution-remediation-execution-or-adoption-authority'), 'contract refuses approved-history authority');
check(contract.boundaries.refuses.includes('equal-bracketing-snapshots-as-atomic-filesystem-snapshot'), 'contract refuses atomic snapshot inflation');

check(parentContract.provides.includes('model.shadow.retention-audit-review-outcome-ledger.single-load-complete-record-chain-read'), 'parent contract exposes bounded single-load history read');
check(parentSource.includes('function readAll()') && parentSource.includes('clone(loadState(paths, expected).records)'), 'parent runtime validates and clones all records from one load');
check(parentSource.includes('return Object.freeze({ ledgerId, capture, inspect, read, readAll, verifyPersisted })'), 'parent service exports readAll explicitly');
check(parentFocused.includes('single-load complete history read returns every exact record'), 'parent focused suite exercises complete read');
check(parentFocused.includes('fresh child reads every exact record in one validated load'), 'parent focused suite exercises fresh-process complete read');

check(source.includes("require('../model-shadow-retention-audit-review-outcome-ledger/"), 'runtime composes exact v3.2 module');
check(source.includes('observation.service.readAll()'), 'runtime uses the bounded v3.2 single-load surface');
check(source.includes('LEDGER_MOVED_DURING_PRESENTATION'), 'runtime fails changed bracketing snapshots');
check(source.includes('OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT'), 'runtime exposes typed rollback classification');
check(source.includes('OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT'), 'runtime exposes typed replacement or fork classification');
check(source.includes('checkpointSeparatelyRetainedProven: false'), 'runtime refuses checkpoint-retention proof');
check(source.includes('jointCheckpointAndLedgerReplacementExcluded: false'), 'runtime preserves joint replacement counterevidence');
check(source.includes('retentionHoldResolved: false') && source.includes('executionAuthorized: false'), 'runtime refuses hold resolution and execution claims');
check(!/require\(['"]fs['"]\)|review-service|ReviewService|operations-api|AXMOps|\bfetch\s*\(|XMLHttpRequest/.test(source), 'runtime imports or calls no direct filesystem ReviewService operations API or browser network');
check(!/require\(['"]child_process['"]\)|require\(['"]https?['"]\)/.test(source), 'runtime imports no process or HTTP module');

[
  'exact history is classified exactly', 'strict extension is classified forward',
  'short exact prefix is classified rollback', 'divergent suffix is classified replacement or fork',
  'manifest drift is classified identity drift', 'absent namespace is classified absent',
  'corrupt current ledger is classified invalid', 'invalid configuration receives typed invalid classification'
].forEach(label => check(focused.includes(label), 'focused suite covers ' + label));
check(focused.includes('changed bracketing snapshot fails closed'), 'focused suite covers changed bracket');
check(focused.includes('oversized checkpoint input fails before processing'), 'focused suite covers input bound');
check(focused.includes('retained original checkpoint detects same-identity whole-ledger replacement'), 'focused suite covers retained-checkpoint rewrite detection');
check(focused.includes('jointly replaced checkpoint and ledger form another internally exact pair'), 'focused suite preserves joint replacement counterexample');
check(focused.includes('checkpoint self-validates after origin loss'), 'focused suite covers self-validation after origin loss');
check(focused.includes('checkpoint origin cannot be reverified after origin loss'), 'focused suite preserves origin rebuild boundary');
check(/Replacing or withholding the[\s\S]+checkpoint together with the[\s\S]+ledger/.test(readme), 'README preserves joint replacement and withholding boundary');
check(/do not[\s\S]+form an atomic filesystem snapshot/.test(readme), 'README preserves non-atomic bracketing boundary');

check(routes.routes.length === 5, 'five claim routes are frozen');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface && route.observedEvidence), 'every claim route has pass counterevidence and observed surfaces');
check(routes.routes.every(route => route.verdict === 'PASS'), 'all bounded claim routes have PASS evidence');
check(routes.routes.find(route => route.claimId === 'rewrite-boundary').observedEvidence.includes('regenerated from the replacement'), 'rewrite route preserves joint replacement counterevidence');
check(routes.routes.find(route => route.claimId === 'checkpoint-portable-validation').kind === 'persistence', 'portable validation uses persistence-native evidence');

[checkpointSchema, auditSchema].forEach(schema => check(schema.additionalProperties === false, schema.$id + ' closes unknown top-level fields'));
check(checkpointSchema.properties.ledger.additionalProperties === false, 'checkpoint schema closes ledger binding');
check(checkpointSchema.properties.history.additionalProperties === false, 'checkpoint schema closes history binding');
check(checkpointSchema.$defs.entry.additionalProperties === false, 'checkpoint schema closes history entries');
check(checkpointSchema.$defs.checkpointTruth.additionalProperties === false, 'checkpoint schema closes truth fields');
check(checkpointSchema.$defs.checkpointTruth.properties.checkpointSeparatelyRetainedProven.const === false, 'checkpoint schema fixes retention proof false');
check(checkpointSchema.$defs.checkpointTruth.properties.jointCheckpointAndLedgerReplacementExcluded.const === false, 'checkpoint schema fixes joint replacement exclusion false');
check(checkpointSchema.$defs.checkpointTruth.properties.retentionHoldResolved.const === false, 'checkpoint schema fixes hold resolution false');
check(auditSchema.properties.current.additionalProperties === false, 'audit schema closes current state');
check(auditSchema.properties.comparison.additionalProperties === false, 'audit schema closes comparison');
check(auditSchema.properties.decision.additionalProperties === false, 'audit schema closes decision');
check(auditSchema.properties.decision.properties.autonomousActionCount.const === 0, 'audit schema fixes zero actions');
check(auditSchema.$defs.auditTruth.properties.originalHistoryProven.const === false, 'audit schema fixes original-history proof false');

check(/Browser verification: not applicable/.test(summary), 'summary explicitly marks browser verification not applicable');
check(/Draft 2020-12 schema meta-validation: unrun/.test(summary), 'summary preserves unavailable independent schema-validator boundary');
check(/all 25 bounded required routes `READY`/.test(summary), 'summary preserves bounded DEGRADED result');
check(/initial focused run reached 125 assertions/.test(summary), 'summary preserves initial evidence mismatch and correction');
check(/checkpoint regenerated from that replacement/.test(summary), 'summary preserves joint replacement boundary');

check(sourceSnapshot.sources.length === 274, 'source snapshot declares two hundred seventy-four normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 51 && results.summary.passed === 51 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 4520, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 41, 'forty-one focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
check(runner.includes('only one bounded relative Node.js check is supported'), 'runner restricts commands to one relative Node script');
check(runner.includes('evidence groups?)\\b'), 'assertion aggregator requires a whole-word unit');
check(reportBuilder.includes('process.argv[2]') && reportBuilder.includes('path.isAbsolute(comparator)'), 'capability report builder requires a runtime path without committing one');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nPortable review-outcome history checkpoint evidence selftest: PASS (' + checks + ' checks)');
