#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Audit = require('./scan-workshop-json-seams');
const PhoneGap = require('./probe-voluntary-phone-qa-gap');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'CURRENT_UPSTREAM_CLOSURE.json');
const GENERATED_AT = '2026-08-20T06:00:00.000Z';
const IDS = Audit.SELECTED_COHORT;

const DIRECT_SEAMS = [
  ['verified-capability-loop', 'shared/baseline-simulation-lab/baseline-simulation-lab.js'],
  ['portable-baseline-capsule', 'shared/baseline-simulation-lab/baseline-simulation-lab.js'],
  ['verified-capability-loop', 'shared/grounded-growth-outcomes/grounded-growth-outcomes.js'],
  ['verified-capability-loop', 'shared/grounded-growth-human-bridge/grounded-growth-human-bridge.js'],
  ['human-benefit-evidence', 'shared/grounded-growth-human-bridge/grounded-growth-human-bridge.js'],
  ['verified-capability-loop', 'shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2.js'],
  ['human-benefit-evidence', 'shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2.js'],
  ['verified-capability-loop', 'shared/grounded-growth-human-handoff/grounded-growth-human-handoff.js'],
  ['human-benefit-evidence', 'shared/grounded-growth-human-handoff/grounded-growth-human-handoff.js'],
  ['verified-capability-loop', 'shared/grounded-growth-human-route-coverage/grounded-growth-human-route-coverage.js'],
  ['human-benefit-evidence', 'shared/grounded-growth-human-route-coverage/grounded-growth-human-route-coverage.js'],
  ['human-benefit-evidence', 'shared/grounded-growth-participation-frontier/grounded-growth-participation-frontier.js'],
  ['portable-baseline-capsule', 'shared/grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier.js'],
  ['research-contribution-intake', 'shared/grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier.js'],
  ['baseline-simulation-lab', 'shared/simulation-lab-extension-intake/simulation-lab-extension-intake.js'],
  ['simulation-lab-extension-intake', 'shared/grounded-growth-frontier-gate/grounded-growth-frontier-gate.js']
];

function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function normalized(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
}

function loadApi(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  delete require.cache[require.resolve(absolutePath)];
  return require(absolutePath);
}

function safeFixtures() {
  const shared = { x: 1 };
  return [
    ['sorted-object-keys', { z: 1, a: [true, null, 'x'] }],
    ['unicode-and-escaping', { 'line\nkey': 'snowman ☃ and quote "' }],
    ['negative-zero-normalization', { value: -0 }],
    ['nested-arrays-and-objects', [{ b: 2, a: 1 }, [], { deep: [false, 0, null] }]],
    ['finite-numbers', { negative: -12.5, positive: 42, small: 0.00025 }],
    ['repeated-non-cyclic-reference', { left: shared, right: shared }]
  ];
}

function unsafeFixtures() {
  return [
    ['root-undefined', () => undefined],
    ['object-property-undefined', () => ({ lost: undefined })],
    ['nested-undefined', () => ({ nested: { lost: undefined } })],
    ['array-undefined', () => [1, undefined]],
    ['sparse-array', () => { const value = []; value.length = 1; return value; }],
    ['nan', () => ({ number: NaN })],
    ['positive-infinity', () => ({ number: Infinity })],
    ['negative-infinity', () => ({ number: -Infinity })],
    ['bigint', () => ({ number: 1n })],
    ['symbol', () => ({ value: Symbol('x') })],
    ['function', () => ({ value: function fixture() {} })],
    ['date', () => ({ value: new Date('2020-01-01T00:00:00.000Z') })],
    ['cycle', () => { const value = {}; value.self = value; return value; }]
  ];
}

function structuralResult(id, beforeRow, currentRow) {
  const source = normalized(beforeRow.path);
  const directory = path.dirname(beforeRow.path);
  const contract = JSON.parse(normalized(path.join(directory, 'module.contract.json')));
  const readme = normalized(path.join(directory, 'README.md'));
  const selftest = normalized(path.join(directory, 'selftest.js'));
  return {
    moduleId: id,
    path: beforeRow.path,
    sourceChangedFromBefore: sha256(source) !== beforeRow.sourceSha256,
    importsExistingCore: source.includes("require('../../tools/deterministic-json-core')"),
    cloneUsesStrictCanonicalText: /function clone\(value\) \{\n\s+return JSON\.parse\(DeterministicJson\.canonicalJson\(value\)\);\n\}/.test(source),
    stableStringifyUsesExistingCore: /function stableStringify\(value\) \{\n\s+return DeterministicJson\.canonicalJson\(value\);\n\}/.test(source),
    contractVersion: contract.version,
    contractConsumesExistingCore: contract.consumes.includes('strict-deterministic-canonical-json'),
    contractRefusesUnsafeState: contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'),
    readmeDeclaresRepresentationBoundary: readme.includes('Representation boundary: v0.2 uses the shared strict deterministic JSON core.'),
    nativeSelftestCoversUnsafeRefusal: selftest.includes('unsupported undefined'),
    currentRuntimeClassification: currentRow.classification
  };
}

