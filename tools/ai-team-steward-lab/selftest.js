#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const Service = require('../../shared/ai-team-steward/ai-team-steward-service');
const OperationRuntime = require('../../shared/ai-team-steward/operation-runtime');
const CapabilityGap = require('../../shared/ai-native-hands/capability-gap-hand');

const ROOT = path.resolve(__dirname, '..', '..');
const service = Service.create({ root: ROOT });
const catalog = service.catalog();

assert.equal(catalog.ok, true);
assert.equal(catalog.seedCount, 100);
assert.equal(catalog.familyCount, 10);
assert.equal(catalog.sourceUnitTestsPassed, 154);
assert.deepEqual(catalog.riskCounts, { LOW: 15, MEDIUM: 41, HIGH: 38, CRITICAL: 6 });
assert.equal(catalog.sourceRuntimeIntegrated, false);
assert.equal(catalog.canon, false);
assert.equal(new Set(catalog.entries.map(row => row.moduleId)).size, 100);
assert.equal(catalog.localRuntimeIntegration.ok, true);
assert.equal(catalog.localRuntimeIntegration.seedCoverage, 100);
assert.equal(catalog.localRuntimeIntegration.familyEvaluatorCount, 10);
assert.equal(catalog.localRuntimeIntegration.fixtureChecks, 200);
assert.equal(catalog.localRuntimeIntegration.validFixturesPassed, 100);
assert.equal(catalog.localRuntimeIntegration.unsafeFixturesHeld, 100);
assert.ok(catalog.entries.every(row => row.localIntegrationStatus === 'LOCAL_PREFLIGHT_AVAILABLE'));
assert.equal(catalog.localOperationRuntime.ok, true);
assert.equal(catalog.localOperationRuntime.operationCount, 58);
assert.equal(catalog.localOperationRuntime.localVectorCount, 111);

const runtimeStatus = service.runtimeStatus();
assert.equal(runtimeStatus.status, 'READY');
assert.equal(runtimeStatus.sideEffects, false);
assert.equal(runtimeStatus.liveAgentExecution, false);
const firstId = catalog.entries[0].moduleId;
const passingSample = service.sample({ moduleId: firstId, variant: 'valid' });
const passingResult = service.validate({ moduleId: firstId, fixture: passingSample.fixture });
assert.equal(passingResult.ok, true);
assert.equal(passingResult.status, 'PASS');
assert.equal(passingResult.truth.localContractPreflightExecuted, true);
assert.equal(passingResult.truth.liveAgentExecuted, false);
const heldSample = service.sample({ moduleId: firstId, variant: 'unsafe' });
const heldResult = service.validate({ moduleId: firstId, fixture: heldSample.fixture });
assert.equal(heldResult.ok, false);
assert.equal(heldResult.status, 'HOLD');
assert.deepEqual(heldResult.errorCodes, heldSample.expected.error_codes);
assert.ok(heldResult.findings.every(row => row.code && row.guidance));
assert.equal(JSON.stringify(heldResult).includes('not-a-real-token'), false);

const operations = service.operationCatalog();
assert.equal(operations.ok, true);
assert.equal(operations.operationCount, 58);
assert.equal(operations.authority, 'NONE');
assert.equal(operations.sideEffects, false);
assert.ok(operations.operations.every(row => row.sideEffects === false && row.authority === 'NONE'));
assert.ok(operations.operations.every(row => service.executeOperation({ operationId: row.id, input: row.examples.ready }).ok === true));
assert.ok(operations.operations.filter(row => row.examples.held).every(row => service.executeOperation({ operationId: row.id, input: row.examples.held }).ok === false));
const operationRuntime = OperationRuntime.create();
const parityCases = operationRuntime.parityCases();
const python = process.env.AXM_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const reference = childProcess.spawnSync(python, ['-B', path.join(ROOT, 'shared', 'ai-team-steward', 'operation-reference.py')], {
  input: JSON.stringify({ cases: parityCases }), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
});
if (reference.error) throw reference.error;
assert.equal(reference.status, 0, reference.stderr || reference.stdout);
const referenceResults = JSON.parse(reference.stdout).results;
assert.equal(referenceResults.length, 111);
parityCases.forEach((testCase, index) => {
  assert.deepEqual(operationRuntime.executeRaw(testCase.operation_id, testCase.input), referenceResults[index].result, `${testCase.operation_id} ${testCase.variant} source parity`);
});
const operationReady = service.executeOperation({ operationId: 'deadlock.detect', input: { wait_for: { a: ['b'], b: [] } } });
const operationHeld = service.executeOperation({ operationId: 'deadlock.detect', input: { wait_for: { a: ['b'], b: ['a'] } } });
assert.equal(operationReady.ok, true);
assert.equal(operationReady.result.has_cycle, false);
assert.equal(operationHeld.ok, false);
assert.equal(operationHeld.result.has_cycle, true);
assert.equal(operationHeld.sideEffects, false);
assert.equal(operationHeld.authority, 'NONE');
const intakeHeld = service.executeOperation({ operationId: 'intake.evaluate', input: operations.operations.find(row => row.id === 'intake.evaluate').examples.held });
const serviceHeld = service.executeOperation({ operationId: 'observability.evaluate-service', input: operations.operations.find(row => row.id === 'observability.evaluate-service').examples.held });
assert.equal(intakeHeld.ok, false);
assert.equal(intakeHeld.result.status, 'HELD_FOR_INTAKE');
assert.equal(serviceHeld.ok, false);
assert.equal(serviceHeld.result.accepted, false);
assert.throws(() => service.executeOperation({ operationId: 'not-real', input: {} }), /Unknown AI Team steward operation/);

