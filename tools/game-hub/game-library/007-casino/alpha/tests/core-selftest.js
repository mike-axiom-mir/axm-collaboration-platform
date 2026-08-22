#!/usr/bin/env node
"use strict";

var assert = require("assert");
var Core = require("../runtime/casino-core.js");
var Adapter = require("../runtime/game-hub-adapter.js");
var Catalog = require("../../slots/slot-catalog.js");

var passed = 0;

function test(name, work) {
  try {
    work();
    passed += 1;
    console.log("PASS " + name);
  } catch (error) {
    console.error("FAIL " + name);
    throw error;
  }
}

function player(slot, name, type) {
  return { seat_id: "seat_" + slot, slot: slot, display_name: name || "Player " + slot, type: type || "human" };
}

function story(options) {
  return new Core.CasinoSession(Object.assign({
    mode: "backroom_story",
    players: [player(1, "Story Tester")],
    seed: "casino-alpha-story-test",
    worldSeed: "casino-alpha-world-test",
    startAtMs: 0,
    bookLength: 2000,
    testOnly: true,
    initialNpcDelayMs: 100000000,
    baseNpcIntervalMs: 100000000,
    trafficNpcIntervalMs: 100000000,
    npcSpinMs: 1
  }, options || {}));
}

function war(options) {
  return new Core.CasinoSession(Object.assign({
    mode: "house_war",
    players: [player(1, "A One"), player(5, "B One")],
    seed: "casino-alpha-war-test",
    worldSeed: "casino-alpha-world-war",
    startAtMs: 0,
    bookLength: 3000,
    testOnly: true,
    initialNpcDelayMs: 100000000,
    baseNpcIntervalMs: 100000000,
    trafficNpcIntervalMs: 100000000,
    npcSpinMs: 1
  }, options || {}));
}

function packet(session, seatId, sequence, value, requestId) {
  return {
    seatId: seatId,
    token: session.players[seatId].token,
    sequence: sequence,
    requestId: requestId || seatId + ":request:" + sequence,
    command: value
  };
}

function command(session, seatId, sequence, value, requestId) {
  return session.command(packet(session, seatId, sequence, value, requestId));
}

function inspectedDraw(session, styleId, position) {
  var ticketId = session.drawSpine.masterOrder[position];
  var rowIndex = session.drawSpine.internalRowForTicket(styleId, ticketId);
  var row = Catalog.rowAt(styleId, rowIndex, session.drawSpine._epochSeed("row:" + styleId));
  var jackpotTicket = Math.floor(ticketId / 5);
  row.jackpotTicket = jackpotTicket;
  row.humanJackpot = jackpotTicket < Catalog.constants.humanJackpotThreshold;
  row.npcJackpot = jackpotTicket < Catalog.constants.npcJackpotThreshold;
  return { position: position, ticketId: ticketId, row: row };
}

function seekDraw(session, styleId, predicate) {
  for (var position = 0; position < session.drawSpine.activeLength; position += 1) {
    var inspected = inspectedDraw(session, styleId, position);
    if (predicate(inspected.row, inspected)) {
      session.drawSpine.cursor = position;
      session.drawSpine.totalConsumed = position;
      return inspected;
    }
  }
  throw new Error("fixture has no matching draw for " + styleId);
}

function drainFreeSpins(session, seatId, sequence) {
  var next = sequence;
  while (session.players[seatId].freeSpinsRemaining > 0) {
    command(session, seatId, next, { type: "spin" });
    next += 1;
    assert.ok(next - sequence < 300, "finite fixture free spins must eventually drain");
  }
  return next;
}

test("normalizes District Party seats and rejects disguised imbalance", function () {
  var normalized = Adapter.normalizePlayers([player(6, "B Two"), player(2, "A Two"), player(1, "A One"), player(5, "B One")]);
  assert.deepStrictEqual(normalized.map(function (item) { return item.slot; }), [1, 2, 5, 6]);
  assert.equal(Adapter.inferMode(normalized), "house_war");
  assert.equal(Adapter.validateRoster(normalized, "house_war", false).ok, true);
  assert.equal(Adapter.validateRoster(Adapter.normalizePlayers([player(1), player(2), player(5)]), "house_war", false).ok, false);
  assert.equal(Adapter.validateRoster(Adapter.normalizePlayers([player(1), player(5)]), "backroom_story", false).ok, false);
});

