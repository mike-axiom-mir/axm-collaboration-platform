'use strict';

const assert = require('assert');
const Planner = require('./workshop-contract-repair-planner-v1');

let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
function rejects(name, fn, pattern) { test(name, () => assert.throws(fn, pattern)); }
function ref(path, seed, byteLength = 100) { return { path, sha256: Planner.hashValue(seed), byteLength }; }
function observation(request, overrides = {}) {
  const target = request.target;
  const manifestRef = ref(target.manifestPath, 'manifest');
  const contractRef = ref(target.contractPath, 'contract');
  const selftestRef = ref(target.selftestPath, 'selftest');
  const value = {
    schema: Planner.OBSERVATION_SCHEMA, version: Planner.VERSION, status: 'TEST', id: request.id + '-observation', sourceLabel: request.sourceLabel, evaluatedAt: request.evaluatedAt, scopeId: Planner.SCOPE_ID,
    target, inputRefs: [manifestRef, contractRef, selftestRef],
    manifest: { ref: manifestRef, declaredSchema: null, schemaState: 'MISSING', id: target.toolId, kindState: 'MISSING', declaredKind: null, validation: { pass: true, errors: [] } },
    contract: { ref: contractRef, schema: 'axm.module-contract/v1', id: target.toolId, permissionParity: true, validation: { pass: true, errors: [] } },
    selftest: { ref: selftestRef, state: 'PRESENT_NOT_RUN' }, allowedKinds: Planner.clone(Planner.ALLOWED_KINDS),
    resources: { inputFiles: 3, inputBytes: 300, networkRequests: 0, childProcesses: 0, enforced: true }, privacy: Planner.clone(Planner.PRIVACY),
    truth: { sourceRead: true, sourceWritten: false, candidateBytesRetainedInOutput: true, candidateExecuted: false, testsExecuted: false, networkUsed: false, childProcessSpawned: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false }, authority: 'NONE'
  };
  Object.assign(value, overrides);
  return Planner.sealObservation(value);
}
function candidate(plan, request, observed) {
  return Planner.sealCandidate({
    schema: Planner.CANDIDATE_SCHEMA, version: Planner.VERSION, status: 'EXPERIMENTAL', id: request.id + '-candidate',
    requestRef: plan.requestRef, observationRef: plan.observationRef, planRef: { id: plan.id, schema: plan.schema, sha256: plan.planDigest }, target: plan.target, repairClass: Planner.REPAIR_CLASS,
    alternatives: plan.alternatives.map((entry) => ({ ...entry, candidateRef: ref('alternatives/' + entry.id + '/manifest.json', entry.id), manifestValidation: { pass: true, errors: [] }, contractValidation: { pass: true, errors: [] } })),
    comparison: { ranking: 'NONE', selectedAlternative: null, equalAuthority: true, permissionDelta: { added: [], removed: [] }, contractBytesChanged: false }, requiredTests: plan.requiredTests, limitations: plan.limitations,
    truth: { draftDetached: true, alternativesUnranked: true, humanSelectionRequired: true, candidateExecuted: false, testsExecuted: false, sourceWritten: false, permissionsChanged: false, contractBytesChanged: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false }, authority: 'NONE'
  });
}

const request = Planner.buildExampleRequest();
const observed = observation(request);
const planned = Planner.plan(request, observed);

