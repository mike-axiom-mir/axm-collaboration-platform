#!/usr/bin/env node
"use strict";

var assert = require("assert");
var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");
var verifier = require(path.resolve(__dirname, "../../../../game-package-verifier.js"));

var GAME_ROOT = path.resolve(__dirname, "../..");
var manifest = JSON.parse(fs.readFileSync(path.join(GAME_ROOT, "game.manifest.json"), "utf8"));
var errors = verifier.validateManifest(manifest, { gameDir: GAME_ROOT });
assert.deepStrictEqual(errors, [], "workbench package manifest must satisfy the live Game Hub package contract: " + errors.join("; "));
assert.equal(manifest.slot, "007");
assert.equal(manifest.version, "0.3.3-alpha");
assert.equal(manifest.launch.client_entry, "/games/007/?role=host&play=1");
assert.equal(manifest.max_players, 8);
assert.equal(manifest.rules.no_hidden_players, true);
assert.equal(manifest.rules.immutable_slot_outcomes, true);
assert.deepStrictEqual(manifest.session.party_a_seats, [1, 2, 3, 4]);
assert.deepStrictEqual(manifest.session.party_b_seats, [5, 6, 7, 8]);

for (var source of [
  "alpha/runtime/casino-core.js",
  "alpha/runtime/casino-server.cjs",
  "alpha/runtime/game-hub-adapter.js",
  "alpha/client/app.js",
  "slots/slot-catalog.js",
  "slots/axm-draw-spine.js",
  "slots/slot-catalog-selftest.js",
  "slots/axm-draw-spine-selftest.js"
]) {
  var check = childProcess.spawnSync(process.execPath, ["--check", path.join(GAME_ROOT, source)], { encoding: "utf8", windowsHide: true });
  assert.equal(check.status, 0, source + " syntax failed: " + (check.stderr || check.stdout));
}

var html = fs.readFileSync(path.join(GAME_ROOT, "alpha/client/index.html"), "utf8");
var css = fs.readFileSync(path.join(GAME_ROOT, "alpha/client/styles.css"), "utf8");
var app = fs.readFileSync(path.join(GAME_ROOT, "alpha/client/app.js"), "utf8");
var server = fs.readFileSync(path.join(GAME_ROOT, "alpha/runtime/casino-server.cjs"), "utf8");
var intake = fs.readFileSync(path.join(GAME_ROOT, "integration/PR14_INTAKE.md"), "utf8");
assert.ok(html.includes('src="./app.js"'));
assert.ok(html.includes('href="./styles.css"'));
assert.equal(/<script(?:\s[^>]*)?>\s*[^<\s]/i.test(html), false, "inline executable client source is not allowed");
assert.equal(/https?:\/\//.test(css), false, "client CSS must not fetch remote assets");
assert.equal(/https?:\/\//.test(app), false, "client app must not call outside services");
assert.ok(css.length > 12000, "alpha presentation must be more than a placeholder stylesheet");
assert.ok(app.includes("api/player/command"));
assert.ok(app.includes("api/host/state"));
assert.ok(app.includes("machine-roster"));
assert.ok(app.includes("select_machine"));
assert.ok(app.includes("All ten slots are ready."));
assert.ok(app.includes("redirectToSoloController"));
assert.equal(app.includes("renderQuest"), false);
assert.equal(app.includes("storyAction"), false);
assert.ok(css.includes(".mechanic-board"));
assert.ok(css.includes(".machine-card"));
assert.ok(app.includes("emblemShapes"));
for (var styleId of ["lux-5", "graftgarden", "mirror-mice", "night-courier", "pocket-vault", "weatherheart", "spare-parts-choir", "nullbloom", "orbit-oven", "twinlight-relay"]) {
  assert.ok(app.includes('"' + styleId + '":'), styleId + " must have an original vector emblem");
}
assert.ok(css.includes(".fresh-settlement"));
assert.ok(css.includes(".win-sparks"));
assert.ok(css.includes(".overdrive-theater"), "robot bonus theater must ship with the local presentation");
assert.ok(css.includes(".wheel-index-5"), "all six committed Overdrive faces must have a visual landing");
assert.ok(css.includes(".win-callout"), "payout-tier celebration callout must ship");
assert.ok(css.includes(".risk-panel"), "wager exposure feedback must ship");
assert.ok(app.includes('document.addEventListener("keydown"') && app.includes('event.code === "Space"') && app.includes('Digit4: 10'), "laptop keyboard controls must ship beside optional phone controls");
assert.ok(css.includes(".result-trail"), "recent settled-result history must ship");
assert.ok(app.includes("bonusTheater"));
assert.ok(app.includes("wheelFaces"));
assert.ok(app.includes("data-sound-toggle"), "optional local synthesized sound control must ship");
assert.ok(app.includes("HISTORY ONLY · NEVER A FORECAST"));
assert.ok(app.includes("The machine never reads your wallet"));
assert.ok(css.includes("grid-auto-flow:column"), "phone cabinet rail must remain readable and swipeable");
assert.ok(css.includes(".axm-signature"));
assert.equal(/\sstyle="/.test(app), false, "self-only CSP must not silently block client inline styles");
assert.ok(css.includes(".board-cols-8"));
assert.ok(server.includes('path.join(workshopRoot, "state", "game-hub", "007-casino", "local-state.json")'), "Workshop state must remain outside the packaged game directory");
assert.ok(intake.includes("PR14 already has"));
assert.ok(intake.includes("no server route patch"));
assert.equal(fs.existsSync(path.join(GAME_ROOT, "integration/workshop-slot-007.patch")), false, "obsolete duplicate slot-007 route patch must not ship");

console.log("Casino alpha package selftest: PASS (v0.3.3 quest-free play, direct solo controls, Overdrive Theater, local-only assets, syntax, eight-seat party contract)");
