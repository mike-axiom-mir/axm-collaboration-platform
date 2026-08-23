'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const Readiness = require('../shared/readiness/tool-readiness');

const ROOT = path.resolve(__dirname, '..');
const indexFile = path.join(ROOT, 'tools-index.json');

function digest() {
  return crypto.createHash('sha256').update(fs.readFileSync(indexFile)).digest('hex');
}

const newlineFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-tools-index-newlines-'));
try {
  const lfFile = path.join(newlineFixture, 'lf.json');
  const crlfFile = path.join(newlineFixture, 'crlf.json');
  const loneCrFile = path.join(newlineFixture, 'lone-cr.json');
  fs.writeFileSync(lfFile, '{\n  "value": 1\n}\n');
  fs.writeFileSync(crlfFile, '{\r\n  "value": 1\r\n}\r\n');
  fs.writeFileSync(loneCrFile, '{\r  "value": 1\r}\r');
  assert.strictEqual(Readiness.DIGEST_CONTRACT, 'sha256-canonical-text-lf-v1');
  assert.strictEqual(Readiness.digestFile(lfFile), Readiness.digestFile(crlfFile), 'LF and CRLF checkouts must share one source digest');
  assert.notStrictEqual(Readiness.digestFile(lfFile), Readiness.digestFile(loneCrFile), 'a lone carriage return must remain digest-significant');
} finally {
  fs.rmSync(newlineFixture, { recursive: true, force: true });
}

const before = digest();
const result = childProcess.spawnSync(process.execPath, ['scripts/generate-tools-index.js'], {
  cwd: ROOT,
  encoding: 'utf8'
});

assert.strictEqual(result.status, 0, result.stderr || result.stdout || 'tools index generation failed');
assert.strictEqual(digest(), before, 'default tools index generation must preserve the committed as-of snapshot');

console.log('Tools index clock selftest: PASS · wall-clock passage cannot create source drift');
