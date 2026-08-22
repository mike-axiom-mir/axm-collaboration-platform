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
const ReviewGate = require('../evidence-chain-candidate-review-gate/evidence-chain-review-core');
const Plan = require('./evidence-chain-application-plan-core');

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

function planningOptions(overrides) {
  return Object.assign({
    posture: 'TRUSTED_RECOVERY_SERVICE_STAGING',
    acknowledgeCurrentDigestRecheck: true,
    acknowledgeSafetyCopyRequired: true,
    acknowledgeFreshPermissionRequired: true,
    acknowledgeNoAuthority: true,
    generatedAt: '2026-07-28T20:20:00.000Z'
  }, overrides || {});
}

async function main() {
  const root = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const coreSource = fs.readFileSync(path.join(root, 'evidence-chain-application-plan-core.js'), 'utf8');

  assert.equal(manifest.id, 'evidence-chain-application-plan-foundry');
  assert.equal(manifest.kind, 'product');
  assert.equal(manifest.status, 'TEST');
  assert.equal(manifest.risk, 'HIGH');
  assert.deepEqual(manifest.permissions, []);
  assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
  assert(contract.provides.includes('capability.plan.evidence-chain-recovery-application/v1'));
  assert(contract.boundaries.refuses.includes('candidate-staging-or-application'));
  assert(contract.boundaries.refuses.includes('permission-check-or-grant'));
  assert(contract.boundaries.refuses.includes('automatic-canon'));

  assert(/<html\b[^>]*\blang=/i.test(html));
  assert(/name=["']viewport["']/i.test(html));
  assert(html.includes('role="status"') && html.includes('aria-live="polite"'));
  ['sourceFile', 'candidateFile', 'assessmentFile', 'decisionFile', 'posture', 'digestAck', 'backupAck', 'permissionAck', 'authorityAck']
    .forEach(id => assert(html.includes('for="' + id + '"'), id + ' needs a visible label'));
  const localScripts = Array.from(html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi), match => match[1]);
  assert.deepEqual(localScripts, [
    '../evidence-chain-inspector/evidence-chain-core.js',
    '../evidence-chain-recovery-foundry/evidence-chain-recovery-core.js',
    '../evidence-chain-candidate-review-gate/evidence-chain-review-core.js',
    'evidence-chain-application-plan-core.js',
    'app.js'
  ]);
  localScripts.forEach(source => assert(fs.existsSync(path.resolve(root, source)), source + ' must resolve locally'));
  assert(css.includes(':focus-visible'));
  assert(css.includes('min-height: 44px'));
  assert(!/\sonclick\s*=/i.test(html));
  assert(!/<textarea\b/i.test(html));

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-evidence-application-plan-'));
  try {
    const workshop = path.join(temporary, 'workshop');
    const stateRoot = path.join(workshop, 'state');
    const logs = path.join(workshop, 'logs');
    fs.mkdirSync(logs, { recursive: true });
    const sourcePath = path.join(logs, 'source.jsonl');
    const manager = Retention.create({ stateRoot, limits: { maxEvents: 20, maxBytes: 1024 * 1024 } });
    const secret = 'PRIVATE-APPLICATION-PLAN-PAYLOAD';
    manager.record(sourcePath, { type: 'work-note', marker: secret, at: '2026-07-28T20:15:00.000Z' });
    manager.record(sourcePath, { type: 'repair-check', marker: secret, at: '2026-07-28T20:15:01.000Z' });
    const sealed = manager.seal('application-plan-test');
    const segmentPath = path.join(workshop, sealed.manifest.sourceSegment);
    const validSource = fs.readFileSync(segmentPath, 'utf8');
    const rows = validSource.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
    rows[0].payload.marker = secret + '-TAMPERED';
    const brokenSource = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
    const inspection = await Inspector.inspect(brokenSource, { label: 'application-plan-test-source' });
    const recovery = await Foundry.build(brokenSource, inspection, {
      acknowledgeAuthenticityUnknown: true,
      generatedAt: '2026-07-28T20:16:00.000Z'
    });
    const assessment = await ReviewGate.assess(brokenSource, inspection, recovery.candidateJsonl, recovery.receipt, {
      generatedAt: '2026-07-28T20:17:00.000Z'
    });
    const decision = await ReviewGate.decide(assessment, 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW', {
      acknowledgeNoAuthority: true,
      acknowledgeAuthenticityUnknown: true,
      generatedAt: '2026-07-28T20:18:00.000Z'
    });
    const sourceSnapshot = brokenSource;
    const candidateSnapshot = recovery.candidateJsonl;
    const plan = await Plan.build(brokenSource, recovery.candidateJsonl, assessment, decision, planningOptions());

    assert.equal(plan.schema, 'axm.evidence-chain-recovery-application-plan/v1');
    assert.equal(plan.capability, 'capability.plan.evidence-chain-recovery-application/v1');
    assert.equal(plan.status, 'READY_FOR_TRUSTED_OPERATOR_PLANNING_REVIEW');
    assert.equal(plan.validForSeconds, 900);
    assert.equal(plan.generatedAt, '2026-07-28T20:20:00.000Z');
    assert.equal(plan.expiresAt, '2026-07-28T20:35:00.000Z');
    assert(/^[a-f0-9]{64}$/.test(plan.planId));
    assert.equal(plan.target.posture, 'TRUSTED_RECOVERY_SERVICE_STAGING');
    assert.equal(plan.target.pathIncluded, false);
    assert.equal(plan.target.liveTargetObserved, false);
    assert.equal(plan.candidate.chainVerdict, 'PASS');
    assert.equal(plan.preconditions.length, 7);
    assert(plan.preconditions.every(check => check.verdict === 'PASS'));
    assert.deepEqual(plan.phases.map(phase => phase.order), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(plan.phases[0].code, 'REVERIFY_CURRENT_TARGET_DIGEST');
    assert.equal(plan.phases[7].code, 'RETAIN_ROLLBACK_LINEAGE');
    assert(plan.phases.every(phase => Object.keys(phase).sort().join(',') === 'code,evidenceRequired,order,stopIf'));
    assert.equal(plan.rollback.required, true);
    assert.equal(plan.rollback.restoreDigest, assessment.source.sha256);
    assert.equal(plan.handoff.intendedService, 'recovery-center');
    assert.equal(plan.handoff.targetServiceCompatibility, 'ADAPTER_REQUIRED');
    assert.equal(plan.handoff.missingCapability, 'capability.apply.evidence-chain-reviewed-recovery/v1');
    assert.equal(plan.handoff.directExecutionAvailable, false);
    assert.equal(brokenSource, sourceSnapshot);
    assert.equal(recovery.candidateJsonl, candidateSnapshot);
    assert.equal(plan.truth.planOnly, true);
    assert.equal(plan.truth.nonExecutable, true);
    assert.equal(plan.truth.reviewBundleDigestBound, true);
    ['liveTargetRead', 'targetPathEmitted', 'commandsEmitted', 'filesWritten', 'backupCreated', 'candidateStaged', 'previewCreated', 'permissionChecked', 'permissionGranted', 'readyToApply', 'applicationAuthorized', 'candidateApplied', 'rollbackPerformed', 'humanIdentityVerified', 'reviewDecisionAuthenticityProven', 'contentAuthenticityProven', 'sourceHistoryRestored', 'sessionRecovered', 'serverStarted', 'authorityGranted', 'promoted', 'canon']
      .forEach(field => assert.equal(plan.truth[field], false, field + ' must remain false'));
    assert(!JSON.stringify(plan).includes(secret));
    assert(!JSON.stringify(plan).includes(sourcePath));
    assert(!JSON.stringify(plan).includes(path.basename(segmentPath)));
    assert(!plan.phases.some(phase => Object.prototype.hasOwnProperty.call(phase, 'command') || Object.prototype.hasOwnProperty.call(phase, 'script') || Object.prototype.hasOwnProperty.call(phase, 'path')));

    const repeated = await Plan.build(brokenSource, recovery.candidateJsonl, assessment, decision, planningOptions());
    assert.deepEqual(repeated, plan, 'exact inputs and time produce a deterministic plan');
    for (const posture of Plan.POSTURES) {
      const variant = await Plan.build(brokenSource, recovery.candidateJsonl, assessment, decision, planningOptions({ posture }));
      assert.equal(variant.target.posture, posture);
    }

    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, assessment, decision, planningOptions({ acknowledgeCurrentDigestRecheck: false })), /digest recheck/);
    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, assessment, decision, planningOptions({ acknowledgeSafetyCopyRequired: false })), /safety copy/);
    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, assessment, decision, planningOptions({ acknowledgeFreshPermissionRequired: false })), /permissioned preview/);
    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, assessment, decision, planningOptions({ acknowledgeNoAuthority: false })), /no application authority/);
    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, assessment, decision, planningOptions({ posture: 'APPLY_NOW' })), /fixed application planning choices/);

    const hold = await ReviewGate.decide(assessment, 'HOLD_FOR_MORE_EVIDENCE', { generatedAt: '2026-07-28T20:21:00.000Z' });
    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, assessment, hold, planningOptions()), /fixed structural acceptance choice/);
    const badDecisionBinding = JSON.parse(JSON.stringify(decision));
    badDecisionBinding.assessmentSha256 = '0'.repeat(64);
    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, assessment, badDecisionBinding, planningOptions()), /DECISION_BINDS_ASSESSMENT/);

    const alteredCandidate = await validRechain(recovery.candidateJsonl, candidateRows => { candidateRows[0].payload.marker = secret + '-SECOND-CHANGE'; });
    assert.equal((await Inspector.inspect(alteredCandidate)).verdict, 'PASS');
    await assert.rejects(() => Plan.build(brokenSource, alteredCandidate, assessment, decision, planningOptions()), /CANDIDATE_DIGEST_MATCHES_REVIEW, NON_HASH_FIELDS_PRESERVED/);
    const invalidCandidate = recovery.candidateJsonl.replace(/"eventHash":"[a-f0-9]{64}"/, '"eventHash":"invalid"');
    await assert.rejects(() => Plan.build(brokenSource, invalidCandidate, assessment, decision, planningOptions()), /CANDIDATE_CHAIN_VALID/);

    const lyingAssessment = JSON.parse(JSON.stringify(assessment));
    lyingAssessment.truth.authorityGranted = true;
    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, lyingAssessment, decision, planningOptions()), /authorityGranted must be false/);
    const lyingDecision = JSON.parse(JSON.stringify(decision));
    lyingDecision.truth.approvedForApplication = true;
    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, assessment, lyingDecision, planningOptions()), /approvedForApplication must be false/);
    await assert.rejects(() => Plan.build(brokenSource, recovery.candidateJsonl, assessment, decision, planningOptions({ generatedAt: 'not-a-date' })), /generatedAt/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }

  const sample = await Plan.example({
    recoveryGeneratedAt: '2026-07-28T20:22:00.000Z',
    assessmentGeneratedAt: '2026-07-28T20:23:00.000Z',
    decisionGeneratedAt: '2026-07-28T20:24:00.000Z'
  });
  const samplePlan = await Plan.build(sample.source, sample.candidate, sample.assessment, sample.decision, planningOptions({ generatedAt: '2026-07-28T20:25:00.000Z' }));
  assert.equal(samplePlan.status, 'READY_FOR_TRUSTED_OPERATOR_PLANNING_REVIEW');
  assert(coreSource.includes("targetServiceCompatibility: 'ADAPTER_REQUIRED'"));
  assert(coreSource.includes("missingCapability: 'capability.apply.evidence-chain-reviewed-recovery/v1'"));
  assert(app.includes('.text()'));
  assert(app.includes('Blob') && app.includes('URL.createObjectURL'));
  assert(!app.includes('localStorage'));
  assert(!app.includes('sessionStorage'));
  assert(!app.includes('fetch('));

  console.log('Evidence Chain Application Plan Foundry selftest: PASS');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
