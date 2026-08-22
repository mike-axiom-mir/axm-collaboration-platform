'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoboPongSemanticBridge } = require('../migrations/robo-pong/legacy-robo-pong-bridge.cjs');

test('Robo Pong bridge preserves current left/right fields', () => {
  const room={inputs:{p1:{left:false,right:false},p2:{left:false,right:false}}};
  let powerCount=0;
  const bridge=createRoboPongSemanticBridge({room,usePower:()=>powerCount++});
  bridge.applyFrame('p1',{protocol:'axm-input/0.1',type:'input_frame',actions:[{id:'MOVE',value:{x:-.7,y:0}},{id:'PRIMARY_ACTION',value:0}]});
  assert.equal(room.inputs.p1.left,true);
  assert.equal(room.inputs.p1.right,false);
  bridge.applyFrame('p1',{protocol:'axm-input/0.1',type:'input_frame',actions:[{id:'MOVE',value:{x:.8,y:0}},{id:'PRIMARY_ACTION',value:1}]});
  assert.equal(room.inputs.p1.left,false);
  assert.equal(room.inputs.p1.right,true);
  assert.equal(powerCount,1);
  bridge.applyFrame('p1',{protocol:'axm-input/0.1',type:'input_frame',actions:[{id:'MOVE',value:{x:.8,y:0}},{id:'PRIMARY_ACTION',value:1}]});
  assert.equal(powerCount,1,'held button must not fire repeatedly');
});

test('Robo Pong release neutralizes the player', () => {
  const room={inputs:{p1:{left:true,right:false},p2:{left:false,right:false}}};
  const bridge=createRoboPongSemanticBridge({room,usePower:()=>{}});
  bridge.release('p1');
  assert.deepEqual(room.inputs.p1,{left:false,right:false});
});
