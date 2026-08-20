#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const Runner = require('./run-verification-checks');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function sha256(bytes) {
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function digestWithout(value, key) {
  const payload = JSON.parse(Core.canonicalJson(value));
  delete payload[key];
  return sha256(Core.canonicalJson(payload));
}

function normalizedTextFileDigest(name) {
  const text = fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return sha256(Buffer.from(text, 'utf8'));
}

const closure = readJson('CURRENT_PHONE_QA_CLOSURE.json');
const visual = readJson('LIVE_VISUAL_RECEIPT.json');
const results = readJson('CHECK_RESULTS.json');
const gapBefore = readJson('CAPABILITY_GAP_BEFORE.json');
const gapAfter = readJson('CAPABILITY_GAP_AFTER.json');
const seal = readJson('SESSION_SEGMENT.seal.json');
const index = readJson('SESSION_INDEX.json');
const curation = readJson('CURATION_RECEIPT.json');
const segmentBytes = fs.readFileSync(path.join(__dirname, 'SESSION_SEGMENT.jsonl'));
const events = segmentBytes.toString('utf8').trimEnd().split(/\r?\n/).map((line) => JSON.parse(line));
const artifacts = Object.fromEntries(index.currentArtifacts.map((item) => [item.path, item]));

check(results.resultsDigest === digestWithout(results, 'resultsDigest'), 'recorded check results have a valid strict canonical seal');
check(results.summary.total === 18 && results.summary.passed === 18 && results.summary.failed === 0, 'verification matrix records eighteen passing commands');
check(results.summary.focusedTotal === 8 && results.summary.focusedPassed === 8, 'all eight focused checks are recorded passing');
check(results.summary.requiredTotal === 10 && results.summary.requiredPassed === 10, 'all ten required Workshop checks are recorded passing');
check(results.checks.every((item) => item.exitCode === 0 && item.verdict === 'PASS'), 'every recorded command has a passing exit verdict');
check(results.typedGaps.every((item) => !item.treatedAsPassingProductCheck), 'three real-world gaps are not counted as passing product checks');
check(Runner.PREREQUISITE_REQUIRED === 'node verify.js' && results.checks[0].command === Runner.PREREQUISITE_REQUIRED, 'verifier report is generated before every focused consumer');
check(Runner.FINALIZE[0].endsWith('build-current-phone-qa-closure.js') && Runner.FINALIZE[1].endsWith('selftest.js'), 'runner seals derived closure only after other checks');

check(closure.digest === digestWithout(closure, 'digest'), 'indexed closure seal is valid');
check(visual.receiptDigest === digestWithout(visual, 'receiptDigest'), 'indexed visual receipt seal is valid');
check(closure.sources.every((item) => item.byteNormalization === 'LINE_ENDINGS_TO_LF') && closure.captureContract.manifest.byteNormalization === 'LINE_ENDINGS_TO_LF' && closure.captureContract.contract.byteNormalization === 'LINE_ENDINGS_TO_LF', 'source references declare portable line-ending normalization');
check(artifacts['CURRENT_PHONE_QA_CLOSURE.json'].digest === closure.digest, 'index points to current closure digest');
check(artifacts['LIVE_VISUAL_RECEIPT.json'].digest === visual.receiptDigest, 'index points to current visual receipt digest');
check(artifacts['CHECK_RESULTS.json'].digest === results.resultsDigest, 'index points to current check-results digest');
check(artifacts['CAPABILITY_GAP_BEFORE.json'].byteNormalization === 'LINE_ENDINGS_TO_LF' && artifacts['CAPABILITY_GAP_BEFORE.json'].fileSha256 === normalizedTextFileDigest('CAPABILITY_GAP_BEFORE.json'), 'index binds portable before capability report bytes');
check(artifacts['CAPABILITY_GAP_AFTER.json'].byteNormalization === 'LINE_ENDINGS_TO_LF' && artifacts['CAPABILITY_GAP_AFTER.json'].fileSha256 === normalizedTextFileDigest('CAPABILITY_GAP_AFTER.json'), 'index binds portable after capability report bytes');

check(seal.parseStatus === 'valid' && seal.eventLines === 10 && seal.invalidJsonLines === 0, 'session segment contains ten valid events');
check('sha256:' + seal.sha256 === sha256(segmentBytes), 'session seal matches exact segment bytes');
check(index.segment.sha256 === seal.sha256 && curation.sealDigest === seal.sha256, 'index and curation receipt point to the same session seal');
check(events.every((event, indexValue) => event.sequence === indexValue + 1), 'session event sequence is contiguous');
check(events.every((event, indexValue) => indexValue === 0 || Date.parse(event.at) >= Date.parse(events[indexValue - 1].at)), 'session event timestamps are monotonic');

check(gapBefore.requirements.filter((item) => item.required).every((item) => item.status !== 'READY'), 'before report has no ready required route');
check(gapAfter.requirements.filter((item) => item.required).every((item) => item.status === 'READY'), 'after report has every required local route ready');
check(gapAfter.overall === 'DEGRADED', 'after report retains optional real-world degradation');
check(index.openSeams.length === 5 && index.openSeams.some((item) => item.includes('fourteen')), 'index retains the fourteen open physical-phone warnings');

check(!curation.telemetryAggregation.rawTerminalLogsRetained && !curation.telemetryAggregation.rawBrowserFramesRetained, 'curation retains neither raw terminal logs nor browser frames');
check(curation.telemetryAggregation.testResultsRetainedAsCountsAndVerdicts && curation.telemetryAggregation.browserInteractionRetainedAsBoundedReceipt, 'curation retains compact verification and visual verdicts');
check(curation.temporaryMaterialDeleted.every((item) => item.contentRetained === false), 'temporary browser and isolated test state are not retained');
check(curation.privateOrUserSourcesRetained === false && curation.unclassifiedItems.length === 0, 'curation retains no private sources or unclassified material');

const recordedText = fs.readdirSync(__dirname)
  .filter((name) => name.endsWith('.json') || name.endsWith('.jsonl'))
  .map((name) => fs.readFileSync(path.join(__dirname, name), 'utf8'))
  .join('\n');
check(!/\b[A-Za-z]:[\\/]/.test(recordedText), 'recorded JSON evidence contains no absolute machine paths');
check(!/bridge-token|authorization:\s*bearer|sk-[A-Za-z0-9]/i.test(recordedText), 'recorded JSON evidence contains no obvious secrets or authorization material');

console.log('PASS phone-QA closure verification selftest (' + checks + ' assertions)');
