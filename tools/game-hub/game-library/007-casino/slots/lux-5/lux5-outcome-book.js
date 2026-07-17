"use strict";

// Derives readable outcomes and audits from the compact style-level book.

var fs = require("fs");
var model = require("./lux5-model.js");
var rng = require("./lux5-rng.js");

function percent(value) {
  return Number((value * 100).toFixed(6));
}

function multiplier(ppm) {
  return Number((ppm / model.constants.payoutScale).toFixed(6));
}

function recordCount(book) {
  if (!Buffer.isBuffer(book)) {
    throw new TypeError("book must be a Node Buffer");
  }
  if (book.length % model.constants.recordBytes !== 0) {
    throw new RangeError("book byte length is not divisible by the record size");
  }
  return book.length / model.constants.recordBytes;
}

function deriveRow(record, index) {
  var outcome = model.evaluateStops(record.stops, record.wheelIndex);

  return {
    schema: "lux5-outcome-row",
    version: 1,
    index: index,
    stops: record.stops.slice(),
    grid: outcome.grid.map(function (row) {
      return row.join("");
    }),
    scatterCount: outcome.scatterCount,
    freeSpinsAwarded: outcome.freeSpinsAwarded,
    winningLines: outcome.winningLines,
    wheelIndex: record.wheelIndex,
    wheelDeltaBps: outcome.wheelDeltaBps,
    wheelTriggered: outcome.wheelTriggered,
    paidPayoutPpm: outcome.paidPayoutPpm,
    paidPayoutX: multiplier(outcome.paidPayoutPpm),
    freePayoutPpm: outcome.freePayoutPpm,
    freePayoutX: multiplier(outcome.freePayoutPpm),
    jackpotTicket: record.jackpotTicket,
    humanJackpot: record.jackpotTicket < model.constants.humanJackpotThreshold,
    npcJackpot: record.jackpotTicket < model.constants.npcJackpotThreshold
  };
}

function rowAt(book, index) {
  var count = recordCount(book);
  var record;

  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError("row index is outside the book");
  }
  record = rng.decodeRecord(book, index * model.constants.recordBytes);
  return deriveRow(record, index);
}

function validateManifest(manifest, book) {
  var errors = [];
  var count;

  try {
    count = recordCount(book);
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }

  if (!manifest || typeof manifest !== "object") {
    return { ok: false, errors: ["manifest must be an object"] };
  }
  if (manifest.schema !== "lux5-outcome-book-manifest" || manifest.version !== 1) {
    errors.push("manifest schema/version mismatch");
  }
  if (
    manifest.styleId !== model.constants.styleId ||
    manifest.mathVersion !== model.constants.mathVersion
  ) {
    errors.push("manifest style/math version mismatch");
  }
  if (
    manifest.records !== count ||
    manifest.recordBytes !== model.constants.recordBytes ||
    manifest.bookBytes !== book.length
  ) {
    errors.push("manifest record or byte counts do not match the book");
  }
  if (
    JSON.stringify(manifest.reelLengths) !==
    JSON.stringify(
      model.reelStrips.map(function (strip) {
        return strip.length;
      })
    )
  ) {
    errors.push("manifest reel lengths do not match the math model");
  }
  if (JSON.stringify(manifest.wheelDeltasBps) !== JSON.stringify(model.wheelDeltasBps)) {
    errors.push("manifest wheel does not match the math model");
  }
  if (
    manifest.jackpotDenominator !== model.constants.jackpotDenominator ||
    manifest.humanJackpotThreshold !== model.constants.humanJackpotThreshold ||
    manifest.npcJackpotThreshold !== model.constants.npcJackpotThreshold
  ) {
    errors.push("manifest jackpot thresholds do not match the math model");
  }
  if (typeof manifest.seed !== "string" || manifest.seed.length === 0) {
    errors.push("manifest seed is missing");
  }

  return { ok: errors.length === 0, errors: errors };
}

function increment(array, index) {
  array[index] = (array[index] || 0) + 1;
}

function quantile(sorted, probability) {
  var position;

  if (sorted.length === 0) {
    return null;
  }
  position = Math.round((sorted.length - 1) * probability);
  return sorted[position];
}

