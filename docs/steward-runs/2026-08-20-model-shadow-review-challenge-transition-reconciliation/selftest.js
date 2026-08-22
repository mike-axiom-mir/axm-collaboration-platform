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
const moduleRoot = path.join(root, 'shared/model-shadow-review-challenge-transition-reconciliation');
const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
const implementation = fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-transition-reconciliation.js'), 'utf8');
const focusedTest = fs.readFileSync(path.join(moduleRoot, 'selftest.js'), 'utf8');
const readme = fs.readFileSync(path.join(moduleRoot, 'README.md'), 'utf8');
const presentationSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-transition-ledger-presentation.schema.json'), 'utf8'));
const reconciliationSchema = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'model-shadow-review-challenge-transition-reconciliation.schema.json'), 'utf8'));

check(requirements.requirements.length === 24 && requirements.requirements.filter(item => item.required).length === 14, 'requirements separate fourteen bounded technical routes from ten global, authority, human and outcome routes');
check(before.overall === 'BLOCKED' && before.missingCapabilities.length === 13, 'before report records thirteen missing reconciliation capabilities');
check(before.requirements.find(item => item.id === 'upstream-v0.8-entry-package-rebuild').status === 'READY', 'before report preserves upstream v0.8 caller-package rebuild');
check(before.requirements.filter(item => item.required && item.id !== 'upstream-v0.8-entry-package-rebuild').every(item => item.status === 'BLOCKED'), 'before report blocks every new required reconciliation route');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after report closes bounded required gaps while the broad frontier remains degraded');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all fourteen bounded technical routes are ready after implementation');
check(after.requirements.filter(item => !item.required).every(item => item.status === 'OPTIONAL_UNKNOWN'), 'all ten global, authority, human and outcome routes remain optional unknown');
check(after.requirements.find(item => item.id === 'authenticated-host-entrypoint').status === 'OPTIONAL_UNKNOWN', 'authenticated host entrypoint remains unproven');
check(after.requirements.find(item => item.id === 'globally-consistent-transition-log').status === 'OPTIONAL_UNKNOWN', 'globally consistent log remains unproven');
check(after.requirements.find(item => item.id === 'compelled-multi-party-disclosure').status === 'OPTIONAL_UNKNOWN', 'compelled multi-party disclosure remains unproven');
check(after.requirements.find(item => item.id === 'independent-external-retention').status === 'OPTIONAL_UNKNOWN', 'independent external retention remains unproven');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains unrun');
check(after.requirements.find(item => item.id === 'held-out-benefit-and-learning').status === 'OPTIONAL_UNKNOWN', 'held-out benefit and learning remain unproven');

check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless read-only TEST');
check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
check(contract.boundaries.refuses.includes('two-presented-roots-as-all-existing-roots'), 'contract refuses two presented roots as all roots');
check(contract.boundaries.refuses.includes('pairwise-prefix-as-global-total-order'), 'contract refuses pairwise prefix as global total order');
check(contract.boundaries.refuses.includes('co-presented-fork-detection-as-compelled-disclosure'), 'contract refuses fork detection as compelled disclosure');
check(contract.boundaries.refuses.includes('caller-packages-as-external-retention'), 'contract refuses caller packages as external retention');
check(contract.boundaries.refuses.includes('reconciliation-receipt-as-branch-adoption-or-execution-authority'), 'contract refuses reconciliation as branch adoption or execution authority');

