#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Choice = require('../../../shared/grounded-growth-voluntary-choice-frontier/grounded-growth-voluntary-choice-frontier');
const SignalBuilder = require('../2026-08-20-grounded-growth-signal-lineage/build-signal-lineage-growth');
const RouteBuilder = require('../2026-08-20-grounded-growth-human-route-coverage/build-current-human-route-coverage');

const ROOT = path.resolve(__dirname, '../../..');
const LANE = 'docs/steward-runs/2026-08-20-grounded-growth-voluntary-choice-frontier';
const GENERATED_AT = '2026-08-20T01:40:00.000Z';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pretty(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function gapReports() {
  const before = readJson(LANE + '/CAPABILITY_GAP_BEFORE.json');
  const after = readJson(LANE + '/CAPABILITY_GAP_AFTER.json');
  if (before.overall !== 'BLOCKED') throw new Error('before capability gap must remain BLOCKED');
  if (after.overall !== 'DEGRADED' || after.missingCapabilities.length !== 0) {
    throw new Error('after capability gap must be DEGRADED only by optional unknown evidence');
  }
  return { before, after };
}

function inputFromCurrent(signal, routes) {
  return {
    frontierId: 'current-grounded-growth-voluntary-choice-frontier-20260820',
    generatedAt: GENERATED_AT,
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

function buildAll() {
  const gaps = gapReports();
  const signal = SignalBuilder.loadRecordedCurrentRoute();
  const routes = RouteBuilder.loadRecordedCoverageRoute();
  const input = inputFromCurrent(signal, routes);
  const frontier = Choice.build(input);
  const check = Choice.verify(frontier, input);
  if (!check.pass) throw new Error('current voluntary-choice frontier failed native rebuild: ' + check.errors.join('; '));
  if (frontier.current.capabilityChains !== 6 || frontier.current.availableChoices !== 5 || frontier.current.heldChoices !== 1) {
    throw new Error('current voluntary-choice counts changed');
  }
  if (frontier.current.priorOptionalReviewCandidates !== 1 || frontier.decision.selectedChoiceCount !== 0 ||
      frontier.decision.autonomousActionCount !== 0 || frontier.decision.reviewableActionCount !== 0) {
    throw new Error('current voluntary-choice decision boundary changed');
  }
  const summary = {
    schema: 'axm.grounded-growth-voluntary-choice-frontier-summary/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    sourceRefs: clone(frontier.sourceRefs),
    reconciliation: {
      currentCapabilityChains: frontier.current.capabilityChains,
      olderOptionalReviewCandidates: frontier.current.priorOptionalReviewCandidates,
      currentAvailableChoices: frontier.current.availableChoices,
      currentHeldChoices: frontier.current.heldChoices,
      missingChoiceDispositions: 0,
      oldSingleCandidateTreatedAsCompleteMenu: false
    },
    selection: {
      state: frontier.decision.state,
      selectedChoices: frontier.decision.selectedChoiceCount,
      defaultChoice: frontier.selectionPolicy.defaultChoiceId,
      rankedChoices: frontier.selectionPolicy.rankedChoiceIds.length,
      preselectedChoices: frontier.selectionPolicy.preselectedChoiceIds.length,
      waitAllowed: frontier.selectionPolicy.waitAllowed,
      explicitHumanRequestRequired: frontier.selectionPolicy.explicitHumanRequestRequiredBeforeMenuOrPrompt,
      automaticPrompt: frontier.truth.automaticPrompt,
      participationOccurred: frontier.truth.participationOccurred
    },
    evidenceBalance: clone(frontier.balance),
    capabilityGap: {
      before: gaps.before.overall,
      after: gaps.after.overall,
      requiredMissingAfter: gaps.after.missingCapabilities.length,
      optionalUnknownAfter: gaps.after.requirements.filter((item) => !item.required && item.status === 'OPTIONAL_UNKNOWN').map((item) => item.id)
    },
    outcomeBoundary: {
      newGroundedGrowthOutcomeCreated: false,
      reason: 'This support frontier reconciles current choice without creating another benefit claim or route-for-route chain.'
    },
    truth: {
      neutralMenuIsHumanSelection: false,
      selectionOccurred: false,
      humanParticipationOccurred: false,
      humanBenefitEstablished: false,
      sourceAuthenticationClaimed: false,
      deferredProposalImplemented: false,
      installed: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false,
      modelLearningClaimed: false
    },
    summaryDigest: null
  };
  const payload = clone(summary);
  delete payload.summaryDigest;
  summary.summaryDigest = Choice.sha256(payload);
  return { gaps, signal, routes, input, frontier, summary };
}

function outputFiles(result) {
  return new Map([
    ['CURRENT_VOLUNTARY_CHOICE_FRONTIER.json', result.frontier],
    ['CURRENT_SUMMARY.json', result.summary]
  ]);
}

function writeAll() {
  const result = buildAll();
  for (const [name, value] of outputFiles(result)) fs.writeFileSync(path.join(__dirname, name), pretty(value), 'utf8');
  return result;
}

function checkRecorded() {
  const result = buildAll();
  for (const [name, expected] of outputFiles(result)) {
    const actual = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
    if (Choice.stableStringify(actual) !== Choice.stableStringify(expected)) throw new Error(name + ' differs from exact current sources');
  }
  return result;
}

if (require.main === module) {
  try {
    const result = process.argv.includes('--write') ? writeAll() : checkRecorded();
    process.stdout.write(JSON.stringify({
      state: result.frontier.state,
      currentChains: result.frontier.current.capabilityChains,
      olderReviewCandidates: result.frontier.current.priorOptionalReviewCandidates,
      availableChoices: result.frontier.current.availableChoices,
      heldChoices: result.frontier.current.heldChoices,
      selectedChoices: result.frontier.decision.selectedChoiceCount,
      humanPass: result.frontier.current.humanPass,
      humanNotRun: result.frontier.current.humanNotRun,
      gapBefore: result.gaps.before.overall,
      gapAfter: result.gaps.after.overall,
      digest: result.frontier.frontierDigest
    }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { ROOT, LANE, GENERATED_AT, gapReports, inputFromCurrent, buildAll, outputFiles, writeAll, checkRecorded };
