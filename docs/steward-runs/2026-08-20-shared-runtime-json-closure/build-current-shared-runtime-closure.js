#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const PreviousScanner = require('../2026-08-20-grounded-growth-upstream-json-roots/scan-workshop-json-seams');
const SensoriumParity = require('../../../shared/sensorium/automation/parity-guard');

const ROOT = path.resolve(__dirname, '../../..');
const PARENT_COMMIT = '0985fd4676ae31af9f6f6c92b3512526cbb3bc0f';
const GENERATED_AT = '2026-08-20T07:40:00.000Z';
const PREVIOUS_AUDIT = path.join(__dirname, '..', '2026-08-20-grounded-growth-upstream-json-roots', 'CURRENT_WORKSHOP_JSON_AUDIT.json');
const CURRENT_AUDIT = path.join(__dirname, 'CURRENT_WORKSHOP_JSON_AUDIT.json');
const OUTPUT = path.join(__dirname, 'CURRENT_SHARED_RUNTIME_CLOSURE.json');
const SELECTED = [
  { id: 'cognitive-resource', path: 'shared/cognitive-resource/cognitive-resource-core.js' },
  { id: 'holodeck', path: 'shared/holodeck/core.js' },
  { id: 'mirror-core', path: 'shared/mirror-core/core/utils.js' },
  { id: 'sensorium', path: 'shared/sensorium/core.js' },
  { id: 'verification-snapshot-continuity', path: 'shared/verification-snapshot-continuity/verification-snapshot-continuity.js' },
  { id: 'verification-source-evolution-review', path: 'shared/verification-source-evolution-review/verification-source-evolution-review.js' }
];

function rawSha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function seal(value) {
  value.digest = null;
  const payload = JSON.parse(Core.canonicalJson(value));
  delete payload.digest;
  value.digest = rawSha256(Core.canonicalJson(payload));
  return value;
}

function verifyDigest(value, label) {
  const payload = JSON.parse(Core.canonicalJson(value));
  const digest = payload.digest;
  delete payload.digest;
  if (digest !== rawSha256(Core.canonicalJson(payload))) throw new Error(label + ' digest mismatch');
}

function moduleIdForPath(relativePath) {
  const selected = SELECTED.find(item => item.path === relativePath);
  return selected ? selected.id : relativePath.split('/').slice(0, -1).pop();
}

function buildAudit() {
  const audit = PreviousScanner.build(GENERATED_AT);
  audit.version = '0.2.0';
  audit.parentCommit = PARENT_COMMIT;
  audit.evolution = {
    previousAuditRef: 'docs/steward-runs/2026-08-20-grounded-growth-upstream-json-roots/CURRENT_WORKSHOP_JSON_AUDIT.json',
    selectedRuntimeClosure: SELECTED.map(item => item.id),
    fullWorkshopClosureClaimed: false
  };
  audit.runtime.modules.forEach(item => { item.moduleId = moduleIdForPath(item.path); });
  audit.selectedCohort = {
    moduleIds: SELECTED.map(item => item.id),
    reason: 'the six remaining safe exported shared-runtime canonical JSON surfaces after the upstream-root v0.5 closure',
    automaticPromotion: false,
    migrationAuthority: 'REVIEW_BRANCH_ONLY'
  };
  audit.deferredCandidates = [{
    moduleId: 'voluntary-phone-qa-campaign',
    gapTypes: ['CONTRACT', 'EVIDENCE'],
    reason: 'the existing generic QA Lab does not declare the campaign-required game-specific physical-phone observation candidate route',
    requiredCapabilities: ['phone.qa.current-contract-compatible', 'phone.qa.physical-observation-capture']
  }];
  audit.limits.browserBehaviorProvedByThisAudit = false;
  seal(audit);
  fs.writeFileSync(CURRENT_AUDIT, JSON.stringify(audit, null, 2) + '\n', 'utf8');
  return audit;
}

function persistenceProof(apis) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-shared-runtime-json-'));
  const rows = [];
  let mirrorUnsafe = null;
  let cleanupComplete = false;
  try {
    for (const item of SELECTED) {
      const file = path.join(temporary, item.id + '.json');
      const value = { z: [3, 2, 1], a: { ok: true } };
      const canonical = apis[item.id].stableStringify(value);
      fs.writeFileSync(file, canonical, 'utf8');
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      rows.push({
        moduleId: item.id,
        canonicalSha256: rawSha256(canonical),
        bytesExactAfterRead: apis[item.id].stableStringify(parsed) === canonical
      });
      fs.unlinkSync(file);
    }
    const unsafeTarget = path.join(temporary, 'mirror-unsafe.json');
    let refused = false;
    let error = null;
    try {
      apis['mirror-core'].atomicWriteJson(unsafeTarget, { lost: undefined });
    } catch (caught) {
      refused = true;
      error = caught.name + ': ' + caught.message;
    }
    mirrorUnsafe = {
      refused,
      error,
      targetExists: fs.existsSync(unsafeTarget),
      partialFileCount: fs.readdirSync(temporary).length
    };
    cleanupComplete = fs.readdirSync(temporary).length === 0;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  return { rows, mirrorUnsafe, cleanupComplete, temporaryPathRetained: false };
}

