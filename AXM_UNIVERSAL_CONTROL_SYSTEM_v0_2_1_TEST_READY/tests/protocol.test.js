import test from 'node:test';
import assert from 'node:assert/strict';
import { createInputFrame, validateInputFrame, PROTOCOL_VERSION } from '../src/network/protocol.js';

test('input frame carries semantic actions and sequence identity', () => {
  const frame = createInputFrame({
    deviceId:'phone-1',playerId:'p1',sequence:3,
    actions:[{id:'MOVE',value:{x:.5,y:0}},{id:'PRIMARY_ACTION',value:1}]
  });
  assert.equal(frame.protocol,PROTOCOL_VERSION);
  assert.equal(frame.type,'input_frame');
  assert.equal(frame.sequence,3);
  assert.deepEqual(validateInputFrame(frame),[]);
});

test('invalid protocol is rejected', () => {
  assert.ok(validateInputFrame({protocol:'wrong',type:'input_frame',deviceId:'x',sequence:0,actions:[]}).length > 0);
});

test('protocol rejects duplicate actions, non-finite axes, and oversized frames', () => {
  const base={protocol:PROTOCOL_VERSION,type:'input_frame',deviceId:'phone',playerId:'p1',sequence:1,clientSentAt:1,fullState:true,context:'gameplay'};
  assert.ok(validateInputFrame({...base,actions:[{id:'MOVE',value:{x:0,y:0}},{id:'MOVE',value:{x:1,y:0}}]}).some(error=>error.includes('duplicate')));
  assert.ok(validateInputFrame({...base,actions:[{id:'MOVE',value:{x:Infinity,y:0}}]}).some(error=>error.includes('finite')));
  assert.ok(validateInputFrame({...base,actions:Array.from({length:65},(_,index)=>({id:`ACTION_${index}`,value:0}))}).some(error=>error.includes('exceeds')));
});
