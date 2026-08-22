#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Redaction = require('./diagnostic-redaction');

let checks = 0;
function check(value, label) { assert(value, label); checks += 1; }
function equal(actual, expected, label) { assert.equal(actual, expected, label); checks += 1; }

const options = {
  workspaceRoot:'D:\\CODEX_WORKTREES\\example\\workshop',
  homeRoot:'C:\\Users\\example',
  tempRoot:'C:\\Users\\example\\AppData\\Local\\Temp',
  machineRoots:['E:\\private-runtime']
};
const diagnostic = [
  'Error: missing D:\\CODEX_WORKTREES\\example\\workshop\\intakes\\missing.json',
  '    at read (D:/CODEX_WORKTREES/example/workshop/shared/service.js:33:4)',
  "  path: 'C:\\\\Users\\\\example\\\\private.json'",
  'temp C:\\Users\\example\\AppData\\Local\\Temp\\probe.txt',
  'runtime E:\\private-runtime\\state\\owner.json',
  'other F:\\other-host\\private\\record.json',
  'unc \\\\host-name\\private-share\\record.json',
  'linux /home/example/workshop/file.js:8:2',
  'mac /Users/example/workshop/file.js:9:3',
  'temporary /tmp/axm-private/result.json',
  'service /opt/axm/private-state.json',
  'file-url file:///home/example/workshop/private.js:3:1',
  'keep https://example.test/path/to/docs and tools/review-inbox/selftest.js'
].join('\n');
const redacted = Redaction.redactDiagnostic(diagnostic, options);

check(redacted.includes('<WORKSPACE>\\intakes\\missing.json'), 'known Windows workspace root is replaced while the relative suffix remains');
check(redacted.includes('<WORKSPACE>/shared/service.js:33:4'), 'slash-normalized workspace root is replaced');
check(redacted.includes('<HOME>'), 'home root is replaced');
check(redacted.includes('<TEMP>\\probe.txt'), 'more specific temporary root wins over its home prefix');
check(redacted.includes('<MACHINE_ROOT>\\state\\owner.json'), 'declared machine root is replaced');
check(redacted.includes('<ABSOLUTE_PATH>'), 'unknown drive and POSIX paths are removed');
check(redacted.includes('<UNC_PATH>'), 'UNC host and share path is removed');
check(!redacted.includes('CODEX_WORKTREES'), 'workspace path components do not remain');
check(!redacted.includes('Users\\example'), 'home identity does not remain');
check(!redacted.includes('host-name'), 'UNC host identity does not remain');
check(!redacted.includes('/home/example'), 'Linux home path does not remain');
check(!redacted.includes('/Users/example'), 'macOS home path does not remain');
check(!redacted.includes('/tmp/axm-private'), 'POSIX temporary path does not remain');
check(!redacted.includes('/opt/axm'), 'arbitrary POSIX absolute path does not remain');
check(!redacted.includes('file:///home/example'), 'POSIX file URL does not remain');
check(redacted.includes('https://example.test/path/to/docs'), 'web URLs are preserved');
check(redacted.includes('tools/review-inbox/selftest.js'), 'repository-relative paths are preserved');

const fixtureCredential = ['axm', 'fixture', 'credential'].join('-');
const fingerprintFixtures = [
  ['sk', 'fixture', 'A'.repeat(24)].join('-'),
  ['ghp', 'B'.repeat(28)].join('_'),
  ['github', 'pat', 'C'.repeat(28)].join('_'),
  ['xoxb', 'D'.repeat(12), 'E'.repeat(20)].join('-'),
  'A' + 'Iza' + 'F'.repeat(32),
  ['AK', 'IA'].join('') + 'G'.repeat(16),
  ['sk', 'live', 'H'.repeat(20)].join('_'),
  'eyJ' + 'C'.repeat(16) + '.' + 'D'.repeat(16) + '.' + 'E'.repeat(16)
];
const credentialDiagnostic = [
  'Authorization: Bearer ' + fixtureCredential,
  'Proxy-Authorization: Basic ' + fixtureCredential,
  'X-Api-Key: ' + fixtureCredential,
  'X-Auth-Token: ' + fixtureCredential,
  'Cookie: session=' + fixtureCredential,
  'Set-Cookie: session=' + fixtureCredential + '; Secure',
  'OPENAI_API_KEY="' + fixtureCredential + '"',
  'GITHUB_TOKEN=' + fixtureCredential,
  '//registry.example.test/:_authToken=' + fixtureCredential,
  "client-secret='" + fixtureCredential + "'",
  'database_password=' + fixtureCredential,
  '--access-token "' + fixtureCredential + '" --timeout 20',
  'https://fixture-user:fixture-pass@example.test/status',
  'postgres://fixture-user:fixture-pass@example.test/database',
  'https://example.test/status?access_token=' + fixtureCredential + '&mode=read',
  fingerprintFixtures.join(' '),
  '-----BEGIN ' + 'PRIVATE KEY-----\n' + 'R'.repeat(48) + '\n-----END ' + 'PRIVATE KEY-----',
  'keep token count: 42 and secret ballot evidence held',
  'keep tools/review-inbox/selftest.js and https://example.test/public/docs'
].join('\n');
const credentialRedacted = Redaction.redactDiagnostic(credentialDiagnostic, options);

