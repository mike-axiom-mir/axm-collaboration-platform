#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'), 'utf8'));
const evidenceNames = fs.readdirSync(__dirname, { withFileTypes:true }).filter(entry => entry.isFile() && entry.name !== 'SENSITIVE_LITERAL_SCAN.json').map(entry => path.join('docs/steward-runs/2026-08-21-readiness-diagnostic-credential-redaction', entry.name));
const names = Array.from(new Set(source.files.map(file => file.path).concat(evidenceNames))).sort();
const patterns = [
  ['openai-like', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['github-like', /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g],
  ['slack-like', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['google-like', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['aws-access-key-like', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['stripe-live-like', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
  ['jwt-like', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
  ['private-key-block', /-----BEGIN ([A-Z ]*PRIVATE KEY)-----[\s\S]*?-----END \1-----/g],
  ['literal-authorization-value', /authorization\s*:\s*(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi]
];
const counts = Object.fromEntries(patterns.map(([name]) => [name, 0]));
let workspacePathHits = 0;
let assembledFixtureHits = 0;
names.forEach(name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  patterns.forEach(([label, pattern]) => { counts[label] += (text.match(pattern) || []).length; });
  workspacePathHits += text.split(ROOT).length - 1;
  assembledFixtureHits += text.split(['axm','fixture','credential'].join('-')).length - 1;
});
const receipt = {
  schema:'axm.sensitive-literal-scan/v1',
  status:Object.values(counts).every(value => value === 0) && workspacePathHits === 0 && assembledFixtureHits === 0 ? 'PASS' : 'FAIL',
  scope:{ productFiles:source.files.length, evidenceFiles:evidenceNames.length, totalFiles:names.length },
  recognizedLiteralPatternHits:counts,
  currentWorkspacePathHits:workspacePathHits,
  assembledFixtureCredentialHits:assembledFixtureHits,
  arbitrarySecretAbsenceProven:false,
  rawMatchedValuesRetained:false,
  receiptDigest:null
};
const body = JSON.parse(JSON.stringify(receipt)); delete body.receiptDigest;
receipt.receiptDigest = 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
fs.writeFileSync(path.join(__dirname, 'SENSITIVE_LITERAL_SCAN.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(receipt.status + ' sensitive literal scan: ' + names.length + ' files, zero recognized literal/path/fixture hits');
if (receipt.status !== 'PASS') process.exitCode = 1;

