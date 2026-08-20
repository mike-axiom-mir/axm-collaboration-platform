#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const Core = require('../../../tools/deterministic-json-core');
const Runner = require('./run-verification-checks');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

const receipt = JSON.parse(fs.readFileSync(Runner.OUTPUT, 'utf8'));
const segmentBytes = fs.readFileSync(require('path').join(__dirname, 'SESSION_SEGMENT.jsonl'));
const seal = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'SESSION_SEGMENT.seal.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'SESSION_INDEX.json'), 'utf8'));
const curation = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'CURATION_RECEIPT.json'), 'utf8'));
const payload = JSON.parse(Core.canonicalJson(receipt));
const digest = payload.resultsDigest;
delete payload.resultsDigest;
const expectedDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');

check(digest === expectedDigest, 'check-results digest verifies');
check(receipt.schema === 'axm.grounded-growth-upstream-json-check-results/v1' && receipt.status === 'TEST', 'check receipt identity and status are exact');
check(receipt.summary.total === 39 && receipt.summary.passed === 39 && receipt.summary.failed === 0, 'all 39 recorded checks pass');
check(receipt.summary.focusedTotal === 29 && receipt.summary.focusedPassed === 29, 'all 29 focused and adjacent checks pass');
check(receipt.summary.requiredTotal === 10 && receipt.summary.requiredPassed === 10, 'all ten AGENTS required checks pass');
check(receipt.summary.explicitAssertions === 999, 'recorded explicit assertion count is exact');
check(receipt.checks.length === 39 && receipt.checks.every((item) => item.verdict === 'PASS' && item.exitCode === 0), 'every recorded command has a zero exit and PASS verdict');
check(Runner.REQUIRED.length === 10 && Runner.REQUIRED.every((command) => receipt.checks.some((item) => item.command === command && item.phase === 'REQUIRED')), 'receipt includes every exact required command');
check(Runner.FOCUSED.length === 29 && Runner.FOCUSED.every((command) => receipt.checks.some((item) => item.command === command && item.phase === 'FOCUSED_AND_ADJACENT')), 'receipt includes every focused command');
check(receipt.checks.filter((item) => item.command.includes('shared/grounded-growth-') && item.command.endsWith('/selftest.js')).length === 15, 'all fifteen Grounded Growth consumer native self-tests pass');
check(receipt.checks.filter((item) => [
  'shared/verified-capability-loop/selftest.js',
  'shared/human-benefit-evidence/selftest.js',
  'shared/portable-baseline-capsule/selftest.js',
  'shared/baseline-simulation-lab/selftest.js',
  'shared/research-contribution-intake/selftest.js',
  'shared/simulation-lab-extension-intake/selftest.js'
].some((suffix) => item.command.endsWith(suffix))).length === 6, 'all six selected upstream native self-tests pass');
check(receipt.typedGaps.length === 1 && receipt.typedGaps[0].state === 'DEFERRED_CONTRACT_AND_EVIDENCE_GAP', 'one phone QA gap is retained as a typed gap');
check(receipt.typedGaps[0].treatedAsPassingProductCheck === false, 'expected phone QA gap is not mislabeled as a passing product check');
check(!receipt.checks.some((item) => item.command === 'node shared/voluntary-phone-qa-campaign/selftest.js'), 'known failing phone campaign baseline is not counted as a passing native check');
check(receipt.retention.rawStdoutStored === false && receipt.retention.rawStderrStored === false, 'raw command streams are not retained');
check(receipt.limits.browserRenderClickTestRun === false && receipt.limits.humanReviewRun === false && receipt.limits.fullWorkshopRepresentationClosureProved === false, 'unrun visual, human, and Workshop-wide claims remain false');
check(!receipt.authority.promotion && !receipt.authority.merge && !receipt.authority.canon && !receipt.authority.foundationMutation, 'verification grants no promotion, merge, CANON, or Foundation authority');
check(seal.parseStatus === 'valid' && seal.eventLines === 10 && seal.invalidJsonLines === 0, 'session segment seal records ten valid ordered events');
check(seal.sha256 === crypto.createHash('sha256').update(segmentBytes).digest('hex'), 'session segment byte digest verifies');
check(index.status === 'SEALED' && index.segment.sha256 === seal.sha256 && index.segment.eventLines === seal.eventLines, 'session index points to the exact sealed segment');
check(curation.status === 'SEALED' && curation.sealDigest === seal.sha256 && curation.durableEventsPreserved === 10, 'curation receipt binds the exact session seal');
check(curation.temporaryMaterialDeleted.length === 1 && curation.temporaryMaterialDeleted[0].count === 6 && curation.privateOrUserSourcesRetained === false, 'curation removes six temporary probes and retains no private user source');

console.log('PASS Grounded Growth upstream JSON verification selftest (' + checks + ' assertions)');
