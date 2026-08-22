#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Knowledge = require('../../../shared/grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier');
const Builder = require('./build-current-knowledge-frontier');
const Verification = require('./build-verification-receipt');

const ROOT = path.resolve(__dirname, '../../..');
const COMPARE = path.join(process.env.USERPROFILE || '', '.codex', 'skills', 'detect-capability-gaps', 'scripts', 'compare_capabilities.py');
let checks = 0;

function check(condition, label) {
  checks += 1;
  assert.ok(condition, label);
  console.log('PASS ' + label);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
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

const input = Builder.currentInput();
const current = Builder.current();
const rebuilt = Builder.build();
const summary = readJson('CURRENT_SUMMARY.json');
const gap = readJson('CAPABILITY_GAP_REPORT.json');

check(Knowledge.verifyKnowledgeFrontier(current, input).pass, 'current knowledge frontier verifies by exact rebuild');
check(Knowledge.stableStringify(current) === Knowledge.stableStringify(rebuilt), 'stored frontier equals a fresh current rebuild');
check(Knowledge.stableStringify(summary) === Knowledge.stableStringify(Builder.summary(rebuilt)), 'stored summary equals a fresh rebuild');
check(summary.summaryDigest === Knowledge.sha256(Object.fromEntries(Object.entries(summary).filter(([key]) => key !== 'summaryDigest'))), 'summary digest rebuilds exactly');
check(current.status === 'TEST' && summary.truth.automaticCanon === false, 'receipt and summary remain TEST with no CANON authority');

check(current.counts.totalLanes === 6 && current.lanes.length === 6, 'current frontier contains exactly six lanes');
check(current.counts.researchArtifacts === 7 && current.counts.researchModelSeats === 4, 'current frontier carries seven artifacts and four model seats');
check(current.counts.researchRetainedSignals === 6 && current.counts.researchProposals === 6, 'current frontier carries six signals and six proposal dispositions');
check(current.counts.researchWarnings === 4 && current.counts.researchHolds === 0, 'current frontier carries four warnings and zero research holds');
check(current.counts.researchAiWorkflowPass === 1 && current.counts.researchHumanPass === 0, 'research AI and human evidence counts remain separate');

check(current.knowledgeBinding.assessmentMatchesPortableBaseline, 'current assessment matches the exact portable baseline');
check(current.knowledgeBinding.assessmentArtifactSetMatchesBaseline, 'current assessment matches the exact baseline artifact set');
check(current.knowledgeBinding.dispositionContentIdentityMatches, 'current baseline and outcome disposition bytes match');
check(current.knowledgeBinding.dispositionIdsAliasButDigestMatches, 'different disposition aliases remain visible');
check(current.sourceRefs.researchDisposition.sha256 === input.baselineCapsule.extensions.find(item => item.namespace === 'axm.5yff.research-disposition').extensionRef.sha256, 'receipt binds the exact baseline disposition digest');

const lane = current.lanes.find(item => item.id === 'RESEARCH_CONTRIBUTION_KNOWLEDGE');
check(!!lane && lane.state === 'READY_FOR_BASELINE_SIMULATION_PLANNING', 'research contribution lane is ready only for planning');
check(lane.boundedAiWorkflowEvidence.admittedVerdict === 'PASS', 'bounded research AI workflow result is admitted PASS');
check(lane.humanBenefitEvidence.admittedVerdict === 'NOT_RUN', 'research human benefit remains NOT_RUN');
check(lane.artifactToSeatMappingEstablished === false && lane.crossModelIndependenceEstablished === false, 'mapping and independence remain unestablished');
check(lane.planningIsCandidatePresence === false && lane.agreementIsProof === false, 'planning and agreement cannot substitute for candidate evidence or proof');

check(current.balance.technicalKnowledgeIntakeReady === true, 'technical knowledge intake is ready');
check(current.balance.boundedResearchAiWorkflowEvidencePresent === true, 'bounded AI-workflow evidence is present');
check(current.balance.researchHumanBenefitEvidencePresent === false, 'research human-benefit evidence is absent');
check(current.balance.groundedGrowthForAiAndHumansEstablished === false, 'AI-and-human grounded growth remains unestablished');
check(current.balance.unresolvedEvidence.length === 9, 'nine exact evidence seams remain visible');
check(current.decision.autonomousActionCount === 0 && current.decision.reviewableActionCount === 0, 'current knowledge frontier grants zero action');
check(current.decision.currentBestAction === 'WAIT_FOR_NEW_EVIDENCE_OR_EXPLICIT_CANDIDATE', 'current best action remains the bounded wait');

check(current.truth.stewardshipFrontierVerifiedByExactRebuild && current.truth.researchContributionVerifiedByExactRebuild, 'both composed source receipts verify natively');
check(current.truth.researchArtifactsCrossBoundToBaseline && current.truth.researchDispositionCrossBoundToOutcome, 'artifact and disposition ancestry are cross-bound');
check(current.truth.structuralIntakeIsEvidence === false && current.truth.planningReadinessIsCandidatePresence === false, 'intake and planning substitution are refused');
check(current.truth.aiWorkflowEvidenceIsModelLearning === false && current.truth.aiWorkflowEvidenceIsHumanBenefit === false, 'AI workflow evidence is neither model learning nor human benefit');
check(current.truth.sharedGrowthClaimed === false && current.truth.modelWeightTrainingClaimed === false, 'shared growth and model-weight training remain unclaimed');
check(current.truth.automaticExecution === false && current.truth.automaticPromotion === false && current.truth.automaticCanon === false, 'receipt grants no execution promotion or CANON authority');

const before = comparison('CAPABILITY_INVENTORY_BEFORE.json');
const after = comparison('CAPABILITY_INVENTORY_AFTER.json');
check(before.overall === gap.before.overall && before.missingCapabilities.length === 10, 'before comparator proves ten exact required capabilities missing');
check(before.missingCapabilities.every(id => gap.before.missingCapabilities.includes(id)), 'durable before gap summary matches comparator output');
check(after.overall === gap.after.overall && after.missingCapabilities.length === 0, 'after comparator proves all required capabilities available');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all required after requirements are READY');
check(after.requirements.filter(item => !item.required && item.status !== 'READY').length === 5, 'five optional evidence seams remain degraded or unknown');

const tampered = JSON.parse(JSON.stringify(current));
tampered.counts.researchHumanPass = 1;
check(!Knowledge.verifyKnowledgeFrontier(tampered, input).pass, 'fabricated human benefit fails exact verification');
const promoted = JSON.parse(JSON.stringify(current));
promoted.decision.autonomousActionCount = 1;
check(!Knowledge.verifyKnowledgeFrontier(promoted, input).pass, 'fabricated autonomous action fails exact verification');
const learned = JSON.parse(JSON.stringify(current));
learned.truth.aiWorkflowEvidenceIsModelLearning = true;
check(!Knowledge.verifyKnowledgeFrontier(learned, input).pass, 'fabricated model learning fails exact verification');

const verification = readJson('VERIFICATION_RECEIPT.json');
check(Verification.verify(verification).pass, 'verification receipt and every declared source digest rebuild exactly');
check(verification.focused.explicitAssertions === 111 && verification.adjacent.explicitAssertions === 267 && verification.totalExplicitAssertions === 378, 'verification receipt preserves focused and adjacent assertion totals');
check(verification.requiredChecks.passed === 10 && verification.requiredChecks.failed === 0, 'all ten required checks are recorded PASS');
check(verification.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && verification.broadVerification.warningGroups === 2 && verification.broadVerification.failures === 0, 'broad verifier warnings remain visible without failures');
check(verification.currentState.totalLanes === 6 && verification.currentState.researchHumanBenefitPass === 0 && verification.currentState.unresolvedEvidence === 9, 'verification receipt preserves the current bounded state');
check(verification.boundaries.sharedGrowthClaimed === false && verification.boundaries.automaticCanon === false, 'verification receipt grants no shared-growth or CANON authority');
check(verification.browserVerification.verdict === 'NOT_RUN' && verification.truth.rawTerminalLogsRetained === false, 'browser and raw-log retention limits remain explicit');

[
  'CAPABILITY_REQUIREMENTS.json', 'CAPABILITY_INVENTORY_BEFORE.json',
  'CAPABILITY_INVENTORY_AFTER.json', 'CAPABILITY_GAP_REPORT.json',
  'CURRENT_KNOWLEDGE_FRONTIER_RECEIPT.json', 'CURRENT_SUMMARY.json'
].forEach(name => check(!!readJson(name), name + ' parses as JSON'));

console.log('Grounded Growth Knowledge Frontier audit selftest passed: ' + checks + ' checks.');
