'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKSHOP = path.resolve(ROOT, '..', '..', '..', '..');
const Generator = require(path.join(WORKSHOP, 'shared', 'code-capability-fabric', 'deterministic-adventure-content-generator-v1'));
const PackageVerifier = require(path.join(WORKSHOP, 'tools', 'game-hub', 'game-package-verifier'));

function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }

const manifest = json('game.manifest.json');
assert.strictEqual(manifest.slot, '020');
assert.strictEqual(manifest.game_id, '020-four-roots-adventure');
assert.ok(manifest.status.startsWith('TEST'));
assert.strictEqual(manifest.rules.simulation_authority, 'server');
assert.strictEqual(manifest.rules.save_authority, 'server-file-content-bound');
assert.strictEqual(manifest.rules.canon_effect, 'none');
assert.strictEqual(manifest.launch.port, 8820);
assert.strictEqual(manifest.launch.local_only_default, true);
assert.deepStrictEqual(manifest.allowed_seat_types, ['human']);
assert.strictEqual(manifest.controls.phone_controller, false);
assert.strictEqual(manifest.controls.gamepad, false);
assert.strictEqual(manifest.controls.touch, false);

for (const required of manifest.package.required_paths) assert.ok(fs.existsSync(path.join(ROOT, required)), 'missing required path ' + required);
const verified = PackageVerifier.verifyGameDir(ROOT);
assert.deepStrictEqual(verified.errors, [], verified.errors.join('\n'));

const generated = Generator.generate(Generator.buildExampleRequest());
const contentBytes = fs.readFileSync(path.join(ROOT, Generator.CONTENT_PATH));
assert.strictEqual(Generator.hashBuffer(contentBytes), generated.packet.contentFile.sha256);
assert.strictEqual(contentBytes.toString('base64'), generated.packet.contentFile.content);
assert.strictEqual(contentBytes.length, generated.packet.contentFile.byteLength);
assert.strictEqual(generated.packet.packetDigest, 'sha256:a6282704d1c78b0f8fbb7c03e5d6588b872a01a41a25c5abc097bfb7ac76f039');

const decision = json('promotion/mike-test-promotion-decision.json');
assert.deepStrictEqual(decision, Generator.buildExampleDecision());
const receipt = json('promotion/test-installation-receipt.json');
assert.strictEqual(receipt.decisionRef.sha256, decision.decisionDigest);
assert.strictEqual(receipt.contentReleaseRef.sha256, generated.packet.packetDigest);
assert.strictEqual(receipt.contentFile.sha256, generated.packet.contentFile.sha256);
assert.strictEqual(receipt.application.generatedCodePerformedInstall, false);
assert.strictEqual(receipt.application.installedInCanonicalCheckout, false);
assert.strictEqual(receipt.authority.canonChanged, false);
assert.strictEqual(receipt.authority.publicRelease, false);

const ancestor = json('rollback/first-generated-v0.1.json');
assert.strictEqual(ancestor.packetDigest, Generator.ANCESTOR.packetDigest);
assert.strictEqual(ancestor.sourceCommit, Generator.ANCESTOR.sourceCommit);
assert.strictEqual(ancestor.canon, false);

const html = read('runtime/index.html');
const app = read('runtime/app.js');
const styles = read('runtime/styles.css');
assert.match(html, /name="viewport"/);
assert.match(html, /aria-live="polite"/);
assert.match(html, /id="help-panel"[^>]*hidden/);
assert.match(html, /id="ending-panel"[^>]*hidden/);
for (const label of ['Move up', 'Move down', 'Move left', 'Move right']) assert.ok(html.includes('aria-label="' + label + '"'));
assert.ok(app.includes("event.key === 'Escape'"));
assert.ok(app.includes('window.AXM_ADVENTURE_ACTION'));
assert.ok(styles.includes('button:focus-visible'));
assert.ok(styles.includes('@media (max-width: 720px)'));
for (const source of [html, app, styles]) {
  assert.doesNotMatch(source, /https?:\/\//i, 'runtime source must not reference remote assets or endpoints');
  assert.doesNotMatch(source, /WebSocket|EventSource|sendBeacon/i, 'runtime source must not add an alternate network channel');
}

console.log('PASS Four Roots Adventure package selftest (47 assertions)');
