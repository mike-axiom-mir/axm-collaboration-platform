'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const ReadinessHands = require('../organs/reasoning-readiness-hand-organ');
const Affordances = require('../organs/reasoning-readiness-probe-affordance-organ');
const ProviderHands = require('../organs/provider-declaration-hand-organ');
const ResearchExams = require('../organs/provider-declaration-research-exam-organ');
const ArchitectureSurveys = require('../organs/provider-declaration-architecture-survey-organ');
const ImplementationEvidence = require('../organs/provider-declaration-implementation-evidence-survey-organ');
const BindingCell = require('../kernel/provider-binding-experiment-cell');
const Planner = require('../organs/provider-declaration-binding-experiment-planner-organ');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function writeSource(file, source) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}

function writeModule(workshopRoot, id, emits, accepts, consumes = []) {
  const directory = path.join(workshopRoot, 'tools', id);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html>fixture\n');
  writeJson(path.join(directory, 'module.contract.json'), { schema: 'axm.module-contract/v1', id, version: '1.0.0', provides: [], consumes, permissions: [], handoffs: { emits, accepts }, boundaries: { writes: [], refuses: ['automatic-world-action'] } });
  writeJson(path.join(directory, 'manifest.json'), { schema: 'axm.tool-manifest/v1', id, version: '1.0.0', status: 'TEST', entry: 'index.html', uses: [], permissions: [], contract: 'module.contract.json' });
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-provider-binding-experiment-'));
  const root = path.join(base, 'mirror');
  const workshopRoot = path.join(base, 'workshop');
  fs.mkdirSync(root, { recursive: true });
  writeModule(workshopRoot, 'alpha', ['axm.test/x-v1'], []);
  writeModule(workshopRoot, 'beta', ['axm.test/y-v1'], ['axm.test/x-v1'], ['service:consumer-gap/provider-v1', 'service:exact-service']);
  writeModule(workshopRoot, 'gamma', [], ['axm.test/y-v1']);
  writeJson(path.join(workshopRoot, 'shared', 'exact-service', 'service.contract.json'), { schema: 'axm.shared-service-contract/v1', id: 'exact-service', version: '1.0.0', status: 'TEST', provides: [], accepts: [], produces: [], boundaries: { automaticWrites: [], refuses: [] } });
  writeJson(path.join(workshopRoot, 'shared', 'engines', 'engine-contract.json'), { schema: 'axm.shared-engine-contract/v1', version: '1.1.0', engines: [{ id: 'renderer-physics', apis: ['Physics'] }] });
  const sentinel = path.join(base, 'source-executed.txt');
  writeSource(path.join(workshopRoot, 'shared', 'candidate', 'adapter.js'), "'use strict';\nconst ID='provider-v1';\nfunction register(registry){ registry.register(ID); }\nmodule.exports={ID,register};\n");
  writeSource(path.join(workshopRoot, 'shared', 'candidate', 'alternate.js'), "'use strict';\nmodule.exports={selector:'provider-v1'};\n");
  writeSource(path.join(workshopRoot, 'shared', 'candidate', 'selftest.js'), "'use strict';\nconst assert=require('assert');\nassert.equal('provider-v1','provider-v1');\n");
  writeSource(path.join(workshopRoot, 'shared', 'candidate', 'danger.js'), `const selector='provider-v1';\nrequire('fs').writeFileSync(${JSON.stringify(sentinel)},'executed');\n`);
  writeSource(path.join(workshopRoot, 'shared', 'candidate', 'comment-only.js'), "// 'provider-v1' is commentary only\nmodule.exports={};\n");
  const handoff = HandoffGraph.derive({ root, workshopRoot, stateDir: path.join(root, 'state', 'handoffs') });
  const snapshot = {
    schema: 'axm.technical-glasses/v1', ok: true, compiledAt: '2026-07-18T18:00:00.000Z', freshness: { fingerprint: '3'.repeat(64) },
    modules: handoff.batch.contracts.map(item => ({
      id: item.moduleId,
      evidence: { manifest: item.manifestRelativePath, contract: item.contractRelativePath, contractDeclared: true, contractPass: true },
      readiness: item.moduleId === 'beta'
        ? [{ id: 'consumer-gap', state: 'UNKNOWN', detail: 'No live readiness source declared' }, { id: 'exact-service', state: 'UNKNOWN', detail: 'No live readiness source declared' }]
        : [{ id: 'base', state: 'READY', detail: 'Fixture ready.' }]
    }))
  };
  const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot, stateDir: path.join(root, 'state', 'readiness') });
  const hands = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness, stateDir: path.join(root, 'state', 'hands') });
  const affordances = Affordances.derive({ root, workshopRoot, handDerived: hands, stateDir: path.join(root, 'state', 'affordances') });
  const providerHands = ProviderHands.derive({ root, workshopRoot, affordanceDerived: affordances, stateDir: path.join(root, 'state', 'provider-hands') });
  const research = ResearchExams.derive({ root, workshopRoot, providerDerived: providerHands, stateDir: path.join(root, 'state', 'research') });
  const architecture = ArchitectureSurveys.derive({ root, workshopRoot, researchDerived: research, stateDir: path.join(root, 'state', 'architecture') });
  const implementationStateDir = path.join(root, 'state', 'implementation-evidence');
  const implementation = ImplementationEvidence.derive({ root, workshopRoot, architectureDerived: architecture, stateDir: implementationStateDir });
  const plannerStateDir = path.join(root, 'state', 'binding-experiments');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, architecture, implementation, implementationStateDir, plannerStateDir, sentinel };
}

