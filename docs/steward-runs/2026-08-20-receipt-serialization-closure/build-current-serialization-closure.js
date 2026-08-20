'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const Core = require(path.join(ROOT, 'tools/deterministic-json-core/index.js'));

const GENERATED_AT = '2026-08-20T02:00:00.000Z';
const EVALUATION_SCHEMA = 'axm.receipt-serialization-closure-evaluation/v1';
const MIGRATION_SCHEMA = 'axm.receipt-serialization-migration-profile/v1';

const CORE_PATHS = [
  'tools/deterministic-json-core/index.js',
  'tools/deterministic-json-core/manifest.json',
  'tools/deterministic-json-core/module.contract.json',
  'tools/deterministic-json-core/selftest.js'
];

const PUBLISHED_SNAPSHOT = {
  commit: '71a7f7bf9f1b2f1c526713431779ab1325c3eadf',
  sha256: {
    'tools/deterministic-json-core/index.js': 'sha256:7ef38c745ebe2b52ba21a9e0462fad8009c1ec04bd2a63fa4fed59e6ac83514a',
    'tools/deterministic-json-core/manifest.json': 'sha256:1da79c16246c56cc9a2a380ba9c7b3998e2bebd79fd693fe7a22bd9fe7b6eed2',
    'tools/deterministic-json-core/module.contract.json': 'sha256:2f5e1025d70a06186474aea2ab11204fb3a7f3e7937482f9e492a4880c1a1fd9',
    'tools/deterministic-json-core/selftest.js': 'sha256:3ad9b235a2fcd87ef6399d5cd31455beb51940b32522f32d5dbb86faf4685ed1'
  }
};

const CONSUMERS = [
  ['grounded-growth-challenger-lab', 'shared/grounded-growth-challenger-lab/grounded-growth-challenger-lab.js'],
  ['grounded-growth-current-state', 'shared/grounded-growth-current-state/grounded-growth-current-state.js'],
  ['grounded-growth-direction-handoff', 'shared/grounded-growth-direction-handoff/grounded-growth-direction-handoff.js'],
  ['grounded-growth-feedback', 'shared/grounded-growth-feedback/grounded-growth-feedback.js'],
  ['grounded-growth-frontier-gate', 'shared/grounded-growth-frontier-gate/grounded-growth-frontier-gate.js'],
  ['grounded-growth-human-bridge', 'shared/grounded-growth-human-bridge/grounded-growth-human-bridge.js'],
  ['grounded-growth-human-bridge-v2', 'shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2.js'],
  ['grounded-growth-human-handoff', 'shared/grounded-growth-human-handoff/grounded-growth-human-handoff.js'],
  ['grounded-growth-human-route-coverage', 'shared/grounded-growth-human-route-coverage/grounded-growth-human-route-coverage.js'],
  ['grounded-growth-knowledge-frontier', 'shared/grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier.js'],
  ['grounded-growth-outcomes', 'shared/grounded-growth-outcomes/grounded-growth-outcomes.js'],
  ['grounded-growth-participation-frontier', 'shared/grounded-growth-participation-frontier/grounded-growth-participation-frontier.js'],
  ['grounded-growth-phone-evidence-gate', 'shared/grounded-growth-phone-evidence-gate/grounded-growth-phone-evidence-gate.js'],
  ['grounded-growth-signal-lineage', 'shared/grounded-growth-signal-lineage/grounded-growth-signal-lineage.js'],
  ['grounded-growth-voluntary-choice-frontier', 'shared/grounded-growth-voluntary-choice-frontier/grounded-growth-voluntary-choice-frontier.js']
];

