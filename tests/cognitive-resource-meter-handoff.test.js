'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Reader = require('../adapters/workshop/cognitive-resource-meter-reader');
const Handoff = require('../organs/cognitive-resource-meter-handoff-organ');
const Metrology = require('../kernel/cognitive-work-metrology-cell');
const Economics = require('../kernel/cognitive-resource-economics-cell');

const ROOT = path.resolve(__dirname, '..');
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function fileSha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function policy(enabled = true) {
  return {
    schema: 'axm.mirror.training-policy/v1',
    cognitiveResourceMeterHandoffObservationEnabled: enabled,
    cognitiveResourceMeterHandoffObservationScope: 'bounded-typed-declaration-and-export-read-only no-automatic-intake no-evidence-admission no-selection-or-budget-authority',
    automaticRuntimePromotion: false,
    automaticCanonPromotion: false,
    automaticAuthorityGrowth: false
  };
}

function workDraft(permissionStatus = 'ALLOWED') {
  return {
    schema: Metrology.DRAFT_SCHEMA,
    source: {
      sourceSystemId: 'workshop.test-meter/v1', sourceRecordId: 'private-goal-record-0', sourceRecordDigest: sha('source-0'),
      collectionMethod: 'DIRECT_MACHINE_METER', authorshipState: 'DECLARED_NOT_CERTIFIED', measurementDefinitionDigest: sha('meter-v1')
    },
    objective: { objectiveKind: 'REPOSITORY_STEWARDSHIP', objectiveDigest: sha('objective'), startingStateDigest: sha('start'), endingStateDigest: sha('end') },
    workShape: {
      operationKinds: ['VERIFY', 'EDIT'], domainKinds: ['SOFTWARE_RESEARCH'], requestedOutputKinds: ['TESTED_REPOSITORY_CHANGE'],
      riskTier: 'MEDIUM', requiredVerificationKinds: ['NODE_TEST']
    },
    execution: {
      modelProfileDigest: sha('model'), toolchainDigest: sha('tools'), environmentDigest: sha('environment'), hardwareProfileDigest: sha('hardware'),
      tokenMeter: { definitionId: 'goal-total-tokens/v1', coverage: 'COMPLETE', inputTokens: 10, cachedInputTokens: 2, outputTokens: 20, reasoningTokens: 30, totalTokens: 100 },
      computeMeter: { definitionId: 'local-process/v1', coverage: 'COMPLETE', cpuCoreMilliseconds: 1000, acceleratorMilliseconds: null, peakMemoryBytes: 1000000, providerComputeUnitsMicros: null },
      timing: { wallMilliseconds: 900, toolMilliseconds: 100 },
      workCounts: { filesExamined: 10, filesChanged: 2, linesAdded: 20, linesRemoved: 3, toolCalls: 4 },
      verification: { testsExecuted: 2, testsPassed: 2, testsFailed: 0, testsNotRun: 0, verificationDigest: sha('verification') }
    },
    outcome: { state: 'VERIFIED_COMPLETE', status: 'TEST', preexistingImplementationState: 'SUBSTANTIAL' },
    costObservation: { basis: 'UNKNOWN', profileDigest: null, currency: null, moneyMicros: null, energyMilliwattHours: null, carbonMilligrams: null },
    permission: { status: permissionStatus, basisDigest: permissionStatus === 'ALLOWED' ? sha('permission') : null }
  };
}

function economicsDraft(permissionStatus = 'ALLOWED') {
  return {
    schema: Economics.PROFILE_DRAFT_SCHEMA,
    source: {
      sourceSystemId: 'workshop.rate-source/v1', sourceRecordId: 'private-rate-record-1', sourceRecordDigest: sha('rates-source'),
      collectionMethod: 'DIRECT_BILLING_SCHEDULE', authorshipState: 'DECLARED_NOT_CERTIFIED', rateScheduleDigest: sha('rates-v1'),
      effectiveWindowId: 'window-2026-07', freshnessState: 'CURRENT_DECLARED_NOT_CERTIFIED'
    },
    scope: {
      accountingMode: 'PROVIDER_TOKEN_BILLING', currency: 'EUR', modelProfileDigest: sha('model'), hardwareProfileDigest: null,
      tokenMeterDefinitionId: 'goal-total-tokens/v1', computeMeterDefinitionId: null
    },
    components: [{ metric: 'TOTAL_TOKENS', quantityDenominator: 1000, moneyMicrosPerQuantity: 1000, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null }],
    permission: { status: permissionStatus, basisDigest: permissionStatus === 'ALLOWED' ? sha('permission') : null }
  };
}

