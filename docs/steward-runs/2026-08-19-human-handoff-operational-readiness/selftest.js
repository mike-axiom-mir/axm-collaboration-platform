'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const Bridge = require('../../../shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Handoff = require('../../../shared/grounded-growth-human-handoff/grounded-growth-human-handoff');
const Builder = require('./build-current-handoff-readiness');
const Runner = require('./run-current-human-handoff-interactive');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function throws(fn, pattern, message) {
  assert.throws(fn, pattern);
  checks += 1;
  console.log('PASS ' + message);
}

const result = Builder.verifyRecorded();
const readiness = result.readiness;
ok(readiness.status === 'TEST', 'current handoff readiness remains TEST');
ok(readiness.state === 'TECHNICAL_HANDOFF_READY_HUMAN_EVIDENCE_NOT_RUN', 'technical route is ready while human evidence remains NOT_RUN');
ok(readiness.routes.length === 4, 'readiness covers four current capability chains');
ok(new Set(readiness.routes.map((route) => route.capabilityId)).size === 4, 'current capability selectors remain unique');
ok(readiness.routes.filter((route) => route.ancestryMode === 'CANDIDATE').length === 2, 'two current routes preserve candidate ancestry');
ok(readiness.routes.filter((route) => route.ancestryMode === 'REUSE_EXISTING').length === 2, 'two current routes preserve reuse-existing ancestry');
ok(readiness.routes.every((route) => route.selectorVerification === 'PASS'), 'every current route resolves through the interactive selector');
ok(readiness.routes.every((route) => route.protocolVerification === 'PASS'), 'every current LIVE protocol verifies exactly');
ok(readiness.routes.every((route) => route.interventionLinkVerification === 'PASS'), 'every current v2 intervention link verifies exactly');
ok(readiness.routes.every((route) => route.humanEvidenceState === 'NOT_RUN'), 'no current route fabricates human evidence');
ok(readiness.routes.every((route) => route.humanBenefitEstablished === false), 'no current route claims established human benefit');

ok(result.gapBefore.overall === 'BLOCKED', 'before route is blocked on missing post-session handoff capabilities');
ok(result.gapBefore.missingCapabilities.includes('human.handoff.local-source-declaration'), 'before route names the missing native source declaration');
ok(result.gapBefore.missingCapabilities.includes('human.handoff.v2-bridge-compose'), 'before route names the missing v2 handoff composition');
ok(result.gapAfter.overall === 'READY', 'all required technical handoff capabilities compare READY after the leaf');
ok(result.gapAfter.missingCapabilities.length === 0, 'after route has no missing required capability');
const liveRow = result.gapAfter.requirements.find((row) => row.id === 'live-human-beneficiary-outcome');
ok(liveRow && liveRow.required === false && liveRow.status === 'DEGRADED', 'optional LIVE human outcome remains degraded rather than fabricated');
ok(result.gapAfter.proposedHands.length === 0, 'no additional technical hand is proposed after exact composition');

for (const route of readiness.routes) {
  const selected = Runner.loadExactRoute(route.capabilityId);
  ok(selected.definition.capabilityId === route.capabilityId, route.capabilityId + ' selector keeps exact capability identity');
  ok(Bridge.verifyInterventionLink(selected.link, selected.current.outcome.cycleReceipt, selected.protocol).pass, route.capabilityId + ' selected v2 link verifies natively');
}

throws(() => Runner.loadExactRoute('not.a.current.capability'), /unsupported current capability route/, 'unknown capability selector is refused');
throws(() => Runner.loadExternalSessions(path.join(__dirname, 'CURRENT_HANDOFF_READINESS.json')), /outside the Workshop repository/, 'session evidence inside the Workshop is refused');

const interactive = path.join(__dirname, 'run-current-human-handoff-interactive.js');
const nonTty = childProcess.spawnSync(process.execPath, [interactive, 'simulation.baseline.capsule.verify', 'Z:\\not-read.json'], {
  cwd: path.resolve(__dirname, '..', '..', '..'),
  encoding: 'utf8',
  input: ''
});
ok(nonTty.status === 1, 'non-TTY interactive invocation exits nonzero');
ok(nonTty.stderr.includes('piped or automated input is refused before reading session evidence'), 'non-TTY route refuses before reading the supplied path');
ok(!nonTty.stderr.includes('ENOENT'), 'non-TTY route does not touch the supplied session file');

ok(readiness.stagedBoundary.judgment === 'SEPARATE_EXPLICIT_LOCAL_TTY_INPUT', 'readiness preserves judgment as a separate local input');
ok(readiness.stagedBoundary.sourceTrust === 'LOCAL_DECLARATION_NOT_AUTHENTICATION', 'readiness distinguishes declaration from authentication');
ok(readiness.stagedBoundary.output === 'STANDARD_OUTPUT_ONLY', 'interactive handoff emits to stdout only');
ok(readiness.stagedBoundary.writesAutomatically === false, 'interactive handoff performs no automatic write');
ok(readiness.livePath.state === 'NOT_RUN', 'positive LIVE operational path remains NOT_RUN');
ok(readiness.livePath.sourceAuthentication === 'EXTERNAL_AND_NOT_PERFORMED', 'human source authentication remains external and unclaimed');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'shared', 'grounded-growth-human-handoff', 'module.contract.json'), 'utf8'));
ok(contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'handoff core has no permissions or write boundary');
ok(contract.boundaries.refuses.includes('automatic-participation'), 'handoff core refuses automatic participation');
ok(contract.boundaries.refuses.includes('local-declaration-as-cohort-authentication'), 'handoff core refuses cohort claims from a local declaration');
ok(contract.boundaries.refuses.includes('automatic-canon'), 'handoff core refuses automatic CANON authority');
ok(readiness.truth.humanParticipationOccurred === false, 'current readiness records no human participation');
ok(readiness.truth.liveJudgmentCreated === false, 'current readiness records no LIVE judgment');
ok(readiness.truth.admittedLiveBridgePackageCreated === false, 'current readiness records no admitted LIVE bridge package');
ok(readiness.truth.groundedHumanOutcomeCreated === false, 'current readiness records no grounded human outcome');
ok(readiness.truth.automaticPromotion === false && readiness.truth.automaticCanon === false, 'current readiness carries no promotion or CANON authority');

const forbiddenSchemas = new Set([
  'axm.human-benefit-session-receipt/v1',
  'axm.human-benefit-evaluation-receipt/v1',
  'axm.human-benefit-judgment-receipt/v1',
  Handoff.HANDOFF_SCHEMA,
  Bridge.BUNDLE_SCHEMA
]);
const emitted = [];
for (const file of fs.readdirSync(__dirname).filter((name) => name.endsWith('.json'))) {
  const document = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  if (typeof document.schema === 'string' && forbiddenSchemas.has(document.schema)) emitted.push({ file, schema: document.schema });
}
ok(emitted.length === 0, 'readiness lane persists no human receipt, handoff package, or bridge bundle');

console.log('\nCurrent human handoff operational readiness selftest: PASS (' + checks + ' checks)');
