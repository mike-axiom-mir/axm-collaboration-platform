'use strict';

const fs = require('fs');
const path = require('path');
const { clone, now, makeId, ensureDir } = require('../core/utils');
const HashChain = require('./hash-chain');

const CORE_ACTOR = {
  actor_id: 'actor:local_service:mirror-core',
  actor_type: 'local_service',
  display_name: 'Mirror Core Local Service',
  source_system: 'mirror-core'
};

class EventJournal {
  constructor(runtimeDir) {
    this.file = path.join(path.resolve(runtimeDir), 'journal.ndjson');
    ensureDir(path.dirname(this.file));
    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, '', { mode: 0o600 });
  }

  read() {
    const text = fs.readFileSync(this.file, 'utf8').trim();
    if (!text) return [];
    return text.split(/\r?\n/).filter(Boolean).map(function (line, index) {
      try { return JSON.parse(line); }
      catch (error) { throw new Error('journal line ' + (index + 1) + ' is invalid JSON'); }
    });
  }

  append(eventType, input) {
    input = input || {};
    const events = this.read();
    const event = {
      event_id: makeId('event'),
      schema_version: 'axm.mirror.event/v1',
      event_type: eventType,
      timestamp: now(),
      actor: clone(input.actor || CORE_ACTOR),
      system: input.system || 'mirror-core',
      session: input.session || null,
      related_packet: input.related_packet || null,
      related_entities: clone(input.related_entities || []),
      previous_hash: events.length ? events[events.length - 1].event_hash : null,
      event_hash: '',
      payload: clone(input.payload || {}),
      evidence_refs: clone(input.evidence_refs || [])
    };
    event.event_hash = HashChain.hashEvent(event);
    fs.appendFileSync(this.file, JSON.stringify(event) + '\n', { mode: 0o600 });
    return clone(event);
  }

  verify() {
    try {
      return HashChain.verify(this.read());
    } catch (error) {
      return { ok: false, errors: [error.message], count: 0, head: null };
    }
  }

  reset() {
    fs.writeFileSync(this.file, '', { mode: 0o600 });
  }
}

module.exports = { EventJournal, CORE_ACTOR };
