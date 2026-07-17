"use strict";

// One authoritative LUX-5 style session. Every cabinet would call this same
// object, so all copies consume one shared 50,000-row cursor.

var crypto = require("crypto");
var path = require("path");
var ledgerTools = require("./ledger.js");
var luxRoot = path.resolve(__dirname, "../../slots/lux-5");
var model = require(path.join(luxRoot, "lux5-model.js"));
var rng = require(path.join(luxRoot, "lux5-rng.js"));
var bookTools = require(path.join(luxRoot, "lux5-outcome-book.js"));

var WAGER_OPTIONS = Object.freeze([1, 2, 5, 10]);
var JACKPOT_CONTRIBUTION_BPS = 500;
var JACKPOT_CAP_MULTIPLIER = 100;

function safeSessionId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

function includesWager(value) {
  return WAGER_OPTIONS.indexOf(value) !== -1;
}

function moneyFromPpm(wagerCredits, payoutPpm) {
  // wagerCredits * payoutPpm is exactly the microcredit settlement because
  // both the payout and money scales are one million.
  var amount = wagerCredits * payoutPpm;
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError("calculated payout is outside safe money range");
  }
  return amount;
}

function publicLine(line) {
  return {
    row: line.row,
    symbol: line.symbol,
    count: line.count,
    payoutX: Number((line.linePayoutPpm / model.constants.payoutScale).toFixed(6)),
    wheelApplied: line.wheelApplied
  };
}

function freshStats() {
  return {
    spins: 0,
    paidSpins: 0,
    freeSpins: 0,
    totalWageredUnits: 0,
    totalSlotPaidUnits: 0,
    jackpotHits: 0,
    totalJackpotPaidUnits: 0,
    wheelTriggers: 0,
    scatterTriggers: 0,
    freeSpinsAwarded: 0,
    biggestTotalWinUnits: 0
  };
}

function SessionError(code, message, statusCode) {
  Error.call(this, message);
  this.name = "SessionError";
  this.code = code;
  this.message = message;
  this.statusCode = statusCode || 400;
}
SessionError.prototype = Object.create(Error.prototype);
SessionError.prototype.constructor = SessionError;

function Lux5Session(options) {
  var resolved = options || {};
  var validation = model.validateModel();

  if (!validation.ok) {
    throw new Error("LUX-5 model validation failed: " + validation.errors.join("; "));
  }

  this.sessionId = safeSessionId();
  this._seed = resolved.seed || rng.createSessionSeed();
  this._tableLength = resolved.testOnlyBookLength || model.constants.tableLength;
  if (
    this._tableLength !== model.constants.tableLength &&
    resolved.testOnlyBookLength === undefined
  ) {
    throw new Error("production LUX-5 sessions must contain exactly 50,000 outcomes");
  }
  // Runtime and math workbench intentionally use the one canonical generator.
  // A style seed therefore always identifies the exact same immutable book.
  this._book = rng.buildBook(this._seed, this._tableLength);
  this._cursor = 0;
  this._ledger = new ledgerTools.Ledger({
    wallet: typeof resolved.wallet === "number" ? resolved.wallet : 250,
    house: typeof resolved.house === "number" ? resolved.house : 5000,
    jackpot: typeof resolved.jackpot === "number" ? resolved.jackpot : 100
  });
  this._freeSpinsRemaining = 0;
  this._lockedFreeWager = null;
  this._stats = freshStats();
  this._lastSpin = null;
  this._seenRequestIds = new Set();
  this._requestIdOrder = [];
}

Lux5Session.prototype._publicStats = function () {
  return {
    spins: this._stats.spins,
    paidSpins: this._stats.paidSpins,
    freeSpins: this._stats.freeSpins,
    totalWagered: ledgerTools.unitsToCredits(this._stats.totalWageredUnits),
    totalSlotPaid: ledgerTools.unitsToCredits(this._stats.totalSlotPaidUnits),
    jackpotHits: this._stats.jackpotHits,
    totalJackpotPaid: ledgerTools.unitsToCredits(
      this._stats.totalJackpotPaidUnits
    ),
    wheelTriggers: this._stats.wheelTriggers,
    scatterTriggers: this._stats.scatterTriggers,
    freeSpinsAwarded: this._stats.freeSpinsAwarded,
    biggestTotalWin: ledgerTools.unitsToCredits(
      this._stats.biggestTotalWinUnits
    )
  };
};

