'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Runner = require('./observatory-worker-runner');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-observatory-runner-'));
const cacheFile = path.join(temporary, 'state', 'latest.json');
let launches = 0;

class FakeWorker extends EventEmitter {
  constructor() {
    super();
    launches++;
    setImmediate(() => this.emit('message', {
      ok:true,
      result:{
        observatory:{ schema:'axm.workshop-observatory/v1', measuredAt:'2026-08-22T00:00:00.000Z', source:{ digest:'abc123' } },
        status:{ schema:'axm.workshop-observatory-scan-status/v1', state:'CURRENT', durationMs:12, measuredAt:'2026-08-22T00:00:00.000Z', execution:'isolated-worker', mainThreadFileWalk:false }
      }
    }));
  }
  terminate() { return Promise.resolve(0); }
}

(async function () {
  try {
    const runner = Runner.create({ root:temporary, cacheFile, workerFile:path.join(temporary, 'worker.cjs'), WorkerImpl:FakeWorker, staleAfterMs:60000 });
    assert.equal(runner.read().ready, false);
    const first = runner.refresh(), second = runner.refresh();
    assert.strictEqual(first, second);
    await first;
    const current = runner.read();
    assert.equal(current.ready, true);
    assert.equal(current.scanStatus.execution, 'isolated-worker');
    assert.equal(current.stats.coalesced, 1);
    assert.equal(launches, 1);
    assert.equal(JSON.parse(fs.readFileSync(cacheFile, 'utf8')).schema, Runner.CACHE_SCHEMA);
    console.log('Workshop Observatory worker selftest: PASS · coalesced isolated scan');
  } finally {
    fs.rmSync(temporary, { recursive:true, force:true });
  }
}()).catch(error => { console.error(error.stack || error.message || error); process.exitCode = 1; });
