#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Builder = require('./build-current-full-closure');
const Runner = require('./run-verification-checks');
const Known = require('./run-known-source-evolution-checks');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

const result = Builder.checkRecorded();
const receipt = JSON.parse(fs.readFileSync(Runner.OUTPUT, 'utf8'));
const known = JSON.parse(fs.readFileSync(Known.OUTPUT, 'utf8'));
const segmentBytes = fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.jsonl'));
const seal = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.seal.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_INDEX.json'), 'utf8'));
const curation = JSON.parse(fs.readFileSync(path.join(__dirname, 'CURATION_RECEIPT.json'), 'utf8'));
const receiptPayload = JSON.parse(Core.canonicalJson(receipt));
delete receiptPayload.resultsDigest;
const expectedReceiptDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(receiptPayload)).digest('hex');
const knownPayload = JSON.parse(Core.canonicalJson(known));
delete knownPayload.digest;
const expectedKnownDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(knownPayload)).digest('hex');

check(receipt.schema === 'axm.grounded-growth-json-full-closure-check-results/v1' && receipt.status === 'TEST', 'verification receipt identity matches');
check(receipt.resultsDigest === expectedReceiptDigest, 'verification receipt digest is exact');
check(receipt.summary.total === Runner.FOCUSED.length + Runner.REQUIRED.length, 'check total matches declared commands');
check(receipt.summary.total === 36 && receipt.summary.focusedTotal === 26 && receipt.summary.requiredTotal === 10, 'focused and required totals are exact');
check(receipt.summary.failed === 0 && receipt.summary.passed === receipt.summary.total, 'every recorded runnable check passes');
check(receipt.summary.focusedPassed === receipt.summary.focusedTotal && receipt.summary.requiredPassed === receipt.summary.requiredTotal, 'all focused and required checks pass');
check(receipt.checks.every((item) => item.exitCode === 0 && item.verdict === 'PASS'), 'no failed runnable command is hidden');
check(receipt.summary.explicitAssertions === 885, 'explicit assertion count is exact');
check(receipt.summary.knownExpectedStaleSourceChecks === 11, 'known source-evolution count is exact');
check(known.digest === expectedKnownDigest && known.summary.total === 11, 'known source-evolution receipt is digest-bound');
check(known.summary.expectedStale === 11 && known.summary.unexpected === 0, 'all dated source-identity checks are expected and none are unexplained');
check(known.results.every((item) => item.verdict === 'EXPECTED_STALE_AFTER_SOURCE_CHANGE'), 'dated source evolution is not relabeled as product success');
check(result.after.strictUnsafeRefusal === 15 && result.after.remainingUnsafeConsumers === 0, 'the exact fifteen-consumer inventory is closed');
check(result.unsafeFixtureResults.length === 143 && result.unsafeFixtureResults.every((item) => item.state === 'REFUSED'), 'all unsafe fixture pairs fail closed');
check(result.safeCompatibility.length === 66 && result.safeCompatibility.every((item) => item.canonicalExact && item.objectDigestExact), 'all safe compatibility pairs remain exact');
check(result.persistence.length === 11 && result.persistence.every((item) => item.canonicalExactAfterRead && item.digestExactAfterRead && !item.temporaryFileRetained), 'all persistence journeys are exact and temporary files are removed');
check(result.requirements.filter((item) => item.verdict === 'NOT_RUN').length === 2, 'structural receipt honestly predates the final matrix and clean-checkout replay');
check(!receipt.limits.browserRenderClickTestRun && !receipt.limits.humanReviewRun && !receipt.limits.workshopWideSerializationAuditRun, 'unrun browser human and Workshop-wide work remains explicit');
check(!receipt.limits.humanBenefitEstablished && !receipt.limits.modelLearningImprovementEstablished && !receipt.limits.shadowCloneCandidateEvaluated, 'human learning and shadow claims remain unmade');
check(!receipt.authority.install && !receipt.authority.permissionGrant && !receipt.authority.promotion && !receipt.authority.merge && !receipt.authority.canon && !receipt.authority.foundationMutation, 'verification grants no lifecycle authority');
check(!receipt.retention.rawStdoutStored && !receipt.retention.rawStderrStored, 'raw test telemetry is not retained');
check(seal.parseStatus === 'valid' && seal.eventLines === 10 && seal.invalidJsonLines === 0, 'ten-event segment is structurally sealed');
check(seal.sha256 === crypto.createHash('sha256').update(segmentBytes).digest('hex'), 'segment seal digest matches exact bytes');
check(Date.parse(seal.generatedAt) >= Date.parse(seal.lastTimestamp), 'seal is generated after the final event');
check(index.status === 'SEALED' && index.segment.sha256 === seal.sha256 && index.currentArtifacts.length === 6, 'session index binds the seal and bounded evidence views');
check(curation.status === 'SEALED' && curation.sealDigest === seal.sha256 && curation.durableEventsPreserved === 10, 'curation receipt binds the sealed history');
check(curation.knownExpectedStale === 11 && curation.unclassifiedItems.length === 0, 'curation preserves known stale evidence without ambiguity');
check(curation.privateOrUserSourcesRetained === false, 'curated evidence retains no private user source material');

console.log('PASS Grounded Growth JSON full closure verification selftest (' + checks + ' assertions)');
