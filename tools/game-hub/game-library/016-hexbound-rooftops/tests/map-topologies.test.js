#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const DATA = require('../runtime/game-data.js');
const SYS = require('../runtime/systems.js');

function reachable(topology, links = topology.links) {
  const visited = new Set([0]), queue = [0];
  while (queue.length) {
    const current = queue.shift();
    for (const pair of links) {
      const next = pair[0] === current ? pair[1] : pair[1] === current ? pair[0] : -1;
      if (next >= 0 && !visited.has(next)) { visited.add(next); queue.push(next); }
    }
  }
  return visited.size;
}

test('all six battlefields own distinct authored topology contracts', () => {
  assert.equal(Object.keys(DATA.MAP_TOPOLOGIES).length, 6);
  assert.equal(new Set(DATA.MAPS.map(map => map.topology.id)).size, 6);
  const signatures = new Set();
  for (const map of DATA.MAPS) {
    const topology = map.topology;
    assert.equal(topology.anchors.length, 19, map.id + ' roof count');
    assert.ok(topology.name && topology.strategy);
    assert.equal(new Set(topology.anchors.map(anchor => anchor[2])).size, 19, map.id + ' named roofs');
    assert.ok(topology.links.length >= 30 && topology.links.length <= 40, map.id + ' bounded bridges');
    const linkKeys = topology.links.map(pair => pair.slice().sort((a,b)=>a-b).join('>'));
    assert.equal(new Set(linkKeys).size, topology.links.length, map.id + ' unique links');
    for (const anchor of topology.anchors) assert.ok(anchor[0] >= 200 && anchor[0] <= 2200 && anchor[1] >= 120 && anchor[1] <= 1380, map.id + ' in world bounds');
    for (const pair of topology.links) assert.ok(pair.length === 2 && pair[0] >= 0 && pair[0] < 19 && pair[1] >= 0 && pair[1] < 19 && pair[0] !== pair[1], map.id + ' valid link');
    signatures.add(JSON.stringify([topology.anchors, topology.links]));
  }
  assert.equal(signatures.size, 6);
});

test('every authored map remains connected after any one bridge is removed', () => {
  for (const map of DATA.MAPS) {
    const topology = map.topology;
    assert.equal(reachable(topology), 19, map.id + ' connected');
    topology.links.forEach((_, index) => assert.equal(reachable(topology, topology.links.filter((__, other) => other !== index)), 19, map.id + ' has no compulsory single bridge'));
  }
});

test('authored home roofs align with both Grand Clocks and route through the selected graph', () => {
  const playerClock = {x:260,y:760}, enemyClock = {x:2160,y:740};
  for (const map of DATA.MAPS) {
    const topology = map.topology, anchors = topology.anchors.map((anchor,index)=>({id:'a'+index,x:anchor[0],y:anchor[1]}));
    assert.ok(SYS.distance(playerClock, anchors[7]) < 100, map.id + ' player home');
    assert.ok(SYS.distance(enemyClock, anchors[12]) < 100, map.id + ' rival home');
    const route = SYS.bridgeRoute(anchors, topology.links, playerClock, enemyClock, {mapId:map.id, mechanicState:{active:false}});
    assert.equal(route.connected, true, map.id + ' home route connected');
    assert.equal(route.direct, false, map.id + ' home route uses bridges');
    assert.equal(route.anchorIds[0], 'a7');
    assert.equal(route.anchorIds.at(-1), 'a12');
  }
});

test('topology fiction names the six genuinely different macro shapes', () => {
  assert.deepEqual(DATA.MAPS.map(map => map.topology.name), ['Clockface Spiral','Six-Level Switchback','Banquet Spine','Sleeping Ribcage','Department Constellation','Escalator Atrium']);
});
