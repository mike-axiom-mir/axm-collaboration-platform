'use strict';

const path = require('node:path');
const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const BrowserSession = require('../src/browser-session');
const Digest = require('../src/digest');
const LocalBrowserHost = require('../src/local-browser-host');
const ShellPolicy = require('../src/shell-policy');

const root = path.resolve(__dirname, '..');
function local(name) { return path.join(root, 'fixtures', name); }

function createSession() {
  return new BrowserSession.LocalBrowserSession(
    local('session-home.html'),
    [local('session-about.html'), local('session-details.html')]
  );
}

function rawGetWithHost(target, hostHeader) {
  const url = new URL(target);
  return new Promise(function (resolve, reject) {
    const request = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: { Host: hostHeader }
    }, function (response) {
      const chunks = [];
      response.on('data', function (chunk) { chunks.push(chunk); });
      response.on('end', function () {
        resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function assertIsolationHeaders(response) {
  assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  const permissions = response.headers.get('permissions-policy');
  ['camera=()', 'microphone=()', 'geolocation=()', 'display-capture=()', 'usb=()', 'serial=()', 'hid=()', 'bluetooth=()'].forEach(function (directive) {
    assert.match(permissions, new RegExp(directive.replace(/[()]/g, '\\$&')));
  });
}

function receiptDigest(receipt) {
  const material = JSON.parse(JSON.stringify(receipt));
  delete material.receiptDigest;
  return Digest.canonicalDigest(material);
}

test('loopback host serves one hash-bound trusted shell over the shared session', async function () {
  const host = await LocalBrowserHost.createLocalBrowserHost(createSession(), { port: 0 });
  try {
    const expectedPolicy = ShellPolicy.buildShellPolicy();
    assert.equal(host.receipt.schema, 'axm.web.local-browser-host-receipt/v1');
    assert.match(host.receipt.origin, /^http:\/\/127\.0\.0\.1:[0-9]+$/);
    assert.equal(host.receipt.shellPolicySchema, expectedPolicy.schema);
    assert.equal(host.receipt.shellPolicyDigest, expectedPolicy.policyDigest);
    assert.equal(host.shellPolicy.policyDigest, expectedPolicy.policyDigest);
    assert.equal(host.receipt.receiptDigest, receiptDigest(host.receipt));
    assert.equal(host.receipt.externalNetworkUsed, false);
    assert.equal(host.receipt.trustedShellScriptActive, true);
    assert.equal(host.receipt.pageScriptExecuted, false);

    const response = await fetch(host.receipt.shellUrl);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /AXM LOCAL BROWSER/);
    assert.equal((html.match(/<script>/g) || []).length, 1);
    assert.match(response.headers.get('content-security-policy'), new RegExp("script-src 'sha256-" + LocalBrowserHost.controllerHash().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'"));
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assertIsolationHeaders(response);
    assert.doesNotMatch(html, /About this local bundle/);

    const stateResponse = await fetch(host.receipt.shellUrl + 'state');
    const state = await stateResponse.json();
    assert.equal(stateResponse.status, 200);
    assertIsolationHeaders(stateResponse);
    assert.equal(state.state.current.title, 'AXM Local Home');
    assert.equal(state.bundle.bundleDigest, host.receipt.bundleDigest);

    const link = state.bundle.pages[0].links.find(function (candidate) { return candidate.resolution.state === 'AVAILABLE'; });
    const actionResponse = await fetch(host.receipt.shellUrl + 'action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: host.receipt.origin },
      body: JSON.stringify({ type: 'activate', entryRef: link.entryRef })
    });
    const moved = await actionResponse.json();
    assert.equal(actionResponse.status, 200);
    assert.equal(moved.state.current.title, 'About the AXM Local Session');
    assert.equal(moved.state.canGoBack, true);
  } finally {
    await host.close();
  }
});

test('loopback host refuses missing/cross-origin, wrong-content-type, and unknown-route actions', async function () {
  const host = await LocalBrowserHost.createLocalBrowserHost(createSession(), { port: 0, maxActionBytes: 64 });
  try {
    const wrongHost = await rawGetWithHost(host.receipt.shellUrl, 'example.invalid');
    assert.equal(wrongHost.status, 421);
    assert.equal(wrongHost.body.code, 'HOST_HEADER_REFUSED');

    const missingOrigin = await fetch(host.receipt.shellUrl + 'action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'back' })
    });
    assert.equal(missingOrigin.status, 403);
    assert.equal((await missingOrigin.json()).code, 'HOST_ORIGIN_REQUIRED');

    const crossOrigin = await fetch(host.receipt.shellUrl + 'action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid' },
      body: JSON.stringify({ type: 'back' })
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal((await crossOrigin.json()).code, 'HOST_ORIGIN_REFUSED');

    const wrongType = await fetch(host.receipt.shellUrl + 'action', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: host.receipt.origin },
      body: JSON.stringify({ type: 'back' })
    });
    assert.equal(wrongType.status, 415);
    assert.equal((await wrongType.json()).code, 'HOST_CONTENT_TYPE_REFUSED');

    const oversized = await fetch(host.receipt.shellUrl + 'action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: host.receipt.origin },
      body: JSON.stringify({ type: 'open-locator', locator: 'x'.repeat(256) })
    });
    assert.equal(oversized.status, 400);
    assert.equal((await oversized.json()).code, 'HOST_ACTION_BYTES_LIMIT');

    const missing = await fetch(host.receipt.origin + '/not-the-capability-path');
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).code, 'HOST_ROUTE_NOT_FOUND');
    const stateResponse = await fetch(host.receipt.shellUrl + 'state');
    const state = await stateResponse.json();
    assertIsolationHeaders(stateResponse);
    assert.equal(state.state.history.length, 1, 'refused requests do not mutate session state');
  } finally {
    await host.close();
  }
});
