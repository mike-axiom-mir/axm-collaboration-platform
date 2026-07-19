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
const EvidenceCell = require('../kernel/provider-implementation-evidence-cell');
const EvidenceSurveys = require('../organs/provider-declaration-implementation-evidence-survey-organ');

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
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-provider-implementation-evidence-'));
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
  writeSource(path.join(workshopRoot, 'shared', 'candidate', 'selftest.js'), "'use strict';\nconst assert=require('assert');\nassert.equal('provider-v1','provider-v1');\n");
  writeSource(path.join(workshopRoot, 'shared', 'candidate', 'danger.js'), `const selector='provider-v1';\nrequire('fs').writeFileSync(${JSON.stringify(sentinel)},'executed');\n`);
  writeSource(path.join(workshopRoot, 'shared', 'candidate', 'comment-only.js'), "// 'provider-v1' is commentary only\nmodule.exports={};\n");
  const handoff = HandoffGraph.derive({ root, workshopRoot, stateDir: path.join(root, 'state', 'handoffs') });
  const snapshot = {
    schema: 'axm.technical-glasses/v1', ok: true, compiledAt: '2026-07-18T18:00:00.000Z', freshness: { fingerprint: '2'.repeat(64) },
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
  const stateDir = path.join(root, 'state', 'implementation-evidence');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, architecture, stateDir, sentinel };
}

function cellInput(source, overrides = {}) {
  const content = Buffer.from(source, 'utf8');
  return Object.assign({ relativePath: 'shared/example.js', content, contentSha256: EvidenceCell.digest(content), symbolic: false, insideRoot: true, demandedSelectors: ['provider-v1'] }, overrides);
}

test('implementation evidence cell records exact source literals without executing or binding a provider', () => {
  const adapter = EvidenceCell.evaluate(cellInput("// 'provider-v1' ignored\nconst ID='provider-v1'; function register(x){x.register(ID)} module.exports={ID,register};"));
  assert.equal(adapter.classification, 'SELECTOR_BEARING_EXPORT_AND_REGISTRATION_SOURCE');
  assert.equal(adapter.state, 'SELECTOR_SOURCE_WITNESS_NOT_PROVIDER_BINDING');
  assert.deepEqual(adapter.exactSelectorLiterals, ['provider-v1']);
  assert.equal(adapter.exactSelectorLiteralCounts['provider-v1'], 1);
  assert.equal(adapter.providerIdentityBound, false);
  assert.equal(adapter.outerRequirementBound, false);
  assert.equal(adapter.implementationSelected, false);
  assert.equal(adapter.sourceExecuted, false);
  assert.ok(Object.values(adapter.authority).every(value => value === false));

  const comment = EvidenceCell.evaluate(cellInput("// 'provider-v1'\nmodule.exports={};"));
  assert.equal(comment.classification, 'NO_DEMANDED_SELECTOR_LITERAL');
  const dynamic = EvidenceCell.evaluate(cellInput('const x=`provider-v1-${suffix}`;'));
  assert.deepEqual(dynamic.exactSelectorLiterals, []);
  const malformed = EvidenceCell.evaluate(cellInput("const x='provider-v1"));
  assert.equal(malformed.classification, 'MALFORMED_LEXICAL_SOURCE');
  assert.equal(malformed.state, 'SOURCE_REFUSED');
  const symbolic = EvidenceCell.evaluate(cellInput("'provider-v1'", { symbolic: true }));
  assert.equal(symbolic.classification, 'BOUNDARY_REFUSED_SOURCE');
  assert.throws(() => EvidenceCell.evaluate(Object.assign(cellInput("'provider-v1'"), { execute: true })), /unknown critical/);
  const selectorFree = EvidenceSurveys.createEvidenceSurvey({ surveyId: 'selector-free', surveyDigest: 'a'.repeat(64), requirementId: 'bare-gap', demandedProviderSelectors: [], hypothesisEvidence: [] }, [], { inventoryDigest: 'b'.repeat(64) });
  assert.equal(selectorFree.state, 'NOT_APPLICABLE_NO_DEMANDED_PROVIDER_SELECTOR');
  assert.deepEqual(selectorFree.selectorSources, []);
  assert.equal(selectorFree.sourceExecuted, false);
});

