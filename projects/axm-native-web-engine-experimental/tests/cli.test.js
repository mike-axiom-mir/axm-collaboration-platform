'use strict';

const path = require('node:path');
const childProcess = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'cli.js');

function run(args) {
  return childProcess.spawnSync(process.execPath, [cli].concat(args), { cwd: root, encoding: 'utf8' });
}

test('inspect command exposes Page Model through the shared engine', function () {
  const result = run(['inspect', 'fixtures/simple.html', '--omit-source-bytes']);
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.schema, 'axm.web.headless-result/v1');
  assert.equal(body.command, 'inspect');
  assert.equal(body.page.schema, 'axm.web.page-model/v1');
  assert.equal(body.document, undefined);
  assert.equal(body.source.rawSourceBase64, undefined);
  assert.equal(body.source.binding.digest, body.source.sha256);
});

test('parse command exposes Document Tree without duplicating Page Model output', function () {
  const result = run(['parse', 'fixtures/simple.html']);
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.document.schema, 'axm.web.document-tree/v1');
  assert.equal(body.page, undefined);
  assert.equal(body.source.bytesPreserved, true);
  assert.equal(typeof body.source.rawSourceBase64, 'string');
});

test('network input is a visible held state', function () {
  const result = run(['inspect', 'https://example.org']);
  assert.equal(result.status, 2);
  const error = JSON.parse(result.stderr);
  assert.equal(error.code, 'NETWORK_HELD');
  assert.equal(result.stdout, '');
});

test('profile reports one engine lineage and honest status', function () {
  const result = run(['profile']);
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.engine.status, 'EXPERIMENTAL');
  assert.equal(body.engine.installed, false);
  assert.equal(body.engine.promoted, false);
  assert.equal(body.capabilities.profile, body.engine.standardsProfile);
});
