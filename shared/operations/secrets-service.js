'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

const SCHEMA = 'axm.encrypted-secret-vault/v1';

function normalizeExpiry(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('secret expiry is invalid');
  if (parsed <= Date.now()) throw new Error('secret expiry must be in the future');
  return new Date(parsed).toISOString();
}

function secretState(record, now) {
  if (record.revoked) return 'REVOKED';
  if (record.expiresAt) {
    const expiry = Date.parse(record.expiresAt);
    if (!Number.isFinite(expiry)) return 'INVALID_EXPIRY';
    if (expiry <= (Number.isFinite(now) ? now : Date.now())) return 'EXPIRED';
  }
  return 'ACTIVE';
}

function derive(passphrase, salt) {
  const value = String(passphrase || ''); if (value.length < 10) throw new Error('vault passphrase must be at least 10 characters');
  return crypto.scryptSync(value, Buffer.from(salt, 'base64'), 32, { N: 16384, r: 8, p: 1 });
}
function encrypt(key, value) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv), data = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value))), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}
function decrypt(key, blob) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64')); decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]).toString('utf8'));
}

function create(options) {
  const stateDir = path.join(options.stateRoot, 'secrets-permissions-console'), vaultFile = path.join(stateDir, 'vault.enc.json'), auditFile = path.join(stateDir, 'secret-audit.jsonl');
  const ttlMs = Math.max(60 * 1000, Number(options.unlockTtlMs) || 15 * 60 * 1000);
  let key = null, values = null, unlockedUntil = 0, timer = null;
  function readVault() { return U.loadJson(vaultFile, null); }
  function writeVault(vault) { U.atomicJson(vaultFile, vault); try { fs.chmodSync(vaultFile, 0o600); } catch (_) {} }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }
  function metadata() { const vault = readVault(); return vault && Array.isArray(vault.records) ? vault.records : []; }
  function arm() { unlockedUntil = Date.now() + ttlMs; if (timer) clearTimeout(timer); timer = setTimeout(lock, ttlMs); if (timer.unref) timer.unref(); }
  function requireUnlocked() { if (!key || !values || Date.now() >= unlockedUntil) { lock(); throw new Error('secret vault is locked'); } arm(); }
  function payload(vault) { return vault.payload || encrypt(key, {}); }

  function initialize(passphrase, actor) {
    if (readVault()) throw new Error('secret vault is already initialized');
    const salt = crypto.randomBytes(16).toString('base64'), nextKey = derive(passphrase, salt), vault = { schema: SCHEMA, version: 1, cipher: 'aes-256-gcm', kdf: 'scrypt-N16384-r8-p1', salt, check: encrypt(nextKey, { marker: 'AXM_SECRET_VAULT', version: 1 }), payload: encrypt(nextKey, {}), records: [], createdAt: U.now(), updatedAt: U.now() };
    writeVault(vault); key = nextKey; values = {}; arm(); audit({ type: 'initialized', actor: String(actor || 'local-user').slice(0, 120) }); return status();
  }
  function unlock(passphrase, actor) {
    const vault = readVault(); if (!vault || vault.schema !== SCHEMA) throw new Error('secret vault has not been initialized');
    try {
      const nextKey = derive(passphrase, vault.salt), check = decrypt(nextKey, vault.check); if (check.marker !== 'AXM_SECRET_VAULT') throw new Error('bad marker');
      key = nextKey; values = decrypt(nextKey, payload(vault)); arm(); audit({ type: 'unlocked', actor: String(actor || 'local-user').slice(0, 120), expiresAt: new Date(unlockedUntil).toISOString() }); return status();
    } catch (_) { audit({ type: 'unlock-refused', actor: String(actor || 'local-user').slice(0, 120) }); throw new Error('secret vault passphrase was not accepted'); }
  }
  function lock() { if (key) key.fill(0); key = null; values = null; unlockedUntil = 0; if (timer) clearTimeout(timer); timer = null; return status(); }
  function persist(records) { requireUnlocked(); const vault = readVault(); vault.payload = encrypt(key, values); vault.records = records; vault.updatedAt = U.now(); writeVault(vault); }
  function upsert(input) {
    requireUnlocked(); const id = U.cleanId(input.id, 'secret id'), value = String(input.value || ''); if (!value) throw new Error('secret value is required');
    const scopes = Array.from(new Set((Array.isArray(input.scopes) ? input.scopes : []).map(x => U.cleanId(x, 'consumer scope')))).slice(0, 30), expiresAt = normalizeExpiry(input.expiresAt); if (!scopes.length) throw new Error('at least one consumer scope is required');
    const records = metadata().filter(item => item.id !== id), existing = metadata().find(item => item.id === id); values[id] = value;
    const record = { id, label: String(input.label || id).slice(0, 120), scopes, expiresAt, fingerprint: U.sha256(Buffer.from(value)).slice(0, 12), createdAt: existing ? existing.createdAt : U.now(), rotatedAt: existing ? U.now() : null, updatedAt: U.now(), revoked: false };
    records.push(record); persist(records); audit({ type: existing ? 'rotated' : 'stored', id, scopes, actor: String(input.actor || 'local-user').slice(0, 120), fingerprint: record.fingerprint }); return U.clone(record);
  }
  function revoke(id, actor) {
    requireUnlocked(); id = U.cleanId(id, 'secret id'); const records = metadata(), record = records.find(item => item.id === id); if (!record) throw new Error('secret not found');
    record.revoked = true; record.revokedAt = U.now(); delete values[id]; persist(records); audit({ type: 'revoked', id, actor: String(actor || 'local-user').slice(0, 120) }); return U.clone(record);
  }
  function readSecret(id, consumer) {
    requireUnlocked(); id = U.cleanId(id, 'secret id'); consumer = String(consumer || '').trim(); const record = metadata().find(item => item.id === id);
    if (!record || secretState(record) !== 'ACTIVE' || !record.scopes.includes(consumer)) { audit({ type: 'access-refused', id, consumer }); throw new Error('secret access refused'); }
    if (!(id in values)) throw new Error('secret payload is unavailable'); audit({ type: 'accessed', id, consumer, fingerprint: record.fingerprint }); return values[id];
  }
  function status() {
    const vault = readVault(), records = metadata().map(record => Object.assign(U.clone(record), { state: secretState(record), usable: secretState(record) === 'ACTIVE' }));
    return { schema: 'axm.secret-vault-status/v1', initialized: !!vault, unlocked: !!key && Date.now() < unlockedUntil, unlockedUntil: key ? new Date(unlockedUntil).toISOString() : null, cipher: vault ? vault.cipher : null, records, valuesExposedToBrowser: false };
  }
  return { initialize, unlock, lock, upsert, revoke, readSecret, status, vaultFile, auditFile };
}

module.exports = { SCHEMA, derive, encrypt, decrypt, normalizeExpiry, secretState, create };
