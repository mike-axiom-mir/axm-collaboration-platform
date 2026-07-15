"use strict";

// Dependency-free unit and golden-vector checks for the LUX-5 math core.

var model = require("./lux5-model.js");
var rng = require("./lux5-rng.js");
var bookTools = require("./lux5-outcome-book.js");

var passed = 0;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function equal(actual, expected, message) {
  if (actual !== expected) {
    fail(
      message +
        "\nExpected: " +
        JSON.stringify(expected) +
        "\nActual:   " +
        JSON.stringify(actual)
    );
  }
}

function deepEqual(actual, expected, message) {
  equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

function near(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    fail(
      message +
        "\nExpected near: " +
        expected +
        "\nActual:        " +
        actual +
        "\nTolerance:     " +
        tolerance
    );
  }
}

function throws(callback, message) {
  var thrown = null;
  try {
    callback();
  } catch (error) {
    thrown = error;
  }
  assert(thrown, message);
}

function test(name, callback) {
  callback();
  passed += 1;
  console.log("ok " + passed + " - " + name);
}

test("freezes a valid five-reel LUX-5 model", function () {
  var validation = model.validateModel();
  equal(validation.ok, true, validation.errors.join("; "));
  equal(model.reelStrips.length, 5, "there must be five reels");
  model.reelStrips.forEach(function (strip) {
    equal(strip.length, 83, "every virtual reel must have 83 stops");
  });
});

test("targets 96 percent to the displayed analytical precision", function () {
  var math = model.theoreticalMath();
  near(math.totalRtp, 0.96, 0.00000001, "complete RTP must be 96%");
  near(
    math.totalFreeSpinsPer100Paid,
    29.95816800589971,
    0.0000000001,
    "strip math must return the audited free-spin frequency"
  );
  near(math.wheelMeanBps, 250, 0, "wheel must average +2.5% profit");
  near(
    math.paidDirectRtp + math.freeSpinRtpContribution,
    math.totalRtp,
    0.000000000001,
    "paid and feature RTP must conserve"
  );
});

test("deep-freezes every exported math input", function () {
  var originalPay = model.paytablePpm.B[3];
  var originalCount = model.symbols.B.count;

  assert(Object.isFrozen(model.paytablePpm.B), "nested paytable row must be frozen");
  assert(Object.isFrozen(model.symbols.B), "nested symbol record must be frozen");
  throws(function () {
    model.paytablePpm.B[3] = 1;
  }, "paytable mutation must be refused");
  throws(function () {
    model.symbols.B.count = 1;
  }, "symbol-count mutation must be refused");
  equal(model.paytablePpm.B[3], originalPay, "paytable changed despite freeze");
  equal(model.symbols.B.count, originalCount, "symbol count changed despite freeze");
});

test("keeps six explicit wheel outcomes with the agreed mean", function () {
  deepEqual(
    model.wheelDeltasBps,
    [-3000, -1500, -500, 500, 2500, 3500],
    "wheel faces changed"
  );
  equal(
    model.wheelDeltasBps.reduce(function (sum, value) {
      return sum + value;
    }, 0),
    1500,
    "six wheel faces must total +15%"
  );
});

test("uses unbiased rejection rather than raw modulo at the boundary", function () {
  var values = [0xffffffff, 7];
  var calls = 0;
  var result = rng.uniformFromSource(6, function () {
    calls += 1;
    return values.shift();
  });
  equal(calls, 2, "the out-of-range uint32 must be rejected");
  equal(result, 1, "7 mapped into six faces must produce one");
});

test("reproduces records and domain-separates every auxiliary draw", function () {
  var seed = "same-style-session";
  var first = rng.generateRecord(seed, 1234);
  var repeated = rng.generateRecord(seed, 1234);
  var next = rng.generateRecord(seed, 1235);
  var otherSeed = rng.generateRecord("other-style-session", 1234);

  deepEqual(first, repeated, "same seed and index must replay exactly");
  assert(JSON.stringify(first) !== JSON.stringify(next), "next row must differ");
  assert(JSON.stringify(first) !== JSON.stringify(otherSeed), "new seed must differ");
});

test("locks domain-separated lane and retry vectors", function () {
  var seed = "lane-golden-v1";
  equal(rng.deriveUint32(seed, 42, "reel-0", 0), 491373177, "reel lane changed");
  equal(rng.deriveUint32(seed, 42, "wheel", 0), 3253041798, "wheel lane changed");
  equal(rng.deriveUint32(seed, 42, "jackpot", 0), 818741957, "jackpot lane changed");
  equal(rng.deriveUint32(seed, 42, "wheel", 1), 2351427332, "retry lane changed");
});

