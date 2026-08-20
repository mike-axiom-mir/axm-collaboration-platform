#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Choice = require('../../../shared/grounded-growth-voluntary-choice-frontier/grounded-growth-voluntary-choice-frontier');
const FrontierBuilder = require('../2026-08-20-grounded-growth-voluntary-choice-frontier/build-current-voluntary-choice-frontier');
const ClosureBuilder = require('../2026-08-20-receipt-serialization-closure/build-current-serialization-closure');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'CURRENT_MIGRATION_PILOT.json');
const GENERATED_AT = '2026-08-20T03:40:00.000Z';
const CONSUMER_ID = 'grounded-growth-voluntary-choice-frontier';
const CONSUMER_PATH = 'shared/grounded-growth-voluntary-choice-frontier/grounded-growth-voluntary-choice-frontier.js';
const EXPECTED_HISTORICAL_DIGEST = 'sha256:a919c4e1731a4d1d0d1bfe98c0ffd291f42b1b18580484603e647fee6f3ddc1a';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function normalizedSourceDigest(relativePath) {
  const text = fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  return Choice.sha256(text);
}

function payloadDigest(receipt) {
  const payload = JSON.parse(Choice.stableStringify(receipt));
  delete payload.frontierDigest;
  return Choice.sha256(payload);
}

