#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const SYS = require('../runtime/systems.js');

const anchors = [
  { id:'a0', x:0, y:0 }, { id:'a1', x:100, y:0 }, { id:'a2', x:200, y:0 },
  { id:'a3', x:100, y:100 }, { id:'a4', x:200, y:100 }
];
const links = [[0,1],[1,2],[0,3],[3,4],[4,2]];

test('bridge routing chooses the stable shortest connected roof path', () => {
  const route = SYS.bridgeRoute(anchors, links, {x:-10,y:0}, {x:210,y:0});
  assert.equal(route.connected, true); assert.equal(route.direct, false);
  assert.deepEqual(route.indices, [0,1,2]); assert.deepEqual(route.anchorIds, ['a0','a1','a2']);
  assert.equal(Math.round(route.cost), 200);
});

test('gargoyle pressure makes the route planner avoid a hot contested roof', () => {
  const route = SYS.bridgeRoute(anchors, links, {x:0,y:0}, {x:200,y:0}, { mapId:'gargoyle-garage', mechanicState:{active:true}, hotAnchorIds:['a1'] });
  assert.deepEqual(route.anchorIds, ['a0','a3','a4','a2']);
  assert.ok(route.cost < 400);
});

test('time bridges and escalators expose deterministic directional logistics costs', () => {
  const activeEast = {active:true,direction:1};
  assert.equal(SYS.bridgeTraversalMultiplier('tuesday',activeEast,anchors[0],anchors[1]),.62);
  assert.equal(SYS.bridgeTraversalMultiplier('witch-mall',activeEast,anchors[0],anchors[1]),.62);
  assert.equal(SYS.bridgeTraversalMultiplier('witch-mall',activeEast,anchors[1],anchors[0]),1.35);
  assert.equal(SYS.bridgeTraversalMultiplier('witch-mall',activeEast,{id:'v0',x:0,y:0},{id:'v1',x:0,y:100}),1);
});

test('same-roof and missing-graph orders fall back safely without invented waypoints', () => {
  const local = SYS.bridgeRoute(anchors, links, {x:2,y:3}, {x:30,y:15});
  assert.equal(local.connected,true); assert.equal(local.direct,true); assert.deepEqual(local.anchorIds,['a0']);
  const isolated = SYS.bridgeRoute(anchors, [], {x:0,y:0}, {x:200,y:0});
  assert.equal(isolated.connected,false); assert.equal(isolated.direct,true); assert.deepEqual(isolated.anchorIds,[]);
  assert.equal(SYS.nearestAnchorIndex({x:195,y:4},anchors),2);
});
