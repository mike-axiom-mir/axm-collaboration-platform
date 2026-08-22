#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Feedback = require('../../../shared/grounded-growth-feedback/grounded-growth-feedback');
const Current = require('./current-feedback-readiness');

const ROOT = path.resolve(__dirname, '..', '..', '..');
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function fileDigest(relativePath) {
  const bytes = fs.readFileSync(path.join(ROOT, relativePath));
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

const before = readJson('docs/steward-runs/2026-08-19-grounded-growth-feedback/capability-gap.before.json');
const after = readJson('docs/steward-runs/2026-08-19-grounded-growth-feedback/capability-gap.after.json');
check(before.overall === 'BLOCKED' && after.overall === 'READY', 'capability comparison preserves BLOCKED to READY transition');
check(after.missingCapabilities.length === 0 && after.requirements.every((item) => item.status === 'READY'), 'after comparison has no missing capability or degraded requirement');

const packet = readJson('docs/steward-runs/2026-08-19-grounded-growth-feedback/current-feedback-packet.json');
const readiness = readJson('docs/steward-runs/2026-08-19-grounded-growth-feedback/current-feedback-readiness-receipt.json');
const currentCheck = Current.verifyCurrent({ packet, readiness });
check(currentCheck.pass, 'current feedback packet and readiness receipt rebuild exactly: ' + currentCheck.errors.join('; '));
check(packet.summary.candidateNeedCount === 1 && packet.summary.directionCount === 0, 'current packet has one candidate and zero directions');
check(packet.candidateNeeds[0].possible_responses.join(',') === 'WAIT_FOR_EVIDENCE', 'current candidate has only WAIT_FOR_EVIDENCE');
check(readiness.feedbackPacketRef.sha256 === packet.packetDigest && readiness.currentCandidate.needId === packet.candidateNeeds[0].need_id, 'readiness receipt binds the exact packet and candidate');
check(readiness.review.disposition === 'WAIT_FOR_EVIDENCE' && readiness.review.humanAcceptanceClaimed === false, 'technical review is bounded and does not claim human acceptance');
check(readiness.review.directionCreated === false && readiness.review.registryWritePerformed === false && readiness.review.executionAuthorized === false, 'technical review grants no direction, registry, or execution authority');

const needsDir = path.join(ROOT, 'tools', 'grounded-evolution-intelligence', 'engine', 'registry', 'needs');
const registeredNeedIds = fs.readdirSync(needsDir).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(fs.readFileSync(path.join(needsDir, name), 'utf8')).need_id);
check(!registeredNeedIds.includes(packet.candidateNeeds[0].need_id), 'current candidate was not written into the GEI registry');

const verification = readJson('docs/steward-runs/2026-08-19-grounded-growth-feedback/verification-receipt.json');
const verificationPayload = JSON.parse(JSON.stringify(verification));
delete verificationPayload.receiptDigest;
check(verification.receiptDigest === Feedback.sha256(verificationPayload), 'verification receipt digest matches exact derived content');
check(verification.requiredChecks.length === 10 && verification.requiredChecks.every((item) => item.exitCode === 0), 'all ten required Workshop commands record exit code zero');
check(verification.browserVerification.result === 'NOT_RUN' && /non-visual/.test(verification.browserVerification.reason), 'browser verification remains separately and honestly NOT_RUN');
verification.sourceRefs.forEach((source) => check(fileDigest(source.path) === source.sha256, 'verification source digest matches ' + source.path));

const segmentPath = 'docs/steward-runs/2026-08-19-grounded-growth-feedback/session-events.jsonl';
const seal = readJson('docs/steward-runs/2026-08-19-grounded-growth-feedback/session.seal.json');
const lines = fs.readFileSync(path.join(ROOT, segmentPath), 'utf8').trim().split(/\r?\n/);
check(seal.parseStatus === 'valid' && seal.validJsonLines === 6 && lines.every((line) => JSON.parse(line)), 'curated session segment contains six valid ordered JSON events');
check(fileDigest(segmentPath) === 'sha256:' + seal.sha256, 'session seal digest matches exact segment bytes');

const contract = readJson('shared/grounded-growth-feedback/module.contract.json');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains TEST with no permissions or writes');
check(contract.boundaries.refuses.includes('automatic-merge') && contract.boundaries.refuses.includes('automatic-canon'), 'module contract refuses automatic merge and CANON');

console.log('\nGrounded Growth Feedback audit: PASS (' + checks + ' checks)');
