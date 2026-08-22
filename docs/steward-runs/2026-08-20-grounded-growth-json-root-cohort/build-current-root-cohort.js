#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Feedback = require('../../../shared/grounded-growth-feedback/grounded-growth-feedback');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const ClosureBuilder = require('../2026-08-20-receipt-serialization-closure/build-current-serialization-closure');
const EvolutionBuilder = require('../2026-08-19-verification-evolution-grounded-growth/build-verification-evolution-growth');
const ConvergenceBuilder = require('../2026-08-19-grounded-growth-current-convergence/build-current-convergence');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'CURRENT_ROOT_COHORT.json');
const GENERATED_AT = '2026-08-20T04:20:00.000Z';
const IDS = ['grounded-growth-outcomes', 'grounded-growth-feedback', 'grounded-growth-current-state'];
const PATHS = Object.fromEntries(IDS.map((id) => [id, 'shared/' + id + '/' + id + '.js']));
const EXPECTED_DIGESTS = {
  'grounded-growth-outcomes': 'sha256:3739d53fefbcb6daebe6b0aaf121cda9d9cff347a0e345efd9f029fa7f8cc322',
  'grounded-growth-feedback': 'sha256:52010ee2894a08b341be83ca12d99b767b43d6f2e63ac12b277e7dbcbeb2f49d',
  'grounded-growth-current-state': 'sha256:a244cbbdc5bc35d0ee1dd9f87b509c48d2a53164634d99eb1003ceb28bd09cbb'
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function clone(value) { return JSON.parse(Core.canonicalJson(value)); }

function rawSha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function normalizedSourceDigest(relativePath) {
  const text = fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  return rawSha256(text);
}

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

function refusalProbe(id, api) {
  return unsafeFixtures().map(([fixtureId, value]) => {
    try {
      api.stableStringify(value);
      return { consumerId: id, fixtureId, state: 'ACCEPTED_UNSAFE', error: null };
    } catch (error) {
      return { consumerId: id, fixtureId, state: 'REFUSED', error: error.name + ': ' + error.message };
    }
  });
}

function expectUnsupported(id, operation) {
  try {
    operation();
    throw new Error(id + ' accepted injected unsafe build state');
  } catch (error) {
    if (!/unsupported undefined/i.test(error.message)) throw error;
    return { consumerId: id, state: 'REFUSED_BEFORE_CLONE_COMPLETION', error: error.name + ': ' + error.message };
  }
}

function buildPathProbes(recordedPortfolio, feedbackPacket) {
  const unsafePortfolio = clone(recordedPortfolio);
  unsafePortfolio.outcomes[0].lost = undefined;
  const unsafeFeedback = clone(feedbackPacket);
  unsafeFeedback.source.receipt.lost = undefined;
  const unsafeCurrentInput = ConvergenceBuilder.currentInput();
  unsafeCurrentInput.participationFrontierReceipt.lost = undefined;
  return [
    expectUnsupported('grounded-growth-outcomes', () => Growth.buildPortfolio({
      portfolioId: unsafePortfolio.portfolioId,
      generatedAt: unsafePortfolio.generatedAt,
      outcomes: unsafePortfolio.outcomes
    })),
    expectUnsupported('grounded-growth-feedback', () => Feedback.buildPacket({
      packetId: unsafeFeedback.packetId,
      generatedAt: unsafeFeedback.generatedAt,
      sourceReceipt: unsafeFeedback.source.receipt,
      routeStates: unsafeFeedback.routeStates,
      existingNeeds: unsafeFeedback.existingNeeds,
      coverageLinks: unsafeFeedback.coverageLinks
    })),
    expectUnsupported('grounded-growth-current-state', () => Current.build(unsafeCurrentInput))
  ];
}

function payloadDigest(api, value, digestField) {
  const payload = JSON.parse(api.stableStringify(value));
  delete payload[digestField];
  return api.sha256(payload);
}

function persistenceProbe(entries) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-json-root-cohort-'));
  try {
    return entries.map((entry) => {
      const canonical = entry.api.stableStringify(entry.value);
      const parsedBeforeWrite = JSON.parse(canonical);
      if (entry.api.stableStringify(parsedBeforeWrite) !== canonical) throw new Error(entry.id + ' pre-write canonical drift');
      const file = path.join(tempRoot, entry.id + '.json');
      fs.writeFileSync(file, canonical, 'utf8');
      const readBack = fs.readFileSync(file, 'utf8');
      const parsedAfterRead = JSON.parse(readBack);
      return {
        consumerId: entry.id,
        parsedBeforeWrite: true,
        writeCompleted: true,
        readCompleted: true,
        parsedAfterRead: true,
        canonicalExactAfterRead: entry.api.stableStringify(parsedAfterRead) === canonical,
        canonicalDigestBound: rawSha256(readBack) === rawSha256(canonical),
        payloadDigestBound: payloadDigest(entry.api, parsedAfterRead, entry.digestField) === parsedAfterRead[entry.digestField],
        temporaryFileRetained: false
      };
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function structuralProbe(id) {
  const source = fs.readFileSync(path.join(ROOT, PATHS[id]), 'utf8').replace(/\r\n/g, '\n');
  const contract = readJson('shared/' + id + '/module.contract.json');
  return {
    consumerId: id,
    importsExistingCore: source.includes("require('../../tools/deterministic-json-core')"),
    cloneUsesStrictCanonicalText: /function clone\(value\) \{\n\s+return JSON\.parse\(stableStringify\(value\)\);\n\}/.test(source),
    stableStringifyUsesExistingCore: /function stableStringify\(value\) \{\n\s+return DeterministicJson\.canonicalJson\(value\);\n\}/.test(source),
    contractRequiresExistingCore: contract.consumes.includes('strict-deterministic-canonical-json'),
    contractRefusesUnsafeState: contract.boundaries.refuses.includes('undefined-or-non-json-representable-state')
  };
}

function build() {
  const beforeAudit = readJson('docs/steward-runs/2026-08-20-receipt-serialization-closure/CURRENT_SERIALIZATION_CLOSURE_EVALUATION.json');
  const beforePilot = readJson('docs/steward-runs/2026-08-20-voluntary-choice-json-migration-pilot/CURRENT_MIGRATION_PILOT.json');
  const currentClosure = ClosureBuilder.build().evaluation;
  const afterRows = new Map(currentClosure.legacyConsumers.map((item) => [item.id, item]));
  const beforeRows = new Map(beforeAudit.legacyConsumers.map((item) => [item.id, item]));

  const evolution = EvolutionBuilder.build();
  const recordedPortfolio = readJson('docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CURRENT_PORTFOLIO.json');
  if (Growth.stableStringify(evolution.portfolio) !== Growth.stableStringify(recordedPortfolio)) throw new Error('recorded outcome portfolio drift');
  if (!Growth.verifyPortfolio(recordedPortfolio).pass || recordedPortfolio.portfolioDigest !== EXPECTED_DIGESTS['grounded-growth-outcomes']) {
    throw new Error('recorded outcome portfolio digest or verification drift');
  }

  const feedbackPacket = readJson('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_FEEDBACK_PACKET.json');
  if (!Feedback.verifyPacket(feedbackPacket).pass || feedbackPacket.packetDigest !== EXPECTED_DIGESTS['grounded-growth-feedback']) {
    throw new Error('recorded feedback packet digest or verification drift');
  }

  const convergence = ConvergenceBuilder.verifyRecorded();
  const recordedCurrent = readJson('docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CURRENT_STATE_RECEIPT.json');
  if (Current.stableStringify(convergence.receipt) !== Current.stableStringify(recordedCurrent)
    || recordedCurrent.receiptDigest !== EXPECTED_DIGESTS['grounded-growth-current-state']) {
    throw new Error('recorded current-state receipt drift');
  }

  const apis = {
    'grounded-growth-outcomes': Growth,
    'grounded-growth-feedback': Feedback,
    'grounded-growth-current-state': Current
  };
  const refusals = IDS.flatMap((id) => refusalProbe(id, apis[id]));
  if (refusals.some((item) => item.state !== 'REFUSED')) throw new Error('cohort unsafe fixture accepted');
  const buildPaths = buildPathProbes(recordedPortfolio, feedbackPacket);
  const structures = IDS.map(structuralProbe);
  if (structures.some((item) => Object.entries(item).some(([key, value]) => key === 'consumerId' ? false : value !== true))) {
    throw new Error('cohort source or contract structure is incomplete');
  }
  const persistence = persistenceProbe([
    { id: 'grounded-growth-outcomes', api: Growth, value: recordedPortfolio, digestField: 'portfolioDigest' },
    { id: 'grounded-growth-feedback', api: Feedback, value: feedbackPacket, digestField: 'packetDigest' },
    { id: 'grounded-growth-current-state', api: Current, value: recordedCurrent, digestField: 'receiptDigest' }
  ]);
  if (persistence.some((item) => Object.entries(item).some(([key, value]) => key === 'consumerId' ? false : key === 'temporaryFileRetained' ? value !== false : value !== true))) {
    throw new Error('cohort persistence probe incomplete');
  }

  const result = {
    schema: 'axm.grounded-growth-json-root-cohort/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: 'THREE_CONSUMER_ROOT_COHORT_MIGRATED_ON_REVIEW_BRANCH',
    dependencyReason: {
      root: 'grounded-growth-outcomes',
      directCloneSeamsClosedTogether: ['grounded-growth-feedback', 'grounded-growth-current-state'],
      reason: 'Migrating only the shared root would leave two direct consumers able to drop unsafe fields before delegation.'
    },
    before: {
      source: 'sealed voluntary-choice pilot',
      strictUnsafeRefusal: beforePilot.exposure.strictUnsafeRefusal,
      remainingUnsafeConsumers: beforePilot.exposure.remainingInvalidCanonicalText + beforePilot.exposure.remainingSilentFieldLoss
    },
    cohort: IDS.map((id) => ({
      id,
      path: PATHS[id],
      beforeSourceSha256: beforeRows.get(id).source.sha256,
      afterSourceSha256: normalizedSourceDigest(PATHS[id]),
      beforeBehavior: beforeRows.get(id).behavior,
      afterBehavior: afterRows.get(id).behavior,
      receiptSchemaChanged: false
    })),
    after: {
      consumers: currentClosure.counts.consumers,
      strictUnsafeRefusal: currentClosure.counts.unsafeValuesAlreadyRefused,
      remainingInvalidCanonicalText: currentClosure.counts.invalidCanonicalText,
      remainingSilentFieldLoss: currentClosure.counts.silentFieldLoss,
      remainingUnsafeConsumers: currentClosure.counts.invalidCanonicalText + currentClosure.counts.silentFieldLoss,
      remaining: currentClosure.legacyConsumers.filter((item) => item.behavior !== 'REFUSED_UNSAFE_VALUE').map((item) => ({ id: item.id, behavior: item.behavior })),
      rolloutComplete: false
    },
    structuralClosure: structures,
    unsafeFixtureResults: refusals,
    buildPathResults: buildPaths,
    historicalProductCompatibility: [
      { consumerId: 'grounded-growth-outcomes', artifact: 'CURRENT_PORTFOLIO.json', digest: recordedPortfolio.portfolioDigest, canonicalExact: true, nativeVerification: 'PASS' },
      { consumerId: 'grounded-growth-feedback', artifact: 'CURRENT_FEEDBACK_PACKET.json', digest: feedbackPacket.packetDigest, canonicalExact: true, nativeVerification: 'PASS' },
      { consumerId: 'grounded-growth-current-state', artifact: 'CURRENT_STATE_RECEIPT.json', digest: recordedCurrent.receiptDigest, canonicalExact: true, nativeVerification: 'PASS' }
    ],
    persistence,
    knownSourceEvolution: [
      { command: 'node docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/selftest.js', verdict: 'EXPECTED_STALE_AFTER_SOURCE_CHANGE', reason: 'dated verification receipt binds prior grounded-growth-outcomes source digest' },
      { command: 'node docs/steward-runs/2026-08-19-grounded-growth-current-convergence/selftest.js', verdict: 'EXPECTED_STALE_AFTER_SOURCE_CHANGE', reason: 'dated verification receipt binds prior grounded-growth-current-state source digest' },
      { command: 'node docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/selftest.js', verdict: 'EXPECTED_STALE_AFTER_SOURCE_CHANGE', reason: 'prior receipt evolution view binds prior current-state source digest' }
    ],
    requirements: [
      { id: 'three-module-structural-closure', verdict: 'PASS' },
      { id: '39-unsafe-fixture-refusals', verdict: 'PASS' },
      { id: 'three-real-build-path-refusals', verdict: 'PASS' },
      { id: 'three-historical-product-replays', verdict: 'PASS' },
      { id: 'three-persistence-roundtrips', verdict: 'PASS' },
      { id: 'clean-checkout-full-verification', verdict: 'NOT_RUN' }
    ],
    limits: {
      representationClosureOnly: true,
      semanticCorrectnessBeyondHistoricalCompatibilityProved: false,
      humanReviewRun: false,
      humanBenefitEstablished: false,
      browserParityTested: false,
      modelReasoningEquivalenceProved: false,
      shadowCloneCandidateEvaluated: false
    },
    authority: {
      branchOnly: true,
      installed: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false,
      consumersEditedThisCohort: 3
    },
    cohortDigest: null
  };
  const payload = clone(result);
  delete payload.cohortDigest;
  result.cohortDigest = rawSha256(Core.canonicalJson(payload));
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
  if (Core.canonicalJson(actual) !== Core.canonicalJson(expected)) throw new Error('recorded root cohort differs from current evidence');
  return expected;
}

if (require.main === module) {
  const result = process.argv.includes('--write') ? write() : checkRecorded();
  process.stdout.write(JSON.stringify({
    state: result.state,
    strictBefore: result.before.strictUnsafeRefusal,
    strictAfter: result.after.strictUnsafeRefusal,
    remainingUnsafeConsumers: result.after.remainingUnsafeConsumers,
    unsafeRefusals: result.unsafeFixtureResults.filter((item) => item.state === 'REFUSED').length,
    digest: result.cohortDigest
  }) + '\n');
}

module.exports = { ROOT, OUTPUT, GENERATED_AT, IDS, PATHS, build, write, checkRecorded };