check(!credentialRedacted.includes(fixtureCredential), 'labeled credential values do not remain');
check(!credentialRedacted.includes('fixture-user'), 'URL user-info identity does not remain');
check(!credentialRedacted.includes('fixture-pass'), 'URL user-info secret does not remain');
fingerprintFixtures.forEach((fixture, position) => check(!credentialRedacted.includes(fixture), 'recognized credential fingerprint ' + position + ' does not remain'));
check(!credentialRedacted.includes('R'.repeat(48)), 'private-key material does not remain');
check(credentialRedacted.includes('Authorization: ' + Redaction.CREDENTIAL_PLACEHOLDER), 'authorization header name remains useful');
check(credentialRedacted.includes('https://' + Redaction.CREDENTIAL_PLACEHOLDER + '@example.test/status'), 'URL host and path remain useful after user-info redaction');
check(credentialRedacted.includes('postgres://' + Redaction.CREDENTIAL_PLACEHOLDER + '@example.test/database'), 'non-web URI host and path remain useful after user-info redaction');
check(credentialRedacted.includes('mode=read'), 'non-credential query context remains useful');
check(credentialRedacted.includes('--timeout 20'), 'non-credential CLI context remains useful');
check(credentialRedacted.includes('token count: 42'), 'ordinary token-count language remains visible');
check(credentialRedacted.includes('secret ballot evidence held'), 'ordinary secret language remains visible');
equal(Redaction.redactDiagnostic(credentialRedacted, options), credentialRedacted, 'credential and path redaction is idempotent');

const source = { id:'fixture', verdict:'FAIL', failureTail:diagnostic, nested:{ preserved:true } };
const sanitized = Redaction.sanitizeVerificationResult(source, options);
equal(source.failureTail, diagnostic, 'sanitizing does not mutate the source receipt');
equal(sanitized.id, 'fixture', 'result identity is preserved');
equal(sanitized.verdict, 'FAIL', 'result verdict is preserved');
equal(sanitized.nested, source.nested, 'unrelated result fields are preserved');
check(!sanitized.failureTail.includes('D:\\CODEX_WORKTREES'), 'sanitized result contains no absolute workspace path');
const credentialSource = { id:'credential-fixture', verdict:'FAIL', outputSha256:'a'.repeat(64), failureTail:credentialDiagnostic };
const sanitizedCredentialSource = Redaction.sanitizeVerificationResult(credentialSource, options);
equal(credentialSource.failureTail, credentialDiagnostic, 'credential sanitizing does not mutate the source receipt');
equal(sanitizedCredentialSource.outputSha256, credentialSource.outputSha256, 'credential sanitizing preserves the raw-output digest');
check(!sanitizedCredentialSource.failureTail.includes(fixtureCredential), 'sanitized receipt contains no recognized fixture credential');
check(sanitizedCredentialSource.failureTail.includes(Redaction.CREDENTIAL_PLACEHOLDER), 'sanitized receipt exposes an explicit credential-redaction marker');
equal(Redaction.failureTail('0123456789', { limit:4 }), '6789', 'failure tail is bounded after redaction');
equal(Redaction.redactDiagnostic(null, options), null, 'null diagnostic stays null');
equal(Redaction.sanitizeVerificationResult(null, options), null, 'null result stays null');

console.log('diagnostic redaction selftest: PASS (' + checks + ' assertions, credential evidence, known roots, residual absolute paths, useful relative diagnostics, immutable receipts)');