const plan = service.plan({ goals: ['handoff receipt timeout privacy'], riskCeiling: 'HIGH', maxRecommendations: 12 });
assert.equal(plan.ok, true);
assert.equal(plan.status, 'REVIEW_ONLY');
assert.equal(plan.authority, 'NONE');
assert.equal(plan.canon, false);
assert.equal(plan.automaticExecution, false);
assert.ok(plan.recommendations.length > 0 && plan.recommendations.length <= 12);
assert.ok(plan.recommendations.every(row => row.riskTier !== 'CRITICAL'));
assert.ok(plan.recommendations.some(row => /handoff|receipt|privacy/i.test([row.name,row.moduleId,row.capabilityFocus,row.holdRule].join(' '))));

const criticalId = catalog.entries.find(row => row.riskTier === 'CRITICAL').moduleId;
const explicit = service.plan({ moduleIds: [criticalId], riskCeiling: 'CRITICAL', maxRecommendations: 1 });
assert.equal(explicit.recommendations[0].moduleId, criticalId);
assert.equal(service.plan({ goals: [], riskCeiling: 'CRITICAL' }).recommendations.length, 0);

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const sourceRoot = path.join(ROOT, 'shared', 'ai-team-steward', 'source-intake-v1');
const gapReport = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'CAPABILITY_GAP_REPORT.json'), 'utf8'));
const capabilityRequirements = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'CAPABILITY_REQUIREMENTS.json'), 'utf8'));
const capabilityInventory = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'CAPABILITY_INVENTORY.json'), 'utf8'));
const freshGapReport = CapabilityGap.compare(capabilityRequirements.requirements, capabilityInventory.capabilities);
assert.ok(html.includes('href="#main"') && html.includes('aria-live="polite"') && html.includes('<fieldset>') && html.includes('<legend>'));
assert.ok(html.includes('/tools/ai-team/index.html') && html.includes('Nothing here starts an agent'));
assert.ok(html.includes('id="preflightModule"') && html.includes('id="preflightInput"') && html.includes('Run local preflight'));
assert.ok(html.includes('id="operationSelect"') && html.includes('id="operationInput"') && html.includes('Run local operation'));
assert.ok(app.includes('/api/ai-team-steward/catalog') && app.includes('/api/ai-team-steward/plan') && app.includes('/api/ai-team-steward/sample') && app.includes('/api/ai-team-steward/validate') && app.includes('/api/ai-team-steward/operations') && app.includes('/api/ai-team-steward/execute'));
assert.ok(app.includes("document.createElement('optgroup')"));
assert.ok(css.includes('prefers-reduced-motion') && css.includes('@media(max-width:620px)'));
assert.ok(server.includes('/api/ai-team-steward/catalog') && server.includes('/api/ai-team-steward/plan') && server.includes('/api/ai-team-steward/runtime-status') && server.includes('/api/ai-team-steward/sample') && server.includes('/api/ai-team-steward/validate') && server.includes('/api/ai-team-steward/operations') && server.includes('/api/ai-team-steward/execute'));
assert.ok(pkg.scripts['test:ai-team-steward'] && pkg.scripts['test:ai-team-steward:source']);
assert.equal(gapReport.requirements.find(row => row.id === 'use-retained-intake-locally').status, 'READY');
assert.equal(gapReport.requirements.find(row => row.id === 'preserve-human-authority-and-private-values').status, 'READY');
assert.equal(gapReport.requirements.find(row => row.id === 'execute-live-provider-backed-team').required, false);
assert.equal(freshGapReport.overall, gapReport.overall);
assert.deepEqual(freshGapReport.requirements.map(row => ({ id: row.id, status: row.status, available: row.available, unknown: row.unknown, missing: row.missing })), gapReport.requirements.map(row => ({ id: row.id, status: row.status, available: row.available, unknown: row.unknown, missing: row.missing })));

console.log('AI Team Steward Lab selftest: PASS (100 seed contracts, 10 families, 200 preflight fixtures, 58 operations, 111 source-parity vectors, bounded review planning)');
