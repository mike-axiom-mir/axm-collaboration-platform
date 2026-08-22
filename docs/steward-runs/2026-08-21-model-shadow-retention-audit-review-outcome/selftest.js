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
const moduleDir = path.join(root, 'shared/model-shadow-retention-audit-review-outcome');
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
const schema = readModule('review-outcome.schema.json');
const source = fs.readFileSync(path.join(moduleDir, 'model-shadow-retention-audit-review-outcome.js'), 'utf8');
const focused = fs.readFileSync(path.join(moduleDir, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleDir, 'README.md'), 'utf8');
const summary = fs.readFileSync(path.join(dir, 'SESSION_SUMMARY.md'), 'utf8');
const runner = fs.readFileSync(path.join(dir, 'run-verification-checks.js'), 'utf8');

check(requirements.requirements.length === 33, 'requirements inventory contains thirty-three routes');
check(requirements.requirements.filter(item => item.required).length === 24, 'twenty-four bounded routes are required');
check(requirements.requirements.filter(item => !item.required).length === 9, 'nine broader routes remain optional');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 21, 'before comparator exposes twenty-one bounded misses');
check(before.requirements.filter(item => item.status === 'READY').length === 3, 'three upstream capabilities were ready');
check(before.requirements.filter(item => item.status === 'BLOCKED').length === 21, 'twenty-one v3.1 capabilities were blocked before implementation');
check(before.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 9, 'nine broader routes were optional unknown');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator is DEGRADED without bounded miss');
check(after.requirements.filter(item => item.status === 'READY').length === 24, 'all twenty-four required routes are READY');
check(after.requirements.filter(item => item.status === 'OPTIONAL_UNKNOWN').length === 9, 'all nine broader routes remain OPTIONAL_UNKNOWN');
check(beforeInventory.capabilities.filter(item => item.status === 'available').length === 3, 'before inventory declares three available capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'available').length === 24, 'after inventory declares twenty-four bounded capabilities');
check(afterInventory.capabilities.filter(item => item.status === 'unknown').length === 9, 'after inventory preserves nine unknown capabilities');
const availableBefore = new Set(beforeInventory.capabilities.filter(item => item.status === 'available').map(item => item.id));
const provided = new Set(contract.provides);
check(requirements.requirements.filter(item => item.required).every(item => item.capabilities.every(capability => availableBefore.has(capability) || provided.has(capability))), 'inherited or local declarations cover every bounded capability by exact id');
[
  'live-host-observation', 'authenticated-actor', 'actual-human-review',
  'steward-remediation-decision', 'hold-resolution', 'receiver-durability',
  'provider-evaluation', 'benefit-learning', 'promotion-authority'
].forEach(id => check(after.requirements.find(item => item.id === id).status === 'OPTIONAL_UNKNOWN', id + ' remains unproven'));

check(ContractVerifier.validateContract(contract).pass, 'module contract matches Workshop contract shape');
check(contract.id === 'model-shadow-retention-audit-review-outcome', 'contract identity is exact');
check(contract.version === 'v3.1' && contract.status === 'TEST', 'contract version and TEST status are exact');
check(contract.merge_gate === 'Mike Tobi / AXM', 'contract preserves Mike merge gate');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'contract remains uninstalled and unpromoted');
check(contract.lifecycle.state_owner === 'none' && contract.lifecycle.reload === 'not-applicable', 'contract declares no owned runtime state');
check(contract.permissions.some(value => value.includes('transient operation lock')), 'contract declares inherited transient-lock authority');
check(contract.boundaries.refuses.includes('standalone-outcome-as-actor-digest-provenance-proof'), 'contract refuses standalone actor-digest provenance proof');
check(contract.boundaries.refuses.includes('declared-human-seat-as-authenticated-human'), 'contract refuses declared-human authentication inference');
check(contract.boundaries.refuses.includes('artifact-approval-as-retention-hold-resolution'), 'contract refuses artifact approval as hold resolution');
check(contract.boundaries.refuses.includes('review-outcome-as-remediation-execution-or-adoption-authority'), 'contract refuses consequential outcome authority');