Lux5Session.prototype.state = function () {
  var balances = this._ledger.balances();
  var exhausted = this._cursor >= this._tableLength;
  var canUseFree = this._freeSpinsRemaining > 0 && !exhausted;
  var canUsePaid =
    !exhausted &&
    this._freeSpinsRemaining === 0 &&
    balances.wallet >= WAGER_OPTIONS[0] &&
    balances.house > 0;
  var blockReason = null;

  if (exhausted) {
    blockReason = "OUTCOME_BOOK_EXHAUSTED";
  } else if (this._freeSpinsRemaining > 0) {
    blockReason = null;
  } else if (balances.house <= 0) {
    blockReason = "HOUSE_BANKRUPT";
  } else if (balances.wallet < WAGER_OPTIONS[0]) {
    blockReason = "WALLET_BANKRUPT";
  }

  return {
    schema: "lux5-prototype-state",
    version: 1,
    sessionId: this.sessionId,
    styleId: model.constants.styleId,
    mathVersion: model.constants.mathVersion,
    tableLength: this._tableLength,
    cursor: this._cursor,
    remaining: this._tableLength - this._cursor,
    wagerOptions: WAGER_OPTIONS.slice(),
    balances: balances,
    freeSpins: {
      remaining: this._freeSpinsRemaining,
      lockedWager: this._lockedFreeWager
    },
    bankruptcy: {
      wallet: balances.wallet < WAGER_OPTIONS[0],
      house: balances.house <= 0
    },
    stats: this._publicStats(),
    lastSpin: this._lastSpin,
    canSpin: canUseFree || canUsePaid,
    blockReason: blockReason
  };
};

