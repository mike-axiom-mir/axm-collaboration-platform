#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Builder = require('./build-current-phone-qa-closure');
const Campaign = require('../../../shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function digestWithout(value, key) {
  const payload = JSON.parse(Core.canonicalJson(value));
  delete payload[key];
  return 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
}

const closure = readJson('CURRENT_PHONE_QA_CLOSURE.json');
const visual = readJson('LIVE_VISUAL_RECEIPT.json');
const before = readJson('CAPABILITY_GAP_BEFORE.json');
const after = readJson('CAPABILITY_GAP_AFTER.json');
const rebuiltClosure = Builder.build();
const rebuiltVisual = Builder.buildVisualReceipt();

function campaignWithReportAt(checkedAt) {
  const report = JSON.parse(fs.readFileSync(path.join(Builder.ROOT, 'exports/game-night-seam-report.json'), 'utf8'));
  report.checkedAt = checkedAt;
  return Campaign.buildCampaign({
    campaignId: 'current-voluntary-phone-qa-contract-closure-20260820',
    generatedAt: Builder.GENERATED_AT,
    seamReport: report,
    qaLabManifest: JSON.parse(fs.readFileSync(path.join(Builder.ROOT, 'tools/browser-lan-hardware-qa-lab/manifest.json'), 'utf8')),
    qaLabContract: JSON.parse(fs.readFileSync(path.join(Builder.ROOT, 'tools/browser-lan-hardware-qa-lab/module.contract.json'), 'utf8')),
    maxGamesPerSession: 3,
    candidateReviews: []
  });
}

check(Core.sameCanonical(closure, rebuiltClosure), 'recorded closure exactly rebuilds from current source');
check(Core.sameCanonical(visual, rebuiltVisual), 'recorded visual receipt exactly rebuilds from bounded observations');
check(Builder.normalizeTextBytes('alpha\r\nbeta\rgamma').toString('utf8') === 'alpha\nbeta\ngamma', 'source references normalize Windows and legacy line endings to LF');
check(closure.digest === digestWithout(closure, 'digest'), 'closure digest seals strict canonical payload bytes');
check(visual.receiptDigest === digestWithout(visual, 'receiptDigest'), 'visual receipt digest seals strict canonical payload bytes');

check(closure.priorGap.state === 'DEFERRED_CONTRACT_AND_EVIDENCE_GAP', 'prior phone-QA gap remains preserved as history');
check(closure.priorGap.nativeError === 'QA Lab device evidence handoff missing', 'prior native failure remains exact');
check(closure.representation.runtimeModules === 13 && closure.representation.strictRuntimeModules === 13, 'all thirteen exported runtime surfaces are strict');
check(closure.representation.invalidCanonicalText === 0 && closure.representation.silentOrTransformedUnsafeState === 0, 'no exported runtime surface returns invalid or silently transformed unsafe state');
check(closure.representation.unsafeFixturePairs === 169 && closure.representation.refusedFixturePairs === 169, 'all 169 unsafe fixture pairs refuse');
check(closure.representation.safeFixturePairs === 78 && closure.representation.safeStrictCoreExact === 78, 'all 78 safe fixture pairs remain exact');
check(closure.representation.phoneCampaign.classification === 'REFUSES_ALL_UNSAFE_FIXTURES', 'phone campaign is classified as strict');
check(closure.representation.phoneCampaign.refused === 13 && closure.representation.phoneCampaign.safeExact === 6, 'phone campaign refuses thirteen unsafe and preserves six safe fixtures');
const volatileCampaignA = campaignWithReportAt('2026-08-20T08:00:00.000Z');
const volatileCampaignB = campaignWithReportAt('2026-08-20T09:00:00.000Z');
check(volatileCampaignA.campaignDigest !== volatileCampaignB.campaignDigest, 'native campaign digest still records verifier timestamp provenance');
check(Builder.campaignSemanticDigest(volatileCampaignA) === Builder.campaignSemanticDigest(volatileCampaignB), 'closure semantic digest excludes only volatile verifier provenance');

