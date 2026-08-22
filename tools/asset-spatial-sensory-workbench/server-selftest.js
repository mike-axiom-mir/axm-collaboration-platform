#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const Hands = require("../../shared/asset-hands/asset-hands");
const Spatial = require("../../shared/deterministic-spatial-handoff");
const Server = require("./server");

async function run() {
  const server = Server.createServer({ hands: Hands, spatial: Spatial });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = "http://127.0.0.1:" + address.port;
  try {
    let response = await fetch(base + "/api/health");
    let body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "READY");
    assert.equal(body.budgets.request_body_max_bytes, 1024 * 1024);

    const controls = Server.defaultControls();
    response = await fetch(base + "/api/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ controls, createdAt: "2026-08-22T00:00:00.000Z" }) });
    body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "READY");
    assert.equal(body.handoff.status, "PASS");
    assert.equal(body.result.artifacts.length, 4);
    const originalDigests = Object.fromEntries(body.result.artifacts.map((artifact) => [artifact.id, artifact.digest]));
    const project = JSON.parse(body.result.artifacts.find((artifact) => artifact.id === "spatial-project").text);

    const edited = Object.assign({}, controls, { primitive: "torus", dimensions: { width: 3, height: 1.25, depth: 2, unit: "m" }, max_polygon_count: 900, position: [0.25, -0.1, 0.4], rotation: [18, 37, -12], inflate: 0.15, twist: 42, baseColor: "#d8842f", metallic: 0.72, roughness: 0.28, opacity: 0.84, doubleSided: true });
    response = await fetch(base + "/api/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ controls: edited, project, createdAt: "2026-08-22T00:00:00.000Z" }) });
    body = await response.json();
    assert.equal(body.status, "READY");
    assert.equal(body.handoff.project_profile.primitive, "torus");
    body.result.artifacts.forEach((artifact) => assert.notEqual(artifact.digest, originalDigests[artifact.id]));

    response = await fetch(base + "/api/create", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
    assert.equal(response.status, 415);
    response = await fetch(base + "/api/health", { headers: { Origin: "https://example.invalid" } });
    assert.equal(response.status, 403);
    response = await fetch(base + "/api/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ padding: "x".repeat(Server.MAX_BODY_BYTES + 20) }) });
    assert.equal(response.status, 413);
    response = await fetch(base + "/");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /object-src 'none'/);
    assert.match(await response.text(), /Spatial Sensory Workbench/);
    response = await fetch(base + "/server.js", { method: "HEAD" });
    assert.equal(response.status, 200);
  } finally { await new Promise((resolve) => server.close(resolve)); }

  const unavailableHands = Object.assign({}, Hands, { list: () => [] });
  const degraded = Server.createServer({ hands: unavailableHands, spatial: Spatial });
  await new Promise((resolve) => degraded.listen(0, "127.0.0.1", resolve));
  const degradedBase = "http://127.0.0.1:" + degraded.address().port;
  try {
    let response = await fetch(degradedBase + "/api/health");
    assert.equal((await response.json()).status, "DEGRADED");
    response = await fetch(degradedBase + "/api/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ controls: Server.defaultControls() }) });
    assert.equal(response.status, 503);
  } finally { await new Promise((resolve) => degraded.close(resolve)); }

  console.log("AXM spatial sensory server selftest: PASS (loopback create/edit, four-artifact replacement, budgets, CSP/static, origin/type refusal, degraded mode)");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
