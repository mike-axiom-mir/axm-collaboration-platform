'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const BrowserSession = require('../src/browser-session');
const Canonical = require('../src/canonical-json');
const Engine = require('../src/engine');

const root = path.resolve(__dirname, '..');

function local(name) {
  return path.join(root, 'fixtures', name);
}

function create(options) {
  return new BrowserSession.LocalBrowserSession(
    local('session-home.html'),
    [local('session-about.html'), local('session-details.html')],
    options
  );
}

function currentPage(snapshot) {
  return snapshot.bundle.pages.find(function (page) { return page.pageId === snapshot.state.current.pageId; });
}

test('local bundle binds every human and headless page to the shared engine lineage', function () {
  const first = create().snapshot();
  const second = create().snapshot();
  assert.equal(first.schema, 'axm.web.local-browser-session/v1');
  assert.equal(first.bundle.schema, 'axm.web.local-browser-bundle/v1');
  assert.equal(first.bundle.pageCount, 3);
  assert.equal(first.bundle.totalSourceBytes, first.bundle.pages.reduce(function (sum, page) {
    return sum + fs.statSync(page.locator).size;
  }, 0));
  assert.equal(Canonical.stringify(first), Canonical.stringify(second));
  assert.equal(first.sessionDigest, second.sessionDigest);

  const home = first.bundle.pages[0];
  const processed = Engine.processBytes(fs.readFileSync(local('session-home.html')), { requestedUrl: home.locator });
  const structure = Engine.deriveStructure(processed, { requestedBy: 'browser-session-lineage-test' });
  assert.equal(home.sourceDigest, processed.source.sha256);
  assert.equal(home.documentDigest, processed.documentTree.documentDigest);
  assert.equal(home.pageModelDigest, processed.pageModel.pageModelDigest);
  assert.equal(home.structureIndexDigest, structure.structureIndex.structureIndexDigest);
  assert.deepEqual(home.links.map(function (link) { return link.resolution.state; }), [
    'AVAILABLE', 'SAME_DOCUMENT', 'HELD_UNLISTED_LOCAL', 'HELD_NETWORK'
  ]);
});

test('navigation, history, address, focus, and scroll share one deterministic state machine', function () {
  const session = create({ maxHistory: 3 });
  let snapshot = session.snapshot();
  const home = currentPage(snapshot);
  const available = home.links.find(function (link) { return link.resolution.state === 'AVAILABLE'; });
  snapshot = session.apply({ type: 'activate', entryRef: available.entryRef });
  assert.equal(snapshot.state.current.title, 'About the AXM Local Session');
  assert.equal(snapshot.state.current.fragment, 'team');
  assert.equal(snapshot.state.current.focusEntryRef, available.resolution.targetEntryRef);
  assert.equal(snapshot.state.canGoBack, true);

  const about = currentPage(snapshot);
  const details = about.links.find(function (link) { return /session-details/.test(link.rawTarget); });
  snapshot = session.apply({ type: 'activate', entryRef: details.entryRef });
  assert.equal(snapshot.state.current.title, 'AXM Session Details');
  assert.equal(snapshot.state.history.length, 3);

  snapshot = session.apply({ type: 'back' });
  assert.equal(snapshot.state.current.title, 'About the AXM Local Session');
  assert.equal(snapshot.state.canGoForward, true);
  snapshot = session.apply({ type: 'forward' });
  assert.equal(snapshot.state.current.title, 'AXM Session Details');

  snapshot = session.apply({ type: 'open-locator', locator: home.locator + '#features' });
  assert.equal(snapshot.state.current.title, 'AXM Local Home');
  assert.equal(snapshot.state.current.fragment, 'features');
  assert.equal(snapshot.state.history.length, 3, 'bounded history drops the oldest entry');
  assert.equal(snapshot.state.canGoForward, false);

  const heading = currentPage(snapshot).entries.find(function (entry) { return entry.kind === 'heading'; });
  snapshot = session.apply({ type: 'focus-entry', entryRef: heading.entryId });
  assert.equal(snapshot.state.current.focusEntryRef, heading.entryId);
  assert.equal(snapshot.state.current.scrollEntryRef, heading.entryId);
  const paragraph = currentPage(snapshot).entries.find(function (entry) { return entry.kind === 'paragraph'; });
  snapshot = session.apply({ type: 'scroll-entry', entryRef: paragraph.entryId });
  assert.equal(snapshot.state.current.focusEntryRef, heading.entryId);
  assert.equal(snapshot.state.current.scrollEntryRef, paragraph.entryId);
});

