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
var TEMP = fs.mkdtempSync(path.join(os.tmpdir(), "axm-casino-adapter-seat-"));
var STATE_PATH = path.join(TEMP, "local-state.json");
var PORT = 18971;
var SESSION_ID = "casino-adapter-seat-selftest";
var child = null;

function request(method, pathname, body, headers) {
  return new Promise(function (resolve, reject) {
    var encoded = body === undefined ? null : JSON.stringify(body);
    var requestHeaders = Object.assign({}, headers || {});
    if (encoded !== null) {
      requestHeaders["content-type"] = "application/json";
      requestHeaders["content-length"] = Buffer.byteLength(encoded);
    }
    var req = http.request({
      hostname: "127.0.0.1",
      port: PORT,
      path: pathname,
      method: method,
      headers: requestHeaders
    }, function (response) {
      var chunks = "";
      response.setEncoding("utf8");
      response.on("data", function (chunk) { chunks += chunk; });
      response.on("end", function () {
        var json = null;
        try { json = JSON.parse(chunks); } catch (_) {}
        resolve({ status: response.statusCode, body: chunks, json: json });
      });
    });
    req.on("error", reject);
    if (encoded !== null) req.write(encoded);
    req.end();
  });
}

async function waitForReady() {
  var last;
  for (var attempt = 0; attempt < 100; attempt += 1) {
    try {
      last = await request("GET", "/state");
      if (last.status === 200 && last.json && last.json.phase === "running") return last;
    } catch (error) { last = error; }
    await new Promise(function (resolve) { setTimeout(resolve, 40); });
  }
  throw new Error("runtime did not become ready: " + (last && (last.body || last.message) || "unknown"));
}

function spawnServer() {
  var players = [
    { seat_id: "seat_1", slot: 1, display_name: "Human One", type: "human" },
    { seat_id: "seat_2", slot: 2, display_name: "Adapter Two", type: "adapter", adapter_id: "adapter-selftest" }
  ];
  child = childProcess.spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      CASINO_ALPHA_HOST: "127.0.0.1",
      CASINO_ALPHA_STATE_PATH: STATE_PATH,
      AXM_GAME_SESSION_ID: SESSION_ID,
      AXM_GAME_PLAY_MODE: "backroom_story",
      AXM_PLAYERS_JSON: JSON.stringify(players)
    }),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  var output = "";
  child.stdout.on("data", function (chunk) { output += chunk; });
  child.stderr.on("data", function (chunk) { output += chunk; });
  child.testOutput = function () { return output; };
}

function tokenFromController(controller) {
  var url = new URL(controller.url, "http://127.0.0.1/");
  return url.searchParams.get("token");
}

function adapterStatePath(sessionId, seatId) {
  return "/api/adapter/state?session=" + encodeURIComponent(sessionId) + "&seat=" + encodeURIComponent(seatId);
}

function adapterHeaders(token) {
  return { "x-axm-seat-token": token };
}

function assertForbiddenKeysAbsent(value) {
  var forbidden = new Set([
    "token", "adapterid", "hosttoken", "partytokens", "sessionseed",
    "masterorder", "requestcache", "requestorder", "worldrandom", "rateledger"
  ]);
  function visit(item, trail) {
    if (!item || typeof item !== "object") return;
    Object.keys(item).forEach(function (key) {
      assert.equal(forbidden.has(key.toLowerCase()), false, "forbidden adapter observation key at " + trail + "." + key);
      visit(item[key], trail + "." + key);
    });
  }
  visit(value, "$observation");
}

async function stopServer() {
  if (!child || child.exitCode !== null) return;
  await new Promise(function (resolve) {
    var timeout = setTimeout(function () {
      try { child.kill("SIGKILL"); } catch (_) {}
      resolve();
    }, 1500);
    child.once("exit", function () { clearTimeout(timeout); resolve(); });
    child.kill("SIGTERM");
  });
}

async function assertPortClosed() {
  for (var attempt = 0; attempt < 20; attempt += 1) {
    try {
      await request("GET", "/health");
    } catch (_) {
      return;
    }
    await new Promise(function (resolve) { setTimeout(resolve, 25); });
  }
  assert.fail("adapter selftest server port remained open");
}