function fixture(t) {
  const workshopRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-cognitive-resource-handoff-'));
  const moduleDir = path.join(workshopRoot, 'tools', Reader.MODULE_ID);
  const sharedDir = path.join(workshopRoot, 'shared', 'cognitive-resource');
  const contractDir = path.join(sharedDir, 'contracts');
  const exportDir = path.join(workshopRoot, 'exports', Reader.MODULE_ID);
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.mkdirSync(contractDir, { recursive: true });
  fs.mkdirSync(exportDir, { recursive: true });
  const bindings = Object.entries(Reader.CONTRACTS).map(([schemaId, expected]) => {
    const source = path.join(ROOT, expected.relativeMirrorPath);
    const name = path.basename(expected.relativeMirrorPath);
    const target = path.join(contractDir, name);
    fs.copyFileSync(source, target);
    return { schemaId, path: `contracts/${name}`, sha256: fileSha(target), outputKind: expected.outputKind };
  }).sort((left, right) => left.schemaId.localeCompare(right.schemaId));
  writeJson(path.join(moduleDir, 'manifest.json'), {
    id: Reader.MODULE_ID, version: 'v0.1', status: 'TEST', contract: 'module.contract.json', permissions: [Reader.REQUIRED_PERMISSION],
    produces: bindings.map(item => item.outputKind).concat(['COGNITIVE_RESOURCE_LEDGER_RECEIPT', 'PRIVACY_SAFE_MACHINE_PROFILE_DIGEST'])
  });
  writeJson(path.join(moduleDir, 'module.contract.json'), {
    schema: 'axm.module-contract/v1', id: Reader.MODULE_ID, version: 'v0.1', status: 'TEST', permissions: [Reader.REQUIRED_PERMISSION],
    consumes: bindings.map(item => `contract:${item.schemaId}@${item.sha256}`),
    handoffs: { emits: bindings.map(item => item.outputKind), accepts: [] },
    boundaries: { refuses: Reader.REQUIRED_REFUSALS.slice() }
  });
  writeJson(path.join(sharedDir, 'provider-declarations.json'), {
    schema: 'axm.cognitive-resource-hand-provider-catalog/v1', version: '1.0.0', status: 'TEST', contractBindings: bindings,
    providers: [{ id: 'test-provider/v1', automaticCapture: false }],
    hands: Reader.REQUIRED_HANDS.map(id => ({ id, automaticAuthority: false })),
    authority: { writesMirror: false, calculatesMirrorResult: false, selects: false, trains: false, promotesCanon: false, actsOnWorld: false }
  });
  t.after(() => fs.rmSync(workshopRoot, { recursive: true, force: true }));
  return { workshopRoot, moduleDir, sharedDir, exportDir };
}

test('a declared Workshop handoff verifies as a TEST producer with two byte-identical contracts and no exports', t => {
  const fx = fixture(t);
  const observation = Reader.observe({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT });
  assert.equal(observation.state, 'DECLARED_TEST_PROVIDER_NO_EXPORTED_DRAFTS');
  assert.equal(observation.declaration.status, 'TEST');
  assert.equal(observation.declaration.bindings.length, 2);
  assert.equal(observation.declaration.handsDeclared, 8);
  assert.deepEqual(observation.declaration.additionalOutputKinds, []);
  assert.equal(observation.sourceStability, 'STABLE_ACROSS_SECOND_READ');
  assert.equal(observation.summary.observationsAdmitted, 0);
  assert.equal(Reader.verifyObservation(observation), true);
});

test('valid exact exports become review candidates without intake, sealing, draft-content persistence, or authority', t => {
  const fx = fixture(t);
  writeJson(path.join(fx.exportDir, 'observation.json'), workDraft());
  writeJson(path.join(fx.exportDir, 'economics.json'), economicsDraft());
  const bundleDir = path.join(fx.exportDir, 'bundles');
  fs.mkdirSync(bundleDir);
  fs.writeFileSync(path.join(bundleDir, 'evidence.zip'), 'opaque-bundle-bytes-never-opened');
  const stateDir = path.join(fx.workshopRoot, 'mirror-private-handoff-state');
  const observationState = path.join(fx.workshopRoot, 'must-not-write-observations');
  const economicsState = path.join(fx.workshopRoot, 'must-not-write-economics');
  const result = Handoff.run({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT, stateDir, policy: policy() });
  assert.equal(result.assessment.state, 'EXPLICIT_INTAKE_CANDIDATES_OBSERVED');
  assert.equal(result.assessment.summary.explicitIntakeCandidates, 2);
  assert.equal(result.assessment.summary.opaqueBundleArchivesObserved, 1);
  assert.equal(result.assessment.workshopObservation.bundles[0].state, 'OPAQUE_EVIDENCE_BUNDLE_OBSERVED_NOT_OPENED_NOT_INTAKE');
  assert.equal(result.assessment.summary.observationsAdmitted, 0);
  assert.equal(result.assessment.summary.economicsProfilesAdmitted, 0);
  assert.equal(fs.existsSync(observationState), false);
  assert.equal(fs.existsSync(economicsState), false);
  const persisted = fs.readFileSync(path.join(result.runDir, 'assessment.json'), 'utf8');
  assert.doesNotMatch(persisted, /private-goal-record-0|private-rate-record-1|opaque-bundle-bytes-never-opened/);
  assert.ok(Object.entries(result.assessment.authority).every(([key, value]) => key === 'privateHandoffAssessmentWrite' ? value === true : value === false));
  assert.equal(Handoff.verifyAssessment(result.assessment, result.assessment.workshopObservation, result.runDir), true);
});

