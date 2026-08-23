'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const BrowserSession = require('../src/browser-session');
const LocalBrowserHost = require('../src/local-browser-host');

const root = path.resolve(__dirname, '..');
function local(name) { return path.join(root, 'fixtures', name); }
function createSession() {
  return new BrowserSession.LocalBrowserSession(local('session-home.html'), [local('session-about.html'), local('session-details.html')]);
}

function referenceOrigin(url) {
  const parsed = new URL(url);
  return parsed.protocol + '//' + parsed.host;
}

test('browser host can expose an optional Reference Lab sharing the same visual-state lineage', async function () {
  const host = await LocalBrowserHost.createLocalBrowserHost(createSession(), { referenceLab: true });
  try {
    assert.ok(host.referenceLab);
    assert.ok(host.referenceLabHost);
    assert.match(host.referenceLabUrl, /^http:\/\/127\.0\.0\.1:[0-9]+\/r\//);
    assert.equal(host.referenceLabReceipt.uploadedContentExecutes, false);
    assert.equal(host.referenceLabReceipt.resultImageFetchGranted, false);
    assert.equal(host.referenceLabReceipt.externalNavigationGranted, false);

    const browserVisual = host.visualState();
    const labState = host.referenceLab.state();
    assert.equal(labState.browserVisualState.visualDigest, browserVisual.visualDigest);
    assert.equal(labState.browserVisualState.page.pageId, browserVisual.page.pageId);
    assert.equal(labState.browserVisualState.fidelity, 'STRUCTURED_SCREEN_MODEL');

    const shell = await fetch(host.referenceLabUrl);
    const html = await shell.text();
    assert.equal(shell.status, 200);
    assert.match(html, /Reference Lab/);
    assert.match(html, /AI eyesight/);
    assert.match(shell.headers.get('content-security-policy'), /img-src 'none'/);
    assert.equal(shell.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(shell.headers.get('cross-origin-resource-policy'), 'same-origin');

    const noOrigin = await fetch(host.referenceLabUrl + 'query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'water coaster concept art' })
    });
    assert.equal(noOrigin.status, 403);
    assert.equal((await noOrigin.json()).code, 'REFERENCE_HOST_ORIGIN_REFUSED');

    const origin = referenceOrigin(host.referenceLabUrl);
    const accepted = await fetch(host.referenceLabUrl + 'query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ query: 'water coaster concept art' })
    });
    const acceptedState = await accepted.json();
    assert.equal(accepted.status, 200);
    assert.equal(acceptedState.reference.kind, 'query');
    assert.equal(acceptedState.reference.textPreview, 'water coaster concept art');
    assert.equal(acceptedState.reference.authority.executableContentAllowed, false);
  } finally {
    await host.close();
  }
});

test('Reference Lab upload route accepts only exact-origin bounded inert input', async function () {
  const host = await LocalBrowserHost.createLocalBrowserHost(createSession(), {
    referenceConfig: { maxUploadBytes: 32 }
  });
  try {
    const origin = referenceOrigin(host.referenceLabUrl);
    const upload = await fetch(host.referenceLabUrl + 'upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        Origin: origin,
        'X-AXM-File-Name': encodeURIComponent('ride-reference.png'),
        'X-AXM-Purpose': 'find-similar',
        'X-AXM-User-Hint': encodeURIComponent('find something with this ride silhouette')
      },
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4])
    });
    const state = await upload.json();
    assert.equal(upload.status, 200);
    assert.equal(state.reference.kind, 'image');
    assert.equal(state.reference.name, 'ride-reference.png');
    assert.equal(state.reference.authority.executableContentAllowed, false);
    assert.equal(state.reference.authority.providerExecutionGranted, false);

    const oversized = await fetch(host.referenceLabUrl + 'upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        Origin: origin,
        'X-AXM-File-Name': encodeURIComponent('too-big.png')
      },
      body: Buffer.alloc(64, 1)
    });
    assert.equal(oversized.status, 400);
    assert.equal((await oversized.json()).code, 'REFERENCE_HOST_BYTES_LIMIT');
  } finally {
    await host.close();
  }
});
