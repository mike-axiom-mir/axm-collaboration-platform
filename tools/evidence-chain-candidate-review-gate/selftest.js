#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Retention = require('../../shared/evidence-retention/evidence-retention-service');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');
const Foundry = require('../evidence-chain-recovery-foundry/evidence-chain-recovery-core');
const Gate = require('./evidence-chain-review-core');

async function validRechain(source, mutate) {
  const rows = source.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
  mutate(rows);
  let previous = null;
  for (const row of rows) {
    row.previousHash = previous;
    delete row.eventHash;
    row.eventHash = await Inspector.sha256(Inspector.canonical(row));
    previous = row.eventHash;
  }
  return rows.map(row => JSON.stringify(row)).join('\n') + '\n';
}

async function main() {
  const root = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

  assert.equal(manifest.id, 'evidence-chain-candidate-review-gate');
  assert.equal(manifest.kind, 'product');
  assert.equal(manifest.status, 'TEST');
  assert.equal(manifest.risk, 'HIGH');
  assert.deepEqual(manifest.permissions, []);
  assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
  assert(contract.provides.includes('capability.review.evidence-chain-recovery-candidate/v1'));
  assert(contract.boundaries.refuses.includes('candidate-application'));
  assert(contract.boundaries.refuses.includes('content-authenticity-claim'));
  assert(contract.boundaries.refuses.includes('automatic-canon'));

  assert(/<html\b[^>]*\blang=/i.test(html));
  assert(/name=["']viewport["']/i.test(html));
  assert(html.includes('role="status"') && html.includes('aria-live="polite"'));
  ['sourceFile', 'inspectionFile', 'candidateFile', 'recoveryFile', 'decisionChoice', 'noAuthorityAck', 'authenticityAck']
    .forEach(id => assert(html.includes('for="' + id + '"'), id + ' needs a visible label'));
  const localScripts = Array.from(html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi), match => match[1]);
  assert.deepEqual(localScripts, [
    '../evidence-chain-inspector/evidence-chain-core.js',
    '../evidence-chain-recovery-foundry/evidence-chain-recovery-core.js',
    'evidence-chain-review-core.js',
    'app.js'
  ]);
  localScripts.forEach(source => assert(fs.existsSync(path.resolve(root, source)), source + ' must resolve locally'));
  assert(css.includes(':focus-visible'));
  assert(css.includes('min-height: 44px'));
  assert(!/\sonclick\s*=/i.test(html));
  assert(!/<textarea\b/i.test(html), 'free-form review fields remain absent');

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-evidence-review-gate-'));
  try {
    const workshop = path.join(temporary, 'workshop');
    const stateRoot = path.join(workshop, 'state');
    const logs = path.join(workshop, 'logs');
    fs.mkdirSync(logs, { recursive: true });
    const sourcePath = path.join(logs, 'source.jsonl');
    const manager = Retention.create({ stateRoot, limits: { maxEvents: 20, maxBytes: 1024 * 1024 } });
    const secret = 'PRIVATE-REVIEW-PAYLOAD';
    manager.record(sourcePath, { type: 'work-note', marker: secret, at: '2026-07-28T20:02:00.000Z' });
    manager.record(sourcePath, { type: 'repair-check', marker: secret, at: '2026-07-28T20:02:01.000Z' });
    const sealed = manager.seal('review-gate-test');
    const segmentPath = path.join(workshop, sealed.manifest.sourceSegment);
    const validSource = fs.readFileSync(segmentPath, 'utf8');
    const brokenRows = validSource.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
    brokenRows[0].payload.marker = secret + '-TAMPERED';
    const brokenSource = brokenRows.map(row => JSON.stringify(row)).join('\n') + '\n';
    const inspection = await Inspector.inspect(brokenSource, { label: 'review-test-source' });
    const recovery = await Foundry.build(brokenSource, inspection, {
      acknowledgeAuthenticityUnknown: true,
      generatedAt: '2026-07-28T20:03:00.000Z'
    });
    const sourceSnapshot = brokenSource;
    const candidateSnapshot = recovery.candidateJsonl;

    const assessment = await Gate.assess(brokenSource, inspection, recovery.candidateJsonl, recovery.receipt, {
      generatedAt: '2026-07-28T20:04:00.000Z'
    });
    assert.equal(assessment.schema, 'axm.evidence-chain-recovery-review/v1');
    assert.equal(assessment.capability, 'capability.review.evidence-chain-recovery-candidate/v1');
    assert.equal(assessment.verdict, 'PASS');
    assert.deepEqual(assessment.failedChecks, []);
    assert(assessment.checks.every(check => check.verdict === 'PASS'));
    assert.equal(brokenSource, sourceSnapshot);
    assert.equal(recovery.candidateJsonl, candidateSnapshot);
    assert.equal(assessment.truth.fourArtifactsDigestBound, true);
    assert.equal(assessment.truth.candidateChainValid, true);
    assert.equal(assessment.truth.nonHashFieldsPreserved, true);
    ['payloadsEmitted', 'sourcesEmitted', 'rawLinesEmitted', 'filesWritten', 'originalModified', 'candidateModified', 'candidateApplied', 'liveStateWritten', 'contentAuthenticityProven', 'sourceHistoryRestored', 'sessionRecovered', 'serverStarted', 'authorityGranted', 'promoted', 'canon']
      .forEach(field => assert.equal(assessment.truth[field], false, field + ' must remain false'));
    assert(!JSON.stringify(assessment).includes(secret));
    assert(!JSON.stringify(assessment).includes(sourcePath));
    assert(!JSON.stringify(assessment).includes(path.basename(segmentPath)));

    const repeatedAssessment = await Gate.assess(brokenSource, inspection, recovery.candidateJsonl, recovery.receipt, {
      generatedAt: '2026-07-28T20:04:00.000Z'
    });
    assert.deepEqual(repeatedAssessment, assessment, 'assessment is deterministic for exact inputs and time');

    await assert.rejects(() => Gate.decide(assessment, 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW', {}), /no application authority/);
    await assert.rejects(() => Gate.decide(assessment, 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW', { acknowledgeNoAuthority: true }), /authenticity remains unknown/);
    const accepted = await Gate.decide(assessment, 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW', {
      acknowledgeNoAuthority: true,
      acknowledgeAuthenticityUnknown: true,
      generatedAt: '2026-07-28T20:05:00.000Z'
    });
    assert.equal(accepted.schema, 'axm.evidence-chain-recovery-review-decision/v1');
    assert.equal(accepted.decision, 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW');
    assert.equal(accepted.reasonCode, 'STRUCTURE_VERIFIED_AUTHENTICITY_UNKNOWN');
    assert.equal(accepted.truth.structuralAcceptanceOnly, true);
    ['approvedForApplication', 'applicationAuthorityGranted', 'contentAuthenticityProven', 'sourceHistoryRestored', 'originalModified', 'candidateModified', 'candidateApplied', 'liveStateWritten', 'sessionRecovered', 'serverStarted', 'authorityGranted', 'promoted', 'canon']
      .forEach(field => assert.equal(accepted.truth[field], false, field + ' must remain false'));
    assert.equal(accepted.truth.humanIdentityVerified, false);
    assert(!JSON.stringify(accepted).includes(secret));
    const repeatedDecision = await Gate.decide(assessment, 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW', {
      acknowledgeNoAuthority: true,
      acknowledgeAuthenticityUnknown: true,
      generatedAt: '2026-07-28T20:05:00.000Z'
    });
    assert.deepEqual(repeatedDecision, accepted, 'decision is deterministic for exact inputs and time');
    assert.equal((await Gate.decide(assessment, 'REJECT_CANDIDATE', { generatedAt: '2026-07-28T20:05:01.000Z' })).reasonCode, 'CANDIDATE_REJECTED');
    assert.equal((await Gate.decide(assessment, 'HOLD_FOR_MORE_EVIDENCE', { generatedAt: '2026-07-28T20:05:02.000Z' })).reasonCode, 'MORE_EVIDENCE_REQUIRED');
    await assert.rejects(() => Gate.decide(assessment, 'APPROVE_AND_APPLY', {}), /fixed review choices/);

    const alteredCandidate = await validRechain(recovery.candidateJsonl, rows => { rows[0].payload.marker = secret + '-SECOND-CHANGE'; });
    assert.equal((await Inspector.inspect(alteredCandidate)).verdict, 'PASS', 'semantic tamper is structurally valid after rehash');
    const alteredAssessment = await Gate.assess(brokenSource, inspection, alteredCandidate, recovery.receipt, {
      generatedAt: '2026-07-28T20:06:00.000Z'
    });
    assert.equal(alteredAssessment.verdict, 'FAIL');
    assert.equal(alteredAssessment.checks.find(check => check.code === 'CANDIDATE_CHAIN_VALID').verdict, 'PASS');
    assert(alteredAssessment.failedChecks.includes('NON_HASH_FIELDS_PRESERVED'));
    await assert.rejects(() => Gate.decide(alteredAssessment, 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW', {
      acknowledgeNoAuthority: true,
      acknowledgeAuthenticityUnknown: true
    }), /failing assessment/);

    const badRecovery = JSON.parse(JSON.stringify(recovery.receipt));
    badRecovery.candidate.sha256 = '0'.repeat(64);
    const badBindingAssessment = await Gate.assess(brokenSource, inspection, recovery.candidateJsonl, badRecovery, {
      generatedAt: '2026-07-28T20:07:00.000Z'
    });
    assert.equal(badBindingAssessment.verdict, 'FAIL');
    assert(badBindingAssessment.failedChecks.includes('RECOVERY_CANDIDATE_BINDINGS_MATCH'));

    const otherSource = await Inspector.example();
    const otherInspection = await Inspector.inspect(otherSource, { label: 'unrelated-inspection' });
    const unboundAssessment = await Gate.assess(brokenSource, otherInspection, recovery.candidateJsonl, recovery.receipt, {
      generatedAt: '2026-07-28T20:08:00.000Z'
    });
    assert.equal(unboundAssessment.verdict, 'FAIL');
    assert(unboundAssessment.failedChecks.includes('SOURCE_INSPECTION_BOUND'));
    assert(unboundAssessment.failedChecks.includes('RECOVERY_SOURCE_BINDINGS_MATCH'));

    const invalidCandidate = recovery.candidateJsonl.replace(/"eventHash":"[a-f0-9]{64}"/, '"eventHash":"invalid"');
    const invalidAssessment = await Gate.assess(brokenSource, inspection, invalidCandidate, recovery.receipt, {
      generatedAt: '2026-07-28T20:09:00.000Z'
    });
    assert.equal(invalidAssessment.verdict, 'FAIL');
    assert(invalidAssessment.failedChecks.includes('CANDIDATE_CHAIN_VALID'));

    const lyingRecovery = JSON.parse(JSON.stringify(recovery.receipt));
    lyingRecovery.truth.contentAuthenticityProven = true;
    await assert.rejects(() => Gate.assess(brokenSource, inspection, recovery.candidateJsonl, lyingRecovery, {}), /contentAuthenticityProven must be false/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }

  const sample = await Gate.example({ recoveryGeneratedAt: '2026-07-28T20:10:00.000Z' });
  const sampleAssessment = await Gate.assess(sample.source, sample.inspection, sample.candidate, sample.recovery, {
    generatedAt: '2026-07-28T20:11:00.000Z'
  });
  assert.equal(sampleAssessment.verdict, 'PASS');
  assert(app.includes('.text()'));
  assert(app.includes('Blob') && app.includes('URL.createObjectURL'));
  assert(!app.includes('localStorage'));
  assert(!app.includes('sessionStorage'));
  assert(!app.includes('fetch('));

  console.log('Evidence Chain Candidate Review Gate selftest: PASS');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
