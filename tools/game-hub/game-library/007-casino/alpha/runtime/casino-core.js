"use strict";

var crypto = require("crypto");
var adapter = require("./game-hub-adapter.js");
var catalog = require("../../slots/slot-catalog.js");
var drawTools = require("../../slots/axm-draw-spine.js");

var GAME_ID = "007-casino-alpha";
var VERSION = "0.3.4-coop-cabinets";
var MONEY_SCALE = 1000000;
var HUMAN_JACKPOT_BPS = 500;
var NPC_JACKPOT_BPS = 100;
var JACKPOT_CAP_MULTIPLIER = 100;
var HUMAN_JACKPOT_HEAT_PAID_SPINS = 30;
var HUMAN_WAGERS = Object.freeze([1, 2, 5, 10]);
var SPOT_NAMES = Object.freeze([
  "Bar Alley",
  "Moon Market",
  "Tin Can Plaza",
  "Velvet Tram",
  "Robot Row",
  "Afterglow Pier"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function creditsToUnits(value, name) {
  var number = Number(value);
  var units;
  if (!Number.isFinite(number) || number < 0) throw new RangeError((name || "money") + " must be a non-negative number");
  units = Math.round(number * MONEY_SCALE);
  if (!Number.isSafeInteger(units)) throw new RangeError((name || "money") + " is outside the safe range");
  return units;
}

function unitsToCredits(units) {
  if (!Number.isSafeInteger(units)) throw new RangeError("money units are outside the safe range");
  return Number((units / MONEY_SCALE).toFixed(6));
}

function multiplyRatio(units, numerator, denominator) {
  var value = (BigInt(units) * BigInt(numerator) + BigInt(Math.floor(denominator / 2))) / BigInt(denominator);
  var number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError("calculated money is outside the safe range");
  return number;
}

function safeAdd(left, right, name) {
  var value = left + right;
  if (!Number.isSafeInteger(value)) throw new RangeError((name || "money") + " overflow");
  return value;
}

function hashSeed(text) {
  var buffer = crypto.createHash("sha256").update(String(text)).digest();
  var value = buffer.readUInt32LE(0) || 0x6d2b79f5;
  return value >>> 0;
}

function WorldRandom(seed) {
  this.state = hashSeed(seed);
}

WorldRandom.prototype.next = function () {
  var x = this.state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  this.state = x >>> 0;
  return this.state / 4294967296;
};

WorldRandom.prototype.integer = function (minimum, maximum) {
  return minimum + Math.floor(this.next() * (maximum - minimum + 1));
};

function CasinoError(code, message, statusCode) {
  Error.call(this, message);
  this.name = "CasinoError";
  this.code = code;
  this.message = message;
  this.statusCode = statusCode || 400;
}
CasinoError.prototype = Object.create(Error.prototype);
CasinoError.prototype.constructor = CasinoError;

function makeParty(id, houseUnits) {
  return {
    id: id,
    name: id === "A" ? "Glow Hearts" : "Lucky Bolts",
    casinoId: id === "A" ? "casino_a" : "casino_b",
    houseUnits: houseUnits,
    bankrupt: false,
    stats: {
      playerPaidSpins: 0,
      npcPaidSpins: 0,
      wagersReceivedUnits: 0,
      slotPayoutUnits: 0,
      jackpotContributedUnits: 0,
      npcVisitsCompleted: 0,
      contestsWon: 0
    }
  };
}

function publicParty(party, exact) {
  var status = party.houseUnits <= 0 ? "insolvent" : party.houseUnits < creditsToUnits(500) ? "strained" : "healthy";
  return {
    id: party.id,
    name: party.name,
    casinoId: party.casinoId,
    house: exact ? unitsToCredits(party.houseUnits) : null,
    houseStatus: status,
    bankrupt: party.bankrupt,
    stats: exact ? {
      playerPaidSpins: party.stats.playerPaidSpins,
      npcPaidSpins: party.stats.npcPaidSpins,
      wagersReceived: unitsToCredits(party.stats.wagersReceivedUnits),
      slotPayout: unitsToCredits(party.stats.slotPayoutUnits),
      jackpotContributed: unitsToCredits(party.stats.jackpotContributedUnits),
      npcVisitsCompleted: party.stats.npcVisitsCompleted,
      contestsWon: party.stats.contestsWon
    } : { contestsWon: party.stats.contestsWon }
  };
}

function normalizeCorePlayers(input) {
  return adapter.normalizePlayers((input || []).map(function (player) {
    return {
      seat_id: player.seatId || player.seat_id,
      slot: player.slot,
      display_name: player.displayName || player.display_name,
      type: player.controllerType || player.type,
      adapter_id: player.adapterId || player.adapter_id
    };
  }));
}

function eventVisible(event, partyId, seatId, host) {
  if (host || event.visibility === "public") return true;
  if (event.visibility === "party_a") return partyId === "A";
  if (event.visibility === "party_b") return partyId === "B";
  if (event.visibility === "seat:" + seatId) return true;
  return false;
}

function CasinoSession(options) {
  var resolved = options || {};
  var normalizedPlayers = normalizeCorePlayers(resolved.players || []);
  var roster = adapter.validateRoster(normalizedPlayers, resolved.mode, resolved.allowUneven === true);
  var persistent = resolved.persistentState && resolved.persistentState.schema === "axm.casino-local-state/v1"
    ? clone(resolved.persistentState)
    : {};
  var storySave = persistent.story && typeof persistent.story === "object" ? persistent.story : {};
  var bookLength = typeof resolved.bookLength === "number" ? resolved.bookLength : catalog.constants.tableLength;
  var initialJackpotUnits = Number.isSafeInteger(persistent.jackpotUnits)
    ? persistent.jackpotUnits
    : creditsToUnits(typeof resolved.jackpot === "number" ? resolved.jackpot : 100, "jackpot");
  var initialHouseUnits = creditsToUnits(typeof resolved.house === "number" ? resolved.house : 5000, "house");
  var initialWalletUnits = creditsToUnits(typeof resolved.wallet === "number" ? resolved.wallet : 250, "wallet");
  var self = this;

  if (!roster.ok) throw new CasinoError("INVALID_ROSTER", roster.errors.join("; "));
  if (!catalog.validateCatalog().ok) throw new Error("AXM ten-slot catalog is invalid");
  if (bookLength !== catalog.constants.tableLength && resolved.testOnly !== true) {
    throw new Error("production sessions require the complete 50,000-position AXM Draw Spine");
  }

  this.gameId = GAME_ID;
  this.version = VERSION;
  this.sessionId = String(resolved.sessionId || crypto.randomUUID());
  this.mode = roster.mode;
  this.status = "running";
  this.startedAtMs = Number.isFinite(resolved.startAtMs) ? resolved.startAtMs : Date.now();
  this.nowMs = this.startedAtMs;
  this.endedAtMs = null;
  this.durationMs = Number.isFinite(resolved.durationMs) ? resolved.durationMs : 20 * 60 * 1000;
  this.hostToken = adapter.randomToken(24);
  this.allowUneven = resolved.allowUneven === true;
  this.timings = {
    contestDurationMs: Number(resolved.contestDurationMs || 2 * 60 * 1000),
    contestIntervalMs: Number(resolved.contestIntervalMs || 2 * 60 * 1000),
    claimDurationMs: Number(resolved.claimDurationMs || 5 * 60 * 1000),
    npcSpinMs: Number(resolved.npcSpinMs || 1000),
    baseNpcIntervalMs: Number(resolved.baseNpcIntervalMs || 45 * 1000),
    trafficNpcIntervalMs: Number(resolved.trafficNpcIntervalMs || 30 * 1000),
    initialNpcDelayMs: Number(resolved.initialNpcDelayMs || 10 * 1000)
  };
  this.sessionSeed = String(resolved.seed || drawTools.createSessionSeed());
  this.drawSpine = new drawTools.DrawSpine(this.sessionSeed, catalog.styleIds, { activeLength: bookLength });
  this.styleSpinCounts = catalog.styleIds.reduce(function (counts, styleId) { counts[styleId] = 0; return counts; }, {});
  this.worldRandom = new WorldRandom(resolved.worldSeed || this.sessionId + ":world-v1");
  this.events = [];
  this.nextEventId = 1;
  this.result = null;
  // Free Play is slot-first: every cabinet is available from the first frame.
  // Older story saves keep their money and permanent leases, but no quest or
  // discovery state can gate a cabinet again.
  this.unlockedStyleIds = catalog.styleIds.slice();
  this.machineOpen = true;
  this.jackpotUnits = initialJackpotUnits;
  this.jackpotHeatPaidSpins = Math.max(0, Math.min(HUMAN_JACKPOT_HEAT_PAID_SPINS,
    Number.isSafeInteger(persistent.jackpotHeatPaidSpins) ? persistent.jackpotHeatPaidSpins : 0));
  this.districtReserveUnits = creditsToUnits(typeof resolved.districtReserve === "number" ? resolved.districtReserve : 100000, "district reserve");
  this.npcEnteredUnits = 0;
  this.npcExitedUnits = 0;
  this.npcs = {};
  this.nextNpcId = 1;
  this.parties = {
    A: makeParty("A", this.mode === "backroom_story" && Number.isSafeInteger(storySave.houseUnits) ? storySave.houseUnits : initialHouseUnits)
  };
  if (this.mode === "house_war") this.parties.B = makeParty("B", initialHouseUnits);
  this.partyTokens = {};
  this.abilitySlots = {};
  Object.keys(this.parties).forEach(function (partyId) {
    self.partyTokens[partyId] = adapter.randomToken(20);
    self.abilitySlots[partyId] = {
      partyId: partyId,
      status: "reserved_design_lock",
      charges: 0,
      effect: null
    };
  });
  this.players = {};
  normalizedPlayers.forEach(function (player) {
    self.players[player.seatId] = {
      seatId: player.seatId,
      slot: player.slot,
      partyId: player.partyId,
      displayName: player.displayName,
      controllerType: player.controllerType,
      adapterId: player.adapterId,
      token: adapter.randomToken(20),
      walletUnits: initialWalletUnits,
      location: player.partyId === "A" ? "casino_a" : "casino_b",
      selectedStyleId: "lux-5",
      selectedWagerUnits: creditsToUnits(1),
      freeSpinsRemaining: 0,
      freeContext: null,
      lastSpin: null,
      lastSequence: 0,
      requestCache: new Map(),
      requestOrder: [],
      stats: { paidSpins: 0, freeSpins: 0, wageredUnits: 0, payoutUnits: 0 }
    };
  });
  this.spots = SPOT_NAMES.map(function (name, index) {
    var permanent = Array.isArray(storySave.permanentSpotIds) && storySave.permanentSpotIds.indexOf("spot_" + (index + 1)) >= 0;
    return {
      id: "spot_" + (index + 1),
      name: name,
      claim: permanent ? { partyId: "A", expiresAtMs: null, source: "story_lease" } : null,
      nextNpcAtMs: permanent ? self.nowMs + self.timings.initialNpcDelayMs : null
    };
  });
  this.contest = null;
  this.nextContestAtMs = this.mode === "house_war" ? this.nowMs : null;
  this.nextBaseNpcAtMs = {};
  Object.keys(this.parties).forEach(function (partyId) {
    self.nextBaseNpcAtMs[partyId] = self.nowMs + self.timings.initialNpcDelayMs;
  });
  this.questProgress = null;
  this.initialConservedUnits = this._currentConservedUnits();

  this._emit("session_started", "public", {
    mode: this.mode,
    players: normalizedPlayers.map(function (player) { return player.seatId; }),
    slotStyles: catalog.styleIds.slice(),
    drawSpineRows: bookLength
  });
  if (this.mode === "house_war") this._startContest();
  this._assertInvariants();
}

CasinoSession.prototype._appendEvent = function (type, visibility, data) {
  var event = {
    id: this.nextEventId++,
    atMs: this.nowMs,
    type: type,
    visibility: visibility || "public",
    data: clone(data || {})
  };
  this.events.push(event);
  if (this.events.length > 1200) this.events.splice(0, this.events.length - 1200);
  return event;
};

CasinoSession.prototype._emit = function (type, visibility, data) {
  return this._appendEvent(type, visibility, data);
};

CasinoSession.prototype._currentConservedUnits = function () {
  var total = this.jackpotUnits + this.districtReserveUnits;
  var self = this;
  Object.keys(this.parties || {}).forEach(function (partyId) { total = safeAdd(total, self.parties[partyId].houseUnits, "party total"); });
  Object.keys(this.players || {}).forEach(function (seatId) { total = safeAdd(total, self.players[seatId].walletUnits, "player total"); });
  Object.keys(this.npcs || {}).forEach(function (npcId) { total = safeAdd(total, self.npcs[npcId].walletUnits, "NPC total"); });
  return total;
};

CasinoSession.prototype._assertInvariants = function () {
  var expected = this.initialConservedUnits + this.npcEnteredUnits - this.npcExitedUnits;
  var actual = this._currentConservedUnits();
  var self = this;
  if (!Number.isSafeInteger(actual) || actual !== expected) {
    throw new Error("casino ledger conservation failed: expected " + expected + ", received " + actual);
  }
  if (!this.drawSpine || !Number.isInteger(this.drawSpine.cursor) || this.drawSpine.cursor < 0 || this.drawSpine.cursor > this.drawSpine.activeLength) {
    throw new Error("AXM Draw Spine cursor is invalid");
  }
  if (!Number.isInteger(this.jackpotHeatPaidSpins) || this.jackpotHeatPaidSpins < 0 || this.jackpotHeatPaidSpins > HUMAN_JACKPOT_HEAT_PAID_SPINS) {
    throw new Error("human jackpot heat is invalid");
  }
  Object.keys(this.players).forEach(function (seatId) {
    var player = self.players[seatId];
    if (!catalog.definitionById(player.selectedStyleId)) throw new Error("selected slot style is invalid for " + seatId);
    if (player.freeSpinsRemaining < 0 || (player.freeSpinsRemaining > 0) !== !!player.freeContext) {
      throw new Error("free-spin context is invalid for " + seatId);
    }
    if (player.freeContext && !catalog.definitionById(player.freeContext.styleId)) throw new Error("free-spin style is invalid for " + seatId);
  });
  this.unlockedStyleIds.forEach(function (styleId) {
    if (!catalog.definitionById(styleId)) throw new Error("unlocked slot style is invalid: " + styleId);
  });
  return true;
};

CasinoSession.prototype._partyEquityUnits = function (partyId) {
  var total = this.parties[partyId].houseUnits;
  var self = this;
  Object.keys(this.players).forEach(function (seatId) {
    if (self.players[seatId].partyId === partyId) total = safeAdd(total, self.players[seatId].walletUnits, "party equity");
  });
  return total;
};

CasinoSession.prototype._bankUnits = function (targetId) {
  if (targetId === "contest") return this.districtReserveUnits;
  if (targetId === "casino_a") return this.parties.A.houseUnits;
  if (targetId === "casino_b" && this.parties.B) return this.parties.B.houseUnits;
  throw new CasinoError("INVALID_TARGET", "that casino target does not exist");
};

CasinoSession.prototype._setBankUnits = function (targetId, units) {
  if (!Number.isSafeInteger(units)) throw new RangeError("bank balance is invalid");
  if (targetId === "contest") this.districtReserveUnits = units;
  else if (targetId === "casino_a") this.parties.A.houseUnits = units;
  else if (targetId === "casino_b" && this.parties.B) this.parties.B.houseUnits = units;
  else throw new CasinoError("INVALID_TARGET", "that casino target does not exist");
};

CasinoSession.prototype._targetPartyId = function (targetId) {
  if (targetId === "casino_a") return "A";
  if (targetId === "casino_b") return "B";
  return null;
};

CasinoSession.prototype._isStyleUnlocked = function (styleId) {
  return this.mode === "house_war" || this.unlockedStyleIds.indexOf(styleId) !== -1;
};

CasinoSession.prototype._isStyleDiscoverable = function (styleId) {
  return this._isStyleUnlocked(styleId);
};

CasinoSession.prototype._takeRow = function (styleId) {
  var draw = this.drawSpine.next(styleId);
  var row = catalog.rowAt(styleId, draw.styleRowIndex, draw.styleSeed);
  row.jackpotTicket = draw.jackpotTicket;
  row.humanJackpot = draw.jackpotTicket < catalog.constants.humanJackpotThreshold;
  row.npcJackpot = draw.jackpotTicket < catalog.constants.npcJackpotThreshold;
  this.styleSpinCounts[styleId] += 1;
  return { row: row, draw: draw };
};

CasinoSession.prototype._scoreContest = function (partyId, payoutUnits) {
  if (!this.contest || this.nowMs >= this.contest.endsAtMs || payoutUnits <= 0) return;
  var previous = this.contest.scoresUnits[partyId];
  this.contest.scoresUnits[partyId] = safeAdd(previous, payoutUnits, "contest score");
  if (this.contest.firstScoreAtMs[partyId] === null) this.contest.firstScoreAtMs[partyId] = this.nowMs;
};

CasinoSession.prototype._settleSpin = function (actor, requestedTargetId, requestedWagerUnits, actorKind) {
  var isFree = actor.freeSpinsRemaining > 0;
  var targetId = isFree ? actor.freeContext.targetId : requestedTargetId;
  var wagerUnits = isFree ? actor.freeContext.wagerUnits : requestedWagerUnits;
  var styleId = isFree
    ? actor.freeContext.styleId
    : (targetId === "contest" && this.contest ? this.contest.styleId : actor.selectedStyleId);
  var styleDefinition = catalog.definitionById(styleId);
  var targetPartyId = this._targetPartyId(targetId);
  var contributionBps = actorKind === "npc" ? NPC_JACKPOT_BPS : HUMAN_JACKPOT_BPS;
  var contributionUnits = 0;
  var taken;
  var draw;
  var row;
  var payoutPpm;
  var slotPayoutUnits;
  var jackpotPayoutUnits = 0;
  var jackpotTicketMatched;
  var jackpotEligible;
  var jackpotHit;
  var receipt;

  if (this.status !== "running") throw new CasinoError("SESSION_ENDED", "the casino session has ended", 409);
  if (!Number.isSafeInteger(wagerUnits) || wagerUnits <= 0) throw new CasinoError("INVALID_WAGER", "wager must be positive money units");
  if (targetId === "contest" && (!this.contest || this.nowMs >= this.contest.endsAtMs)) {
    throw new CasinoError("NO_ACTIVE_CONTEST", "the district contest cabinet is closed");
  }
  if (!styleDefinition) throw new CasinoError("UNKNOWN_STYLE", "that slot style does not exist");
  if (targetPartyId && !this._isStyleUnlocked(styleId)) {
    throw new CasinoError("MACHINE_UNAVAILABLE", styleDefinition.name + " is unavailable");
  }

  if (!isFree) {
    if (actor.walletUnits < wagerUnits) throw new CasinoError("INSUFFICIENT_WALLET", "the wallet cannot cover that wager");
    if (this._bankUnits(targetId) <= 0) throw new CasinoError("BANK_INSOLVENT", "that machine cannot accept paid play until its bank is funded");
    actor.walletUnits -= wagerUnits;
    this._setBankUnits(targetId, safeAdd(this._bankUnits(targetId), wagerUnits, "wager receipt"));
    contributionUnits = multiplyRatio(wagerUnits, contributionBps, 10000);
    this._setBankUnits(targetId, this._bankUnits(targetId) - contributionUnits);
    this.jackpotUnits = safeAdd(this.jackpotUnits, contributionUnits, "jackpot contribution");
    if (actorKind !== "npc") {
      var previousHeat = this.jackpotHeatPaidSpins;
      this.jackpotHeatPaidSpins = Math.min(HUMAN_JACKPOT_HEAT_PAID_SPINS, this.jackpotHeatPaidSpins + 1);
      if (previousHeat < HUMAN_JACKPOT_HEAT_PAID_SPINS && this.jackpotHeatPaidSpins === HUMAN_JACKPOT_HEAT_PAID_SPINS) {
        this._emit("jackpot_heat_ready", "public", { requiredPaidSpins: HUMAN_JACKPOT_HEAT_PAID_SPINS });
      }
    }
  }

  taken = this._takeRow(styleId);
  row = taken.row;
  draw = taken.draw;
  payoutPpm = isFree ? row.freePayoutPpm : row.paidPayoutPpm;
  slotPayoutUnits = multiplyRatio(wagerUnits, payoutPpm, catalog.constants.payoutScale);
  this._setBankUnits(targetId, this._bankUnits(targetId) - slotPayoutUnits);
  actor.walletUnits = safeAdd(actor.walletUnits, slotPayoutUnits, "actor payout");

  jackpotTicketMatched = actorKind === "npc" ? row.npcJackpot : row.humanJackpot;
  jackpotEligible = actorKind === "npc" || this.jackpotHeatPaidSpins >= HUMAN_JACKPOT_HEAT_PAID_SPINS;
  jackpotHit = jackpotTicketMatched && jackpotEligible;
  if (jackpotHit && this.jackpotUnits > 0) {
    jackpotPayoutUnits = Math.min(this.jackpotUnits, wagerUnits * JACKPOT_CAP_MULTIPLIER);
    this.jackpotUnits -= jackpotPayoutUnits;
    actor.walletUnits = safeAdd(actor.walletUnits, jackpotPayoutUnits, "jackpot payout");
    if (actorKind !== "npc") this.jackpotHeatPaidSpins = 0;
  }

  if (isFree) {
    actor.freeSpinsRemaining -= 1;
  }
  if (row.freeSpinsAwarded > 0) {
    actor.freeSpinsRemaining += row.freeSpinsAwarded;
    if (!actor.freeContext) actor.freeContext = { targetId: targetId, wagerUnits: wagerUnits, styleId: styleId };
  }
  if (actor.freeSpinsRemaining === 0) actor.freeContext = null;

  if (actor.stats) {
    actor.stats[isFree ? "freeSpins" : "paidSpins"] += 1;
    if (!isFree) actor.stats.wageredUnits = safeAdd(actor.stats.wageredUnits, wagerUnits, "actor wager stats");
    actor.stats.payoutUnits = safeAdd(actor.stats.payoutUnits, slotPayoutUnits + jackpotPayoutUnits, "actor payout stats");
  }
  if (targetPartyId && this.parties[targetPartyId]) {
    var business = this.parties[targetPartyId].stats;
    business[actorKind === "npc" ? "npcPaidSpins" : "playerPaidSpins"] += isFree ? 0 : 1;
    if (!isFree) business.wagersReceivedUnits = safeAdd(business.wagersReceivedUnits, wagerUnits, "business wager stats");
    business.slotPayoutUnits = safeAdd(business.slotPayoutUnits, slotPayoutUnits, "business payout stats");
    business.jackpotContributedUnits = safeAdd(business.jackpotContributedUnits, contributionUnits, "business jackpot stats");
  }
  if (targetId === "contest" && actorKind !== "npc") {
    this._scoreContest(actor.partyId, slotPayoutUnits + jackpotPayoutUnits);
  }

  receipt = {
    rowIndex: row.index,
    drawIndex: draw.drawIndex,
    drawEpoch: draw.epoch,
    drawPosition: draw.position,
    drawTicket: draw.ticketId,
    styleId: styleId,
    styleName: styleDefinition.name,
    styleLayout: styleDefinition.layout,
    actorKind: actorKind,
    seatId: actorKind === "npc" ? null : actor.seatId,
    npcId: actorKind === "npc" ? actor.id : null,
    partyId: actor.partyId || null,
    targetId: targetId,
    targetPartyId: targetPartyId,
    free: isFree,
    wager: unitsToCredits(wagerUnits),
    wagerUnits: wagerUnits,
    grid: Array.isArray(row.grid) ? row.grid.slice() : [],
    presentation: row.presentation ? clone(row.presentation) : null,
    scatterCount: row.scatterCount,
    freeSpinsAwarded: row.freeSpinsAwarded,
    freeSpinsRemaining: actor.freeSpinsRemaining,
    winningLines: (row.winningLines || []).map(function (line) {
      return { row: line.row, symbol: line.symbol, count: line.count, wheelApplied: line.wheelApplied };
    }),
    wins: Array.isArray(row.wins) ? clone(row.wins) : [],
    wheelTriggered: row.wheelTriggered,
    wheelIndex: row.wheelIndex,
    wheelDeltaPercent: row.wheelDeltaBps / 100,
    slotPayout: unitsToCredits(slotPayoutUnits),
    jackpotTicket: row.jackpotTicket,
    jackpotTicketMatched: jackpotTicketMatched,
    jackpotEligible: jackpotEligible,
    jackpotHit: jackpotHit,
    jackpotPayout: unitsToCredits(jackpotPayoutUnits),
    totalPayout: unitsToCredits(slotPayoutUnits + jackpotPayoutUnits),
    jackpotContribution: unitsToCredits(contributionUnits),
    walletAfter: unitsToCredits(actor.walletUnits),
    drawCursorAfter: draw.totalConsumedAfter,
    styleCursorAfter: draw.totalConsumedAfter
  };
  actor.lastSpin = clone(receipt);

  if (actorKind === "npc") {
    this._emit("npc_" + (isFree ? "free" : "paid") + "_spin_settled", "public", {
      npcId: actor.id,
      partyId: targetPartyId,
      targetId: targetId,
      styleId: styleId,
      styleName: styleDefinition.name,
      rowIndex: row.index,
      drawIndex: draw.drawIndex,
      wagerUnits: wagerUnits,
      free: isFree,
      payout: receipt.totalPayout,
      jackpotHit: jackpotHit
    });
  } else {
    this._emit("spin_settled", "public", receipt);
    if (!isFree) {
      this._emit("player_wager_used", "party_" + actor.partyId.toLowerCase(), {
        seatId: actor.seatId,
        styleId: styleId,
        styleName: styleDefinition.name,
        wagerUnits: wagerUnits,
        wager: unitsToCredits(wagerUnits)
      });
    }
  }
  if (row.freeSpinsAwarded > 0) {
    this._emit("free_spins_awarded", actorKind === "npc" ? "public" : "seat:" + actor.seatId, {
      actorId: actorKind === "npc" ? actor.id : actor.seatId,
      styleId: styleId,
      amount: row.freeSpinsAwarded,
      remaining: actor.freeSpinsRemaining
    });
  }
  if (jackpotHit) {
    this._emit("jackpot_hit", "public", {
      actorId: actorKind === "npc" ? actor.id : actor.seatId,
      actorKind: actorKind,
      styleId: styleId,
      styleName: styleDefinition.name,
      wager: unitsToCredits(wagerUnits),
      payout: unitsToCredits(jackpotPayoutUnits),
      cap: unitsToCredits(wagerUnits * JACKPOT_CAP_MULTIPLIER),
      remainingPool: unitsToCredits(this.jackpotUnits)
    });
  }
  if (targetPartyId) this._checkSolvency(targetPartyId);
  this._assertInvariants();
  return receipt;
};

CasinoSession.prototype._checkSolvency = function (partyId) {
  var party = this.parties[partyId];
  if (!party || party.bankrupt || party.houseUnits > 0 || this._partyEquityUnits(partyId) > 0) return;
  party.bankrupt = true;
  this._emit("party_bankrupt", "public", { partyId: partyId });
  if (this.mode === "house_war") this.end("bankruptcy", partyId === "A" ? "B" : "A");
  else this.end("story_bankruptcy", null);
};

CasinoSession.prototype._startContest = function () {
  if (this.mode !== "house_war" || this.status !== "running") return;
  var spot = this.spots[this.worldRandom.integer(0, this.spots.length - 1)];
  var styleId = catalog.styleIds[this.worldRandom.integer(0, catalog.styleIds.length - 1)];
  var styleDefinition = catalog.definitionById(styleId);
  this.contest = {
    id: "contest_" + (this.nextEventId),
    spotId: spot.id,
    styleId: styleId,
    styleName: styleDefinition.name,
    startsAtMs: this.nowMs,
    endsAtMs: this.nowMs + this.timings.contestDurationMs,
    scoresUnits: { A: 0, B: 0 },
    firstScoreAtMs: { A: null, B: null }
  };
  this.nextContestAtMs = this.nowMs + this.timings.contestIntervalMs;
  this._emit("contest_started", "public", {
    contestId: this.contest.id,
    spotId: spot.id,
    spotName: spot.name,
    styleId: styleId,
    styleName: styleDefinition.name,
    endsAtMs: this.contest.endsAtMs
  });
};

CasinoSession.prototype._resolveContest = function () {
  var contest = this.contest;
  var winner = null;
  if (!contest) return;
  if (contest.scoresUnits.A > contest.scoresUnits.B) winner = "A";
  else if (contest.scoresUnits.B > contest.scoresUnits.A) winner = "B";
  else if (contest.scoresUnits.A > 0) {
    winner = contest.firstScoreAtMs.A <= contest.firstScoreAtMs.B ? "A" : "B";
  }
  if (winner) {
    var spot = this.spots.find(function (item) { return item.id === contest.spotId; });
    spot.claim = { partyId: winner, expiresAtMs: this.nowMs + this.timings.claimDurationMs, source: contest.id };
    spot.nextNpcAtMs = this.nowMs + Math.min(5000, this.timings.trafficNpcIntervalMs);
    this.parties[winner].stats.contestsWon += 1;
    this._emit("contest_won", "public", {
      contestId: contest.id,
      spotId: contest.spotId,
      winnerPartyId: winner,
      scoreA: unitsToCredits(contest.scoresUnits.A),
      scoreB: unitsToCredits(contest.scoresUnits.B),
      claimExpiresAtMs: spot.claim.expiresAtMs
    });
  } else {
    this._emit("contest_ended_no_winner", "public", { contestId: contest.id, spotId: contest.spotId });
  }
  this.contest = null;
};

CasinoSession.prototype._npcStyleChoices = function () {
  return this.mode === "house_war" ? catalog.styleIds.slice() : this.unlockedStyleIds.slice();
};

CasinoSession.prototype._chooseNpcStyle = function (previousStyleId) {
  var choices = this._npcStyleChoices();
  if (!choices.length) return null;
  if (choices.length > 1 && previousStyleId) choices = choices.filter(function (styleId) { return styleId !== previousStyleId; });
  return choices[this.worldRandom.integer(0, choices.length - 1)];
};

CasinoSession.prototype._chooseNpcSegmentLength = function (remainingPaidSpins) {
  if (!Number.isInteger(remainingPaidSpins) || remainingPaidSpins < 20 || remainingPaidSpins > 100) {
    throw new RangeError("NPC segment remainder must be from 20 through 100 paid spins");
  }
  if (remainingPaidSpins <= 50) return remainingPaidSpins;
  return this.worldRandom.integer(20, Math.min(50, remainingPaidSpins - 20));
};

CasinoSession.prototype._spawnNpc = function (partyId, source) {
  var activeForParty = Object.keys(this.npcs).filter(function (id) { return this.npcs[id].targetPartyId === partyId; }, this).length;
  var selectedStyleId = this._chooseNpcStyle(null);
  if (!this.parties[partyId] || this.parties[partyId].houseUnits <= 0 || !selectedStyleId || activeForParty >= 4) return null;
  var bankrollCredits = this.worldRandom.integer(14, 200);
  var bankrollUnits = creditsToUnits(bankrollCredits);
  var npc = {
    id: "npc_" + this.nextNpcId++,
    kind: "npc",
    partyId: null,
    targetPartyId: partyId,
    targetId: this.parties[partyId].casinoId,
    selectedStyleId: selectedStyleId,
    source: source || "ambient",
    initialBankrollUnits: bankrollUnits,
    walletUnits: bankrollUnits,
    wagerUnits: Math.floor(bankrollUnits / 100),
    paidSpins: 0,
    freeSpins: 0,
    totalOutcomes: 0,
    freeSpinsRemaining: 0,
    freeContext: null,
    segmentLength: this._chooseNpcSegmentLength(100),
    segmentProgress: 0,
    machineVisit: 1,
    nextSpinAtMs: this.nowMs + this.timings.npcSpinMs,
    stats: null
  };
  this.npcEnteredUnits = safeAdd(this.npcEnteredUnits, bankrollUnits, "NPC entry total");
  this.npcs[npc.id] = npc;
  this._emit("npc_arrived", "public", {
    npcId: npc.id,
    partyId: partyId,
    source: npc.source,
    bankroll: bankrollCredits,
    wager: unitsToCredits(npc.wagerUnits),
    paidSpinPlan: 100,
    segmentLength: npc.segmentLength,
    styleId: npc.selectedStyleId,
    styleName: catalog.definitionById(npc.selectedStyleId).name
  });
  return npc;
};

CasinoSession.prototype._departNpc = function (npc, reason) {
  if (!this.npcs[npc.id]) return;
  this.npcExitedUnits = safeAdd(this.npcExitedUnits, npc.walletUnits, "NPC exit total");
  delete this.npcs[npc.id];
  if (this.parties[npc.targetPartyId] && reason === "completed") this.parties[npc.targetPartyId].stats.npcVisitsCompleted += 1;
  this._emit("npc_visit_completed", "public", {
    npcId: npc.id,
    partyId: npc.targetPartyId,
    reason: reason,
    initialBankroll: unitsToCredits(npc.initialBankrollUnits),
    finalWallet: unitsToCredits(npc.walletUnits),
    paidSpins: npc.paidSpins,
    freeSpins: npc.freeSpins,
    totalOutcomes: npc.totalOutcomes
  });
};

CasinoSession.prototype._advanceNpc = function (npc) {
  if (!this.npcs[npc.id]) return;
  if (this._bankUnits(npc.targetId) <= 0) {
    this._departNpc(npc, "house_insolvent");
    return;
  }
  if (npc.paidSpins >= 100 && npc.freeSpinsRemaining === 0) {
    this._departNpc(npc, "completed");
    return;
  }
  var wasFree = npc.freeSpinsRemaining > 0;
  this._settleSpin(npc, npc.targetId, npc.wagerUnits, "npc");
  npc.totalOutcomes += 1;
  if (wasFree) {
    npc.freeSpins += 1;
  } else {
    npc.paidSpins += 1;
    npc.segmentProgress += 1;
    if (npc.segmentProgress >= npc.segmentLength && npc.paidSpins < 100) {
      var previousStyleId = npc.selectedStyleId;
      npc.machineVisit += 1;
      npc.segmentProgress = 0;
      npc.segmentLength = this._chooseNpcSegmentLength(100 - npc.paidSpins);
      npc.selectedStyleId = this._chooseNpcStyle(previousStyleId) || previousStyleId;
      this._emit("npc_changed_machine", "public", {
        npcId: npc.id,
        partyId: npc.targetPartyId,
        machineVisit: npc.machineVisit,
        nextSegmentLength: npc.segmentLength,
        previousStyleId: previousStyleId,
        styleId: npc.selectedStyleId,
        styleName: catalog.definitionById(npc.selectedStyleId).name
      });
    }
  }
  npc.nextSpinAtMs += this.timings.npcSpinMs;
  if (npc.paidSpins >= 100 && npc.freeSpinsRemaining === 0) this._departNpc(npc, "completed");
};

CasinoSession.prototype._expireClaims = function () {
  var self = this;
  this.spots.forEach(function (spot) {
    if (spot.claim && spot.claim.expiresAtMs !== null && spot.claim.expiresAtMs <= self.nowMs) {
      var expired = spot.claim;
      spot.claim = null;
      spot.nextNpcAtMs = null;
      self._emit("traffic_claim_expired", "public", { spotId: spot.id, partyId: expired.partyId });
    }
  });
};

CasinoSession.prototype.advance = function (deltaMs) {
  var amount = Number(deltaMs);
  var self = this;
  var safety = 0;
  if (this.status !== "running") return this.publicState();
  if (!Number.isFinite(amount) || amount < 0 || amount > 24 * 60 * 60 * 1000) throw new RangeError("advance delta is invalid");
  this.nowMs += amount;
  this._expireClaims();

  if (this.mode === "house_war") {
    if (this.contest && this.nowMs >= this.contest.endsAtMs) this._resolveContest();
    if (!this.contest && this.nowMs >= this.nextContestAtMs) this._startContest();
  }

  Object.keys(this.parties).forEach(function (partyId) {
    while (self.nowMs >= self.nextBaseNpcAtMs[partyId] && safety++ < 2000) {
      self._spawnNpc(partyId, "ambient");
      self.nextBaseNpcAtMs[partyId] += self.timings.baseNpcIntervalMs;
    }
  });
  this.spots.forEach(function (spot) {
    while (spot.claim && spot.nextNpcAtMs !== null && self.nowMs >= spot.nextNpcAtMs && safety++ < 2000) {
      self._spawnNpc(spot.claim.partyId, spot.id);
      spot.nextNpcAtMs += self.timings.trafficNpcIntervalMs;
    }
  });

  while (safety++ < 20000) {
    var due = Object.keys(this.npcs).map(function (id) { return self.npcs[id]; })
      .filter(function (npc) { return npc.nextSpinAtMs <= self.nowMs; })
      .sort(function (left, right) { return left.nextSpinAtMs - right.nextSpinAtMs || left.id.localeCompare(right.id); })[0];
    if (!due || this.status !== "running") break;
    this._advanceNpc(due);
  }
  if (safety >= 20000) throw new Error("casino advance safety limit reached");

  if (this.mode === "house_war" && this.status === "running" && this.nowMs - this.startedAtMs >= this.durationMs) {
    var equityA = this._partyEquityUnits("A");
    var equityB = this._partyEquityUnits("B");
    var winner = equityA === equityB
      ? (this.parties.A.houseUnits === this.parties.B.houseUnits
        ? (this.parties.A.stats.contestsWon === this.parties.B.stats.contestsWon ? null : (this.parties.A.stats.contestsWon > this.parties.B.stats.contestsWon ? "A" : "B"))
        : (this.parties.A.houseUnits > this.parties.B.houseUnits ? "A" : "B"))
      : (equityA > equityB ? "A" : "B");
    this.end("closing_bell", winner);
  }
  this._assertInvariants();
  return this.publicState();
};

CasinoSession.prototype._travel = function (actor, location) {
  var allowed = this.mode === "backroom_story"
    ? ["casino_a"]
    : ["casino_a", "casino_b", "contest"];
  if (allowed.indexOf(location) < 0) throw new CasinoError("INVALID_LOCATION", "that location is unavailable in this mode");
  if (location === "contest" && !this.contest) throw new CasinoError("NO_ACTIVE_CONTEST", "there is no active district contest");
  if (actor.freeSpinsRemaining > 0 && actor.freeContext.targetId !== location) {
    throw new CasinoError("FREE_SPINS_LOCKED", "finish the queued free spins at their triggering machine first");
  }
  actor.location = location;
  this._emit("player_travelled", "public", { seatId: actor.seatId, partyId: actor.partyId, location: location });
  return { location: location };
};

CasinoSession.prototype._selectMachine = function (actor, styleId) {
  var definition = catalog.definitionById(styleId);
  if (!definition) throw new CasinoError("UNKNOWN_STYLE", "that slot style does not exist");
  if (actor.freeSpinsRemaining > 0 && actor.freeContext.styleId !== styleId) {
    throw new CasinoError("FREE_SPINS_LOCKED", "finish the queued free spins on " + catalog.definitionById(actor.freeContext.styleId).name + " first");
  }
  if (actor.location === "contest" && this.contest && this.contest.styleId !== styleId) {
    throw new CasinoError("CONTEST_STYLE_LOCKED", "this contest is running on " + this.contest.styleName);
  }
  if (!this._isStyleDiscoverable(styleId)) throw new CasinoError("MACHINE_UNAVAILABLE", definition.name + " is unavailable");
  actor.selectedStyleId = styleId;
  this._emit("machine_selected", "public", {
    seatId: actor.seatId,
    partyId: actor.partyId,
    styleId: styleId,
    styleName: definition.name,
    unlocked: this._isStyleUnlocked(styleId)
  });
  return { styleId: styleId, styleName: definition.name, unlocked: this._isStyleUnlocked(styleId) };
};

CasinoSession.prototype._fundHouse = function (actor, amountUnits) {
  var party = this.parties[actor.partyId];
  if (!Number.isSafeInteger(amountUnits) || amountUnits <= 0) throw new CasinoError("INVALID_AMOUNT", "fund amount must be positive");
  if (actor.walletUnits < amountUnits) throw new CasinoError("INSUFFICIENT_WALLET", "the wallet cannot fund that amount");
  actor.walletUnits -= amountUnits;
  party.houseUnits = safeAdd(party.houseUnits, amountUnits, "house funding");
  this._emit("house_funded", "party_" + actor.partyId.toLowerCase(), {
    seatId: actor.seatId,
    partyId: actor.partyId,
    amount: unitsToCredits(amountUnits),
    houseAfter: unitsToCredits(party.houseUnits)
  });
  return { wallet: unitsToCredits(actor.walletUnits), house: unitsToCredits(party.houseUnits) };
};

CasinoSession.prototype._withdrawHouse = function (actor, amountUnits) {
  var party = this.parties[actor.partyId];
  if (!Number.isSafeInteger(amountUnits) || amountUnits <= 0) throw new CasinoError("INVALID_AMOUNT", "withdraw amount must be positive");
  if (party.houseUnits < amountUnits) throw new CasinoError("INSUFFICIENT_HOUSE", "the house cannot release that amount");
  party.houseUnits -= amountUnits;
  actor.walletUnits = safeAdd(actor.walletUnits, amountUnits, "house withdrawal");
  this._emit("house_withdrawn", "party_" + actor.partyId.toLowerCase(), {
    seatId: actor.seatId,
    partyId: actor.partyId,
    amount: unitsToCredits(amountUnits),
    houseAfter: unitsToCredits(party.houseUnits)
  });
  return { wallet: unitsToCredits(actor.walletUnits), house: unitsToCredits(party.houseUnits) };
};

CasinoSession.prototype._applyCommand = function (actor, command) {
  var type = String(command && command.type || "");
  var amountUnits;
  var wager;
  if (type === "travel") return this._travel(actor, String(command.location || command.targetId || ""));
  if (type === "select_machine") return this._selectMachine(actor, String(command.styleId || ""));
  if (type === "set_wager") {
    wager = Number(command.wager);
    if (HUMAN_WAGERS.indexOf(wager) < 0) throw new CasinoError("INVALID_WAGER", "human wager must be 1, 2, 5, or 10 credits");
    actor.selectedWagerUnits = creditsToUnits(wager);
    return { wager: wager };
  }
  if (type === "spin") {
    wager = typeof command.wager === "undefined" ? unitsToCredits(actor.selectedWagerUnits) : Number(command.wager);
    if (actor.freeSpinsRemaining === 0 && HUMAN_WAGERS.indexOf(wager) < 0) {
      throw new CasinoError("INVALID_WAGER", "human wager must be 1, 2, 5, or 10 credits");
    }
    if (actor.freeSpinsRemaining === 0) actor.selectedWagerUnits = creditsToUnits(wager);
    return this._settleSpin(actor, actor.location, actor.selectedWagerUnits, "player");
  }
  if (type === "fund_house") {
    amountUnits = creditsToUnits(Number(command.amount), "fund amount");
    return this._fundHouse(actor, amountUnits);
  }
  if (type === "withdraw_house") {
    amountUnits = creditsToUnits(Number(command.amount), "withdraw amount");
    return this._withdrawHouse(actor, amountUnits);
  }
  if (["interact", "close_opening_shift", "claim_story_lease"].indexOf(type) !== -1) {
    throw new CasinoError("QUESTS_REMOVED", "Quest actions were removed. Choose any cabinet and spin.");
  }
  throw new CasinoError("UNKNOWN_COMMAND", "unsupported casino command: " + type);
};

CasinoSession.prototype.command = function (packet) {
  var actor = this.players[String(packet && packet.seatId || "")];
  var requestId = String(packet && packet.requestId || "");
  var sequence = Number(packet && packet.sequence);
  var fingerprint;
  var cached;
  var result;
  if (!actor) throw new CasinoError("SEAT_NOT_ACTIVE", "that seat is not active", 404);
  if (!this.tokensEqual(packet.token, actor.token)) throw new CasinoError("SEAT_TOKEN_REJECTED", "seat token rejected", 403);
  if (!requestId || requestId.length > 120) throw new CasinoError("INVALID_REQUEST_ID", "a bounded request id is required");
  fingerprint = JSON.stringify(packet.command || {});
  cached = actor.requestCache.get(requestId);
  if (cached) {
    if (cached.fingerprint !== fingerprint) throw new CasinoError("REQUEST_ID_REUSED", "request id was reused with different input", 409);
    return clone(cached.result);
  }
  if (!Number.isInteger(sequence) || sequence <= actor.lastSequence) {
    throw new CasinoError("STALE_SEQUENCE", "input sequence must increase", 409);
  }
  result = this._applyCommand(actor, packet.command || {});
  actor.lastSequence = sequence;
  var response = { ok: true, acceptedSequence: sequence, result: clone(result) };
  actor.requestCache.set(requestId, { fingerprint: fingerprint, result: response });
  actor.requestOrder.push(requestId);
  while (actor.requestOrder.length > 100) actor.requestCache.delete(actor.requestOrder.shift());
  this._assertInvariants();
  return clone(response);
};

CasinoSession.prototype.tokensEqual = function (supplied, expected) {
  if (typeof supplied !== "string" || typeof expected !== "string") return false;
  var left = Buffer.from(supplied);
  var right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

CasinoSession.prototype.assertHost = function (token) {
  if (!this.tokensEqual(token, this.hostToken)) throw new CasinoError("HOST_TOKEN_REJECTED", "host token rejected", 403);
  return true;
};

CasinoSession.prototype._publicContest = function () {
  if (!this.contest) return null;
  var spot = this.spots.find(function (item) { return item.id === this.contest.spotId; }, this);
  return {
    id: this.contest.id,
    spotId: this.contest.spotId,
    spotName: spot ? spot.name : this.contest.spotId,
    styleId: this.contest.styleId,
    styleName: this.contest.styleName,
    startsAtMs: this.contest.startsAtMs,
    endsAtMs: this.contest.endsAtMs,
    remainingMs: Math.max(0, this.contest.endsAtMs - this.nowMs),
    scores: { A: unitsToCredits(this.contest.scoresUnits.A), B: unitsToCredits(this.contest.scoresUnits.B) }
  };
};

CasinoSession.prototype._baseObservation = function (partyId, seatId, host) {
  var self = this;
  var own = seatId ? this.players[seatId] : null;
  var drawState = this.drawSpine.publicState();
  var styleStates = catalog.publicStyles(catalog.styleIds, null);
  return {
    ok: true,
    gameId: this.gameId,
    version: this.version,
    sessionId: this.sessionId,
    mode: this.mode,
    status: this.status,
    nowMs: this.nowMs,
    startedAtMs: this.startedAtMs,
    endsAtMs: this.mode === "house_war" ? this.startedAtMs + this.durationMs : null,
    remainingMs: this.mode === "house_war" ? Math.max(0, this.startedAtMs + this.durationMs - this.nowMs) : null,
    jackpot: unitsToCredits(this.jackpotUnits),
    jackpotHeat: {
      current: this.jackpotHeatPaidSpins,
      required: HUMAN_JACKPOT_HEAT_PAID_SPINS,
      ready: this.jackpotHeatPaidSpins >= HUMAN_JACKPOT_HEAT_PAID_SPINS
    },
    machineOpen: this.machineOpen,
    style: drawState,
    drawSpine: drawState,
    styles: styleStates,
    parties: Object.keys(this.parties).map(function (id) { return publicParty(self.parties[id], host || id === partyId); }),
    players: Object.keys(this.players).map(function (id) {
      var player = self.players[id];
      var exact = host || player.seatId === seatId || player.partyId === partyId;
      return {
        seatId: player.seatId,
        slot: player.slot,
        displayName: player.displayName,
        partyId: player.partyId,
        controllerType: player.controllerType,
        location: player.location,
        selectedStyleId: exact ? player.selectedStyleId : null,
        wallet: exact ? unitsToCredits(player.walletUnits) : null,
        freeSpinsRemaining: exact ? player.freeSpinsRemaining : null,
        selectedWager: exact ? unitsToCredits(player.selectedWagerUnits) : null
      };
    }),
    ownPlayer: own ? {
      seatId: own.seatId,
      displayName: own.displayName,
      partyId: own.partyId,
      wallet: unitsToCredits(own.walletUnits),
      location: own.location,
      selectedStyleId: own.selectedStyleId,
      activeStyleId: own.location === "contest" && this.contest ? this.contest.styleId : (own.freeContext ? own.freeContext.styleId : own.selectedStyleId),
      selectedWager: unitsToCredits(own.selectedWagerUnits),
      freeSpinsRemaining: own.freeSpinsRemaining,
      lastSpin: own.lastSpin ? clone(own.lastSpin) : null,
      acceptedSequence: own.lastSequence,
      stats: {
        paidSpins: own.stats.paidSpins,
        freeSpins: own.stats.freeSpins,
        wagered: unitsToCredits(own.stats.wageredUnits),
        payout: unitsToCredits(own.stats.payoutUnits)
      }
    } : null,
    spots: this.spots.map(function (spot) {
      return {
        id: spot.id,
        name: spot.name,
        claim: spot.claim ? {
          partyId: spot.claim.partyId,
          expiresAtMs: spot.claim.expiresAtMs,
          remainingMs: spot.claim.expiresAtMs === null ? null : Math.max(0, spot.claim.expiresAtMs - self.nowMs)
        } : null
      };
    }),
    contest: this._publicContest(),
    activeNpcCounts: Object.keys(this.parties).reduce(function (counts, id) {
      counts[id] = Object.keys(self.npcs).filter(function (npcId) { return self.npcs[npcId].targetPartyId === id; }).length;
      return counts;
    }, {}),
    abilitySlots: Object.keys(this.abilitySlots).map(function (id) { return clone(self.abilitySlots[id]); }),
    quest: null,
    events: this.events.filter(function (event) { return eventVisible(event, partyId, seatId, host); }).slice(-80).map(clone),
    result: this.result ? clone(this.result) : null
  };
};

CasinoSession.prototype.observePlayer = function (seatId, token) {
  var player = this.players[seatId];
  if (!player) throw new CasinoError("SEAT_NOT_ACTIVE", "that seat is not active", 404);
  if (!this.tokensEqual(token, player.token)) throw new CasinoError("SEAT_TOKEN_REJECTED", "seat token rejected", 403);
  return this._baseObservation(player.partyId, player.seatId, false);
};

CasinoSession.prototype.observeParty = function (partyId, token) {
  if (!this.parties[partyId]) throw new CasinoError("PARTY_NOT_ACTIVE", "that party is not active", 404);
  if (!this.tokensEqual(token, this.partyTokens[partyId])) throw new CasinoError("PARTY_TOKEN_REJECTED", "party display token rejected", 403);
  return this._baseObservation(partyId, null, false);
};

CasinoSession.prototype.observeHost = function (token) {
  this.assertHost(token);
  var state = this._baseObservation(null, null, true);
  state.diagnostics = {
    districtReserve: unitsToCredits(this.districtReserveUnits),
    conserved: unitsToCredits(this._currentConservedUnits()),
    npcEntered: unitsToCredits(this.npcEnteredUnits),
    npcExited: unitsToCredits(this.npcExitedUnits),
    styleSpinCounts: clone(this.styleSpinCounts)
  };
  return state;
};

CasinoSession.prototype.publicState = function () {
  return {
    ok: true,
    game_id: this.gameId,
    version: this.version,
    session_id: this.sessionId,
    phase: this.status,
    mode: this.mode,
    players: Object.keys(this.players).map(function (seatId) {
      var player = this.players[seatId];
      return { seat_id: player.seatId, slot: player.slot, display_name: player.displayName, party_id: player.partyId, type: player.controllerType };
    }, this),
    result_summary: this.result ? clone(this.result) : null,
    local_only: true,
    outside_network_required: false
  };
};

CasinoSession.prototype.launchInfo = function (token, baseUrl) {
  this.assertHost(token);
  var base = String(baseUrl || "").replace(/\/$/, "");
  return {
    sessionId: this.sessionId,
    mode: this.mode,
    hostToken: this.hostToken,
    partyScreens: Object.keys(this.parties).map(function (partyId) {
      return {
        partyId: partyId,
        url: base + "/?role=party&party=" + encodeURIComponent(partyId) + "&token=" + encodeURIComponent(this.partyTokens[partyId])
      };
    }, this),
    controllers: Object.keys(this.players).map(function (seatId) {
      var player = this.players[seatId];
      return {
        seatId: seatId,
        slot: player.slot,
        displayName: player.displayName,
        partyId: player.partyId,
        url: base + "/?role=controller&seat=" + encodeURIComponent(seatId) + "&token=" + encodeURIComponent(player.token)
      };
    }, this)
  };
};

CasinoSession.prototype.end = function (reason, winnerPartyId) {
  if (this.status === "ended") return clone(this.result);
  this.status = "ended";
  this.endedAtMs = this.nowMs;
  this.result = {
    game_id: this.gameId,
    session_id: this.sessionId,
    status: "ended",
    mode: this.mode,
    reason: reason,
    outcome: this.mode === "backroom_story"
      ? (reason === "story_bankruptcy" ? "lost" : "session-ended")
      : (winnerPartyId ? "party-win" : "draw"),
    winner_party_id: winnerPartyId || null,
    duration_ms: this.endedAtMs - this.startedAtMs,
    style_rows_consumed: this.drawSpine.totalConsumed,
    draw_spine_epoch: this.drawSpine.epoch,
    style_spin_counts: clone(this.styleSpinCounts),
    jackpot_remaining: unitsToCredits(this.jackpotUnits),
    parties: Object.keys(this.parties).map(function (id) {
      return {
        party_id: id,
        house: unitsToCredits(this.parties[id].houseUnits),
        equity: unitsToCredits(this._partyEquityUnits(id)),
        contests_won: this.parties[id].stats.contestsWon
      };
    }, this),
    players: Object.keys(this.players).map(function (id) {
      var player = this.players[id];
      return { seat_id: id, display_name: player.displayName, party_id: player.partyId, wallet: unitsToCredits(player.walletUnits) };
    }, this),
    recorded_at: new Date(this.endedAtMs).toISOString(),
    notes: ["Server-derived from the authoritative casino ledger.", "No client supplied an outcome or balance."]
  };
  this._appendEvent("session_ended", "public", { reason: reason, winnerPartyId: winnerPartyId || null });
  return clone(this.result);
};

CasinoSession.prototype.exportPersistentState = function () {
  var permanent = this.spots.filter(function (spot) { return spot.claim && spot.claim.expiresAtMs === null; }).map(function (spot) { return spot.id; });
  return {
    schema: "axm.casino-local-state/v1",
    version: 1,
    jackpotUnits: this.jackpotUnits,
    jackpotHeatPaidSpins: this.jackpotHeatPaidSpins,
    story: this.mode === "backroom_story" ? {
      houseUnits: this.parties.A.houseUnits,
      machineOpen: true,
      unlockedStyleIds: catalog.styleIds.slice(),
      permanentSpotIds: permanent
    } : null,
    updatedAt: new Date(this.nowMs).toISOString()
  };
};

module.exports = Object.freeze({
  CasinoError: CasinoError,
  CasinoSession: CasinoSession,
  GAME_ID: GAME_ID,
  VERSION: VERSION,
  constants: Object.freeze({
    moneyScale: MONEY_SCALE,
    humanJackpotContributionBps: HUMAN_JACKPOT_BPS,
    npcJackpotContributionBps: NPC_JACKPOT_BPS,
    jackpotCapMultiplier: JACKPOT_CAP_MULTIPLIER,
    humanJackpotHeatPaidSpins: HUMAN_JACKPOT_HEAT_PAID_SPINS,
    humanWagers: HUMAN_WAGERS.slice()
  }),
  creditsToUnits: creditsToUnits,
  unitsToCredits: unitsToCredits
});
