'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./event-journal-core');
const Host = require('./event-journal-host');

let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }
function sample(id, causationId, value) { return Core.event({ id, type: 'counter.changed', occurredAt: '2026-08-15T00:00:00.000Z', correlationId: 'corr-1', causationId, actor: 'selftest', subject: 'counter', dataSchema: 'axm.counter-change/v1', data: { value } }); }

function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-event-journal-'));
  const file = path.join(root, 'events.jsonl');
  try {
    const first = Host.append(file, sample('event-1', null, 2));
    const second = Host.append(file, sample('event-2', 'event-1', 3));
    check(first.sequence === 0 && second.sequence === 1, 'events append in sequence');
    const rows = Host.read(file);
    check(Core.verify(rows).head === second.recordHash, 'hash chain verifies');
    const projection = Core.replay(rows, (sum, current) => sum + current.data.value, 0);
    check(projection === 5, 'event replay reproduces projection');
    check(Core.replay(rows, (sum, current) => sum + current.data.value, 0) === projection, 'same events replay deterministically');
    check(rows.every(row => row.event.grantsAuthority === false), 'events never grant authority');
    expect('DUPLICATE_EVENT_ID', () => Core.verify([rows[0], Core.record(rows[0].event, 1, rows[0].recordHash)]));
    const tampered = JSON.parse(JSON.stringify(rows));
    tampered[1].event.data.value = 99;
    expect('JOURNAL_HASH_DRIFT', () => Core.verify(tampered));
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8') + '{"partial":');
    expect('INCOMPLETE_JOURNAL_TAIL', () => Host.read(file));
    check(typeof Host.rewrite === 'undefined' && typeof Host.delete === 'undefined', 'no rewrite or delete API exists');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  process.stdout.write(`event-journal selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
