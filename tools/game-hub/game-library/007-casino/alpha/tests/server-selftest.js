#!/usr/bin/env node
"use strict";

var assert = require("assert");
var childProcess = require("child_process");
var fs = require("fs");
var http = require("http");
var os = require("os");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var SERVER = path.join(ROOT, "runtime", "casino-server.cjs");
var TEMP = fs.mkdtempSync(path.join(os.tmpdir(), "axm-casino-alpha-"));
var STATE_PATH = path.join(TEMP, "local-state.json");
var children = [];

function request(port, method, pathname, body, headers) {
  return new Promise(function (resolve, reject) {
    var encoded = body === undefined ? null : JSON.stringify(body);
    var requestHeaders = Object.assign({}, headers || {});
    if (encoded !== null) {
      requestHeaders["content-type"] = "application/json";
      requestHeaders["content-length"] = Buffer.byteLength(encoded);
    }
    var req = http.request({ hostname: "127.0.0.1", port: port, path: pathname, method: method, headers: requestHeaders }, function (res) {
      var chunks = "";
      res.setEncoding("utf8");
      res.on("data", function (chunk) { chunks += chunk; });
      res.on("end", function () {
        var json = null;
        try { json = JSON.parse(chunks); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: chunks, json: json });
      });
    });
    req.on("error", reject);
    if (encoded !== null) req.write(encoded);
    req.end();
  });
}

async function waitFor(port, pathname) {
  var last;
  for (var attempt = 0; attempt < 100; attempt += 1) {
    try {
      last = await request(port, "GET", pathname);
      if (last.status >= 200 && last.status < 500) return last;
    } catch (error) { last = error; }
    await new Promise(function (resolve) { setTimeout(resolve, 40); });
  }
  throw new Error("runtime did not become ready: " + (last && (last.body || last.message) || "unknown"));
}

function spawnServer(port, extraEnvironment) {
  var child = childProcess.spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      CASINO_ALPHA_HOST: "127.0.0.1",
      CASINO_ALPHA_STATE_PATH: STATE_PATH
    }, extraEnvironment || {}),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  var output = "";
  child.stdout.on("data", function (chunk) { output += chunk; });
  child.stderr.on("data", function (chunk) { output += chunk; });
  child.testOutput = function () { return output; };
  children.push(child);
  return child;
}

function tokenFromController(controller) {
  var url = new URL(controller.url, "http://127.0.0.1/");
  return { seatId: url.searchParams.get("seat"), token: url.searchParams.get("token") };
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise(function (resolve) {
    var timeout = setTimeout(function () { try { child.kill("SIGKILL"); } catch (_) {} resolve(); }, 1500);
    child.once("exit", function () { clearTimeout(timeout); resolve(); });
    child.kill("SIGTERM");
  });
}