test('unknown permission and malformed or undeclared exports remain visible holds rather than evidence', t => {
  const fx = fixture(t);
  writeJson(path.join(fx.exportDir, 'unknown-permission.json'), workDraft('UNKNOWN'));
  const malformed = economicsDraft();
  malformed.hiddenAuthority = true;
  writeJson(path.join(fx.exportDir, 'malformed.json'), malformed);
  writeJson(path.join(fx.exportDir, 'unknown-schema.json'), { schema: 'axm.unknown/draft-v1', permission: { status: 'ALLOWED' } });
  const observation = Reader.observe({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT });
  assert.equal(observation.state, 'HOLD_DRAFTS_REQUIRE_REVIEW');
  assert.deepEqual(observation.exports.map(item => item.state), [
    'REFUSED_INVALID_OR_UNBOUND_DRAFT',
    'HOLD_PERMISSION_NOT_ALLOWED',
    'REFUSED_UNDECLARED_OUTPUT_SCHEMA'
  ]);
  assert.equal(observation.summary.explicitIntakeCandidates, 0);
  assert.equal(observation.summary.heldOrRefusedExports, 3);
  assert.equal(observation.summary.observationsAdmitted, 0);
});

test('additive Workshop outputs and permissions remain visible without gaining intake or evidence authority', t => {
  const fx = fixture(t);
  const manifestFile = path.join(fx.moduleDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.permissions.push('cognitive.measure.local');
  manifest.produces.push('COGNITIVE_EVIDENCE_BUNDLE', 'SEPARATE_DIMENSION_RESOURCE_TIMELINE');
  writeJson(manifestFile, manifest);
  const contractFile = path.join(fx.moduleDir, 'module.contract.json');
  const contract = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
  contract.permissions.push('cognitive.measure.local');
  contract.handoffs.emits.push('COGNITIVE_EVIDENCE_BUNDLE', 'SEPARATE_DIMENSION_RESOURCE_TIMELINE');
  writeJson(contractFile, contract);
  const catalogFile = path.join(fx.sharedDir, 'provider-declarations.json');
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  catalog.hands.push({ id: 'future-separate-dimension-timeline-hand', automaticAuthority: false });
  writeJson(catalogFile, catalog);
  const observation = Reader.observe({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT });
  assert.deepEqual(observation.declaration.additionalOutputKinds, ['COGNITIVE_EVIDENCE_BUNDLE', 'SEPARATE_DIMENSION_RESOURCE_TIMELINE']);
  assert.deepEqual(observation.declaration.additionalHandIds, ['future-separate-dimension-timeline-hand']);
  assert.equal(observation.state, 'DECLARED_TEST_PROVIDER_NO_EXPORTED_DRAFTS');
  assert.equal(observation.summary.observationsAdmitted, 0);
  assert.ok(Object.values(observation.authority).every(value => value === false));
});

test('declaration authority, contract drift, missing refusals, traversal, and unexpected export entries fail closed', async t => {
  await t.test('automatic provider capture', t2 => {
    const fx = fixture(t2);
    const file = path.join(fx.sharedDir, 'provider-declarations.json');
    const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
    catalog.providers[0].automaticCapture = true;
    writeJson(file, catalog);
    assert.throws(() => Reader.observe({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT }), /automatic capture boundary/);
  });
  await t.test('contract byte drift', t2 => {
    const fx = fixture(t2);
    const file = path.join(fx.sharedDir, 'contracts', 'cognitive-work-observation-draft.schema.json');
    fs.appendFileSync(file, ' ');
    assert.throws(() => Reader.observe({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT }), /contract bytes diverged/);
  });
  await t.test('missing refusal', t2 => {
    const fx = fixture(t2);
    const file = path.join(fx.moduleDir, 'module.contract.json');
    const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
    contract.boundaries.refuses = contract.boundaries.refuses.filter(item => item !== 'mirror-write');
    writeJson(file, contract);
    assert.throws(() => Reader.observe({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT }), /refusal boundary is incomplete/);
  });
  await t.test('contract traversal', t2 => {
    const fx = fixture(t2);
    const file = path.join(fx.sharedDir, 'provider-declarations.json');
    const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
    catalog.contractBindings[0].path = '../../outside.json';
    writeJson(file, catalog);
    assert.throws(() => Reader.observe({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT }), /escapes its declared root/);
  });
  await t.test('unexpected export directory', t2 => {
    const fx = fixture(t2);
    fs.mkdirSync(path.join(fx.exportDir, 'nested'));
    assert.throws(() => Reader.observe({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT }), /unexpected cognitive-resource-meter export entry/);
  });
});

test('export ordering is deterministic and the explicit policy gate refuses disabled observation', t => {
  const first = fixture(t);
  const second = fixture(t);
  writeJson(path.join(first.exportDir, 'z-observation.json'), workDraft());
  writeJson(path.join(first.exportDir, 'a-economics.json'), economicsDraft());
  writeJson(path.join(second.exportDir, 'a-economics.json'), economicsDraft());
  writeJson(path.join(second.exportDir, 'z-observation.json'), workDraft());
  const left = Reader.observe({ workshopRoot: first.workshopRoot, mirrorRoot: ROOT });
  const right = Reader.observe({ workshopRoot: second.workshopRoot, mirrorRoot: ROOT });
  assert.deepEqual(left.exports, right.exports);
  assert.equal(left.observationDigest, right.observationDigest);
  assert.throws(() => Handoff.run({ workshopRoot: first.workshopRoot, mirrorRoot: ROOT, stateDir: path.join(first.workshopRoot, 'disabled'), policy: policy(false) }), /not enabled/);
});

test('absent Workshop and absent module are explicit non-capability states', t => {
  const fx = fixture(t);
  const absentWorkshop = Reader.observe({ workshopRoot: path.join(fx.workshopRoot, 'absent'), environment: {}, configRoot: ROOT });
  assert.equal(absentWorkshop.state, 'WORKSHOP_ABSENT');
  assert.equal(Reader.verifyObservation(absentWorkshop), true);
  fs.rmSync(fx.moduleDir, { recursive: true, force: true });
  const absentModule = Reader.observe({ workshopRoot: fx.workshopRoot, mirrorRoot: ROOT });
  assert.equal(absentModule.state, 'COGNITIVE_RESOURCE_METER_ABSENT');
  assert.equal(absentModule.declaration, null);
  assert.equal(absentModule.summary.observationsAdmitted, 0);
});

test('contracts, command, policy, BOM, status, and active runtime separation remain explicit', () => {
  const observationContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'cognitive-resource-meter-workshop-observation.schema.json'), 'utf8'));
  const assessmentContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'cognitive-resource-meter-handoff-assessment.schema.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const trainingPolicy = JSON.parse(fs.readFileSync(path.join(ROOT, 'training', 'TRAINING_POLICY.json'), 'utf8'));
  const status = JSON.parse(fs.readFileSync(path.join(ROOT, 'STATUS.json'), 'utf8'));
  const bom = JSON.parse(fs.readFileSync(path.join(ROOT, 'MODEL_BOM.json'), 'utf8'));
  assert.equal(observationContract.$id, Reader.SCHEMA);
  assert.equal(assessmentContract.$id, Handoff.ASSESSMENT_SCHEMA);
  assert.equal(packageJson.scripts['observe:cognitive-resource-meter-handoff'], 'node scripts/observe-cognitive-resource-meter-handoff.js');
  assert.equal(trainingPolicy.cognitiveResourceMeterHandoffObservationEnabled, true);
  assert.match(status.cognitiveResourceMeterHandoffOrgan, /^TEST_/);
  assert.equal(status.cognitiveResourceMeterHandoffEvidence.exportedDraftsObserved, 0);
  assert.ok(bom.deterministicEvaluationOrgans.some(item => item.path === 'organs/cognitive-resource-meter-handoff-organ.js'));
  const runtimeSource = fs.readdirSync(path.join(ROOT, 'runtime'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => fs.readFileSync(path.join(ROOT, 'runtime', entry.name), 'utf8'))
    .join('\n');
  assert.doesNotMatch(runtimeSource, /cognitive-resource-meter-handoff-organ|cognitive-resource-meter-reader/);
});
