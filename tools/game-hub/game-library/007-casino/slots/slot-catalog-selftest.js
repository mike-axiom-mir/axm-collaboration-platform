#!/usr/bin/env node
"use strict";

var assert = require("assert");
var Catalog = require("./slot-catalog.js");

var validation = Catalog.validateCatalog();
assert.deepStrictEqual(validation, { ok: true, errors: [] });
assert.equal(Catalog.styleIds.length, 10, "the alpha must start with ten slot styles");
assert.equal(new Set(Catalog.styleIds).size, 10, "slot ids must be unique");
assert.equal(new Set(Catalog.newStyles.map(function (style) { return style.layout; })).size, 9, "the nine additions need distinct mechanic evaluators");

var audits = Catalog.newStyles.map(Catalog.auditDefinition);
audits.forEach(function (audit) {
  assert.equal(audit.records, 50000, audit.styleId + " must close over 50,000 outcomes");
  assert.equal(audit.exactBookRtpPercent, 96, audit.styleId + " must close to exactly 96 percent base RTP");
  assert.equal(audit.payoutSumPpm, 50000 * 960000, audit.styleId + " finite payout sum drifted");
  assert.ok(audit.hitRatePercent > 0 && audit.hitRatePercent < 100);
  assert.ok(audit.maxPayoutX > 0);
});
assert.ok(new Set(audits.map(function (audit) { return audit.hitRatePercent; })).size >= 8, "styles must not be probability reskins");
assert.ok(new Set(audits.map(function (audit) { return audit.maxPayoutX; })).size >= 7, "styles need materially different ceilings");

Catalog.styleIds.forEach(function (styleId) {
  var definition = Catalog.definitionById(styleId);
  var first = Catalog.rowAt(styleId, 0, "catalog-selftest-seed");
  var repeat = Catalog.rowAt(styleId, 0, "catalog-selftest-seed", { wager: 999999, bankroll: -1, actor: "ignored" });
  var last = Catalog.rowAt(styleId, 49999, "catalog-selftest-seed");
  assert.deepStrictEqual(repeat, first, styleId + " must ignore extra economic inputs");
  assert.equal(first.styleId, styleId);
  assert.equal(first.presentation.layout, definition.layout);
  assert.equal(first.presentation.cells.length, first.presentation.columns * first.presentation.rows);
  assert.equal(last.index, 49999);
  assert.equal(Number.isInteger(first.paidPayoutPpm), true);
  assert.equal(Number.isInteger(last.paidPayoutPpm), true);
});

assert.equal(Catalog.rowAt.length, 3, "the outcome interface is style, row, seed only");
assert.throws(function () { Catalog.rowAt("missing", 0, "seed"); }, /unknown slot style/);
assert.throws(function () { Catalog.rowAt("graftgarden", 50000, "seed"); }, /0 through 49,999/);
assert.throws(function () { Catalog.rowAt("graftgarden", 0, ""); }, /seed is required/);

console.log("AXM ten-slot catalog self-test passed: 10 styles, nine distinct mechanics, nine exact 50K/96% finite books.");
