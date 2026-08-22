#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Builder = require('./build-current-migration-pilot');
const Runner = require('./run-verification-checks');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

const result = Builder.checkRecorded();
const receipt = JSON.parse(fs.readFileSync(Runner.OUTPUT, 'utf8'));
const segmentBytes = fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.jsonl'));
const seal = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.seal.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_INDEX.json'), 'utf8'));
const curation = JSON.parse(fs.readFileSync(path.join(__dirname, 'CURATION_RECEIPT.json'), 'utf8'));
const payload = JSON.parse(JSON.stringify(receipt));
delete payload.resultsDigest;
const expectedDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');

check(receipt.schema === 'axm.voluntary-choice-json-migration-check-results/v1' && receipt.status === 'TEST', 'verification receipt identity matches');
check(receipt.resultsDigest === expectedDigest, 'verification receipt digest is exact');
check(receipt.summary.total === Runner.FOCUSED.length + Runner.REQUIRED.length, 'check total matches declared commands');
check(receipt.summary.focusedTotal === 21 && receipt.summary.requiredTotal === 10, 'focused and required totals are exact');
check(receipt.summary.failed === 0 && receipt.summary.passed === receipt.summary.total, 'every recorded check passes');
check(receipt.summary.focusedPassed === receipt.summary.focusedTotal, 'every focused and adjacent check passes');
check(receipt.summary.requiredPassed === receipt.summary.requiredTotal, 'all ten repository-required checks pass');
check(receipt.checks.every((item) => item.exitCode === 0 && item.verdict === 'PASS'), 'no failed command is hidden');
check(receipt.summary.explicitAssertions >= 700, 'focused suite preserves broad explicit assertion coverage');
check(result.requirements.find((item) => item.id === 'clean-checkout-full-verification').verdict === 'NOT_RUN', 'migration record honestly predates the final matrix');
check(!receipt.limits.browserRenderClickTestRun && !receipt.limits.humanReviewRun && !receipt.limits.allConsumerMigrationRun, 'unrun browser human and all-consumer work remains explicit');
check(!receipt.authority.install && !receipt.authority.promotion && !receipt.authority.merge && !receipt.authority.canon && !receipt.authority.foundationMutation, 'verification grants no authority');
check(!receipt.retention.rawStdoutStored && !receipt.retention.rawStderrStored, 'raw test telemetry is not retained');
check(seal.parseStatus === 'valid' && seal.eventLines === 7 && seal.invalidJsonLines === 0, 'seven-event segment is structurally sealed');
check(seal.sha256 === crypto.createHash('sha256').update(segmentBytes).digest('hex'), 'segment seal digest matches exact bytes');
check(Date.parse(seal.generatedAt) >= Date.parse(seal.lastTimestamp), 'seal is generated after the final event');
check(index.status === 'SEALED' && index.segment.sha256 === seal.sha256 && index.currentArtifacts.length === 4, 'session index binds the seal and bounded derived views');
check(curation.status === 'SEALED' && curation.sealDigest === seal.sha256 && curation.durableEventsPreserved === 7, 'curation receipt binds the sealed history');
check(curation.unclassifiedItems.length === 0 && curation.privateOrUserSourcesRetained === false, 'curation leaves no unclassified or private source material');

console.log('PASS voluntary-choice JSON migration verification selftest (' + checks + ' assertions)');