function auditBook(book) {
  var count = recordCount(book);
  var theoretical = model.theoreticalMath();
  var scatterCounts = [0, 0, 0, 0, 0, 0];
  var wheelAllCounts = [0, 0, 0, 0, 0, 0];
  var wheelTriggeredCounts = [0, 0, 0, 0, 0, 0];
  var paidPayouts = [];
  var freePayouts = [];
  var paidPayoutSumPpm = 0;
  var freePayoutSumPpm = 0;
  var freeSpinsAwarded = 0;
  var wheelTriggers = 0;
  var winningLines = 0;
  var fiveKindLines = 0;
  var humanJackpots = 0;
  var npcJackpots = 0;
  var paidZero = 0;
  var paidPartial = 0;
  var paidBreakEven = 0;
  var paidProfit = 0;
  var canonical = {
    paidSpins: 0,
    freeSpins: 0,
    pendingFreeSpins: 0,
    payoutSumPpm: 0
  };
  var index;

  for (index = 0; index < count; index += 1) {
    var row = rowAt(book, index);
    var isFree = canonical.pendingFreeSpins > 0;

    increment(scatterCounts, row.scatterCount);
    increment(wheelAllCounts, row.wheelIndex);
    paidPayouts.push(row.paidPayoutPpm);
    freePayouts.push(row.freePayoutPpm);
    paidPayoutSumPpm += row.paidPayoutPpm;
    freePayoutSumPpm += row.freePayoutPpm;
    freeSpinsAwarded += row.freeSpinsAwarded;
    winningLines += row.winningLines.length;

    row.winningLines.forEach(function (line) {
      if (line.count === 5) {
        fiveKindLines += 1;
      }
    });

    if (row.wheelTriggered) {
      wheelTriggers += 1;
      increment(wheelTriggeredCounts, row.wheelIndex);
    }
    if (row.humanJackpot) {
      humanJackpots += 1;
    }
    if (row.npcJackpot) {
      npcJackpots += 1;
    }

    if (row.paidPayoutPpm === 0) {
      paidZero += 1;
    } else if (row.paidPayoutPpm < model.constants.payoutScale) {
      paidPartial += 1;
    } else if (row.paidPayoutPpm === model.constants.payoutScale) {
      paidBreakEven += 1;
    } else {
      paidProfit += 1;
    }

    if (isFree) {
      canonical.freeSpins += 1;
      canonical.pendingFreeSpins -= 1;
      canonical.payoutSumPpm += row.freePayoutPpm;
    } else {
      canonical.paidSpins += 1;
      canonical.payoutSumPpm += row.paidPayoutPpm;
    }
    canonical.pendingFreeSpins += row.freeSpinsAwarded;
  }

  paidPayouts.sort(function (left, right) {
    return left - right;
  });
  freePayouts.sort(function (left, right) {
    return left - right;
  });

  var observedDirectAwardRate = freeSpinsAwarded / count;
  var observedProjectedFreeSpins =
    observedDirectAwardRate < 1
      ? observedDirectAwardRate / (1 - observedDirectAwardRate)
      : null;
  var observedPaidDirectRtp = paidPayoutSumPpm / count / model.constants.payoutScale;
  var observedFreeDirectRtp = freePayoutSumPpm / count / model.constants.payoutScale;

  return {
    schema: "lux5-outcome-book-audit",
    version: 1,
    styleId: model.constants.styleId,
    mathVersion: model.constants.mathVersion,
    records: count,
    recordBytes: model.constants.recordBytes,
    bookBytes: book.length,
    theoretical: {
      targetRtpPercent: percent(model.constants.targetRtp),
      totalRtpPercent: percent(theoretical.totalRtp),
      paidDirectRtpPercent: percent(theoretical.paidDirectRtp),
      freeDirectRtpPercent: percent(theoretical.freeDirectRtp),
      freeSpinContributionPercent: percent(theoretical.freeSpinRtpContribution),
      freeSpinsPer100Paid: Number(theoretical.totalFreeSpinsPer100Paid.toFixed(6)),
      scatterTriggerPercent: percent(theoretical.scatterTriggerProbability),
      expectedFiveKindLinesPer100Spins: Number(
        (theoretical.expectedFiveKindLinesPerScreen * 100).toFixed(6)
      ),
      wheelMeanProfitDeltaPercent: theoretical.wheelMeanBps / 100
    },
    observedBook: {
      paidDirectRtpPercent: percent(observedPaidDirectRtp),
      freeDirectRtpPercent: percent(observedFreeDirectRtp),
      projectedTotalRtpPercent:
        observedProjectedFreeSpins === null
          ? null
          : percent(
              observedPaidDirectRtp + observedProjectedFreeSpins * observedFreeDirectRtp
            ),
      projectedFreeSpinsPer100Paid:
        observedProjectedFreeSpins === null
          ? null
          : Number((observedProjectedFreeSpins * 100).toFixed(6)),
      directFreeSpinsAwarded: freeSpinsAwarded,
      scatterCounts: scatterCounts,
      winningLines: winningLines,
      fiveKindLines: fiveKindLines,
      wheelTriggers: wheelTriggers,
      wheelAllCounts: wheelAllCounts,
      wheelTriggeredCounts: wheelTriggeredCounts,
      humanJackpotTickets: humanJackpots,
      npcJackpotTickets: npcJackpots,
      paidOutcomeCounts: {
        zero: paidZero,
        partialReturn: paidPartial,
        breakEven: paidBreakEven,
        profit: paidProfit
      },
      paidPayoutQuantilesX: {
        p50: multiplier(quantile(paidPayouts, 0.5)),
        p75: multiplier(quantile(paidPayouts, 0.75)),
        p90: multiplier(quantile(paidPayouts, 0.9)),
        p95: multiplier(quantile(paidPayouts, 0.95)),
        p99: multiplier(quantile(paidPayouts, 0.99)),
        max: multiplier(paidPayouts[paidPayouts.length - 1])
      },
      freePayoutQuantilesX: {
        p50: multiplier(quantile(freePayouts, 0.5)),
        p75: multiplier(quantile(freePayouts, 0.75)),
        p90: multiplier(quantile(freePayouts, 0.9)),
        p95: multiplier(quantile(freePayouts, 0.95)),
        p99: multiplier(quantile(freePayouts, 0.99)),
        max: multiplier(freePayouts[freePayouts.length - 1])
      }
    },
    canonicalReplay: {
      paidSpins: canonical.paidSpins,
      freeSpins: canonical.freeSpins,
      pendingFreeSpinsAtBookEnd: canonical.pendingFreeSpins,
      freeSpinsPer100Paid: Number(
        ((canonical.freeSpins / canonical.paidSpins) * 100).toFixed(6)
      ),
      realizedRtpPercent: percent(
        canonical.payoutSumPpm /
          canonical.paidSpins /
          model.constants.payoutScale
      )
    }
  };
}

