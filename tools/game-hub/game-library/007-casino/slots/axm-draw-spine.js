"use strict";

// One neutral, casino-wide without-replacement draw order. The committed slot
// style maps the neutral ticket into its own independent 50,000-row book.

var crypto = require("crypto");
var catalog = require("./slot-catalog.js");

var TABLE_LENGTH = catalog.constants.tableLength;
var UINT32_RANGE = 0x100000000;

function seedWords(seed) {
  var digest = crypto.createHash("sha256").update(String(seed)).digest();
  var words = [
    digest.readUInt32LE(0), digest.readUInt32LE(4),
    digest.readUInt32LE(8), digest.readUInt32LE(12)
  ];
  if (words.every(function (value) { return value === 0; })) words[0] = 0x9e3779b9;
  return words;
}

function SeedRandom(seed) {
  var words = seedWords(seed);
  this.a = words[0] >>> 0;
  this.b = words[1] >>> 0;
  this.c = words[2] >>> 0;
  this.d = words[3] >>> 0;
}

SeedRandom.prototype.nextUint32 = function () {
  var result = Math.imul(this.a, 5) >>> 0;
  result = Math.imul(((result << 7) | (result >>> 25)) >>> 0, 9) >>> 0;
  var t = (this.b << 9) >>> 0;
  this.c ^= this.a;
  this.d ^= this.b;
  this.b ^= this.c;
  this.a ^= this.d;
  this.c ^= t;
  this.d = ((this.d << 11) | (this.d >>> 21)) >>> 0;
  return result >>> 0;
};

SeedRandom.prototype.uniform = function (maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError("uniform bound must be from 1 through 2^32");
  }
  var limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  var value;
  do { value = this.nextUint32(); } while (value >= limit);
  return value % maxExclusive;
};

function permutation(seed, length) {
  var random = new SeedRandom(seed);
  var result = new Uint32Array(length);
  var index;
  var swap;
  var temporary;
  for (index = 0; index < length; index += 1) result[index] = index;
  for (index = length - 1; index > 0; index -= 1) {
    swap = random.uniform(index + 1);
    temporary = result[index];
    result[index] = result[swap];
    result[swap] = temporary;
  }
  return result;
}

function assertStyleIds(styleIds) {
  if (!Array.isArray(styleIds) || !styleIds.length) throw new TypeError("at least one slot style is required");
  var seen = {};
  styleIds.forEach(function (styleId) {
    if (!catalog.definitionById(styleId)) throw new RangeError("unknown slot style: " + styleId);
    if (seen[styleId]) throw new RangeError("duplicate slot style: " + styleId);
    seen[styleId] = true;
  });
}

function DrawSpine(seed, styleIds, options) {
  var resolved = options || {};
  if (typeof seed !== "string" || !seed || seed.length > 1024) throw new TypeError("draw-spine seed must be a non-empty bounded string");
  assertStyleIds(styleIds);
  this.seed = seed;
  this.styleIds = styleIds.slice();
  this.activeLength = typeof resolved.activeLength === "number" ? resolved.activeLength : TABLE_LENGTH;
  if (!Number.isInteger(this.activeLength) || this.activeLength < 1 || this.activeLength > TABLE_LENGTH) {
    throw new RangeError("active draw length must be from 1 through 50,000");
  }
  this.epoch = 0;
  this.cursor = 0;
  this.totalConsumed = 0;
  this.masterOrder = null;
  this.styleMappings = {};
  this._buildEpoch();
}

DrawSpine.prototype._epochSeed = function (lane) {
  return ["AXM_50K_DRAW_SPINE_V1", this.seed, this.epoch, lane].join("|");
};

DrawSpine.prototype._buildEpoch = function () {
  var self = this;
  this.masterOrder = permutation(this._epochSeed("master"), TABLE_LENGTH);
  this.styleMappings = {};
  this.styleIds.forEach(function (styleId) {
    self.styleMappings[styleId] = permutation(self._epochSeed("style:" + styleId), TABLE_LENGTH);
  });
  this.cursor = 0;
};

DrawSpine.prototype.next = function (styleId) {
  if (!this.styleMappings[styleId]) throw new RangeError("slot style is not registered on this draw spine: " + styleId);
  if (this.cursor >= this.activeLength) {
    this.epoch += 1;
    this._buildEpoch();
  }
  var position = this.cursor;
  var ticketId = this.masterOrder[position];
  var rowIndex = this.styleMappings[styleId][ticketId];
  var receipt = {
    epoch: this.epoch,
    position: position,
    drawIndex: this.totalConsumed,
    ticketId: ticketId,
    styleId: styleId,
    styleRowIndex: rowIndex,
    styleSeed: this._epochSeed("row:" + styleId),
    jackpotTicket: Math.floor(ticketId / 5)
  };
  this.cursor += 1;
  this.totalConsumed += 1;
  receipt.cursorAfter = this.cursor;
  receipt.totalConsumedAfter = this.totalConsumed;
  return receipt;
};

DrawSpine.prototype.publicState = function () {
  return {
    id: "axm-50k-draw-spine",
    version: 1,
    epoch: this.epoch,
    consumedRows: this.cursor,
    totalRows: this.activeLength,
    remainingRows: this.activeLength - this.cursor,
    totalConsumed: this.totalConsumed,
    registeredStyles: this.styleIds.length
  };
};

DrawSpine.prototype.internalRowForTicket = function (styleId, ticketId) {
  if (!this.styleMappings[styleId]) throw new RangeError("unknown registered style");
  if (!Number.isInteger(ticketId) || ticketId < 0 || ticketId >= TABLE_LENGTH) throw new RangeError("ticket id is outside the 50K deck");
  return this.styleMappings[styleId][ticketId];
};

function createSessionSeed() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = Object.freeze({
  DrawSpine: DrawSpine,
  SeedRandom: SeedRandom,
  createSessionSeed: createSessionSeed,
  permutation: permutation,
  constants: Object.freeze({ tableLength: TABLE_LENGTH, uint32Range: UINT32_RANGE })
});
