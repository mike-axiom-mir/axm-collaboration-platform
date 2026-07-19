'use strict';

const http = require('http');
const path = require('path');
const U = require('./operations-utils');

const SCHEMA = 'axm.qa-lab-state/v1';
const PROFILE_STEPS = {
  'hub-smoke': [
    { route: '/api/health', expectStatus: 200 },
    { route: '/hub/index.html', expectStatus: 200, contains: 'AXM Hub', inspectHtml: true },
    { route: '/api/tools', expectStatus: 200 }
  ],
  'operations-smoke': [
    { route: '/api/operations/status', expectStatus: 200 },
    { route: '/tools/diagnostics-operations-center/index.html', expectStatus: 200, contains: 'Diagnostics & Operations Center', inspectHtml: true },
    { route: '/tools/recovery-center/index.html', expectStatus: 200, contains: 'Recovery & Rollback Center', inspectHtml: true }
  ],
  'game-night-smoke': [
    { route: '/tools/game-hub/index.html', expectStatus: 200, contains: 'Game Hub', inspectHtml: true },
    { route: '/tools/game-hub/lobby-controller.html', expectStatus: 200, inspectHtml: true }
  ]
};

function create(options) {
  const stateFile = path.join(options.stateRoot, 'browser-lan-hardware-qa', 'results.json');
  const auditFile = path.join(options.stateRoot, 'browser-lan-hardware-qa', 'audit.jsonl');
  function read() { return U.loadJson(stateFile, { schema: SCHEMA, version: 1, journeys: [], deviceEvidence: [] }); }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }
  function cleanRoute(value) {
    const route = String(value || '');
    if (!route.startsWith('/') || route.startsWith('//') || route.includes('..') || route.includes('\0') || route.length > 500) throw new Error('QA journey route must be a bounded Workshop-relative path');
    return route;
  }
  function normalizeSteps(input) {
    const source = typeof input === 'string' ? PROFILE_STEPS[input] : input;
    if (!Array.isArray(source) || !source.length || source.length > 24) throw new Error('QA journey needs 1 to 24 steps');
    return source.map(raw => ({ route: cleanRoute(raw.route), expectStatus: Math.max(100, Math.min(599, Number(raw.expectStatus) || 200)), contains: String(raw.contains || '').slice(0, 200), inspectHtml: raw.inspectHtml === true }));
  }
  function inspectHtml(text) {
    const findings = [];
    if (!/<html[^>]*\blang=["'][^"']+/i.test(text)) findings.push('html language is missing');
    if (!/<meta[^>]*name=["']viewport["']/i.test(text)) findings.push('viewport metadata is missing');
    if (!/<title>[^<]+<\/title>/i.test(text)) findings.push('document title is missing');
    if (!/<h1\b/i.test(text)) findings.push('primary heading is missing');
    const unnamedButtons = (text.match(/<button\b[^>]*>\s*<\/button>/gi) || []).length;
    if (unnamedButtons) findings.push(unnamedButtons + ' empty button(s) need an accessible name');
    return { pass: findings.length === 0, findings };
  }
  function request(originPort, step, timeoutMs) {
    return new Promise(resolve => {
      const started = Date.now();
      const req = http.get({ hostname: '127.0.0.1', port: originPort, path: step.route, timeout: timeoutMs, headers: { 'user-agent': 'AXM-QA-Lab/1.0', accept: 'text/html,application/json' } }, res => {
        const chunks = []; let bytes = 0, truncated = false;
        res.on('data', chunk => { if (bytes < 1024 * 1024) { chunks.push(chunk); bytes += chunk.length; } else truncated = true; });
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8'), checks = [];
          checks.push({ id: 'status', pass: res.statusCode === step.expectStatus, expected: step.expectStatus, actual: res.statusCode });
          if (step.contains) checks.push({ id: 'contains', pass: text.includes(step.contains), expected: step.contains });
          if (step.inspectHtml) checks.push(Object.assign({ id: 'html-accessibility-basics' }, inspectHtml(text)));
          resolve({ route: step.route, status: res.statusCode, durationMs: Date.now() - started, bytes, truncated, checks, pass: checks.every(x => x.pass) });
        });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', error => resolve({ route: step.route, durationMs: Date.now() - started, pass: false, error: error.message, checks: [{ id: 'request', pass: false, error: error.message }] }));
    });
  }
  async function run(input) {
    const body = input || {}, profile = String(body.profile || 'custom'), steps = normalizeSteps(PROFILE_STEPS[profile] ? profile : body.steps), port = Number(body.originPort || body.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('QA journey needs the active Workshop port');
    const timeoutMs = Math.max(250, Math.min(10000, Number(body.timeoutMs) || 2500)), results = [];
    for (const step of steps) results.push(await request(port, step, timeoutMs));
    const receipt = { schema: 'axm.qa-journey-receipt/v1', id: U.uid('qa'), profile, actor: String(body.actor || 'local-user').slice(0, 120), startedAt: U.now(), origin: 'http://127.0.0.1:' + port, steps: results, pass: results.every(x => x.pass), totals: { steps: results.length, failures: results.filter(x => !x.pass).length, durationMs: results.reduce((n, x) => n + x.durationMs, 0) } };
    receipt.digest = U.sha256(JSON.stringify(receipt)); const state = read(); state.journeys.unshift(receipt); state.journeys = state.journeys.slice(0, 100); write(state); audit({ type: 'journey', id: receipt.id, profile, pass: receipt.pass, digest: receipt.digest }); return receipt;
  }
  function recordDeviceEvidence(input) {
    const body = input || {}, viewport = body.viewport || {}, samples = Array.isArray(body.latencyMs) ? body.latencyMs.map(Number).filter(Number.isFinite).slice(0, 100) : [];
    if (!Number.isFinite(Number(viewport.width)) || !Number.isFinite(Number(viewport.height))) throw new Error('device evidence needs viewport width and height');
    const gamepads = (Array.isArray(body.gamepads) ? body.gamepads : []).slice(0, 8).map(item => ({ index: Number(item.index), id: String(item.id || 'unnamed').slice(0, 160), mapping: String(item.mapping || '').slice(0, 40), axes: Math.max(0, Math.min(32, Number(item.axes) || 0)), buttons: Math.max(0, Math.min(64, Number(item.buttons) || 0)) }));
    const sorted = samples.slice().sort((a,b) => a-b), p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : null;
    const receipt = { schema: 'axm.device-qa-evidence/v1', id: U.uid('device-qa'), capturedAt: U.now(), actor: String(body.actor || 'local-user').slice(0, 120), userAgent: String(body.userAgent || '').slice(0, 400), viewport: { width: Number(viewport.width), height: Number(viewport.height), devicePixelRatio: Number(viewport.devicePixelRatio) || 1 }, accessibility: { reducedMotion: !!body.reducedMotion, highContrast: !!body.highContrast }, gamepads, network: { samples, medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null, p95Ms: p95, disconnectObserved: body.disconnectObserved === true, recoveredAfterDisconnect: body.recoveredAfterDisconnect === true }, longSession: { durationMs: Math.max(0, Math.min(24 * 60 * 60 * 1000, Number(body.sessionDurationMs) || 0)), errors: (Array.isArray(body.errors) ? body.errors : []).slice(0, 50).map(x => String(x).slice(0, 300)) }, truth: { hardwareEnumeratedByBrowser: true, rawInputStored: false, automaticPermissionChange: false } };
    receipt.digest = U.sha256(JSON.stringify(receipt)); const state = read(); state.deviceEvidence.unshift(receipt); state.deviceEvidence = state.deviceEvidence.slice(0, 100); write(state); audit({ type: 'device-evidence', id: receipt.id, gamepads: gamepads.length, digest: receipt.digest }); return receipt;
  }
  function status() { const state = read(); return { schema: SCHEMA, profiles: Object.keys(PROFILE_STEPS), journeys: state.journeys, deviceEvidence: state.deviceEvidence, latestJourney: state.journeys[0] || null, latestDeviceEvidence: state.deviceEvidence[0] || null, arbitraryUrlTesting: false, hardwarePermissionAuthority: false }; }
  return { status, run, recordDeviceEvidence, normalizeSteps, inspectHtml, stateFile, auditFile };
}

module.exports = { SCHEMA, PROFILE_STEPS, create };