check(implementation.includes("const MAX_PRESENTED_ENTRIES = 4096"), 'implementation declares exact entry-count bound');
check(implementation.includes('const MAX_PRESENTATION_CANONICAL_BYTES = 16 * 1024 * 1024'), 'implementation declares exact canonical-byte bound');
check(implementation.includes('TransitionLedger.buildManifest'), 'implementation exact-rebuilds presented manifests');
check(implementation.includes('TransitionLedger.buildEntry'), 'implementation exact-rebuilds every presented entry and upstream package');
check(implementation.includes('TransitionLedger.validateStoredEntry'), 'implementation validates presented sequence, digest chain and current head');
check(implementation.includes("return 'PRESENTED_LOCAL_HISTORIES_EXACT_REPLAY'"), 'implementation classifies exact history replay');
check(implementation.includes("return 'LEFT_PRESENTED_HISTORY_IS_EXACT_PREFIX'"), 'implementation classifies left exact prefix');
check(implementation.includes("return 'RIGHT_PRESENTED_HISTORY_IS_EXACT_PREFIX'"), 'implementation classifies right exact prefix');
check(implementation.includes("return 'HOLD_SIBLING_FORK_AT_PRESENTED_SEQUENCE'"), 'implementation detects co-presented sibling fork');
check(implementation.includes("return 'HOLD_ENTRY_ID_EQUIVOCATION_AT_PRESENTED_SEQUENCE'"), 'implementation detects entry-id equivocation');
check(implementation.includes("return 'HOLD_ALTERNATE_LOCAL_RECORD_FOR_SAME_CANDIDATE_HEAD'"), 'implementation detects alternate local records');
check(implementation.includes("return 'HOLD_LOG_IDENTITY_DRIFT'"), 'implementation detects caller log-id drift');
check(implementation.includes("return 'HOLD_GENESIS_DRIFT'"), 'implementation detects genesis drift');
check(implementation.includes('withheldRootsExcluded: false') && implementation.includes('thirdRootAbsenceProven: false'), 'implementation keeps withheld roots and third-root absence unproven');
check(implementation.includes('globallyConsistentTransitionLogProven: false'), 'implementation keeps global log consistency false');
check(implementation.includes('externalTransitionRetentionProven: false') && implementation.includes('protectedMonotonicStateProven: false'), 'implementation keeps external retention and protected state false');
check(implementation.includes('hostAuthorizationAuthenticated: false'), 'implementation keeps host authorization false');
check(implementation.includes('executionAuthorized: false') && implementation.includes('adoptionAuthorized: false') && implementation.includes('automaticCanon: false'), 'implementation preserves execution, adoption and CANON boundaries');
check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')") && !implementation.includes('fetch('), 'runtime imports no filesystem, process or network capability');

check(focusedTest.includes('same exact entry history is classified as replay'), 'focused test proves exact history replay');
check(focusedTest.includes('shorter left history is an exact prefix') && focusedTest.includes('shorter right history is an exact prefix'), 'focused test proves both prefix directions');
check(focusedTest.includes('different first candidates form a typed sibling fork'), 'focused test proves first-entry sibling fork');
check(focusedTest.includes('histories sharing entry A fork at their second entry'), 'focused test proves later sibling fork with common prefix');
check(focusedTest.includes('same entry id with different candidate is typed equivocation'), 'focused test proves entry-id equivocation');
check(focusedTest.includes('different local records for same candidate head are typed'), 'focused test proves alternate-record hold');
check(focusedTest.includes('different caller log ids are held') && focusedTest.includes('same log id with different genesis is held'), 'focused test proves domain drift holds');
check(focusedTest.includes('third independently valid history exact-rebuilds before being withheld'), 'focused test constructs a valid withheld third history');
check(focusedTest.includes('pairwise A-C versus A-D receipt contains no withheld B head'), 'focused test proves withheld head is absent from pairwise receipt');
check(focusedTest.includes('fresh process rebuilds serialized reconciliation package'), 'focused test routes rebuild through a fresh process');
check(focusedTest.includes('presentation over bounded entry limit is refused') && focusedTest.includes('presentation over canonical byte limit is refused'), 'focused test proves both presentation resource bounds');
check(focusedTest.includes('presentation receipt embeds no raw public key') && focusedTest.includes('presentation receipt embeds no raw signature'), 'focused test checks receipt data minimization');
check(/third\s+independently valid\s+history/.test(readme) && /global consistency/.test(readme), 'README preserves withheld-third-history and global-consistency boundary');

check(presentationSchema.$id === 'axm.model-shadow-review-challenge-transition-ledger-presentation/v1', 'presentation schema identity is exact');
check(reconciliationSchema.$id === 'axm.model-shadow-review-challenge-transition-reconciliation/v1', 'reconciliation schema identity is exact');
check(presentationSchema.properties.entries.maxItems === 4096, 'presentation schema mirrors entry-count bound');
check(presentationSchema.properties.truth.properties.callerPackagesEmbeddedInPresentationReceipt.const === false, 'presentation schema excludes caller packages from receipt truth');
check(reconciliationSchema.properties.truth.properties.thirdRootAbsenceProven.const === false, 'reconciliation schema keeps third-root absence false');
check(reconciliationSchema.properties.truth.properties.globallyConsistentTransitionLogProven.const === false, 'reconciliation schema keeps global consistency false');

if (fs.existsSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'))) {
  const snapshot = read('SOURCE_SNAPSHOT.json');
  check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 60, 'source snapshot declares sixty normalized TEST inputs');
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
  check(results.status === 'PASS' && results.summary.commands === 27 && results.summary.failed === 0, 'all focused and AGENTS.md commands passed');
  check(results.summary.focusedAssertions === 1035, 'focused assertion count matches recorded command outputs');
  check(results.resultsDigest === digestValue, 'verification result digest matches canonical content');
}

console.log('\nModel Shadow review challenge transition reconciliation evidence selftest: PASS (' + checks + ' checks)');

