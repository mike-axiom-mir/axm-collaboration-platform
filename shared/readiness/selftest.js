#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const Readiness = require('./tool-readiness');

const root = path.resolve(__dirname, '..', '..');
const first = Readiness.buildIndex(root, { now: '2026-07-23T00:00:00.000Z' });
const second = Readiness.buildIndex(root, { now: '2026-07-23T00:00:00.000Z' });
assert.deepEqual(Readiness.validateIndex(first), { pass: true, errors: [] });
assert.equal(first.sourceDigest, second.sourceDigest, 'same source produces the same digest');
assert.equal(first.summary.tools, first.tools.length);
assert.ok(first.tools.length >= 100, 'full Workshop inventory is represented');
assert.equal(first.truth.automaticPromotion, false);
assert.equal(first.truth.selftestPassIsHumanApproval, false);
assert.ok(first.capabilities.every(row => Array.isArray(row.providers) && Array.isArray(row.consumers)));
const bad = Readiness.validateTargetManifest({ id: 'wrong', name: 'Wrong', version: '1', status: 'TEST', entry: 'index.html', uses: [], permissions: [] }, 'folder');
assert.ok(bad.some(message => message.startsWith('id must equal folder name')));
console.log('tool readiness selftest: PASS (' + first.tools.length + ' tools, ' + first.summary.capabilities + ' capabilities)');
