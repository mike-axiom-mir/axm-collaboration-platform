'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../src/engine');
const Svg = require('../src/svg-renderer');
const BrowserSnapshot = require('../src/browser-snapshot');
const Cli = require('../cli');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'cli.js');
function fixture(name) { return fs.readFileSync(path.join(root, 'fixtures', name)); }
function run(args) { return childProcess.spawnSync(process.execPath, [cli].concat(args), { cwd: root, encoding: 'utf8' }); }

test('SVG renderer emits deterministic inert markup from the shared display list', function () {
  const processed = Engine.processBytes(fixture('adversarial-text.html'), { requestedUrl: 'fixtures/adversarial-text.html' });
  const bundle = Engine.deriveStructure(processed, { requestedBy: 'test' });
  const first = Svg.renderSvg(bundle.displayList, { title: bundle.layout.chrome.title });
  const second = Svg.renderSvg(bundle.displayList, { title: bundle.layout.chrome.title });
  assert.equal(first, second);
  assert.match(first, /data-display-list-digest=/);
  assert.match(first, /&lt;script&gt;must remain text&lt;\/script&gt;/);
  assert.doesNotMatch(first, /<script\b/i);
  assert.doesNotMatch(first, /<a\b/i);
  assert.doesNotMatch(first, /\shref=/i);
  assert.doesNotMatch(first, /\sonload=|\sonclick=/i);
  assert.doesNotMatch(first, /<foreignObject\b/i);
});

test('HTML snapshot embeds the same display list under a deny-by-default policy', function () {
  const processed = Engine.processBytes(fixture('adversarial-text.html'), { requestedUrl: 'fixtures/adversarial-text.html' });
  const bundle = Engine.deriveStructure(processed, { requestedBy: 'test' });
  const html = BrowserSnapshot.renderBrowserSnapshot(bundle);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, new RegExp(bundle.displayList.displayListDigest));
  assert.match(html, new RegExp(bundle.modificationLedger.ledgerDigest));
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /<a\b/i);
  assert.doesNotMatch(html, /\shref=/i);
  assert.doesNotMatch(html, /\sonload=|\sonclick=/i);
});

test('CLI visual artifacts require explicit safe writes and share the headless display digest', function () {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-visual-test-'));
  try {
    const svgPath = path.join(temp, 'view.svg');
    const htmlPath = path.join(temp, 'view.html');
    const displayRun = run(['display', 'fixtures/simple.html', '--viewport', '920x640', '--omit-source-bytes']);
    assert.equal(displayRun.status, 0, displayRun.stderr);
    const display = JSON.parse(displayRun.stdout);

    const svgRun = run(['render-svg', 'fixtures/simple.html', '--out', svgPath, '--viewport', '920x640']);
    assert.equal(svgRun.status, 0, svgRun.stderr);
    const svgReceipt = JSON.parse(svgRun.stdout);
    assert.equal(svgReceipt.schema, 'axm.web.artifact-receipt/v1');
    assert.equal(svgReceipt.displayListDigest, display.displayListDigest);
    assert.equal(svgReceipt.sourceMutated, false);
    assert.match(fs.readFileSync(svgPath, 'utf8'), /<svg\b/);

    const overwrite = run(['render-svg', 'fixtures/simple.html', '--out', svgPath, '--viewport', '920x640']);
    assert.equal(overwrite.status, 2);
    assert.equal(JSON.parse(overwrite.stderr).code, 'OUTPUT_EXISTS');
    const forced = run(['render-svg', 'fixtures/simple.html', '--out', svgPath, '--viewport', '920x640', '--force']);
    assert.equal(forced.status, 0, forced.stderr);
    assert.equal(JSON.parse(forced.stdout).sha256, svgReceipt.sha256);

    const htmlRun = run(['browser-snapshot', 'fixtures/simple.html', '--out', htmlPath, '--viewport', '920x640']);
    assert.equal(htmlRun.status, 0, htmlRun.stderr);
    const htmlReceipt = JSON.parse(htmlRun.stdout);
    assert.equal(htmlReceipt.displayListDigest, display.displayListDigest);
    assert.match(fs.readFileSync(htmlPath, 'utf8'), /SITE VIEW HELD/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('CLI refuses missing output and source-path overwrite', function () {
  const missing = run(['render-svg', 'fixtures/simple.html']);
  assert.equal(missing.status, 2);
  assert.equal(JSON.parse(missing.stderr).code, 'MISSING_OUTPUT');
  const overlap = run(['render-svg', 'fixtures/simple.html', '--out', 'fixtures/simple.html', '--force']);
  assert.equal(overlap.status, 2);
  assert.equal(JSON.parse(overlap.stderr).code, 'OUTPUT_OVERLAPS_INPUT');
});

test('artifact writes refuse a dangling final-component symlink', function () {
  const outputPath = path.resolve(root, 'synthetic-dangling-output.svg');
  const originalLstatSync = fs.lstatSync;
  const originalWriteFileSync = fs.writeFileSync;
  let writeAttempted = false;
  fs.lstatSync = function (candidate) {
    if (path.resolve(candidate) === outputPath) {
      return {
        isSymbolicLink: function () { return true; },
        isDirectory: function () { return false; }
      };
    }
    return originalLstatSync.apply(fs, arguments);
  };
  fs.writeFileSync = function () {
    writeAttempted = true;
    return originalWriteFileSync.apply(fs, arguments);
  };
  try {
    assert.throws(function () {
      Cli.writeArtifact(
        { command: 'render-svg', out: outputPath, force: false },
        { requestedUrl: 'stdin:' },
        '<svg/>',
        {}
      );
    }, function (error) { return error.code === 'OUTPUT_SYMLINK_HELD'; });
    assert.equal(writeAttempted, false);
  } finally {
    fs.lstatSync = originalLstatSync;
    fs.writeFileSync = originalWriteFileSync;
  }
});
