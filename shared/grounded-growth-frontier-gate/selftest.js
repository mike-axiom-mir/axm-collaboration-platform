#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Frontier = require('./grounded-growth-frontier-gate');

const workshop = path.resolve(__dirname, '../..');
const schema = require('./grounded-growth-frontier-receipt.schema.json');
const evidenceSchema = require('./grounded-growth-evidence-frontier-receipt.schema.json');
const stewardshipSchema = require('./grounded-growth-stewardship-frontier-receipt.schema.json');
const contract = require('./module.contract.json');

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log('PASS ' + label);
}

function checkThrows(fn, pattern, label) {
  assert.throws(fn, pattern, label);
  checks += 1;
  console.log('PASS ' + label);
}

function currentInput() {
  return {
    frontierId: 'current-grounded-growth-frontier-20260819',
    generatedAt: '2026-08-19T14:15:00.000Z',
    portfolio: read('docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json'),
    directionHandoff: read('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json'),
    humanHandoffReadiness: read('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json'),
    extensionHostProfile: read('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_SIMULATION_LAB_HOST_PROFILE.json'),
    extensionReadiness: read('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_EXTENSION_INTAKE_READINESS.json')
  };
}

function currentPhoneInput() {
  const campaign = read('docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CURRENT_PHONE_QA_CAMPAIGN.json');
  const gameId = campaign.nextAction.nextGameId;
  const gameManifest = read('tools/game-hub/game-library/' + gameId + '/game.manifest.json');
  return {
    gateId: 'current-phone-grounded-growth-evidence-gate-20260819',
    generatedAt: '2026-08-19T15:30:00.000Z',
    campaign,
    gameManifest,
    deviceEvidence: null,
    closureReport: null,
    binding: {
      capabilityId: 'game.' + gameId + '.physical-phone-controller-experience',
      humanClaimId: gameId + '-phone-experience-usefulness',
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement: 'The named local steward using the exact ' + gameManifest.name + ' phone-controller surface.'
    },
    humanHandoff: null
  };
}

function currentChallengerInput() {
  return {
    readinessId: 'current-grounded-growth-challenger-readiness-20260819',
    generatedAt: '2026-08-19T13:05:00.000Z',
    directionHandoff: read('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json'),
    directionReadiness: read('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_READINESS.json'),
    shadowContract: read('tools/repair-resilience-library/components/shadow-simulator/module.contract.json'),
    diagnosticContract: read('tools/repair-resilience-library/components/diagnostic-experiment-runner/module.contract.json'),
    plans: [],
    evaluations: []
  };
}

const input = currentInput();
const receipt = Frontier.buildFrontier(input);