test("round-trips the compact 13-byte record without hidden state", function () {
  var record = rng.generateRecord("round-trip", 77);
  var encoded = rng.encodeRecord(record);
  equal(encoded.length, 13, "compact record size changed");
  deepEqual(rng.decodeRecord(encoded), record, "record round-trip changed values");
});

test("locks golden outcome rows for generator drift detection", function () {
  var seed = "lux5-golden-v1";
  deepEqual(
    rng.generateRecord(seed, 0),
    { stops: [35, 38, 35, 76, 74], wheelIndex: 0, jackpotTicket: 6150 },
    "golden first row changed"
  );
  deepEqual(
    rng.generateRecord(seed, 49999),
    { stops: [41, 29, 22, 31, 51], wheelIndex: 2, jackpotTicket: 5910 },
    "golden final row changed"
  );
});

test("derives scatter awards from reel stops and never forces them", function () {
  var row = bookTools.deriveRow(rng.generateRecord("lux5-golden-v1", 16), 16);
  equal(row.scatterCount, 3, "golden scatter row must show exactly three");
  equal(row.freeSpinsAwarded, 4, "three scatters must grant four free spins");
});

test("preselects and applies the robot wheel inside the same outcome row", function () {
  var row = bookTools.deriveRow(rng.generateRecord("lux5-golden-v1", 28), 28);
  equal(row.grid[2], "BBBBB", "golden wheel row must contain five bolts");
  equal(row.wheelIndex, 3, "golden wheel index changed");
  equal(row.wheelDeltaBps, 500, "wheel face must add 5% of profit");
  equal(row.paidPayoutPpm, 6287500, "wheel-adjusted payout changed");
  equal(row.freePayoutPpm, 9431250, "Overdrive payout changed");
});

test("uses one neutral jackpot ticket with exact actor thresholds", function () {
  var humanHits = 0;
  var npcHits = 0;
  for (var ticket = 0; ticket < 10000; ticket += 1) {
    humanHits += ticket < model.constants.humanJackpotThreshold ? 1 : 0;
    npcHits += ticket < model.constants.npcJackpotThreshold ? 1 : 0;
  }
  equal(humanHits, 100, "human threshold must be exactly 1%");
  equal(npcHits, 5, "NPC threshold must be exactly 0.05%");
});

test("outcome records cannot accept money, actor, owner, or location inputs", function () {
  var row = bookTools.deriveRow(rng.generateRecord("neutral-row", 8), 8);
  var serialized = JSON.stringify(row).toLowerCase();
  ["wager", "bankroll", "player", "actor", "owner", "casino", "location"].forEach(
    function (forbidden) {
      assert(serialized.indexOf(forbidden) === -1, "row leaked forbidden field: " + forbidden);
    }
  );
  equal(rng.generateRecord.length, 2, "generator must only accept seed and row index");
});

test("rejects malformed bounds and corrupt record offsets", function () {
  throws(function () {
    rng.uniformFromSource(0, function () {
      return 0;
    });
  }, "zero-sized random range must fail");
  throws(function () {
    rng.decodeRecord(Buffer.alloc(12));
  }, "short record must fail");
  var corruptTicket = Buffer.alloc(13);
  corruptTicket.writeUInt16LE(10000, 11);
  throws(function () {
    rng.decodeRecord(corruptTicket);
  }, "out-of-range jackpot ticket must fail");
  var corruptWheel = Buffer.alloc(13);
  corruptWheel.writeUInt8(6, 10);
  throws(function () {
    rng.decodeRecord(corruptWheel);
  }, "out-of-range wheel index must fail");
  throws(function () {
    model.evaluateStops([0, 0, 0, 0, 83], 0);
  }, "out-of-range reel stop must fail");
});

test("handles unbiased range edges for reel, wheel, and jackpot sizes", function () {
  equal(
    rng.uniformFromSource(1, function () {
      return 0xffffffff;
    }),
    0,
    "one-value range must accept every uint32"
  );

  [83, 10000].forEach(function (size) {
    var limit = Math.floor(rng.uint32Range / size) * size;
    equal(
      rng.uniformFromSource(size, function () {
        return limit - 1;
      }),
      size - 1,
      "limit - 1 must map to the final bucket for " + size
    );
    var values = [limit, 0];
    equal(
      rng.uniformFromSource(size, function () {
        return values.shift();
      }),
      0,
      "limit must reject before accepting zero for " + size
    );
  });

  throws(function () {
    rng.uniformFromSource(6, function () {
      return -1;
    });
  }, "invalid uint32 source values must fail");
});

console.log("LUX-5 math self-test passed: " + passed + " checks.");
