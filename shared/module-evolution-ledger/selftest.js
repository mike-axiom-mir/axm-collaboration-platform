#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const {
  createLedger,
  preparePatch,
  evaluatePatch,
  digestDocument
} = require('./module-evolution-ledger');
const InstallerHandoff = require('./module-installer-handoff');

const dir = __dirname;
const tempRoots = [];

function tempWorkshop(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `axm-ledger-${label}-`));
  tempRoots.push(root);
  return root;
}

function clock(start = '2026-07-24T12:00:00.000Z') {
  let tick = 0;
  return () => new Date(Date.parse(start) + tick++ * 1000).toISOString();
}

function ids() {
  let sequence = 0;
  return kind => `${kind}-selftest-${++sequence}`;
}

function expectCode(fn, code) {
  assert.throws(fn, error => error && error.code === code, `expected ${code}`);
}

function worker(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(dir, 'selftest-worker.js'), ...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`worker exited ${code}: ${stderr}`));
      try { resolve(JSON.parse(stdout)); } catch (error) { reject(new Error(`invalid worker output: ${stdout} ${stderr}`)); }
    });
  });
}

function revision(ledger) {
  return ledger.readSnapshot().revision;
}

async function main() {
  const root = tempWorkshop('main');
  const ledger = createLedger({ workshopRoot: root, clock: clock(), idFactory: ids(), lockTimeoutMs: 2000 });
  const baseline = { title: 'Ledger test module', settings: { limit: 1 }, tags: ['base'] };
  const candidate = { title: 'Ledger test module', settings: { limit: 2 }, tags: ['base'] };

  const first = ledger.recordVersion({
    expectedRevision: 0,
    recordId: 'version-1',
    moduleId: 'ledger-test-module',
    semanticVersion: '1.0.0',
    contentDigest: digestDocument(baseline),
    parentRecordId: null,
    recordKind: 'baseline',
    createdBy: 'selftest'
  });
  const second = ledger.recordVersion({
    expectedRevision: 1,
    recordId: 'version-2',
    moduleId: 'ledger-test-module',
    semanticVersion: '1.0.1',
    contentDigest: digestDocument(candidate),
    parentRecordId: first.record.recordId,
    recordKind: 'candidate',
    createdBy: 'selftest'
  });
  assert.deepEqual(second.record.ancestry, ['version-1']);
  assert.equal(second.record.parentRecordId, 'version-1');
  second.record.semanticVersion = '99.0.0';
  assert.equal(ledger.readSnapshot().versions['version-2'].semanticVersion, '1.0.1', 'returned records cannot mutate immutable storage');
  expectCode(() => ledger.recordVersion({ expectedRevision: 2, recordId: 'bad-branch', moduleId: 'ledger-test-module', semanticVersion: '1.0.2', contentDigest: digestDocument({ bad: true }), parentRecordId: 'version-1', createdBy: 'selftest' }), 'STALE_BASE');

  ledger.selectKnownGood({ expectedRevision: 2, moduleId: 'ledger-test-module', recordId: 'version-1', confirmation: 'MIKE SELECTS KNOWN GOOD', approvalRef: 'review:mike:known-good-baseline', evidenceRefs: ['verify:baseline-pass'] });
  let snapshot = ledger.readSnapshot();
  assert.equal(snapshot.modules['ledger-test-module'].knownGoodRecordId, 'version-1');
  assert.equal(snapshot.modules['ledger-test-module'].knownGoodSelections.length, 1);
  console.log('PASS immutable parent ancestry and explicit known-good pointer');

  const plan = preparePatch(candidate, [
    { op: 'replace', path: '/settings/limit', value: 3 },
    { op: 'set_if_missing', path: '/summary', value: 'bounded change' },
    { op: 'add_unique_values', path: '/tags', values: ['patch'] }
  ]);
  const newer = { title: candidate.title, settings: { limit: 2, newerField: 'preserve-me' }, tags: ['base', 'newer'], unrelated: { keep: true } };
  const rebased = evaluatePatch(candidate, newer, plan);
  assert.equal(rebased.state, 'REBASE_SAFE');
  assert.equal(rebased.document.settings.limit, 3);
  assert.equal(rebased.document.settings.newerField, 'preserve-me');
  assert.equal(rebased.document.unrelated.keep, true);
  assert.deepEqual(rebased.document.tags, ['base', 'newer', 'patch']);
  const conflict = evaluatePatch(candidate, { ...newer, settings: { limit: 9, newerField: 'preserve-me' } }, plan);
  assert.equal(conflict.state, 'REBASE_HOLD');
  assert.equal(conflict.document, null);
  assert(conflict.conflicts.some(item => item.path === '/settings/limit'));
  expectCode(() => preparePatch(candidate, Array.from({ length: 33 }, () => ({ op: 'set_if_missing', path: '/x', value: 1 }))), 'INVALID_PATCH');
  expectCode(() => preparePatch(candidate, [{ op: 'replace', path: '/settings', value: {} }, { op: 'replace', path: '/settings/limit', value: 2 }]), 'OVERLAPPING_PATCH_PATHS');
  expectCode(() => preparePatch({ items: [] }, [{ op: 'append_unique', path: '/items', key: 'id', value: { title: 'missing id' } }]), 'INVALID_PATCH');
  console.log('PASS bounded patch operations preserve unrelated newer fields or return REBASE_HOLD');

  ledger.configurePacingPolicy({
    expectedRevision: revision(ledger),
    confirmation: 'MIKE CONFIGURES UPGRADE PACING',
    approvalRef: 'review:mike:pacing-1',
    policy: { autonomousEnabled: true, minHoursBetweenProposals: 168, maxOpenProposalsPerModule: 1, allowedAutonomousBumps: ['patch'] }
  });
  const autonomous = ledger.stagePatchProposal({
    expectedRevision: revision(ledger),
    proposalId: 'proposal-auto-1',
    moduleId: 'ledger-test-module',
    baseRecordId: 'version-2',
    baseDocument: candidate,
    targetSemanticVersion: '1.0.2',
    operations: [{ op: 'set_if_missing', path: '/autoNote', value: 'first' }],
    actorMode: 'autonomous',
    createdBy: 'bounded-autonomy'
  });
  assert.equal(autonomous.writePerformed, true);
  const heldRevision = revision(ledger);
  const held = ledger.stagePatchProposal({
    expectedRevision: heldRevision,
    proposalId: 'proposal-auto-2',
    moduleId: 'ledger-test-module',
    baseRecordId: 'version-2',
    baseDocument: candidate,
    targetSemanticVersion: '1.0.3',
    operations: [{ op: 'set_if_missing', path: '/autoNoteTwo', value: 'second' }],
    actorMode: 'autonomous',
    createdBy: 'bounded-autonomy'
  });
  assert.equal(held.writePerformed, false);
  assert.equal(held.decision.reason, 'MAX_OPEN_PROPOSALS');
  assert.equal(revision(ledger), heldRevision, 'a pacing hold must not silently stage a proposal');
  const hotfix = ledger.stagePatchProposal({
    expectedRevision: heldRevision,
    proposalId: 'proposal-mike-hotfix',
    moduleId: 'ledger-test-module',
    baseRecordId: 'version-2',
    baseDocument: candidate,
    targetSemanticVersion: '1.0.4',
    operations: [{ op: 'set_if_missing', path: '/emergencyNote', value: 'Mike-approved hotfix' }],
    actorMode: 'mike-approved-hotfix',
    createdBy: 'Mike',
    confirmation: 'MIKE APPROVES HOTFIX PROPOSAL',
    approvalRef: 'review:mike:hotfix-1'
  });
  assert.equal(hotfix.writePerformed, true);
  assert.equal(hotfix.proposal.pacingDecision.reason, 'MIKE_APPROVED_HOTFIX_BYPASS');
  console.log('PASS autonomous pacing holds cannot block an explicitly Mike-approved hotfix proposal');

  const prepared = ledger.prepareActivation({
    expectedRevision: revision(ledger),
    attemptId: 'activation-1',
    moduleId: 'ledger-test-module',
    fromRecordId: 'version-1',
    toRecordId: 'version-2',
    installerCandidateId: 'candidate:installer-1',
    installerReviewRef: 'review:approved:installer-1',
    recoverySnapshotRef: 'recovery-center:snapshot-before-installer-1',
    mikeApprovalRef: 'review:mike:activation-1',
    confirmation: 'MIKE APPROVES ACTIVATION RECORD'
  });
  ledger.markActivationStarted({ expectedRevision: prepared.revision, attemptId: 'activation-1', installerAttemptRef: 'installer-attempt:1', actorId: 'module-installer', confirmation: 'RECORD MODULE INSTALLER ATTEMPT' });
  const beforeRestartRevision = revision(ledger);
  const restarted = await worker(['inspect-interrupted', root]);
  assert.equal(restarted.ok, true);
  assert.equal(restarted.inspection.revision, beforeRestartRevision);
  assert.equal(restarted.inspection.activations[0].effectiveState, 'INTERRUPTED_HOLD');
  assert.equal(restarted.inspection.activations[0].automaticInstallPerformed, false);
  assert.equal(restarted.inspection.activations[0].automaticRollbackPerformed, false);
  assert.equal(revision(ledger), beforeRestartRevision, 'restart inspection is read-only');

  const observed = ledger.recordActivationObservation({ expectedRevision: beforeRestartRevision, attemptId: 'activation-1', observedDigest: digestDocument(candidate), observationRef: 'installer-receipt:1', actorId: 'module-installer-receipt', confirmation: 'RECORD ACTIVATION OBSERVATION' });
  assert.equal(observed.activation.state, 'AWAITING_VERIFICATION');
  const verified = ledger.recordActivationVerification({ expectedRevision: observed.revision, attemptId: 'activation-1', verdict: 'PASS', verificationReceiptRef: 'verification-spine:receipt-1', actorId: 'verification-spine', confirmation: 'RECORD VERIFICATION EVIDENCE' });
  assert.equal(verified.activation.state, 'AWAITING_MIKE_ACCEPTANCE');
  assert.equal(verified.activation.verification.permissionGranted, false);
  assert.equal(ledger.readSnapshot().modules['ledger-test-module'].knownGoodRecordId, 'version-1', 'verification evidence must not move known-good authority');
  const accepted = ledger.acceptActivationRecord({ expectedRevision: verified.revision, attemptId: 'activation-1', confirmation: 'MIKE ACCEPTS ACTIVATION RECORD', approvalRef: 'review:mike:accept-activation-1' });
  assert.equal(accepted.activation.state, 'ACCEPTED_AS_OBSERVED');
  ledger.selectKnownGood({ expectedRevision: accepted.revision, moduleId: 'ledger-test-module', recordId: 'version-2', confirmation: 'MIKE SELECTS KNOWN GOOD', approvalRef: 'review:mike:known-good-candidate', evidenceRefs: ['verification-spine:receipt-1'] });
  snapshot = ledger.readSnapshot();
  assert.equal(snapshot.modules['ledger-test-module'].knownGoodRecordId, 'version-2');
  assert.equal(snapshot.modules['ledger-test-module'].knownGoodSelections.length, 2, 'known-good history remains append-only');

  const thirdDocument = { title: candidate.title, settings: { limit: 4 }, tags: ['base'] };
  const third = ledger.recordVersion({ expectedRevision: revision(ledger), recordId: 'version-3', moduleId: 'ledger-test-module', semanticVersion: '1.1.0', contentDigest: digestDocument(thirdDocument), parentRecordId: 'version-2', recordKind: 'candidate', createdBy: 'selftest' });
  const preparedRecovery = ledger.prepareActivation({ expectedRevision: third.revision, attemptId: 'activation-2', moduleId: 'ledger-test-module', fromRecordId: 'version-2', toRecordId: 'version-3', installerCandidateId: 'candidate:installer-2', installerReviewRef: 'review:approved:installer-2', recoverySnapshotRef: 'recovery-center:snapshot-before-installer-2', mikeApprovalRef: 'review:mike:activation-2', confirmation: 'MIKE APPROVES ACTIVATION RECORD' });
  ledger.markActivationStarted({ expectedRevision: preparedRecovery.revision, attemptId: 'activation-2', installerAttemptRef: 'installer-attempt:2', confirmation: 'RECORD MODULE INSTALLER ATTEMPT' });
  const unknownObservation = ledger.recordActivationObservation({ expectedRevision: revision(ledger), attemptId: 'activation-2', observedDigest: digestDocument({ unexpected: true }), observationRef: 'independent-digest:unexpected', confirmation: 'RECORD ACTIVATION OBSERVATION' });
  assert.equal(unknownObservation.activation.state, 'RECOVERY_HOLD');
  const handoff = ledger.recordRecoveryCenterHandoff({ expectedRevision: unknownObservation.revision, attemptId: 'activation-2', confirmation: 'MIKE REQUESTS RECOVERY REVIEW', approvalRef: 'review:mike:recovery-2' });
  assert.equal(handoff.handoff.authority, 'recovery-center');
  assert.equal(handoff.handoff.actionPerformed, false);
  console.log('PASS interrupted activation survives a fresh process and resolves only through observations, evidence, Mike, or Recovery Center handoff');

  const concurrencyRoot = tempWorkshop('concurrency');
  const raceDigest = digestDocument({ race: true });
  const results = await Promise.all([
    worker(['record-race', concurrencyRoot, 'a', raceDigest]),
    worker(['record-race', concurrencyRoot, 'b', raceDigest])
  ]);
  assert.equal(results.filter(item => item.ok).length, 1, JSON.stringify(results));
  assert.deepEqual(results.filter(item => !item.ok).map(item => item.code), ['STALE_REVISION']);
  const concurrencyLedger = createLedger({ workshopRoot: concurrencyRoot });
  assert.equal(concurrencyLedger.readSnapshot().revision, 1);
  assert.equal(Object.keys(concurrencyLedger.readSnapshot().versions).length, 1);
  console.log('PASS concurrent stale writers serialize and exactly one fails STALE_REVISION');

  const integrityRoot = tempWorkshop('integrity');
  const integrityLedger = createLedger({ workshopRoot: integrityRoot, clock: clock(), idFactory: ids() });
  integrityLedger.recordVersion({ expectedRevision: 0, recordId: 'integrity-v1', moduleId: 'integrity-module', semanticVersion: '1.0.0', contentDigest: digestDocument({ integrity: true }), parentRecordId: null, recordKind: 'baseline', createdBy: 'selftest' });
  const eventsDir = path.join(integrityRoot, 'state', 'module-evolution-ledger', 'events');
  const eventFile = path.join(eventsDir, fs.readdirSync(eventsDir)[0]);
  const changed = JSON.parse(fs.readFileSync(eventFile, 'utf8'));
  changed.payload.record.semanticVersion = '9.0.0';
  fs.writeFileSync(eventFile, JSON.stringify(changed), 'utf8');
  expectCode(() => integrityLedger.readSnapshot(), 'CHAIN_INTEGRITY');
  console.log('PASS immutable event tampering is detected by the SHA-256 chain');

  const normalized = InstallerHandoff.createVersionRecordInput({ expectedRevision: 0, recordId: 'adapter-v1', moduleId: 'module-installer', manifestVersion: 'v0.3', candidateDigest: raceDigest, parentRecordId: null, installerCandidateId: 'candidate-1', installerReviewRef: 'review-1' });
  assert.equal(normalized.semanticVersion, '0.3.0');
  assert.equal(normalized.metadata.installerInvoked, false);
  const contract = JSON.parse(fs.readFileSync(path.join(dir, 'module.contract.json'), 'utf8'));
  assert.deepEqual(contract.permissions, []);
  for (const refusal of ['automatic-install', 'automatic-promotion', 'automatic-rollback', 'network-research', 'provider-execution', 'canon-mutation', 'verification-as-permission']) assert(contract.refuses.includes(refusal));
  const authority = ledger.authorityStatement();
  for (const refusal of ['install', 'promotion', 'rollback', 'network-research', 'provider-execution', 'canon-mutation']) assert(authority.refuses.includes(refusal));
  const productionFiles = ['util.js', 'local-append-adapter.js', 'patch-operations.js', 'module-evolution-ledger.js', 'module-installer-handoff.js'];
  const productionSource = productionFiles.map(file => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n');
  assert(!/require\(['"](?:node:)?(?:child_process|http|https|net|tls|dns)/.test(productionSource), 'production ledger must not import execution or network modules');
  assert(!/\bfetch\s*\(/.test(productionSource), 'production ledger must not call fetch');
  const publicMethods = Object.keys(ledger);
  for (const forbiddenMethod of ['install', 'promote', 'rollback', 'restore', 'research', 'executeProvider']) assert(!publicMethods.includes(forbiddenMethod));
  assert.deepEqual(fs.readdirSync(root).sort(), ['state'], 'ledger writes are isolated beneath Workshop state');
  for (const schema of fs.readdirSync(path.join(dir, 'schemas'))) JSON.parse(fs.readFileSync(path.join(dir, 'schemas', schema), 'utf8'));
  console.log('PASS zero install, promote, rollback, restore, network, provider, permission, or CANON authority');

  console.log('PASS Module Evolution Ledger focused selftest');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  for (const root of tempRoots) {
    const resolved = path.resolve(root);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('axm-ledger-')) {
      try { fs.rmSync(resolved, { recursive: true, force: true }); } catch (_) {}
    }
  }
});
