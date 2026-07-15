"use strict";

// Verifies the delivered first 50,000-row book against its recorded seed.

var fs = require("fs");
var path = require("path");
var model = require("./lux5-model.js");
var rng = require("./lux5-rng.js");
var bookTools = require("./lux5-outcome-book.js");

var exportDir = path.resolve(__dirname, "../../../../../../exports/lux5-rng");
var stem = "lux5-outcome-book-50000";
var binaryPath = path.join(exportDir, stem + ".bin");
var jsonlPath = path.join(exportDir, stem + ".jsonl");
var manifestPath = path.join(exportDir, stem + ".manifest.json");
var summaryPath = path.join(exportDir, stem + ".summary.json");
var reportPath = path.join(exportDir, stem + ".report.md");

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
    fail(message + "\nExpected: " + expected + "\nActual:   " + actual);
  }
}

[binaryPath, jsonlPath, manifestPath, summaryPath, reportPath].forEach(function (filePath) {
  assert(fs.existsSync(filePath), "missing generated LUX-5 artifact: " + filePath);
});

var manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
var expectedSummary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
var book = fs.readFileSync(binaryPath);
var manifestValidation = bookTools.validateManifest(manifest, book);

assert(manifestValidation.ok, manifestValidation.errors.join("; "));

equal(manifest.records, 50000, "manifest must describe 50,000 rows");
equal(manifest.recordBytes, 13, "manifest record size changed");
equal(book.length, 650000, "binary book must contain exactly 50,000 compact rows");
equal(bookTools.recordCount(book), 50000, "decoded record count changed");

var regenerated = rng.buildBook(manifest.seed, manifest.records);
assert(book.equals(regenerated), "book does not regenerate byte for byte from its seed");

var actualSummary = bookTools.auditBook(book);
equal(
  JSON.stringify(actualSummary),
  JSON.stringify(expectedSummary),
  "saved summary no longer matches a fresh audit"
);
equal(
  fs.readFileSync(reportPath, "utf8"),
  bookTools.markdownReport(manifest, expectedSummary),
  "saved Markdown report no longer matches the manifest and audit"
);

var lines = fs.readFileSync(jsonlPath, "utf8").trim().split("\n");
equal(lines.length, 50000, "debug JSONL must expose exactly 50,000 rows");

[0, 1, 24999, 49999].forEach(function (index) {
  var saved = JSON.parse(lines[index]);
  var derived = bookTools.rowAt(book, index);
  equal(JSON.stringify(saved), JSON.stringify(derived), "debug row " + index + " changed");
});

var firstSerialized = lines[0].toLowerCase();
["wager", "bankroll", "player", "actor", "owner", "casino", "location"].forEach(
  function (forbidden) {
    assert(
      firstSerialized.indexOf(forbidden) === -1,
      "generated outcome book leaked forbidden field: " + forbidden
    );
  }
);

assert(
  Math.abs(expectedSummary.theoretical.totalRtpPercent - 96) < 0.000001,
  "saved book must retain the 96% theoretical model"
);
assert(
  expectedSummary.observedBook.humanJackpotTickets >=
    expectedSummary.observedBook.npcJackpotTickets,
  "NPC jackpot tickets must be a subset of human tickets"
);

console.log("LUX-5 50,000-row book self-test passed.");
