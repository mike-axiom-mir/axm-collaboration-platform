'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Bridge = require('../../../shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Builder = require('./build-current-readiness');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const result = Builder.verifyRecorded();
ok(result.routes.length === 4, 'v2 ancestry readiness covers all four current capability chains');
ok(new Set(result.routes.map((route) => route.definition.capabilityId)).size === 4, 'current capability identities remain unique');
ok(result.routes.filter((route) => route.link.ancestry.mode === 'CANDIDATE').length === 2, 'two current routes preserve candidate ancestry');
ok(result.routes.filter((route) => route.link.ancestry.mode === 'REUSE_EXISTING').length === 2, 'two current routes preserve reuse-existing ancestry');
ok(new Set(result.routes.map((route) => route.link.linkDigest)).size === 4, 'every current route has a distinct native intervention link');

for (const route of result.routes) {
  const cycle = route.current.outcome.cycleReceipt;
  const protocolCheck = Human.verifyProtocol(route.protocol);
  const linkCheck = Bridge.verifyInterventionLink(route.link, cycle, route.protocol);
  ok(protocolCheck.pass, route.definition.capabilityId + ' protocol still verifies natively');
  ok(linkCheck.pass, route.definition.capabilityId + ' v2 intervention link verifies natively');
  ok(route.link.capabilityId === route.definition.capabilityId, route.definition.capabilityId + ' link keeps exact capability identity');
  ok(route.link.claimId === route.current.humanClaim.id, route.definition.capabilityId + ' link keeps exact human claim identity');
  ok(route.current.humanClaim.admittedVerdict === 'NOT_RUN' && route.current.humanClaim.routeStatus === 'NOT_PROVEN', route.definition.capabilityId + ' human claim remains NOT_RUN / NOT_PROVEN');
  ok(route.link.truth.candidateInventedForReuse === false && route.link.truth.humanBenefitClaimed === false, route.definition.capabilityId + ' link invents neither candidate nor human benefit');
  if (route.link.ancestry.mode === 'CANDIDATE') {
    ok(cycle.candidate !== null && cycle.gap.existingCapabilityRef === null, route.definition.capabilityId + ' candidate ancestry is mutually exclusive');
    ok(route.link.ancestry.capabilitySurfaceRef.sha256 === cycle.candidate.artifactRef.sha256, route.definition.capabilityId + ' link binds the exact candidate surface');
  } else {
    ok(cycle.state === 'REUSE_EXISTING' && cycle.candidate === null, route.definition.capabilityId + ' reuse ancestry carries no candidate');
    ok(route.link.ancestry.capabilitySurfaceRef.sha256 === cycle.gap.existingCapabilityRef.sha256, route.definition.capabilityId + ' link binds the exact existing capability surface');
  }
}

ok(result.readiness.capabilityComparison.before.endToEndAncestryReady === 2, 'readiness receipt preserves the prior two-of-four bridge gap');
ok(result.readiness.capabilityComparison.after.endToEndAncestryReady === 4, 'readiness receipt records four-of-four ancestry coverage after v2');
ok(result.readiness.capabilityComparison.after.establishedHumanBenefits === 0, 'ancestry readiness does not become human benefit');
ok(result.readiness.evidenceGate.positiveLivePathVerified === false, 'positive LIVE path remains explicitly unverified');
ok(result.readiness.truth.humanParticipationOccurred === false, 'current readiness claims no human participation');
ok(result.readiness.truth.bridgeBundleCreatedFromHumanEvidence === false, 'current readiness claims no bridge bundle from human evidence');
ok(result.readiness.truth.groundedOutcomeRefreshed === false, 'current readiness claims no Grounded Growth refresh');
ok(result.readiness.truth.v1BridgeModified === false, 'current readiness records v1 preservation');

const requiredRows = result.gapReport.requirements.filter((requirement) => requirement.required);
ok(requiredRows.every((requirement) => requirement.status === 'READY'), 'all required ancestry, gate, continuity, and authority capabilities compare READY');
ok(result.gapReport.overall === 'READY', 'deterministic comparator reports the required capability route READY');
ok(result.gapReport.requirements.find((requirement) => requirement.id === 'live-human-beneficiary-outcome').status === 'DEGRADED', 'optional live human outcome remains degraded rather than fabricated');
ok(result.gapReport.missingCapabilities.length === 0 && result.gapReport.proposedHands.length === 0, 'reuse ancestry hand is no longer missing or merely proposed');

const reuseRoutes = result.routes.filter((route) => route.link.ancestry.mode === 'REUSE_EXISTING');
const crossed = JSON.parse(JSON.stringify(reuseRoutes[0].link));
crossed.ancestry.capabilitySurfaceRef = reuseRoutes[1].link.ancestry.capabilitySurfaceRef;
const crossedCheck = Bridge.verifyInterventionLink(crossed, reuseRoutes[0].current.outcome.cycleReceipt, reuseRoutes[0].protocol);
ok(!crossedCheck.pass, 'one current reused capability surface cannot cross into another route');

const relabeled = JSON.parse(JSON.stringify(reuseRoutes[0].link));
relabeled.ancestry.mode = 'CANDIDATE';
const relabeledCheck = Bridge.verifyInterventionLink(relabeled, reuseRoutes[0].current.outcome.cycleReceipt, reuseRoutes[0].protocol);
ok(!relabeledCheck.pass, 'current reused capability cannot be relabeled as a candidate');

const humanReceiptSchemas = new Set([Human.SESSION_SCHEMA, Human.EVALUATION_SCHEMA, Human.JUDGMENT_SCHEMA]);
const forbiddenHumanReceipts = walk(__dirname).filter((file) => file.endsWith('.json')).filter((file) => {
  try {
    return humanReceiptSchemas.has(JSON.parse(fs.readFileSync(file, 'utf8')).schema);
  } catch (_) {
    return false;
  }
});
ok(forbiddenHumanReceipts.length === 0, 'ancestry readiness lane contains no human session, evaluation, or judgment receipt');

const bridgeBundles = walk(__dirname).filter((file) => file.endsWith('.json')).filter((file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).schema === Bridge.BUNDLE_SCHEMA;
  } catch (_) {
    return false;
  }
});
ok(bridgeBundles.length === 0, 'current readiness emits no bridge bundle without native human evidence');

console.log('\nCurrent reuse-existing human bridge ancestry selftest: PASS (' + checks + ' checks)');
