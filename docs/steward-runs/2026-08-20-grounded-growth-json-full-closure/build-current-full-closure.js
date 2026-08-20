#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Baseline = require('./capture-v03-before-state');
const ClosureBuilder = require('../2026-08-20-receipt-serialization-closure/build-current-serialization-closure');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'CURRENT_FULL_CLOSURE.json');
const GENERATED_AT = '2026-08-20T04:48:00.000Z';
const IDS = Baseline.IDS;

function rawSha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function sourcePath(id) { return 'shared/' + id + '/' + id + '.js'; }
function contractPath(id) { return 'shared/' + id + '/module.contract.json'; }

function normalizedSource(id) {
  return fs.readFileSync(path.join(ROOT, sourcePath(id)), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
}

function api(id) { return require(path.join(ROOT, sourcePath(id))); }

function unsafeFixtures() {
  const sparse = [];
  sparse.length = 1;
  const cycle = {};
  cycle.self = cycle;
  return [
    ['root-undefined', undefined],
    ['object-property-undefined', { lost: undefined }],
    ['nested-undefined', { nested: { lost: undefined } }],
    ['array-undefined', [1, undefined]],
    ['sparse-array', sparse],
    ['nan', { number: NaN }],
    ['positive-infinity', { number: Infinity }],
    ['negative-infinity', { number: -Infinity }],
    ['bigint', { number: 1n }],
    ['symbol', { value: Symbol('x') }],
    ['function', { value: function () {} }],
    ['date', { value: new Date('2026-08-20T00:00:00.000Z') }],
    ['cycle', cycle]
  ];
}

function refusalResults(id, consumerApi) {
  return unsafeFixtures().map(([fixtureId, value]) => {
    try {
      consumerApi.stableStringify(value);
      return { consumerId: id, fixtureId, state: 'ACCEPTED_UNSAFE', error: null };
    } catch (error) {
      return { consumerId: id, fixtureId, state: 'REFUSED', error: error.name + ': ' + error.message };
    }
  });
}

function structuralResult(id) {
  const source = normalizedSource(id);
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, contractPath(id)), 'utf8'));
  const result = {
    consumerId: id,
    importsExistingCore: source.includes("require('../../tools/deterministic-json-core')"),
    cloneUsesStrictCanonicalText: /function clone\(value\) \{\n\s+return JSON\.parse\(stableStringify\(value\)\);\n\}/.test(source),
    stableStringifyUsesExistingCore: /function stableStringify\(value\) \{\n\s+return DeterministicJson\.canonicalJson\(value\);\n\}/.test(source),
    contractRequiresExistingCore: contract.consumes.includes('strict-deterministic-canonical-json'),
    contractRefusesUnsafeState: contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'),
    phoneNativeDigestCompatibilityValidatedFirst: id === 'grounded-growth-phone-evidence-gate'
      ? /function nativeOrderClone\(value\) \{\n\s+stableStringify\(value\);\n\s+return JSON\.parse\(JSON\.stringify\(value\)\);\n\}/.test(source)
      : null
  };
  return result;
}

function safeCompatibility(baseline, apis) {
  return baseline.consumers.flatMap((consumer) => consumer.safeCanonical.map((fixture) => {
    const parsed = JSON.parse(fixture.canonical);
    const currentCanonical = apis[consumer.id].stableStringify(parsed);
    return {
      consumerId: consumer.id,
      fixtureId: fixture.fixtureId,
      recordedCanonicalSha256: fixture.canonicalSha256,
      currentCanonicalSha256: rawSha256(currentCanonical),
      canonicalExact: currentCanonical === fixture.canonical,
      objectDigestExact: apis[consumer.id].sha256(parsed) === fixture.canonicalSha256
    };
  }));
}