test('unlisted and network targets remain visible held transitions without state mutation', function () {
  const session = create();
  const initial = session.snapshot();
  const home = currentPage(initial);
  ['HELD_UNLISTED_LOCAL', 'HELD_NETWORK'].forEach(function (heldState) {
    const link = home.links.find(function (candidate) { return candidate.resolution.state === heldState; });
    const before = session.snapshot().state;
    const after = session.apply({ type: 'activate', entryRef: link.entryRef });
    assert.equal(after.transitionTrace.at(-1).status, 'HELD');
    assert.equal(after.transitionTrace.at(-1).reason, heldState);
    assert.deepEqual(after.state.current, before.current);
    assert.deepEqual(after.state.history, before.history);
  });
  const heldAddress = session.apply({ type: 'open-locator', locator: 'https://example.invalid/' });
  assert.equal(heldAddress.transitionTrace.at(-1).reason, 'HELD_NETWORK');
});

test('reload reparses explicitly allowed files, preserves history, and emits source receipts', function () {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-local-session-'));
  const homePath = path.join(temp, 'session-home.html');
  const aboutPath = path.join(temp, 'session-about.html');
  try {
    fs.copyFileSync(local('session-home.html'), homePath);
    fs.copyFileSync(local('session-about.html'), aboutPath);
    const session = new BrowserSession.LocalBrowserSession(homePath, [aboutPath]);
    let snapshot = session.snapshot();
    const link = currentPage(snapshot).links.find(function (candidate) { return candidate.resolution.state === 'AVAILABLE'; });
    snapshot = session.apply({ type: 'activate', entryRef: link.entryRef });
    const historyBefore = snapshot.state.history;
    const sessionIdBefore = snapshot.sessionId;
    const digestBefore = snapshot.state.current.sourceDigest;
    const focusBefore = snapshot.state.current.focusEntryRef;
    const changedSource = fs.readFileSync(aboutPath, 'utf8').replace(
      '<title>About the AXM Local Session</title>',
      '<title>About the AXM Local Session — reloaded</title>'
    ).replace(
      '<h1 id="team">A human and AI share this route</h1>',
      '<h2>Reloaded preface</h2>\n      <h1 id="team">A human and AI share this route</h1>'
    );
    fs.writeFileSync(aboutPath, changedSource, 'utf8');
    snapshot = session.apply({ type: 'reload' });
    assert.equal(snapshot.state.current.title, 'About the AXM Local Session — reloaded');
    assert.notEqual(snapshot.state.current.sourceDigest, digestBefore);
    assert.equal(snapshot.state.history.length, historyBefore.length);
    assert.equal(snapshot.state.historyCursor, 1);
    assert.equal(snapshot.state.reloadCount, 1);
    assert.equal(snapshot.sessionId, sessionIdBefore);
    assert.notEqual(snapshot.state.current.focusEntryRef, focusBefore, 'focus reference remaps after an inserted semantic entry');
    const focused = currentPage(snapshot).entries.find(function (entry) { return entry.entryId === snapshot.state.current.focusEntryRef; });
    assert.equal(focused.text, 'A human and AI share this route');
    const aboutReceipt = snapshot.transitionTrace.at(-1).reparseReceipt.find(function (item) {
      return item.pageId === snapshot.state.current.pageId;
    });
    assert.equal(aboutReceipt.beforeSourceDigest, digestBefore);
    assert.equal(aboutReceipt.afterSourceDigest, snapshot.state.current.sourceDigest);
    assert.equal(aboutReceipt.changed, true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('session page, byte, duplicate, and local-file boundaries fail visibly', function () {
  assert.throws(function () { create({ maxPages: 2 }); }, function (error) { return error.code === 'SESSION_PAGE_LIMIT'; });
  const originalProcessBytes = Engine.processBytes;
  let parseAttempted = false;
  Engine.processBytes = function () {
    parseAttempted = true;
    return originalProcessBytes.apply(this, arguments);
  };
  try {
    assert.throws(function () { create({ maxTotalBytes: 32 }); }, function (error) { return error.code === 'SESSION_BYTES_LIMIT'; });
    assert.equal(parseAttempted, false, 'combined bytes are bounded before parser work begins');
  } finally {
    Engine.processBytes = originalProcessBytes;
  }
  assert.throws(function () {
    return new BrowserSession.LocalBrowserSession(local('session-home.html'), [local('session-home.html')]);
  }, function (error) { return error.code === 'SESSION_DUPLICATE_PAGE'; });
  assert.throws(function () {
    return new BrowserSession.LocalBrowserSession('https://example.invalid/', []);
  }, function (error) { return error.code === 'SESSION_LOCAL_FILE_REQUIRED'; });
});
