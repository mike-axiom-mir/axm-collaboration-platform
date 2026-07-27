'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  fail,
  canonicalStringify,
  clone,
  sha256,
  requireId,
  requireIsoTime
} = require('./util');

const EVENT_SCHEMA = 'axm.module-evolution-ledger-event/v1';
const STORAGE_SCHEMA = 'axm.module-evolution-ledger.local-append-storage/v1';
const FILE_PATTERN = /^(\d{12})-([a-f0-9]{12})\.json$/;

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function eventBody(event) {
  const body = { ...event };
  delete body.eventDigest;
  return body;
}

function createLocalAppendAdapter(options = {}) {
  if (!options.workshopRoot) fail('WORKSHOP_ROOT_REQUIRED', 'workshopRoot is required for storage isolation');
  const workshopRoot = path.resolve(String(options.workshopRoot));
  const stateRoot = path.resolve(workshopRoot, 'state', 'module-evolution-ledger');
  const eventsRoot = path.join(stateRoot, 'events');
  const lockFile = path.join(stateRoot, 'writer.lock');
  const lockTimeoutMs = Number.isInteger(options.lockTimeoutMs) ? options.lockTimeoutMs : 5000;
  const lockRetryMs = Number.isInteger(options.lockRetryMs) ? options.lockRetryMs : 20;
  const processId = Number.isInteger(options.processId) ? options.processId : process.pid;

  if (path.relative(workshopRoot, stateRoot).split(path.sep)[0] === '..') {
    fail('STORAGE_BOUNDARY', 'Ledger storage must remain inside the Workshop state directory');
  }

  function assertResolvedBoundary() {
    if (!fs.existsSync(stateRoot)) return;
    const realWorkshopRoot = fs.realpathSync(workshopRoot);
    const realStateRoot = fs.realpathSync(stateRoot);
    const relative = path.relative(realWorkshopRoot, realStateRoot);
    if (!relative || relative.split(path.sep)[0] === '..' || path.isAbsolute(relative)) {
      fail('STORAGE_BOUNDARY', 'Resolved ledger storage escapes the Workshop root');
    }
    if (fs.existsSync(eventsRoot)) {
      const realEventsRoot = fs.realpathSync(eventsRoot);
      const eventRelative = path.relative(realStateRoot, realEventsRoot);
      if (!eventRelative || eventRelative.split(path.sep)[0] === '..' || path.isAbsolute(eventRelative)) {
        fail('STORAGE_BOUNDARY', 'Resolved ledger events directory escapes its state root');
      }
    }
  }

  function ensureLayout() {
    fs.mkdirSync(eventsRoot, { recursive: true });
    assertResolvedBoundary();
  }

  function readLock() {
    try {
      const parsed = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      return { present: true, metadata: parsed };
    } catch (error) {
      if (error.code === 'ENOENT') return { present: false, metadata: null };
      return { present: true, metadata: null, unreadable: error.message };
    }
  }

  function readChain() {
    if (!fs.existsSync(eventsRoot)) return { revision: 0, headEventDigest: null, events: [], ignoredPendingFiles: [] };
    assertResolvedBoundary();
    const names = fs.readdirSync(eventsRoot);
    const eventNames = names.filter(name => FILE_PATTERN.test(name)).sort();
    const ignoredPendingFiles = names.filter(name => name.startsWith('.pending-')).sort();
    const events = [];
    const eventIds = new Set();
    let previousEventDigest = null;

    for (let index = 0; index < eventNames.length; index += 1) {
      const name = eventNames[index];
      let event;
      try {
        event = JSON.parse(fs.readFileSync(path.join(eventsRoot, name), 'utf8'));
      } catch (error) {
        fail('CHAIN_INTEGRITY', `Unreadable ledger event ${name}`, { cause: error.message });
      }
      const expectedRevision = index + 1;
      if (event.schema !== EVENT_SCHEMA || event.revision !== expectedRevision) {
        fail('CHAIN_INTEGRITY', `Ledger event ${name} has an invalid schema or revision`);
      }
      const fileMatch = FILE_PATTERN.exec(name);
      const expectedDigest = sha256(canonicalStringify(eventBody(event)));
      if (event.eventDigest !== expectedDigest || fileMatch[2] !== expectedDigest.slice(0, 12)) {
        fail('CHAIN_INTEGRITY', `Ledger event ${name} failed its SHA-256 check`);
      }
      if ((event.previousEventDigest || null) !== previousEventDigest) {
        fail('CHAIN_INTEGRITY', `Ledger event ${name} does not extend the previous event`);
      }
      if (eventIds.has(event.eventId)) fail('CHAIN_INTEGRITY', `Duplicate eventId ${event.eventId}`);
      requireId(event.eventId, 'eventId');
      requireIsoTime(event.at, 'event.at');
      eventIds.add(event.eventId);
      previousEventDigest = event.eventDigest;
      events.push(event);
    }
    return { revision: events.length, headEventDigest: previousEventDigest, events, ignoredPendingFiles };
  }

  function acquireLock(at) {
    ensureLayout();
    const nonce = crypto.randomUUID();
    const deadline = Date.now() + Math.max(0, lockTimeoutMs);
    let handle = null;
    while (handle === null) {
      try {
        handle = fs.openSync(lockFile, 'wx');
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() >= deadline) {
          fail('LEDGER_BUSY', 'Ledger writer lock is held; it is never stolen automatically', readLock());
        }
        sleep(Math.max(1, lockRetryMs));
      }
    }
    const metadata = { schema: `${STORAGE_SCHEMA}#writer-lock`, nonce, processId, acquiredAt: at };
    fs.writeFileSync(handle, canonicalStringify(metadata), 'utf8');
    fs.fsyncSync(handle);
    return {
      metadata,
      release() {
        try { fs.closeSync(handle); } catch (_) {}
        try {
          const current = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
          if (current.nonce === nonce) fs.unlinkSync(lockFile);
        } catch (_) {
          // A missing or altered lock is left for explicit operator inspection.
        }
      }
    };
  }

  function append(input) {
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
      fail('EXPECTED_REVISION_REQUIRED', 'Every ledger write requires a non-negative expectedRevision');
    }
    const at = requireIsoTime(input.at, 'event.at');
    const lock = acquireLock(at);
    let pendingFile = null;
    try {
      const chain = readChain();
      if (chain.revision !== input.expectedRevision) {
        fail('STALE_REVISION', `Expected ledger revision ${input.expectedRevision}, found ${chain.revision}`, {
          expectedRevision: input.expectedRevision,
          actualRevision: chain.revision,
          headEventDigest: chain.headEventDigest
        });
      }
      const revision = chain.revision + 1;
      const body = {
        schema: EVENT_SCHEMA,
        revision,
        eventId: requireId(input.eventId, 'eventId'),
        type: requireId(input.type, 'event type'),
        at,
        actor: clone(input.actor),
        payload: clone(input.payload),
        previousEventDigest: chain.headEventDigest
      };
      const event = { ...body, eventDigest: sha256(canonicalStringify(body)) };
      const filename = `${String(revision).padStart(12, '0')}-${event.eventDigest.slice(0, 12)}.json`;
      const finalFile = path.join(eventsRoot, filename);
      pendingFile = path.join(eventsRoot, `.pending-${processId}-${crypto.randomUUID()}.json`);
      const handle = fs.openSync(pendingFile, 'wx');
      try {
        fs.writeFileSync(handle, `${canonicalStringify(event)}\n`, 'utf8');
        fs.fsyncSync(handle);
      } finally {
        fs.closeSync(handle);
      }
      fs.renameSync(pendingFile, finalFile);
      pendingFile = null;
      return clone(event);
    } finally {
      if (pendingFile) {
        try { fs.unlinkSync(pendingFile); } catch (_) {}
      }
      lock.release();
    }
  }

  function inspect() {
    const chain = readChain();
    return {
      schema: STORAGE_SCHEMA,
      workshopRoot,
      stateRoot,
      revision: chain.revision,
      headEventDigest: chain.headEventDigest,
      events: clone(chain.events),
      writerLock: readLock(),
      ignoredPendingFiles: chain.ignoredPendingFiles,
      guarantees: {
        concurrency: 'exclusive-local-writer-lock-plus-expected-revision',
        completedEventDurability: 'file-fsync-before-atomic-rename',
        integrity: 'sha256-event-chain'
      },
      limits: {
        filesystemWideAcidClaim: false,
        lockStealing: false,
        networkReplication: false,
        sqliteWal: false
      }
    };
  }

  return { schema: STORAGE_SCHEMA, workshopRoot, stateRoot, eventsRoot, lockFile, append, inspect };
}

module.exports = { EVENT_SCHEMA, STORAGE_SCHEMA, createLocalAppendAdapter };