test("constructs 1-4 player free play and equal 1v1-4v4 House War rosters", function () {
  for (var size = 1; size <= 4; size += 1) {
    var storySession = new Core.CasinoSession({ mode: "backroom_story", players: Adapter.createStandalonePlayers("backroom_story", size), seed: "story-roster-" + size, bookLength: 20, testOnly: true });
    assert.equal(Object.keys(storySession.players).length, size);
    assert.equal(Object.keys(storySession.parties).length, 1);
    assert.equal(storySession.observeHost(storySession.hostToken).styles.length, 10);
    assert.equal(storySession.observeHost(storySession.hostToken).styles.filter(function (style) { return style.unlocked; }).length, 10);
    assert.equal(storySession.observeHost(storySession.hostToken).quest, null);

    var warSession = new Core.CasinoSession({ mode: "house_war", players: Adapter.createStandalonePlayers("house_war", size), seed: "war-roster-" + size, bookLength: 20, testOnly: true });
    assert.equal(Object.keys(warSession.players).length, size * 2);
    assert.equal(Object.keys(warSession.players).filter(function (seatId) { return warSession.players[seatId].partyId === "A"; }).length, size);
    assert.equal(Object.keys(warSession.players).filter(function (seatId) { return warSession.players[seatId].partyId === "B"; }).length, size);
    assert.equal(warSession.observeHost(warSession.hostToken).styles.filter(function (style) { return style.unlocked; }).length, 10);
  }
});

test("makes all ten distinct slot styles selectable and playable in House War", function () {
  var session = war({ house: 1000000, wallet: 10000, bookLength: 100 });
  var sequence = 1;
  var settled = [];
  Catalog.styleIds.forEach(function (styleId) {
    command(session, "seat_1", sequence++, { type: "select_machine", styleId: styleId });
    settled.push(command(session, "seat_1", sequence++, { type: "spin", wager: 1 }).result);
  });
  assert.deepStrictEqual(settled.map(function (receipt) { return receipt.styleId; }), Catalog.styleIds);
  assert.equal(new Set(settled.map(function (receipt) { return receipt.styleLayout; })).size, 10);
  assert.deepStrictEqual(settled.map(function (receipt) { return receipt.drawIndex; }), Catalog.styleIds.map(function (_, index) { return index; }));
});

test("uses the same precommitted result regardless of human wager", function () {
  var low = war({ seed: "wager-neutral-seed", house: 100000 });
  var high = war({ seed: "wager-neutral-seed", house: 100000 });
  command(low, "seat_1", 1, { type: "select_machine", styleId: "nullbloom" });
  command(high, "seat_1", 1, { type: "select_machine", styleId: "nullbloom" });
  var one = command(low, "seat_1", 2, { type: "spin", wager: 1 }).result;
  var ten = command(high, "seat_1", 2, { type: "spin", wager: 10 }).result;
  assert.equal(one.drawTicket, ten.drawTicket);
  assert.equal(one.rowIndex, ten.rowIndex);
  assert.deepStrictEqual(one.presentation, ten.presentation);
  assert.equal(one.jackpotTicket, ten.jackpotTicket);
  assert.equal(ten.slotPayout, one.slotPayout * 10);
});

test("advances one global Draw Spine across players, styles, casinos, and contests", function () {
  var session = war({ house: 100000 });
  var first = command(session, "seat_1", 1, { type: "spin", wager: 1 }).result;
  command(session, "seat_5", 1, { type: "select_machine", styleId: "graftgarden" });
  var second = command(session, "seat_5", 2, { type: "spin", wager: 1 }).result;
  command(session, "seat_1", 2, { type: "travel", location: "contest" });
  var third = command(session, "seat_1", 3, { type: "spin", wager: 1 }).result;
  assert.deepStrictEqual([first.drawIndex, second.drawIndex, third.drawIndex], [0, 1, 2]);
  assert.deepStrictEqual([first.styleId, second.styleId, third.styleId], ["lux-5", "graftgarden", session.contest.styleId]);
  assert.equal(session.drawSpine.totalConsumed, 3);
});