function sourceResult(implementation, requirementId = 'consumer-gap') {
  return implementation.batch.results.find(item => item.requirementId === requirementId);
}

function researchResult(implementation, requirementId = 'consumer-gap') {
  return implementation.architectureDerived.researchDerived.batch.results.find(item => item.handRequest.requirementId === requirementId);
}

test('binding experiment cell makes a complete order-invariant matrix without selecting, executing, or copying permissions', t => {
  const fx = fixture(t);
  const source = sourceResult(fx.implementation);
  const research = researchResult(fx.implementation);
  const input = { requirementId: source.requirementId, evidenceSurvey: source.evidenceSurvey, architectureSurvey: source.sourceArchitectureSurvey, researchExamRequest: research.researchExamRequest };
  const matrix = BindingCell.evaluate(input);
  assert.equal(BindingCell.verify(matrix), true);
  assert.equal(matrix.candidateSources.length, 2);
  assert.equal(matrix.validationWitnesses.length, 2);
  assert.equal(matrix.hypothesesRepresented.length, 3);
  assert.equal(matrix.experimentFrames.length, 6);
  assert.deepEqual(matrix.candidateSources.map(item => item.document.relativePath), ['shared/candidate/adapter.js', 'shared/candidate/alternate.js']);
  assert.deepEqual(matrix.validationWitnesses.map(item => item.role).sort(), ['INDEPENDENT_TEST_WITNESS_NOT_IMPLEMENTATION_CANDIDATE', 'VALIDATION_ONLY_NOT_EXPORTED']);
  assert.equal(matrix.selectedFrameId, null);
  assert.equal(matrix.providerIdentityInferred, false);
  assert.equal(matrix.permissionsInferred, false);
  assert.equal(matrix.sourceExecuted, false);
  assert.ok(matrix.experimentFrames.every(frame => frame.candidateInputs.providerIdentity === 'UNRESOLVED_NOT_INFERRED' && frame.candidateInputs.providerPermissions === null));
  assert.ok(matrix.experimentFrames.every(frame => frame.independentExam.candidateMayAuthorExpectedOutcomes === false && frame.independentExam.candidateMayAuthorHeldOutFixtures === false));
  assert.ok(Object.values(matrix.authority).every(value => value === false));
  assert.equal(fs.existsSync(fx.sentinel), false);

  const reordered = JSON.parse(JSON.stringify(input));
  reordered.evidenceSurvey.selectorSources.reverse();
  reordered.researchExamRequest.architectureHypotheses.reverse();
  assert.deepEqual(BindingCell.evaluate(reordered), matrix);
  const tampered = JSON.parse(JSON.stringify(matrix));
  tampered.experimentFrames.pop();
  tampered.matrixDigest = BindingCell.digest(Object.assign({}, tampered, { matrixDigest: null }));
  assert.throws(() => BindingCell.verify(tampered), /complete balanced cross-product/);
});

