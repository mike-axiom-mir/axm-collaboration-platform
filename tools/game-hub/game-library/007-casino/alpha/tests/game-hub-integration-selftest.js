#!/usr/bin/env node
"use strict";

var assert = require("assert");
var childProcess = require("child_process");
var fs = require("fs");
var http = require("http");
var os = require("os");
var path = require("path");

var GAME_ROOT = path.resolve(__dirname, "../..");
var SOURCE_HUB = path.resolve(GAME_ROOT, "../..");
var TEMP = fs.mkdtempSync(path.join(os.tmpdir(), "axm-casino-hub-stage-"));
var STAGE_HUB = path.join(TEMP, "game-hub");
var HUB_PORT = 18889;
var RUNTIME_PORT = 18797;
var child = null;
var output = "";

function stageFiles() {
  fs.mkdirSync(path.join(STAGE_HUB, "game-library"), { recursive: true });
  fs.copyFileSync(path.join(SOURCE_HUB, "game-hub-server.js"), path.join(STAGE_HUB, "game-hub-server.js"));
  fs.copyFileSync(path.join(SOURCE_HUB, "asset-handoff.js"), path.join(STAGE_HUB, "asset-handoff.js"));
  fs.copyFileSync(path.join(SOURCE_HUB, "universal-control-policy.js"), path.join(STAGE_HUB, "universal-control-policy.js"));
  fs.cpSync(path.join(SOURCE_HUB, "game-engine"), path.join(STAGE_HUB, "game-engine"), { recursive: true });
  fs.cpSync(GAME_ROOT, path.join(STAGE_HUB, "game-library", "007-casino-alpha"), {
    recursive: true,
    filter: function (source) {
      return !/[/\\]alpha[/\\]data[/\\]local-state\.json$/.test(source);
    }
  });
  var stagedManifestPath = path.join(STAGE_HUB, "game-library", "007-casino-alpha", "game.manifest.json");
  var stagedManifest = JSON.parse(fs.readFileSync(stagedManifestPath, "utf8"));
  stagedManifest.launch.port = RUNTIME_PORT;
  fs.writeFileSync(stagedManifestPath, JSON.stringify(stagedManifest, null, 2) + "\n");
}

function request(port, method, pathname, body) {
  return new Promise(function (resolve, reject) {
    var encoded = body === undefined ? null : JSON.stringify(body);
    var headers = {};
    if (encoded !== null) {
      headers["content-type"] = "application/json";
      headers["content-length"] = Buffer.byteLength(encoded);
    }
    var req = http.request({ hostname: "127.0.0.1", port: port, path: pathname, method: method, headers: headers }, function (res) {
      var text = "";
      res.setEncoding("utf8");
      res.on("data", function (chunk) { text += chunk; });
      res.on("end", function () {
        var json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, body: text, json: json });
      });
    });
    req.on("error", reject);
    if (encoded !== null) req.write(encoded);
    req.end();
  });
}

async function waitFor(port, pathname, predicate) {
  var last;
  for (var attempt = 0; attempt < 120; attempt += 1) {
    try {
      last = await request(port, "GET", pathname);
      if (last.status >= 200 && last.status < 500 && (!predicate || predicate(last))) return last;
    } catch (error) { last = error; }
    await new Promise(function (resolve) { setTimeout(resolve, 50); });
  }
  throw new Error("timed out waiting for " + port + pathname + ": " + (last && (last.body || last.message) || "unknown"));
}

async function post(port, pathname, body) {
  var response = await request(port, "POST", pathname, body);
  if (response.status < 200 || response.status >= 300 || !response.json || response.json.ok === false) {
    throw new Error(pathname + " failed: " + response.status + " " + response.body);
  }
  return response.json;
}

async function assignAndReady(slot, name) {
  await post(HUB_PORT, "/seat/assign", { seat_id: "seat_" + slot, patch: { type: "human", display_name: name } });
  await post(HUB_PORT, "/seat/ready", { seat_id: "seat_" + slot, ready: true });
}

async function finishManaged(bootstrap) {
  var ended = await post(RUNTIME_PORT, "/api/host/end", { hostToken: bootstrap.launch.hostToken });
  var hubReceipt = await post(HUB_PORT, "/game/end", { summary: ended.result_summary });
  assert.equal(hubReceipt.result.game_id, "007-casino-alpha");
  var state = await waitFor(HUB_PORT, "/state");
  assert.equal(state.json.state.session.phase, "LOBBY");
  assert.equal(state.json.state.result_summary.session_id, ended.result_summary.session_id);
}

