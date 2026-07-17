"use strict";

// Server-side style RNG workbench; outcome rows contain no economy inputs.

var crypto = require("crypto");
var model = require("./lux5-model.js");

var DOMAIN = "LUX5_OUTCOME_BOOK_V1";
var UINT32_RANGE = 0x100000000;

function assertSeed(seed) {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 1024) {
    throw new TypeError("seed must be a non-empty string of at most 1024 characters");
  }
}

function assertRecordIndex(recordIndex) {
  if (!Number.isInteger(recordIndex) || recordIndex < 0 || recordIndex > 0xffffffff) {
    throw new RangeError("recordIndex must be a uint32");
  }
}

function deriveUint32(seed, recordIndex, lane, attempt) {
  var message;
  var digest;

  assertSeed(seed);
  assertRecordIndex(recordIndex);
  if (typeof lane !== "string" || lane.length === 0 || lane.indexOf("|") !== -1) {
    throw new TypeError("lane must be a non-empty domain label without pipes");
  }
  if (!Number.isInteger(attempt) || attempt < 0 || attempt > 0xffffffff) {
    throw new RangeError("attempt must be a uint32");
  }

  message = [
    DOMAIN,
    model.constants.mathVersion,
    model.constants.styleId,
    recordIndex,
    lane,
    attempt
  ].join("|");
  digest = crypto.createHmac("sha256", Buffer.from(seed, "utf8")).update(message).digest();
  return digest.readUInt32BE(0);
}

function uniformFromSource(maxExclusive, nextUint32) {
  var limit;
  var value;

  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError("maxExclusive must be an integer from 1 through 2^32");
  }
  if (typeof nextUint32 !== "function") {
    throw new TypeError("nextUint32 must be a function");
  }

  limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  do {
    value = nextUint32();
    if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
      throw new RangeError("nextUint32 returned a value outside uint32 range");
    }
  } while (value >= limit);

  return value % maxExclusive;
}

function uniformInt(seed, recordIndex, lane, maxExclusive) {
  var attempt = 0;

  return uniformFromSource(maxExclusive, function () {
    var value = deriveUint32(seed, recordIndex, lane, attempt);
    attempt += 1;
    return value;
  });
}

function generateRecord(seed, recordIndex) {
  var stops = [];
  var reelIndex;

  assertSeed(seed);
  assertRecordIndex(recordIndex);

  for (reelIndex = 0; reelIndex < model.constants.reels; reelIndex += 1) {
    stops.push(
      uniformInt(
        seed,
        recordIndex,
        "reel-" + reelIndex,
        model.reelStrips[reelIndex].length
      )
    );
  }

  return {
    stops: stops,
    wheelIndex: uniformInt(seed, recordIndex, "wheel", 6),
    jackpotTicket: uniformInt(
      seed,
      recordIndex,
      "jackpot",
      model.constants.jackpotDenominator
    )
  };
}

function encodeRecord(record) {
  var buffer = Buffer.alloc(model.constants.recordBytes);
  var reelIndex;

  if (!record || !Array.isArray(record.stops) || record.stops.length !== 5) {
    throw new TypeError("record must contain five stops");
  }

  for (reelIndex = 0; reelIndex < 5; reelIndex += 1) {
    if (
      !Number.isInteger(record.stops[reelIndex]) ||
      record.stops[reelIndex] < 0 ||
      record.stops[reelIndex] >= model.reelStrips[reelIndex].length
    ) {
      throw new RangeError("record contains an invalid reel stop");
    }
    buffer.writeUInt16LE(record.stops[reelIndex], reelIndex * 2);
  }

  if (!Number.isInteger(record.wheelIndex) || record.wheelIndex < 0 || record.wheelIndex > 5) {
    throw new RangeError("record contains an invalid wheel index");
  }
  if (
    !Number.isInteger(record.jackpotTicket) ||
    record.jackpotTicket < 0 ||
    record.jackpotTicket >= model.constants.jackpotDenominator
  ) {
    throw new RangeError("record contains an invalid jackpot ticket");
  }

  buffer.writeUInt8(record.wheelIndex, 10);
  buffer.writeUInt16LE(record.jackpotTicket, 11);
  return buffer;
}

function decodeRecord(buffer, offset) {
  var resolvedOffset = typeof offset === "undefined" ? 0 : offset;
  var stops = [];
  var reelIndex;

  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("buffer must be a Node Buffer");
  }
  if (
    !Number.isInteger(resolvedOffset) ||
    resolvedOffset < 0 ||
    resolvedOffset + model.constants.recordBytes > buffer.length
  ) {
    throw new RangeError("record offset is outside the buffer");
  }

  for (reelIndex = 0; reelIndex < 5; reelIndex += 1) {
    stops.push(buffer.readUInt16LE(resolvedOffset + reelIndex * 2));
  }

  var record = {
    stops: stops,
    wheelIndex: buffer.readUInt8(resolvedOffset + 10),
    jackpotTicket: buffer.readUInt16LE(resolvedOffset + 11)
  };

  record.stops.forEach(function (stop, reelIndex) {
    if (stop < 0 || stop >= model.reelStrips[reelIndex].length) {
      throw new RangeError("decoded record contains an invalid reel stop");
    }
  });
  if (record.wheelIndex > 5) {
    throw new RangeError("decoded record contains an invalid wheel index");
  }
  if (record.jackpotTicket >= model.constants.jackpotDenominator) {
    throw new RangeError("decoded record contains an invalid jackpot ticket");
  }

  return record;
}

function buildBook(seed, length) {
  var resolvedLength = typeof length === "undefined" ? model.constants.tableLength : length;
  var book;
  var index;
  var encoded;

  assertSeed(seed);
  if (!Number.isInteger(resolvedLength) || resolvedLength < 1 || resolvedLength > 100000) {
    throw new RangeError("book length must be an integer from 1 through 100000");
  }

  book = Buffer.alloc(resolvedLength * model.constants.recordBytes);
  for (index = 0; index < resolvedLength; index += 1) {
    encoded = encodeRecord(generateRecord(seed, index));
    encoded.copy(book, index * model.constants.recordBytes);
  }
  return book;
}

function createSessionSeed() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = Object.freeze({
  domain: DOMAIN,
  uint32Range: UINT32_RANGE,
  createSessionSeed: createSessionSeed,
  deriveUint32: deriveUint32,
  uniformFromSource: uniformFromSource,
  uniformInt: uniformInt,
  generateRecord: generateRecord,
  encodeRecord: encodeRecord,
  decodeRecord: decodeRecord,
  buildBook: buildBook
});
