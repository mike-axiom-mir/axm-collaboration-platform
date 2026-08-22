#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const Capsule = require('../../../shared/portable-baseline-capsule/portable-baseline-capsule');

const root = path.resolve(__dirname, '../../..');
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function file(relative) {
  return path.join(root, relative);
}

function sha256File(relative) {
  return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(file(relative))).digest('hex');
}

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'CURRENT_SOFTWARE_SOURCE_MANIFEST.json'), 'utf8'));
const capsule = JSON.parse(fs.readFileSync(path.join(__dirname, 'CURRENT_SOFTWARE_BASELINE_CAPSULE.json'), 'utf8'));
const readiness = JSON.parse(fs.readFileSync(path.join(__dirname, 'READINESS.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(file('shared/portable-baseline-capsule/module.contract.json'), 'utf8'));

check(Capsule.verify(capsule).pass, 'current software capsule rebuilds and verifies exactly');
check(manifest.files.length === 6 && manifest.scope.wholeWorkshopClaimed === false, 'source manifest declares exactly six leaf files and no whole-Workshop claim');
manifest.files.forEach(entry => {
  check(sha256File(entry.id) === entry.sha256, 'manifest hash matches ' + entry.id);
  check(fs.statSync(file(entry.id)).size === entry.bytes, 'manifest byte count matches ' + entry.id);
});
check(sha256File('docs/steward-runs/2026-08-19-portable-baseline-capsule/CURRENT_SOFTWARE_SOURCE_MANIFEST.json') === capsule.contentRef.sha256, 'capsule content reference matches the declared manifest bytes');
check(sha256File('shared/portable-baseline-capsule/module.contract.json') === capsule.configRef.sha256, 'capsule config reference matches the module contract bytes');
check(sha256File('docs/steward-runs/2026-08-19-portable-baseline-capsule/CURRENT_SOFTWARE_BASELINE_VIEW.md') === capsule.generatedViews[0].viewRef.sha256, 'capsule generated-view reference matches the view bytes');

const scopedStatus = childProcess.execFileSync('git', [
  'status', '--porcelain=v1', '--untracked-files=all', '--', 'shared/portable-baseline-capsule'
], { cwd: root, encoding: null });
const scopedStatusDigest = 'sha256:' + crypto.createHash('sha256').update(scopedStatus).digest('hex');
const scopedEntries = scopedStatus.toString('utf8').split(/\r?\n/).filter(Boolean);
check(scopedStatusDigest === capsule.adapter.workingTree.statusRef.sha256, 'scoped Git-status bytes match the live capsule');
check(scopedEntries.length === manifest.workingTreeObservation.entryCount, 'scoped Git-status entry count matches the manifest');
check(capsule.adapter.versionOrCommit === childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), 'capsule repository ancestry matches current HEAD');
check(capsule.adapter.workingTree.state === 'DIRTY' && scopedEntries.length > 0, 'capsule keeps the observed dirty state explicit');

const noNew = Capsule.compare(capsule, capsule, {
  comparisonId: 'comparison:current-live-self',
  comparedAt: '2026-08-19T07:12:00.000Z'
});
check(noNew.state === 'NO_NEW_INFORMATION' && Capsule.verifyComparison(noNew, capsule, capsule).pass, 'identical live capsule comparison returns verified NO_NEW_INFORMATION');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module contract remains TEST with no permissions or writes');
check(readiness.authority.installed === false && readiness.authority.canon === false, 'readiness records no installation or CANON authority');
check(readiness.capabilities.some(item => item.id === 'simulation.lab.multi-substrate-live-run' && item.status === 'NOT_RUN'), 'multi-substrate live run remains explicitly NOT_RUN');
check(readiness.capabilities.some(item => item.id === 'human.review' && item.status === 'NOT_RUN'), 'human review remains explicitly NOT_RUN');
check(!/[A-Za-z]:\\\\/.test(JSON.stringify({ manifest, capsule, readiness })), 'persisted audit records contain no Windows machine paths');
check(capsule.truth.sourceExecuted === false && capsule.truth.automaticCanon === false, 'live capsule records no source execution or automatic CANON');

console.log('Portable Baseline Capsule audit selftest: ' + checks + ' checks passed.');
