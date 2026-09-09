'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const BrowserSession = require('../src/browser-session');
const Engine = require('../src/engine');

const root = path.resolve(__dirname, '..');

function fixture(name) {
  return path.join(root, 'fixtures', name);
}

function withTempSession(options, run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-browser-lifecycle-'));
  const paths = {
    home: path.join(temp, 'session-home.html'),
    about: path.join(temp, 'session-about.html'),
    details: path.join(temp, 'session-details.html')
  };
  fs.copyFileSync(fixture('session-home.html'), paths.home);
  fs.copyFileSync(fixture('session-about.html'), paths.about);
  fs.copyFileSync(fixture('session-details.html'), paths.details);
  const session = new BrowserSession.LocalBrowserSession(paths.home, [paths.about, paths.details], options);
  try {
    run({ temp, paths, session });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function assertFailedReloadIsPrecommitAtomic(session, before, expectedCode) {
  assert.throws(function () {
    session.apply({ type: 'reload' });
  }, function (error) {
    return error && error.code === expectedCode;
  });
  assert.deepEqual(session.snapshot(), before, 'a failed precommit reload must not mutate bundle, state, or trace');
}

function assertNextReloadHasNoFaultGap(session) {
  const after = session.apply({ type: 'reload' });
  assert.equal(after.state.reloadCount, 1, 'failed reload attempts must not increment the public reload count');
  assert.equal(after.transitionTrace.length, 1, 'failed reload attempts must not append a transition');
  assert.equal(after.transitionTrace[0].sequence, 1, 'failed reload attempts must not consume transition sequence numbers');
  assert.equal(after.transitionTrace[0].action.type, 'reload');
}

test('reload remains unchanged when an explicitly allowed page disappears before commit', function () {
  withTempSession({}, function ({ paths, session }) {
    const before = session.snapshot();
    fs.rmSync(paths.about);
    assertFailedReloadIsPrecommitAtomic(session, before, 'SESSION_PAGE_NOT_FOUND');
    fs.copyFileSync(fixture('session-about.html'), paths.about);
    assertNextReloadHasNoFaultGap(session);
  });
});

test('reload remains unchanged when an explicitly allowed page stops being a regular file', function () {
  withTempSession({}, function ({ paths, session }) {
    const before = session.snapshot();
    fs.rmSync(paths.details);
    fs.mkdirSync(paths.details);
    assertFailedReloadIsPrecommitAtomic(session, before, 'SESSION_PAGE_NOT_FILE');
    fs.rmSync(paths.details, { recursive: true, force: true });
    fs.copyFileSync(fixture('session-details.html'), paths.details);
    assertNextReloadHasNoFaultGap(session);
  });
});

test('reload remains unchanged when rewritten sources cross the combined byte ceiling', function () {
  withTempSession({ maxTotalBytes: 4096 }, function ({ paths, session }) {
    const before = session.snapshot();
    fs.appendFileSync(paths.about, '\n' + 'x'.repeat(5000), 'utf8');
    assertFailedReloadIsPrecommitAtomic(session, before, 'SESSION_BYTES_LIMIT');
    fs.copyFileSync(fixture('session-about.html'), paths.about);
    assertNextReloadHasNoFaultGap(session);
  });
});

test('reload remains unchanged when parser work faults before a replacement bundle is committed', function () {
  withTempSession({}, function ({ session }) {
    const before = session.snapshot();
    const originalProcessBytes = Engine.processBytes;
    Engine.processBytes = function () {
      const error = new Error('deliberate lifecycle parser fault');
      error.code = 'TEST_PARSER_FAULT';
      throw error;
    };
    try {
      assertFailedReloadIsPrecommitAtomic(session, before, 'TEST_PARSER_FAULT');
    } finally {
      Engine.processBytes = originalProcessBytes;
    }
    assertNextReloadHasNoFaultGap(session);
  });
});
