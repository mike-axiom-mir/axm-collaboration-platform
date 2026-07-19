#!/usr/bin/env node
"use strict";

var childProcess = require("child_process");
var path = require("path");

var ROOT = path.resolve(__dirname, "../..");
var scripts = [
  "slots/lux-5/lux5-math-selftest.js",
  "slots/lux-5/lux5-book-selftest.js",
  "slots/slot-catalog-selftest.js",
  "slots/axm-draw-spine-selftest.js",
  "alpha/tests/core-selftest.js",
  "alpha/tests/server-selftest.js",
  "alpha/tests/game-hub-integration-selftest.js",
  "alpha/tests/package-selftest.js"
];

for (var script of scripts) {
  console.log("\n=== " + script + " ===");
  var result = childProcess.spawnSync(process.execPath, [path.join(ROOT, script)], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error("Casino alpha verification stopped at " + script + ".");
    process.exit(result.status || 1);
  }
}

console.log("\nCasino alpha v0.3.2 Overdrive Theater verification: PASS (browser and physical-phone QA remain separate and unrun)");
