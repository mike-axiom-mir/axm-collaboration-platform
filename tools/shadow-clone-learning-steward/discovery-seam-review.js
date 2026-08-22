#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const Readiness = require('../../shared/readiness/tool-readiness');

const root = path.resolve(__dirname, '..', '..');
const index = Readiness.buildIndex(root, { now: '2026-08-22T12:00:00.000Z' });
const tool = index.tools.find(item => item.id === 'shadow-clone-learning-steward');
assert.ok(tool, 'machine module is discoverable');
assert.equal(tool.status, 'EXPERIMENTAL');
assert.equal(tool.kind, 'machine-capability');
assert.equal(tool.audience, 'machine');
assert.equal(tool.manifest.valid, true, tool.manifest.errors.join('; '));
assert.equal(tool.contract.valid, true, tool.contract.errors.join('; '));
assert.ok(tool.contract.provides.includes('shadow-clone.anti-drift.pickup'));
assert.ok(tool.contract.provides.includes('shadow-clone.trial-assignment.prepare'));
assert.ok(tool.contract.provides.includes('shadow-clone.review-decision.compose'));
assert.ok(tool.contract.provides.includes('shadow-clone.value-trial.evidence-bound-score'));
assert.ok(index.capabilities.some(item => item.id === 'mirror.private-lesson.proposal' && item.providers.includes(tool.id)));
assert.ok(index.capabilities.some(item => item.id === 'shadow-clone.trial-assignment.prepare' && item.providers.includes(tool.id)));
assert.ok(index.capabilities.some(item => item.id === 'shadow-clone.value-trial.evidence-bound-score' && item.providers.includes(tool.id)));
assert.equal(index.truth.automaticPromotion, false);
console.log('shadow clone learning discovery seam review: PASS');