check(closure.captureContract.actionDeclared, 'QA Lab manifest declares candidate capture action');
check(closure.captureContract.deviceReceiptEmittedByManifest && closure.captureContract.deviceReceiptEmittedByContract, 'manifest and contract both declare device receipt handoff');
check(closure.captureContract.selfAttestedProofRefused && closure.captureContract.manifestMutationRefused, 'capture contract refuses proof self-attestation and manifest mutation');
check(closure.captureContract.voluntaryConsentNormalized && closure.captureContract.rawPhoneNotesRefused, 'service requires voluntary confirmation and refuses raw phone notes');
check(closure.captureContract.sixObservationKeysDeclared && closure.captureContract.browserControlBound, 'six bounded observations and browser action are wired');

check(closure.currentCampaign.verifierGames === 18 && closure.currentCampaign.reportWarnings === 35, 'campaign derives current verifier and report counts');
check(closure.currentCampaign.physicalPhoneWarnings === 14 && closure.currentCampaign.warningsStillOpen === 14, 'all fourteen current physical-phone warnings remain open');
check(closure.currentCampaign.pendingVoluntaryObservation === 14 && closure.currentCampaign.automatic === false, 'campaign queues voluntary observations without automatic participation');

check(visual.verdict === 'PASS' && visual.baseline.requiredControlsVisible && !visual.baseline.horizontalOverflow, 'desktop browser baseline visibly passes its bounded layout claim');
check(visual.observed.tone === 'bad' && visual.observed.notice === 'Confirm that this observation is voluntary before saving a candidate.', 'desktop browser journey exposes the exact consent refusal');
check(visual.baseline.deviceReceiptCount === 0 && visual.observed.deviceReceiptCountAfter === 0 && !visual.observed.rawCandidateCreated, 'refused browser action writes no candidate receipt');
check(visual.separateClaims.physicalPhoneUsed === 'NOT_RUN' && visual.separateClaims.phoneControllerJoined === 'NOT_RUN', 'visual receipt does not substitute desktop interaction for physical-phone proof');
check(visual.separateClaims.mobileViewportLayout === 'UNKNOWN' && visual.separateClaims.humanUsefulness === 'NOT_RUN', 'mobile layout and human usefulness remain unclaimed');
check(!visual.captureRetention.rawFramesRetained && !visual.captureRetention.selectedFramesRetained && visual.captureRetention.cleanupComplete, 'raw live-visual frames are not retained');

check(before.overall === 'UNKNOWN', 'before capability report preserves the required unknown browser route');
check(before.requirements.filter((item) => item.required).every((item) => item.status === 'DEGRADED' || item.status === 'UNKNOWN'), 'all eight required capabilities were degraded or unknown before closure');
check(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after report is locally ready but globally degraded by optional real-world gaps');
check(after.requirements.filter((item) => item.required).every((item) => item.status === 'READY'), 'all eight required locally provable capabilities are ready');
check(after.requirements.find((item) => item.id === 'physical-phone-session').status === 'DEGRADED', 'physical-phone session remains degraded');
check(after.requirements.find((item) => item.id === 'human-usefulness').status === 'DEGRADED', 'human usefulness remains degraded');
check(after.requirements.find((item) => item.id === 'mobile-viewport-visual-proof').status === 'OPTIONAL_UNKNOWN', 'mobile viewport remains optional unknown');

check(closure.truth.contractGapClosed && closure.truth.serializerGapClosed, 'closure is bounded to contract and serializer facts');
check(!closure.truth.physicalPhoneSessionRun && !closure.truth.physicalHardwareProven && !closure.truth.humanUsefulnessEstablished, 'closure makes no physical-phone or human-benefit claim');
check(!closure.truth.verifierWarningCleared && !closure.truth.gameManifestMutated && !closure.truth.candidateReceiptFabricated, 'closure clears no warnings, mutates no game manifest, and fabricates no receipt');
check(!closure.truth.automaticParticipation && !closure.truth.automaticPromotion && !closure.truth.automaticMerge && !closure.truth.automaticCanon, 'closure uses no automatic participation or authority escalation');
check(!closure.truth.foundationMutation, 'closure does not mutate the Foundation');
check(closure.evidenceRoutes.physicalPhoneBehavior.length === 0 && closure.evidenceRoutes.humanUsefulness.length === 0, 'unrun physical and human routes contain no substitute evidence');

console.log('PASS phone-QA contract/runtime closure selftest (' + checks + ' assertions)');