(async function () {
  var port = 18797;
  var child = spawnServer(port);
  try {
    var health = await waitFor(port, "/health");
    assert.equal(health.status, 200);
    assert.equal(health.json.phase, "waiting");
    assert.equal(health.json.local_only, true);

    var html = await request(port, "GET", "/");
    assert.equal(html.status, 200);
    assert.ok(html.body.includes("Casino Alpha"));
    assert.ok(String(html.headers["content-security-policy"]).includes("default-src 'self'"));
    assert.ok(!html.body.includes("<script>"), "client must not need an inline script exception");
    for (var asset of ["/app.js", "/styles.css"]) {
      var response = await request(port, "GET", asset);
      assert.equal(response.status, 200);
      assert.ok(response.body.length > 1000, asset + " must be a substantive local asset");
    }

    var started = await request(port, "POST", "/api/host/start", { mode: "house_war", teamSize: 2 });
    assert.equal(started.status, 201, started.body);
    assert.equal(started.json.launch.controllers.length, 4);
    assert.equal(started.json.state.mode, "house_war");
    assert.equal(started.json.state.players.filter(function (player) { return player.partyId === "A"; }).length, 2);
    assert.equal(started.json.state.players.filter(function (player) { return player.partyId === "B"; }).length, 2);
    assert.equal(started.json.state.styles.length, 10);
    assert.equal(started.json.state.styles.filter(function (style) { return style.unlocked; }).length, 10);
    assert.equal(started.json.state.drawSpine.registeredStyles, 10);

    var controller = tokenFromController(started.json.launch.controllers[0]);
    var privateState = await request(port, "GET", "/api/player/state?seat=" + controller.seatId + "&token=" + encodeURIComponent(controller.token));
    assert.equal(privateState.status, 200);
    assert.equal(privateState.json.ownPlayer.seatId, "seat_1");
    assert.equal(privateState.json.parties.find(function (party) { return party.id === "B"; }).house, null);
    assert.equal(Object.prototype.hasOwnProperty.call(privateState.json.style, "seed"), false);

    var rejected = await request(port, "GET", "/api/player/state?seat=seat_1&token=wrong");
    assert.equal(rejected.status, 403);
    assert.equal(rejected.json.code, "SEAT_TOKEN_REJECTED");
    var rejectedParty = await request(port, "GET", "/api/party/state?party=A&token=wrong");
    assert.equal(rejectedParty.status, 403);
    assert.equal(rejectedParty.json.code, "PARTY_TOKEN_REJECTED");
    var partyUrl = new URL(started.json.launch.partyScreens[0].url, "http://127.0.0.1/");
    var partyState = await request(port, "GET", "/api/party/state?party=" + partyUrl.searchParams.get("party") + "&token=" + encodeURIComponent(partyUrl.searchParams.get("token")));
    assert.equal(partyState.status, 200);
    assert.equal(typeof partyState.json.parties.find(function (party) { return party.id === "A"; }).house, "number");
    assert.equal(partyState.json.parties.find(function (party) { return party.id === "B"; }).house, null);

    var travelPacket = {
      seatId: controller.seatId,
      token: controller.token,
      sequence: 1,
      requestId: "server-travel-1",
      command: { type: "travel", location: "contest" }
    };
    var travelled = await request(port, "POST", "/api/player/command", travelPacket);
    assert.equal(travelled.status, 200, travelled.body);
    var spinPacket = {
      seatId: controller.seatId,
      token: controller.token,
      sequence: 2,
      requestId: "server-spin-1",
      command: { type: "spin", wager: 5 }
    };
    var spin = await request(port, "POST", "/api/player/command", spinPacket);
    assert.equal(spin.status, 200, spin.body);
    assert.equal(spin.json.result.drawIndex, 0);
    assert.equal(spin.json.result.styleId, started.json.state.contest.styleId);
    assert.equal(typeof spin.json.result.presentation.layout, "string");
    var duplicate = await request(port, "POST", "/api/player/command", spinPacket);
    assert.deepStrictEqual(duplicate.json, spin.json);

    var hostState = await request(port, "GET", "/api/host/state?hostToken=" + encodeURIComponent(started.json.launch.hostToken));
    assert.equal(hostState.status, 200);
    assert.equal(hostState.json.drawSpine.totalConsumed, 1);
    assert.equal(typeof hostState.json.diagnostics.conserved, "number");

    var advanced = await request(port, "POST", "/api/host/advance", { hostToken: started.json.launch.hostToken, milliseconds: 60000 });
    assert.equal(advanced.status, 200, advanced.body);
    assert.ok(advanced.json.drawSpine.totalConsumed >= 1);

    var ended = await request(port, "POST", "/api/host/end", { hostToken: started.json.launch.hostToken });
    assert.equal(ended.status, 200, ended.body);
    assert.equal(ended.json.result_summary.game_id, "007-casino-alpha");
    assert.equal(ended.json.result_summary.status, "ended");
    var result = await request(port, "GET", "/api/result");
    assert.deepStrictEqual(result.json.result_summary, ended.json.result_summary);
    assert.ok(fs.existsSync(STATE_PATH), "local progressive state must be written outside source assets");
    var stored = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    assert.equal(stored.schema, "axm.casino-local-state/v1");
    assert.equal(Number.isSafeInteger(stored.jackpotUnits), true);

    await stop(child);

    var managedPort = 18798;
    var managedPlayers = [
      { seat_id: "seat_1", slot: 1, display_name: "A One", type: "human" },
      { seat_id: "seat_2", slot: 2, display_name: "A Two", type: "human" },
      { seat_id: "seat_5", slot: 5, display_name: "B One", type: "human" },
      { seat_id: "seat_6", slot: 6, display_name: "B Two", type: "human" }
    ];
    child = spawnServer(managedPort, {
      AXM_GAME_SESSION_ID: "hub-managed-casino-test",
      AXM_PLAYERS_JSON: JSON.stringify(managedPlayers)
    });
    var managed = await waitFor(managedPort, "/state");
    assert.equal(managed.status, 200, managed.body);
    assert.equal(managed.json.phase, "running");
    assert.equal(managed.json.session.session_id, "hub-managed-casino-test");
    assert.equal(managed.json.session.mode, "house_war");
    assert.deepStrictEqual(managed.json.session.players.map(function (item) { return item.slot; }), [1, 2, 5, 6]);

    var bootstrap = await request(managedPort, "GET", "/api/host/bootstrap");
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.json.launch.controllers.length, 4);
    assert.equal(bootstrap.json.state.sessionId, "hub-managed-casino-test");
    assert.equal(JSON.stringify(bootstrap.json.state).includes("AXM_PLAYERS_JSON"), false);

    console.log("Casino alpha server selftest: PASS (static security, standalone 2v2, tokens, exactly-once commands, persistence, managed seat launch)");
  } catch (error) {
    console.error(error);
    console.error("SERVER OUTPUT\n" + (child && child.testOutput ? child.testOutput() : ""));
    process.exitCode = 1;
  } finally {
    for (var index = children.length - 1; index >= 0; index -= 1) await stop(children[index]);
    try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch (_) {}
  }
})();
