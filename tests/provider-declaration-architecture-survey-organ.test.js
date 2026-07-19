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
const PatternCell = require('../kernel/provider-declaration-architecture-pattern-cell');
const Survey = require('../organs/provider-declaration-architecture-survey-organ');

function contract(id, emits, accepts, consumes = []) {
  return { schema: 'axm.module-contract/v1', id, version: '1.0.0', provides: [], consumes, permissions: [], handoffs: { emits, accepts }, boundaries: { writes: [], refuses: ['automatic-world-action'] } };
}

function writeModule(workshopRoot, definition) {
  const directory = path.join(workshopRoot, 'tools', definition.id);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html>fixture\n');
  fs.writeFileSync(path.join(directory, 'module.contract.json'), JSON.stringify(contract(definition.id, definition.emits || [], definition.accepts || [], definition.consumes || []), null, 2) + '\n');
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schema: 'axm.tool-manifest/v1', id: definition.id, version: '1.0.0', status: 'TEST', entry: 'index.html', uses: [], permissions: [], contract: 'module.contract.json' }, null, 2) + '\n');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function writeService(workshopRoot, directory, id) {
  writeJson(path.join(workshopRoot, 'shared', directory, 'service.contract.json'), { schema: 'axm.shared-service-contract/v1', id, version: '1.0.0', status: 'TEST', provides: [], accepts: [], produces: [], boundaries: { automaticWrites: [], refuses: [] } });
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-provider-declaration-architecture-survey-'));
  const root = path.join(base, 'mirror');
  const workshopRoot = path.join(base, 'workshop');
  fs.mkdirSync(root, { recursive: true });
  writeModule(workshopRoot, { id: 'alpha', emits: ['axm.test/x-v1'] });
  writeModule(workshopRoot, { id: 'beta', emits: ['axm.test/y-v1'], accepts: ['axm.test/x-v1'], consumes: ['service:consumer-gap/provider-v1', 'service:bare-consumer-gap'] });
  writeModule(workshopRoot, { id: 'gamma', accepts: ['axm.test/y-v1'] });
  writeService(workshopRoot, 'exact-service', 'exact-service');
  writeService(workshopRoot, 'ambiguous-a', 'ambiguous-service');
  writeService(workshopRoot, 'ambiguous-b', 'ambiguous-service');
  writeJson(path.join(workshopRoot, 'shared', 'engines', 'engine-contract.json'), {
    schema: 'axm.shared-engine-contract/v1', version: '1.1.0', engines: [{ id: 'renderer-physics', apis: ['Renderer', 'Physics'], owns: [], doesNotOwn: ['undeclared-physics'] }]
  });
  writeJson(path.join(workshopRoot, 'shared', 'mirror-core', 'AXM_INTEGRATION.json'), {
    schema: 'axm.foundation-service-integration/v1', service_id: 'mirror-core', name: 'Mirror Core', version: '0.1.0', status: 'FOUNDATION_CANDIDATE', placement: 'shared/mirror-core', authority: { live_workshop_apply: false }, boundaries: ['No automatic apply.']
  });
  const handoff = HandoffGraph.derive({ root, workshopRoot, stateDir: path.join(root, 'state', 'handoffs') });
  const requirements = ['consumer-gap', 'bare-consumer-gap', 'no-demand', 'exact-service', 'ambiguous-service'].map(id => ({ id, state: 'UNKNOWN', detail: 'No live readiness source declared' }));
  const snapshot = {
    schema: 'axm.technical-glasses/v1', ok: true, compiledAt: '2026-07-18T18:00:00.000Z', freshness: { fingerprint: '1'.repeat(64) },
    modules: handoff.batch.contracts.map(item => ({
      id: item.moduleId,
      evidence: { manifest: item.manifestRelativePath, contract: item.contractRelativePath, contractDeclared: true, contractPass: true },
      readiness: item.moduleId === 'beta' ? requirements : [{ id: 'base', state: 'READY', detail: 'Fixture ready.' }]
    }))
  };
  const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot, stateDir: path.join(root, 'state', 'readiness') });
  const hands = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness, stateDir: path.join(root, 'state', 'hands') });
  const affordances = Affordances.derive({ root, workshopRoot, handDerived: hands, stateDir: path.join(root, 'state', 'affordances') });
  const providerHands = ProviderHands.derive({ root, workshopRoot, affordanceDerived: affordances, stateDir: path.join(root, 'state', 'provider-hands') });
  const research = ResearchExams.derive({ root, workshopRoot, providerDerived: providerHands, stateDir: path.join(root, 'state', 'research-exams') });
  const stateDir = path.join(root, 'state', 'architecture-surveys');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, research, stateDir };
}

