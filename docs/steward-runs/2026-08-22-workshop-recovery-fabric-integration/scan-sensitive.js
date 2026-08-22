#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2]);
const inventory = JSON.parse(fs.readFileSync(path.resolve(process.argv[3]), 'utf8'));
const output = path.resolve(process.argv[4]);
const findings = [];

for (const file of inventory.files.filter((item) => (item.flags || []).includes('assigned-secret-shape'))) {
  const text = fs.readFileSync(path.join(ROOT, ...file.path.split('/')), 'utf8');
  const pattern = /(api[_-]?key|secret|token)\s*[:=]\s*(["']?)([A-Za-z0-9_\-./+=]{16,})/gi;
  let match;
  while ((match = pattern.exec(text))) {
    const value = match[3];
    const lineText = text.split(/\r?\n/)[text.slice(0, match.index).split(/\r?\n/).length - 1] || '';
    findings.push({
      path: file.path,
      line: text.slice(0, match.index).split(/\r?\n/).length,
      key: match[1].toLowerCase(),
      quotedLiteral: Boolean(match[2]),
      valueLength: value.length,
      valueDigest: crypto.createHash('sha256').update(value).digest('hex'),
      placeholderMarkers: /test|example|dummy|fixture|sample|fake|local|token|secret|session|seat|resume|player|device|replace|changeme/i.test(value),
      identifierLike: !match[2] && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value),
      redactedLine: lineText.replace(value, `<redacted:${value.length}:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)}>`),
    });
  }
}

const report = {
  schema: 'axm-secret-shape-redacted-review/v1',
  generatedAt: new Date().toISOString(),
  sourceInventory: path.basename(process.argv[3]),
  valuesExposed: false,
  findings,
  summary: {
    total: findings.length,
    quotedLiterals: findings.filter((item) => item.quotedLiteral).length,
    quotedWithoutPlaceholderMarkers: findings.filter((item) => item.quotedLiteral && !item.placeholderMarkers).length,
    identifierExpressions: findings.filter((item) => item.identifierLike).length,
  },
};

fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
