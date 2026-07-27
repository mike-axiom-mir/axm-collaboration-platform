#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
const html = read('index.html');
const app = read('app.js');
const css = read('review-inbox.css');
const structuralFunction = app.slice(app.indexOf('function renderStructural'), app.indexOf('function select'));

assert.equal(manifest.id, 'review-inbox');
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.version, 'v0.2');
assert.equal(manifest.status, 'TEST');
assert.equal(contract.version, manifest.version);
assert.ok(contract.boundaries.refuses.includes('automatic-apply'));
assert.ok(contract.boundaries.refuses.includes('approval-after-artifact-change'));
assert.ok(contract.boundaries.refuses.includes('structural-candidate-as-digest-approval'));
assert.ok(contract.boundaries.refuses.includes('structural-review-auto-queue'));
assert.ok(contract.boundaries.refuses.includes('stale-structural-evidence-as-current'));
assert.ok(contract.consumes.includes('axm.workshop-readiness-view/v1'));
assert.ok(contract.provides.includes('structural-review-evidence-view'));
assert.ok(html.includes('id="structuralStatus"') && html.includes('id="structuralCandidates"'));
assert.ok(html.includes('These cards cannot be voted on here.'));
assert.ok(html.includes('REVIEW EXACT DIGEST'));
assert.ok(app.includes('data.structuralReview'));
assert.ok(structuralFunction.includes('evidencePaths') && structuralFunction.includes('moduleRoute'));
assert.ok(structuralFunction.includes("view.state !== 'CURRENT'"));
assert.ok(!structuralFunction.includes('O.post') && !structuralFunction.includes('/api/reviews/vote'));
assert.ok(app.includes('artifactDigest: current.artifactDigest') && app.includes("'x-axm-review': 'exact-digest-vote'"));
assert.ok(!/localStorage|sessionStorage/.test(app));
assert.ok(css.includes('repeat(auto-fit, minmax(240px, 1fr))') && css.includes('@media (max-width: 700px)'));
new Function(app);

console.log('Review Inbox selftest: PASS (23 assertions, separated structural evidence and exact-digest authority)');
