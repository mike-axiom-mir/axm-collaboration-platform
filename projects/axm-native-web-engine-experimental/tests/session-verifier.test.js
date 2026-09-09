'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const Canonical = require('../src/canonical-json');
const SessionVerifier = require('../src/session-verifier');

const root = path.resolve(__dirname, '..');
const goldenPath = path.join(root, 'golden', 'local-session.navigation.json');
const cliPath = path.join(root, 'scripts', 'verify-session.js');

function snapshot() {
  return JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
}

function findingCodes(receipt) {
  return receipt.findings.map(function (finding) { return finding.code; });
}

test('committed local session verifies deterministically without granting authority', function () {
  const bytes = fs.readFileSync(goldenPath);
  const first = SessionVerifier.verifySessionBytes(bytes);
  const second = SessionVerifier.verifySessionBytes(bytes);
  assert.equal(first.schema, 'axm.web.local-browser-session-verification/v1');
  assert.equal(first.status, 'PASS');
  assert.equal(first.findingCount, 0);
  assert.equal(first.checks.failed, 0);
  assert.equal(first.sessionDigestDeclared, first.sessionDigestComputed);
  assert.equal(first.bundleDigestDeclared, first.bundleDigestComputed);
  assert.equal(first.authority.mutationAllowed, false);
  assert.equal(first.authority.installAllowed, false);
  assert.equal(first.authority.promotionAllowed, false);
  assert.equal(first.authority.canonAllowed, false);
  assert.equal(Canonical.stringify(first), Canonical.stringify(second));
  assert.equal(first.verificationDigest, second.verificationDigest);
});

test('session verifier refuses state and bundle tampering independently of the producer', function () {
  const stateTamper = snapshot();
  const original = Canonical.stringify(stateTamper);
  stateTamper.state.current.title += ' [tampered]';
  const stateReceipt = SessionVerifier.verifySessionSnapshot(stateTamper);
  assert.equal(stateReceipt.status, 'FAIL');
  assert.ok(findingCodes(stateReceipt).includes('SESSION_DIGEST_MISMATCH'));
  assert.ok(findingCodes(stateReceipt).includes('CURRENT_TITLE_MISMATCH'));
  assert.notEqual(Canonical.stringify(stateTamper), original);

  const bundleTamper = snapshot();
  bundleTamper.bundle.pages[0].entries[0].text += ' [tampered]';
  const bundleReceipt = SessionVerifier.verifySessionSnapshot(bundleTamper);
  assert.equal(bundleReceipt.status, 'FAIL');
  assert.ok(findingCodes(bundleReceipt).includes('BUNDLE_DIGEST_MISMATCH'));
  assert.ok(findingCodes(bundleReceipt).includes('SESSION_DIGEST_MISMATCH'));
});

test('session verifier returns deterministic failure receipts for byte, UTF-8, and JSON boundaries', function () {
  const oversized = SessionVerifier.verifySessionBytes(Buffer.alloc(33), { maxInputBytes: 32 });
  assert.equal(oversized.status, 'FAIL');
  assert.deepEqual(findingCodes(oversized), ['INPUT_BYTES_LIMIT']);

  const invalidUtf8 = SessionVerifier.verifySessionBytes(Buffer.from([0xff, 0xfe]));
  assert.equal(invalidUtf8.status, 'FAIL');
  assert.deepEqual(findingCodes(invalidUtf8), ['INPUT_UTF8_INVALID']);

  const invalidJson = SessionVerifier.verifySessionBytes(Buffer.from('{not json}', 'utf8'));
  assert.equal(invalidJson.status, 'FAIL');
  assert.deepEqual(findingCodes(invalidJson), ['INPUT_JSON_INVALID']);
});

test('verify-session CLI passes clean input and exits nonzero on tampering', function () {
  const clean = childProcess.spawnSync(process.execPath, [cliPath, goldenPath, '--pretty'], { encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(JSON.parse(clean.stdout).status, 'PASS');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-session-verifier-'));
  const tamperedPath = path.join(temp, 'tampered.json');
  try {
    const tampered = snapshot();
    tampered.state.current.address += '#tampered';
    fs.writeFileSync(tamperedPath, JSON.stringify(tampered), 'utf8');
    const failed = childProcess.spawnSync(process.execPath, [cliPath, tamperedPath], { encoding: 'utf8' });
    assert.equal(failed.status, 1);
    const receipt = JSON.parse(failed.stdout);
    assert.equal(receipt.status, 'FAIL');
    assert.ok(findingCodes(receipt).includes('SESSION_DIGEST_MISMATCH'));
    assert.ok(findingCodes(receipt).includes('CURRENT_HISTORY_MISMATCH'));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
