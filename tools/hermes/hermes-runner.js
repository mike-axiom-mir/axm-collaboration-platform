#!/usr/bin/env node
/* ============================================================
   AXM HERMES LOCAL CONTROL LAYER — v0.1 scaffold
   ------------------------------------------------------------
   Early local control-layer shell for Hermes-style AXM operations.

   Consent is OFF by default.
   No external network calls.
   No direct repo edits.
   Writes only to local module folders: queue/, outbox/, logs/,
   and Agent Tool Forge prompt-packs.
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const LOCAL_MODULES_ROOT = path.resolve(ROOT, '..');
const AGENT_TOOL_FORGE_ROOT = path.join(LOCAL_MODULES_ROOT, 'agent-tool-forge');
const HOST = '127.0.0.1';
const PORT = process.env.AXM_HERMES_PORT ? Number(process.env.AXM_HERMES_PORT) : 8791;
const CONSENT_FILE = path.join(ROOT, '.hermes-consent.json');
const QUEUE_DIR = path.join(ROOT, 'queue');
const OUTBOX_DIR = path.join(ROOT, 'outbox');
const LOG_DIR = path.join(ROOT, 'logs');
const PROMPT_PACKS_DIR = path.join(AGENT_TOOL_FORGE_ROOT, 'prompt-packs');

const MODULES = [
  { id: 'prompt-packs', name: 'Prompt Packs', status: 'scaffold', writes: 'consent-gated Agent Tool Forge files' },
  { id: 'templates', name: 'Template Adapter', status: 'scaffold', writes: 'proposal-only' },
  { id: 'reasoning-shell-specialist', name: 'Reasoning Shell Specialist', status: 'scaffold', writes: 'proposal-only' },
  { id: 'wisdom-log', name: 'Wisdom / Log Digest', status: 'scaffold', writes: 'consent-gated local digest only' },
  { id: 'task-queue', name: 'Task Queue', status: 'working-v0.1', writes: 'queue json only' }
];

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
[QUEUE_DIR, OUTBOX_DIR, LOG_DIR, PROMPT_PACKS_DIR].forEach(ensureDir);

function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + now().replace(/[^0-9]/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex'); }
function safeName(s) { return String(s || 'item').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'; }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n'); }
function log(line) { try { fs.appendFileSync(path.join(LOG_DIR, 'hermes-control.log'), now() + '  ' + line + '\n'); } catch (e) {} }

function consent() {
  return Object.assign({ enabled: false, updated: null, reason: 'default off' }, readJson(CONSENT_FILE, {}));
}
function setConsent(enabled, reason) {
  const state = { enabled: !!enabled, updated: now(), reason: String(reason || (enabled ? 'enabled by local user' : 'disabled by local user')).slice(0, 500) };
  writeJson(CONSENT_FILE, state);
  log('consent ' + (state.enabled ? 'ON' : 'OFF') + ' · ' + state.reason);
  return state;
}
function requireConsent(res) {
  const c = consent();
  if (c.enabled) return true;
  send(res, 403, { ok: false, error: 'Hermes consent is OFF. POST /consent {"enabled":true,"reason":"..."} to enable local module actions.' });
  return false;
}

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj, null, 2));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', d => { buf += d; if (buf.length > 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      try { resolve(buf ? JSON.parse(buf) : {}); }
      catch (e) { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function createTask(payload) {
  const taskId = id('task');
  const task = {
    id: taskId,
    status: 'proposal',
    created: now(),
    source: String(payload.source || 'manual').slice(0, 120),
    kind: String(payload.kind || 'task').slice(0, 80),
    title: String(payload.title || 'Untitled Hermes task').slice(0, 160),
    text: String(payload.text || '').slice(0, 20000),
    tags: Array.isArray(payload.tags) ? payload.tags.map(String).slice(0, 12) : [],
    axm_rule: 'proposal only; no direct edits; review before apply'
  };
  const file = path.join(QUEUE_DIR, taskId + '.json');
  writeJson(file, task);
  log('queued ' + taskId + ' · ' + task.title);
  return { task, file: path.relative(ROOT, file) };
}

function createProposal(payload) {
  const proposalId = id('proposal');
  const title = String(payload.title || 'Hermes proposal').slice(0, 160);
  const md = [
    '# ' + title,
    '',
    'Status: proposal / review required.',
    '',
    'Created: ' + now(),
    'Source: ' + String(payload.source || 'manual').slice(0, 120),
    '',
    '## Proposal',
    '',
    String(payload.text || '').slice(0, 30000),
    '',
    '## AXM gate',
    '',
    '- No direct edit applied by Hermes.',
    '- Human review required before use.',
    '- Not canon by default.',
    ''
  ].join('\n');
  const file = path.join(OUTBOX_DIR, proposalId + '-' + safeName(title) + '.md');
  fs.writeFileSync(file, md);
  log('proposal ' + proposalId + ' · ' + title);
  return { id: proposalId, file: path.relative(ROOT, file) };
}

function addPromptPack(payload) {
  const promptId = id('prompt');
  const title = String(payload.title || 'Hermes prompt pack').slice(0, 120);
  const rec = {
    id: promptId,
    status: 'local-prompt-pack',
    created: now(),
    title,
    purpose: String(payload.purpose || '').slice(0, 1000),
    text: String(payload.text || '').slice(0, 50000),
    axm_rule: 'local prompt pack; review before promotion'
  };
  const file = path.join(PROMPT_PACKS_DIR, promptId + '-' + safeName(title) + '.json');
  writeJson(file, rec);
  log('prompt-pack add ' + promptId + ' · ' + title);
  return { prompt_pack: rec, file: path.relative(ROOT, file) };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, { ok: true, name: 'AXM Hermes Local Control Layer', version: '0.1', host: HOST, port: PORT, consent: consent().enabled, modules: MODULES.map(m => m.id) });
    }
    if (req.method === 'GET' && req.url === '/consent') return send(res, 200, { ok: true, consent: consent() });
    if (req.method === 'POST' && req.url === '/consent') {
      const p = await body(req);
      return send(res, 200, { ok: true, consent: setConsent(!!p.enabled, p.reason) });
    }
    if (req.method === 'GET' && req.url === '/modules') return send(res, 200, { ok: true, consent: consent().enabled, modules: MODULES });
    if (req.method === 'POST' && req.url === '/queue') {
      if (!requireConsent(res)) return;
      return send(res, 200, { ok: true, result: createTask(await body(req)) });
    }
    if (req.method === 'POST' && req.url === '/proposal') {
      if (!requireConsent(res)) return;
      return send(res, 200, { ok: true, result: createProposal(await body(req)) });
    }
    if (req.method === 'POST' && req.url === '/prompt-packs/add') {
      if (!requireConsent(res)) return;
      return send(res, 200, { ok: true, result: addPromptPack(await body(req)) });
    }
    if (req.method === 'GET' && req.url === '/prompt-packs/list') {
      if (!requireConsent(res)) return;
      const prompts = fs.readdirSync(PROMPT_PACKS_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
      return send(res, 200, { ok: true, prompt_packs: prompts });
    }
    send(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    log('error ' + e.message);
    send(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  log('control layer up on http://' + HOST + ':' + PORT + ' · consent=' + consent().enabled);
  console.log('AXM Hermes Local Control Layer v0.1');
  console.log('Listening: http://' + HOST + ':' + PORT);
  console.log('Consent: ' + (consent().enabled ? 'ON' : 'OFF'));
  console.log('Health:  http://' + HOST + ':' + PORT + '/health');
});