function writeDebugJsonl(book, filePath) {
  var count = recordCount(book);
  var file = fs.openSync(filePath, "w");
  var batch = [];
  var index;

  try {
    for (index = 0; index < count; index += 1) {
      batch.push(JSON.stringify(rowAt(book, index)));
      if (batch.length === 500) {
        fs.writeSync(file, batch.join("\n") + "\n");
        batch = [];
      }
    }
    if (batch.length > 0) {
      fs.writeSync(file, batch.join("\n") + "\n");
    }
  } finally {
    fs.closeSync(file);
  }
}

function markdownReport(manifest, audit) {
  var theoretical = audit.theoretical;
  var observed = audit.observedBook;
  var replay = audit.canonicalReplay;

  return [
    "# LUX-5 — 50,000-Outcome RNG Book",
    "",
    "Status: local math workbench; not a complete Game Hub package.",
    "",
    "## Book identity",
    "",
    "- Style: `" + manifest.styleId + "`",
    "- Math version: `" + manifest.mathVersion + "`",
    "- Session seed: `" + manifest.seed + "`",
    "- Records: " + manifest.records.toLocaleString("en-US"),
    "- Compact book size: " + manifest.bookBytes.toLocaleString("en-US") + " bytes",
    "- Shared rule: every physical LUX-5 cabinet in this session consumes the next record from one style-level cursor.",
    "",
    "Each immutable record contains five virtual-reel stops, one six-face wheel result, and one jackpot ticket. It contains no wager, bankroll, actor, owner, casino, or location.",
    "",
    "## v1 math used for this development specimen",
    "",
    "- 5 reels × 4 visible rows; four horizontal left-to-right lines.",
    "- 3 / 4 / 5 scatters award 4 / 7 / 18 free spins.",
    "- Free spins retrigger and use Overdrive ×1.5 line payouts.",
    "- One or more five-in-a-row lines invoke the robot wheel once per screen: −30%, −15%, −5%, +5%, +25%, or +35% of all qualifying profit.",
    "- The six wheel faces average +2.5% of qualifying profit.",
    "- Human jackpot ticket threshold: 100 / 10,000 (1%).",
    "- NPC jackpot ticket threshold: 5 / 10,000 (0.05%).",
    "- Progressive jackpot payout and contributions are intentionally outside the 96% slot model.",
    "",
    "## Theoretical model",
    "",
    "| Measure | Value |",
    "| --- | ---: |",
    "| Complete RTP | " + theoretical.totalRtpPercent.toFixed(6) + "% |",
    "| Paid-spin direct RTP | " + theoretical.paidDirectRtpPercent.toFixed(6) + "% |",
    "| One free-spin direct RTP | " + theoretical.freeDirectRtpPercent.toFixed(6) + "% |",
    "| Free-spin contribution | " + theoretical.freeSpinContributionPercent.toFixed(6) + "% |",
    "| Free spins per 100 paid | " + theoretical.freeSpinsPer100Paid.toFixed(6) + " |",
    "| Scatter trigger chance | " + theoretical.scatterTriggerPercent.toFixed(6) + "% |",
    "| Expected five-kind lines per 100 spins | " + theoretical.expectedFiveKindLinesPer100Spins.toFixed(6) + " |",
    "",
    "The 83-stop strips make the free-spin frequency 29.958168 rather than a cosmetically forced 30.000000. The paytable is solved around the real strip probability so analytical RTP rounds to 96%. Normalized fixed-point settlement rounding can shift the evaluator by less than 0.00001 percentage points.",
    "",
    "Mike approved Overdrive ×1.5 on 2026-07-13. The exact reel strips and ordinary paytable remain review candidates until play testing.",
    "",
    "## This naturally generated book",
    "",
    "| Measure | Value |",
    "| --- | ---: |",
    "| All-paid direct RTP | " + observed.paidDirectRtpPercent.toFixed(6) + "% |",
    "| All-free direct RTP | " + observed.freeDirectRtpPercent.toFixed(6) + "% |",
    "| Projected complete RTP from this finite sample | " + observed.projectedTotalRtpPercent.toFixed(6) + "% |",
    "| Projected free spins per 100 paid | " + observed.projectedFreeSpinsPer100Paid.toFixed(6) + " |",
    "| Wheel-triggering screens | " + observed.wheelTriggers.toLocaleString("en-US") + " |",
    "| Human-threshold jackpot tickets | " + observed.humanJackpotTickets.toLocaleString("en-US") + " |",
    "| NPC-threshold jackpot tickets | " + observed.npcJackpotTickets.toLocaleString("en-US") + " |",
    "| Maximum paid-screen payout | " + observed.paidPayoutQuantilesX.max.toFixed(6) + "× |",
    "| Maximum free-screen payout | " + observed.freePayoutQuantilesX.max.toFixed(6) + "× |",
    "",
    "Finite books are allowed to run above or below 96%. This book was generated once and was not rejected, reordered, smoothed, or regenerated to improve its measured return.",
    "",
    "## Canonical sequential replay",
    "",
    "For one audit only, every awarded free spin is played immediately before the next paid spin. Real multiplayer may interleave another cabinet's LUX-5 spin between bonus spins while still consuming this same global sequence.",
    "",
    "- Paid spins consumed: " + replay.paidSpins.toLocaleString("en-US"),
    "- Free spins consumed: " + replay.freeSpins.toLocaleString("en-US"),
    "- Free spins still queued at row 50,000: " + replay.pendingFreeSpinsAtBookEnd.toLocaleString("en-US"),
    "- Free spins per 100 paid in this replay: " + replay.freeSpinsPer100Paid.toFixed(6),
    "- Realized replay RTP: " + replay.realizedRtpPercent.toFixed(6) + "%",
    "",
    "## Runtime boundary",
    "",
    "The slot resolves symbols, free-spin grants, wheel modifier, and a neutral jackpot ticket. A separate ledger validates and settles wagers. The slot never receives bankroll, wager size, player identity, owner identity, or casino balance.",
    ""
  ].join("\n");
}

module.exports = Object.freeze({
  recordCount: recordCount,
  deriveRow: deriveRow,
  rowAt: rowAt,
  validateManifest: validateManifest,
  auditBook: auditBook,
  writeDebugJsonl: writeDebugJsonl,
  markdownReport: markdownReport
});
