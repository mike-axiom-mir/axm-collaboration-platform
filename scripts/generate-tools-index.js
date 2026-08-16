#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const crypto = require('crypto');
const Readiness = require('../shared/readiness/tool-readiness');

const ROOT = path.resolve(__dirname, '..');
const outputFile = path.join(ROOT, 'tools-index.json');
const receiptFile = path.join(ROOT, 'state', 'tool-readiness', 'latest-selftests.json');
const RECEIPT_SCHEMA = 'axm.tool-selftest-results/v1';

function boundedNumber(args, prefix, fallback, minimum, maximum) {
  const value = args.find(item => item.startsWith(prefix));
  const parsed = Number(value && value.slice(prefix.length));
  return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? parsed : fallback));
}

function parseOptions(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const verify = args.includes('--verify');
  if (args.includes('--tool')) throw new Error('--tool requires the form --tool=id or --tool=id,id');
  const requestedToolIds = [];
  args.filter(value => value.startsWith('--tool=')).forEach(value => {
    const raw = value.slice('--tool='.length);
    if (!raw.trim()) throw new Error('--tool requires at least one non-empty tool id');
    raw.split(',').forEach(id => {
      id = id.trim();
      if (!id) throw new Error('--tool contains an empty tool id');
      requestedToolIds.push(id);
    });
  });
  const selectedToolIds = Array.from(new Set(requestedToolIds)).sort();
  if (selectedToolIds.length && !verify) throw new Error('--tool requires --verify');
  return {
    verify,
    selectedToolIds,
    workers: boundedNumber(args, '--workers=', 2, 1, 4),
    timeoutMs: boundedNumber(args, '--timeout-ms=', 45000, 1000, 120000)
  };
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function runOne(tool, options) {
  return new Promise(resolve => {
    const started = Date.now();
    const absolute = path.join(options.root, tool.selftest.promotionPath);
    const child = childProcess.spawn(process.execPath, [absolute], {
      cwd: path.dirname(absolute),
      env: Object.assign({}, process.env, { AXM_PROMOTION_AUDIT: '1' }),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '', settled = false;
    function append(current, chunk) { return (current + chunk.toString('utf8')).slice(-32768); }
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ id: tool.id, path: tool.selftest.promotionPath, selftestSha256: tool.selftest.sha256, verdict: 'TIMEOUT', exitCode: null, durationMs: Date.now() - started, outputSha256: digest(stdout + '\n' + stderr), failureTail: (stderr || stdout).slice(-1200) });
    }, options.timeoutMs);
    child.on('error', error => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve({ id: tool.id, path: tool.selftest.promotionPath, selftestSha256: tool.selftest.sha256, verdict: 'ERROR', exitCode: null, durationMs: Date.now() - started, outputSha256: digest(error.message), failureTail: error.message });
    });
    child.on('exit', code => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve({ id: tool.id, path: tool.selftest.promotionPath, selftestSha256: tool.selftest.sha256, verdict: code === 0 ? 'PASS' : 'FAIL', exitCode: code, durationMs: Date.now() - started, outputSha256: digest(stdout + '\n' + stderr), failureTail: code === 0 ? null : (stderr || stdout).slice(-1200) });
    });
  });
}

async function runBounded(tools, options) {
  const queue = tools.slice();
  const results = [];
  async function worker() {
    while (queue.length) {
      const tool = queue.shift();
      const result = await runOne(tool, options);
      results.push(result);
      process.stderr.write(result.verdict.padEnd(7) + ' ' + tool.id + ' ' + result.durationMs + 'ms\n');
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.workers, Math.max(1, tools.length)) }, worker));
  return results.sort((a, b) => a.id.localeCompare(b.id));
}

function verificationTargets(preliminary, selectedToolIds) {
  const tools = preliminary && Array.isArray(preliminary.tools) ? preliminary.tools : [];
  const eligible = tools.filter(Readiness.isVerificationTarget);
  if (!selectedToolIds.length) return eligible;
  const byId = new Map(tools.map(tool => [tool.id, tool]));
  return selectedToolIds.map(id => {
    const tool = byId.get(id);
    if (!tool) throw new Error('unknown tool id requested for verification: ' + id);
    if (!Readiness.isVerificationTarget(tool)) throw new Error('tool is not an eligible verification target: ' + id);
    return tool;
  });
}

function validateReceipt(receipt, label) {
  label = label || 'self-test receipt';
  if (!receipt || typeof receipt !== 'object' || receipt.schema !== RECEIPT_SCHEMA || !Array.isArray(receipt.results)) {
    throw new Error(label + ' must use ' + RECEIPT_SCHEMA + ' with a results array');
  }
  const ids = new Set();
  receipt.results.forEach((row, index) => {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id.trim()) throw new Error(label + ' result ' + index + ' requires an id');
    if (ids.has(row.id)) throw new Error(label + ' contains duplicate result id: ' + row.id);
    ids.add(row.id);
  });
  return receipt;
}

