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
const moduleRoot = path.join(root, 'shared/model-shadow-review-challenge-transition-ledger');
const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-transition-ledger.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleRoot, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleRoot, 'README.md'), 'utf8');
const entrySchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-transition-ledger-entry.schema.json'), 'utf8'));
const manifestSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-transition-ledger-manifest.schema.json'), 'utf8'));
const snapshotSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-transition-ledger-snapshot.schema.json'), 'utf8'));

check(requirements.requirements.length === 24 && requirements.requirements.filter(item => item.required).length === 14, 'requirements separate fourteen bounded technical routes from ten protected, authority, human and outcome routes');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 13, 'before report records thirteen missing local-ledger capabilities');
check(before.requirements.find(item => item.id === 'upstream-pairwise-transition-integrity').status === 'READY', 'before report preserves upstream v0.7 exact transition rebuild');
check(before.requirements.filter(item => item.required && item.id !== 'upstream-pairwise-transition-integrity').every(item => item.status === 'BLOCKED'), 'before report blocks every new required local-ledger route');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after report closes bounded required gaps while the broad frontier remains degraded');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all fourteen bounded technical routes are ready after implementation');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all ten protected, authority, human and outcome routes remain optional unknown');
check(after.requirements.find(item => item.id === 'authenticated-host-entrypoint').status === 'OPTIONAL_UNKNOWN', 'authenticated host entrypoint remains unproven');
check(after.requirements.find(item => item.id === 'globally-consistent-transition-log').status === 'OPTIONAL_UNKNOWN', 'global transition consistency remains unproven');
check(after.requirements.find(item => item.id === 'independent-external-retention').status === 'OPTIONAL_UNKNOWN', 'independent external retention remains unproven');
check(after.requirements.find(item => item.id === 'protected-monotonic-state').status === 'OPTIONAL_UNKNOWN', 'protected monotonic state remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unrun');
check(after.requirements.find(item => item.id === 'held-out-human-benefit').status === 'OPTIONAL_UNKNOWN', 'held-out human benefit remains unproven');

check(contract.status === 'TEST' && contract.permissions.length === 0, 'module remains TEST with no declared host permission integration');
check(contract.boundaries.writes.length === 2 && contract.boundaries.reads.length === 2, 'contract declares only fixed local manifest and sequence paths');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('one-local-root-as-globally-consistent-log'), 'contract refuses local serialization as global consistency');
check(contract.boundaries.refuses.includes('independent-caller-roots-as-one-coordinated-state'), 'contract preserves independent-root fork boundary');
check(contract.boundaries.refuses.includes('caller-owned-files-as-external-retention-or-protected-monotonic-state'), 'contract refuses caller files as protected state or external retention');
check(contract.boundaries.refuses.includes('stored-transition-receipt-as-upstream-signature-reverification-after-restart'), 'contract distinguishes local reload from upstream signature re-verification');
check(contract.boundaries.refuses.includes('explicit-confirmation-as-host-authorization'), 'contract refuses confirmation as host authorization');
check(contract.boundaries.refuses.includes('transition-recording-as-execution-or-adoption-authority'), 'contract refuses local record as downstream authority');