test("moves exactly five percent of a human wager into the progressive", function () {
  var session = war({ house: 100000 });
  var beforeJackpot = session.jackpotUnits;
  var beforeWallet = session.players.seat_1.walletUnits;
  var beforeHouse = session.parties.A.houseUnits;
  var receipt = command(session, "seat_1", 1, { type: "spin", wager: 10 }).result;
  var contribution = Core.creditsToUnits(0.5);
  assert.equal(Core.creditsToUnits(receipt.jackpotContribution), contribution);
  assert.equal(session.jackpotUnits, beforeJackpot + contribution - Core.creditsToUnits(receipt.jackpotPayout));
  assert.equal((session.players.seat_1.walletUnits - beforeWallet) + (session.parties.A.houseUnits - beforeHouse) + (session.jackpotUnits - beforeJackpot), 0);
});

test("uses a one-percent human jackpot chance, caps at 100x, and leaves the remainder", function () {
  var session = war({ jackpot: 1000, seed: "jackpot-cap-seed", bookLength: 50000, house: 100000 });
  seekDraw(session, "lux-5", function (row) { return row.humanJackpot; });
  var before = session.jackpotUnits;
  var result = command(session, "seat_1", 1, { type: "spin", wager: 1 }).result;
  assert.equal(result.jackpotHit, true);
  assert.equal(result.jackpotPayout, 100);
  assert.equal(session.jackpotUnits, before + Core.creditsToUnits(0.05) - Core.creditsToUnits(100));
});

test("uses the NPC 0.05-percent chance and one-percent contribution", function () {
  var session = war({ jackpot: 1000, seed: "npc-jackpot-seed", house: 100000, bookLength: 50000 });
  var npc = session._spawnNpc("A", "npc_jackpot_test");
  seekDraw(session, npc.selectedStyleId, function (row) { return row.npcJackpot; });
  var result = session._settleSpin(npc, npc.targetId, npc.wagerUnits, "npc");
  assert.equal(result.jackpotHit, true);
  assert.equal(Core.creditsToUnits(result.jackpotContribution), Math.round(npc.wagerUnits * 0.01));
  assert.ok(result.jackpotPayout <= result.wager * 100);
});

test("locks LUX-5 free spins to their style and target with no second contribution", function () {
  var session = war({ seed: "free-lock-seed", house: 100000, bookLength: 50000 });
  seekDraw(session, "lux-5", function (row) { return row.freeSpinsAwarded > 0; });
  var paid = command(session, "seat_1", 1, { type: "spin", wager: 5 }).result;
  assert.ok(paid.freeSpinsAwarded > 0);
  assert.throws(function () { command(session, "seat_1", 2, { type: "select_machine", styleId: "graftgarden" }); }, /finish the queued free spins/);
  assert.throws(function () { command(session, "seat_1", 2, { type: "travel", location: "casino_b" }); }, /finish the queued free spins/);
  var jackpotAfterPaid = session.jackpotUnits;
  var free = command(session, "seat_1", 2, { type: "spin", wager: 10 }).result;
  assert.equal(free.free, true);
  assert.equal(free.targetId, "casino_a");
  assert.equal(free.styleId, "lux-5");
  assert.equal(free.wager, 5);
  assert.equal(free.jackpotContribution, 0);
  assert.equal(session.jackpotUnits, jackpotAfterPaid - Core.creditsToUnits(free.jackpotPayout));
});

test("settles duplicate requests exactly once and rejects request-id mutation", function () {
  var session = war();
  var firstPacket = packet(session, "seat_1", 1, { type: "spin", wager: 1 }, "same-request");
  var first = session.command(firstPacket);
  var consumed = session.drawSpine.totalConsumed;
  assert.deepStrictEqual(session.command(firstPacket), first);
  assert.equal(session.drawSpine.totalConsumed, consumed);
  assert.throws(function () { session.command(packet(session, "seat_1", 2, { type: "spin", wager: 2 }, "same-request")); }, /different input/);
  assert.throws(function () { command(session, "seat_1", 1, { type: "set_wager", wager: 2 }, "stale-sequence"); }, /sequence must increase/);
});

