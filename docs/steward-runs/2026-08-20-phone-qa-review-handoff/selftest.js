#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const root = path.resolve(__dirname, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const requirements = read('CAPABILITY_REQUIREMENTS.json');
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const visual = read('LIVE_VISUAL_RECEIPT.json');
const snapshot = read('SOURCE_SNAPSHOT.json');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools/browser-lan-hardware-qa-lab/manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'tools/browser-lan-hardware-qa-lab/module.contract.json'), 'utf8'));
const campaignContract = JSON.parse(fs.readFileSync(path.join(root, 'shared/voluntary-phone-qa-campaign/module.contract.json'), 'utf8'));
const api = fs.readFileSync(path.join(root, 'shared/operations/operations-api.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'shared/operations/qa-lab-service.js'), 'utf8');

check(requirements.requirements.length === 8, 'capability requirements cover adapter, authority, durability, live UI, and open human routes');
check(before.overall === 'UNKNOWN' && before.requirements.some(item => item.required && item.status !== 'READY'), 'before report records the contract gap without pretending readiness');
check(after.overall === 'DEGRADED' && after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'after report closes every required adapter route while optional evidence stays open');
check(after.requirements.find(item => item.id === 'actual-human-review').status === 'OPTIONAL_UNKNOWN', 'actual human review remains explicitly unrun');
check(visual.verdict === 'PASS' && visual.typedObservation.reviewRouteVisibleAndUsable === true && visual.typedObservation.horizontalOverflow === false, 'live desktop route is visually observed without overflow');
check(visual.typedObservation.actualPhysicalPhoneObserved === false && visual.typedObservation.actualHumanReviewPerformed === false && visual.typedObservation.humanUsefulnessObserved === false, 'visual receipt refuses physical, human-review, and usefulness overclaims');
check(visual.cleanup.cleanupComplete === true && visual.cleanup.temporaryFilesCreated === 0 && visual.cleanup.fixtureQaAndReviewReceiptsDeleted === true, 'temporary visual and fixture state cleanup is recorded');
check(manifest.version === 'v0.3' && contract.version === manifest.version && manifest.status === 'TEST', 'QA Lab contract advances coherently and remains TEST');
check(contract.boundaries.writes.includes('state/review-inbox') && contract.boundaries.refuses.includes('non-human-review-as-campaign-input') && contract.boundaries.refuses.includes('review-note-export'), 'module contract declares the reused inbox and export refusals');
check(campaignContract.version === 'v0.2' && campaignContract.consumes.includes('browser-lan-hardware-qa-lab:v0.3'), 'campaign contract binds the upgraded QA Lab');
check(api.includes("explicit-phone-review-open") && api.includes("url === '/api/qa-lab/phone-review' && req.method === 'GET'"), 'API separates explicit review opening from bounded review reading');
check(service.includes("PHONE_REVIEW_KIND = 'phone-qa-observation-candidate'") && service.includes("latest.actorKind !== 'human'") && service.includes("decision = 'INCOMPLETE'"), 'service implements exact phone kind, human-only export, and incomplete downgrade');
check(!service.includes('candidateReview.note') && !service.includes('rawReviewNote:'), 'campaign handoff implementation introduces no review-note field');
check(visual.settledFrames.every(item => /^sha256:[a-f0-9]{64}$/.test(item.digest)), 'selected live frames retain typed SHA-256 references only');
check(snapshot.schema === 'axm.source-snapshot/v1' && snapshot.status === 'TEST' && snapshot.sources.length === 14 && snapshot.sources.every(item => item.byteNormalization === 'LINE_ENDINGS_TO_LF'), 'source snapshot declares fourteen normalized TEST inputs');
check(snapshot.sources.every(item => {
  const normalized = fs.readFileSync(path.join(root, item.path), 'utf8').replace(/\r\n?/g, '\n');
  const digest = 'sha256:' + crypto.createHash('sha256').update(normalized).digest('hex');
  return digest === item.sha256;
}), 'source snapshot digests match current normalized source bytes');

if (fs.existsSync(path.join(__dirname, 'CHECK_RESULTS.json'))) {
  const results = read('CHECK_RESULTS.json');
  const payload = JSON.parse(Core.canonicalJson(results));
  delete payload.resultsDigest;
  const digest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  check(results.status === 'PASS' && results.summary.commands === 15 && results.summary.failed === 0, 'all focused and required commands passed');
  check(results.resultsDigest === digest, 'verification result digest matches canonical content');
}

console.log('\nPhone-QA review handoff evidence selftest: PASS (' + checks + ' checks)');
