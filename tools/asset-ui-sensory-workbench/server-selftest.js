#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const Server = require("./server");
const Hands = require("../../shared/asset-hands/asset-hands");
const Fabric = require("../../shared/deterministic-ui-fabric");
const Core = require("./core");

function listen(server) { return new Promise((resolve) => server.listening ? resolve() : server.once("listening", resolve)); }
function close(server) { return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
async function json(url, options) { const response = await fetch(url, options); const body = await response.json(); return { response, body }; }

(async () => {
  const server = Server.start({ port: 0, hands: Hands, fabric: Fabric, sensoryCore: Core });
  await listen(server);
  const base = "http://127.0.0.1:" + server.address().port;
  let output = await json(base + "/api/health");
  assert.equal(output.response.status, 200);
  assert.equal(output.body.status, "READY");
  assert.equal(output.body.budgets.request_body_max_bytes, 262144);
  output = await json(base + "/api/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ create: Server.defaultCreate(), seed: "server-ui", createdAt: "2026-08-22T00:00:00.000Z" }) });
  assert.equal(output.response.status, 200);
  assert.equal(output.body.status, "READY");
  assert.equal(output.body.result.hand.version, "1.2.0");
  assert.deepEqual(output.body.result.artifacts.map((item) => item.id), ["ui-source", "ui-metadata", "ui-recipe"]);
  assert.equal(output.body.handoff.preview.static_visual_only, true);
  const originalDigest = output.body.result.digest;
  const recipe = JSON.parse(output.body.result.artifacts.find((item) => item.id === "ui-recipe").text);
  recipe.title = "Server edited UI";
  recipe.target.dimensions = { width: 640, height: 180, unit: "px" };
  recipe.target.focus_ring = { colour: "#00FF99", width: 6 };
  recipe.geometry = { inset: 12, radius: 24, nine_slice: { left: 28, top: 24, right: 30, bottom: 26 } };
  recipe.palette = { surface: "#241233", accent: "#805AD5", foreground: "#FFFFFF", attention: "#00FF99" };
  output = await json(base + "/api/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipe, seed: recipe.seed, createdAt: "2026-08-22T00:00:00.000Z" }) });
  assert.equal(output.body.status, "READY");
  assert.notEqual(output.body.result.digest, originalDigest);
  assert.equal(output.body.handoff.operation_mode, "edit");
  const staticResponse = await fetch(base + "/");
  assert.equal(staticResponse.status, 200);
  assert.match(staticResponse.headers.get("content-security-policy"), /object-src 'none'/);
  assert.match(await staticResponse.text(), /data-module="asset-ui-sensory-workbench"/);
  const containmentResponse = await fetch(base + "/mobile-containment.css");
  assert.equal(containmentResponse.status, 200);
  assert.match(await containmentResponse.text(), /\.lower-grid\s*>\s*\*/);
  output = await json(base + "/api/create", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://evil.invalid" }, body: "{}" });
  assert.equal(output.response.status, 403);
  assert.equal(output.body.code, "ORIGIN_REFUSED");
  output = await json(base + "/api/create", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
  assert.equal(output.response.status, 415);
  assert.equal(output.body.code, "CONTENT_TYPE_REFUSED");
  output = await json(base + "/api/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noise: "x".repeat(Server.MAX_BODY_BYTES + 1) }) });
  assert.equal(output.response.status, 413);
  assert.equal(output.body.code, "REQUEST_BUDGET_EXCEEDED");
  await close(server);

  const degradedHands = { RESULT_SCHEMA: Hands.RESULT_SCHEMA, list() { return []; }, create() { throw new Error("must not execute"); } };
  const degraded = Server.start({ port: 0, hands: degradedHands, fabric: Fabric, sensoryCore: Core });
  await listen(degraded);
  output = await json("http://127.0.0.1:" + degraded.address().port + "/api/health");
  assert.equal(output.body.status, "DEGRADED");
  assert.equal(output.body.hand_registered, false);
  await close(degraded);
  console.log("AXM UI sensory server selftest: PASS (loopback create/edit, exact three-artifact replacement, budgets, CSP/static, origin/type refusal, degraded mode)");
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