function build() {
  const previous = readJson(PREVIOUS_AUDIT);
  verifyDigest(previous, 'previous audit');
  const current = buildAudit();
  verifyDigest(current, 'current audit');

  const previousByPath = new Map(previous.runtime.modules.map(item => [item.path, item]));
  const currentByPath = new Map(current.runtime.modules.map(item => [item.path, item]));
  const apis = Object.fromEntries(SELECTED.map(item => [item.id, require(path.join(ROOT, item.path))]));
  const migration = SELECTED.map(item => {
    const before = previousByPath.get(item.path);
    const after = currentByPath.get(item.path);
    const source = fs.readFileSync(path.join(ROOT, item.path), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const safeBefore = new Map(before.safe.map(row => [row.fixtureId, row]));
    return {
      moduleId: item.id,
      path: item.path,
      beforeClassification: before.classification,
      currentClassification: after.classification,
      beforeUnsafeRefused: before.counts.refused,
      currentUnsafeRefused: after.counts.refused,
      currentSafeExact: after.counts.safeExact,
      safeFixtureBytesUnchanged: after.safe.every(row => safeBefore.get(row.fixtureId).canonicalSha256 === row.canonicalSha256),
      sourceChangedFromBefore: before.sourceSha256 !== after.sourceSha256,
      importsExistingCore: source.includes('deterministic-json-core'),
      canonicalBoundaryPresent: source.includes('DeterministicJson.canonicalJson'),
      automaticPromotion: false
    };
  });

  const persistence = persistenceProof(apis);
  const parity = SensoriumParity.check();
  const visual = readJson(path.join(__dirname, 'HOLODECK_VISUAL_RECEIPT.json'));
  const sensoriumDependency = readJson(path.join(__dirname, 'SENSORIUM_TEST_DEPENDENCY.json'));
  const snapshotContract = readJson(path.join(ROOT, 'shared/verification-snapshot-continuity/module.contract.json'));
  const evolutionContract = readJson(path.join(ROOT, 'shared/verification-source-evolution-review/module.contract.json'));
  const composerHtml = fs.readFileSync(path.join(ROOT, 'tools/holodeck-composer/index.html'), 'utf8');
  const screenHtml = fs.readFileSync(path.join(ROOT, 'tools/holodeck-screen-deck/index.html'), 'utf8');
  const dependencyScript = '../../tools/deterministic-json-core/index.js';
  const holodeckScript = '../../shared/holodeck/core.js';

  const closure = seal({
    schema: 'axm.shared-runtime-json-closure/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    parentCommit: PARENT_COMMIT,
    previousAudit: {
      ref: 'docs/steward-runs/2026-08-20-grounded-growth-upstream-json-roots/CURRENT_WORKSHOP_JSON_AUDIT.json',
      digest: previous.digest,
      runtime: previous.runtime.counts,
      static: previous.static.counts
    },
    currentAudit: {
      ref: 'docs/steward-runs/2026-08-20-shared-runtime-json-closure/CURRENT_WORKSHOP_JSON_AUDIT.json',
      digest: current.digest,
      runtime: current.runtime.counts,
      static: current.static.counts
    },
    delta: {
      strictRuntimeModules: current.runtime.counts.refusesAllUnsafeFixtures - previous.runtime.counts.refusesAllUnsafeFixtures,
      invalidCanonicalTextModules: current.runtime.counts.invalidCanonicalText - previous.runtime.counts.invalidCanonicalText,
      silentOrTransformedModules: current.runtime.counts.silentOrTransformedUnsafeState - previous.runtime.counts.silentOrTransformedUnsafeState,
      unsafeFixtureRefusals: current.runtime.counts.refusedFixturePairs - previous.runtime.counts.refusedFixturePairs,
      strictCoreReferences: current.static.counts.strictCoreReferenced - previous.static.counts.strictCoreReferenced,
      potentialRepresentationSeams: current.static.counts.potentialRepresentationSeams - previous.static.counts.potentialRepresentationSeams
    },
    migration,
    persistence,
    sensoriumGeneratedParity: {
      verdict: parity.verdict,
      checkedArtifacts: parity.checkedArtifacts,
      driftCount: parity.drift.length,
      repair: 'LF checkout policy aligned with unchanged exact-byte comparator'
    },
    holodeckBrowser: {
      receipt: 'HOLODECK_VISUAL_RECEIPT.json',
      verdict: visual.claims.every(claim => claim.verdict === 'PASS') ? 'PASS' : 'FAIL',
      claimCount: visual.claims.length,
      cleanupComplete: visual.retention.cleanupComplete,
      composerDependencyBeforeCore: composerHtml.indexOf(dependencyScript) < composerHtml.indexOf(holodeckScript),
      screenDeckDependencyBeforeCore: screenHtml.indexOf(dependencyScript) < screenHtml.indexOf(holodeckScript)
    },
    contractEvolution: [
      { id: snapshotContract.id, version: snapshotContract.version, strictCoreConsumed: snapshotContract.consumes.includes('tools/deterministic-json-core strict canonical JSON') },
      { id: evolutionContract.id, version: evolutionContract.version, strictCoreConsumed: evolutionContract.consumes.includes('tools/deterministic-json-core strict canonical JSON') }
    ],
    typedGaps: [
      { id: 'voluntary-phone-qa-current-contract', state: 'DEFERRED_CONTRACT_AND_EVIDENCE_GAP', treatedAsPassingProductCheck: false },
      { id: 'sensorium-clean-checkout-full-suite', state: sensoriumDependency.classification, treatedAsPassingSelfContainedCheck: false },
      { id: 'remaining-workshop-representation-seams', state: 'OUTSIDE_BOUNDED_EXPORTED_RUNTIME_CLOSURE', count: current.static.counts.potentialRepresentationSeams },
      { id: 'future-shadow-clone-system', state: 'CANDIDATE_NOT_RECEIVED', implemented: false }
    ],
    limits: {
      fullWorkshopRepresentationClosureProved: false,
      nonExportedHelperRuntimeProved: false,
      allBrowserSerializationProved: false,
      nonJavaScriptRuntimeProved: false,
      cleanCheckoutSensoriumFullSuiteProved: false,
      humanBenefitEstablished: false,
      modelLearningImprovementEstablished: false,
      shadowCloneCandidateEvaluated: false
    },
    authority: {
      install: false,
      permissionGrant: false,
      promotion: false,
      merge: false,
      canon: false,
      foundationMutation: false
    },
    digest: null
  });

  if (migration.some(item => item.currentClassification !== 'REFUSES_ALL_UNSAFE_FIXTURES' || item.currentUnsafeRefused !== 13 || item.currentSafeExact !== 6 || !item.safeFixtureBytesUnchanged || !item.sourceChangedFromBefore || !item.importsExistingCore || !item.canonicalBoundaryPresent)) {
    throw new Error('selected runtime closure is incomplete');
  }
  if (current.runtime.counts.refusesAllUnsafeFixtures !== 12 || current.runtime.modules.filter(item => item.classification !== 'REFUSES_ALL_UNSAFE_FIXTURES').map(item => item.moduleId).join(',') !== 'voluntary-phone-qa-campaign') {
    throw new Error('current runtime inventory differs from bounded claim');
  }
  if (!persistence.cleanupComplete || !persistence.rows.every(item => item.bytesExactAfterRead) || !persistence.mirrorUnsafe.refused || persistence.mirrorUnsafe.targetExists || persistence.mirrorUnsafe.partialFileCount) {
    throw new Error('persistence proof failed');
  }
  if (parity.verdict !== 'PASS' || parity.checkedArtifacts !== 33 || !closure.holodeckBrowser.composerDependencyBeforeCore || !closure.holodeckBrowser.screenDeckDependencyBeforeCore || closure.holodeckBrowser.verdict !== 'PASS') {
    throw new Error('generated parity or browser dependency proof failed');
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(closure, null, 2) + '\n', 'utf8');
  return closure;
}

if (require.main === module) {
  const closure = build();
  process.stdout.write(JSON.stringify({
    selected: closure.migration.length,
    currentStrictRuntimeModules: closure.currentAudit.runtime.refusesAllUnsafeFixtures,
    unsafeFixtureRefusals: closure.currentAudit.runtime.refusedFixturePairs,
    safeFixturePairsExact: closure.currentAudit.runtime.safeStrictCoreExact,
    persistenceJourneys: closure.persistence.rows.length,
    sensoriumParity: closure.sensoriumGeneratedParity.verdict,
    holodeckBrowser: closure.holodeckBrowser.verdict,
    digest: closure.digest
  }) + '\n');
}

module.exports = { ROOT, PARENT_COMMIT, GENERATED_AT, PREVIOUS_AUDIT, CURRENT_AUDIT, OUTPUT, SELECTED, build };
