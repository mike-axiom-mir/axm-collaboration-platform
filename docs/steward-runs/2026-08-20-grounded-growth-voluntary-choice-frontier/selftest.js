#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Choice = require('../../../shared/grounded-growth-voluntary-choice-frontier/grounded-growth-voluntary-choice-frontier');
const Builder = require('./build-current-voluntary-choice-frontier');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function redigestFrontier(value) {
  const result = clone(value);
  delete result.frontierDigest;
  result.frontierDigest = Choice.sha256(result);
  return result;
}

function redigestCatalog(value) {
  const result = clone(value);
  delete result.catalogDigest;
  result.catalogDigest = Choice.sha256(result);
  return result;
}

const result = Builder.checkRecorded();
const frontier = result.frontier;
check(Choice.verify(frontier, result.input).pass, 'recorded frontier verifies against exact native sources');
const portable = Choice.verifyPortable(frontier);
check(portable.pass && portable.sourceTruth === 'UNKNOWN' && portable.sourceCurrentness === 'UNKNOWN', 'portable verifier preserves source limits');
check(portable.selection === 'NOT_OCCURRED' && portable.humanBenefit === 'NOT_RUN', 'portable verifier preserves selection and human-evidence limits');
check(result.signal.portfolio.portfolioDigest === result.routes.portfolio.portfolioDigest, 'signal-lineage current state and route coverage use the same exact portfolio');
check(result.signal.portfolio.summary.outcomeCount === 10 && result.signal.portfolio.summary.capabilityCount === 6, 'exact current portfolio remains ten outcomes over six chains');
check(frontier.sourceRefs.portfolio.sha256 === result.signal.portfolio.portfolioDigest, 'frontier binds the exact current portfolio');
check(frontier.sourceRefs.currentState.sha256 === result.signal.currentState.receiptDigest, 'frontier binds exact current state');
check(frontier.sourceRefs.humanRouteCoverage.sha256 === result.routes.coverage.receiptDigest, 'frontier binds exact human-route coverage');
check(frontier.sourceRefs.humanRouteCatalog.sha256 === result.routes.catalog.catalogDigest, 'frontier binds exact route catalog');
check(frontier.current.capabilityChains === 6 && frontier.current.availableChoices === 5 && frontier.current.heldChoices === 1, 'every current chain receives one choice disposition');
check(frontier.current.priorOptionalReviewCandidates === 1, 'older single optional review candidate remains visible as history');
check(frontier.current.sharedSystemPass === 6 && frontier.current.aiWorkflowPass === 6, 'technical beneficiary counts remain exact');
check(frontier.current.humanPass === 0 && frontier.current.humanNotRun === 6, 'human evidence remains zero pass and six not-run');
check(frontier.choices.length === result.routes.coverage.routes.length, 'ready choice count equals exact ready coverage');
check(frontier.holds.length === result.routes.coverage.holds.length, 'held choice count equals exact held coverage');
const choiceIds = frontier.choices.map((item) => item.capabilityId).sort();
const routeIds = result.routes.coverage.routes.map((item) => item.capabilityId).sort();
check(Choice.stableStringify(choiceIds) === Choice.stableStringify(routeIds), 'current choices cover the exact ready capability set');
check(frontier.choices.some((item) => item.capabilityId === 'simulation.run-envelope.verify'), 'the older research handoff remains one neutral current choice');
check(frontier.choices.some((item) => item.capabilityId === 'growth.current-state.detached-integrity.verify'), 'the new detached-trust route is present');
check(frontier.holds[0].capabilityId === 'growth.knowledge-signal-lineage.verify', 'the signal-lineage route remains held');
check(frontier.holds[0].proposalId === 'proposal:signal-link-ledger' && frontier.holds[0].commandAvailable === false, 'held route retains exact proposal boundary and no command');
check(frontier.choices.every((item) => item.priority === null && !item.recommended && !item.preselected && !item.started), 'no ready route is ranked, recommended, preselected, or started');
check(frontier.selectionPolicy.defaultChoiceId === null, 'there is no default human choice');
check(frontier.selectionPolicy.rankedChoiceIds.length === 0 && frontier.selectionPolicy.preselectedChoiceIds.length === 0, 'there is no hidden ranking or preselection');
check(frontier.selectionPolicy.waitAllowed && frontier.selectionPolicy.optOutHasNoPenalty, 'waiting and opting out remain penalty-free');
check(frontier.selectionPolicy.explicitHumanRequestRequiredBeforeMenuOrPrompt, 'menu or prompt requires a new explicit human request');
check(frontier.selectionPolicy.systemMayStartWithoutHumanSelection === false, 'system cannot start without human selection');
check(frontier.decision.state === 'NO_SELECTION_EVENT' && frontier.decision.selectedChoiceCount === 0, 'no selection event exists');
check(frontier.decision.reviewableActionCount === 0 && frontier.decision.autonomousActionCount === 0, 'no action is queued or autonomous');
check(frontier.balance.technicalPassSignals === 12 && frontier.balance.currentHumanPassSignals === 0, 'technical/human evidence asymmetry is counted exactly');
check(frontier.balance.technicalEvidenceAheadOfHumanEvidence && !frontier.balance.groundedGrowthForAiAndHumansEstablished, 'asymmetry stays explicit rather than becoming a shared-growth claim');
check(frontier.truth.oldSingleReviewCandidateIsCompleteCurrentMenu === false, 'older single-candidate guidance is not presented as complete');
check(frontier.truth.menuAvailabilityIsParticipation === false && frontier.truth.routeReadinessIsHumanEvidence === false, 'menu and route readiness do not become participation or evidence');
check(frontier.truth.selectionClaimed === false && frontier.truth.participationOccurred === false && frontier.truth.humanBenefitEstablished === false, 'selection, participation, and human benefit remain false');
check(frontier.truth.deferredProposalImplemented === false && frontier.truth.automaticPrompt === false, 'deferred surface and automatic prompt remain inactive');
check(frontier.truth.automaticExecution === false && frontier.truth.automaticWrite === false && frontier.truth.automaticCanon === false, 'execution, write, and CANON authority remain absent');
check(result.summary.reconciliation.oldSingleCandidateTreatedAsCompleteMenu === false, 'summary records the exact reconciliation boundary');
check(result.summary.selection.selectedChoices === 0 && result.summary.selection.automaticPrompt === false, 'summary records no selection or prompt');
check(result.summary.outcomeBoundary.newGroundedGrowthOutcomeCreated === false, 'support frontier creates no recursive benefit outcome');
check(result.gaps.before.overall === 'BLOCKED' && result.gaps.after.overall === 'DEGRADED', 'capability route improves from blocked to optional-unknown degraded');
check(result.gaps.after.missingCapabilities.length === 0, 'no required choice-frontier capability remains missing');
check(result.summary.capabilityGap.optionalUnknownAfter.length === 3, 'selection, human outcome, and source authentication remain optional unknowns');

