#!/usr/bin/env node
"use strict";

const assert = require("assert");
const http = require("http");
const Host = require("./server.js");

function start(hands) {
  return new Promise((resolve) => {
    const server = http.createServer(Host.createHandler({ hands }));
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

(async () => {
  const calls = [];
  const hands = {
    list() { return [{ id: Host.HAND_ID, version: "1.0.0" }]; },
    create(id, brief, options) {
      calls.push({ id, brief, options });
      return { schema: "fixture-result", id, operation_mode: brief.operation_mode, source_artifacts: brief.source_artifacts || [], seed: options.seed };
    }
  };
  const server = await start(hands);
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const healthResponse = await fetch(base + "/api/health");
    assert.strictEqual(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.strictEqual(health.status, "READY");
    assert.strictEqual(health.network_access, false);
    assert.strictEqual(health.filesystem_writes, false);

    const createResponse = await fetch(base + "/api/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seed: "server-fixture" }) });
    assert.strictEqual(createResponse.status, 200);
    await createResponse.json();
    assert.strictEqual(calls[0].id, Host.HAND_ID);
    assert.strictEqual(calls[0].brief.target_canvas.medium, "audio-device");
    assert.strictEqual(calls[0].brief.target_canvas.dimensions.unit, "px");
    assert.deepStrictEqual(calls[0].brief.target_canvas.behaviour, ["static"]);

    const recipe = {
      schema: Host.RECIPE_SCHEMA,
      version: "1.0.0",
      id: "fixture",
      seed: "fixture",
      sample_rate_hz: 44100,
      channels: 1,
      sample_format: "pcm-s16le",
      sound: { schema: "axm.audio.sound/v1", params: { kind: "tone", wave: "sine", freq: 440, sweep: false, freqEnd: 440, dur: 0.1, attack: 0.005, gain: 0.4, noise: false } },
      authority: { installed: false, promoted: false, canonical: false, human_listening_review_required: true }
    };
    const editResponse = await fetch(base + "/api/edit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brief: Host.defaultCreateBrief(), recipe, seed: "fixture" }) });
    assert.strictEqual(editResponse.status, 200);
    await editResponse.json();
    const source = calls[1].brief.source_artifacts[0];
    assert.strictEqual(calls[1].brief.operation_mode, "edit");
    assert.strictEqual(source.content_schema, Host.RECIPE_SCHEMA);
    assert.strictEqual(source.metadata.schema, Host.RECIPE_SCHEMA);
    assert.strictEqual(source.digest, Host.sha256(source.text));
    assert.deepStrictEqual(JSON.parse(source.text), recipe);

    const evilOrigin = await fetch(base + "/api/create", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
    assert.strictEqual(evilOrigin.status, 403);
    const wrongType = await fetch(base + "/api/create", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    assert.strictEqual(wrongType.status, 415);
    const page = await fetch(base + "/");
    assert.strictEqual(page.status, 200);
    assert.match(await page.text(), /Asset Audio Sensory Workbench/);
  } finally {
    await close(server);
  }

  const degraded = await start({ list() { return []; }, create() { throw new Error("must not run"); } });
  try {
    const health = await fetch(`http://127.0.0.1:${degraded.address().port}/api/health`).then((response) => response.json());
    assert.strictEqual(health.status, "DEGRADED");
    assert.strictEqual(health.hand_registered, false);
  } finally {
    await close(degraded);
  }

  console.log("Asset Audio Sensory bounded host selftest PASS (loopback health, exact create/edit bridge, fresh source digest, static serving, origin/type refusal, degraded mode)");
})().catch((error) => { console.error(error); process.exit(1); });
