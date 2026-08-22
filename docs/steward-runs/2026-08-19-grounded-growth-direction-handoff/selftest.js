#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Feedback = require('../../../shared/grounded-growth-feedback/grounded-growth-feedback');
const Direction = require('../../../shared/grounded-growth-direction-handoff/grounded-growth-direction-handoff');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}
function read(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

const feedback = read('CURRENT_FEEDBACK_PACKET.json');
const handoff = read('CURRENT_DIRECTION_HANDOFF.json');
const readiness = read('CURRENT_DIRECTION_READINESS.json');
const requirements = read('CAPABILITY_REQUIREMENTS.json');
const before = read('CAPABILITY_INVENTORY_BEFORE.json');
const after = read('CAPABILITY_INVENTORY_AFTER.json');
const gapBefore = read('CAPABILITY_GAP_BEFORE.json');
const gapAfter = read('CAPABILITY_GAP_AFTER.json');

check(Feedback.verifyPacket(feedback).pass, 'current feedback packet verifies natively');
check(Growth.verifyPortfolio(feedback.source.receipt).pass, 'embedded current Grounded Growth portfolio verifies natively');
check(feedback.source.receipt.summary.outcomeCount === 7 && feedback.source.receipt.summary.capabilityCount === 4, 'current source retains seven outcomes across four capability chains');
check(feedback.candidateNeeds.length === 4 && feedback.summary.candidateNeedCount === 4, 'current effective portfolio produces four feedback needs');
check(feedback.candidateNeeds.every((need) => need.possible_responses.length === 1 && need.possible_responses[0] === 'WAIT_FOR_EVIDENCE'), 'every current need can only wait for voluntary human evidence');
check(feedback.routeStates.length === 4 && feedback.routeStates.every((route) => route.state === 'READY_FOR_VOLUNTARY_INPUT'), 'all four technical human routes are declared ready for optional input');
check(feedback.truth.routeReferenceFetchedOrAuthenticated === false, 'feedback preserves route readiness as an unauthenticated declaration');

check(Direction.verifyHandoff(handoff).pass, 'current direction handoff verifies deterministically');
check(handoff.summary.directionCount === 4 && handoff.summary.holdCount === 0, 'four unambiguous current needs produce four direction drafts');
check(handoff.summary.waitDirectionCount === 4 && handoff.summary.actionDirectionCount === 0, 'all current directions are WAIT_FOR_EVIDENCE and none starts action');
check(handoff.summary.acceptedDirectionCount === 0 && handoff.summary.executedDirectionCount === 0, 'no direction is accepted or executed');
check(handoff.directions.every((item) => item.direction.truth_state === 'HYPOTHESIS'), 'all current directions remain hypotheses');
check(handoff.directions.every((item) => item.direction.steward_status === 'PENDING' && item.direction.execution_status === 'NOT_STARTED'), 'all current directions remain pending and not started');
check(handoff.directions.every((item) => item.executionPlan.state === 'HOLD_FOR_EVIDENCE' && item.executionPlan.steps.length === 0), 'every current execution plan is a zero-step evidence hold');
check(handoff.directions.every((item) => item.evidencePlan.sharedGrowthClaimAllowed === false), 'no current direction opens a shared-growth claim');
check(handoff.directions.every((item) => item.evidencePlan.humanBenefit.verdict === 'NOT_RUN'), 'human-benefit evidence remains NOT_RUN throughout');
check(handoff.directions.every((item) => item.needDigest === Direction.sha256(feedback.candidateNeeds.find((need) => need.need_id === item.needId))), 'all current direction drafts bind exact need digests');
check(handoff.truth.automaticExecution === false && handoff.truth.automaticWrite === false && handoff.truth.automaticCanon === false, 'current handoff has no execution, write or CANON authority');

const readinessPayload = JSON.parse(JSON.stringify(readiness));
delete readinessPayload.receiptDigest;
check(readiness.receiptDigest === Direction.sha256(readinessPayload), 'current readiness receipt digest verifies');
check(readiness.state === 'TECHNICAL_DIRECTION_HANDOFF_READY_CURRENT_WORK_REMAINS_HELD', 'readiness distinguishes technical composition from starting work');
check(readiness.current.directionCount === 4 && readiness.current.waitDirectionCount === 4 && readiness.current.actionDirectionCount === 0, 'readiness reports exact current direction counts');
check(readiness.current.acceptedDirectionCount === 0 && readiness.current.executedDirectionCount === 0 && readiness.current.liveHumanOutcomes === 0, 'readiness reports zero acceptance, execution and LIVE human outcomes');
check(readiness.truth.aiWorkflowEvidencePreserved === true && readiness.truth.humanEvidenceStillRequiredForSharedGrowth === true, 'AI evidence is preserved without substituting for human evidence');
check(readiness.truth.automaticMerge === false && readiness.truth.foundationMutation === false && readiness.truth.modelWeightTrainingClaimed === false, 'readiness grants no merge, Foundation or model-training claim');

check(requirements.requirements.filter((item) => item.required).length === 3, 'capability requirements declare three required proof groups');
check(before.capabilities.some((item) => item.id === 'growth.feedback.packet.verify') && !before.capabilities.some((item) => item.id === 'growth.direction.gei-direction-compose'), 'before inventory preserves the source verifier but lacks the direction composer');
check(after.capabilities.some((item) => item.id === 'growth.direction.gei-direction-compose' && item.status === 'available'), 'after inventory declares the verified direction composer');
check(after.capabilities.some((item) => item.id === 'growth.human-evidence.live' && item.status === 'degraded'), 'after inventory keeps LIVE human evidence degraded');
check(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 9, 'independent before comparison reports BLOCKED with nine missing capabilities');
check(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'independent after comparison reports READY with no required capability missing');
check(gapAfter.requirements.find((item) => item.id === 'live-human-beneficiary-outcome').status === 'DEGRADED', 'optional LIVE human outcome remains explicitly degraded');

console.log('Current Grounded Growth direction handoff selftest passed: ' + checks + ' checks.');