test('planner preserves matrices and holds through deterministic Reasoning Foundation discrimination', t => {
  const fx = fixture(t);
  const derived = Planner.derive({ root: fx.root, workshopRoot: fx.workshopRoot, implementationDerived: fx.implementation, stateDir: fx.plannerStateDir });
  assert.equal(derived.batch.summary.implementationEvidenceResultsEvaluated, 2);
  assert.equal(derived.batch.summary.experimentMatricesProposed, 1);
  assert.equal(derived.batch.summary.noImplementationEvidenceHolds, 1);
  assert.equal(derived.batch.summary.candidateSourceWitnesses, 2);
  assert.equal(derived.batch.summary.validationOnlyWitnesses, 2);
  assert.equal(derived.batch.summary.architectureHypothesesRepresented, 3);
  assert.equal(derived.batch.summary.experimentFramesProposed, 6);
  assert.equal(derived.batch.summary.reasoningDecisionsMatched, 2);
  assert.equal(derived.batch.summary.frameSelectionsRejected, 2);
  assert.equal(derived.batch.summary.permissionCopiesRejected, 2);
  assert.equal(derived.batch.summary.framesSelected, 0);
  assert.equal(derived.batch.summary.permissionsInferred, 0);
  assert.equal(derived.batch.summary.sourcesExecuted, 0);
  assert.equal(derived.batch.summary.providerCandidatesBuilt, 0);
  assert.equal(derived.batch.summary.worldActionsExecuted, 0);
  assert.equal(fs.existsSync(fx.sentinel), false);
  assert.equal(Planner.verifyBatch(derived.batch, derived.runDir, fx.implementation, fx.workshopRoot), true);
  const response = Planner.respond(derived, { schema: Planner.REQUEST_SCHEMA, requirementId: 'consumer-gap' });
  assert.equal(response.state, 'PROPOSED_PROVIDER_BINDING_EXPERIMENT_MATRICES_NOT_SELECTED');
  assert.equal(response.matrices.length, 1);
  assert.equal(response.matrices[0].experimentFrames.length, 6);
  assert.equal(response.selectedFrameId, null);
  assert.equal(response.permissionsInferred, false);
  assert.equal(response.sourceExecuted, false);
  const held = Planner.respond(derived, { schema: Planner.REQUEST_SCHEMA, requirementId: 'exact-service' });
  assert.equal(held.state, 'HOLD_NO_IMPLEMENTATION_EVIDENCE_SURVEY_TO_FRAME');
  const absent = Planner.respond(derived, { schema: Planner.REQUEST_SCHEMA, requirementId: 'unknown' });
  assert.equal(absent.state, 'HOLD_UNKNOWN_PROVIDER_IMPLEMENTATION_EVIDENCE_RESULT');
});

test('later eligible evidence creates a new immutable matrix batch while the old batch remains and tampering is refused', t => {
  const fx = fixture(t);
  const first = Planner.derive({ root: fx.root, workshopRoot: fx.workshopRoot, implementationDerived: fx.implementation, stateDir: fx.plannerStateDir });
  writeSource(path.join(fx.workshopRoot, 'shared', 'candidate', 'later.js'), "module.exports={selector:'provider-v1'};\n");
  const implementation = ImplementationEvidence.derive({ root: fx.root, workshopRoot: fx.workshopRoot, architectureDerived: fx.architecture, stateDir: fx.implementationStateDir });
  const next = Planner.derive({ root: fx.root, workshopRoot: fx.workshopRoot, implementationDerived: implementation, stateDir: fx.plannerStateDir });
  assert.notEqual(next.batch.batchId, first.batch.batchId);
  assert.ok(fs.existsSync(path.join(first.runDir, 'batch.json')));
  assert.equal(next.batch.summary.candidateSourceWitnesses, 3);
  assert.equal(next.batch.summary.experimentFramesProposed, 9);
  assert.equal(next.batch.summary.framesSelected, 0);
  assert.equal(next.batch.summary.sourcesExecuted, 0);
  assert.equal(fs.existsSync(fx.sentinel), false);
  const tampered = JSON.parse(JSON.stringify(next.batch));
  tampered.summary.framesSelected = 1;
  assert.throws(() => Planner.verifyBatch(tampered), /digest/);
  const result = next.batch.results[0];
  fs.appendFileSync(path.join(next.runDir, result.sessionFile), ' ');
  assert.throws(() => Planner.derive({ root: fx.root, workshopRoot: fx.workshopRoot, implementationDerived: implementation, stateDir: fx.plannerStateDir }), /session hash mismatch/);
});
