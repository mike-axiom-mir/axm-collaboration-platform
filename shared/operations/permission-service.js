'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

const STATUS_SCHEMA = 'axm.permission-status/v1';

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean)));
}

function normalizeExpiry(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('permission expiry is invalid');
  if (parsed <= Date.now()) throw new Error('permission expiry must be in the future');
  return new Date(parsed).toISOString();
}

function stateOf(grant, declaredNow, now) {
  if (!grant) return 'UNDECIDED';
  if (!declaredNow) return 'UNDECLARED';
  if (grant.expiresAt) {
    const expiry = Date.parse(grant.expiresAt);
    if (!Number.isFinite(expiry)) return 'INVALID_EXPIRY';
    if (expiry <= now) return 'EXPIRED';
  }
  return grant.allowed === true ? 'ALLOWED' : 'DENIED';
}

function create(options) {
  const root = options.root;
  const stateFile = path.join(options.stateRoot, 'secrets-permissions-console', 'permissions.json');
  const auditFile = path.join(options.stateRoot, 'secrets-permissions-console', 'permission-audit.jsonl');

  function catalog() {
    const rows = [];
    const tools = path.join(root, 'tools');
    if (!fs.existsSync(tools)) return rows;
    for (const entry of fs.readdirSync(tools, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(tools, entry.name, 'manifest.json'), 'utf8'));
        rows.push({
          moduleId: manifest.id,
          name: manifest.name,
          permissions: unique(manifest.permissions),
          dependencies: unique(manifest.uses)
        });
      } catch (_) {}
    }
    return rows.sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }

  function read() { return U.loadJson(stateFile, { schema: 'axm.permission-ledger/v1', grants: [] }); }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function declared(moduleId, permission, rows) {
    const item = (rows || catalog()).find(row => row.moduleId === moduleId);
    return !!(item && item.permissions.includes(permission));
  }

  function decision(moduleId, permission, at) {
    moduleId = U.cleanId(moduleId, 'moduleId');
    permission = String(permission || '').trim().slice(0, 120);
    const rows = catalog(), grants = read().grants;
    const isDeclared = declared(moduleId, permission, rows);
    const matching = grants.filter(item => item.moduleId === moduleId && item.permission === permission);
    const grant = matching.length ? matching[matching.length - 1] : null;
    const state = stateOf(grant, isDeclared, Number.isFinite(at) ? at : Date.now());
    return {
      moduleId, permission, declared: isDeclared, state,
      effective: state === 'ALLOWED', decisionId: grant && grant.id || null,
      reason: grant && grant.reason || null, decidedBy: grant && grant.grantedBy || null,
      decidedAt: grant && grant.grantedAt || null, expiresAt: grant && grant.expiresAt || null
    };
  }

  function setGrant(input) {
    const moduleId = U.cleanId(input.moduleId, 'moduleId');
    const permission = String(input.permission || '').trim().slice(0, 120);
    if (!permission) throw new Error('permission is required');
    if (!declared(moduleId, permission)) throw new Error('permission is not declared by that module');
    const reason = String(input.reason || '').trim().slice(0, 500);
    if (!reason) throw new Error('permission decision reason is required');
    const state = read();
    state.grants = state.grants.filter(item => !(item.moduleId === moduleId && item.permission === permission));
    const grant = {
      id: U.uid('permission'), moduleId, permission, allowed: input.allowed === true, reason,
      grantedBy: String(input.actor || 'local-user').slice(0, 120), grantedAt: U.now(),
      expiresAt: normalizeExpiry(input.expiresAt)
    };
    state.grants.push(grant);
    write(state);
    U.appendJsonl(auditFile, Object.assign({ type: 'permission-decision', at: U.now() }, grant));
    return Object.assign(U.clone(grant), { state: grant.allowed ? 'ALLOWED' : 'DENIED', effective: grant.allowed === true });
  }

  function allowed(moduleId, permission) { return decision(moduleId, permission).effective; }

  function status() {
    const now = Date.now(), rows = catalog(), stored = read().grants;
    const grants = stored.map(grant => {
      const declaredNow = declared(grant.moduleId, grant.permission, rows);
      const state = stateOf(grant, declaredNow, now);
      return Object.assign(U.clone(grant), { declared: declaredNow, state, effective: state === 'ALLOWED' });
    });
    const catalogView = rows.map(row => Object.assign({}, row, {
      permissionStates: row.permissions.map(permission => {
        const grant = grants.filter(item => item.moduleId === row.moduleId && item.permission === permission).slice(-1)[0] || null;
        const state = stateOf(grant, true, now);
        return { permission, state, effective: state === 'ALLOWED', reason: grant && grant.reason || null, expiresAt: grant && grant.expiresAt || null };
      })
    }));
    const allStates = catalogView.flatMap(row => row.permissionStates);
    const summary = { modules: rows.length, declaredPermissions: allStates.length, allowed: 0, denied: 0, expired: 0, undecided: 0, invalid: 0, undeclaredLedgerEntries: 0 };
    allStates.forEach(item => {
      if (item.state === 'ALLOWED') summary.allowed += 1;
      else if (item.state === 'DENIED') summary.denied += 1;
      else if (item.state === 'EXPIRED') summary.expired += 1;
      else if (item.state === 'UNDECIDED') summary.undecided += 1;
      else summary.invalid += 1;
    });
    summary.undeclaredLedgerEntries = grants.filter(item => item.state === 'UNDECLARED').length;
    return { schema: STATUS_SCHEMA, catalog: catalogView, grants, summary, dependenciesArePermissions: false, defaultDecision: 'DENY' };
  }

  return { schema: STATUS_SCHEMA, catalog, declared, decision, setGrant, allowed, status, stateFile, auditFile };
}

module.exports = { STATUS_SCHEMA, normalizeExpiry, stateOf, create };
