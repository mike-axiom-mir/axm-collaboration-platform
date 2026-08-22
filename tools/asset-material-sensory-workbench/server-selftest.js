#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const Hands = require("../../shared/asset-hands/asset-hands");
const Material = require("../../shared/deterministic-material-fabric");
const Host = require("./server");

function request(port, method, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    const req = http.request({
      host: "127.0.0.1",
      port,
      method,
      path: pathname,
      headers: Object.assign(payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {}, headers)
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(text); } catch (_error) {}
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on("error", reject);
    if (payload) req.end(payload); else req.end();
  });
}

async function listen(server) {
  if (server.listening) return;
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve) => server.close(resolve));
}

async function main() {
  const server = Host.start({ port: 0, hands: Hands, material: Material });
  await listen(server);
  const port = server.address().port;
  try {
    const health = await request(port, "GET", "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.json.status, "READY");
    assert.equal(health.json.hand_version, "1.1.0");
    assert.equal(health.json.budgets.request_body_max_bytes, 262144);
    assert.equal(health.json.budgets.response_body_max_bytes, 12582912);

    const recipe = Host.defaultRecipe();
    recipe.size = 32;
    const created = await request(port, "POST", "/api/create", { recipe, seed: recipe.seed });
    assert.equal(created.status, 200);
    assert.equal(created.json.status, "READY");
    assert.equal(created.json.handoff.status, "PASS");
    assert.equal(created.json.result.artifacts.length, 8);

    const formBody = new URLSearchParams({ payload: JSON.stringify({ recipe, seed: recipe.seed }) }).toString();
    const formCreated = await request(port, "POST", "/api/create", formBody, { "Content-Type": "application/x-www-form-urlencoded" });
    assert.equal(formCreated.status, 200);
    assert.equal(formCreated.json.status, "READY");
    assert.equal(formCreated.json.result.digest, created.json.result.digest);

    const editedRecipe = Object.assign({}, recipe, { family: "asphalt", seed: "server-edit", normal_strength: 4.5 });
    const edited = await request(port, "POST", "/api/edit", { recipe: editedRecipe, brief: created.json.result.brief, seed: editedRecipe.seed });
    assert.equal(edited.status, 200);
    assert.equal(edited.json.status, "READY");
    assert.notEqual(edited.json.result.digest, created.json.result.digest);
    assert.equal(edited.json.result.creation_recipe.operation_mode, "edit");
    assert.equal(edited.json.handoff.operation_mode, "edit");
    assert.equal(edited.json.result.creation_recipe.source_artifact_digests.length, 1);

    const typeRefusal = await request(port, "POST", "/api/edit", "{}", { "Content-Type": "text/plain" });
    assert.equal(typeRefusal.status, 415);
    const originRefusal = await request(port, "POST", "/api/edit", { recipe: editedRecipe }, { Origin: "https://evil.example" });
    assert.equal(originRefusal.status, 403);
    const oversized = await request(port, "POST", "/api/edit", JSON.stringify({ pad: "x".repeat(Host.MAX_BODY_BYTES + 20) }));
    assert.equal(oversized.status, 413);
    assert.equal(oversized.json.code, "REQUEST_BUDGET_EXCEEDED");

    const index = await request(port, "GET", "/index.html");
    assert.equal(index.status, 200);
    assert.match(index.headers["content-security-policy"], /connect-src 'self'/);
    assert.match(index.headers["content-security-policy"], /form-action 'self'/);
    assert.match(index.text, /Asset Material Sensory Workbench/);
  } finally {
    await close(server);
  }

  const degradedHands = { list: () => [], createAsync: async () => { throw new Error("must not run"); } };
  const degraded = http.createServer(Host.createHandler({ hands: degradedHands, material: Material }));
  degraded.listen(0, "127.0.0.1");
  await listen(degraded);
  try {
    const degradedPort = degraded.address().port;
    const health = await request(degradedPort, "GET", "/api/health");
    assert.equal(health.json.status, "DEGRADED");
    const recipe = Host.defaultRecipe();
    const refused = await request(degradedPort, "POST", "/api/create", { recipe });
    assert.equal(refused.status, 503);
    assert.equal(refused.json.code, "HAND_UNAVAILABLE");
  } finally {
    await close(degraded);
  }

  process.stdout.write("Asset Material Sensory Workbench server selftest PASS (loopback health, JSON/form create + edit gate, fresh source, budgets, static CSP, origin/type refusal, degraded mode)\n");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
