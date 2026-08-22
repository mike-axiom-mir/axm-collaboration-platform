"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var test = require("node:test");
var createEvidenceHarness = require("./disconnect-recovery-browser-harness.js").createEvidenceHarness;

async function getJson(url) {
  var response = await fetch(url);
  var value = await response.json();
  assert.equal(response.ok, true, "GET " + url + " should succeed: " + JSON.stringify(value));
  return value;
}

async function postJson(url, body) {
  var response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  var value = await response.json();
  assert.equal(response.ok, true, "POST " + url + " should succeed: " + JSON.stringify(value));
  return value;
}

function controllerBinding(controllerUrl) {
  var url = new URL(controllerUrl);
  return { seatId: url.searchParams.get("seat"), token: url.searchParams.get("token") };
}

function stateUrl(baseUrl, binding) {
  return baseUrl + "/api/player/state?seat=" + encodeURIComponent(binding.seatId) + "&token=" + encodeURIComponent(binding.token);
}

function commandPacket(binding, sequence, wager) {
  return {
    seatId: binding.seatId,
    token: binding.token,
    sequence: sequence,
    requestId: "disconnect-recovery-" + sequence,
    command: { type: "set_wager", wager: wager }
  };
}

test("production controller exposes persistent fail-closed loss and automatic recovery states", function () {
  var app = fs.readFileSync(path.resolve(__dirname, "..", "client", "app.js"), "utf8");
  var styles = fs.readFileSync(path.resolve(__dirname, "..", "client", "styles.css"), "utf8");

  assert.match(app, /var controllerLinkState = "connecting"/);
  assert.match(app, /LOCAL LINK/);
  assert.match(app, /LOST · RETRYING/);
  assert.match(app, /querySelectorAll\("\[data-command\]"\).*button\.disabled = true/);
  assert.match(app, /showToast\("Local link restored"\)/);
  assert.match(app, /setInterval\(poll, role === "controller" \? 650 : 900\)/);
  assert.match(app, /error\.localResponse = true/);
  assert.match(app, /controller" && !error\.localResponse/);
  assert.match(app, /controllerLinkState !== "live"/);
  assert.match(styles, /\.controller-link-state\.lost/);
  assert.match(styles, /\.controller-link-lost \[data-command\]:disabled/);
});

test("Casino Alpha keeps authority stable through a cut and accepts the next sequenced command after restoration", async function (t) {
  var harness = await createEvidenceHarness();
  t.after(function () { return harness.close(); });
  var binding = controllerBinding(harness.controllerUrl);
  assert.equal(binding.seatId, "seat_1");
  assert.ok(binding.token);

  var baseline = await getJson(stateUrl(harness.url, binding));
  assert.equal(baseline.sessionId, "casino-disconnect-evidence-session");
  assert.equal(baseline.ownPlayer.acceptedSequence, 0);

  await postJson(harness.url + "/api/player/command", commandPacket(binding, 1, 5));
  var beforeCut = await getJson(stateUrl(harness.url, binding));
  assert.equal(beforeCut.ownPlayer.selectedWager, 5);
  assert.equal(beforeCut.ownPlayer.acceptedSequence, 1);

  harness.drop();
  await assert.rejects(fetch(stateUrl(harness.url, binding)), "the fault proxy must reject controller traffic while cut");
  var authoritativeDuringCut = await getJson(stateUrl(harness.origin, binding));
  assert.equal(authoritativeDuringCut.sessionId, beforeCut.sessionId);
  assert.equal(authoritativeDuringCut.ownPlayer.selectedWager, 5);
  assert.equal(authoritativeDuringCut.ownPlayer.acceptedSequence, 1);

  harness.restore();
  await postJson(harness.url + "/api/player/command", commandPacket(binding, 2, 10));
  var recovered = await getJson(stateUrl(harness.url, binding));
  assert.equal(recovered.sessionId, beforeCut.sessionId);
  assert.equal(recovered.ownPlayer.selectedWager, 10);
  assert.equal(recovered.ownPlayer.acceptedSequence, 2);
});
