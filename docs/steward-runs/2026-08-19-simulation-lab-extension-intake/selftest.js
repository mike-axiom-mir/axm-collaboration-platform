#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Intake = require('../../../shared/simulation-lab-extension-intake/simulation-lab-extension-intake');

let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log('PASS ' + label);
}
function read(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

const hostProfile = read('CURRENT_SIMULATION_LAB_HOST_PROFILE.json');
const example = read('PLATFORM_EXTENSION_EXAMPLE.json');
const readiness = read('CURRENT_EXTENSION_INTAKE_READINESS.json');
const requirements = read('CAPABILITY_REQUIREMENTS.json');
const before = read('CAPABILITY_INVENTORY_BEFORE.json');
const after = read('CAPABILITY_INVENTORY_AFTER.json');
const gapBefore = read('CAPABILITY_GAP_BEFORE.json');
const gapAfter = read('CAPABILITY_GAP_AFTER.json');
const brief = fs.readFileSync(path.join(__dirname, 'PLATFORM_BRANCH_BUILD_BRIEF.md'), 'utf8');

check(Intake.verifyHostProfile(hostProfile).pass, 'exact current host profile verifies natively');
check(hostProfile.roots.length === 3, 'host profile binds exactly three protected roots');
check(hostProfile.roots.every((root) => root.status === 'TEST'), 'all protected roots retain TEST status');
check(hostProfile.roots.every((root) => root.contract.permissions.length === 0), 'all protected roots retain zero permissions');
check(hostProfile.invariantTruthRules.length === 5, 'host profile preserves five explicit invariant truth rules');
check(Object.values(hostProfile.authority).every((value) => Array.isArray(value) ? value.length === 0 : value === false), 'host profile grants no execution or lifecycle authority');

const normalizedExample = Intake.normalizeExtensionDeclaration(example);
check(Intake.stableStringify(normalizedExample) === Intake.stableStringify(example), 'Platform example is a native normalized extension declaration');
check(example.subjectKinds.length === 3 && example.mappings.length === 3, 'example covers software, Mirror and specialist translation shapes');
check(!hostProfile.roots.some((root) => root.moduleId === example.candidate.moduleId), 'example candidate identity is distinct from protected roots');
check(example.hostProfileDigest === hostProfile.profileDigest, 'example binds the exact current host profile');
check(example.mappings.every((mapping) => hostProfile.roots.find((root) => root.moduleId === mapping.hostModuleId).contract.provides.includes(mapping.hostCapability)), 'every example mapping targets a provided host capability');
check(example.mappings.every((mapping) => mapping.unsupportedFieldPolicy === 'DIGEST_BOUND_REFERENCE' && mapping.nativeSchemaIdentityClaimed === false), 'example preserves unsupported fields without claiming native identity');
check(Object.values(example.boundaries).every((value) => Array.isArray(value) ? value.length === 0 : value === false), 'example requests no boundary expansion');

const readinessPayload = JSON.parse(JSON.stringify(readiness));
delete readinessPayload.receiptDigest;
check(readiness.receiptDigest === Intake.sha256(readinessPayload), 'current readiness digest verifies');
check(readiness.state === 'INTAKE_READY_AWAITING_EXPERIMENTAL_BRANCH', 'readiness separates intake capability from candidate arrival');
check(readiness.current.protectedRootCount === 3 && readiness.current.supportedSubjectKindCount === 3, 'readiness reports three roots and three supported subject kinds');
check(readiness.current.candidatePackageCount === 0 && readiness.current.assessmentCount === 0, 'readiness records zero candidate packages and assessments');
check(readiness.current.evaluationPlanCount === 0 && readiness.current.evaluationCount === 0 && readiness.current.liveHumanOutcomes === 0, 'readiness records zero plans, evaluations and live human outcomes');
check(readiness.truth.extensionIntakeReady === true && readiness.truth.candidatePackagePresent === false && readiness.truth.runtimeEvaluated === false, 'readiness does not turn static intake into candidate or runtime proof');
check(readiness.truth.humanBenefitEstablished === false && readiness.truth.sharedGrowthClaimed === false && readiness.truth.modelWeightTrainingClaimed === false, 'readiness claims no human benefit, shared growth or model training');
check(readiness.truth.candidateCodeExecuted === false && readiness.truth.automaticInstall === false && readiness.truth.automaticMerge === false && readiness.truth.automaticCanon === false, 'readiness grants no execution, install, merge or CANON authority');
check(readiness.currentBestAction === 'WAIT_FOR_EXPLICIT_CANDIDATE', 'current best action is to wait for an explicit candidate');
check(readiness.bindings.hostProfileDigest === hostProfile.profileDigest && readiness.bindings.exampleDeclarationDigest === Intake.sha256(example), 'readiness binds the exact host and example declaration');

check(requirements.requirements.filter((item) => item.required).length === 4, 'capability requirements declare four required proof groups');
check(!before.capabilities.some((item) => item.id === 'simulation.extension.subject-mapping-verify'), 'before inventory lacks specialized subject mapping verification');
check(after.capabilities.some((item) => item.id === 'simulation.extension.subject-mapping-verify' && item.status === 'available'), 'after inventory contains specialized subject mapping verification');
check(after.capabilities.some((item) => item.id === 'simulation.extension.adoption.none' && item.status === 'available'), 'after inventory contains the no-adoption boundary');
check(after.capabilities.some((item) => item.id === 'simulation.extension.candidate-package.received' && item.status === 'degraded'), 'after inventory keeps candidate receipt degraded');
check(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 10, 'independent before comparison reports BLOCKED with ten missing capabilities');
check(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'independent after comparison reports READY with no required capability missing');
check(gapAfter.requirements.find((item) => item.id === 'experimental-candidate-received').status === 'DEGRADED', 'optional candidate receipt remains explicitly degraded');
check(gapAfter.requirements.find((item) => item.id === 'candidate-runtime-evidence').status === 'DEGRADED', 'optional candidate runtime evidence remains explicitly degraded');

const names = fs.readdirSync(__dirname);
check(!names.some((name) => /CANDIDATE.*(PACKAGE|ASSESSMENT)|CURRENT_EXTENSION_(PACKAGE|ASSESSMENT)/.test(name)), 'audit persists no candidate package or assessment');
check(brief.includes(hostProfile.profileDigest), 'Platform brief carries the exact current host profile digest');
check(brief.includes('Do not build a replacement baseline root') && brief.includes('EXPERIMENTAL'), 'Platform brief requires a non-replacing EXPERIMENTAL extension');

console.log('Current simulation-lab extension intake readiness selftest passed: ' + checks + ' checks.');

