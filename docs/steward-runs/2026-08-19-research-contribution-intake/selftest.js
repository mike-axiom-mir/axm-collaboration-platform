#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Intake = require('../../../shared/research-contribution-intake/research-contribution-intake');
const Builder = require('./build-current-assessment');
const Verification = require('./build-verification-receipt');

const ROOT = path.resolve(__dirname, '../../..');
const SOURCE = path.join(ROOT, 'docs', 'steward-runs', '2026-08-19-public-baseline-research-run');
const COMPARE = path.join(process.env.USERPROFILE || '', '.codex', 'skills', 'detect-capability-gaps', 'scripts', 'compare_capabilities.py');
let checks = 0;

function check(condition, message) {
  checks += 1;
  assert.ok(condition, message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function comparison(inventoryName) {
  const result = spawnSync('python', [
    COMPARE,
    '--requirements', path.join(__dirname, 'CAPABILITY_REQUIREMENTS.json'),
    '--capabilities', path.join(__dirname, inventoryName)
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const current = Builder.current();
const rebuilt = Builder.build();
const rebuiltSummary = Builder.summary(rebuilt);
const manifest = readJson(path.join(SOURCE, 'RESEARCH_INPUT_MANIFEST.json'));
const provenance = readJson(path.join(SOURCE, 'USER_REPORTED_SEAT_PROVENANCE.json'));
const disposition = readJson(path.join(SOURCE, 'RESEARCH_DISPOSITION.json'));
const contract = readJson(path.join(ROOT, 'shared', 'research-contribution-intake', 'module.contract.json'));
const gap = readJson(path.join(__dirname, 'CAPABILITY_GAP_REPORT.json'));
const verification = readJson(path.join(__dirname, 'VERIFICATION_RECEIPT.json'));

check(Intake.verifyAssessment(current.assessment).pass, 'current assessment exact-rebuild verifies natively');
check(Intake.stableStringify(current.assessment) === Intake.stableStringify(rebuilt), 'current assessment equals a fresh rebuild');
check(Intake.stableStringify(current.summary) === Intake.stableStringify(rebuiltSummary), 'current summary equals a fresh rebuild');
check(current.assessment.state === 'READY_FOR_BASELINE_SIMULATION_PLANNING', 'current feed is ready only for simulation planning');
check(current.assessment.counts.artifacts === 7, 'all seven historical artifacts are retained');
check(current.assessment.counts.modelSeats === 4 && current.assessment.counts.seats === 5, 'four reported model seats and one curator seat are retained');
check(current.assessment.counts.retainedSignals === 6, 'all six retained signals are preserved');
check(current.assessment.counts.proposals === 6, 'all six rejected or deferred proposals are preserved');
check(current.assessment.counts.holds === 0 && current.assessment.counts.warnings === 4, 'current replay has zero holds and four explicit evidence warnings');
check(current.assessment.bundle.artifacts.length === manifest.artifacts.length, 'assessment artifact count matches the inert manifest');
check(current.assessment.bundle.artifacts.every(artifact => manifest.artifacts.some(source => source.id === artifact.id && source.sha256 === artifact.sha256)), 'assessment artifact identities match the source manifest');
check(current.assessment.bundle.seats.filter(seat => seat.kind === 'MODEL').every(seat => provenance.seats.some(source => source.id === seat.id && source.providerFamily === seat.providerFamily)), 'model seats preserve user-reported provenance');
check(current.assessment.bundle.signals.length === disposition.acceptedSignals.length, 'retained signals match the stewarded disposition count');
check(current.assessment.bundle.proposals.length === disposition.rejectedOrDeferred.length, 'proposal dispositions match the stewarded disposition count');
check(current.assessment.bundle.signals.filter(signal => signal.evidenceStage === 'OBSERVED').every(signal => signal.evidenceSourceIds.length > 0), 'every OBSERVED signal has a separate evidence source');
check(current.assessment.projection.signals.every(signal => signal.truthWeight === 'NONE'), 'projected signals carry no truth weight');
check(current.assessment.projection.truth.baselineRunBuilt === false && current.assessment.projection.truth.readyToExecute === false, 'projection is neither a run nor execution authority');
check(current.assessment.attributionAssessment.artifactToSeatMappingEstablished === false, 'artifact-to-model mapping remains unestablished');
check(current.assessment.attributionAssessment.crossModelIndependenceEstablished === false, 'cross-model independence remains unestablished');
check(current.assessment.attributionAssessment.unassignedArtifactIds.length === 7, 'all seven unassigned artifact mappings remain visible');
check(current.assessment.warnings.some(item => item.code === 'MODEL_IDENTITY_DISCLOSURE_GAP'), 'model identity gap remains visible');
check(current.assessment.warnings.some(item => item.code === 'PRIOR_OUTPUT_EXPOSURE_NOT_EXCLUDED'), 'prior-output exposure gap remains visible');
check(current.assessment.truth.sourceExecuted === false && current.assessment.truth.modelInvoked === false, 'assessment executed no source and invoked no model');
check(current.assessment.truth.learningImprovementProven === false && current.assessment.truth.humanBenefitProven === false, 'assessment does not claim learning or human benefit');
check(current.assessment.truth.automaticBuild === false && current.assessment.truth.automaticPromotion === false && current.assessment.truth.automaticCanon === false, 'assessment creates no build promotion or CANON authority');
check(current.summary.truth.historicalResearchValuePreviouslyEstablishedForBoundedAiWorkflow === true, 'summary preserves the prior bounded AI-workflow result');
check(current.summary.truth.newLearningClaim === false && current.summary.truth.humanBenefitClaim === false, 'summary does not broaden the prior result');
check(contract.status === 'TEST' && contract.permissions.length === 0, 'module remains TEST and permissionless');
check(contract.boundaries.writes.length === 0, 'module declares no writes');
check(contract.boundaries.refuses.includes('cross-model-agreement-as-proof'), 'module contract refuses agreement as proof');
check(contract.boundaries.refuses.includes('automatic-canon') && contract.boundaries.refuses.includes('foundation-mutation'), 'module contract refuses automatic CANON and Foundation mutation');
check(Verification.verify(verification).pass, 'verification receipt and every bound source digest are current');
check(verification.assertions.focusedAndAdjacent === 367 && verification.assertions.failed === 0, 'verification receipt records all focused and adjacent assertions');
check(verification.requiredChecks.length === 10 && verification.requiredChecks.every(item => item.verdict === 'PASS'), 'verification receipt records all required Workshop checks as passed');
check(verification.broadVerification.state === 'VERIFIED_WITH_LIMITS' && verification.broadVerification.failedClaims === 0, 'broad verification preserves declared limits without hidden failure');
check(verification.browser.verdict === 'NOT_RUN', 'verification receipt makes no browser claim for a non-UI increment');

const before = comparison('CAPABILITY_INVENTORY_BEFORE.json');
const after = comparison('CAPABILITY_INVENTORY_AFTER.json');
check(before.overall === gap.before.overall && before.missingCapabilities.length === 9, 'before comparator proves nine required exact capabilities missing');
check(before.missingCapabilities.every(id => gap.before.missingCapabilities.includes(id)), 'durable before gap summary matches comparator output');
check(after.overall === gap.after.overall && after.missingCapabilities.length === 0, 'after comparator proves all required exact capabilities available');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all required after requirements are READY');
check(after.requirements.find(item => item.id === 'artifact-model-mapping-evidence').status === 'OPTIONAL_UNKNOWN', 'artifact mapping evidence remains optional unknown');
check(after.requirements.find(item => item.id === 'cross-model-independence-evidence').status === 'OPTIONAL_UNKNOWN', 'independence evidence remains optional unknown');
check(after.requirements.find(item => item.id === 'live-human-value-evidence').status === 'DEGRADED', 'human evidence remains degraded');

const tampered = JSON.parse(JSON.stringify(current.assessment));
tampered.attributionAssessment.crossModelIndependenceEstablished = true;
check(!Intake.verifyAssessment(tampered).pass, 'fabricated independence fails native verification');
const promoted = JSON.parse(JSON.stringify(current.assessment));
promoted.bundle.signals[0].evidenceStage = 'OBSERVED';
check(!Intake.verifyAssessment(promoted).pass, 'silent signal-stage promotion fails native verification');
const authorized = JSON.parse(JSON.stringify(current.assessment));
authorized.bundle.seats[0].proofAuthority = 'TRUTH';
check(!Intake.verifyAssessment(authorized).pass, 'fabricated seat proof authority fails native verification');

[
  'research-contribution-bundle.schema.json',
  'research-contribution-assessment.schema.json',
  'research-contribution-simulation-projection.schema.json',
  'module.contract.json'
].forEach(name => {
  check(!!readJson(path.join(ROOT, 'shared', 'research-contribution-intake', name)), name + ' parses as JSON');
});

process.stdout.write('research-contribution-intake audit selftest: ' + checks + ' checks passed\n');
