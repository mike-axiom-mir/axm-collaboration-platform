#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const rows = [
  ['exact-baseline','readiness.diagnostic-credential.exact-parent-reproduction',true],
  ['header-redaction','readiness.diagnostic-credential.header-value-redaction',true],
  ['named-redaction','readiness.diagnostic-credential.named-assignment-redaction',true],
  ['cli-redaction','readiness.diagnostic-credential.cli-flag-redaction',true],
  ['uri-redaction','readiness.diagnostic-credential.uri-userinfo-query-redaction',true],
  ['private-key-redaction','readiness.diagnostic-credential.private-key-block-redaction',true],
  ['fingerprint-redaction','readiness.diagnostic-credential.recognized-fingerprint-redaction',true],
  ['explicit-marker','readiness.diagnostic-credential.explicit-redaction-marker',true],
  ['ordinary-context','readiness.diagnostic-credential.ordinary-context-preservation',true],
  ['path-continuity','readiness.diagnostic-credential.machine-path-redaction-continuity',true],
  ['bounded-tail','readiness.diagnostic-credential.bounded-tail-continuity',true],
  ['digest-continuity','readiness.diagnostic-credential.raw-output-digest-continuity',true],
  ['receipt-immutability','readiness.diagnostic-credential.source-receipt-immutability',true],
  ['writer-boundaries','readiness.diagnostic-credential.generator-daily-writer-boundary',true],
  ['ingestion-defense','readiness.diagnostic-credential.readiness-ingestion-defense',true],
  ['qualified-truth','readiness.diagnostic-credential.qualified-truth-and-validation',true],
  ['current-index-scan','readiness.diagnostic-credential.current-index-idempotent-scan',true],
  ['required-checks','readiness.diagnostic-credential.required-checks',true],
  ['clean-replay','readiness.diagnostic-credential.clean-product-replay',true],
  ['zero-authority','readiness.diagnostic-credential.zero-promotion-merge-canon-authority',true],
  ['specialist-exclusion','readiness.diagnostic-credential.specialist-package-lane-excluded',true],
  ['arbitrary-secret-detection','readiness.diagnostic-credential.arbitrary-secret-detection',false],
  ['encoded-split-secret-detection','readiness.diagnostic-credential.encoded-or-split-secret-detection',false],
  ['arbitrary-field-sanitization','readiness.diagnostic-credential.arbitrary-diagnostic-field-sanitization',false],
  ['retroactive-history','readiness.diagnostic-credential.retroactive-external-history-sanitization',false],
  ['historical-rewrite','readiness.diagnostic-credential.historical-git-rewrite',false],
  ['full-privacy-audit','readiness.diagnostic-credential.full-repository-privacy-audit',false]
];
const requirements = rows.map(row => ({ id:row[0], capabilities:[row[1]], required:row[2] }));
const beforeAvailable = new Map([
  ['readiness.diagnostic-credential.exact-parent-reproduction','five synthetic recognized surfaces pass unchanged through the exact parent blob'],
  ['readiness.diagnostic-credential.ordinary-context-preservation','v4.6 preserved relative paths web URLs and diagnostic messages'],
  ['readiness.diagnostic-credential.machine-path-redaction-continuity','v4.6 redacts known and residual absolute paths'],
  ['readiness.diagnostic-credential.bounded-tail-continuity','failure tails remain bounded after redaction'],
  ['readiness.diagnostic-credential.raw-output-digest-continuity','raw output SHA-256 is stored separately from failureTail'],
  ['readiness.diagnostic-credential.source-receipt-immutability','v4.6 sanitizes into a shallow copy'],
  ['readiness.diagnostic-credential.zero-promotion-merge-canon-authority','readiness diagnostics grant no authority'],
  ['readiness.diagnostic-credential.specialist-package-lane-excluded','task scope excludes specialist package intake']
]);
const afterAvailable = new Map(beforeAvailable);
[
  ['readiness.diagnostic-credential.header-value-redaction','authorization proxy authorization API key auth token cookie and set-cookie header values become an explicit marker'],
  ['readiness.diagnostic-credential.named-assignment-redaction','recognized environment JSON config and npm-style named values are redacted'],
  ['readiness.diagnostic-credential.cli-flag-redaction','recognized credential flags redact quoted or unquoted values'],
  ['readiness.diagnostic-credential.uri-userinfo-query-redaction','scheme URI user-info and recognized query/fragment assignments are redacted'],
  ['readiness.diagnostic-credential.private-key-block-redaction','bounded PEM private-key blocks become one marker'],
  ['readiness.diagnostic-credential.recognized-fingerprint-redaction','selected OpenAI GitHub Slack Google AWS Stripe and JWT-like fingerprints are redacted'],
  ['readiness.diagnostic-credential.explicit-redaction-marker','retained diagnostics expose REDACTED_CREDENTIAL rather than silently deleting context'],
  ['readiness.diagnostic-credential.generator-daily-writer-boundary','both production failureTail writers use the shared sanitizer'],
  ['readiness.diagnostic-credential.readiness-ingestion-defense','supplied legacy results are sanitized at index ingestion'],
  ['readiness.diagnostic-credential.qualified-truth-and-validation','index truth names recognized evidence only and validation rejects omission'],
  ['readiness.diagnostic-credential.current-index-idempotent-scan','all current retained failure tails are idempotently sanitized'],
  ['readiness.diagnostic-credential.required-checks','all ten AGENTS commands pass'],
  ['readiness.diagnostic-credential.clean-product-replay','archived product slice passes commands and synthetic ingestion without tracked mutation']
].forEach(row => afterAvailable.set(row[0], row[1]));
function inventory(stage, available) {
  return { schema:'capability-inventory/v1', stage, status:'TEST', capabilities:requirements.flatMap(item => item.capabilities).map(id => ({ id, status:available.has(id) ? 'available' : 'unavailable', constraints:available.has(id) ? [available.get(id)] : [] })) };
}
function write(name, value) { fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n'); }
write('CAPABILITY_REQUIREMENTS.json', { schema:'capability-requirements/v1', status:'TEST', requirements });
write('CAPABILITY_INVENTORY_BEFORE.json', inventory('before', beforeAvailable));
write('CAPABILITY_INVENTORY_AFTER.json', inventory('after', afterAvailable));
const python = process.env.AXM_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const scout = path.join(process.env.USERPROFILE || process.env.HOME || '', '.codex', 'skills', 'detect-capability-gaps', 'scripts', 'compare_capabilities.py');
function compare(inventoryName, outputName) {
  return childProcess.spawnSync(python, [scout, '--requirements',path.join(__dirname,'CAPABILITY_REQUIREMENTS.json'), '--capabilities',path.join(__dirname,inventoryName), '--output',path.join(__dirname,outputName)], { cwd:__dirname, encoding:'utf8', windowsHide:true });
}
const before = compare('CAPABILITY_INVENTORY_BEFORE.json','CAPABILITY_GAP_BEFORE.json');
const after = compare('CAPABILITY_INVENTORY_AFTER.json','CAPABILITY_GAP_AFTER.json');
const selftest = childProcess.spawnSync(python, [scout,'--self-test'], { cwd:__dirname, encoding:'utf8', windowsHide:true });
if (before.status !== 0 || after.status !== 0 || selftest.status !== 0) throw new Error('capability comparison failed');
const beforeGap = JSON.parse(fs.readFileSync(path.join(__dirname,'CAPABILITY_GAP_BEFORE.json'),'utf8'));
const afterGap = JSON.parse(fs.readFileSync(path.join(__dirname,'CAPABILITY_GAP_AFTER.json'),'utf8'));
const requiredGaps = report => report.requirements.filter(item => item.required && item.status !== 'READY').length;
const optionalGaps = report => report.requirements.filter(item => !item.required && item.status !== 'READY').length;
if (beforeGap.overall !== 'BLOCKED' || requiredGaps(beforeGap) < 1 || afterGap.overall !== 'DEGRADED' || requiredGaps(afterGap) !== 0 || optionalGaps(afterGap) !== 6) throw new Error('capability summary mismatch');
console.log('PASS capability comparison: before ' + requiredGaps(beforeGap) + ' required gaps, after 0 required / ' + optionalGaps(afterGap) + ' optional gaps; comparator selftest passed');