const recommended = clone(frontier);
recommended.choices[0].recommended = true;
check(!Choice.verifyPortable(redigestFrontier(recommended)).pass, 'recomputed digest cannot recommend a human route');

const selected = clone(frontier);
selected.choices[0].preselected = true;
check(!Choice.verifyPortable(redigestFrontier(selected)).pass, 'recomputed digest cannot preselect a human route');

const action = clone(frontier);
action.decision.reviewableActionCount = 1;
check(!Choice.verifyPortable(redigestFrontier(action)).pass, 'recomputed digest cannot queue review pressure');

const humanPass = clone(frontier);
humanPass.current.humanPass = 1;
humanPass.current.humanNotRun = 5;
check(!Choice.verifyPortable(redigestFrontier(humanPass)).pass, 'recomputed digest cannot fabricate human evidence');

const heldStarted = clone(frontier);
heldStarted.holds[0].started = true;
check(!Choice.verifyPortable(redigestFrontier(heldStarted)).pass, 'recomputed digest cannot start a held route');

const selectionClaim = clone(frontier);
selectionClaim.truth.selectionClaimed = true;
check(!Choice.verifyPortable(redigestFrontier(selectionClaim)).pass, 'recomputed digest cannot claim human selection');

const catalogClaim = clone(result.input);
catalogClaim.routeCatalog.readyRoutes[0].humanClaimId = 'crossed-human-claim';
catalogClaim.routeCatalog = redigestCatalog(catalogClaim.routeCatalog);
assert.throws(() => Choice.build(catalogClaim), /catalog claim or human-evidence mismatch/i);
checks += 1;

const divergentRunner = clone(result.input);
divergentRunner.routeCatalog.readyRoutes[0].sessionCommand = divergentRunner.routeCatalog.readyRoutes[0].sessionCommand.replace('run-current-human-route-interactive.js', 'other-runner.js');
divergentRunner.routeCatalog.readyRoutes[0].handoffCommand = divergentRunner.routeCatalog.readyRoutes[0].handoffCommand.replace('run-current-human-route-interactive.js', 'other-runner.js');
divergentRunner.routeCatalog = redigestCatalog(divergentRunner.routeCatalog);
assert.throws(() => Choice.build(divergentRunner), /do not share one current runner/i);
checks += 1;

const activatedCatalogHold = clone(result.input);
activatedCatalogHold.routeCatalog.heldRoutes[0].commandAvailable = true;
activatedCatalogHold.routeCatalog = redigestCatalog(activatedCatalogHold.routeCatalog);
assert.throws(() => Choice.build(activatedCatalogHold), /catalog held route mismatch/i);
checks += 1;

const crossedPortfolio = clone(result.input);
crossedPortfolio.currentStateReceipt.sourceRefs.latestPortfolio.sha256 = 'sha256:' + 'f'.repeat(64);
assert.throws(() => Choice.build(crossedPortfolio), /current state invalid|different portfolios/i);
checks += 1;

console.log('PASS current Grounded Growth voluntary-choice frontier selftest (' + checks + ' assertions)');
