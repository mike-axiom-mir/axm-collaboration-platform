#!/usr/bin/env node
'use strict';

const base = process.argv[2] || 'http://127.0.0.1:8788';
const total = Number(process.argv[3] || 2400);
const concurrency = Number(process.argv[4] || 32);
const paths = [
  '/api/tools',
  '/api/workshop/capabilities',
  '/hub/index.html',
  '/tools/workshop-command-center/index.html',
  '/tools/local-3d-game-runtime/index.html',
  '/tools/game-hub/index.html',
  '/tools/asset-fabric/index.html',
  '/tools/world-tile-foundry/index.html'
];

if (!Number.isInteger(total) || total < 1) throw new Error('total must be a positive integer');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 256) {
  throw new Error('concurrency must be an integer from 1 through 256');
}

const times = [];
const statuses = {};
const failures = [];
let cursor = 0;
let bytes = 0;
const started = performance.now();

async function worker() {
  for (;;) {
    const index = cursor++;
    if (index >= total) return;
    const path = paths[index % paths.length];
    const requestStarted = performance.now();
    try {
      const response = await fetch(base + path, {
        headers: { accept: index % 3 === 0 ? 'application/json' : 'text/html,*/*' }
      });
      const body = await response.arrayBuffer();
      times.push(performance.now() - requestStarted);
      bytes += body.byteLength;
      statuses[response.status] = (statuses[response.status] || 0) + 1;
      if (!response.ok && failures.length < 20) failures.push({ index, path, status: response.status });
    } catch (error) {
      times.push(performance.now() - requestStarted);
      statuses.NETWORK = (statuses.NETWORK || 0) + 1;
      if (failures.length < 20) failures.push({ index, path, error: String(error) });
    }
  }
}

Promise.all(Array.from({ length: concurrency }, worker)).then(() => {
  times.sort((left, right) => left - right);
  const quantile = ratio => times[Math.min(times.length - 1, Math.floor(times.length * ratio))];
  const durationMs = performance.now() - started;
  const report = {
    schema: 'axm.steward-http-stress/v1',
    base,
    total,
    concurrency,
    paths,
    statuses,
    failures,
    durationMs: Number(durationMs.toFixed(2)),
    throughputRps: Number((total / (durationMs / 1000)).toFixed(2)),
    latencyMs: {
      min: Number(times[0].toFixed(2)),
      p50: Number(quantile(0.5).toFixed(2)),
      p95: Number(quantile(0.95).toFixed(2)),
      p99: Number(quantile(0.99).toFixed(2)),
      max: Number(times[times.length - 1].toFixed(2))
    },
    bytes
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (failures.length) process.exitCode = 1;
});
