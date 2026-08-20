#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Verification = require('./build-verification-receipt');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}

const receipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), 'utf8'));
const checkResults = JSON.parse(fs.readFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), 'utf8'));
check(Verification.verify(receipt).pass, 'verification receipt and every stable source reference rebuild exactly');
check(receipt.status === 'TEST' && receipt.result === 'PASS_WITH_DECLARED_LIMITS', 'result remains TEST with declared limits');
check(receipt.portfolio.outcomes === 10 && receipt.portfolio.currentCapabilityChains === 6, 'verification binds the exact ten-outcome, six-chain portfolio');
check(receipt.portfolio.appendedByThisIncrement === 0 && receipt.portfolio.selfReferentialRouteOutcomeAvoided, 'support coverage does not create a recursive outcome chain');
check(receipt.coverage.state === 'BOUNDED_COVERAGE_WITH_EXPLICIT_HOLDS', 'coverage state preserves the explicit hold');
check(receipt.coverage.readyRoutes === 5 && receipt.coverage.heldRoutes === 1 && receipt.coverage.missingRoutes === 0, 'all six current chains have one exact disposition');
check(receipt.coverage.candidateAncestryReady === 3 && receipt.coverage.reuseExistingAncestryReady === 2, 'ready ancestry modes are exact');
check(receipt.coverage.humanPass === 0 && receipt.coverage.humanNotRun === 6, 'no human result was invented');
check(receipt.coverage.autonomousActionCount === 0 && receipt.coverage.reviewableActionCount === 0, 'coverage grants no action');
check(receipt.routeConstruction.exactProtocolAndLinkReuse === 3, 'three protocol and link pairs remain exact reuse');
check(receipt.routeConstruction.claimRefreshedRoutes === 1, 'one changed claim receives an explicit protocol/link refresh');
check(receipt.routeConstruction.newClaimNativeRoutes === 2 && receipt.routeConstruction.newSurfaceRoutes === 1, 'claim-native refresh and genuinely new surface work stay distinguished');
check(receipt.routeConstruction.reboundCurrentPackets === 5, 'all five ready packets bind current outcomes');
check(receipt.heldBoundary.capabilityId === 'growth.knowledge-signal-lineage.verify', 'the exact signal-lineage capability remains held');
check(receipt.heldBoundary.proposalId === 'proposal:signal-link-ledger' && receipt.heldBoundary.proposalImplemented === false, 'the hold binds the still-deferred proposal');
check(receipt.heldBoundary.automaticAction === false, 'the held route remains inert');
check(receipt.optionalDriver.routes === 5 && receipt.optionalDriver.heldRouteCommands === 0, 'driver exposes five ready selectors and no held selector');
check(receipt.optionalDriver.localTtyRequired && !receipt.optionalDriver.repositoryLocalSessionInputAllowed, 'driver preserves TTY and external-session boundaries');
check(receipt.optionalDriver.runByThisIncrement === false && receipt.optionalDriver.writesAutomatically === false, 'no optional journey ran or wrote data');
check(receipt.focusedAndAdjacent.passed === receipt.focusedAndAdjacent.total && receipt.focusedAndAdjacent.failed === 0, 'all focused and adjacent checks pass');
check(receipt.focusedAndAdjacent.explicitAssertions === checkResults.summary.explicitAssertions && receipt.focusedAndAdjacent.explicitAssertions > 400, 'counted focused assertions match the compact check receipt');
check(receipt.requiredChecks.passed === 10 && receipt.requiredChecks.failed === 0, 'all ten required Workshop checks pass');
check(receipt.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && receipt.broadVerification.failures === 0, 'broad verification retains limits with no failures');
check(['RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT', 'CURRENT_EXACT'].includes(receipt.historicalEvolution.classification), 'prior verification evolution is exactly classified');
check(receipt.historicalEvolution.historicalReceiptRewritten === false, 'historical verification receipt remains unchanged');
check(receipt.capabilityGap.before === 'BLOCKED' && receipt.capabilityGap.after === 'DEGRADED' && receipt.capabilityGap.requiredMissingAfter === 0, 'required route gap is closed without hiding optional unknowns');
check(receipt.capabilityGap.liveHumanBenefit === 'OPTIONAL_UNKNOWN', 'live human benefit remains optional unknown');
check(receipt.capabilityGap.signalLineageHumanSurface === 'OPTIONAL_UNKNOWN', 'deferred signal-lineage surface remains optional unknown');
check(receipt.capabilityGap.humanSourceAuthentication === 'OPTIONAL_UNKNOWN', 'human source authentication remains optional unknown');
check(receipt.browserVerification.applicable === false && receipt.browserVerification.verdict === 'NOT_RUN', 'browser verification is honestly not applicable');
check(receipt.declaredLimits.length >= 6, 'verification preserves explicit evidence and authority limits');
check(Object.values(receipt.boundaries).every((value) => value === false), 'verification grants no human, source, lifecycle, model, or CANON authority');
check(!/[A-Za-z]:[\\/]/.test(JSON.stringify(receipt)), 'verification receipt contains no machine path');
check(Verification.SOURCE_FILES.every((file) => fs.existsSync(path.join(Verification.ROOT, file))), 'every declared stable source exists');
check(receipt.sourceRefs.length === Verification.SOURCE_FILES.length, 'stable source reference count is exact');

console.log('PASS Grounded Growth human-route coverage verification selftest (' + checks + ' assertions)');
