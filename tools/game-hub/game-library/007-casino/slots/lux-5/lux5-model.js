"use strict";

// Pure LUX-5 math workbench; not a live Game Hub runtime.

var REEL_STRIPS = [
  "GGBGGLBOBCGBSBCGCBGBXCLCSBSBOBGBBOBOGXGBCBCXOBGBBGLGBCGGOBSBCSCCBGBBOBGBGCGCBBSOXGO",
  "BCBOBGBBCBBCXBBCOBBGGBGOGBGLOCSGSGSGGBBCXBCGGBCLGCXSOBSSOXBGGBGBGOGBBGOBBCCBCBCBLGO",
  "BBGGOBGGBGBBOBBCBCSGCBOGBBGBGGBBCOGCCGBGBGGSGBSLLOXBOGBBLBBCXSOBXOGBXCGSBCCGSBCCBOC",
  "GBCBGCGCBGOGSBBOCGBCOGBXBBGBOBBOCCBBXBGBSOCLGBLBGBOGXCBOSGBGSBCBGSGBBGGLBXCGBOCCGBS",
  "BBLGSOGBGGBBCBCLBXBGOGCSOGOSBBGSOBXGOBBGCSBGBBCBCGBGBXGBBGCXOOBGCLCOBCBBGCBGCBGSCBG"
];

var SYMBOLS = {
  B: { id: "bolt", name: "Neon Bolt", count: 28 },
  G: { id: "gear", name: "Gear", count: 20 },
  C: { id: "chip", name: "Circuit Chip", count: 13 },
  O: { id: "orb", name: "Energy Orb", count: 9 },
  S: { id: "star", name: "Photon Star", count: 6 },
  L: { id: "lux", name: "LUX Head", count: 3 },
  X: { id: "scatter", name: "Power Core Scatter", count: 4 }
};

// Payouts are millionths of one line stake. The four horizontal lines each
// receive one quarter of the total wager. B/3 is the single solved value that
// closes the complete line + wheel + retrigger model at 96% theoretical RTP.
var PAYTABLE_PPM = {
  B: { 3: 7261295, 4: 14000000, 5: 24000000 },
  G: { 3: 9000000, 4: 18000000, 5: 28000000 },
  C: { 3: 12000000, 4: 22000000, 5: 32000000 },
  O: { 3: 16000000, 4: 26000000, 5: 38000000 },
  S: { 3: 22000000, 4: 32000000, 5: 44000000 },
  L: { 3: 30000000, 4: 42000000, 5: 50000000 }
};

var WHEEL_DELTAS_BPS = [-3000, -1500, -500, 500, 2500, 3500];
var FREE_SPIN_AWARDS = { 3: 4, 4: 7, 5: 18 };

Object.keys(SYMBOLS).forEach(function (symbol) {
  Object.freeze(SYMBOLS[symbol]);
});
Object.freeze(SYMBOLS);
Object.keys(PAYTABLE_PPM).forEach(function (symbol) {
  Object.freeze(PAYTABLE_PPM[symbol]);
});
Object.freeze(PAYTABLE_PPM);
Object.freeze(WHEEL_DELTAS_BPS);
Object.freeze(FREE_SPIN_AWARDS);

var constants = Object.freeze({
  schema: "lux5-math-model",
  mathVersion: 1,
  styleId: "lux-5",
  reels: 5,
  rows: 4,
  paylines: 4,
  reelLength: 83,
  tableLength: 50000,
  recordBytes: 13,
  payoutScale: 1000000,
  freeWinMultiplierPpm: 1500000,
  jackpotDenominator: 10000,
  humanJackpotThreshold: 100,
  npcJackpotThreshold: 5,
  targetRtp: 0.96
});

function countSymbols(strip) {
  var counts = Object.create(null);
  var index;

  for (index = 0; index < strip.length; index += 1) {
    counts[strip[index]] = (counts[strip[index]] || 0) + 1;
  }
  return counts;
}

function hasNearbyScatter(strip, position) {
  var distance;
  var length = strip.length;

  for (distance = 1; distance < constants.rows; distance += 1) {
    if (
      strip[(position + distance) % length] === "X" ||
      strip[(position - distance + length) % length] === "X"
    ) {
      return true;
    }
  }
  return false;
}