check(schema.$id === Frontier.FRONTIER_SCHEMA, 'schema identity matches implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0, 'module remains TEST with zero permissions');
check(contract.boundaries.writes.length === 0, 'module performs no writes');
check(contract.boundaries.refuses.includes('readiness-as-consent') && contract.boundaries.refuses.includes('frontier-receipt-as-workshop-wide-stop'), 'contract refuses consent and scope substitution');
check(contract.boundaries.refuses.includes('candidate-count-without-exact-candidate-input'), 'contract refuses candidate presence without exact candidate evidence');
check(Frontier.verifyFrontier(receipt, input).pass, 'current frontier verifies by exact rebuild');
check(receipt.sourceRefs.portfolio.sha256 === input.portfolio.portfolioDigest, 'frontier binds the exact current portfolio');
check(receipt.sourceRefs.directionHandoff.sha256 === input.directionHandoff.handoffDigest, 'frontier binds the exact current direction handoff');
check(receipt.sourceRefs.humanHandoffReadiness.sha256 === input.humanHandoffReadiness.receiptDigest, 'frontier binds the exact human handoff readiness');
check(receipt.sourceRefs.extensionReadiness.sha256 === input.extensionReadiness.receiptDigest, 'frontier binds the exact extension readiness');
check(receipt.counts.capabilityChains === 4 && receipt.counts.latestSharedSystemPass === 4, 'current frontier carries four shared-system capability chains');
check(receipt.counts.latestAiWorkflowPass === 4, 'all four current capability chains retain admitted AI-workflow evidence');
check(receipt.counts.latestHumanPass === 0 && receipt.counts.latestHumanNotRun === 4, 'human benefit remains zero PASS and four NOT_RUN');
check(receipt.counts.waitDirections === 4 && receipt.counts.actionDirections === 0, 'all four current directions remain zero-action waits');
check(receipt.counts.voluntaryHumanRoutes === 4 && receipt.counts.liveHumanOutcomes === 0, 'four voluntary routes remain technically ready with zero live outcomes');
check(receipt.counts.candidatePackages === 0 && receipt.counts.candidateAssessments === 0, 'extension lane contains no candidate or assessment');
check(receipt.lanes.find((lane) => lane.id === 'CURRENT_TECHNICAL_DIRECTION').state === 'NO_ACTIONABLE_DIRECTION', 'technical lane refuses to manufacture work');
check(receipt.lanes.find((lane) => lane.id === 'VOLUNTARY_HUMAN_EVIDENCE').state === 'AVAILABLE_BY_EXPLICIT_HUMAN_CHOICE', 'human lane preserves explicit voluntary choice');
check(receipt.lanes.find((lane) => lane.id === 'VOLUNTARY_HUMAN_EVIDENCE').completionOrWithdrawalEquallyValid === true, 'human lane preserves completion and withdrawal equally');
check(receipt.lanes.find((lane) => lane.id === 'EXPERIMENTAL_EXTENSION').state === 'WAITING_FOR_EXPLICIT_CANDIDATE', 'extension lane waits for an actual candidate');
check(receipt.decision.autonomousActionCount === 0 && receipt.decision.reviewableActionCount === 0, 'current scoped frontier contains no autonomous or reviewable action');
check(receipt.decision.currentBestAction === 'WAIT_FOR_NEW_EVIDENCE_OR_EXPLICIT_CANDIDATE', 'current best action is the bounded wait');
check(receipt.truth.aiWorkflowCoverageComplete === true && receipt.truth.modelWeightTrainingClaimed === false, 'workflow coverage is not mislabeled as model learning');
check(receipt.truth.humanRouteReadyIsConsent === false && receipt.truth.humanBenefitEstablished === false, 'technical human readiness is not mislabeled as consent or benefit');
check(receipt.truth.exampleDeclarationCountsAsCandidate === false && receipt.truth.candidateCodeExecuted === false, 'example declaration is not mislabeled as a candidate or execution');
check(receipt.truth.autonomousWorkAuthorized === false && receipt.truth.automaticCanon === false, 'frontier grants no autonomous work or CANON authority');
check(receipt.scope === 'CURRENT_GROUNDED_GROWTH_AND_EXTENSION_INPUTS', 'receipt scope does not claim a Workshop-wide stop');

const phoneInput = currentPhoneInput();
const phoneReceipt = read('docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CURRENT_PHONE_GROUNDED_GROWTH_READINESS.json');
const evidenceInput = {
  evidenceFrontierId: 'current-grounded-growth-evidence-frontier-20260819',
  generatedAt: '2026-08-19T15:45:00.000Z',
  frontierReceipt: receipt,
  frontierInput: input,
  phoneEvidenceGate: phoneReceipt,
  phoneEvidenceInput: phoneInput
};
const evidenceReceipt = Frontier.buildEvidenceFrontier(evidenceInput);
check(evidenceSchema.$id === Frontier.EVIDENCE_FRONTIER_SCHEMA, 'evidence-frontier schema identity matches implementation');
check(contract.version === 'v0.3' && contract.provides.includes(Frontier.EVIDENCE_FRONTIER_SCHEMA), 'v0.3 contract preserves the evidence-frontier receipt');
check(Frontier.verifyEvidenceFrontier(evidenceReceipt, evidenceInput).pass, 'current evidence frontier verifies by exact rebuild');
check(evidenceReceipt.sourceRefs.frontier.sha256 === receipt.frontierDigest, 'evidence frontier binds the exact original frontier');
check(evidenceReceipt.sourceRefs.phoneEvidenceGate.sha256 === phoneReceipt.receiptDigest, 'evidence frontier binds the exact phone evidence gate');
check(evidenceReceipt.counts.portfolioCapabilityChains === 4 && evidenceReceipt.counts.portfolioCapabilityChainsAdded === 0, 'supplemental route does not become a fifth portfolio capability');
check(evidenceReceipt.counts.supplementalPhoneEvidenceRoutes === 1, 'one supplemental phone route is visible');
check(evidenceReceipt.counts.phoneDeviceBehaviorPass === 0 && evidenceReceipt.counts.phoneHumanUsefulnessPass === 0 && evidenceReceipt.counts.phoneTwoKeyEvidencePresent === 0, 'both current phone evidence keys remain not passed');
check(evidenceReceipt.lanes.length === 4 && evidenceReceipt.lanes[3].state === 'WAITING_FOR_VOLUNTARY_PHONE_OBSERVATION', 'fourth lane exposes the exact current phone state');
check(evidenceReceipt.lanes[3].portfolioMembershipChanged === false && evidenceReceipt.lanes[3].automatic === false, 'phone lane grants neither portfolio membership nor automation');
check(evidenceReceipt.decision.autonomousActionCount === 0 && evidenceReceipt.decision.reviewableActionCount === 0, 'integrated frontier manufactures no action');
check(evidenceReceipt.decision.currentBestAction === receipt.decision.currentBestAction, 'incomplete supplemental evidence cannot displace the bounded frontier decision');
check(evidenceReceipt.truth.phoneTwoKeyEvidenceIsSharedGrowthProof === false && evidenceReceipt.truth.modelWeightTrainingClaimed === false, 'supplemental evidence is not mislabeled as shared growth or model learning');
check(evidenceReceipt.truth.supplementalRouteAddedToPortfolio === false && evidenceReceipt.truth.portfolioCapabilityCountChanged === false, 'integrated receipt preserves portfolio ancestry and count');

const evidencePhoneTamper = clone(evidenceInput);
evidencePhoneTamper.phoneEvidenceGate.keys.deviceBehavior.passed = true;
checkThrows(() => Frontier.buildEvidenceFrontier(evidencePhoneTamper), /phone evidence gate invalid/, 'tampered phone evidence is refused by exact native rebuild');

const evidenceFrontierTamper = clone(evidenceInput);
evidenceFrontierTamper.frontierReceipt.decision.autonomousActionCount = 1;
checkThrows(() => Frontier.buildEvidenceFrontier(evidenceFrontierTamper), /frontier receipt invalid/, 'tampered source frontier is refused by exact native rebuild');

const evidencePredatesSource = clone(evidenceInput);
evidencePredatesSource.generatedAt = '2026-08-19T15:00:00.000Z';
checkThrows(() => Frontier.buildEvidenceFrontier(evidencePredatesSource), /cannot predate/, 'evidence frontier cannot predate either source receipt');

const evidenceReceiptTamper = clone(evidenceReceipt);
evidenceReceiptTamper.counts.portfolioCapabilityChainsAdded = 1;
check(!Frontier.verifyEvidenceFrontier(evidenceReceiptTamper, evidenceInput).pass, 'receipt cannot silently promote the supplemental route into the portfolio');

const challengerInput = currentChallengerInput();
const challengerReceipt = read('docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CURRENT_CHALLENGER_READINESS.json');
const stewardshipInput = {
  stewardshipFrontierId: 'current-grounded-growth-stewardship-frontier-20260819',
  generatedAt: '2026-08-19T16:10:00.000Z',
  evidenceFrontierReceipt: evidenceReceipt,
  evidenceFrontierInput: evidenceInput,
  challengerReadiness: challengerReceipt,
  challengerReadinessInput: challengerInput
};
const stewardshipReceipt = Frontier.buildStewardshipFrontier(stewardshipInput);
check(stewardshipSchema.$id === Frontier.STEWARDSHIP_FRONTIER_SCHEMA, 'stewardship-frontier schema identity matches implementation');
check(contract.provides.includes(Frontier.STEWARDSHIP_FRONTIER_SCHEMA), 'v0.3 contract advertises the AI-and-human stewardship receipt');
check(Frontier.verifyStewardshipFrontier(stewardshipReceipt, stewardshipInput).pass, 'current stewardship frontier verifies by exact rebuild');
check(stewardshipReceipt.sourceRefs.evidenceFrontier.sha256 === evidenceReceipt.evidenceFrontierDigest, 'stewardship frontier binds the exact evidence frontier');
check(stewardshipReceipt.sourceRefs.challengerReadiness.sha256 === challengerReceipt.receiptDigest, 'stewardship frontier binds exact challenger readiness');
check(stewardshipReceipt.counts.portfolioCapabilityChains === 4 && stewardshipReceipt.counts.portfolioAiWorkflowPass === 4, 'stewardship frontier preserves complete portfolio AI-workflow coverage');
check(stewardshipReceipt.counts.portfolioHumanPass === 0 && stewardshipReceipt.counts.phoneHumanUsefulnessPass === 0, 'human evidence remains zero in both current scopes');
check(stewardshipReceipt.counts.challengerActionableDirections === 0 && stewardshipReceipt.counts.challengerPlans === 0 && stewardshipReceipt.counts.challengerEvaluations === 0, 'current challenger lane remains zero-action and zero-result');
check(stewardshipReceipt.lanes.length === 5 && stewardshipReceipt.lanes[4].state === 'LAB_CAPABILITY_READY_CURRENT_DIRECTIONS_HELD', 'fifth lane exposes bounded challenger readiness without manufacturing work');
check(stewardshipReceipt.balance.aiWorkflowPortfolioCoverageComplete === true && stewardshipReceipt.balance.portfolioHumanCoverageComplete === false, 'AI-workflow and human evidence coverage remain independently visible');
check(stewardshipReceipt.balance.sharedGrowthClaimAllowed === false && stewardshipReceipt.balance.unresolvedEvidence.length === 4, 'shared growth stays unclaimed with four exact evidence seams open');
check(stewardshipReceipt.decision.autonomousActionCount === 0 && stewardshipReceipt.decision.reviewableActionCount === 0, 'balanced current frontier grants no autonomous or reviewable action');
check(stewardshipReceipt.decision.currentBestAction === evidenceReceipt.decision.currentBestAction, 'held challenger readiness does not displace the bounded evidence-frontier decision');
check(stewardshipReceipt.truth.challengerLabReadyIsLearning === false && stewardshipReceipt.truth.challengerEvaluationIsHumanBenefit === false, 'challenger readiness and evaluation are not substituted for learning or human benefit');

const challengerTamper = clone(stewardshipInput);
challengerTamper.challengerReadiness.current.challengerEvaluationCount = 1;
checkThrows(() => Frontier.buildStewardshipFrontier(challengerTamper), /challenger readiness invalid/, 'tampered challenger readiness is refused by exact native rebuild');

const stewardshipReceiptTamper = clone(stewardshipReceipt);
stewardshipReceiptTamper.truth.sharedGrowthClaimed = true;
check(!Frontier.verifyStewardshipFrontier(stewardshipReceiptTamper, stewardshipInput).pass, 'stewardship receipt cannot silently claim shared growth');

const portfolioTamper = currentInput();
portfolioTamper.portfolio.outcomes[0].state = 'GROUNDED_SHARED_GROWTH';
checkThrows(() => Frontier.buildFrontier(portfolioTamper), /portfolio invalid/, 'tampered portfolio is refused by its native verifier');

const directionTamper = currentInput();
directionTamper.directionHandoff.summary.executedDirectionCount = 1;
checkThrows(() => Frontier.buildFrontier(directionTamper), /direction handoff invalid/, 'tampered direction execution state is refused natively');

const directionSourceMismatch = currentInput();
directionSourceMismatch.directionHandoff.sourcePacket.source.receipt.portfolioId = 'other-portfolio';
checkThrows(() => Frontier.buildFrontier(directionSourceMismatch), /direction handoff invalid|exact current portfolio/, 'direction cannot point at another portfolio');

const humanDigestTamper = currentInput();
humanDigestTamper.humanHandoffReadiness.routes[0].humanEvidenceState = 'PASS';
checkThrows(() => Frontier.buildFrontier(humanDigestTamper), /receipt digest mismatch/, 'human readiness content tampering is refused');

const humanFalseBenefit = currentInput();
humanFalseBenefit.humanHandoffReadiness.routes[0].humanBenefitEstablished = true;
const humanFalsePayload = clone(humanFalseBenefit.humanHandoffReadiness);
delete humanFalsePayload.receiptDigest;
humanFalseBenefit.humanHandoffReadiness.receiptDigest = Frontier.sha256(humanFalsePayload);
checkThrows(() => Frontier.buildFrontier(humanFalseBenefit), /cannot claim live benefit/, 'self-consistent false human-benefit readiness is refused');

const humanRouteMissing = currentInput();
humanRouteMissing.humanHandoffReadiness.routes.pop();
const humanRoutePayload = clone(humanRouteMissing.humanHandoffReadiness);
delete humanRoutePayload.receiptDigest;
humanRouteMissing.humanHandoffReadiness.receiptDigest = Frontier.sha256(humanRoutePayload);
checkThrows(() => Frontier.buildFrontier(humanRouteMissing), /exact current capabilities/, 'incomplete voluntary route coverage is refused');

const extensionDigestTamper = currentInput();
extensionDigestTamper.extensionReadiness.current.candidatePackageCount = 1;
checkThrows(() => Frontier.buildFrontier(extensionDigestTamper), /receipt digest mismatch/, 'extension candidate-count tampering is refused');

const extensionFalseCandidate = currentInput();
extensionFalseCandidate.extensionReadiness.current.candidatePackageCount = 1;
const extensionFalsePayload = clone(extensionFalseCandidate.extensionReadiness);
delete extensionFalsePayload.receiptDigest;
extensionFalseCandidate.extensionReadiness.receiptDigest = Frontier.sha256(extensionFalsePayload);
checkThrows(() => Frontier.buildFrontier(extensionFalseCandidate), /requires zero-candidate readiness/, 'example material cannot become a candidate by changing only a count');

const hostTamper = currentInput();
hostTamper.extensionHostProfile.authority.installAuthorized = true;
checkThrows(() => Frontier.buildFrontier(hostTamper), /extension host profile invalid/, 'tampered extension host authority is refused natively');

const hostMismatch = currentInput();
hostMismatch.extensionReadiness.bindings.hostProfileDigest = 'sha256:' + '0'.repeat(64);
const hostMismatchPayload = clone(hostMismatch.extensionReadiness);
delete hostMismatchPayload.receiptDigest;
hostMismatch.extensionReadiness.receiptDigest = Frontier.sha256(hostMismatchPayload);
checkThrows(() => Frontier.buildFrontier(hostMismatch), /host profile binding mismatch/, 'extension readiness cannot target another host profile');

const receiptTamper = clone(receipt);
receiptTamper.decision.autonomousActionCount = 1;
check(!Frontier.verifyFrontier(receiptTamper, input).pass, 'frontier cannot be silently changed into autonomous authority');

console.log('Grounded Growth Frontier Gate selftest passed: ' + checks + ' checks.');
