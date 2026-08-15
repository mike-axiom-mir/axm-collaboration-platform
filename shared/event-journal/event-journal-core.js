'use strict';

const crypto = require('crypto');

class JournalError extends Error {
  constructor(code, message, details) { super(message); this.name = 'JournalError'; this.code = code; this.details = details || null; }
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function event(input) {
  if (!input || !input.id || !input.type || !input.occurredAt || !input.correlationId || !input.actor || !input.subject || !input.dataSchema) {
    throw new JournalError('INVALID_EVENT', 'Event requires id, type, occurredAt, correlationId, actor, subject, and dataSchema');
  }
  if (!Number.isFinite(Date.parse(input.occurredAt))) throw new JournalError('INVALID_EVENT_TIME', 'occurredAt must be an ISO-compatible date-time');
  return {
    schema: 'axm.event/v1', id: String(input.id), type: String(input.type), occurredAt: String(input.occurredAt),
    correlationId: String(input.correlationId), causationId: input.causationId == null ? null : String(input.causationId),
    actor: String(input.actor), subject: String(input.subject), authorityDecisionRef: input.authorityDecisionRef == null ? null : String(input.authorityDecisionRef),
    evidenceRefs: Array.from(new Set((input.evidenceRefs || []).map(String))).sort(), dataSchema: String(input.dataSchema), data: input.data == null ? null : input.data,
    grantsAuthority: false
  };
}

function record(eventValue, sequence, previousHash) {
  const base = { schema: 'axm.journal-record/v1', sequence, previousHash: previousHash || null, event: event(eventValue) };
  return { ...base, recordHash: sha256(canonical(base)) };
}

function verify(records) {
  let previousHash = null;
  const ids = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const row = records[index];
    if (!row || row.schema !== 'axm.journal-record/v1') throw new JournalError('INVALID_JOURNAL_RECORD', `Record ${index} has an invalid schema`);
    if (row.sequence !== index) throw new JournalError('JOURNAL_SEQUENCE_DRIFT', `Record ${index} declares sequence ${row.sequence}`);
    if (row.previousHash !== previousHash) throw new JournalError('JOURNAL_CHAIN_DRIFT', `Record ${index} has the wrong previous hash`);
    const { recordHash, ...base } = row;
    const actual = sha256(canonical(base));
    if (recordHash !== actual) throw new JournalError('JOURNAL_HASH_DRIFT', `Record ${index} content does not match its hash`);
    if (ids.has(row.event.id)) throw new JournalError('DUPLICATE_EVENT_ID', `Event id ${row.event.id} occurs more than once`);
    ids.add(row.event.id);
    previousHash = recordHash;
  }
  return { state: 'PASS', count: records.length, head: previousHash };
}

function replay(records, reducer, initial) {
  verify(records);
  return records.reduce((state, row) => reducer(state, row.event), initial);
}

module.exports = { JournalError, canonical, sha256, event, record, verify, replay };
