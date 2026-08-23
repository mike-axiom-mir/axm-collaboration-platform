'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const BrowserSession = require('../src/browser-session');
const LocalBrowserHost = require('../src/local-browser-host');
const Digest = require('../src/digest');

const root = path.resolve(__dirname, '..');
const entryRelative = 'fixtures/session-home.html';
const entryPath = path.join(root, entryRelative);

function makeSession() {
  return new BrowserSession.LocalBrowserSession(entryRelative, [
    'fixtures/session-about.html',
    'fixtures/session-details.html'
  ], { baseDirectory: root });
}

async function postJson(url, origin, body) {
  return fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, origin ? { Origin: origin } : {}),
    body: JSON.stringify(body),
    redirect: 'error'
  });
}

test('browser Builder Mode starts as a separate loopback workspace from the current page source', async function () {
  const session = makeSession();
  const host = await LocalBrowserHost.createLocalBrowserHost(session, { builderEnabled: true });
  try {
    assert.ok(host.builderUrl);
    assert.ok(host.builderReceipt);
    assert.equal(host.builderReceipt.schema, 'axm.web.html-builder-host-receipt/v1');
    assert.equal(host.builderReceipt.loopbackTransportUsed, true);
    assert.equal(host.builderReceipt.externalNetworkUsedByBuilderHost, false);
    assert.equal(host.builderReceipt.sourceFileMutationAllowed, false);
    assert.notEqual(new URL(host.builderUrl).origin, host.receipt.origin);

    const stateResponse = await fetch(new URL('state', host.builderUrl), { cache: 'no-store' });
    assert.equal(stateResponse.status, 200);
    const state = await stateResponse.json();
    assert.equal(state.source, fs.readFileSync(entryPath, 'utf8'));
    assert.equal(state.preview.source.sha256, Digest.sha256Hex(Buffer.from(state.source, 'utf8')));
    assert.equal(state.preview.preview.activePageCodeExecuted, false);
  } finally {
    await host.close();
  }
});

test('builder workspace UI exposes editor, sandboxed preview, and no persistent/browser authority', async function () {
  const host = await LocalBrowserHost.createLocalBrowserHost(makeSession(), { builderEnabled: true });
  try {
    const response = await fetch(host.builderUrl, { cache: 'no-store' });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(String(response.headers.get('content-security-policy')), /default-src 'none'/);
    assert.match(String(response.headers.get('content-security-policy')), /connect-src 'self'/);
    assert.match(html, /id="source"/);
    assert.match(html, /id="preview" sandbox=""/);
    assert.match(html, /IN-MEMORY DRAFT/);
    assert.match(html, /180 ms debounce/);
    assert.doesNotMatch(html, /localStorage|sessionStorage|document\.cookie/);
  } finally {
    await host.close();
  }
});

test('live compile requires exact Origin and changes preview without mutating source file or Browser Session', async function () {
  const beforeFile = fs.readFileSync(entryPath);
  const session = makeSession();
  const beforeSession = session.snapshot();
  const host = await LocalBrowserHost.createLocalBrowserHost(session, { builderEnabled: true });
  try {
    const compileUrl = new URL('compile', host.builderUrl);
    const draft = '<!doctype html><html><head><title>Live Changed</title></head><body><main><h1>Typed now</h1><p>Preview changed.</p></main></body></html>';

    const missing = await postJson(compileUrl, null, { source: draft, viewport: { width: 840, height: 600 } });
    assert.equal(missing.status, 403);
    assert.equal((await missing.json()).code, 'BUILDER_ORIGIN_REQUIRED');

    const wrong = await postJson(compileUrl, 'http://127.0.0.1:1', { source: draft, viewport: { width: 840, height: 600 } });
    assert.equal(wrong.status, 403);
    assert.equal((await wrong.json()).code, 'BUILDER_ORIGIN_REFUSED');

    const origin = new URL(host.builderUrl).origin;
    const ok = await postJson(compileUrl, origin, { source: draft, viewport: { width: 840, height: 600 } });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.preview.page.title, 'Live Changed');
    assert.equal(body.preview.viewport.width, 840);
    assert.match(body.preview.preview.html, /Typed now/);
    assert.notEqual(body.preview.source.sha256, beforeSession.state.current.sourceDigest);

    assert.deepEqual(fs.readFileSync(entryPath), beforeFile);
    assert.equal(session.snapshot().sessionDigest, beforeSession.sessionDigest);
    assert.equal(session.snapshot().transitionTrace.length, beforeSession.transitionTrace.length);
  } finally {
    await host.close();
  }
});
