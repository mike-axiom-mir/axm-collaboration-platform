#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Direction = require('../../../shared/grounded-growth-direction-handoff/grounded-growth-direction-handoff');
const Lab = require('../../../shared/grounded-growth-challenger-lab/grounded-growth-challenger-lab');
const build = require('./build-current-challenger-readiness');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}
function read(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

const directionHandoff = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json'), 'utf8'));
const readiness = read('CURRENT_CHALLENGER_READINESS.json');
const requirements = read('CAPABILITY_REQUIREMENTS.json');
const before = read('CAPABILITY_INVENTORY_BEFORE.json');
const after = read('CAPABILITY_INVENTORY_AFTER.json');
const gapBefore = read('CAPABILITY_GAP_BEFORE.json');
const gapAfter = read('CAPABILITY_GAP_AFTER.json');

check(Direction.verifyHandoff(directionHandoff).pass, 'exact current direction handoff verifies natively');
check(directionHandoff.directions.length === 4, 'current handoff contains four directions');
check(directionHandoff.directions.every((item) => item.direction.action_type === 'WAIT_FOR_EVIDENCE'), 'all exact current directions remain WAIT_FOR_EVIDENCE');
check(directionHandoff.directions.every((item) => item.executionPlan.steps.length === 0), 'all exact current directions retain zero-step execution plans');
check(directionHandoff.summary.acceptedDirectionCount === 0 && directionHandoff.summary.executedDirectionCount === 0, 'current directions remain unaccepted and unexecuted');

const payload = JSON.parse(JSON.stringify(readiness));
delete payload.receiptDigest;
check(readiness.receiptDigest === Lab.sha256(payload), 'current challenger readiness digest verifies');
check(readiness.schema === Lab.READINESS_SCHEMA && Lab.verifyReadiness(readiness, build.readinessInput).pass, 'current challenger readiness verifies by exact native rebuild');
check(readiness.state === 'LAB_CAPABILITY_READY_CURRENT_DIRECTIONS_HELD', 'readiness separates lab capability from current experiment need');
check(readiness.current.directionCount === 4 && readiness.current.waitDirectionCount === 4 && readiness.current.actionableDirectionCount === 0, 'readiness reports four waits and zero actionable directions');
check(readiness.current.challengerPlanCount === 0 && readiness.current.challengerEvaluationCount === 0, 'readiness records zero current plans and evaluations');
check(readiness.current.acceptedDirectionCount === 0 && readiness.current.executedDirectionCount === 0 && readiness.current.liveHumanOutcomes === 0, 'readiness records zero acceptance, execution and LIVE human outcomes');
check(readiness.sourceRefs.shadowContract && readiness.sourceRefs.diagnosticContract, 'readiness binds both exact EXPERIMENTAL organ contracts');
check(readiness.plans.length === 0 && readiness.evaluations.length === 0, 'readiness exact inputs contain no plan or evaluation');
check(readiness.truth.currentBestAction === 'WAIT_FOR_EVIDENCE' && readiness.truth.currentExperimentAutomaticallyRequired === false, 'current best action remains restraint');
check(readiness.truth.canonicalStateTouched === false && readiness.truth.directionAccepted === false, 'current readiness touches no canonical state and accepts no direction');
check(readiness.truth.humanBenefitEstablished === false && readiness.truth.sharedGrowthClaimed === false, 'current readiness claims neither human benefit nor shared growth');
check(readiness.truth.broadLearningClaimed === false && readiness.truth.modelWeightTrainingClaimed === false, 'current readiness claims neither broad learning nor model-weight training');
check(readiness.truth.automaticExecution === false && readiness.truth.automaticMerge === false && readiness.truth.automaticCanon === false, 'current readiness grants no execution, merge or CANON authority');

check(requirements.requirements.filter((item) => item.required).length === 4, 'capability requirements declare four required proof groups');
check(before.capabilities.some((item) => item.id === 'simulation.shadow.clone-patch' && item.status === 'degraded'), 'before inventory preserves the EXPERIMENTAL Shadow capability as degraded');
check(before.capabilities.some((item) => item.id === 'evaluation.diagnostic.shadow-run' && item.status === 'degraded'), 'before inventory preserves the EXPERIMENTAL Diagnostic capability as degraded');
check(!before.capabilities.some((item) => item.id === 'growth.challenger.regression-hold'), 'before inventory lacks the challenger regression adjudicator');
check(after.capabilities.some((item) => item.id === 'growth.challenger.regression-hold' && item.status === 'available'), 'after inventory includes the verified challenger regression hold');
check(after.capabilities.some((item) => item.id === 'growth.challenger.adoption.none' && item.status === 'available'), 'after inventory includes the no-adoption boundary');
check(after.capabilities.some((item) => item.id === 'growth.human-evidence.live' && item.status === 'degraded'), 'after inventory keeps LIVE human evidence degraded');
check(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 11, 'independent before comparison reports BLOCKED with eleven missing capabilities');
check(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'independent after comparison reports READY with no required capability missing');
check(gapAfter.requirements.find((item) => item.id === 'live-human-beneficiary-outcome').status === 'DEGRADED', 'optional LIVE human outcome remains explicitly degraded');

const artifactNames = fs.readdirSync(__dirname);
check(!artifactNames.some((name) => /CURRENT_CHALLENGER_(PLAN|EVALUATION)/.test(name)), 'audit persists no current challenger plan or evaluation');

console.log('Current Grounded Growth challenger readiness selftest passed: ' + checks + ' checks.');
