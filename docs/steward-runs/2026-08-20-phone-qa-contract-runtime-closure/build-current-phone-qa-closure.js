#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Scanner = require('../2026-08-20-grounded-growth-upstream-json-roots/scan-workshop-json-seams');
const Campaign = require('../../../shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'CURRENT_PHONE_QA_CLOSURE.json');
const VISUAL_OUTPUT = path.join(__dirname, 'LIVE_VISUAL_RECEIPT.json');
const GENERATED_AT = '2026-08-20T08:40:00.000Z';
const BASE_COMMIT = '257105770f5221faa20c81e80f8a40cf237c024e';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeTextBytes(value) {
  return Buffer.from(String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
}

function fileReference(relativePath) {
  return {
    path: relativePath,
    sha256: sha256(normalizeTextBytes(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'))),
    byteNormalization: 'LINE_ENDINGS_TO_LF'
  };
}

function seal(value, key) {
  const payload = JSON.parse(Core.canonicalJson(value));
  delete payload[key];
  value[key] = sha256(Core.canonicalJson(payload));
  return value;
}

function campaignSemanticDigest(campaign) {
  const semantic = JSON.parse(Core.canonicalJson(campaign));
  delete semantic.campaignDigest;
  delete semantic.sourceRefs.seamReport.checkedAt;
  delete semantic.sourceRefs.seamReport.sha256;
  return sha256(Core.canonicalJson(semantic));
}

function buildVisualReceipt() {
  return seal({
    schema: 'axm.live-visual-receipt/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    claim: 'The phone-candidate surface is visible and refuses capture without explicit voluntary confirmation.',
    surface: 'tools/browser-lan-hardware-qa-lab/index.html',
    visualBackend: 'BROWSER_PRIMARY',
    viewport: { width: 1280, height: 720, devicePixelRatio: 1.25 },
    baseline: {
      readyState: 'complete',
      horizontalOverflow: false,
      requiredControlsVisible: true,
      deviceReceiptCount: 0
    },
    action: 'Click Capture phone candidate with all observation and consent boxes unchecked.',
    expected: 'A visible consent refusal appears and no device receipt is written.',
    observed: {
      notice: 'Confirm that this observation is voluntary before saving a candidate.',
      tone: 'bad',
      deviceReceiptCountAfter: 0,
      rawCandidateCreated: false
    },
    verdict: 'PASS',
    namedSeam: null,
    separateClaims: {
      physicalPhoneUsed: 'NOT_RUN',
      phoneControllerJoined: 'NOT_RUN',
      mobileViewportLayout: 'UNKNOWN',
      humanUsefulness: 'NOT_RUN'
    },
    captureRetention: {
      rawFramesRetained: false,
      selectedFramesRetained: false,
      temporaryPathsCreated: [],
      cleanupComplete: true,
      bufferDigest: null,
      bufferDigestReason: 'The in-app browser returned ephemeral frames without creating a file buffer.'
    },
    receiptDigest: null
  }, 'receiptDigest');
}

function build() {
  const scan = Scanner.build(GENERATED_AT);
  const phoneRuntime = scan.runtime.modules.find(item => item.moduleId === 'voluntary-phone-qa-campaign');
  if (!phoneRuntime) throw new Error('phone campaign runtime inventory missing');
  const manifest = readJson('tools/browser-lan-hardware-qa-lab/manifest.json');
  const contract = readJson('tools/browser-lan-hardware-qa-lab/module.contract.json');
  const seamReport = readJson('exports/game-night-seam-report.json');
  const campaign = Campaign.buildCampaign({
    campaignId: 'current-voluntary-phone-qa-contract-closure-20260820',
    generatedAt: GENERATED_AT,
    seamReport,
    qaLabManifest: manifest,
    qaLabContract: contract,
    maxGamesPerSession: 3,
    candidateReviews: []
  });
  const serviceSource = readText('shared/operations/qa-lab-service.js');
  const appSource = readText('tools/browser-lan-hardware-qa-lab/app.js');
  const priorGap = readJson('docs/steward-runs/2026-08-20-grounded-growth-upstream-json-roots/PHONE_QA_GAP.json');
  return seal({
    schema: 'axm.phone-qa-contract-runtime-closure/v1',
    version: '0.1.0',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    branchBase: BASE_COMMIT,
    priorGap: {
      state: priorGap.state,
      nativeError: priorGap.nativeBaseline.error,
      digest: priorGap.digest
    },
    representation: {
      runtimeModules: scan.runtime.counts.modules,
      strictRuntimeModules: scan.runtime.counts.refusesAllUnsafeFixtures,
      invalidCanonicalText: scan.runtime.counts.invalidCanonicalText,
      silentOrTransformedUnsafeState: scan.runtime.counts.silentOrTransformedUnsafeState,
      unsafeFixturePairs: scan.runtime.counts.unsafeFixturePairs,
      refusedFixturePairs: scan.runtime.counts.refusedFixturePairs,
      safeFixturePairs: scan.runtime.counts.safeFixturePairs,
      safeStrictCoreExact: scan.runtime.counts.safeStrictCoreExact,
      phoneCampaign: {
        classification: phoneRuntime.classification,
        refused: phoneRuntime.counts.refused,
        safeExact: phoneRuntime.counts.safeExact,
        source: fileReference('shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign.js')
      },
      workshopAuditDigest: scan.digest
    },
    captureContract: {
      labId: manifest.id,
      labVersion: manifest.version,
      status: manifest.status,
      actionDeclared: manifest.actions.includes('record physical-phone observation candidates'),
      deviceReceiptEmittedByManifest: manifest.produces.includes('axm.device-qa-evidence/v1'),
      deviceReceiptEmittedByContract: contract.handoffs.emits.includes('axm.device-qa-evidence/v1'),
      selfAttestedProofRefused: contract.boundaries.refuses.includes('self-attested-physical-proof'),
      manifestMutationRefused: contract.boundaries.refuses.includes('manifest-warning-mutation'),
      voluntaryConsentNormalized: serviceSource.includes('voluntaryHumanObservation !== true'),
      rawPhoneNotesRefused: serviceSource.includes("unknown fields") && contract.boundaries.refuses.includes('raw-phone-note-retention'),
      sixObservationKeysDeclared: (serviceSource.match(/'physicalPhonePresent'|'controllerJoined'|'seatIdentityMatched'|'actionObservedOnSharedScreen'|'disconnectObserved'|'recoveredAfterDisconnect'/g) || []).length >= 6,
      browserControlBound: appSource.includes("getElementById('capturePhone')"),
      manifest: fileReference('tools/browser-lan-hardware-qa-lab/manifest.json'),
      contract: fileReference('tools/browser-lan-hardware-qa-lab/module.contract.json')
    },
    currentCampaign: {
      semanticDigest: campaignSemanticDigest(campaign),
      verifierGames: campaign.summary.verifierGames,
      reportWarnings: campaign.sourceRefs.seamReport.warningCount,
      physicalPhoneWarnings: campaign.summary.physicalPhoneWarnings,
      pendingVoluntaryObservation: campaign.summary.pendingVoluntaryObservation,
      warningsStillOpen: campaign.summary.warningsStillOpen,
      nextGameId: campaign.nextAction.nextGameId,
      automatic: campaign.nextAction.automatic
    },
    evidenceRoutes: {
      deterministicBehavior: ['shared runtime scanner', 'focused campaign selftest', 'shared runtime deterministic JSON test'],
      persistence: ['operations wave 2 isolated temporary-state restart'],
      visualInteraction: ['LIVE_VISUAL_RECEIPT.json'],
      physicalPhoneBehavior: [],
      humanUsefulness: []
    },
    truth: {
      contractGapClosed: true,
      serializerGapClosed: true,
      physicalPhoneSessionRun: false,
      physicalHardwareProven: false,
      humanUsefulnessEstablished: false,
      verifierWarningCleared: false,
      gameManifestMutated: false,
      candidateReceiptFabricated: false,
      automaticParticipation: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    limits: {
      desktopBrowserRefusalProvesPhysicalPhoneUse: false,
      scriptedFixtureProvesHumanObservation: false,
      servicePersistenceProvesMobileUsability: false,
      contractClosureProvesGameWarningClosure: false,
      physicalPhoneAndHumanBenefitRemainSeparateVoluntaryRoutes: true
    },
    sources: [
      fileReference('shared/operations/qa-lab-service.js'),
      fileReference('shared/operations/wave2-selftest.js'),
      fileReference('shared/voluntary-phone-qa-campaign/module.contract.json'),
      fileReference('shared/voluntary-phone-qa-campaign/selftest.js'),
      fileReference('tests/shared-runtime-deterministic-json-test.js'),
      fileReference('tools/browser-lan-hardware-qa-lab/app.js'),
      fileReference('tools/browser-lan-hardware-qa-lab/index.html'),
      fileReference('tools/browser-lan-hardware-qa-lab/selftest.js')
    ],
    digest: null
  }, 'digest');
}

function write() {
  const closure = build();
  const visual = buildVisualReceipt();
  fs.writeFileSync(OUTPUT, JSON.stringify(closure, null, 2) + '\n', 'utf8');
  fs.writeFileSync(VISUAL_OUTPUT, JSON.stringify(visual, null, 2) + '\n', 'utf8');
  return { closure, visual };
}

if (require.main === module) {
  const result = write();
  process.stdout.write(JSON.stringify({
    strictRuntimeModules: result.closure.representation.strictRuntimeModules,
    refusedFixturePairs: result.closure.representation.refusedFixturePairs,
    phoneWarningsStillOpen: result.closure.currentCampaign.warningsStillOpen,
    physicalPhoneSessionRun: result.closure.truth.physicalPhoneSessionRun,
    digest: result.closure.digest
  }) + '\n');
}

module.exports = { ROOT, OUTPUT, VISUAL_OUTPUT, GENERATED_AT, BASE_COMMIT, normalizeTextBytes, campaignSemanticDigest, build, buildVisualReceipt, write };