function canonicalSourceBytes(relativePath) {
  const text = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  return Buffer.from(text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'), 'utf8');
}

function sha256Source(relativePath) {
  return 'sha256:' + crypto.createHash('sha256').update(canonicalSourceBytes(relativePath)).digest('hex');
}

function sourceRef(relativePath, role) {
  return { path: relativePath, role, normalization: 'UTF8_LF', sha256: sha256Source(relativePath) };
}

function parsePriorFailure() {
  const relativePath = 'docs/steward-runs/2026-08-20-grounded-growth-voluntary-choice-frontier/SESSION_SEGMENT.jsonl';
  const lines = fs.readFileSync(path.join(ROOT, relativePath), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const event = lines.find((row) => row.sequence === 14 && row.event === 'receipt_serialization_failure_detected_and_repaired');
  if (!event) throw new Error('the observed serialization failure event is absent');
  if (event.detail.gateFailure !== false || event.detail.recordedOutcomes !== 10) {
    throw new Error('the observed serialization failure event changed');
  }
  return {
    source: sourceRef(relativePath, 'OBSERVED_FAILURE_EVENT_LOG'),
    sequence: event.sequence,
    event: event.event,
    failure: event.detail.failure,
    localRepair: event.detail.repair,
    gateFailure: event.detail.gateFailure,
    recordedOutcomes: event.detail.recordedOutcomes
  };
}

function classification(text, expectedKey) {
  if (typeof text !== 'string') return 'INVALID_CANONICAL_TEXT';
  try {
    const parsed = JSON.parse(text);
    return Object.prototype.hasOwnProperty.call(parsed, expectedKey)
      ? 'UNSAFE_VALUE_PRESERVED'
      : 'SILENT_FIELD_LOSS';
  } catch (_) {
    return 'INVALID_CANONICAL_TEXT';
  }
}

function legacyProbe(id, relativePath) {
  const api = require(path.join(ROOT, relativePath));
  if (typeof api.stableStringify !== 'function') throw new Error(id + ' does not export stableStringify');
  let output = null;
  let error = null;
  try {
    output = api.stableStringify({ safe: 1, lost: undefined });
  } catch (caught) {
    error = caught.name + ': ' + caught.message;
  }
  return {
    id,
    source: sourceRef(relativePath, 'CURRENT_CONSUMER_IMPLEMENTATION'),
    fixture: 'object-property-undefined',
    behavior: error ? 'REFUSED_UNSAFE_VALUE' : classification(output, 'lost'),
    output: typeof output === 'string' ? output : null,
    error
  };
}

function unsafeFixtures() {
  const sparse = [];
  sparse.length = 1;
  const cycle = {};
  cycle.self = cycle;
  return [
    ['root-undefined', undefined],
    ['object-property-undefined', { safe: 1, lost: undefined }],
    ['nested-undefined', { nested: { lost: undefined } }],
    ['array-undefined', [1, undefined]],
    ['sparse-array', sparse],
    ['nan', { number: NaN }],
    ['positive-infinity', { number: Infinity }],
    ['negative-infinity', { number: -Infinity }],
    ['bigint', { number: 1n }],
    ['symbol', { value: Symbol('x') }],
    ['function', { value: function value() {} }],
    ['date', { value: new Date('2026-08-20T00:00:00.000Z') }],
    ['cycle', cycle]
  ];
}

function safeFixtures() {
  const nullPrototype = Object.create(null);
  nullPrototype.b = 2;
  nullPrototype.a = 1;
  const shared = { x: 1 };
  return [
    ['sorted-object-keys', { z: 1, a: [true, null, 'x'] }],
    ['unicode-and-escaping', { 'line\nkey': 'snowman ☃ and quote "' }],
    ['negative-zero-normalization', { value: -0 }],
    ['null-prototype-map', nullPrototype],
    ['repeated-non-cyclic-reference', { left: shared, right: shared }],
    ['nested-arrays-and-objects', [{ b: 2, a: 1 }, [], { deep: [false, 0, null] }]]
  ];
}

function evaluateCore() {
  const unsafe = [];
  unsafeFixtures().forEach(([id, value]) => {
    try {
      Core.canonicalJson(value);
      unsafe.push({ id, state: 'UNSAFE_ACCEPTED', error: null });
    } catch (error) {
      unsafe.push({ id, state: 'REFUSED', error: error.name + ': ' + error.message });
    }
  });

  const safe = safeFixtures().map(([id, value]) => {
    try {
      const canonical = Core.canonicalJson(value);
      const parsed = JSON.parse(canonical);
      return {
        id,
        state: Core.canonicalJson(parsed) === canonical ? 'ROUNDTRIP_EXACT' : 'ROUNDTRIP_DRIFT',
        canonical
      };
    } catch (error) {
      return { id, state: 'SAFE_FIXTURE_REFUSED', canonical: null, error: error.name + ': ' + error.message };
    }
  });
  return { unsafe, safe };
}

function build() {
  CORE_PATHS.forEach((relativePath) => {
    if (sha256Source(relativePath) !== PUBLISHED_SNAPSHOT.sha256[relativePath]) {
      throw new Error('existing capability no longer matches published snapshot: ' + relativePath);
    }
  });
  const observedFailure = parsePriorFailure();
  const legacy = CONSUMERS.map(([id, relativePath]) => legacyProbe(id, relativePath));
  const core = evaluateCore();
  const invalid = legacy.filter((row) => row.behavior === 'INVALID_CANONICAL_TEXT').length;
  const silent = legacy.filter((row) => row.behavior === 'SILENT_FIELD_LOSS').length;
  const refused = legacy.filter((row) => row.behavior === 'REFUSED_UNSAFE_VALUE').length;
  const unsafeRefused = core.unsafe.filter((row) => row.state === 'REFUSED').length;
  const safeExact = core.safe.filter((row) => row.state === 'ROUNDTRIP_EXACT').length;

  const evaluation = {
    schema: EVALUATION_SCHEMA,
    version: 'v0.1',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: unsafeRefused === core.unsafe.length && safeExact === core.safe.length
      ? 'EXISTING_CAPABILITY_OUTPERFORMS_LEGACY_ON_HELD_OUT_CLOSURE'
      : 'INSUFFICIENT_EVIDENCE',
    observedFailure,
    capability: {
      id: 'deterministic-json-core',
      provenance: 'BYTE_IDENTICAL_TO_PREVIOUSLY_PUBLISHED_AXM_SNAPSHOT',
      publishedCommit: PUBLISHED_SNAPSHOT.commit,
      implementationCreatedByThisLane: false,
      sources: CORE_PATHS.map((relativePath) => ({
        ...sourceRef(relativePath, 'EXISTING_CAPABILITY_SOURCE'),
        publishedSnapshotSha256: PUBLISHED_SNAPSHOT.sha256[relativePath],
        canonicalTextIdentity: true
      }))
    },
    legacyConsumers: legacy,
    heldOutEvaluation: core,
    counts: {
      consumers: legacy.length,
      invalidCanonicalText: invalid,
      silentFieldLoss: silent,
      unsafeValuesAlreadyRefused: refused,
      unsafeFixtures: core.unsafe.length,
      unsafeFixturesRefused: unsafeRefused,
      safeFixtures: core.safe.length,
      safeFixturesRoundtripExact: safeExact
    },
    decision: {
      state: 'REUSE_EXISTING_CAPABILITY_FOR_MIGRATION_REVIEW',
      adoption: 'REVIEW_CANDIDATE_NOT_AUTHORIZED',
      reason: 'A known strict capability closes the observed representation failure and all held-out closure cases without adding another serializer.'
    },
    limits: {
      representationClosureOnly: true,
      schemaValidityProved: false,
      semanticCorrectnessProved: false,
      cryptographicAuthenticityProved: false,
      crossRuntimeParityLiveTested: false,
      consumersMigrated: false,
      humanBenefitEstablished: false,
      modelReasoningEquivalenceProved: false
    },
    authority: {
      installed: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false,
      consumerEdits: 0
    }
  };

  const migration = {
    schema: MIGRATION_SCHEMA,
    version: 'v0.1',
    generatedAt: GENERATED_AT,
    status: 'EXPERIMENTAL',
    state: 'MIGRATION_REVIEW_REQUIRED',
    capabilityId: 'deterministic-json-core',
    observedFailureRef: {
      path: observedFailure.source.path,
      sha256: observedFailure.source.sha256,
      sequence: observedFailure.sequence
    },
    consumers: legacy.map((row) => ({
      id: row.id,
      path: row.source.path,
      sourceSha256: row.source.sha256,
      currentUnsafeBehavior: row.behavior,
      migrationState: 'NOT_AUTHORIZED'
    })),
    requiredFutureChecks: [
      'canonicalize before digest or persistence',
      'parse the canonical text before persistence',
      'bind digests to canonical text or the parsed JSON-safe value',
      'write and read back the persisted receipt',
      're-canonicalize the read-back value and require exact equality',
      'run each consumer native verifier and historical replay checks'
    ],
    rolloutBoundary: {
      editConsumersInThisLane: false,
      migrateAllAtOnce: false,
      preserveHistoricalReceipts: true,
      requirePathScopedReview: true,
      requireCleanCheckoutVerification: true
    },
    deferredContinuityDirection: {
      name: 'deterministic-continuity-mirror',
      state: 'DIRECTION_ONLY_WAIT_FOR_PLATFORM_CANDIDATE',
      purpose: 'Independently replay sealed deterministic evidence around model work and report agreement dissent or insufficient evidence.',
      modelReasoningEquivalenceClaimed: false,
      integrationAuthorityGranted: false
    }
  };
  return { evaluation, migration };
}

function verify(evaluation, migration) {
  const errors = [];
  let rebuilt;
  try { rebuilt = build(); } catch (error) { return { pass: false, errors: ['rebuild failed: ' + error.message] }; }
  if (Core.canonicalJson(rebuilt.evaluation) !== Core.canonicalJson(evaluation)) errors.push('evaluation does not rebuild exactly');
  if (Core.canonicalJson(rebuilt.migration) !== Core.canonicalJson(migration)) errors.push('migration profile does not rebuild exactly');
  if (evaluation.state !== 'EXISTING_CAPABILITY_OUTPERFORMS_LEGACY_ON_HELD_OUT_CLOSURE') errors.push('held-out evidence does not support the scoped decision');
  if (!evaluation.observedFailure || evaluation.observedFailure.sequence !== 14) errors.push('observed failure is not bound');
  if (evaluation.counts.consumers !== 15) errors.push('consumer inventory is incomplete');
  if (evaluation.counts.unsafeFixturesRefused !== evaluation.counts.unsafeFixtures) errors.push('not every unsafe fixture was refused');
  if (evaluation.counts.safeFixturesRoundtripExact !== evaluation.counts.safeFixtures) errors.push('not every safe fixture roundtrips exactly');
  if (evaluation.limits.humanBenefitEstablished || evaluation.limits.modelReasoningEquivalenceProved) errors.push('unsupported benefit or reasoning claim');
  if (evaluation.authority.consumerEdits !== 0 || evaluation.authority.installed || evaluation.authority.promoted || evaluation.authority.merged || evaluation.authority.canonized) errors.push('authority boundary crossed');
  if (migration.consumers.some((row) => row.migrationState !== 'NOT_AUTHORIZED')) errors.push('consumer migration was represented as authorized');
  if (migration.deferredContinuityDirection.state !== 'DIRECTION_ONLY_WAIT_FOR_PLATFORM_CANDIDATE') errors.push('deferred mirror direction advanced without a candidate');
  return { pass: errors.length === 0, errors };
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(__dirname, relativePath), JSON.stringify(value, null, 2) + '\n');
}

function main() {
  const result = build();
  if (process.argv.includes('--write')) {
    writeJson('CURRENT_SERIALIZATION_CLOSURE_EVALUATION.json', result.evaluation);
    writeJson('CURRENT_MIGRATION_PROFILE.json', result.migration);
  } else {
    const evaluation = JSON.parse(fs.readFileSync(path.join(__dirname, 'CURRENT_SERIALIZATION_CLOSURE_EVALUATION.json'), 'utf8'));
    const migration = JSON.parse(fs.readFileSync(path.join(__dirname, 'CURRENT_MIGRATION_PROFILE.json'), 'utf8'));
    const checked = verify(evaluation, migration);
    if (!checked.pass) throw new Error(checked.errors.join('; '));
  }
  process.stdout.write('receipt-serialization-closure: PASS\n');
}

if (require.main === module) main();

module.exports = { build, verify, EVALUATION_SCHEMA, MIGRATION_SCHEMA };
