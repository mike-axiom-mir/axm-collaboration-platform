"use strict";

// Economy boundary for the prototype. LUX-5 math never receives these balances.

var MONEY_SCALE = 1000000;

function assertSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(label + " must be a safe integer");
  }
}

function creditsToUnits(credits, label) {
  if (typeof credits !== "number" || !Number.isFinite(credits) || credits < 0) {
    throw new TypeError(label + " must be a non-negative number");
  }

  var units = Math.round(credits * MONEY_SCALE);
  assertSafeInteger(units, label + " units");
  return units;
}

function unitsToCredits(units) {
  assertSafeInteger(units, "money units");
  return Number((units / MONEY_SCALE).toFixed(6));
}

function cloneBalances(balances) {
  return {
    wallet: unitsToCredits(balances.wallet),
    house: unitsToCredits(balances.house),
    jackpot: unitsToCredits(balances.jackpot)
  };
}

function Ledger(options) {
  var resolved = options || {};

  this._balances = {
    wallet: creditsToUnits(
      typeof resolved.wallet === "number" ? resolved.wallet : 250,
      "wallet"
    ),
    house: creditsToUnits(
      typeof resolved.house === "number" ? resolved.house : 5000,
      "house"
    ),
    jackpot: creditsToUnits(
      typeof resolved.jackpot === "number" ? resolved.jackpot : 100,
      "jackpot"
    )
  };
  this._initialTotal =
    this._balances.wallet + this._balances.house + this._balances.jackpot;
  this._sequence = 0;
  this._entries = [];
}

Ledger.prototype.balanceUnits = function (account) {
  if (!Object.prototype.hasOwnProperty.call(this._balances, account)) {
    throw new RangeError("unknown ledger account: " + account);
  }
  return this._balances[account];
};

Ledger.prototype.balances = function () {
  return cloneBalances(this._balances);
};

Ledger.prototype.totalUnits = function () {
  return this._balances.wallet + this._balances.house + this._balances.jackpot;
};

Ledger.prototype.entryCount = function () {
  return this._entries.length;
};

Ledger.prototype.entriesSince = function (entryCount) {
  if (!Number.isInteger(entryCount) || entryCount < 0 || entryCount > this._entries.length) {
    throw new RangeError("entryCount is outside the ledger");
  }
  return this._entries.slice(entryCount).map(function (entry) {
    return Object.assign({}, entry, {
      balances: Object.assign({}, entry.balances)
    });
  });
};

Ledger.prototype.transferUnits = function (type, from, to, amountUnits, metadata) {
  if (typeof type !== "string" || type.length === 0) {
    throw new TypeError("ledger entry type is required");
  }
  if (!Object.prototype.hasOwnProperty.call(this._balances, from)) {
    throw new RangeError("unknown source ledger account: " + from);
  }
  if (!Object.prototype.hasOwnProperty.call(this._balances, to)) {
    throw new RangeError("unknown destination ledger account: " + to);
  }
  if (from === to) {
    throw new RangeError("ledger transfer accounts must differ");
  }
  assertSafeInteger(amountUnits, "transfer amount");
  if (amountUnits < 0) {
    throw new RangeError("ledger transfer amount cannot be negative");
  }

  this._balances[from] -= amountUnits;
  this._balances[to] += amountUnits;
  this._sequence += 1;

  var entry = Object.freeze({
    sequence: this._sequence,
    type: type,
    from: from,
    to: to,
    amount: unitsToCredits(amountUnits),
    metadata: metadata ? Object.assign({}, metadata) : {},
    balances: cloneBalances(this._balances)
  });
  this._entries.push(entry);
  return entry;
};

Ledger.prototype.assertConserved = function () {
  var total = this.totalUnits();
  if (total !== this._initialTotal) {
    throw new Error(
      "ledger conservation failed: expected " +
        this._initialTotal +
        " units but found " +
        total
    );
  }
  return true;
};

module.exports = Object.freeze({
  Ledger: Ledger,
  moneyScale: MONEY_SCALE,
  creditsToUnits: creditsToUnits,
  unitsToCredits: unitsToCredits
});