function persistenceResults(apis) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-json-full-closure-'));
  try {
    return IDS.map((id) => {
      const value = {
        schema: 'axm.grounded-growth-json-persistence-probe/v1',
        consumerId: id,
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
        consumerId: id,
        writeCompleted: true,
        readCompleted: true,
        parsedAfterRead: true,
        canonicalExactAfterRead: apis[id].stableStringify(parsed) === canonical,
        digestExactAfterRead: apis[id].sha256(parsed) === digest,
        temporaryFileRetained: false
      };
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function build() {
  const baseline = Baseline.verifyRecorded();
  const rootCohort = JSON.parse(fs.readFileSync(path.join(
    ROOT,
    'docs/steward-runs/2026-08-20-grounded-growth-json-root-cohort/CURRENT_ROOT_COHORT.json'
  ), 'utf8'));
  const apis = Object.fromEntries(IDS.map((id) => [id, api(id)]));
  const currentClosure = ClosureBuilder.build().evaluation;
  const afterRows = new Map(currentClosure.legacyConsumers.map((item) => [item.id, item]));
  const baselineRows = new Map(baseline.consumers.map((item) => [item.id, item]));
  const structuralClosure = IDS.map(structuralResult);
  const unsafeFixtureResults = IDS.flatMap((id) => refusalResults(id, apis[id]));
  const compatibility = safeCompatibility(baseline, apis);
  const persistence = persistenceResults(apis);

  const structuralFailure = structuralClosure.some((item) => Object.entries(item).some(([key, value]) => {
    if (key === 'consumerId' || key === 'phoneNativeDigestCompatibilityValidatedFirst' && value === null) return false;
    return value !== true;
  }));
  if (structuralFailure) throw new Error('full-closure source or contract structure is incomplete');
  if (unsafeFixtureResults.some((item) => item.state !== 'REFUSED')) throw new Error('full-closure unsafe fixture accepted');
  if (compatibility.some((item) => !item.canonicalExact || !item.objectDigestExact)) throw new Error('safe canonical compatibility drift');
  if (persistence.some((item) => !item.writeCompleted || !item.readCompleted || !item.parsedAfterRead
    || !item.canonicalExactAfterRead || !item.digestExactAfterRead || item.temporaryFileRetained)) {
    throw new Error('full-closure persistence probe failed');
  }
  if (currentClosure.counts.invalidCanonicalText !== 0 || currentClosure.counts.silentFieldLoss !== 0
    || currentClosure.counts.unsafeValuesAlreadyRefused !== currentClosure.counts.consumers) {
    throw new Error('Grounded Growth serialization inventory is not fully strict');
  }

  const result = {
    schema: 'axm.grounded-growth-json-full-closure/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: 'ALL_FIFTEEN_GROUNDED_GROWTH_SERIALIZERS_STRICT_ON_REVIEW_BRANCH',
    scope: {
      inventory: 'the fifteen consumers enumerated by the 2026-08-20 Grounded Growth serialization audit',
      representationClosureOnly: true,
      workshopWideSerializationClaimed: false
    },
    before: {
      baseCommit: baseline.baseCommit,
      strictConsumers: rootCohort.after.strictUnsafeRefusal,
      remainingUnsafeConsumers: rootCohort.after.remainingUnsafeConsumers,
      remainingInvalidCanonicalText: baseline.counts.invalidCanonicalText,
      remainingSilentFieldLoss: baseline.counts.silentFieldLoss,
      safeFixtureComparisons: baseline.counts.safeFixtureComparisons,
      snapshotDigest: baseline.snapshotDigest
    },
    migration: IDS.map((id) => ({
      id,
      path: sourcePath(id),
      dependencies: baselineRows.get(id).dependencies,
      beforeSourceSha256: baselineRows.get(id).sourceSha256,
      afterSourceSha256: rawSha256(normalizedSource(id)),
      beforeBehavior: baselineRows.get(id).unsafeBehavior,
      afterBehavior: afterRows.get(id).behavior
    })),
    after: {
      consumers: currentClosure.counts.consumers,
      strictUnsafeRefusal: currentClosure.counts.unsafeValuesAlreadyRefused,
      invalidCanonicalText: currentClosure.counts.invalidCanonicalText,
      silentFieldLoss: currentClosure.counts.silentFieldLoss,
      remainingUnsafeConsumers: currentClosure.counts.invalidCanonicalText + currentClosure.counts.silentFieldLoss,
      scopedRolloutComplete: true
    },
    structuralClosure,
    unsafeFixtureResults,
    safeCompatibility: compatibility,
    persistence,
    historicalEvidencePolicy: {
      datedReceiptsRewritten: false,
      sourceIdentityFailuresAreNotProductCompatibilityFailures: true,
      currentProductAndNativeChecksRequiredSeparately: true
    },
    requirements: [
      { id: 'eleven-consumer-structural-closure', verdict: 'PASS' },
      { id: '143-unsafe-fixture-refusals', verdict: 'PASS' },
      { id: '66-safe-canonical-and-digest-comparisons', verdict: 'PASS' },
      { id: 'eleven-persistence-roundtrips', verdict: 'PASS' },
      { id: 'fifteen-of-fifteen-inventory-closure', verdict: 'PASS' },
      { id: 'all-native-and-required-checks', verdict: 'NOT_RUN' },
      { id: 'clean-checkout-exact-commit-verification', verdict: 'NOT_RUN' }
    ],
    limits: {
      semanticCorrectnessBeyondNativeAndHistoricalChecksProved: false,
      browserParityTested: false,
      humanReviewRun: false,
      humanBenefitEstablished: false,
      modelLearningImprovementEstablished: false,
      modelReasoningEquivalenceProved: false,
      shadowCloneCandidateEvaluated: false
    },
    authority: {
      branchOnly: true,
      installed: false,
      permissionGranted: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false,
      consumersEditedThisLane: IDS.length
    },
    closureDigest: null
  };
  const payload = JSON.parse(Core.canonicalJson(result));
  delete payload.closureDigest;
  result.closureDigest = rawSha256(Core.canonicalJson(payload));
  return result;
}

function write() {
  const result = build();
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

function checkRecorded() {
  const expected = build();
  const actual = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  if (Core.canonicalJson(actual) !== Core.canonicalJson(expected)) throw new Error('recorded full closure differs from current evidence');
  return expected;
}

if (require.main === module) {
  const result = process.argv.includes('--write') ? write() : checkRecorded();
  process.stdout.write(JSON.stringify({
    state: result.state,
    strictBefore: result.before.strictConsumers,
    strictAfter: result.after.strictUnsafeRefusal,
    remainingUnsafeConsumers: result.after.remainingUnsafeConsumers,
    unsafeRefusals: result.unsafeFixtureResults.length,
    safeComparisons: result.safeCompatibility.length,
    persistenceJourneys: result.persistence.length,
    digest: result.closureDigest
  }) + '\n');
}

module.exports = { ROOT, OUTPUT, GENERATED_AT, IDS, build, write, checkRecorded };
