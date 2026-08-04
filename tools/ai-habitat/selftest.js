'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');

const ROOT = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'module.contract.json'), 'utf8'));
const receipt = JSON.parse(fs.readFileSync(path.join(ROOT, 'INTAKE_RECEIPT.json'), 'utf8'));

assert.equal(manifest.id, 'ai-habitat');
assert.equal(manifest.status, 'TEST');
assert.equal(manifest.entry, 'workshop.html');
assert.equal(contract.id, manifest.id);
assert.equal(contract.version, manifest.version);
assert.deepEqual(ContractVerifier.validateContract(contract, manifest).errors, []);
assert.equal(receipt.source.sha256.length, 64);
assert.equal(receipt.integration.shared_seams_modified.length, 0);

const manifestLines = fs.readFileSync(path.join(ROOT, 'MANIFEST_SHA256.txt'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const mutableRuntime = new Set(['runtime/state.json', 'runtime/events.jsonl']);
let verified = 0;
let runtimeVerified = 0;
for (const line of manifestLines) {
  const match = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
  assert.ok(match, `invalid upstream manifest line: ${line}`);
  const file = path.resolve(ROOT, match[2].replaceAll('/', path.sep));
  assert.ok(file.startsWith(ROOT + path.sep), `upstream manifest path escaped: ${match[2]}`);
  assert.ok(fs.statSync(file).isFile(), `upstream file missing: ${match[2]}`);
  if (mutableRuntime.has(match[2])) {
    const text = fs.readFileSync(file, 'utf8');
    if (match[2].endsWith('state.json')) JSON.parse(text);
    else text.split(/\r?\n/).filter(Boolean).forEach((event) => JSON.parse(event));
    runtimeVerified += 1;
    continue;
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(actual, match[1].toLowerCase(), `upstream digest mismatch: ${match[2]}`);
  verified += 1;
}
assert.equal(verified, 29);
assert.equal(runtimeVerified, 2);

const landing = fs.readFileSync(path.join(ROOT, 'workshop.html'), 'utf8');
const adapter = fs.readFileSync(path.join(ROOT, 'adapters', 'workshop_presence.py'), 'utf8');
const launcher = fs.readFileSync(path.join(ROOT, 'scripts', 'start_windows.ps1'), 'utf8');
const stopper = fs.readFileSync(path.join(ROOT, 'scripts', 'stop_windows.ps1'), 'utf8');
assert.ok(landing.includes('Presence is observation, not authority'));
assert.ok(adapter.includes('ProxyHandler({})'));
assert.ok(adapter.includes('non-loopback request'));
assert.ok(!adapter.includes('https://'));
assert.ok(launcher.includes('codex-primary-runtime'));
assert.ok(stopper.includes('Refusing to stop process'));
assert.ok(stopper.includes('workshop_runtime.py'));
assert.ok(fs.existsSync(path.join(ROOT, 'workshop_runtime.py')));

console.log(`AI Habitat integration self-test: PASS (${verified} immutable upstream files intact; ${runtimeVerified} mutable runtime files valid; contract, launcher, landing page, and loopback bridge present)`);
