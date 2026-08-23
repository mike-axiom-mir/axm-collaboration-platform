#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const requirements = [
  ['exact-baseline-reproduction','readiness.diagnostic-redaction.exact-parent-leak-reproduction',true],
  ['known-root-redaction','readiness.diagnostic-redaction.known-root-portable-placeholder',true],
  ['residual-windows-redaction','readiness.diagnostic-redaction.residual-windows-absolute-path',true],
  ['unc-redaction','readiness.diagnostic-redaction.unc-host-share-path',true],
  ['posix-and-file-url-redaction','readiness.diagnostic-redaction.posix-and-file-url-path',true],
  ['relative-context-preserved','readiness.diagnostic-redaction.relative-diagnostic-context',true],
  ['bounded-tail-preserved','readiness.diagnostic-redaction.bounded-failure-tail',true],
  ['raw-output-digest-preserved','readiness.diagnostic-redaction.raw-output-digest-continuity',true],
  ['input-receipt-immutability','readiness.diagnostic-redaction.input-result-not-mutated',true],
  ['receipt-creation-redaction','readiness.diagnostic-redaction.generator-and-daily-writer-redaction',true],
  ['index-ingestion-redaction','readiness.diagnostic-redaction.readiness-ingestion-defense',true],
  ['derived-index-clean','readiness.diagnostic-redaction.current-tools-index-clean',true],
  ['clean-product-replay','readiness.diagnostic-redaction.clean-product-replay',true],
  ['zero-consequential-authority','readiness.diagnostic-redaction.zero-promotion-merge-or-canon-authority',true],
  ['specialist-lane-excluded','readiness.diagnostic-redaction.specialist-package-lane-not-inspected',true],
  ['secret-token-redaction','readiness.diagnostic-redaction.secret-or-token-redaction',false],
  ['all-diagnostic-fields-redaction','readiness.diagnostic-redaction.all-diagnostic-fields',false],
  ['external-history-retroactive-sanitization','readiness.diagnostic-redaction.external-or-untracked-history-retroactive-sanitization',false],
  ['historical-git-rewrite','readiness.diagnostic-redaction.historical-git-rewrite',false],
  ['full-repository-privacy-audit','readiness.diagnostic-redaction.full-repository-privacy-audit',false]
].map(row => ({ id:row[0], required:row[2], capabilities:[row[1]] }));

const beforeAvailable = new Map([
  ['readiness.diagnostic-redaction.exact-parent-leak-reproduction','exact parent Git blobs; raw leaked path is not retained'],
  ['readiness.diagnostic-redaction.bounded-failure-tail','generator already bounded tails to 1200 characters but retained absolute paths'],
  ['readiness.diagnostic-redaction.raw-output-digest-continuity','raw command output SHA-256 already remained separate from the diagnostic tail'],
  ['readiness.diagnostic-redaction.zero-promotion-merge-or-canon-authority','readiness evidence grants no consequential authority'],
  ['readiness.diagnostic-redaction.specialist-package-lane-not-inspected','excluded by task scope']
]);
const afterAvailable = new Map(beforeAvailable);
[
  ['readiness.diagnostic-redaction.known-root-portable-placeholder','workspace home temp and declared roots become typed placeholders while suffix context remains'],
  ['readiness.diagnostic-redaction.residual-windows-absolute-path','unknown drive-rooted paths become ABSOLUTE_PATH'],
  ['readiness.diagnostic-redaction.unc-host-share-path','UNC host/share paths become UNC_PATH'],
  ['readiness.diagnostic-redaction.posix-and-file-url-path','POSIX absolute paths and file URLs become ABSOLUTE_PATH'],
  ['readiness.diagnostic-redaction.relative-diagnostic-context','relative repository paths web URLs messages codes and stack line coordinates remain available'],
  ['readiness.diagnostic-redaction.input-result-not-mutated','sanitized verification result is a shallow copy and the source failure tail stays unchanged'],
  ['readiness.diagnostic-redaction.generator-and-daily-writer-redaction','both receipt writers call the shared bounded redactor before persistence'],
  ['readiness.diagnostic-redaction.readiness-ingestion-defense','buildIndex sanitizes supplied verification results even when an older local receipt is raw'],
  ['readiness.diagnostic-redaction.current-tools-index-clean','27-assertion artifact selftest checks all 12 current retained tails'],
  ['readiness.diagnostic-redaction.clean-product-replay','five commands and synthetic readiness ingestion pass over 15 unchanged archived files']
].forEach(row => afterAvailable.set(row[0], row[1]));

function inventory(stage, available) {
  const ids = requirements.flatMap(item => item.capabilities);
  return {
    schema:'capability-inventory/v1', stage, status:'TEST',
    capabilities:ids.map(id => ({ id, status:available.has(id) ? 'available' : 'unavailable', constraints:available.has(id) ? [available.get(id)] : [] }))
  };
}
function write(name, value) { fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n'); }

write('CAPABILITY_REQUIREMENTS.json', { schema:'capability-requirements/v1', status:'TEST', requirements });
write('CAPABILITY_INVENTORY_BEFORE.json', inventory('before', beforeAvailable));
write('CAPABILITY_INVENTORY_AFTER.json', inventory('after', afterAvailable));

const python = process.env.AXM_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const scout = path.join(process.env.USERPROFILE || process.env.HOME || '', '.codex', 'skills', 'detect-capability-gaps', 'scripts', 'compare_capabilities.py');
const run = (inventoryName, outputName) => childProcess.spawnSync(python, [scout,
  '--requirements',path.join(__dirname,'CAPABILITY_REQUIREMENTS.json'),
  '--capabilities',path.join(__dirname,inventoryName),
  '--output',path.join(__dirname,outputName)
], { cwd:__dirname, encoding:'utf8', windowsHide:true });
const before = run('CAPABILITY_INVENTORY_BEFORE.json','CAPABILITY_GAP_BEFORE.json');
const after = run('CAPABILITY_INVENTORY_AFTER.json','CAPABILITY_GAP_AFTER.json');
const selftest = childProcess.spawnSync(python, [scout,'--self-test'], { cwd:__dirname, encoding:'utf8', windowsHide:true });
if (before.status !== 0 || after.status !== 0 || selftest.status !== 0) throw new Error(String(before.stderr || after.stderr || selftest.stderr || 'capability comparison failed'));
const beforeGap = JSON.parse(fs.readFileSync(path.join(__dirname,'CAPABILITY_GAP_BEFORE.json'),'utf8'));
const afterGap = JSON.parse(fs.readFileSync(path.join(__dirname,'CAPABILITY_GAP_AFTER.json'),'utf8'));
const requiredGaps = report => report.requirements.filter(item => item.required && item.status !== 'READY').length;
const optionalGaps = report => report.requirements.filter(item => !item.required && item.status !== 'READY').length;
if (beforeGap.overall !== 'BLOCKED' || requiredGaps(beforeGap) !== 10 || afterGap.overall !== 'DEGRADED' || requiredGaps(afterGap) !== 0 || optionalGaps(afterGap) !== 5) {
  throw new Error('capability gap summary mismatch');
}
console.log('PASS capability comparison: before 10 required gaps, after 0 required / 5 optional gaps; bundled comparator selftest passed');
