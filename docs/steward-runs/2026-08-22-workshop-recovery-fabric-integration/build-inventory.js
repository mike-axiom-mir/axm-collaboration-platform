#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..'));
const OUTPUT = process.argv[3] ? path.resolve(process.argv[3]) : null;

function git(args, options = {}) {
  return execFileSync('git', ['-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`, '-C', ROOT, ...args], {
    encoding: options.encoding || 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
}

function parseStatus() {
  const chunks = git(['-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-z', '-uall'])
    .split('\0');
  const records = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const entry = chunks[index];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    let relativePath = entry.slice(3).replace(/\\/g, '/');
    if (status.includes('R') || status.includes('C')) {
      const priorPath = chunks[index + 1];
      index += 1;
      records.push({ status, path: relativePath, priorPath });
      continue;
    }
    records.push({ status, path: relativePath });
  }
  return records;
}

function classify(relativePath) {
  const lower = relativePath.toLowerCase();
  const segments = lower.split('/');
  if (
    lower.startsWith('.codex-remote-attachments/') ||
    lower === '.env' ||
    lower.startsWith('sessions/') ||
    lower.startsWith('projects/') ||
    lower.startsWith('cache/') ||
    lower.startsWith('tmp/') ||
    lower === 'bridge/bridge-token.txt' ||
    lower === 'bridge/bridge.log' ||
    lower === 'logs/workshop.log'
  ) return 'private-local';
  if (segments.some((part) => ['node_modules', '__pycache__', '.pytest_cache', 'coverage'].includes(part))) {
    return 'generated-derived';
  }
  if (segments.some((part) => ['vendor', 'rollback'].includes(part)) || /\.(zip|7z|tar|gz)$/i.test(lower)) {
    return 'vendored-or-archive';
  }
  if (segments.some((part) => ['generated', 'out'].includes(part))) return 'generated-derived-review';
  if (lower.startsWith('docs/steward-runs/') || lower.startsWith('docs/history/')) return 'evidence-or-history';
  if (/\.(log|tmp|bak)(-|$|\.)/i.test(lower)) return 'local-output-review';
  return 'source-or-reviewed-data';
}

function contentFlags(buffer, relativePath) {
  const flags = [];
  const lower = relativePath.toLowerCase();
  if ((/(^|\/)\.env($|\.)/.test(lower) && !lower.endsWith('.env.example')) || /token|credential|secret/.test(path.basename(lower))) {
    flags.push('sensitive-filename');
  }
  if (buffer.length > 5 * 1024 * 1024 || buffer.includes(0)) return flags;
  const text = buffer.toString('utf8');
  const rules = [
    ['openai-key-shape', /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/],
    ['authorization-bearer', /Authorization\s*:\s*Bearer\s+[^\s"']+/i],
    ['assigned-secret-shape', /(?:api[_-]?key|secret|token)\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{16,}/i],
    ['personal-windows-path', /[A-Z]:\\Users\\[^\\\r\n]+/i],
    ['workshop-machine-path', /[A-Z]:\\AXM_ACTIVE\\/i],
  ];
  for (const [id, pattern] of rules) if (pattern.test(text)) flags.push(id);
  return flags;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function increment(target, key, amount = 1) {
  target[key] = (target[key] || 0) + amount;
}

const records = parseStatus();
const summary = { total: records.length, byStatus: {}, byClass: {}, byRoot: {}, bytesByClass: {}, flaggedFiles: 0 };
const files = [];

for (const record of records) {
  const absolutePath = path.join(ROOT, ...record.path.split('/'));
  const classification = classify(record.path);
  const item = { ...record, classification, exists: fs.existsSync(absolutePath) };
  increment(summary.byStatus, record.status);
  increment(summary.byClass, classification);
  increment(summary.byRoot, record.path.split('/')[0] || '(root)');
  if (item.exists) {
    const stat = fs.statSync(absolutePath);
    item.sizeBytes = stat.size;
    item.modifiedAt = stat.mtime.toISOString();
    increment(summary.bytesByClass, classification, stat.size);
    if (stat.isFile()) {
      const buffer = fs.readFileSync(absolutePath);
      item.sha256 = sha256(buffer);
      item.flags = contentFlags(buffer, record.path);
      if (item.flags.length) summary.flaggedFiles += 1;
    }
  }
  files.push(item);
}

const inventory = {
  schema: 'axm-workshop-recovery-inventory/v1',
  generatedAt: new Date().toISOString(),
  root: '<AXM_WORKSHOP>',
  branch: git(['branch', '--show-current']).trim(),
  head: git(['rev-parse', 'HEAD']).trim(),
  scope: 'Dirty tracked and untracked paths only; classification is conservative and requires steward review.',
  safety: {
    contentFlagsExposeValues: false,
    filesMoved: false,
    filesDeleted: false,
    experimentalRuntimesExecuted: false,
  },
  summary,
  files,
};

const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
if (OUTPUT) fs.writeFileSync(OUTPUT, serialized, 'utf8');
else process.stdout.write(serialized);