Lux5Session.prototype.spin = function (requestedWager, requestId) {
  var isFree = this._freeSpinsRemaining > 0;
  var wager;
  var wagerUnits;
  var entryStart;
  var row;
  var payoutPpm;
  var slotPayoutUnits;
  var contributionUnits = 0;
  var jackpotCapUnits;
  var jackpotPayoutUnits = 0;
  var spin;

  if (requestId !== undefined && requestId !== null) {
    if (
      typeof requestId !== "string" ||
      requestId.length < 1 ||
      requestId.length > 128
    ) {
      throw new SessionError(
        "INVALID_REQUEST_ID",
        "requestId must be a non-empty string of at most 128 characters.",
        400
      );
    }
    if (this._seenRequestIds.has(requestId)) {
      throw new SessionError(
        "DUPLICATE_SPIN",
        "That spin request was already consumed; the cursor was not advanced again.",
        409
      );
    }
  }

  if (this._cursor >= this._tableLength) {
    throw new SessionError(
      "OUTCOME_BOOK_EXHAUSTED",
      "The 50,000-outcome LUX-5 book is exhausted; reset for a fresh session.",
      409
    );
  }

  if (isFree) {
    wager = this._lockedFreeWager;
    if (!includesWager(wager)) {
      throw new Error("free-spin queue has no valid locked wager");
    }
  } else {
    wager = requestedWager;
    if (!includesWager(wager)) {
      throw new SessionError(
        "INVALID_WAGER",
        "Wager must be exactly 1, 2, 5, or 10 credits.",
        400
      );
    }
    wagerUnits = ledgerTools.creditsToUnits(wager, "wager");
    if (this._ledger.balanceUnits("wallet") < wagerUnits) {
      throw new SessionError(
        "INSUFFICIENT_WALLET",
        "The player cannot afford that wager.",
        409
      );
    }
    if (this._ledger.balanceUnits("house") <= 0) {
      throw new SessionError(
        "HOUSE_BANKRUPT",
        "The house is bankrupt and cannot accept another paid spin.",
        409
      );
    }
  }

  wagerUnits = ledgerTools.creditsToUnits(wager, "wager");
  entryStart = this._ledger.entryCount();
  row = bookTools.rowAt(this._book, this._cursor);
  payoutPpm = isFree ? row.freePayoutPpm : row.paidPayoutPpm;
  slotPayoutUnits = moneyFromPpm(wager, payoutPpm);

  if (!isFree) {
    contributionUnits = Math.round(
      (wagerUnits * JACKPOT_CONTRIBUTION_BPS) / 10000
    );
    this._ledger.transferUnits("paid-wager", "wallet", "house", wagerUnits, {
      spinIndex: this._cursor
    });
    this._ledger.transferUnits(
      "jackpot-contribution",
      "house",
      "jackpot",
      contributionUnits,
      { spinIndex: this._cursor }
    );
  }

  if (slotPayoutUnits > 0) {
    // A resolved win is an obligation. It is paid even when that drives the
    // house below zero; the negative balance is explicit bankruptcy debt and
    // the next paid spin is blocked. The runtime never clips a fair outcome.
    this._ledger.transferUnits(
      isFree ? "free-spin-payout" : "paid-spin-payout",
      "house",
      "wallet",
      slotPayoutUnits,
      { spinIndex: this._cursor }
    );
  }

  jackpotCapUnits = wagerUnits * JACKPOT_CAP_MULTIPLIER;
  if (!Number.isSafeInteger(jackpotCapUnits)) {
    throw new RangeError("jackpot cap is outside safe money range");
  }
  if (row.humanJackpot) {
    jackpotPayoutUnits = Math.min(
      this._ledger.balanceUnits("jackpot"),
      jackpotCapUnits
    );
    if (jackpotPayoutUnits > 0) {
      this._ledger.transferUnits(
        "jackpot-payout",
        "jackpot",
        "wallet",
        jackpotPayoutUnits,
        { spinIndex: this._cursor, mode: isFree ? "free" : "paid" }
      );
    }
  }

  if (isFree) {
    this._freeSpinsRemaining -= 1;
  }
  this._freeSpinsRemaining += row.freeSpinsAwarded;
  if (!isFree && row.freeSpinsAwarded > 0) {
    this._lockedFreeWager = wager;
  }
  if (this._freeSpinsRemaining === 0) {
    this._lockedFreeWager = null;
  }

  this._stats.spins += 1;
  this._stats.paidSpins += isFree ? 0 : 1;
  this._stats.freeSpins += isFree ? 1 : 0;
  this._stats.totalWageredUnits += isFree ? 0 : wagerUnits;
  this._stats.totalSlotPaidUnits += slotPayoutUnits;
  this._stats.jackpotHits += row.humanJackpot ? 1 : 0;
  this._stats.totalJackpotPaidUnits += jackpotPayoutUnits;
  this._stats.wheelTriggers += row.wheelTriggered ? 1 : 0;
  this._stats.scatterTriggers += row.freeSpinsAwarded > 0 ? 1 : 0;
  this._stats.freeSpinsAwarded += row.freeSpinsAwarded;
  this._stats.biggestTotalWinUnits = Math.max(
    this._stats.biggestTotalWinUnits,
    slotPayoutUnits + jackpotPayoutUnits
  );

  spin = {
    schema: "lux5-prototype-spin",
    version: 1,
    requestId: requestId || null,
    index: this._cursor,
    mode: isFree ? "free" : "paid",
    wager: wager,
    grid: row.grid.slice(),
    scatterCount: row.scatterCount,
    freeSpinsAwarded: row.freeSpinsAwarded,
    winningLines: row.winningLines.map(publicLine),
    wheel: {
      triggered: row.wheelTriggered,
      index: row.wheelTriggered ? row.wheelIndex : null,
      deltaBps: row.wheelTriggered ? row.wheelDeltaBps : null
    },
    overdriveMultiplier: isFree ? 1.5 : 1,
    slotPayout: ledgerTools.unitsToCredits(slotPayoutUnits),
    jackpot: {
      ticket: row.jackpotTicket,
      hit: row.humanJackpot,
      payout: ledgerTools.unitsToCredits(jackpotPayoutUnits),
      cap: ledgerTools.unitsToCredits(jackpotCapUnits)
    },
    totalPayout: ledgerTools.unitsToCredits(
      slotPayoutUnits + jackpotPayoutUnits
    ),
    jackpotContribution: ledgerTools.unitsToCredits(contributionUnits),
    freeSpinsRemaining: this._freeSpinsRemaining,
    sourceRow: {
      stops: row.stops.slice(),
      wheelIndex: row.wheelIndex,
      jackpotTicket: row.jackpotTicket
    },
    ledgerEntries: this._ledger.entriesSince(entryStart)
  };

  this._cursor += 1;
  this._lastSpin = spin;
  if (requestId) {
    this._seenRequestIds.add(requestId);
    this._requestIdOrder.push(requestId);
    if (this._requestIdOrder.length > 2048) {
      this._seenRequestIds.delete(this._requestIdOrder.shift());
    }
  }
  this._ledger.assertConserved();
  return spin;
};

Lux5Session.prototype.debug = function () {
  return {
    seed: this._seed,
    ledgerTotalUnits: this._ledger.totalUnits(),
    ledgerEntries: this._ledger.entryCount()
  };
};

module.exports = Object.freeze({
  Lux5Session: Lux5Session,
  SessionError: SessionError,
  wagerOptions: WAGER_OPTIONS,
  jackpotContributionBps: JACKPOT_CONTRIBUTION_BPS,
  jackpotCapMultiplier: JACKPOT_CAP_MULTIPLIER
});