test("filters rival money and never exposes seeds, permutations, or future rows", function () {
  var session = war();
  var observation = session.observePlayer("seat_1", session.players.seat_1.token);
  var partyA = observation.parties.find(function (party) { return party.id === "A"; });
  var partyB = observation.parties.find(function (party) { return party.id === "B"; });
  assert.equal(typeof partyA.house, "number");
  assert.equal(partyB.house, null);
  assert.equal(observation.players.find(function (item) { return item.seatId === "seat_5"; }).wallet, null);
  assert.equal(Object.prototype.hasOwnProperty.call(observation.drawSpine, "seed"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(observation.drawSpine, "masterOrder"), false);
  assert.equal(JSON.stringify(observation).includes(session.sessionSeed), false);
  assert.equal(Object.prototype.hasOwnProperty.call(observation, "book"), false);
});

test("gives an explicit adapter seat the same settled player view and command gate", function () {
  var session = war({
    players: [player(1, "Mike", "human"), player(5, "Axiom/Mir", "adapter")]
  });
  var adapterSeat = session.players.seat_5;
  var before = session.observePlayer("seat_5", adapterSeat.token);
  assert.equal(before.ownPlayer.seatId, "seat_5");
  assert.equal(before.players.find(function (item) { return item.seatId === "seat_5"; }).controllerType, "adapter");
  assert.equal(before.ownPlayer.lastSpin, null);
  assert.equal(Object.prototype.hasOwnProperty.call(before.drawSpine, "seed"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(before.drawSpine, "masterOrder"), false);

  var receipt = command(session, "seat_5", 1, { type: "spin", wager: 1 }, "adapter-spin-1");
  var after = session.observePlayer("seat_5", adapterSeat.token);
  assert.equal(receipt.ok, true);
  assert.equal(after.ownPlayer.acceptedSequence, 1);
  assert.deepStrictEqual(after.ownPlayer.lastSpin, receipt.result);
  assert.equal(typeof after.ownPlayer.lastSpin.totalPayout, "number");
});

test("scores a random-style district contest by gross payout and grants five-minute traffic", function () {
  var session = war({ contestDurationMs: 100, contestIntervalMs: 100, claimDurationMs: 300000, house: 100000 });
  var contestStyle = session.contest.styleId;
  seekDraw(session, contestStyle, function (row) { return row.paidPayoutPpm > 0 && !row.humanJackpot; });
  command(session, "seat_1", 1, { type: "travel", location: "contest" });
  var result = command(session, "seat_1", 2, { type: "spin", wager: 10 }).result;
  assert.equal(result.styleId, contestStyle);
  assert.equal(session.contest.scoresUnits.A, Core.creditsToUnits(result.totalPayout));
  var spotId = session.contest.spotId;
  session.advance(100);
  var spot = session.spots.find(function (item) { return item.id === spotId; });
  assert.ok(spot.claim);
  assert.equal(spot.claim.partyId, "A");
  assert.equal(spot.claim.expiresAtMs - session.nowMs, 300000);
  session.advance(300000);
  assert.equal(spot.claim, null);
});

test("runs an NPC through exactly 100 paid one-percent wagers in 20-50-spin style visits", function () {
  var session = war({ seed: "npc-complete-seed", house: 1000000 });
  var npc = session._spawnNpc("A", "test_spot");
  var expectedWager = npc.initialBankrollUnits / 100;
  assert.equal(npc.wagerUnits, expectedWager);
  assert.ok(npc.segmentLength >= 20 && npc.segmentLength <= 50);
  session.advance(2000);
  var completion = session.events.filter(function (event) { return event.type === "npc_visit_completed" && event.data.npcId === npc.id; }).pop();
  assert.ok(completion, "NPC must depart after its visit");
  assert.equal(completion.data.reason, "completed");
  assert.equal(completion.data.paidSpins, 100);
  assert.equal(completion.data.totalOutcomes, completion.data.paidSpins + completion.data.freeSpins);
  var changes = session.events.filter(function (event) { return event.type === "npc_changed_machine" && event.data.npcId === npc.id; });
  assert.ok(changes.length >= 1);
  changes.forEach(function (event) { assert.ok(event.data.nextSegmentLength >= 20 && event.data.nextSegmentLength <= 50); });
  var plannedSegments = [session.events.find(function (event) { return event.type === "npc_arrived" && event.data.npcId === npc.id; }).data.segmentLength]
    .concat(changes.map(function (event) { return event.data.nextSegmentLength; }));
  assert.equal(plannedSegments.reduce(function (sum, length) { return sum + length; }, 0), 100);
});

test("opens all ten free-play cabinets immediately with no quest events", function () {
  var session = story({
    players: [player(1, "Errol"), player(2, "Co-op Friend")],
    house: 1000000,
    wallet: 10000,
    seed: "ten-cabinet-free-play-seed",
    bookLength: 100
  });
  var sequences = { seat_1: 1, seat_2: 1 };

  function doCommand(seatId, value) {
    return command(session, seatId, sequences[seatId]++, value).result;
  }

  assert.deepStrictEqual(session.unlockedStyleIds, Catalog.styleIds);
  assert.equal(session.machineOpen, true);
  assert.equal(session.questProgress, null);
  Catalog.styleIds.forEach(function (styleId, index) {
    var actor = index % 2 === 0 ? "seat_1" : "seat_2";
    doCommand(actor, { type: "select_machine", styleId: styleId });
    var receipt = doCommand(actor, { type: "spin", wager: 1 });
    assert.equal(receipt.styleId, styleId);
    sequences[actor] = drainFreeSpins(session, actor, sequences[actor]);
  });

  assert.equal(session.events.some(function (event) { return /^quest_|^slot_chapter_|^story_/.test(event.type); }), false);
  assert.equal(session.observePlayer("seat_1", session.players.seat_1.token).quest, null);
  assert.equal(session.observePlayer("seat_2", session.players.seat_2.token).quest, null);
});

test("persists free-play economy but never quests or the future Draw Spine", function () {
  var first = story({ seed: "persistent-first" });
  command(first, "seat_1", 1, { type: "fund_house", amount: 10 });
  var saved = first.exportPersistentState();
  assert.equal(Object.prototype.hasOwnProperty.call(saved, "seed"), false);
  assert.equal(JSON.stringify(saved).includes(first.sessionSeed), false);
  assert.deepStrictEqual(saved.story.unlockedStyleIds, Catalog.styleIds);
  assert.equal(Object.prototype.hasOwnProperty.call(saved.story, "questProgress"), false);
  var second = story({ seed: "persistent-second", persistentState: saved });
  assert.equal(second.machineOpen, true);
  assert.equal(second.parties.A.houseUnits, first.parties.A.houseUnits);
  assert.equal(second.questProgress, null);
  assert.deepStrictEqual(second.unlockedStyleIds, first.unlockedStyleIds);
  assert.equal(second.jackpotUnits, first.jackpotUnits);
  assert.notEqual(second.sessionSeed, first.sessionSeed);
  assert.equal(second.drawSpine.totalConsumed, 0);
});

test("ends House War at the closing bell from server-owned equity", function () {
  var session = war({ durationMs: 100 });
  session.parties.A.houseUnits += Core.creditsToUnits(1);
  session.parties.B.houseUnits -= Core.creditsToUnits(1);
  session.advance(100);
  assert.equal(session.status, "ended");
  assert.equal(session.result.reason, "closing_bell");
  assert.equal(session.result.winner_party_id, "A");
  assert.equal(session.result.game_id, Core.GAME_ID);
  assert.equal(session.result.style_spin_counts["lux-5"], 0);
});

test("honors a resolved attack win even when a high-volatility style breaks the rival", function () {
  var session = war({ seed: "bankruptcy-attack-seed", house: 100000, bookLength: 50000 });
  command(session, "seat_1", 1, { type: "select_machine", styleId: "nullbloom" });
  seekDraw(session, "nullbloom", function (row) { return row.paidPayoutPpm > 2000000 && !row.humanJackpot; });
  var moved = session.parties.B.houseUnits - Core.creditsToUnits(1) + session.players.seat_5.walletUnits;
  session.parties.B.houseUnits = Core.creditsToUnits(1);
  session.players.seat_5.walletUnits = 0;
  session.parties.A.houseUnits += moved;
  command(session, "seat_1", 2, { type: "travel", location: "casino_b" });
  var result = command(session, "seat_1", 3, { type: "spin", wager: 10 }).result;
  assert.ok(result.slotPayout > 20);
  assert.ok(session.parties.B.houseUnits < 0);
  assert.equal(session.status, "ended");
  assert.equal(session.result.reason, "bankruptcy");
  assert.equal(session.result.winner_party_id, "A");
});

console.log("Casino alpha core selftest: PASS (" + passed + " contracts)");
