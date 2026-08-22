#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TOOL_ROOT = __dirname;
const HAND_ID = "deterministic-audio-fabric";
const RECIPE_SCHEMA = "axm.deterministic-audio-recipe/v1";
const DEFAULT_PORT = 8791;
const MAX_BODY_BYTES = 1024 * 1024;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).sort().forEach((key) => { out[key] = stable(value[key]); });
    return out;
  }
  return value;
}

function canonical(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

function defaultCreateBrief() {
  return {
    id: "asset-audio-sensory-candidate",
    title: "Asset Audio Sensory Candidate",
    kind: "sound-effect",
    operation_mode: "create",
    intended_use: "sound-effect",
    target_canvas: {
      medium: "audio-device",
      dimensions: { width: 1, height: 1, unit: "px" },
      colour: { space: "srgb", transparency: "opaque" },
      behaviour: ["static"],
      intended_use: "sound-effect",
      performance: { max_file_bytes: 2000000, max_duration_seconds: 2 }
    },
    required_outputs: [RECIPE_SCHEMA, "audio/wav", "axm.deterministic-audio-analysis/v1", "axm.deterministic-audio-verification/v1"],
    editable_recipe_formats: [RECIPE_SCHEMA],
    quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true }
  };
}

function sourceArtifact(recipe) {
  if (!recipe || recipe.schema !== RECIPE_SCHEMA) throw new Error("edit requires an axm.deterministic-audio-recipe/v1 source");
  const text = canonical(recipe);
  return {
    schema: "axm.asset-source-artifact/v1",
    id: "deterministic-audio-recipe-source",
    role: "editable-audio-recipe",
    name: "Deterministic audio recipe",
    mime: "application/json",
    format: "json",
    content_schema: RECIPE_SCHEMA,
    editable: true,
    text,
    dataUrl: "",
    digest: sha256(text),
    metadata: { schema: RECIPE_SCHEMA, digest_algorithm: "sha256" }
  };
}

function editBrief(baseBrief, recipe) {
  const brief = JSON.parse(JSON.stringify(baseBrief || defaultCreateBrief()));
  brief.id = String(brief.id || "asset-audio-sensory-candidate").slice(0, 160) + "-edit";
  brief.operation_mode = "edit";
  brief.kind = "sound-effect";
  brief.source_artifacts = [sourceArtifact(recipe)];
  brief.required_outputs = [RECIPE_SCHEMA, "audio/wav", "axm.deterministic-audio-analysis/v1", "axm.deterministic-audio-verification/v1"];
  brief.editable_recipe_formats = [RECIPE_SCHEMA];
  brief.quality_requirements = Object.assign({}, brief.quality_requirements, { require_preview: true, require_validation: true, require_editable_source: true });
  return brief;
}

function providerAvailable(hands) {
  try { return hands.list().some((hand) => hand.id === HAND_ID); }
  catch (_) { return false; }
}

function jsonResponse(res, status, body) {
  const bytes = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": bytes.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin"
  });
  res.end(bytes);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body exceeds 1 MiB"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch (error) { reject(new Error("invalid JSON body: " + error.message)); }
    });
    req.on("error", reject);
  });
}

function mime(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" })[ext] || "application/octet-stream";
}

function validHost(req) {
  const host = String(req.headers.host || "").toLowerCase();
  return host.startsWith("127.0.0.1:") || host.startsWith("localhost:") || host.startsWith("[::1]:");
}

function validOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(origin);
}

function createHandler(options) {
  const hands = options.hands;
  return async function handler(req, res) {
    try {
      if (!validHost(req)) return jsonResponse(res, 400, { schema: "axm.asset-audio-host-error/v1", error: "loopback Host header required" });
      if (!validOrigin(req)) return jsonResponse(res, 403, { schema: "axm.asset-audio-host-error/v1", error: "cross-origin request refused" });
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/api/health") {
        const available = providerAvailable(hands);
        return jsonResponse(res, 200, {
          schema: "axm.asset-audio-sensory-host-health/v1",
          status: available ? "READY" : "DEGRADED",
          hand_id: HAND_ID,
          hand_registered: available,
          bind_address: "127.0.0.1",
          network_access: false,
          filesystem_writes: false,
          authority: { installed: false, promoted: false, canonical: false }
        });
      }
      if (req.method === "POST" && (url.pathname === "/api/create" || url.pathname === "/api/edit")) {
        if (!/^application\/json(?:;|$)/i.test(String(req.headers["content-type"] || ""))) return jsonResponse(res, 415, { error: "application/json required" });
        if (!providerAvailable(hands)) return jsonResponse(res, 503, { schema: "axm.asset-audio-host-error/v1", error: "deterministic audio Asset Hand is not registered" });
        const body = await readJson(req);
        const brief = url.pathname === "/api/edit" ? editBrief(body.brief, body.recipe) : Object.assign(defaultCreateBrief(), body.brief || {});
        const seed = String(body.seed == null ? "asset-audio-sensory-seed" : body.seed).slice(0, 180);
        const result = await Promise.resolve(hands.create(HAND_ID, brief, { seed }));
        return jsonResponse(res, 200, result);
      }
      if (req.method !== "GET" && req.method !== "HEAD") return jsonResponse(res, 405, { error: "method not allowed" });
      let relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
      const filename = path.resolve(TOOL_ROOT, relative);
      if (filename !== TOOL_ROOT && !filename.startsWith(TOOL_ROOT + path.sep)) return jsonResponse(res, 403, { error: "path refused" });
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return jsonResponse(res, 404, { error: "not found" });
      const stat = fs.statSync(filename);
      res.writeHead(200, {
        "Content-Type": mime(filename),
        "Content-Length": stat.size,
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; media-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer"
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(filename).pipe(res);
    } catch (error) {
      if (!res.headersSent) jsonResponse(res, 400, { schema: "axm.asset-audio-host-error/v1", error: String(error && error.message || error).slice(0, 500) });
      else res.destroy(error);
    }
  };
}

function loadHands() {
  return require(path.join(__dirname, "..", "..", "shared", "asset-hands", "asset-hands.js"));
}

function start(options = {}) {
  const port = Number(options.port || process.env.AXM_AUDIO_SENSORY_PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("port must be an integer from 1024 to 65535");
  const hands = options.hands || loadHands();
  const server = http.createServer(createHandler({ hands }));
  server.listen(port, "127.0.0.1", () => {
    const status = providerAvailable(hands) ? "READY" : "DEGRADED";
    process.stdout.write("AXM Asset Audio Sensory Workbench " + status + " at http://127.0.0.1:" + port + "\n");
  });
  return server;
}

if (require.main === module) start();

module.exports = { HAND_ID, RECIPE_SCHEMA, DEFAULT_PORT, MAX_BODY_BYTES, canonical, sha256, defaultCreateBrief, sourceArtifact, editBrief, providerAvailable, createHandler, start };