function validateModel() {
  var expectedCodes = Object.keys(SYMBOLS).sort();
  var errors = [];

  if (REEL_STRIPS.length !== constants.reels) {
    errors.push("expected exactly five reel strips");
  }

  REEL_STRIPS.forEach(function (strip, reelIndex) {
    var counts = countSymbols(strip);

    if (strip.length !== constants.reelLength) {
      errors.push("reel " + reelIndex + " must contain 83 stops");
    }

    if (Object.keys(counts).sort().join("") !== expectedCodes.join("")) {
      errors.push("reel " + reelIndex + " contains an unknown or missing symbol");
    }

    expectedCodes.forEach(function (code) {
      if (counts[code] !== SYMBOLS[code].count) {
        errors.push(
          "reel " + reelIndex + " must contain " + SYMBOLS[code].count + " " + code
        );
      }
    });

    for (var position = 0; position < strip.length; position += 1) {
      if (strip[position] === "X" && hasNearbyScatter(strip, position)) {
        errors.push("reel " + reelIndex + " can show two scatters in one window");
        break;
      }
    }
  });

  if (WHEEL_DELTAS_BPS.length !== 6) {
    errors.push("wheel must contain exactly six outcomes");
  }

  if (
    WHEEL_DELTAS_BPS.reduce(function (sum, value) {
      return sum + value;
    }, 0) / WHEEL_DELTAS_BPS.length !==
    250
  ) {
    errors.push("wheel outcomes must average +2.5% profit");
  }

  return { ok: errors.length === 0, errors: errors };
}

function assertStops(stops) {
  if (!Array.isArray(stops) || stops.length !== constants.reels) {
    throw new TypeError("stops must contain exactly five reel-stop indexes");
  }

  stops.forEach(function (stop, reelIndex) {
    if (
      !Number.isInteger(stop) ||
      stop < 0 ||
      stop >= REEL_STRIPS[reelIndex].length
    ) {
      throw new RangeError("invalid stop for reel " + reelIndex);
    }
  });
}

function getWindow(stops) {
  var grid = [];
  var row;
  var reel;

  assertStops(stops);

  for (row = 0; row < constants.rows; row += 1) {
    grid[row] = [];
    for (reel = 0; reel < constants.reels; reel += 1) {
      grid[row][reel] =
        REEL_STRIPS[reel][(stops[reel] + row) % constants.reelLength];
    }
  }
  return grid;
}

function scatterAward(scatterCount) {
  if (scatterCount >= 5) {
    return FREE_SPIN_AWARDS[5];
  }
  return FREE_SPIN_AWARDS[scatterCount] || 0;
}

function adjustedFivePayoutPpm(basePayoutPpm, wheelDeltaBps) {
  var scale = constants.payoutScale;
  var profitPpm = basePayoutPpm - scale;

  return scale + Math.round((profitPpm * (10000 + wheelDeltaBps)) / 10000);
}

function evaluateStops(stops, wheelIndex) {
  var grid;
  var wheelDeltaBps;
  var scatterCount = 0;
  var winningLines = [];
  var totalLinePayoutPpm = 0;

  assertStops(stops);
  if (!Number.isInteger(wheelIndex) || wheelIndex < 0 || wheelIndex >= 6) {
    throw new RangeError("wheelIndex must be an integer from 0 through 5");
  }

  grid = getWindow(stops);
  wheelDeltaBps = WHEEL_DELTAS_BPS[wheelIndex];

  grid.forEach(function (line) {
    line.forEach(function (symbol) {
      if (symbol === "X") {
        scatterCount += 1;
      }
    });
  });

  grid.forEach(function (line, row) {
    var symbol = line[0];
    var count = 1;
    var payoutPpm;

    if (symbol === "X") {
      return;
    }

    while (count < constants.reels && line[count] === symbol) {
      count += 1;
    }

    if (count < 3) {
      return;
    }

    payoutPpm = PAYTABLE_PPM[symbol][count];
    if (count === 5) {
      payoutPpm = adjustedFivePayoutPpm(payoutPpm, wheelDeltaBps);
    }

    totalLinePayoutPpm += payoutPpm;
    winningLines.push({
      row: row,
      symbol: SYMBOLS[symbol].id,
      symbolCode: symbol,
      count: count,
      linePayoutPpm: payoutPpm,
      wheelApplied: count === 5
    });
  });

  return {
    grid: grid,
    scatterCount: scatterCount,
    freeSpinsAwarded: scatterAward(scatterCount),
    winningLines: winningLines,
    wheelTriggered: winningLines.some(function (line) {
      return line.wheelApplied;
    }),
    wheelDeltaBps: wheelDeltaBps,
    paidPayoutPpm: Math.round(totalLinePayoutPpm / constants.paylines),
    freePayoutPpm: Math.round(
      (totalLinePayoutPpm * constants.freeWinMultiplierPpm) /
        constants.paylines /
        constants.payoutScale
    )
  };
}