function patternInput(document, overrides = {}) {
  const content = Buffer.from(typeof document === 'string' ? document : JSON.stringify(document), 'utf8');
  return Object.assign({
    relativePath: 'shared/pattern.json', content, contentSha256: PatternCell.digest(content), symbolic: false, insideRoot: true,
    requirementId: 'consumer-gap', demandedSelectors: ['provider-v1'],
    hypothesisRequirements: {
      REUSE_TYPED_SHARED_SERVICE_DECLARATION: ['OUTER_REQUIREMENT_BINDING', 'PROVIDER_IDENTITY_BINDING', 'SELECTOR_COVERAGE', 'IMPLEMENTATION_CONTENT_BINDING', 'PERMISSION_DECLARATION'],
      EXTEND_TYPED_ENGINE_OR_REGISTRY_DECLARATION: ['OUTER_REQUIREMENT_BINDING', 'UNIQUE_REGISTRY_MEMBERSHIP', 'SELECTOR_COVERAGE', 'IMPLEMENTATION_CONTENT_BINDING', 'AMBIGUITY_REFUSAL'],
      NEW_TYPED_PROVIDER_DECLARATION: ['SCHEMA_VERSION', 'OUTER_REQUIREMENT_BINDING', 'PROVIDER_IDENTITY_BINDING', 'SELECTOR_COVERAGE', 'IMPLEMENTATION_CONTENT_BINDING', 'BOUNDARY_AND_PERMISSION_DECLARATIONS']
    }
  }, overrides);
}

test('pattern cell preserves partial sources independently and recognizes only one-document complete witnesses', () => {
  const shared = PatternCell.evaluate(patternInput({ schema: 'axm.shared-service-contract/v1', id: 'another-service', version: '1.0.0', provides: ['provider-v1'], boundaries: {} }));
  assert.equal(shared.classification, 'SHARED_SERVICE_DECLARATION_PATTERN');
  assert.equal(shared.state, 'RELEVANT_PATTERN_NO_CURRENT_REQUIREMENT_WITNESS');
  assert.equal(shared.completeCurrentRelationWitness, false);
  assert.ok(shared.missing.includes('OUTER_REQUIREMENT_BINDING'));
  assert.ok(shared.missing.includes('IMPLEMENTATION_CONTENT_BINDING'));

  const partial = PatternCell.evaluate(patternInput({ schema: 'axm.foundation-service-integration/v1', service_id: 'consumer-gap', version: '1.0.0', provides: ['provider-v1'], placement: 'shared/consumer-gap', authority: {} }));
  assert.equal(partial.classification, 'TYPED_SERVICE_INTEGRATION_PATTERN');
  assert.equal(partial.state, 'PARTIAL_CURRENT_RELATION_WITNESS');
  assert.equal(partial.currentRelations.IMPLEMENTATION_CONTENT_BINDING, false);
  assert.equal(partial.currentRelations.BOUNDARY_AND_PERMISSION_DECLARATIONS, false);

  const complete = PatternCell.evaluate(patternInput({
    schema: 'axm.foundation-service-integration/v1', service_id: 'consumer-gap', version: '1.0.0', provides: ['provider-v1'],
    implementation: { path: 'shared/consumer-gap/index.js', sha256: 'a'.repeat(64) }, permissions: ['files:read'], boundaries: { refuses: [] }
  }));
  assert.equal(complete.state, 'COMPLETE_CURRENT_RELATION_WITNESS_NOT_ARCHITECTURE_EVALUATED');
  assert.equal(complete.completeCurrentRelationWitness, true);
  assert.deepEqual(complete.missing, []);
  assert.ok(Object.values(complete.authority).every(value => value === false));

  const malformed = PatternCell.evaluate(patternInput('{bad json'));
  assert.equal(malformed.classification, 'MALFORMED_DOCUMENT');
  assert.equal(malformed.state, 'DOCUMENT_REFUSED');
  const symbolic = PatternCell.evaluate(patternInput('{}', { symbolic: true }));
  assert.equal(symbolic.classification, 'BOUNDARY_REFUSED_DOCUMENT');
  assert.equal(symbolic.state, 'DOCUMENT_REFUSED');
  assert.throws(() => PatternCell.evaluate(Object.assign(patternInput('{}'), { selectArchitecture: true })), /unknown critical/);
});

