#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const Glasses = require('./technical-glasses-core');
const Capabilities = require('../capabilities/workshop-capability-index');
const ReadinessObserver = require('../readiness/readiness-observer');

const ROOT = path.resolve(__dirname, '..', '..');
const focusArg = process.argv.find(value => value.startsWith('--focus='));
const jsonMode = process.argv.includes('--json');
const writeMode = process.argv.includes('--write');
const offlineOnly = process.argv.includes('--offline-source-only');
const liveRequired = process.argv.includes('--live-required');
const focus = focusArg ? focusArg.slice('--focus='.length) : '';
const LIVE_ORIGIN = 'http://127.0.0.1:8788';

function tools() {
  const output = [];
  const metadataFile = path.join(ROOT, 'shared', 'capabilities', 'capability-metadata.json');
  let metadata = { modules: {} };
  try { metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8')); } catch (error) {}
  fs.readdirSync(path.join(ROOT, 'tools'), { withFileTypes: true }).forEach(entry => {
    if (!entry.isDirectory() || entry.name.startsWith('_')) return;
    const file = path.join(ROOT, 'tools', entry.name, 'manifest.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
      const authored = metadata.modules && metadata.modules[manifest.id || entry.name] || {};
      output.push(Object.assign({ folder: entry.name }, manifest, {
        id: manifest.id || entry.name,
        summary: manifest.summary || authored.summary || '',
        actions: manifest.actions || authored.actions || [],
        accepts: manifest.accepts || authored.accepts || [],
        produces: manifest.produces || authored.produces || [],
        readiness: manifest.readiness || authored.readiness || []
      }));
    } catch (error) {
      output.push({ folder: entry.name, id: entry.name, name: entry.name, status: 'BROKEN', entry: null, error: 'manifest missing or invalid', actions: [], accepts: [], produces: [], readiness: [] });
    }
  });
  return output;
}

function liveUrl(value) {
  const query = String(value || '').trim();
  return LIVE_ORIGIN + '/api/workshop/technical-glasses' + (query ? '?focus=' + encodeURIComponent(query) : '');
}

function acceptLivePayload(payload) {
  if (!payload || payload.schema !== Glasses.SCHEMA || !payload.freshness || payload.freshness.generatedFromLiveScan !== true) {
    throw new Error('local Hub returned an invalid Technical Glasses snapshot');
  }
  payload.freshness.readinessSource = 'LIVE_HUB_API';
  payload.freshness.liveRuntimeObserved = true;
  return payload;
}

async function fetchLiveSnapshot(options) {
  options = options || {};
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('local HTTP client unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(options.timeoutMs || 2200));
  try {
    const response = await fetchImpl(liveUrl(options.focus), { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('local Hub HTTP ' + response.status);
    return acceptLivePayload(await response.json());
  } finally { clearTimeout(timer); }
}

function compileSourceOnly(value) {
  const catalog = tools();
  const focusRoutes = value ? Capabilities.search(catalog, value, { limit: 8 }) : [];
  const snapshot = Glasses.compile({
    root: ROOT,
    tools: catalog,
    readiness: {},
    structuralReadiness: ReadinessObserver.create({ root: ROOT, humanGate: 'Mike' }).snapshot(),
    focus: value,
    focusRoutes
  });
  snapshot.freshness.readinessSource = 'OFFLINE_SOURCE_ONLY';
  snapshot.freshness.liveRuntimeObserved = false;
  return snapshot;
}

async function main() {
  let snapshot, liveError = null;
  if (!offlineOnly) {
    try { snapshot = await fetchLiveSnapshot({ focus }); }
    catch (error) { liveError = error; }
  }
  if (!snapshot) {
    if (liveRequired) throw liveError || new Error('live Hub readiness was explicitly required');
    snapshot = compileSourceOnly(focus);
    if (!offlineOnly) process.stderr.write('Technical Glasses: live Hub unavailable; runtime readiness remains UNKNOWN in the source-only snapshot.\n');
  }
  if (writeMode) {
    const target = path.join(ROOT, 'state', 'technical-glasses', 'latest.json');
    Glasses.writeSnapshot(target, snapshot);
    process.stderr.write('Technical Glasses snapshot written: ' + target + '\n');
  }
  process.stdout.write(jsonMode ? JSON.stringify(snapshot, null, 2) + '\n' : snapshot.briefing);
}

module.exports = { LIVE_ORIGIN, liveUrl, acceptLivePayload, fetchLiveSnapshot, compileSourceOnly };
if (require.main === module) main().catch(error => { process.stderr.write('Technical Glasses CLI failed: ' + String(error.message || error) + '\n'); process.exitCode = 1; });
