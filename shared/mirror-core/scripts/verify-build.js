#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createMirrorServer } = require('../server/server');

const root = path.resolve(__dirname, '..');
const expectedSha = '33a87549259d8b4a7ce4753ee1fab49e0ee8091d';
const errors = [];
const checks = {};

const required = [
  'README_FIRST.md', 'ACTION_REPORT.md', 'TEST_REPORT.md', 'KNOWN_LIMITS.md',
  'BUILD_MANIFEST.json', 'SOURCE_REFERENCE.json', 'package.json',
  'docs/PR13_SOURCE_TRACE.md', 'docs/ARCHITECTURE.md',
  'docs/FOUNDATION_INTEGRATION_PLAN.md', 'docs/TRUTH_FACETS.md',
  'docs/CONSENT_AND_PERMISSIONS.md', 'docs/ADAPTER_GUIDE.md',
  'docs/MIRROR_PACKET_LIFECYCLE.md', 'docs/FUTURE_WORLD_INTEGRATION.md',
  'docs/FUTURE_PHYSICS_INTEGRATION.md', 'docs/FUTURE_COMPANY_MIRROR_BOUNDARIES.md',
  'docs/SHARED_CONTROLS_COMPATIBILITY.md',
  'foundation-adapter/foundation-contract.json',
  'foundation-adapter/pr13-compatibility.js',
  'foundation-adapter/compatibility-harness.js',
  'schemas/interaction/party-session.schema.json',
  'schemas/interaction/seat-binding.schema.json',
  'schemas/interaction/control-surface.schema.json',
  'schemas/interaction/action-intention.schema.json',
  'schemas/interaction/observation-envelope.schema.json',
  'server/server.js', 'ui/index.html', 'demo/demo-flow.js',
  'tests/api-smoke.test.js', 'tests/demo-e2e.test.js', 'tests/browser-smoke.js'
];

function walk(dir) {
  const found = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push.apply(found, walk(absolute));
    else if (entry.isFile()) found.push(absolute);
  });
  return found;
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

checks.required_files = required.every(function (relative) {
  const exists = fs.existsSync(path.join(root, relative));
  if (!exists) errors.push('required file missing: ' + relative);
  return exists;
});

const jsonFiles = walk(root).filter(function (file) {
  return file.endsWith('.json') && !file.includes(path.join('storage', 'runtime'));
});
const schemaIds = new Set();
let jsonOk = true;
jsonFiles.forEach(function (file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (file.includes(path.join(root, 'schemas')) && file.endsWith('.schema.json')) {
      if (!value.$id) throw new Error('schema missing $id');
      if (schemaIds.has(value.$id)) throw new Error('duplicate schema $id: ' + value.$id);
      schemaIds.add(value.$id);
    }
  } catch (error) {
    jsonOk = false;
    errors.push(path.relative(root, file) + ': ' + error.message);
  }
});
checks.json_and_schema_ids = jsonOk;

try {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'SOURCE_REFERENCE.json'), 'utf8'));
  checks.source_reference = source.head_sha === expectedSha && source.github_write_performed === false && source.foundation_installed === false;
  if (!checks.source_reference) errors.push('SOURCE_REFERENCE.json boundary or SHA mismatch');
} catch (error) {
  checks.source_reference = false;
  errors.push('source reference unreadable: ' + error.message);
}

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  checks.zero_runtime_dependencies = Object.keys(packageJson.dependencies || {}).length === 0;
  if (!checks.zero_runtime_dependencies) errors.push('runtime dependencies must remain empty for this package');
} catch (error) {
  checks.zero_runtime_dependencies = false;
}

const executableSources = walk(root).filter(function (file) { return /\.(js|sh|bat)$/.test(file) && file !== __filename; });
const forbidden = [
  { pattern: /require\(['"]child_process['"]\)/, label: 'child_process import' },
  { pattern: /\beval\s*\(/, label: 'eval call' },
  { pattern: /new\s+Function\s*\(/, label: 'Function constructor' },
  { pattern: /\bgit\s+push\b/i, label: 'git push command' },
  { pattern: /\bgh\s+pr\s+(create|edit|merge|close)\b/i, label: 'GitHub mutation command' }
];
let scanOk = true;
executableSources.forEach(function (file) {
  const text = fs.readFileSync(file, 'utf8');
  forbidden.forEach(function (rule) {
    if (rule.pattern.test(text)) {
      scanOk = false;
      errors.push(rule.label + ' found in ' + path.relative(root, file));
    }
  });
});
checks.no_arbitrary_execution_or_github_write_commands = scanOk;

try {
  createMirrorServer({ host: '0.0.0.0', port: 0 });
  checks.loopback_only = false;
  errors.push('server accepted non-loopback binding');
} catch (error) {
  checks.loopback_only = /refuses non-loopback/.test(error.message);
  if (!checks.loopback_only) errors.push('unexpected loopback validation result: ' + error.message);
}

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_MANIFEST.json'), 'utf8'));
  let manifestOk = manifest.sourceHeadSha === expectedSha && Array.isArray(manifest.files) && manifest.files.length > 0;
  (manifest.files || []).forEach(function (entry) {
    const file = path.resolve(root, entry.path);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || hash(file) !== entry.sha256 || fs.statSync(file).size !== entry.bytes) {
      manifestOk = false;
      errors.push('manifest mismatch: ' + entry.path);
    }
  });
  checks.manifest_hashes = manifestOk;
  if (!manifestOk && !(manifest.files || []).length) errors.push('build manifest has not been generated');
} catch (error) {
  checks.manifest_hashes = false;
  errors.push('build manifest unreadable: ' + error.message);
}

const result = {
  schema: 'axm.mirror.build-verification/v1',
  status: errors.length ? 'FAIL' : 'PASS',
  root: path.basename(root),
  source_head_sha: expectedSha,
  checks,
  errors
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (errors.length) process.exitCode = 1;