test('survey measures current pattern families without provider inference, cross-document merge, or architecture selection', t => {
  const fx = fixture(t);
  const derived = Survey.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, stateDir: fx.stateDir });
  assert.equal(derived.batch.summary.researchExamResultsEvaluated, 5);
  assert.equal(derived.batch.summary.surveysProposed, 2);
  assert.equal(derived.batch.summary.noExamHolds, 3);
  assert.equal(derived.batch.summary.inventoryDocuments, 5);
  assert.equal(derived.batch.summary.relevantPatternAssessments, 10);
  assert.equal(derived.batch.summary.completeCurrentRelationWitnesses, 0);
  assert.equal(derived.batch.summary.hypothesesRemainingUntested, 8);
  assert.equal(derived.batch.summary.reasoningDecisionsMatched, 5);
  assert.equal(derived.batch.summary.frequencySelectionsRejected, 5);
  assert.equal(derived.batch.summary.crossDocumentMergesRejected, 5);
  assert.equal(derived.batch.summary.providerIdentitiesInferred, 0);
  assert.equal(derived.batch.summary.architecturesSelected, 0);
  assert.equal(derived.batch.summary.architecturesEvaluated, 0);
  const consumer = derived.batch.results.find(item => item.requirementId === 'consumer-gap').survey;
  assert.equal(consumer.state, 'NO_COMPLETE_PATTERN_WITNESS_CONTINUE_UNRESOLVED');
  assert.equal(consumer.relevantPatterns.length, 5);
  assert.equal(consumer.crossDocumentRelationMergeUsed, false);
  assert.equal(consumer.providerIdentityInferred, false);
  assert.equal(consumer.architectureDecision, 'UNRESOLVED_REQUIRES_ATTRIBUTED_EXECUTOR_REVIEW_AND_REAL_CANDIDATE');
  assert.ok(consumer.hypothesisEvidence.every(item => item.state === 'UNTESTED' && item.architectureSelected === false && item.architectureEvaluated === false));
  assert.equal(consumer.hypothesisEvidence.find(item => item.hypothesisId === 'REUSE_TYPED_SHARED_SERVICE_DECLARATION').patternCount, 3);
  assert.equal(consumer.hypothesisEvidence.find(item => item.hypothesisId === 'EXTEND_TYPED_ENGINE_OR_REGISTRY_DECLARATION').patternCount, 1);
  assert.equal(consumer.hypothesisEvidence.find(item => item.hypothesisId === 'NEW_TYPED_PROVIDER_DECLARATION').patternCount, 1);
  assert.equal(consumer.hypothesisEvidence.find(item => item.hypothesisId === 'PRESERVE_UNRESOLVED_NO_ARCHITECTURE_FIT').evidenceState, 'CONTINUE_UNRESOLVED_NO_COMPLETE_PATTERN_WITNESS');
  assert.equal(Survey.verifyBatch(derived.batch, derived.runDir, fx.research), true);
  const response = Survey.respond(derived, { schema: Survey.REQUEST_SCHEMA, requirementId: 'consumer-gap' });
  assert.equal(response.state, 'PROPOSED_PROVIDER_DECLARATION_ARCHITECTURE_PATTERN_EVIDENCE');
  assert.equal(response.surveys.length, 1);
  assert.equal(response.architectureSelected, false);
  assert.equal(response.architectureEvaluated, false);
  const held = Survey.respond(derived, { schema: Survey.REQUEST_SCHEMA, requirementId: 'exact-service' });
  assert.equal(held.state, 'HOLD_NO_RESEARCH_EXAM_TO_SURVEY');
  const absent = Survey.respond(derived, { schema: Survey.REQUEST_SCHEMA, requirementId: 'unknown' });
  assert.equal(absent.state, 'HOLD_UNKNOWN_PROVIDER_DECLARATION_RESEARCH_RESULT');
});