check(source.includes("require('../model-shadow-retention-audit-review-request/"), 'runtime composes exact v2.9 verifier');
check(source.includes('verifyPendingReviewHandoff'), 'runtime exact-rebuilds the pending handoff');
check(source.includes("SUPPORTED_STATES = Object.freeze(['APPROVED', 'HOLD', 'REJECTED'])"), 'runtime supports only three post-pending states');
check(source.includes('actorKey = actor.toLowerCase()'), 'runtime uses case-insensitive actor independence');
check(source.includes("sha256('review-actor:' + actorKey)"), 'runtime pseudonymizes actor identifiers');
check(!source.includes('actorDigest.localeCompare'), 'runtime actor-digest ordering is locale-neutral');
check(source.includes('standaloneActorDigestProvenanceProven: false'), 'runtime refuses standalone actor-digest provenance proof');
check(source.includes('actualHumanReviewProven: false') && source.includes('holdResolved: false'), 'runtime refuses human review and hold-resolution claims');
check(source.includes('executionAuthorized: false') && source.includes('automaticCanon: false'), 'runtime refuses execution and CANON claims');
check(!/review-service|ReviewService|operations-api|AXMOps|\bfetch\s*\(|XMLHttpRequest/.test(source), 'runtime imports or calls no ReviewService operations API or browser network');
check(!/require\(['"]fs['"]\)|require\(['"]child_process['"]\)|require\(['"]https?['"]\)/.test(source), 'runtime imports no filesystem process or HTTP module');

check(focused.includes('standalone validator admits self-consistent pseudonymous digest rewrite'), 'focused suite preserves standalone validation counterexample');
check(focused.includes('exact input rebuild refuses pseudonymous actor digest rewrite'), 'focused suite proves exact rebuild rejects pseudonymous rewrite');
check(focused.includes('approved outcome with HOLD counterevidence is refused'), 'focused suite refuses conflicting approval');
check(focused.includes('case-variant duplicate actor is refused'), 'focused suite refuses case-variant seat duplication');
check(focused.includes('outcome builds and fresh process leave source and Review Inbox trees byte-identical'), 'focused suite checks stable source and receiver bytes');
check(/cannot prove by itself[\s\S]+exact-rebuild/.test(readme), 'README preserves actor-digest provenance boundary');
check(/actorKind: human[\s\S]+authenticated identity/.test(readme), 'README refuses declared-human identity inference');

check(routes.routes.length === 6, 'six claim routes are frozen');
check(routes.routes.every(route => route.passCondition && route.counterevidence && route.primarySurface), 'every claim route has native pass and counterevidence surfaces');
check(routes.routes.find(route => route.claimId === 'vote-integrity-and-minimization').claim.includes('standalone validation does not prove actor-digest provenance'), 'vote route preserves standalone provenance limit');
check(routes.routes.find(route => route.claimId === 'authority-boundary').kind === 'authorization', 'authority is classified on its native surface');
check(routes.routes.find(route => route.claimId === 'transition-and-replay').primarySurface.includes('fresh-process'), 'transition routes to fresh-process execution');

check(schema.additionalProperties === false, 'JSON schema closes unknown top-level fields');
check(schema.properties.reviewOutcome.additionalProperties === false, 'JSON schema closes review outcome evidence');
check(schema.$defs.vote.additionalProperties === false, 'JSON schema closes pseudonymous vote rows');
check(schema.properties.truth.properties.standaloneActorDigestProvenanceProven.const === false, 'schema fixes standalone provenance proof false');
check(schema.properties.truth.properties.actualHumanReviewProven.const === false, 'schema fixes actual human review false');
check(schema.properties.truth.properties.holdResolved.const === false, 'schema fixes hold resolution false');
check(schema.properties.truth.properties.automaticCanon.const === false, 'schema fixes automatic CANON false');
check(/Browser verification: not applicable/.test(summary), 'summary explicitly marks browser verification not applicable');
check(/Draft 2020-12 schema meta-validation: unrun/.test(summary), 'summary preserves unavailable independent schema-validator boundary');
check(/all 24 bounded required routes `READY`/.test(summary), 'summary preserves bounded DEGRADED result');

check(sourceSnapshot.sources.length === 258, 'source snapshot declares two hundred fifty-eight normalized inputs');
check(sourceSnapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  return item.sha256 === 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
}), 'source snapshot digests match normalized source bytes');
const payload = JSON.parse(Core.canonicalJson(results)); delete payload.resultsDigest;
check(results.resultsDigest === 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex'), 'verification result digest matches canonical content');
check(results.status === 'PASS' && results.summary.commands === 49 && results.summary.passed === 49 && results.summary.failed === 0, 'all focused and AGENTS commands passed');
check(results.summary.focusedAssertions === 4224, 'focused assertion count is exact');
check(results.commands.filter(item => item.phase === 'FOCUSED').length === 39, 'thirty-nine focused commands are retained');
check(results.commands.filter(item => item.phase === 'REQUIRED').length === 10, 'all ten required AGENTS commands are retained');
check(runner.includes('only one bounded relative Node.js check is supported'), 'runner restricts commands to one relative Node script');
check(runner.includes('evidence groups?)\\b'), 'assertion aggregator requires a whole-word unit');
const evidenceJson = fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
check(!/[A-Za-z]:\\/.test(evidenceJson), 'evidence JSON contains no absolute Windows path');
check(!/sk-[A-Za-z0-9_-]{20,}|authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+/-]{10,}/i.test(evidenceJson), 'evidence JSON contains no credential pattern');

console.log('\nLocal retention-audit review-outcome evidence selftest: PASS (' + checks + ' checks)');