test('identical inputs produce a byte-identical unranked plan', () => assert.strictEqual(Planner.canonical(planned), Planner.canonical(Planner.plan(request, observed))));
test('legacy manifest missing schema and kind produces every allowed alternative without selection', () => {
  assert.strictEqual(planned.status, 'DRAFT_ALTERNATIVES_PLANNED'); assert.strictEqual(planned.finding, 'LEGACY_MANIFEST_SCHEMA_AND_KIND_MISSING');
  assert.deepStrictEqual(planned.alternatives.map((entry) => entry.kind), Planner.ALLOWED_KINDS); assert.strictEqual(planned.selectedAlternative, null); assert.strictEqual(planned.ranking, 'NONE');
});
test('required tests remain inert exact argv declarations', () => {
  assert.strictEqual(planned.requiredTests.length, 4); assert(planned.requiredTests.every((entry) => entry.command[0] === 'node' && entry.status === 'NOT_RUN' && entry.evidenceRefs.length === 0));
});
test('candidate packet preserves equal authority and unknown semantic fitness', () => {
  const packet = candidate(planned, request, observed); assert.strictEqual(Planner.normalizeCandidate(packet).candidateDigest, packet.candidateDigest);
  assert(packet.alternatives.every((entry) => entry.semanticFitness === 'UNKNOWN' && entry.ranking === null)); assert.deepStrictEqual(packet.comparison.permissionDelta, { added: [], removed: [] });
});
test('plan verification detects mutation', () => { const changed = Planner.clone(planned); changed.finding = 'NONE'; assert.strictEqual(Planner.verifyPlan(changed, request, observed).pass, false); });
rejects('root HOLD cannot be clicked into an authorized request', () => { const draft = Planner.clone(request); delete draft.requestDigest; draft.rootsGate[0].verdict = 'HOLD'; Planner.sealRequest(draft); }, /four-root gate/);
rejects('extra request fields fail closed', () => { const draft = Planner.clone(request); draft.surprise = true; Planner.normalizeRequest(draft); }, /fields are not exact/);
rejects('forged observation lineage fails closed', () => { const draft = Planner.clone(observed); draft.inputRefs[0].sha256 = Planner.hashValue('forged'); Planner.normalizeObservation(draft); }, /digest mismatch|refs disagree/);
rejects('machine alternative selection is rejected', () => { const packet = candidate(planned, request, observed); packet.comparison.selectedAlternative = 'kind-product'; delete packet.candidateDigest; Planner.sealCandidate(packet); }, /silently selected/);
rejects('permission expansion in comparison is rejected', () => { const packet = candidate(planned, request, observed); packet.comparison.permissionDelta.added.push('network'); delete packet.candidateDigest; Planner.sealCandidate(packet); }, /silently selected or expanded authority/);
rejects('claimed test execution is rejected', () => { const packet = candidate(planned, request, observed); packet.requiredTests[0].status = 'PASS'; delete packet.candidateDigest; Planner.sealCandidate(packet); }, /must remain NOT_RUN/);
test('already valid kind emits no draft', () => {
  const valid = observation(request, { manifest: { ...observed.manifest, declaredSchema: 'axm.tool-manifest/v1', schemaState: 'PRESENT_VALID', kindState: 'PRESENT_VALID', declaredKind: 'product', validation: { pass: true, errors: [] } } });
  const result = Planner.plan(request, valid); assert.strictEqual(result.status, 'CURRENT_NO_DRAFT'); assert.strictEqual(result.alternatives.length, 0);
});
test('unsupported declaration states are preserved as an explicit HOLD', () => {
  const invalid = observation(request, { manifest: { ...observed.manifest, declaredSchema: 'axm.tool-manifest/v1', schemaState: 'PRESENT_VALID', kindState: 'PRESENT_INVALID', declaredKind: 'mystery', validation: { pass: false, errors: ['kind is unsupported'] } } });
  const result = Planner.plan(request, invalid); assert.strictEqual(result.status, 'HOLD'); assert.strictEqual(result.finding, 'UNSUPPORTED_DECLARATION_STATE_REQUIRES_SEPARATE_REQUEST');
});
test('additional defects are preserved as a separate-request HOLD', () => {
  const multiple = observation(request, { manifest: { ...observed.manifest, validation: { pass: false, errors: ['entry file missing'] } } });
  const result = Planner.plan(request, multiple); assert.strictEqual(result.status, 'HOLD'); assert.strictEqual(result.finding, 'ADDITIONAL_DEFECTS_REQUIRE_SEPARATE_REQUEST'); assert.strictEqual(result.alternatives.length, 0);
});
for (const bad of ['C:/tools/x/manifest.json', '//server/share/file', 'tools/x:stream/manifest.json', 'tools/../x/manifest.json', 'tools/CON/manifest.json', 'tools/x./manifest.json']) rejects('portable paths reject ' + bad, () => Planner.portablePath(bad, 'path'), /portable|Windows-unsafe/);

process.stdout.write('Workshop contract repair planner selftest passed: ' + passed + ' cases.\n');
