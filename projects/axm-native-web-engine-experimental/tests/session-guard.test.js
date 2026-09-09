'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const BrowserSession = require('../src/browser-session');

const root = path.resolve(__dirname, '..');

function local(name) {
  return path.join(root, 'fixtures', name);
}

function create() {
  return new BrowserSession.LocalBrowserSession(
    local('session-home.html'),
    [local('session-about.html'), local('session-details.html')]
  );
}

test('query-bearing absolute local locators stay held before scheme classification', function () {
  const session = create();
  const before = session.snapshot();
  const home = before.bundle.pages.find(function (page) {
    return page.pageId === before.state.current.pageId;
  });

  const held = session.apply({ type: 'open-locator', locator: home.locator + '?mode=preview' });
  assert.equal(held.transitionTrace.at(-1).status, 'HELD');
  assert.equal(held.transitionTrace.at(-1).reason, 'HELD_QUERY_UNSUPPORTED');
  assert.deepEqual(held.state.current, before.state.current);
  assert.deepEqual(held.state.history, before.state.history);

  const network = session.apply({ type: 'open-locator', locator: 'https://example.invalid/?mode=preview' });
  assert.equal(network.transitionTrace.at(-1).reason, 'HELD_NETWORK', 'network authority remains the stronger classification');
});

test('session transition trace has a hard lifecycle bound before further mutation', function () {
  const session = create();
  const bundleBefore = session.bundle;
  const recordsBefore = session.records;
  const runtimeBefore = session.runtimeState;
  const sequenceBefore = session.nextTransitionSequence;

  session.transitionTrace = new Array(BrowserSession.MAX_TRANSITIONS).fill(null);

  assert.throws(function () {
    session.apply({ type: 'reload' });
  }, function (error) {
    return error.code === 'SESSION_TRANSITION_LIMIT'
      && error.details.transitionCount === BrowserSession.MAX_TRANSITIONS
      && error.details.maxTransitions === BrowserSession.MAX_TRANSITIONS;
  });

  assert.equal(session.bundle, bundleBefore);
  assert.equal(session.records, recordsBefore);
  assert.equal(session.runtimeState, runtimeBefore);
  assert.equal(session.nextTransitionSequence, sequenceBefore);
  assert.equal(session.transitionTrace.length, BrowserSession.MAX_TRANSITIONS);
});
