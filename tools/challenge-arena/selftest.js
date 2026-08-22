#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const integrity = JSON.parse(fs.readFileSync(path.join(root, 'SOURCE_INTEGRITY.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
const observerCss = fs.readFileSync(path.join(root, 'axm_challenge_arena', 'static', 'styles.css'), 'utf8');
const observerJs = fs.readFileSync(path.join(root, 'axm_challenge_arena', 'static', 'app.js'), 'utf8');

assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.id, 'challenge-arena');
assert.equal(manifest.status, 'TEST');
assert.equal(manifest.installed, false);
assert.equal(manifest.promoted, false);
assert.deepEqual(manifest.permissions, []);
assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
assert.equal(integrity.source.release_internal_checksum_failures, 0);
assert.equal(integrity.curation.shared_registry_rewritten, false);
assert.equal(integrity.curation.hub_activation_performed, false);
assert.ok(fs.existsSync(path.join(root, 'axm_challenge_arena', '__init__.py')));
assert.ok(fs.existsSync(path.join(root, 'schemas', 'challenge-packet.schema.json')));
assert.ok(fs.existsSync(path.join(root, 'tests', 'test_v06_portability.py')));
assert.match(observerCss, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
assert.match(observerJs, /const compact = short\.length > 5 \? short\.slice\(0, 5\) : short;/);
assert.match(observerJs, /aria-label="\$\{escapeHtml\(row\.blind_label\)\}"/);
assert.match(observerJs, /node\.style\.left = `calc\(50%/);
assert.doesNotMatch(observerJs, /class="candidate-node[^\n]+style="left:/);
assert.ok(/<html\b[^>]*\blang=/i.test(html));
assert.ok(/name=["']viewport["']/i.test(html));
assert.ok(/:focus-visible/.test(html));
assert.ok(/min-height:\s*44px/.test(html));
assert.match(html, /Candidate execution <strong>off<\/strong>/);
assert.match(html, /Human decision required/);
for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  new vm.Script(match[1], { filename: 'tools/challenge-arena/index.html' });
}

console.log('challenge-arena Workshop selftest: PASS');
