#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Frontier = require('../../../shared/grounded-growth-frontier-gate/grounded-growth-frontier-gate');

const workshop = path.resolve(__dirname, '../../..');

function readLocal(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function readWorkshop(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log('PASS ' + label);
}

const input = {
  frontierId: 'current-grounded-growth-frontier-20260819',
  generatedAt: '2026-08-19T14:25:00.000Z',
  portfolio: readWorkshop('docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json'),
  directionHandoff: readWorkshop('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json'),
  humanHandoffReadiness: readWorkshop('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json'),
  extensionHostProfile: readWorkshop('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_SIMULATION_LAB_HOST_PROFILE.json'),
  extensionReadiness: readWorkshop('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_EXTENSION_INTAKE_READINESS.json')
};

const receipt = readLocal('CURRENT_FRONTIER_RECEIPT.json');
const requirements = readLocal('CAPABILITY_REQUIREMENTS.json');
const before = readLocal('CAPABILITY_INVENTORY_BEFORE.json');
const after = readLocal('CAPABILITY_INVENTORY_AFTER.json');
const gapBefore = readLocal('CAPABILITY_GAP_BEFORE.json');
const gapAfter = readLocal('CAPABILITY_GAP_AFTER.json');
const contract = readWorkshop('shared/grounded-growth-frontier-gate/module.contract.json');
const expected = Frontier.buildFrontier(input);

check(Frontier.verifyFrontier(receipt, input).pass, 'recorded frontier verifies by exact native rebuild');
check(Frontier.stableStringify(receipt) === Frontier.stableStringify(expected), 'recorded frontier exactly equals a fresh build');
check(receipt.status === 'TEST', 'frontier remains TEST');
check(receipt.scope === 'CURRENT_GROUNDED_GROWTH_AND_EXTENSION_INPUTS', 'frontier is explicitly scoped to its five current inputs');
check(receipt.sourceRefs.portfolio.sha256 === input.portfolio.portfolioDigest, 'frontier binds the exact current portfolio');
check(receipt.sourceRefs.directionHandoff.sha256 === input.directionHandoff.handoffDigest, 'frontier binds the exact current direction handoff');
check(receipt.sourceRefs.humanHandoffReadiness.sha256 === input.humanHandoffReadiness.receiptDigest, 'frontier binds the exact current human readiness');
check(receipt.sourceRefs.extensionHostProfile.sha256 === input.extensionHostProfile.profileDigest, 'frontier binds the exact extension host profile');
check(receipt.sourceRefs.extensionReadiness.sha256 === input.extensionReadiness.receiptDigest, 'frontier binds the exact extension readiness');

check(receipt.counts.capabilityChains === 4, 'frontier contains four capability chains');
check(receipt.counts.latestSharedSystemPass === 4 && receipt.counts.latestAiWorkflowPass === 4, 'all four shared-system and AI-workflow claims are PASS');
check(receipt.counts.latestHumanPass === 0 && receipt.counts.latestHumanNotRun === 4, 'human evidence remains zero PASS and four NOT_RUN');
check(receipt.counts.waitDirections === 4 && receipt.counts.actionDirections === 0, 'all current directions remain waits');
check(receipt.counts.voluntaryHumanRoutes === 4 && receipt.counts.liveHumanOutcomes === 0, 'four voluntary routes exist with zero live outcomes');
check(receipt.counts.candidatePackages === 0 && receipt.counts.candidateAssessments === 0, 'no extension candidate or assessment exists');

const technical = receipt.lanes.find((lane) => lane.id === 'CURRENT_TECHNICAL_DIRECTION');
const human = receipt.lanes.find((lane) => lane.id === 'VOLUNTARY_HUMAN_EVIDENCE');
const extension = receipt.lanes.find((lane) => lane.id === 'EXPERIMENTAL_EXTENSION');
check(technical.state === 'NO_ACTIONABLE_DIRECTION' && technical.automatic === false, 'technical direction lane has no actionable automatic work');
check(human.state === 'AVAILABLE_BY_EXPLICIT_HUMAN_CHOICE' && human.automatic === false, 'human lane requires explicit independent choice');
check(human.completionOrWithdrawalEquallyValid === true, 'human completion and withdrawal remain equally valid');
check(extension.state === 'WAITING_FOR_EXPLICIT_CANDIDATE' && extension.automatic === false, 'extension lane waits for an explicit candidate');
check(receipt.decision.autonomousActionCount === 0 && receipt.decision.reviewableActionCount === 0, 'current scoped decision contains no autonomous or reviewable action');
check(receipt.decision.currentBestAction === 'WAIT_FOR_NEW_EVIDENCE_OR_EXPLICIT_CANDIDATE', 'current best action is bounded waiting');

check(receipt.truth.humanRouteReadyIsConsent === false && receipt.truth.humanBenefitEstablished === false, 'readiness is not consent or human benefit');
check(receipt.truth.exampleDeclarationCountsAsCandidate === false && receipt.truth.candidateCodeExecuted === false, 'example material is not candidate evidence or execution');
check(receipt.truth.modelWeightTrainingClaimed === false && receipt.truth.broadGeneralizationClaimed === false, 'workflow coverage is not model learning or broad generalization');
check(receipt.truth.autonomousWorkAuthorized === false && receipt.truth.automaticCanon === false && receipt.truth.foundationMutation === false, 'frontier grants no autonomous, CANON, or Foundation authority');

check(requirements.requirements.filter((item) => item.required).length === 4, 'requirements define four required proof groups');
check(requirements.requirements.filter((item) => item.required).flatMap((item) => item.capabilities).length === 8, 'requirements define eight required frontier capabilities');
check(!before.capabilities.some((item) => item.id === 'growth.frontier.no-autonomous-action'), 'before inventory lacks the unified frontier decision');
const originalRequiredCapabilities = requirements.requirements
  .filter((item) => item.required)
  .flatMap((item) => item.capabilities);
check(originalRequiredCapabilities.every((id) => after.capabilities.some((item) => item.id === id && item.status === 'available')), 'after inventory contains every capability required by the original v0.1 audit');
check(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 8, 'independent before comparison is BLOCKED with eight missing capabilities');
check(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'independent after comparison is READY with no required capability missing');
check(gapAfter.requirements.find((item) => item.id === 'live-voluntary-human-evidence').status === 'DEGRADED', 'optional live human evidence remains degraded');
check(gapAfter.requirements.find((item) => item.id === 'experimental-extension-candidate').status === 'DEGRADED', 'optional extension candidate remains degraded');
check(gapAfter.requirements.find((item) => item.id === 'new-non-wait-direction').status === 'DEGRADED', 'optional non-wait direction remains degraded');

const localNames = fs.readdirSync(__dirname);
check(!localNames.some((name) => /HUMAN_(OUTCOME|RESPONSE)|CANDIDATE_(PACKAGE|ASSESSMENT)/.test(name)), 'audit lane persists no human outcome or extension candidate artifact');
check(!contract.boundaries.writes.length && contract.permissions.length === 0, 'module has no writes or permissions');

const verification = readLocal('VERIFICATION_RECEIPT.json');
check(verification.schema === 'axm.grounded-growth-frontier-verification-receipt/v1' && verification.status === 'TEST', 'verification receipt identity remains TEST');
check(verification.focused.explicitAssertions === 79 && verification.focused.commands[0].assertions === 38 && verification.focused.commands[1].assertions === 41, 'verification receipt records all focused assertions');
check(verification.adjacent.explicitAssertions === 368 && verification.adjacent.commandLevelPasses === 2, 'verification receipt records adjacent assertions and rebuild checks');
check(verification.requiredChecks.passed === 10 && verification.requiredChecks.failed === 0 && verification.broadVerification.failures === 0 && verification.broadVerification.holds === 0, 'verification receipt records required and broad results without hidden failure');
check(verification.sources.length > 0
  && new Set(verification.sources.map((source) => source.path)).size === verification.sources.length
  && verification.sources.every((source) => /^sha256:[a-f0-9]{64}$/.test(source.sha256))
  && Frontier.verifyFrontier(receipt, input).pass,
'historical v0.1 source digests remain well-formed while the original receipt still verifies after the v0.2 upgrade');

console.log('Current Grounded Growth frontier audit selftest passed: ' + checks + ' checks.');
