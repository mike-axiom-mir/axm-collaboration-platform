'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonical, ensureDir, safeId } = require('./storage');

function hashEntry(entry) { return crypto.createHash('sha256').update(canonical(entry)).digest('hex'); }

class SessionLedger {
  constructor(root, sessionId) {
    this.root = ensureDir(root); this.sessionId = safeId(sessionId); if (!this.sessionId) throw new Error('invalid-ledger-session');
    this.file = path.join(this.root, this.sessionId + '.jsonl'); this.entries = this.read();
    this.dedupe = new Set(this.entries.map(entry => entry.dedupeKey).filter(Boolean));
  }
  read() {
    if (!fs.existsSync(this.file)) return [];
    return fs.readFileSync(this.file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  }
  append(type, payload, options = {}) {
    if (options.dedupeKey && this.dedupe.has(options.dedupeKey)) return { ok: false, duplicate: true, dedupeKey: options.dedupeKey };
    const previous = this.entries[this.entries.length - 1];
    const body = {
      schema: 'axm.circuitseed-session-ledger/v1', sessionId: this.sessionId,
      sequence: this.entries.length + 1, type, at: new Date().toISOString(),
      previousHash: previous ? previous.hash : 'GENESIS', dedupeKey: options.dedupeKey || null,
      actorId: options.actorId || null, payload: JSON.parse(JSON.stringify(payload || {}))
    };
    const entry = { ...body, hash: hashEntry(body) };
    fs.appendFileSync(this.file, JSON.stringify(entry) + '\n', { encoding: 'utf8', mode: 0o600 });
    this.entries.push(entry); if (entry.dedupeKey) this.dedupe.add(entry.dedupeKey);
    return { ok: true, entry };
  }
  validate() {
    const errors = [];
    this.entries.forEach((entry, index) => {
      const { hash, ...body } = entry;
      const expectedPrevious = index ? this.entries[index - 1].hash : 'GENESIS';
      if (entry.previousHash !== expectedPrevious) errors.push('previous-hash-' + (index + 1));
      if (hashEntry(body) !== hash) errors.push('entry-hash-' + (index + 1));
      if (entry.sequence !== index + 1) errors.push('sequence-' + (index + 1));
    });
    return { ok: !errors.length, errors, count: this.entries.length, headHash: this.entries.length ? this.entries[this.entries.length - 1].hash : null };
  }
}

module.exports = { SessionLedger, hashEntry };
