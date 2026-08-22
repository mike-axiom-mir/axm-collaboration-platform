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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-request');
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
const artifactSchema = readModule('review-artifact.schema.json');
const requestSchema = readModule('review-request.schema.json');
const handoffSchema = readModule('pending-review-handoff.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-request.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');
const receiverUtils = fs.readFileSync(path.join(root, 'shared/operations/operations-utils.js'), 'utf8');

check(requirements.requirements.length === 26, 'requirements inventory contains twenty-six routes');
check(requirements.requirements.filter(item => item.required).length === 18, 'eighteen bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 8, 'eight broader routes remain optional');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 16, 'before comparator exposes sixteen bounded misses');
check(before.requirements.filter(item => item.status === 'READY').length === 2, 'two upstream capabilities were ready');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 16, 'sixteen v2.9 capabilities were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 8, 'eight broader routes were optional unknown');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 18, 'all eighteen required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 8, 'all eight broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 2, 'before inventory declares two available capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 18, 'after inventory declares eighteen bounded capabilities');
const provided = new Set(contract.provides);
check(requirements.requirements.filter(item => item.required).every(item => item.capabilities.every(capability => provided.has(capability))), 'contract provides every bounded capability by exact id');
[
  'host-authorization', 'actual-human-review', 'authenticated-identity', 'hold-resolution',
  'receiver-durability', 'provider-evaluation', 'benefit-learning', 'promotion-authority'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-request', 'contract identity is exact');
check(contract.version === 'v2.9' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.lifecycle.state_owner === 'none' && contract.lifecycle.reload === 'not-applicable', 'contract declares no owned runtime state');
check(contract.boundaries.writes.some(value => value.includes('transient operation lock') && value.includes('no durable state')), 'contract declares inherited transient lock without durable output');
check(contract.boundaries.refuses.includes('automatic-review-inbox-submission'), 'contract refuses automatic Review Inbox submission');
check(contract.boundaries.refuses.includes('declared-host-route-as-host-mutation-authorization-proof'), 'contract refuses route declaration as authorization proof');
check(contract.boundaries.refuses.includes('receiver-reload-presentation-as-independent-process-or-persistence-proof'), 'contract refuses reload presentation as process or persistence proof');
check(contract.boundaries.refuses.includes('review-approval-as-held-observation-resolution'), 'contract refuses approval as hold resolution');

check(source.includes("require('../model-shadow-retention-audit-observation-ledger/"), 'runtime composes exact v2.8 module');
check(source.includes('.verifyPersisted('), 'runtime exact-reloads persisted v2.8 observation');
check(source.includes("REVIEW_ROUTE = '/api/reviews'"), 'runtime declares exact host route');
check(source.includes("REVIEW_HEADER_VALUE = 'explicit-submit'"), 'runtime declares explicit host header');
check(source.includes('reviewSubmittedByModule: false'), 'runtime fixes module submission false');
check(source.includes('hostMutationAuthorizationProven: false'), 'runtime fixes host authorization false');
check(source.includes('independentReceiverProcessProven: false'), 'runtime refuses independent process inference');
check(source.includes('receiverStateFileFsyncProven: false'), 'runtime refuses receiver fsync proof');
check(source.includes('actualHumanReviewProven: false') && source.includes('holdResolved: false'), 'runtime refuses human review and hold-resolution claims');
check(source.includes('humanBenefitProven: false') && source.includes('automaticCanon: false'), 'runtime refuses benefit and CANON claims');
check(!source.includes('review-service') && !source.includes('ReviewService'), 'runtime does not import ReviewService');
check(!source.includes('operations-api') && !source.includes("require('fs')"), 'runtime does not bypass host API or import filesystem');
check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes('fetch('), 'runtime opens no network route');
check(!source.includes('child_process'), 'runtime launches no process');

check(focused.includes('non-held observation is refused'), 'focused suite refuses non-held observations');
check(focused.includes('candidate embedded artifact drift is refused'), 'focused suite refuses embedded artifact drift');
check(focused.includes('fresh receiver process reloads exact pending item'), 'focused suite exercises fresh-process receiver reload');
check(focused.includes('approved receiver item is refused'), 'focused suite refuses receiver approval state');
check(focused.includes("'public request omits ' + key"), 'focused suite scans public request minimization');
check(focused.includes('receiver utility source provides no file-fsync evidence'), 'focused suite preserves receiver durability counterevidence');
check(/does not invoke that route,[\s\S]+import ReviewService/.test(readme), 'README states data-only host boundary');
check(/PENDING[^\n]+proves no human review/.test(readme), 'README refuses PENDING as human review proof');

check(routes.routes.length === 6, 'six claim routes are frozen');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface), 'every claim route has native pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'review-transport-compatibility').primarySurface.includes('separate-process'), 'transport routes to sender and receiver surfaces');
check(routes.routes.find(route => route.claimId === 'host-authority-boundary').kind === 'authorization', 'authority is classified on its native surface');

[artifactSchema, requestSchema, handoffSchema].forEach(schema => check(schema.additionalProperties === false, schema.$id + ' closes unknown top-level fields'));
check(requestSchema.properties.reviewArtifact.$ref === 'review-artifact.schema.json', 'request schema reuses artifact schema');
check(requestSchema.properties.reviewCandidate.properties.action.properties.artifact.$ref === 'review-artifact.schema.json', 'candidate action schema reuses artifact schema');
check(requestSchema.properties.truth.properties.reviewSubmittedByModule.const === false, 'request schema refuses module submission claim');
check(handoffSchema.properties.truth.properties.independentReceiverProcessProven.const === false, 'handoff schema refuses process provenance claim');
check(handoffSchema.properties.truth.properties.receiverStateFileFsyncProven.const === false, 'handoff schema refuses receiver fsync claim');
check(!receiverUtils.includes('fs.fsync') && receiverUtils.includes('catch (_) { return clone(fallback); }'), 'receiver source preserves fsync and corruption-resistance counterevidence');
check(/Independent Draft 2020-12 meta-validation remains unrun/.test(summary), 'summary preserves unavailable meta-validator boundary');
check(/PENDING[^\n]+proves no vote/.test(summary), 'summary preserves pending review boundary');
check(/inherited\s+v2.8 verifier[\s\S]+transient operation lock/.test(summary), 'summary preserves inherited transient-lock write');

check(sourceSnapshot.sources.length === 239, 'source snapshot declares two hundred thirty-nine normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 45 && results.summary.passed === 45 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 3869, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 35, 'thirty-five focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
check(runner.includes('only one bounded relative Node.js check is supported'), 'runner restricts commands to one relative Node script');
check(runner.includes('evidence groups?)\\b'), 'assertion aggregator requires a whole-word unit');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nLocal retention-audit review-request evidence selftest: PASS (' + checks + ' checks)');