function refusalResults(apis) {
  return IDS.flatMap((id) => unsafeFixtures().map(([fixtureId, makeValue]) => {
    try {
      apis[id].stableStringify(makeValue());
      return { moduleId: id, fixtureId, state: 'ACCEPTED_UNSAFE', error: null };
    } catch (error) {
      return { moduleId: id, fixtureId, state: 'REFUSED', error: error.name + ': ' + error.message };
    }
  }));
}

function safeCompatibility(beforeRows, apis) {
  const fixtures = new Map(safeFixtures());
  return IDS.flatMap((id) => beforeRows.get(id).safe.map((recorded) => {
    const value = fixtures.get(recorded.fixtureId);
    const canonical = apis[id].stableStringify(value);
    return {
      moduleId: id,
      fixtureId: recorded.fixtureId,
      recordedCanonicalSha256: recorded.canonicalSha256,
      currentCanonicalSha256: sha256(canonical),
      canonicalDigestExact: sha256(canonical) === recorded.canonicalSha256,
      objectDigestExact: apis[id].sha256(value) === recorded.canonicalSha256
    };
  }));
}

function persistenceResults(apis) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-upstream-json-closure-'));
  try {
    return IDS.map((id) => {
      const value = {
        schema: 'axm.grounded-growth-upstream-json-persistence-probe/v1',
        moduleId: id,
        nested: { a: [true, null, 'safe'], z: 1 },
        status: 'TEST'
      };
      const canonical = apis[id].stableStringify(value);
      const digest = apis[id].sha256(value);
      const target = path.join(tempRoot, id + '.json');
      fs.writeFileSync(target, canonical, 'utf8');
      const readBack = fs.readFileSync(target, 'utf8');
      const parsed = JSON.parse(readBack);
      return {
        moduleId: id,
        writeCompleted: true,
        readCompleted: true,
        parsedAfterRead: true,
        canonicalExactAfterRead: apis[id].stableStringify(parsed) === canonical,
        digestExactAfterRead: apis[id].sha256(parsed) === digest,
        temporaryFileRetained: false
      };
    });
  } finally {
    const resolved = path.resolve(tempRoot);
    const tempParent = path.resolve(os.tmpdir());
    if (!resolved.startsWith(tempParent + path.sep)) throw new Error('refusing persistence cleanup outside the OS temporary directory');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

function directSeamResults() {
  return DIRECT_SEAMS.map(([upstreamModuleId, consumerPath]) => ({
    upstreamModuleId,
    consumerPath,
    exactModuleIdMentioned: normalized(consumerPath).includes(upstreamModuleId)
  }));
}

function build() {
  const before = Audit.verifyRecorded(Audit.BEFORE_OUTPUT);
  const current = Audit.verifyRecorded(Audit.CURRENT_OUTPUT);
  const phoneGap = PhoneGap.checkRecorded();
  const beforeRows = new Map(before.runtime.modules.map((item) => [item.moduleId, item]));
  const currentRows = new Map(current.runtime.modules.map((item) => [item.moduleId, item]));
  const apis = Object.fromEntries(IDS.map((id) => [id, loadApi(beforeRows.get(id).path)]));
  const structuralClosure = IDS.map((id) => structuralResult(id, beforeRows.get(id), currentRows.get(id)));
  const refusals = refusalResults(apis);
  const compatibility = safeCompatibility(beforeRows, apis);
  const persistence = persistenceResults(apis);
  const directSeams = directSeamResults();

  const structuralFailure = structuralClosure.some((item) => (
    !item.sourceChangedFromBefore
    || !item.importsExistingCore
    || !item.cloneUsesStrictCanonicalText
    || !item.stableStringifyUsesExistingCore
    || item.contractVersion !== 'v0.2'
    || !item.contractConsumesExistingCore
    || !item.contractRefusesUnsafeState
    || !item.readmeDeclaresRepresentationBoundary
    || !item.nativeSelftestCoversUnsafeRefusal
    || item.currentRuntimeClassification !== 'REFUSES_ALL_UNSAFE_FIXTURES'
  ));
  if (structuralFailure) throw new Error('selected upstream cohort structural closure is incomplete');
  if (refusals.some((item) => item.state !== 'REFUSED')) throw new Error('selected upstream cohort accepted unsafe state');
  if (compatibility.some((item) => !item.canonicalDigestExact || !item.objectDigestExact)) throw new Error('selected upstream cohort changed safe canonical bytes or object digests');
  if (persistence.some((item) => !item.writeCompleted || !item.readCompleted || !item.parsedAfterRead
    || !item.canonicalExactAfterRead || !item.digestExactAfterRead || item.temporaryFileRetained)) {
    throw new Error('selected upstream cohort persistence journey failed');
  }
  if (directSeams.some((item) => !item.exactModuleIdMentioned)) throw new Error('declared direct upstream seam is absent');
  if (phoneGap.state !== 'DEFERRED_CONTRACT_AND_EVIDENCE_GAP') throw new Error('phone QA gap is not preserved');
  if (current.runtime.counts.refusesAllUnsafeFixtures !== IDS.length) throw new Error('current runtime inventory strict count differs from selected cohort');

  const report = {
    schema: 'axm.grounded-growth-upstream-json-closure/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: 'SIX_DIRECT_UPSTREAM_ROOTS_STRICT_ON_REVIEW_BRANCH',
    scope: {
      selectedModuleIds: IDS,
      representationClosureOnly: true,
      productionJavaScriptAuditIsPatternBased: true,
      workshopWideRepresentationClosureClaimed: false,
      browserOrNonJavaScriptBehaviorClaimed: false
    },
    audit: {
      baseCommit: before.baseCommit,
      beforeDigest: before.digest,
      currentDigest: current.digest,
      staticBefore: before.static.counts,
      staticCurrent: current.static.counts,
      runtimeBefore: before.runtime.counts,
      runtimeCurrent: current.runtime.counts,
      deltas: {
        strictCoreReferenced: current.static.counts.strictCoreReferenced - before.static.counts.strictCoreReferenced,
        potentialRepresentationSeams: current.static.counts.potentialRepresentationSeams - before.static.counts.potentialRepresentationSeams,
        jsonRoundTripCloneOccurrences: current.static.counts.jsonRoundTripCloneOccurrences - before.static.counts.jsonRoundTripCloneOccurrences,
        strictRuntimeModules: current.runtime.counts.refusesAllUnsafeFixtures - before.runtime.counts.refusesAllUnsafeFixtures
      }
    },
    migration: IDS.map((id) => ({
      moduleId: id,
      path: beforeRows.get(id).path,
      beforeSourceSha256: beforeRows.get(id).sourceSha256,
      currentSourceSha256: currentRows.get(id).sourceSha256,
      beforeClassification: beforeRows.get(id).classification,
      currentClassification: currentRows.get(id).classification
    })),
    structuralClosure,
    unsafeFixtureResults: refusals,
    safeCompatibility: compatibility,
    persistence,
    directProductionSeams: directSeams,
    deferred: [{
      moduleId: phoneGap.candidateModule,
      state: phoneGap.state,
      gapTypes: ['CONTRACT', 'EVIDENCE'],
      evidenceDigest: phoneGap.digest,
      requiredCapabilities: phoneGap.decision.requiredCapabilities,
      fakeDeclarationsAdded: phoneGap.decision.fakeManifestOrContractDeclarationsAdded
    }],
    requirements: [
      { id: 'six-module-structural-closure', verdict: 'PASS' },
      { id: '78-unsafe-fixture-refusals', verdict: 'PASS' },
      { id: '36-safe-canonical-and-digest-comparisons', verdict: 'PASS' },
      { id: 'six-persistence-roundtrips', verdict: 'PASS' },
      { id: 'direct-production-seams-remain-visible', verdict: 'PASS' },
      { id: 'voluntary-phone-qa-gap-preserved', verdict: 'PASS' },
      { id: 'all-native-downstream-and-required-checks', verdict: 'NOT_RUN' },
      { id: 'clean-checkout-exact-commit-verification', verdict: 'NOT_RUN' }
    ],
    limits: {
      staticFindingIsConfirmedBug: false,
      nonExportedHelperRuntimeCovered: false,
      browserInlineRuntimeCovered: false,
      nonJavaScriptRuntimeCovered: false,
      semanticIntentAutomaticallyProved: false,
      humanBenefitEstablished: false,
      modelLearningImprovementEstablished: false,
      shadowCloneCandidateEvaluated: false
    },
    authority: {
      branchOnly: true,
      installed: false,
      permissionGranted: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false
    },
    closureDigest: null
  };
  const payload = JSON.parse(Core.canonicalJson(report));
  delete payload.closureDigest;
  report.closureDigest = sha256(Core.canonicalJson(payload));
  return report;
}

function write() {
  const report = build();
  fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return report;
}

function checkRecorded() {
  const expected = build();
  const actual = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  if (Core.canonicalJson(actual) !== Core.canonicalJson(expected)) throw new Error('recorded upstream closure differs from current evidence');
  return actual;
}

if (require.main === module) {
  const report = process.argv.includes('--write') ? write() : checkRecorded();
  process.stdout.write(JSON.stringify({
    state: report.state,
    unsafeRefusals: report.unsafeFixtureResults.length,
    safeComparisons: report.safeCompatibility.length,
    persistenceJourneys: report.persistence.length,
    deferredGaps: report.deferred.length,
    digest: report.closureDigest
  }) + '\n');
}

module.exports = { ROOT, OUTPUT, GENERATED_AT, IDS, DIRECT_SEAMS, build, write, checkRecorded };