test('one later complete source remains only a structural witness and creates a new immutable survey batch', t => {
  const fx = fixture(t);
  const first = Survey.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, stateDir: fx.stateDir });
  writeJson(path.join(fx.workshopRoot, 'shared', 'consumer-gap', 'provider-integration.json'), {
    schema: 'axm.foundation-service-integration/v1', service_id: 'consumer-gap', version: '1.0.0', provides: ['provider-v1'],
    implementation: { path: 'shared/consumer-gap/index.js', sha256: 'c'.repeat(64) }, permissions: ['files:read'], boundaries: { automaticWrites: [], refuses: [] }
  });
  const next = Survey.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, stateDir: fx.stateDir });
  assert.notEqual(next.batch.batchId, first.batch.batchId);
  assert.ok(fs.existsSync(path.join(first.runDir, 'batch.json')));
  assert.equal(next.batch.summary.inventoryDocuments, 6);
  assert.equal(next.batch.summary.completeCurrentRelationWitnesses, 1);
  const consumer = next.batch.results.find(item => item.requirementId === 'consumer-gap').survey;
  assert.equal(consumer.state, 'STRUCTURAL_PATTERN_WITNESS_REQUIRES_INDEPENDENT_ARCHITECTURE_EXPERIMENT');
  assert.equal(consumer.completePatternWitnesses, 1);
  const newTyped = consumer.hypothesisEvidence.find(item => item.hypothesisId === 'NEW_TYPED_PROVIDER_DECLARATION');
  assert.equal(newTyped.evidenceState, 'COMPLETE_CURRENT_RELATION_WITNESS_NOT_ARCHITECTURE_EVALUATED');
  assert.equal(newTyped.state, 'UNTESTED');
  assert.equal(newTyped.architectureSelected, false);
  assert.equal(newTyped.architectureEvaluated, false);
  assert.equal(next.batch.summary.providerIdentitiesInferred, 0);
  assert.equal(next.batch.summary.providerCandidatesBuilt, 0);
  assert.equal(next.batch.summary.providerDeclarationsWritten, 0);
  assert.equal(next.batch.summary.workshopFilesChanged, 0);

  const tampered = JSON.parse(JSON.stringify(next.batch));
  tampered.summary.architecturesSelected = 1;
  assert.throws(() => Survey.verifyBatch(tampered), /digest/);
  const sessionFile = path.join(next.runDir, next.batch.results[0].sessionFile);
  fs.appendFileSync(sessionFile, ' ');
  assert.throws(() => Survey.derive({ root: fx.root, workshopRoot: fx.workshopRoot, researchDerived: fx.research, stateDir: fx.stateDir }), /session hash mismatch/);
});