(async function () {
  spawnServer();
  try {
    var publicState = await waitForReady();
    assert.equal(publicState.json.session.session_id, SESSION_ID);
    assert.deepStrictEqual(publicState.json.session.players.map(function (player) { return player.type; }), ["human", "adapter"]);
    assert.equal(JSON.stringify(publicState.json).includes("adapter-selftest"), false, "public state must not disclose adapter binding metadata");

    var bootstrap = await request("GET", "/api/host/bootstrap");
    assert.equal(bootstrap.status, 200, bootstrap.body);
    assert.equal(bootstrap.json.launch.adapterBindings.length, 1);
    var binding = bootstrap.json.launch.adapterBindings[0];
    assert.equal(binding.sessionId, SESSION_ID);
    assert.equal(binding.seatId, "seat_2");
    assert.equal(binding.controllerType, "adapter");
    assert.equal(binding.adapterId, "adapter-selftest");
    assert.equal(binding.protocol, "axm-semantic-input-v1");
    assert.equal(binding.observation, "axm-seat-screen-semantics-v1");
    assert.equal(binding.observationProfile, "axm.casino-alpha-adapter-observation/v1");
    assert.ok(binding.token && binding.token.length >= 20, "trusted loopback bootstrap must issue an ephemeral adapter token");
    assert.equal(JSON.stringify(bootstrap.json.state).includes(binding.token), false, "host observation must not embed seat tokens");

    var humanController = bootstrap.json.launch.controllers.find(function (controller) { return controller.seatId === "seat_1"; });
    var humanToken = tokenFromController(humanController);
    var statePath = adapterStatePath(SESSION_ID, binding.seatId);

    var wrongTokenState = await request("GET", statePath, undefined, adapterHeaders("wrong-token"));
    assert.equal(wrongTokenState.status, 403);
    assert.equal(wrongTokenState.json.code, "SEAT_TOKEN_REJECTED");
    var wrongSessionState = await request("GET", adapterStatePath("another-session", binding.seatId), undefined, adapterHeaders(binding.token));
    assert.equal(wrongSessionState.status, 409);
    assert.equal(wrongSessionState.json.code, "SESSION_BINDING_REJECTED");
    var humanState = await request("GET", adapterStatePath(SESSION_ID, "seat_1"), undefined, adapterHeaders(humanToken));
    assert.equal(humanState.status, 403);
    assert.equal(humanState.json.code, "ADAPTER_SEAT_REQUIRED");

    var observation = await request("GET", statePath, undefined, adapterHeaders(binding.token));
    assert.equal(observation.status, 200, observation.body);
    assert.equal(observation.json.schema, "axm-seat-screen-semantics-v1");
    assert.equal(observation.json.profile, "axm.casino-alpha-adapter-observation/v1");
    assert.equal(observation.json.scope, "seat-and-shared-screen-visible-only");
    assert.equal(observation.json.self.seatId, binding.seatId);
    assert.equal(observation.json.self.controllerType, "adapter");
    assert.equal(observation.json.controls.gate, "casino-alpha-seat-authority-v1");
    assert.equal(observation.json.controls.nextSequenceMinimum, 1);
    assertForbiddenKeysAbsent(observation.json);

    var baseAdapterPacket = {
      sessionId: SESSION_ID,
      seatId: binding.seatId,
      sequence: 1,
      requestId: "adapter-outcome-rejection-1",
      intent: { type: "spin", wallet: 999 }
    };
    var wrongTokenIntent = await request("POST", "/api/adapter/intent", baseAdapterPacket, adapterHeaders("wrong-token"));
    assert.equal(wrongTokenIntent.status, 403);
    assert.equal(wrongTokenIntent.json.code, "SEAT_TOKEN_REJECTED");
    var humanIntent = await request("POST", "/api/adapter/intent", {
      sessionId: SESSION_ID,
      seatId: "seat_1",
      sequence: 1,
      requestId: "human-adapter-route-1",
      intent: { type: "set_wager", wager: 1 }
    }, adapterHeaders(humanToken));
    assert.equal(humanIntent.status, 403);
    assert.equal(humanIntent.json.code, "ADAPTER_SEAT_REQUIRED");
    var outcomeRejected = await request("POST", "/api/adapter/intent", baseAdapterPacket, adapterHeaders(binding.token));
    assert.equal(outcomeRejected.status, 400);
    assert.equal(outcomeRejected.json.code, "OUTCOME_FIELD_REJECTED");

    var humanReceipt = await request("POST", "/api/player/command", {
      seatId: "seat_1",
      token: humanToken,
      sequence: 1,
      requestId: "human-set-wager-1",
      command: { type: "set_wager", wager: 1 }
    });
    assert.equal(humanReceipt.status, 200, humanReceipt.body);
    var adapterReceipt = await request("POST", "/api/adapter/intent", {
      sessionId: SESSION_ID,
      seatId: binding.seatId,
      sequence: 1,
      requestId: "adapter-set-wager-1",
      intent: { type: "set_wager", wager: 1 }
    }, adapterHeaders(binding.token));
    assert.equal(adapterReceipt.status, 200, adapterReceipt.body);
    assert.equal(adapterReceipt.json.gate, humanReceipt.json.gate);
    assert.equal(adapterReceipt.json.protocol, humanReceipt.json.protocol);
    assert.deepStrictEqual(adapterReceipt.json.sanitized, humanReceipt.json.sanitized);
    assert.equal(adapterReceipt.json.gate, "casino-alpha-seat-authority-v1");

    var beforeSpin = await request("GET", statePath, undefined, adapterHeaders(binding.token));
    var spinPacket = {
      sessionId: SESSION_ID,
      seatId: binding.seatId,
      sequence: 2,
      requestId: "adapter-spin-2",
      intent: { type: "spin", wager: 1 }
    };
    var spin = await request("POST", "/api/adapter/intent", spinPacket, adapterHeaders(binding.token));
    assert.equal(spin.status, 200, spin.body);
    assert.equal(spin.json.acceptedSequence, 2);
    assert.equal(typeof spin.json.result.drawIndex, "number");
    var duplicate = await request("POST", "/api/adapter/intent", spinPacket, adapterHeaders(binding.token));
    assert.equal(duplicate.status, 200, duplicate.body);
    assert.deepStrictEqual(duplicate.json, spin.json, "duplicate adapter request must replay exactly one receipt");
    var afterDuplicate = await request("GET", statePath, undefined, adapterHeaders(binding.token));
    assert.equal(afterDuplicate.json.hud.drawSpine.totalConsumed, beforeSpin.json.hud.drawSpine.totalConsumed + 1);

    var stale = await request("POST", "/api/adapter/intent", {
      sessionId: SESSION_ID,
      seatId: binding.seatId,
      sequence: 2,
      requestId: "adapter-stale-sequence-2",
      intent: { type: "set_wager", wager: 2 }
    }, adapterHeaders(binding.token));
    assert.equal(stale.status, 409);
    assert.equal(stale.json.code, "STALE_SEQUENCE");
    assert.equal(afterDuplicate.json.controls.nextSequenceMinimum, 3);
    assert.deepStrictEqual(afterDuplicate.json.self.lastSpin, spin.json.result);
    assertForbiddenKeysAbsent(afterDuplicate.json);

    await stopServer();
    await assertPortClosed();
    assert.ok(fs.existsSync(STATE_PATH), "server must persist local simulated-credit state");
    var persistedText = fs.readFileSync(STATE_PATH, "utf8");
    assert.equal(persistedText.includes(binding.token), false, "ephemeral adapter token must not reach persistent state");
    assert.equal(persistedText.includes(humanToken), false, "ephemeral human token must not reach persistent state");
    var persisted = JSON.parse(persistedText);
    assert.deepStrictEqual(Object.keys(persisted).sort(), ["jackpotHeatPaidSpins", "jackpotUnits", "schema", "story", "updatedAt", "version"]);

    console.log("Casino adapter seat selftest: PASS (explicit binding, denied identities, shared gate, bounded observation, authoritative exactly-once draw, token-free persistence)");
  } catch (error) {
    console.error(error);
    console.error("SERVER OUTPUT\n" + (child && child.testOutput ? child.testOutput() : ""));
    process.exitCode = 1;
  } finally {
    await stopServer();
    try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch (_) {}
  }
})();