check(implementation.includes("const CONFIRMATION = 'ADVANCE CALLER-OWNED TRANSITION HEAD ONCE'"), 'implementation requires an exact explicit confirmation phrase');
check(implementation.includes("transition.decision.classification !== 'CANDIDATE_EXTENDS_PRESENTED_CHAIN'"), 'implementation accepts only exact v0.7 forward extensions');
check(implementation.includes("throw new TransitionLedgerError('STALE_LOCAL_HEAD'"), 'implementation exposes typed stale-local-head refusal');
check(implementation.includes("fs.openSync(filePath, 'wx'"), 'implementation uses exclusive file creation');
check(implementation.includes('fs.fsyncSync(descriptor)'), 'implementation file-syncs returned manifest and entry writes');
check(implementation.includes("const ENTRY_FILE = /^([0-9]{12})\\.json$/"), 'implementation constrains entry names to exact 12-digit sequence files');
check(implementation.includes('Number(match[1]) !== index + 1'), 'implementation validates one contiguous local sequence');
check(implementation.includes('previousEntryRef = entryRef(entry)'), 'implementation carries the prior entry digest reference forward');
check(implementation.includes('currentHead = copy(entry.candidateSeparatedWitnessRef)'), 'implementation derives local head from validated candidate references');
check(implementation.includes('persistedUpstreamTransitionInput: false'), 'implementation explicitly omits upstream exact-rebuild input from entries');
check(implementation.includes('upstreamTransitionReverifiedAfterReloadWithoutCallerPackage: false'), 'implementation refuses reload-only upstream signature verification claim');
check(implementation.includes('independentStateRootsExcluded: false'), 'implementation keeps independent roots unexcluded');
check(implementation.includes('globallyConsistentTransitionLogProven: false'), 'implementation keeps global log consistency false');
check(implementation.includes('protectedMonotonicStateProven: false'), 'implementation keeps protected monotonic state false');
check(implementation.includes('deletionOrRollbackPrevented: false'), 'implementation keeps deletion prevention false');
check(implementation.includes('hostAuthorizationAuthenticated: false'), 'implementation keeps host authorization false');
check(implementation.includes('executionAuthorized: false') && implementation.includes('automaticCanon: false'), 'implementation preserves execution and CANON boundaries');
check(!implementation.includes("require('child_process')") && !implementation.includes('fetch('), 'runtime implementation imports no process or network capability');

check(focusedTest.includes('alternate fork from genesis is stale after local head advances'), 'focused test proves stale-fork refusal in one preserved root');
check(focusedTest.includes('two concurrent extensions of one local head produce exactly one winner'), 'focused test proves single-winner local contention');
check(focusedTest.includes('independent roots accept different pairwise-valid fork heads'), 'focused test preserves independent-root fork counterevidence');
check(focusedTest.includes('deleting caller state reopens a different branch from the same genesis'), 'focused test preserves deletion/reinitialization counterevidence');
check(focusedTest.includes('fresh process derives the exact same local snapshot'), 'focused test routes persistence through a fresh process');
check(focusedTest.includes('fresh process verifies caller package against persisted entry'), 'focused test exact-rebuilds persisted entry with caller package after restart');
check(focusedTest.includes('truncated local entry fails closed on fresh reload'), 'focused test proves corrupt local entry fails closed');
check(focusedTest.includes('noncontiguous local entry sequence fails closed'), 'focused test proves sequence gaps fail closed');
check(focusedTest.includes('contains no raw public key') && focusedTest.includes('contains no raw signature'), 'focused test checks persisted data minimization');
check(/Two\s+independent roots can accept/.test(readme) && /deleting or rolling back/.test(readme), 'README preserves independent-root and deletion limitations');

check(entrySchema.$id === 'axm.model-shadow-review-challenge-transition-ledger-entry/v1', 'entry schema identity is exact');
check(manifestSchema.$id === 'axm.model-shadow-review-challenge-transition-ledger-manifest/v1', 'manifest schema identity is exact');
check(snapshotSchema.$id === 'axm.model-shadow-review-challenge-transition-ledger-snapshot/v1', 'snapshot schema identity is exact');
check(entrySchema.properties.truth.properties.globalTransitionUniquenessProven.const === false, 'entry schema keeps global uniqueness false');
check(snapshotSchema.properties.truth.properties.upstreamTransitionsReverifiedWithoutCallerPackages.const === false, 'snapshot schema keeps reload-only upstream verification false');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 52, 'source snapshot declares fifty-two normalized TEST inputs');
  check(snapshot.sources.every(item => {
    const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
    return 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex') === item.sha256;
  }), 'source snapshot digests match current normalized source bytes');
}

if (fs.existsSync(path.join(__dirname, 'CHECK_RESULTS.json'))) {
  const results = read('CHECK_RESULTS.json');
  const payload = JSON.parse(Core.canonicalJson(results));
  delete payload.resultsDigest;
  const digestValue = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  check(results.status === 'PASS' && results.summary.commands === 26 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
  check(results.summary.focusedAssertions === 939, 'focused assertion count matches recorded command outputs');
  check(results.resultsDigest === digestValue, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow review challenge transition ledger evidence selftest: PASS (' + checks + ' checks)');