function unsafeProbe() {
  const sparse = [];
  sparse.length = 1;
  const cycle = {};
  cycle.self = cycle;
  const fixtures = [
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
  return fixtures.map(([id, value]) => {
    try {
      Choice.stableStringify(value);
      return { id, state: 'ACCEPTED_UNSAFE', error: null };
    } catch (error) {
      return { id, state: 'REFUSED', error: error.name + ': ' + error.message };
    }
  });
}

function persistenceProbe(receipt) {
  const canonical = Choice.stableStringify(receipt);
  const parsedBeforeWrite = JSON.parse(canonical);
  if (Choice.stableStringify(parsedBeforeWrite) !== canonical) throw new Error('pre-write canonical roundtrip drift');
  const canonicalDigest = Choice.sha256(canonical);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-choice-json-pilot-'));
  const tempFile = path.join(tempRoot, 'receipt.json');
  try {
    fs.writeFileSync(tempFile, canonical, 'utf8');
    const readBack = fs.readFileSync(tempFile, 'utf8');
    const parsedAfterRead = JSON.parse(readBack);
    const canonicalAfterRead = Choice.stableStringify(parsedAfterRead);
    return {
      parsedBeforeWrite: true,
      writeCompleted: true,
      readCompleted: true,
      parsedAfterRead: true,
      canonicalExactAfterRead: canonicalAfterRead === canonical,
      canonicalDigestBound: Choice.sha256(readBack) === canonicalDigest,
      payloadDigestBound: payloadDigest(parsedAfterRead) === parsedAfterRead.frontierDigest,
      temporaryFileRetained: false
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function build() {
  const before = readJson('docs/steward-runs/2026-08-20-receipt-serialization-closure/CURRENT_SERIALIZATION_CLOSURE_EVALUATION.json');
  const beforeConsumer = before.legacyConsumers.find((item) => item.id === CONSUMER_ID);
  if (!beforeConsumer) throw new Error('pre-migration consumer evidence missing');
  const currentClosure = ClosureBuilder.build().evaluation;
  const afterConsumer = currentClosure.legacyConsumers.find((item) => item.id === CONSUMER_ID);
  if (!afterConsumer) throw new Error('post-migration consumer evidence missing');

  const current = FrontierBuilder.checkRecorded();
  const recorded = readJson('docs/steward-runs/2026-08-20-grounded-growth-voluntary-choice-frontier/CURRENT_VOLUNTARY_CHOICE_FRONTIER.json');
  const rebuiltCanonical = Choice.stableStringify(current.frontier);
  const recordedCanonical = Choice.stableStringify(recorded);
  if (rebuiltCanonical !== recordedCanonical) throw new Error('historical frontier canonical text changed');
  if (current.frontier.frontierDigest !== EXPECTED_HISTORICAL_DIGEST) throw new Error('historical frontier digest changed');
  if (payloadDigest(current.frontier) !== current.frontier.frontierDigest) throw new Error('frontier payload digest is not bound');

  const unsafe = unsafeProbe();
  if (unsafe.some((item) => item.state !== 'REFUSED')) throw new Error('unsafe fixture was accepted');
  const persistence = persistenceProbe(current.frontier);
  if (Object.entries(persistence).some(([key, value]) => key === 'temporaryFileRetained' ? value !== false : value !== true)) {
    throw new Error('persistence probe did not close every declared seam');
  }

  const result = {
    schema: 'axm.receipt-serialization-migration-pilot/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: 'ONE_CONSUMER_MIGRATED_ON_REVIEW_BRANCH',
    consumer: {
      id: CONSUMER_ID,
      path: CONSUMER_PATH,
      selectionReason: 'ZERO_EXTERNAL_CODE_REFERENCES_IN_SECURED_SOURCE_TREE',
      permissionlessLeaf: true,
      receiptSchemaChanged: false,
      before: {
        sourceSha256: beforeConsumer.source.sha256,
        behavior: beforeConsumer.behavior,
        output: beforeConsumer.output
      },
      after: {
        sourceSha256: normalizedSourceDigest(CONSUMER_PATH),
        behavior: afterConsumer.behavior,
        output: afterConsumer.output,
        error: afterConsumer.error
      }
    },
    exposure: {
      consumers: currentClosure.counts.consumers,
      remainingInvalidCanonicalText: currentClosure.counts.invalidCanonicalText,
      remainingSilentFieldLoss: currentClosure.counts.silentFieldLoss,
      strictUnsafeRefusal: currentClosure.counts.unsafeValuesAlreadyRefused,
      migrationCompleteForAllConsumers: false
    },
    historicalCompatibility: {
      recordedFrontierDigest: recorded.frontierDigest,
      rebuiltFrontierDigest: current.frontier.frontierDigest,
      expectedFrontierDigest: EXPECTED_HISTORICAL_DIGEST,
      canonicalTextExact: rebuiltCanonical === recordedCanonical,
      payloadDigestExact: payloadDigest(current.frontier) === current.frontier.frontierDigest
    },
    unsafeFixtures: unsafe,
    persistence,
    requirements: [
      { id: 'canonicalize-before-digest-or-persistence', verdict: 'PASS' },
      { id: 'parse-canonical-text-before-persistence', verdict: 'PASS' },
      { id: 'bind-digests-to-canonical-payload', verdict: 'PASS' },
      { id: 'write-read-recanonicalize-exact', verdict: 'PASS' },
      { id: 'native-verifier-and-historical-replay', verdict: 'PASS' },
      { id: 'clean-checkout-full-verification', verdict: 'NOT_RUN' }
    ],
    limits: {
      representationClosureOnly: true,
      schemaValidityProved: false,
      semanticCorrectnessBeyondHistoricalCompatibilityProved: false,
      browserParityTested: false,
      humanReviewRun: false,
      humanBenefitEstablished: false,
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
      otherConsumersEdited: 0
    },
    pilotDigest: null
  };
  const digestPayload = JSON.parse(Choice.stableStringify(result));
  delete digestPayload.pilotDigest;
  result.pilotDigest = Choice.sha256(digestPayload);
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
  if (Choice.stableStringify(actual) !== Choice.stableStringify(expected)) throw new Error('recorded migration pilot differs from current evidence');
  return expected;
}

if (require.main === module) {
  const result = process.argv.includes('--write') ? write() : checkRecorded();
  process.stdout.write(JSON.stringify({
    state: result.state,
    consumer: result.consumer.id,
    before: result.consumer.before.behavior,
    after: result.consumer.after.behavior,
    remainingUnsafeConsumers: result.exposure.remainingInvalidCanonicalText + result.exposure.remainingSilentFieldLoss,
    digest: result.pilotDigest
  }) + '\n');
}

module.exports = { ROOT, OUTPUT, GENERATED_AT, CONSUMER_ID, CONSUMER_PATH, build, write, checkRecorded };
