'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

function create(options) {
  const root = options.root, stateFile = path.join(options.stateRoot, 'secrets-permissions-console', 'permissions.json');
  const auditFile = path.join(options.stateRoot, 'secrets-permissions-console', 'permission-audit.jsonl');
  function catalog() {
    const rows = [];
    const tools = path.join(root, 'tools');
    if (!fs.existsSync(tools)) return rows;
    for (const entry of fs.readdirSync(tools, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(tools, entry.name, 'manifest.json'), 'utf8'));
        rows.push({ moduleId: manifest.id, name: manifest.name, permissions: Array.from(new Set([].concat(manifest.permissions || [], manifest.uses || []).filter(Boolean))) });
      } catch (_) {}
    }
    return rows.sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
  function read() { return U.loadJson(stateFile, { schema: 'axm.permission-ledger/v1', grants: [] }); }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function declared(moduleId, permission) { const item = catalog().find(row => row.moduleId === moduleId); return !!(item && item.permissions.includes(permission)); }
  function setGrant(input) {
    const moduleId = U.cleanId(input.moduleId, 'moduleId'), permission = String(input.permission || '').trim().slice(0, 120);
    if (!permission) throw new Error('permission is required');
    if (!declared(moduleId, permission)) throw new Error('permission is not declared by that module');
    const state = read(); state.grants = state.grants.filter(item => !(item.moduleId === moduleId && item.permission === permission));
    const grant = { moduleId, permission, allowed: input.allowed === true, reason: String(input.reason || '').slice(0, 500), grantedBy: String(input.actor || 'local-user').slice(0, 120), grantedAt: U.now(), expiresAt: input.expiresAt || null };
    state.grants.push(grant); write(state); U.appendJsonl(auditFile, Object.assign({ type: 'permission-decision', at: U.now() }, grant)); return grant;
  }
  function allowed(moduleId, permission) {
    if (!declared(moduleId, permission)) return false;
    const now = Date.now(), matches = read().grants.filter(item => item.moduleId === moduleId && item.permission === permission);
    if (!matches.length) return false;
    const latest = matches[matches.length - 1];
    if (latest.expiresAt && Date.parse(latest.expiresAt) <= now) return false;
    return latest.allowed === true;
  }
  function status() { return { catalog: catalog(), grants: read().grants }; }
  return { catalog, setGrant, allowed, status, stateFile, auditFile };
}

module.exports = { create };

