#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const { sanitizeTactical } = require('../runtime/server.js');
const systems = require('../runtime/systems.js');

test('tactical atlas bounds fog-safe roofs, links, and forces', () => {
  const anchors=Array.from({length:30},(_,index)=>({id:'a'+index,name:index===1?'Overtime Landing':'Roof name '+index,x:index===0?-4:index/20,y:index===0?4:index/25,explored:index!==0,visible:index===1,owner:index===0?'enemy':index===1?'player':'neutral',kind:index===1?'borough':'watch',charterColor:index===1?'#ff963c':'javascript:red'}));
  const tactical=sanitizeTactical({
    topology:'Clockface Spiral',
    anchors,
    links:[['a0','a1'],['a0','a29'],['a2','a2'],['bad','a1']],
    forces:[
      {team:'player',x:-1,y:2,members:999,visible:false},
      {team:'enemy',x:.8,y:.4,members:12,visible:false},
      {team:'enemy',x:.7,y:.3,members:8,visible:true},
      {team:'intruder',x:.5,y:.5,members:8,visible:true}
    ],
    signal:{target:'a1',kind:'rally',player:'<Quartermaster>'},
    routes:[{from:'a0',to:'a1',count:99},{from:'a1',to:'a2',count:2},{from:'a0',to:'a29',count:3}]
  });
  assert.equal(tactical.anchors.length,24);
  assert.equal(tactical.topology,'Clockface Spiral');
  assert.deepEqual(tactical.anchors[0],{id:'a0',name:'Roof name 0',x:0,y:1,explored:false,visible:false,owner:'unknown',kind:'',charterColor:''});
  assert.equal(tactical.anchors[1].name,'Overtime Landing');
  assert.equal(tactical.anchors[1].owner,'player');assert.equal(tactical.anchors[1].kind,'borough');assert.equal(tactical.anchors[1].charterColor,'#ff963c');
  assert.deepEqual(tactical.links,[['a0','a1']]);
  assert.equal(tactical.forces.length,2);assert.deepEqual(tactical.forces[0],{team:'player',x:0,y:1,members:200,visible:false});assert.equal(tactical.forces[1].team,'enemy');
  assert.deepEqual(tactical.signal,{target:'a1',kind:'rally',player:'Quartermaster'});
  assert.deepEqual(tactical.routes,[{from:'a0',to:'a1',count:40}]);
});

test('tactical signal requires a retained roof and supported order', () => {
  const atlas=sanitizeTactical({anchors:[{id:'a3',x:.4,y:.5,explored:true,owner:'neutral'}],signal:{target:'a9',kind:'teleport',player:'Q'}});
  assert.equal(atlas.signal,null);assert.equal(atlas.anchors[0].owner,'neutral');
});

test('Wonderwork commissioning is retained as a bounded tactical order', () => {
  const tactical=sanitizeTactical({anchors:[{id:'a3',name:'Punchline Parapet',x:.4,y:.5,explored:true,owner:'neutral',kind:'wonderwork'}],signal:{target:'a3',kind:'wonderwork',player:'Quartermaster'}});
  assert.equal(tactical.anchors[0].kind,'wonderwork');
  assert.deepEqual(tactical.signal,{target:'a3',kind:'wonderwork',player:'Quartermaster'});
});

test('tactical ownership preserves friendly and allied districts without leaking fog', () => {
  assert.equal(systems.tacticalOwner({team:0},true),'player');
  assert.equal(systems.tacticalOwner({team:1},true),'ally');
  assert.equal(systems.tacticalOwner({team:2},true),'enemy');
  assert.equal(systems.tacticalOwner({team:2},false),'unknown');
  assert.equal(systems.tacticalOwner(null,true),'neutral');
});