test('implementation evidence survey finds selector-bearing sources but rejects provider inference and source-frequency selection', t => {
  const fx = fixture(t);
  const derived = EvidenceSurveys.derive({ root: fx.root, workshopRoot: fx.workshopRoot, architectureDerived: fx.architecture, stateDir: fx.stateDir });
  assert.equal(derived.batch.summary.architectureSurveyResultsEvaluated, 2);
  assert.equal(derived.batch.summary.evidenceSurveysProposed, 1);
  assert.equal(derived.batch.summary.noArchitectureSurveyHolds, 1);
  assert.equal(derived.batch.summary.inventorySources, 4);
  assert.equal(derived.batch.summary.selectorBearingSources, 3);
  assert.equal(derived.batch.summary.demandedSelectorsWitnessed, 1);
  assert.equal(derived.batch.summary.exportAndRegistrationSources, 1);
  assert.equal(derived.batch.summary.testSources, 1);
  assert.equal(derived.batch.summary.reasoningDecisionsMatched, 2);
  assert.equal(derived.batch.summary.providerInferencesRejected, 2);
  assert.equal(derived.batch.summary.frequencySelectionsRejected, 2);
  assert.equal(derived.batch.summary.providerIdentitiesInferred, 0);
  assert.equal(derived.batch.summary.outerRequirementsBound, 0);
  assert.equal(derived.batch.summary.implementationsSelected, 0);
  assert.equal(derived.batch.summary.sourcesExecuted, 0);
  assert.equal(fs.existsSync(fx.sentinel), false);
  const evidence = derived.batch.results.find(item => item.requirementId === 'consumer-gap').evidenceSurvey;
  assert.equal(evidence.state, 'SELECTOR_SOURCE_WITNESSES_REQUIRE_EXPLICIT_PROVIDER_BINDING');
  assert.equal(evidence.selectorSources.length, 3);
  assert.ok(evidence.architectureHypotheses.every(item => item.state === 'UNTESTED' && !item.architectureSelected && !item.architectureEvaluated));
  assert.equal(evidence.providerIdentityInferred, false);
  assert.equal(evidence.outerRequirementBound, false);
  assert.equal(evidence.implementationSelected, false);
  assert.equal(evidence.sourceExecuted, false);
  assert.equal(EvidenceSurveys.verifyBatch(derived.batch, derived.runDir, fx.architecture), true);
  const response = EvidenceSurveys.respond(derived, { schema: EvidenceSurveys.REQUEST_SCHEMA, requirementId: 'consumer-gap' });
  assert.equal(response.state, 'PROPOSED_PROVIDER_IMPLEMENTATION_SOURCE_EVIDENCE');
  assert.equal(response.evidenceSurveys.length, 1);
  assert.equal(response.providerIdentityInferred, false);
  assert.equal(response.implementationSelected, false);
  assert.equal(response.sourceExecuted, false);
  const held = EvidenceSurveys.respond(derived, { schema: EvidenceSurveys.REQUEST_SCHEMA, requirementId: 'exact-service' });
  assert.equal(held.state, 'HOLD_NO_ARCHITECTURE_SURVEY_TO_INSPECT');
  const absent = EvidenceSurveys.respond(derived, { schema: EvidenceSurveys.REQUEST_SCHEMA, requirementId: 'unknown' });
  assert.equal(absent.state, 'HOLD_UNKNOWN_PROVIDER_DECLARATION_ARCHITECTURE_SURVEY_RESULT');
});

test('a later selector source creates a new immutable evidence batch while old evidence and zero execution remain', t => {
  const fx = fixture(t);
  const first = EvidenceSurveys.derive({ root: fx.root, workshopRoot: fx.workshopRoot, architectureDerived: fx.architecture, stateDir: fx.stateDir });
  writeSource(path.join(fx.workshopRoot, 'shared', 'candidate', 'later.js'), "module.exports={selector:'provider-v1'};\n");
  const next = EvidenceSurveys.derive({ root: fx.root, workshopRoot: fx.workshopRoot, architectureDerived: fx.architecture, stateDir: fx.stateDir });
  assert.notEqual(next.batch.batchId, first.batch.batchId);
  assert.ok(fs.existsSync(path.join(first.runDir, 'batch.json')));
  assert.equal(next.batch.summary.inventorySources, 5);
  assert.equal(next.batch.summary.selectorBearingSources, 4);
  assert.equal(next.batch.summary.implementationsSelected, 0);
  assert.equal(next.batch.summary.sourcesExecuted, 0);
  assert.equal(fs.existsSync(fx.sentinel), false);
  const tampered = JSON.parse(JSON.stringify(next.batch));
  tampered.summary.implementationsSelected = 1;
  assert.throws(() => EvidenceSurveys.verifyBatch(tampered), /digest/);
  const result = next.batch.results[0];
  fs.appendFileSync(path.join(next.runDir, result.sessionFile), ' ');
  assert.throws(() => EvidenceSurveys.derive({ root: fx.root, workshopRoot: fx.workshopRoot, architectureDerived: fx.architecture, stateDir: fx.stateDir }), /session hash mismatch/);
});