(async function () {
  try {
    stageFiles();
    child = childProcess.spawn(process.execPath, [path.join(STAGE_HUB, "game-hub-server.js")], {
      cwd: STAGE_HUB,
      env: Object.assign({}, process.env, {
        AXM_GAME_HUB_HOST: "127.0.0.1",
        AXM_GAME_HUB_PORT: String(HUB_PORT),
        CASINO_ALPHA_HOST: "127.0.0.1",
        CASINO_ALPHA_STATE_PATH: path.join(TEMP, "managed-local-state.json")
      }),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", function (chunk) { output += chunk; });
    child.stderr.on("data", function (chunk) { output += chunk; });

    await waitFor(HUB_PORT, "/health");
    var games = await waitFor(HUB_PORT, "/games");
    assert.equal(games.json.games.filter(function (game) { return game.game_id === "007-casino-alpha"; }).length, 1);

    await assignAndReady(1, "A One");
    await assignAndReady(2, "A Two");
    await assignAndReady(5, "B One");
    await assignAndReady(6, "B Two");
    var refusedStory = await request(HUB_PORT, "POST", "/game/start", { game_id: "007-casino-alpha", play_mode: "backroom_story" });
    assert.equal(refusedStory.status, 409);
    assert.match(refusedStory.json.error, /Party A seats 1-4 only/);
    var war = await post(HUB_PORT, "/game/start", { game_id: "007-casino-alpha", play_mode: "house_war" });
    assert.equal(war.selected_players.length, 4);
    assert.equal(war.play_mode, "house_war");
    assert.deepStrictEqual(war.selected_players.map(function (player) { return player.slot; }).sort(), [1, 2, 5, 6]);
    assert.equal(war.runtime_port, RUNTIME_PORT);
    assert.equal(war.client_url, "http://127.0.0.1:" + RUNTIME_PORT + "/?role=host&play=1");
    assert.equal(war.controller_urls.length, 4);
    assert.ok(war.controller_urls.every(function (link) {
      return new RegExp("^http://127\\.0\\.0\\.1:" + RUNTIME_PORT + "/\\?role=controller&seat=seat_[1256]&token=").test(link.local_url);
    }));
    var runtime = await waitFor(RUNTIME_PORT, "/state", function (response) { return response.json && response.json.phase === "running"; });
    assert.equal(runtime.json.session.mode, "house_war");
    assert.equal(runtime.json.session.players.length, 4);
    var bootstrap = (await waitFor(RUNTIME_PORT, "/api/host/bootstrap")).json;
    assert.equal(bootstrap.launch.controllers.length, 4);
    assert.equal(bootstrap.state.styles.length, 10);
    assert.equal(bootstrap.state.styles.filter(function (style) { return style.unlocked; }).length, 10);
    await finishManaged(bootstrap);

    await assignAndReady(1, "Free Player");
    var story = await post(HUB_PORT, "/game/start", { game_id: "007-casino-alpha", play_mode: "backroom_story" });
    assert.equal(story.selected_players.length, 1);
    assert.equal(story.play_mode, "backroom_story");
    assert.equal(story.client_url, "http://127.0.0.1:" + RUNTIME_PORT + "/?role=host&play=1");
    assert.equal(story.controller_urls.length, 1);
    runtime = await waitFor(RUNTIME_PORT, "/state", function (response) { return response.json && response.json.phase === "running"; });
    assert.equal(runtime.json.session.mode, "backroom_story");
    assert.deepStrictEqual(runtime.json.session.players.map(function (player) { return player.slot; }), [1]);
    bootstrap = (await waitFor(RUNTIME_PORT, "/api/host/bootstrap")).json;
    assert.equal(bootstrap.state.styles.length, 10);
    assert.equal(bootstrap.state.styles.filter(function (style) { return style.discoverable && style.unlocked; }).length, 10);
    assert.equal(bootstrap.state.quest, null);
    await finishManaged(bootstrap);

    console.log("Casino alpha Game Hub integration selftest: PASS (staged discovery, ready seats, managed 2v2, direct solo free-play intent, result return)");
  } catch (error) {
    console.error(error);
    console.error("GAME HUB OUTPUT\n" + output);
    process.exitCode = 1;
  } finally {
    if (child && child.exitCode === null) {
      try { child.kill("SIGTERM"); } catch (_) {}
      await new Promise(function (resolve) { setTimeout(resolve, 250); });
      if (child.exitCode === null) try { child.kill("SIGKILL"); } catch (_) {}
    }
    try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch (_) {}
  }
})();
