'use strict';

const path = require('node:path');
const childProcess = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const Canonical = require('../src/canonical-json');
const Digest = require('../src/digest');
const LocalBrowserHost = require('../src/local-browser-host');
const ShellPolicy = require('../src/shell-policy');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'scripts', 'shell-policy.js');

function withoutDigest(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.policyDigest;
  return copy;
}

test('shell policy is deterministic, read-only, and digest-bound', function () {
  const first = ShellPolicy.buildShellPolicy();
  const second = ShellPolicy.buildShellPolicy();
  assert.equal(first.schema, 'axm.web.local-browser-shell-policy/v1');
  assert.equal(first.status, 'EXPERIMENTAL');
  assert.equal(first.bindAddress, '127.0.0.1');
  assert.equal(first.capabilityTokenBytes, 24);
  assert.equal(first.mutationOriginPolicy, 'EXACT_SHELL_ORIGIN_REQUIRED');
  assert.equal(first.externalNetworkUsed, false);
  assert.equal(first.pageScriptExecuted, false);
  assert.equal(first.authority.mutationAllowed, false);
  assert.equal(first.authority.networkAuthorityGranted, false);
  assert.equal(first.authority.installAllowed, false);
  assert.equal(first.authority.promotionAllowed, false);
  assert.equal(first.authority.canonAllowed, false);
  assert.equal(first.policyDigest, Digest.canonicalDigest(withoutDigest(first)));
  assert.equal(Canonical.stringify(first), Canonical.stringify(second));
});

test('shell policy is derived from the same host helpers used at runtime', function () {
  const policy = ShellPolicy.buildShellPolicy();
  const headers = LocalBrowserHost.securityHeaders();
  assert.equal(policy.controllerCspHash, 'sha256-' + LocalBrowserHost.controllerHash());
  assert.equal(policy.contentSecurityPolicy, LocalBrowserHost.contentSecurityPolicy());
  assert.equal(policy.responseSecurityHeaders.cacheControl, headers['Cache-Control']);
  assert.equal(policy.responseSecurityHeaders.crossOriginOpenerPolicy, headers['Cross-Origin-Opener-Policy']);
  assert.equal(policy.responseSecurityHeaders.crossOriginResourcePolicy, headers['Cross-Origin-Resource-Policy']);
  assert.equal(policy.responseSecurityHeaders.permissionsPolicy, headers['Permissions-Policy']);
  assert.equal(policy.responseSecurityHeaders.referrerPolicy, headers['Referrer-Policy']);
  assert.equal(policy.responseSecurityHeaders.xContentTypeOptions, headers['X-Content-Type-Options']);
  assert.equal(policy.responseSecurityHeaders.xFrameOptions, headers['X-Frame-Options']);
  assert.match(policy.contentSecurityPolicy, /frame-ancestors 'none'/);
});

test('shell-policy CLI reports exactly the module policy without starting a host', function () {
  const result = childProcess.spawnSync(process.execPath, [cli, '--pretty'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(Canonical.stringify(output), Canonical.stringify(ShellPolicy.buildShellPolicy()));
});
