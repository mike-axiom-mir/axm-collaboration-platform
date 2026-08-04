#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Orchestrator = require('./axm-heartbeat-organ-orchestrator');

(async () => {
  const order = [];
  let sharedLaneBusy = false;
  const orchestrator = Orchestrator.create([
    { id:'verification', onBeat:async () => { assert.equal(sharedLaneBusy, false); sharedLaneBusy = true; order.push('verification:start'); await Promise.resolve(); order.push('verification:end'); sharedLaneBusy = false; return { status:'PASS' }; } },
    { id:'code-drafts', onBeat:async () => { assert.equal(sharedLaneBusy, false, 'drafts must not race the verification lease'); sharedLaneBusy = true; order.push('drafts:start'); await Promise.resolve(); order.push('drafts:end'); sharedLaneBusy = false; return { status:'PASS', drafts:5 }; } },
    { id:'mirror-learning', onBeat:async () => { assert.equal(sharedLaneBusy, false, 'learning must not race earlier Pulse organs'); sharedLaneBusy = true; order.push('learning:start'); await Promise.resolve(); order.push('learning:end'); sharedLaneBusy = false; return { status:'DORMANT' }; } },
    { id:'updater', onBeat:() => { assert.equal(sharedLaneBusy, false); order.push('updater'); return { status:'OFF' }; } }
  ]);
  const result = await orchestrator.onBeat({ beatId:'beat-test' });
  assert.deepEqual(order, ['verification:start','verification:end','drafts:start','drafts:end','learning:start','learning:end','updater']);
  assert.deepEqual(result.receipts.map(item => item.organId + ':' + item.status), ['verification:PASS','code-drafts:PASS','mirror-learning:PASS','updater:PASS']);

  let laterStepRan = false;
  const contained = Orchestrator.create([
    { id:'faulty', onBeat:() => { throw new Error('fixture failure'); } },
    { id:'later-safe-organ', onBeat:() => { laterStepRan = true; return { status:'PASS' }; } }
  ]);
  await assert.rejects(() => contained.onBeat({ beatId:'beat-error' }), error => {
    assert.equal(laterStepRan, true, 'one organ error must not silently skip later bounded organs');
    assert.deepEqual(error.receipts.map(item => item.status), ['ERROR','PASS']);
    return true;
  });
  console.log('PASS heartbeat organ orchestrator · one shared Body Pulse lane · ordered execution · contained errors');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
