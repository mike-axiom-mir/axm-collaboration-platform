#!/usr/bin/env node
"use strict";

// One-shot local generator. Existing books are protected from accidental rerolls.

var fs = require("fs");
var path = require("path");
var model = require("./lux5-model.js");
var rng = require("./lux5-rng.js");
var bookTools = require("./lux5-outcome-book.js");

function parseArgs(argv) {
  var args = {
    seed: null,
    length: model.constants.tableLength,
    outputDir: path.resolve(__dirname, "../../../../../../exports/lux5-rng"),
    force: false
  };

  for (var index = 0; index < argv.length; index += 1) {
    var value = argv[index];
    if (value === "--seed") {
      if (index + 1 >= argv.length || argv[index + 1].indexOf("--") === 0) {
        throw new Error("--seed requires a value");
      }
      args.seed = argv[++index];
    } else if (value === "--length") {
      if (index + 1 >= argv.length || argv[index + 1].indexOf("--") === 0) {
        throw new Error("--length requires a value");
      }
      args.length = Number(argv[++index]);
    } else if (value === "--output-dir") {
      if (index + 1 >= argv.length || argv[index + 1].indexOf("--") === 0) {
        throw new Error("--output-dir requires a value");
      }
      args.outputDir = path.resolve(argv[++index]);
    } else if (value === "--force") {
      args.force = true;
    } else {
      throw new Error("unknown argument: " + value);
    }
  }
  return args;
}

function refuseOverwrite(paths, force) {
  if (force) {
    return;
  }
  paths.forEach(function (filePath) {
    if (fs.existsSync(filePath)) {
      throw new Error(
        "refusing to overwrite an existing RNG book; pass --force only when intentionally regenerating: " +
          filePath
      );
    }
  });
}

function main() {
  var args = parseArgs(process.argv.slice(2));
  var validation = model.validateModel();
  var seed = args.seed || rng.createSessionSeed();
  var stem = "lux5-outcome-book-" + args.length;
  var binaryPath = path.join(args.outputDir, stem + ".bin");
  var jsonlPath = path.join(args.outputDir, stem + ".jsonl");
  var summaryPath = path.join(args.outputDir, stem + ".summary.json");
  var reportPath = path.join(args.outputDir, stem + ".report.md");
  var manifestPath = path.join(args.outputDir, stem + ".manifest.json");
  var book;
  var audit;
  var manifest;

  if (!validation.ok) {
    throw new Error("LUX-5 model validation failed: " + validation.errors.join("; "));
  }

  fs.mkdirSync(args.outputDir, { recursive: true });
  refuseOverwrite(
    [binaryPath, jsonlPath, summaryPath, reportPath, manifestPath],
    args.force
  );

  console.log("Generating " + args.length.toLocaleString("en-US") + " LUX-5 records once...");
  book = rng.buildBook(seed, args.length);
  audit = bookTools.auditBook(book);
  manifest = {
    schema: "lux5-outcome-book-manifest",
    version: 1,
    styleId: model.constants.styleId,
    mathVersion: model.constants.mathVersion,
    seed: seed,
    records: args.length,
    recordBytes: model.constants.recordBytes,
    bookBytes: book.length,
    reelLengths: model.reelStrips.map(function (strip) {
      return strip.length;
    }),
    wheelDeltasBps: model.wheelDeltasBps.slice(),
    jackpotDenominator: model.constants.jackpotDenominator,
    humanJackpotThreshold: model.constants.humanJackpotThreshold,
    npcJackpotThreshold: model.constants.npcJackpotThreshold,
    files: {
      binary: path.basename(binaryPath),
      debugJsonl: path.basename(jsonlPath),
      summary: path.basename(summaryPath),
      report: path.basename(reportPath)
    }
  };

  fs.writeFileSync(binaryPath, book);
  bookTools.writeDebugJsonl(book, jsonlPath);
  fs.writeFileSync(summaryPath, JSON.stringify(audit, null, 2) + "\n", "utf8");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  fs.writeFileSync(reportPath, bookTools.markdownReport(manifest, audit), "utf8");

  console.log("Seed: " + seed);
  console.log("Binary book: " + binaryPath);
  console.log("Debug book:  " + jsonlPath);
  console.log("Audit report: " + reportPath);
}

main();
