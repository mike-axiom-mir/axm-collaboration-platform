'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Cli = require('../cli');

test('serve-local accepts explicit Builder Mode while other commands reject the flag', function () {
  const serve = Cli.parseArgs(['serve-local', 'fixtures/session-home.html', '--builder']);
  assert.equal(serve.builder, true);
  assert.throws(function () {
    Cli.parseArgs(['session', 'fixtures/session-home.html', '--builder']);
  }, function (error) { return error && error.code === 'INVALID_ARGUMENT'; });
});
