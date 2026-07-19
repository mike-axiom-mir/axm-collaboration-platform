#!/usr/bin/env node
"use strict";

var assert = require("assert");
var Catalog = require("./slot-catalog.js");
var DrawTools = require("./axm-draw-spine.js");

function asArray(typed) { return Array.prototype.slice.call(typed); }

var spine = new DrawTools.DrawSpine("draw-spine-audit-seed", Catalog.styleIds);
assert.equal(new Set(asArray(spine.masterOrder)).size, 50000, "master order must be a full without-replacement permutation");
Catalog.styleIds.forEach(function (styleId) {
  assert.equal(new Set(asArray(spine.styleMappings[styleId])).size, 50000, styleId + " map must be a full permutation");
});
assert.notDeepStrictEqual(asArray(spine.styleMappings["graftgarden"]).slice(0, 100), asArray(spine.styleMappings["mirror-mice"]).slice(0, 100));

var humanTickets = asArray(spine.masterOrder).filter(function (ticketId) { return Math.floor(ticketId / 5) < Catalog.constants.humanJackpotThreshold; }).length;
var npcTickets = asArray(spine.masterOrder).filter(function (ticketId) { return Math.floor(ticketId / 5) < Catalog.constants.npcJackpotThreshold; }).length;
assert.equal(humanTickets, 500, "a full 50K epoch must contain exactly 1% human jackpot tickets");
assert.equal(npcTickets, 25, "a full 50K epoch must contain exactly 0.05% NPC jackpot tickets");

var left = new DrawTools.DrawSpine("shared-seed", Catalog.styleIds, { activeLength: 100 });
var right = new DrawTools.DrawSpine("shared-seed", Catalog.styleIds, { activeLength: 100 });
var choicesA = ["lux-5", "graftgarden", "nullbloom", "weatherheart"];
var choicesB = ["orbit-oven", "mirror-mice", "lux-5", "twinlight-relay"];
for (var index = 0; index < 80; index += 1) {
  var drawA = left.next(choicesA[index % choicesA.length]);
  var drawB = right.next(choicesB[index % choicesB.length]);
  assert.equal(drawA.ticketId, drawB.ticketId, "style choice must not choose the neutral ticket");
  assert.equal(drawA.drawIndex, index);
  assert.equal(drawB.drawIndex, index);
}

var replayA = new DrawTools.DrawSpine("deterministic-replay", Catalog.styleIds, { activeLength: 50 });
var replayB = new DrawTools.DrawSpine("deterministic-replay", Catalog.styleIds, { activeLength: 50 });
for (index = 0; index < 50; index += 1) {
  assert.deepStrictEqual(replayA.next(Catalog.styleIds[index % 10]), replayB.next(Catalog.styleIds[index % 10]));
}

var short = new DrawTools.DrawSpine("epoch-test", Catalog.styleIds, { activeLength: 3 });
assert.equal(short.next("lux-5").epoch, 0);
assert.equal(short.next("graftgarden").epoch, 0);
assert.equal(short.next("mirror-mice").epoch, 0);
var nextEpoch = short.next("nullbloom");
assert.equal(nextEpoch.epoch, 1);
assert.equal(nextEpoch.position, 0);
assert.equal(nextEpoch.drawIndex, 3);

var publicState = spine.publicState();
assert.equal(publicState.registeredStyles, 10);
assert.equal(Object.prototype.hasOwnProperty.call(publicState, "seed"), false);
assert.equal(Object.prototype.hasOwnProperty.call(publicState, "masterOrder"), false);
assert.equal(Object.prototype.hasOwnProperty.call(publicState, "styleMappings"), false);
assert.throws(function () { spine.next("missing"); }, /not registered/);
assert.throws(function () { new DrawTools.DrawSpine("seed", Catalog.styleIds, { activeLength: 50001 }); }, /1 through 50,000/);

console.log("AXM Draw Spine self-test passed: unbiased 50K permutations, exact jackpot counts, global interleaving, replay, and epoch rollover.");
