'use strict';

const crypto = require('crypto');
const path = require('path');

const SCHEMA = 'axm.temporary-production-session/v1';

function cleanParticipant(value) {
  const clean = String(value || 'Guest')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^a-zA-Z0-9 _.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
  return clean || 'Guest';
}

function sessionId(participant, now) {
  const slug = cleanParticipant(participant).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest';
  const stamp = Number(now || Date.now()).toString(36);
  return `${slug}-${stamp}-${crypto.randomBytes(4).toString('hex')}`;
}

function sessionPaths(baseDir, id) {
  const safeId = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeId) throw Error('temporary session id is required');
  const home = path.resolve(baseDir, safeId);
  const base = path.resolve(baseDir) + path.sep;
  if (!home.startsWith(base)) throw Error('temporary session path escaped its base');
  return {
    home,
    state: path.join(home, 'state'),
    exports: path.join(home, 'exports'),
    logs: path.join(home, 'logs'),
    workspace: path.join(home, 'workspace'),
    browser: path.join(home, 'browser-state'),
    metadata: path.join(home, 'SESSION.json'),
    instructions: path.join(home, 'workspace', 'AGENTS.md')
  };
}

function metadata(input) {
  const value = input || {};
  return {
    schema: SCHEMA,
    id: String(value.id || ''),
    participant: cleanParticipant(value.participant),
    preset: String(value.preset || 'temporary-production'),
    createdAt: value.createdAt || new Date().toISOString(),
    status: String(value.status || 'starting'),
    port: Number(value.port || 0),
    pid: Number(value.pid || 0),
    boundaries: {
      separateBrowserOrigin: true,
      separateServerState: true,
      separateOutputRoot: true,
      workshopSourceReadOnly: true,
      sharedLiveRuntimes: false,
      automaticHeavyRuntime: false,
      automaticArchive: false,
      explicitSaveOrDiscard: true
    }
  };
}

function workspaceInstructions(info, workshopRoot) {
  return `# AXM Temporary Production Session\n\n` +
    `Session: ${info.id}\nParticipant: ${info.participant}\n\n` +
    `- Work only inside this temporary workspace.\n` +
    `- Treat ${workshopRoot} as read-only reference material.\n` +
    `- Do not edit Mike's Workshop, saved state, accounts, logs, or running services.\n` +
    `- Put produced files in this workspace or the session exports folder.\n` +
    `- Nothing is archived automatically. The participant chooses Download & close or Discard & close.\n` +
    `- Do not start Mirror, game runtimes, packagers, training loops, or other heavy/shared bodies from this session.\n` +
    `- Report uncertainty and leave a short receipt with each meaningful output.\n`;
}

function validateBrowserSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('browser snapshot must be an object');
  const localStorage = value.localStorage && typeof value.localStorage === 'object' && !Array.isArray(value.localStorage) ? value.localStorage : {};
  const indexedDb = value.indexedDb && typeof value.indexedDb === 'object' && !Array.isArray(value.indexedDb) ? value.indexedDb : {};
  return {
    schema: 'axm.temporary-browser-state/v1',
    capturedAt: new Date().toISOString(),
    origin: String(value.origin || '').slice(0, 300),
    localStorage,
    indexedDb
  };
}

module.exports = { SCHEMA, cleanParticipant, sessionId, sessionPaths, metadata, workspaceInstructions, validateBrowserSnapshot };
