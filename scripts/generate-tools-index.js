#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const crypto = require('crypto');
const Readiness = require('../shared/readiness/tool-readiness');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const verify = args.includes('--verify');
const workersArg = args.find(value => value.startsWith('--workers='));
const timeoutArg = args.find(value => value.startsWith('--timeout-ms='));
const workers = Math.max(1, Math.min(4, Number(workersArg && workersArg.split('=')[1] || 2)));
const timeoutMs = Math.max(1000, Math.min(120000, Number(timeoutArg && timeoutArg.split('=')[1] || 45000)));
const outputFile = path.join(ROOT, 'tools-index.json');
const receiptFile = path.join(ROOT, 'state', 'tool-readiness', 'latest-selftests.json');

function digest(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function runOne(tool) {
  return new Promise(resolve => {
    const started = Date.now();
    const absolute = path.join(ROOT, tool.selftest.promotionPath);
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
    }, timeoutMs);
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

async function runBounded(tools) {
  const queue = tools.slice();
  const results = [];
  async function worker() {
    while (queue.length) {
      const tool = queue.shift();
      const result = await runOne(tool);
      results.push(result);
      process.stderr.write(result.verdict.padEnd(7) + ' ' + tool.id + ' ' + result.durationMs + 'ms\n');
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, Math.max(1, tools.length)) }, worker));
  return results.sort((a, b) => a.id.localeCompare(b.id));
}

async function main() {
  let verificationResults = null;
  const preliminary = Readiness.buildIndex(ROOT);
  if (verify) {
    const targets = preliminary.tools.filter(tool => tool.status === 'TEST' && tool.selftest.promotionPath);
    const results = await runBounded(targets);
    verificationResults = {
      schema: 'axm.tool-selftest-results/v1',
      generatedAt: new Date().toISOString(),
      workers,
      timeoutMs,
      results
    };
    fs.mkdirSync(path.dirname(receiptFile), { recursive: true });
    fs.writeFileSync(receiptFile, JSON.stringify(verificationResults, null, 2) + '\n');
  } else {
    try { verificationResults = JSON.parse(fs.readFileSync(receiptFile, 'utf8')); }
    catch (error) { verificationResults = null; }
  }
  const index = Readiness.buildIndex(ROOT, { verificationResults });
  const checked = Readiness.validateIndex(index);
  if (!checked.pass) throw new Error(checked.errors.join('; '));
  fs.writeFileSync(outputFile, JSON.stringify(index, null, 2) + '\n');
  const tested = verificationResults && verificationResults.results || [];
  const failed = tested.filter(row => row.verdict !== 'PASS');
  process.stdout.write('tools-index: ' + index.summary.tools + ' tools · ' + index.summary.capabilities + ' capabilities · ' + index.promotionQueue.readyForHumanReview.length + ' ready for human review\n');
  if (verify) process.stdout.write('promotion selftests: ' + (tested.length - failed.length) + ' PASS · ' + failed.length + ' not PASS · workers=' + workers + '\n');
  if (failed.length) process.exitCode = 1;
}

main().catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; });
