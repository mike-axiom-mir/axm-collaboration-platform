'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Builder = require('./build-current-serialization-closure');
const Runner = require('./run-verification-checks');

let assertions = 0;
function check(condition, message) { assertions += 1; assert.ok(condition, message); }
function digest(value) { return 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(value)).digest('hex'); }

const evaluation = JSON.parse(fs.readFileSync(path.join(__dirname, 'CURRENT_SERIALIZATION_CLOSURE_EVALUATION.json'), 'utf8'));
const migration = JSON.parse(fs.readFileSync(path.join(__dirname, 'CURRENT_MIGRATION_PROFILE.json'), 'utf8'));
const checks = JSON.parse(fs.readFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), 'utf8'));
const segmentBytes = fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.jsonl'));
const segmentLines = segmentBytes.toString('utf8').trim().split(/\r?\n/).map(JSON.parse);
const seal = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.seal.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'SESSION_INDEX.json'), 'utf8'));
const curation = JSON.parse(fs.readFileSync(path.join(__dirname, 'CURATION_RECEIPT.json'), 'utf8'));

check(Builder.verify(evaluation, migration).pass, 'current evaluation and migration rebuild exactly');
check(checks.schema === 'axm.receipt-serialization-closure-check-results/v1', 'check receipt schema matches');
check(checks.status === 'TEST', 'check receipt remains TEST');
check(checks.summary.total === Runner.FOCUSED.length + Runner.REQUIRED.length, 'exact command inventory is present');
check(checks.summary.focusedTotal === 20 && checks.summary.focusedPassed === 20, 'all focused and adjacent checks passed');
check(checks.summary.requiredTotal === 10 && checks.summary.requiredPassed === 10, 'all required Workshop checks passed');
check(checks.summary.failed === 0 && checks.summary.passed === checks.summary.total, 'broad verification has no failure');
check(checks.checks.every((row) => row.verdict === 'PASS' && row.exitCode === 0), 'every command row is a pass');
check(new Set(checks.checks.map((row) => row.command)).size === checks.checks.length, 'command inventory has no duplicates');
check(checks.limits.browserRenderClickTestRun === false, 'browser behavior remains NOT_RUN');
check(checks.limits.consumerMigrationRun === false, 'consumer migration remains NOT_RUN');
check(checks.limits.humanReviewRun === false, 'human review remains NOT_RUN');
check(Object.values(checks.authority).every((value) => value === false), 'verification grants no authority');
const payload = JSON.parse(JSON.stringify(checks));
delete payload.resultsDigest;
check(checks.resultsDigest === digest(payload), 'check receipt digest rebuilds exactly');
const canonicalSegmentBytes = Buffer.from(segmentBytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
check(seal.sha256 === crypto.createHash('sha256').update(canonicalSegmentBytes).digest('hex'), 'session segment repository-blob digest matches its seal');
check(seal.eventLines === 12 && segmentLines.length === 12 && segmentLines.every((row, index) => row.sequence === index + 1), 'session segment has twelve ordered valid events');
check(index.sealSha256 === seal.sha256 && index.eventCount === seal.eventLines, 'session index binds the current seal');
check(curation.sealDigest === seal.sha256 && curation.durableEventsPreserved === seal.eventLines, 'curation receipt binds every durable event');
check(curation.privateOrUserSourcesRetained === false && curation.unclassifiedItems.length === 0, 'curation retains no private or unclassified source');

process.stdout.write('receipt-serialization-closure verification selftest: PASS (' + assertions + ' assertions)\n');