function readExistingReceipt(file) {
  if (!fs.existsSync(file)) return null;
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error('existing self-test receipt is not valid JSON: ' + error.message); }
  return validateReceipt(parsed, 'existing self-test receipt');
}

function buildVerificationReceipt(options) {
  const selectedToolIds = options.selectedToolIds.slice();
  const latestResults = options.latestResults.slice();
  const preliminary = options.preliminary;
  const eligible = verificationTargets(preliminary, []);
  const eligibleById = new Map(eligible.map(tool => [tool.id, tool]));
  const latestById = new Map();
  latestResults.forEach(row => {
    if (!row || typeof row.id !== 'string' || latestById.has(row.id)) throw new Error('latest self-test results contain a missing or duplicate id');
    const tool = eligibleById.get(row.id);
    if (!tool) throw new Error('latest self-test result is not for an eligible target: ' + row.id);
    if (row.selftestSha256 !== tool.selftest.sha256) throw new Error('latest self-test result digest does not match current target: ' + row.id);
    if (!['PASS', 'FAIL', 'TIMEOUT', 'ERROR'].includes(row.verdict)) throw new Error('latest self-test result has an unsupported verdict: ' + row.id);
    latestById.set(row.id, row);
  });

  let retained = [];
  if (selectedToolIds.length) {
    const selected = new Set(selectedToolIds);
    selectedToolIds.forEach(id => {
      if (!latestById.has(id)) throw new Error('selected tool did not produce a self-test result: ' + id);
    });
    latestById.forEach((row, id) => {
      if (!selected.has(id)) throw new Error('unexpected self-test result outside selected scope: ' + id);
    });
    const existing = options.existingReceipt;
    if (existing) {
      retained = validateReceipt(existing, 'existing self-test receipt').results.filter(row => {
        const tool = eligibleById.get(row.id);
        return !!tool && !selected.has(row.id) && row.selftestSha256 === tool.selftest.sha256;
      });
    }
  } else {
    eligible.forEach(tool => {
      if (!latestById.has(tool.id)) throw new Error('full verification did not produce a self-test result: ' + tool.id);
    });
  }

  const results = retained.concat(latestResults).sort((a, b) => a.id.localeCompare(b.id));
  return {
    schema: RECEIPT_SCHEMA,
    generatedAt: options.generatedAt || new Date().toISOString(),
    workers: options.workers,
    timeoutMs: options.timeoutMs,
    scope: {
      mode: selectedToolIds.length ? 'SELECTED' : 'FULL',
      selectedToolIds: selectedToolIds.length ? selectedToolIds : latestResults.map(row => row.id).sort(),
      retainedCurrentResults: retained.length
    },
    results
  };
}

async function main(argv) {
  const options = parseOptions(argv || process.argv.slice(2));
  let verificationResults = null;
  const preliminary = Readiness.buildIndex(ROOT);
  let latestResults = [];
  if (options.verify) {
    const targets = verificationTargets(preliminary, options.selectedToolIds);
    const existingReceipt = options.selectedToolIds.length ? readExistingReceipt(receiptFile) : null;
    latestResults = await runBounded(targets, { root: ROOT, workers: options.workers, timeoutMs: options.timeoutMs });
    verificationResults = buildVerificationReceipt({
      preliminary,
      existingReceipt,
      latestResults,
      selectedToolIds: options.selectedToolIds,
      workers: options.workers,
      timeoutMs: options.timeoutMs
    });
    fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
    fs.writeFileSync(receiptFile, JSON.stringify(verificationResults, null, 2) + '\n');
  } else {
    try { verificationResults = validateReceipt(JSON.parse(fs.readFileSync(receiptFile, 'utf8'))); }
    catch (error) { verificationResults = null; }
  }
  const index = Readiness.buildIndex(ROOT, { verificationResults });
  const checked = Readiness.validateIndex(index);
  if (!checked.pass) throw new Error(checked.errors.join('; '));
  fs.writeFileSync(outputFile, JSON.stringify(index, null, 2) + '\n');
  const failed = latestResults.filter(row => row.verdict !== 'PASS');
  process.stdout.write('tools-index: ' + index.summary.tools + ' tools · ' + index.summary.capabilities + ' capabilities · ' + index.promotionQueue.readyForHumanReview.length + ' ready for human review\n');
  if (options.verify) {
    process.stdout.write('promotion selftests: ' + (latestResults.length - failed.length) + ' PASS · ' + failed.length + ' not PASS · workers=' + options.workers + ' · scope=' + verificationResults.scope.mode + '\n');
    process.stdout.write('current receipt results: ' + verificationResults.results.length + ' · retained=' + verificationResults.scope.retainedCurrentResults + '\n');
  }
  if (failed.length) process.exitCode = 1;
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; });

module.exports = {
  RECEIPT_SCHEMA,
  parseOptions,
  verificationTargets,
  validateReceipt,
  readExistingReceipt,
  buildVerificationReceipt,
  runBounded,
  main
};