function choose(n, k) {
  var result = 1;
  var index;

  for (index = 1; index <= k; index += 1) {
    result = (result * (n - (k - index))) / index;
  }
  return result;
}

function binomialProbability(n, k, probability) {
  return (
    choose(n, k) *
    Math.pow(probability, k) *
    Math.pow(1 - probability, n - k)
  );
}

function theoreticalMath() {
  var scatterVisiblePerReel =
    (SYMBOLS.X.count * constants.rows) / constants.reelLength;
  var scatterThree = binomialProbability(5, 3, scatterVisiblePerReel);
  var scatterFour = binomialProbability(5, 4, scatterVisiblePerReel);
  var scatterFive = binomialProbability(5, 5, scatterVisiblePerReel);
  var directFreeAwards =
    scatterThree * FREE_SPIN_AWARDS[3] +
    scatterFour * FREE_SPIN_AWARDS[4] +
    scatterFive * FREE_SPIN_AWARDS[5];
  var totalFreeSpinsPerPaid = directFreeAwards / (1 - directFreeAwards);
  var wheelMeanBps =
    WHEEL_DELTAS_BPS.reduce(function (sum, value) {
      return sum + value;
    }, 0) / WHEEL_DELTAS_BPS.length;
  var paidDirectRtp = 0;
  var payingLineProbability = 0;
  var expectedFiveKindLinesPerScreen = 0;

  Object.keys(PAYTABLE_PPM).forEach(function (symbol) {
    var probability = SYMBOLS[symbol].count / constants.reelLength;
    var exactThree = Math.pow(probability, 3) * (1 - probability);
    var exactFour = Math.pow(probability, 4) * (1 - probability);
    var five = Math.pow(probability, 5);
    var averageFivePayout =
      1 +
      (PAYTABLE_PPM[symbol][5] / constants.payoutScale - 1) *
        (1 + wheelMeanBps / 10000);

    paidDirectRtp +=
      exactThree * (PAYTABLE_PPM[symbol][3] / constants.payoutScale) +
      exactFour * (PAYTABLE_PPM[symbol][4] / constants.payoutScale) +
      five * averageFivePayout;
    payingLineProbability += Math.pow(probability, 3);
    expectedFiveKindLinesPerScreen += five * constants.paylines;
  });

  var freeDirectRtp =
    (paidDirectRtp * constants.freeWinMultiplierPpm) / constants.payoutScale;
  var freeSpinRtpContribution = totalFreeSpinsPerPaid * freeDirectRtp;

  return {
    scatterVisiblePerReel: scatterVisiblePerReel,
    scatterTriggerProbability: scatterThree + scatterFour + scatterFive,
    scatterThreeProbability: scatterThree,
    scatterFourProbability: scatterFour,
    scatterFiveProbability: scatterFive,
    directFreeAwardsPerSpin: directFreeAwards,
    totalFreeSpinsPerPaid: totalFreeSpinsPerPaid,
    totalFreeSpinsPer100Paid: totalFreeSpinsPerPaid * 100,
    wheelMeanBps: wheelMeanBps,
    expectedFiveKindLinesPerScreen: expectedFiveKindLinesPerScreen,
    payingLineProbability: payingLineProbability,
    paidDirectRtp: paidDirectRtp,
    freeDirectRtp: freeDirectRtp,
    freeSpinRtpContribution: freeSpinRtpContribution,
    totalRtp: paidDirectRtp + freeSpinRtpContribution
  };
}

module.exports = Object.freeze({
  constants: constants,
  reelStrips: Object.freeze(REEL_STRIPS.slice()),
  symbols: Object.freeze(SYMBOLS),
  paytablePpm: Object.freeze(PAYTABLE_PPM),
  wheelDeltasBps: Object.freeze(WHEEL_DELTAS_BPS.slice()),
  freeSpinAwards: Object.freeze(FREE_SPIN_AWARDS),
  validateModel: validateModel,
  getWindow: getWindow,
  scatterAward: scatterAward,
  adjustedFivePayoutPpm: adjustedFivePayoutPpm,
  evaluateStops: evaluateStops,
  theoreticalMath: theoreticalMath
});
