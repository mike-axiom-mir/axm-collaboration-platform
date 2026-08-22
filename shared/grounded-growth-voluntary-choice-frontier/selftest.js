#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Choice = require('./grounded-growth-voluntary-choice-frontier');
const SignalBuilder = require('../../docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/build-signal-lineage-growth');
const RouteBuilder = require('../../docs/steward-runs/2026-08-20-grounded-growth-human-route-coverage/build-current-human-route-coverage');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sources() {
  const signal = SignalBuilder.checkRecorded();
  const routes = RouteBuilder.checkRecorded();
  return {
    frontierId: 'fixture-current-voluntary-choice-frontier',
    generatedAt: '2026-08-20T01:20:00.000Z',
    currentStateReceipt: signal.currentState,
    currentStateInput: signal.currentStateInput,
    humanRouteCoverageReceipt: routes.coverage,
    humanRouteCoverageInput: {
      portfolio: routes.portfolio,
      readyRoutes: routes.readyRoutes,
      heldRoutes: routes.heldRoutes,
      sourceRefs: routes.coverage.sourceRefs
    },
    routeCatalog: routes.catalog
  };
}

function redigest(frontier) {
  const value = clone(frontier);
  delete value.frontierDigest;
  value.frontierDigest = Choice.sha256(value);
  return value;
}

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-voluntary-choice-frontier.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
check(schema.$id === Choice.RECEIPT_SCHEMA, 'schema identity matches implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'contract remains permissionless TEST');
check(contract.boundaries.refuses.includes('default-human-choice') && contract.boundaries.refuses.includes('automatic-prompting'), 'contract refuses default selection and automatic prompting');

const input = sources();
const frontier = Choice.build(input);
check(Choice.verify(frontier, input).pass, 'frontier verifies by exact native rebuild');
const portable = Choice.verifyPortable(frontier);
check(portable.pass && portable.sourceTruth === 'UNKNOWN' && portable.selection === 'NOT_OCCURRED' && portable.humanBenefit === 'NOT_RUN', 'portable verification preserves its claim ceiling');
check(frontier.state === 'CURRENT_NEUTRAL_OPTION_MENU_WITH_EXPLICIT_HOLDS', 'current menu preserves explicit holds');
check(frontier.current.capabilityChains === 6 && frontier.current.availableChoices === 5 && frontier.current.heldChoices === 1, 'all six current chains receive an exact choice disposition');
check(frontier.current.priorOptionalReviewCandidates === 1, 'older single-route guidance remains visible as source history');
check(frontier.current.humanPass === 0 && frontier.current.humanNotRun === 6, 'frontier invents no human evidence');
check(frontier.choices.every((item) => item.availability === Choice.READY_STATE && item.priority === null && !item.recommended && !item.preselected && !item.started), 'every ready route remains neutral and unstarted');
check(frontier.holds.every((item) => item.availability === Choice.HOLD_STATE && item.commandAvailable === false && !item.recommended && !item.started), 'every held route remains unavailable and commandless');
check(frontier.selectionPolicy.defaultChoiceId === null && frontier.selectionPolicy.rankedChoiceIds.length === 0 && frontier.selectionPolicy.preselectedChoiceIds.length === 0, 'selection policy has no default, ranking, or preselection');
check(frontier.selectionPolicy.waitAllowed && frontier.selectionPolicy.optOutHasNoPenalty && frontier.selectionPolicy.explicitHumanRequestRequiredBeforeMenuOrPrompt, 'waiting, opting out, and explicit request remain first-class');
check(frontier.selectionPolicy.systemMayStartWithoutHumanSelection === false, 'system cannot start a route without human selection');
check(frontier.decision.state === 'NO_SELECTION_EVENT' && frontier.decision.selectedChoiceCount === 0, 'no selection event is fabricated');
check(frontier.decision.autonomousActionCount === 0 && frontier.decision.reviewableActionCount === 0, 'frontier grants no automatic or queued action');
check(frontier.balance.technicalEvidenceAheadOfHumanEvidence && !frontier.balance.groundedGrowthForAiAndHumansEstablished, 'technical/human evidence asymmetry remains visible');
check(frontier.truth.oldSingleReviewCandidateIsCompleteCurrentMenu === false, 'older single candidate is not mislabeled as the complete current menu');
check(frontier.truth.participationOccurred === false && frontier.truth.humanBenefitEstablished === false, 'availability is not relabeled participation or benefit');
check(frontier.truth.automaticPrompt === false && frontier.truth.automaticExecution === false && frontier.truth.automaticCanon === false, 'frontier has no prompt, execution, or CANON authority');
check(Choice.verifyCatalog(input.routeCatalog, input.humanRouteCoverageReceipt).pass, 'catalog verifies against exact coverage');

const badCatalogDigest = sources();
badCatalogDigest.routeCatalog.catalogDigest = 'sha256:' + '0'.repeat(64);
assert.throws(() => Choice.build(badCatalogDigest), /catalog digest mismatch/i);
checks += 1;

const missingCatalogRoute = sources();
missingCatalogRoute.routeCatalog.readyRoutes.pop();
missingCatalogRoute.routeCatalog.catalogDigest = Choice.catalogDigest(missingCatalogRoute.routeCatalog);
assert.throws(() => Choice.build(missingCatalogRoute), /does not cover every ready route/i);
checks += 1;

const commandInjection = sources();
commandInjection.routeCatalog.readyRoutes[0].sessionCommand += '; echo unsafe';
commandInjection.routeCatalog.catalogDigest = Choice.catalogDigest(commandInjection.routeCatalog);
assert.throws(() => Choice.build(commandInjection), /catalog command mismatch/i);
checks += 1;

const crossPortfolio = sources();
crossPortfolio.currentStateReceipt.sourceRefs.latestPortfolio.sha256 = 'sha256:' + '1'.repeat(64);
assert.throws(() => Choice.build(crossPortfolio), /current state invalid|different portfolios/i);
checks += 1;

const selected = clone(frontier);
selected.choices[0].preselected = true;
check(!Choice.verifyPortable(redigest(selected)).pass, 'recomputed digest cannot preselect a route');

const ranked = clone(frontier);
ranked.selectionPolicy.rankedChoiceIds = [ranked.choices[0].choiceId];
check(!Choice.verifyPortable(redigest(ranked)).pass, 'recomputed digest cannot introduce AI ranking');

const defaulted = clone(frontier);
defaulted.selectionPolicy.defaultChoiceId = defaulted.choices[0].choiceId;
check(!Choice.verifyPortable(redigest(defaulted)).pass, 'recomputed digest cannot introduce a default choice');

const noWait = clone(frontier);
noWait.selectionPolicy.waitAllowed = false;
check(!Choice.verifyPortable(redigest(noWait)).pass, 'recomputed digest cannot remove the wait option');

const started = clone(frontier);
started.decision.selectedChoiceCount = 1;
check(!Choice.verifyPortable(redigest(started)).pass, 'recomputed digest cannot fabricate a selection event');

const activatedHold = clone(frontier);
activatedHold.holds[0].commandAvailable = true;
check(!Choice.verifyPortable(redigest(activatedHold)).pass, 'recomputed digest cannot activate a held route');

const humanBenefit = clone(frontier);
humanBenefit.truth.humanBenefitEstablished = true;
check(!Choice.verifyPortable(redigest(humanBenefit)).pass, 'recomputed digest cannot inflate readiness into human benefit');

const automaticPrompt = clone(frontier);
automaticPrompt.truth.automaticPrompt = true;
check(!Choice.verifyPortable(redigest(automaticPrompt)).pass, 'recomputed digest cannot grant automatic prompting');

console.log('PASS Grounded Growth voluntary-choice frontier selftest (' + checks + ' assertions)');
