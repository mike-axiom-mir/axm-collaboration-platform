#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { CourierCore, REQUEST_SCHEMA, RESPONSE_SCHEMA } = require('./lib/courier-core');

const moduleRoot = __dirname;
const workshopRoot = path.resolve(moduleRoot, '..', '..', '..');
const stateRoot = path.resolve(process.env.AXM_AI_SEAT_STATE || path.join(workshopRoot, 'state', 'ai-seat-courier'));
const inbox = path.join(stateRoot, 'inbox');
const outbox = path.join(stateRoot, 'outbox');
const captures = path.join(stateRoot, 'captures');
const statusPath = path.join(stateRoot, 'status.json');
const lockPath = path.join(stateRoot, 'daemon.lock.json');

for (const directory of [stateRoot, inbox, outbox, captures]) fs.mkdirSync(directory, { recursive: true });

function atomicJson(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
  try { fs.unlinkSync(filePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  fs.renameSync(tempPath, filePath);
}

function readExistingLock() {
  try { return JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch (_) { return null; }
}

const existing = readExistingLock();
if (existing && Number.isInteger(existing.pid)) {
  try {
    process.kill(existing.pid, 0);
    console.error(`AI Seat Courier is already running as PID ${existing.pid}.`);
    process.exit(2);
  } catch (_) { /* stale lock */ }
}

atomicJson(lockPath, { schema: 'axm.ai-seat-courier.lock/v1', pid: process.pid, startedAt: new Date().toISOString() });

const core = new CourierCore({ moduleRoot, workshopRoot, stateRoot });
let processing = false;
let stopping = false;

function trimDirectory(directory, maximum, extension) {
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && (!extension || entry.name.endsWith(extension)))
    .map(entry => ({ path: path.join(directory, entry.name), modified: fs.statSync(path.join(directory, entry.name)).mtimeMs }))
    .sort((a, b) => b.modified - a.modified);
  for (const file of files.slice(maximum)) {
    try { fs.unlinkSync(file.path); } catch (_) { /* next pass can retry */ }
  }
}

function writeStatus(extra = {}) {
  atomicJson(statusPath, Object.assign({
    schema: 'axm.ai-seat-courier.status/v1',
    status: stopping ? 'stopping' : 'ready',
    pid: process.pid,
    stateRoot,
    inbox,
    outbox,
    captures,
    requestSchema: REQUEST_SCHEMA,
    responseSchema: RESPONSE_SCHEMA,
    updatedAt: new Date().toISOString()
  }, core.status(), extra));
}

async function shutdown(reason) {
  if (stopping) return;
  stopping = true;
  writeStatus({ reason });
  await core.stopSession();
  try { fs.unlinkSync(lockPath); } catch (_) { /* stale lock is recoverable */ }
  atomicJson(statusPath, {
    schema: 'axm.ai-seat-courier.status/v1', status: 'stopped', pid: process.pid,
    reason, stateRoot, updatedAt: new Date().toISOString()
  });
}

async function processOne() {
  if (processing || stopping) return;
  const entry = fs.readdirSync(inbox, { withFileTypes: true })
    .filter(item => item.isFile() && /^[A-Za-z0-9._-]+\.json$/.test(item.name))
    .sort((a, b) => a.name.localeCompare(b.name))[0];
  if (!entry) return;
  processing = true;
  const requestPath = path.join(inbox, entry.name);
  const fallbackId = path.basename(entry.name, '.json').slice(0, 100);
  let request;
  let requestId = fallbackId;
  let response;
  try {
    const stat = fs.statSync(requestPath);
    if (stat.size > 64 * 1024) throw new Error('request exceeds 64 KiB');
    request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
    requestId = String(request.id || fallbackId).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
    if (request.action === 'shutdown') {
      response = { schema: RESPONSE_SCHEMA, id: requestId, action: 'shutdown', ok: true, result: { accepted: true }, completedAt: new Date().toISOString() };
    } else {
      const result = await core.handle(Object.assign({}, request, { id: requestId }));
      response = { schema: RESPONSE_SCHEMA, id: requestId, action: request.action, ok: true, result, completedAt: new Date().toISOString() };
    }
  } catch (error) {
    response = { schema: RESPONSE_SCHEMA, id: requestId, action: request && request.action, ok: false, error: error.message, completedAt: new Date().toISOString() };
  }

  atomicJson(path.join(outbox, `${requestId}.json`), response);
  try { fs.unlinkSync(requestPath); } catch (_) { /* duplicate processing is prevented by the single loop */ }
  trimDirectory(outbox, 50, '.json');
  trimDirectory(captures, 20, '.png');
  writeStatus({ lastRequest: { id: requestId, action: response.action, ok: response.ok, completedAt: response.completedAt } });
  processing = false;

  if (request && request.action === 'shutdown' && response.ok) {
    await shutdown('file request');
    setTimeout(() => process.exit(0), 25);
  }
}

process.on('SIGINT', () => shutdown('SIGINT').finally(() => process.exit(0)));
process.on('SIGTERM', () => shutdown('SIGTERM').finally(() => process.exit(0)));
process.on('uncaughtException', error => shutdown(`uncaughtException: ${error.message}`).finally(() => process.exit(1)));
process.on('unhandledRejection', error => shutdown(`unhandledRejection: ${error && error.message || error}`).finally(() => process.exit(1)));

writeStatus();
const timer = setInterval(() => processOne().catch(error => writeStatus({ loopError: error.message })), 100);
console.log(`AXM AI Seat Courier ready: ${stateRoot}`);
