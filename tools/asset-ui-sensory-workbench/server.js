#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const TOOL_ROOT = __dirname;
const HAND_ID = "ui-component";
const HAND_VERSION = "1.2.0";
const RECIPE_SCHEMA = "axm.ui-component-recipe/v1";
const DEFAULT_PORT = 8795;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function cleanText(value, maximum, fallback) {
  const output = String(value == null ? "" : value).trim();
  return output ? output.slice(0, maximum) : fallback;
}
function colour(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : fallback; }
function finite(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}
function defaultCreate() {
  return {
    id: "ui-sensory-hud",
    title: "Platform HUD control",
    kind: "button",
    seed: "ui-sensory-01",
    medium: "game-world",
    width: 480,
    height: 240,
    transparency: "allowed",
    minimum_contrast_ratio: 4.5,
    direction: "ltr",
    input_modalities: ["pointer", "keyboard", "gamepad"],
    reduced_motion: false,
    minimum_target_size: 44,
    alternative_text: true,
    focus_visible: true,
    palette: { surface: "#101828", accent: "#2E90FA", foreground: "#F9FAFB", attention: "#F79009" }
  };
}
function normalizeCreate(input) {
  const value = Object.assign(defaultCreate(), clone(input || {}));
  value.id = cleanText(value.id, 100, "ui-sensory-hud");
  value.title = cleanText(value.title, 120, "Platform HUD control");
  if (!["panel", "button", "hud", "ui-component"].includes(value.kind)) value.kind = "button";
  value.seed = cleanText(value.seed, 180, "ui-sensory-01");
  if (!["ui", "screen", "game-world"].includes(value.medium)) value.medium = "game-world";
  value.width = finite(value.width, 1, 8192, 480);
  value.height = finite(value.height, 1, 8192, 240);
  if (!["required", "allowed", "opaque"].includes(value.transparency)) value.transparency = "allowed";
  value.minimum_contrast_ratio = finite(value.minimum_contrast_ratio, 1, 21, 4.5);
  if (!["ltr", "rtl", "auto"].includes(value.direction)) value.direction = "ltr";
  value.input_modalities = Array.from(new Set(Array.isArray(value.input_modalities) ? value.input_modalities.filter((item) => ["pointer", "keyboard", "touch", "gamepad"].includes(item)) : ["pointer", "keyboard"]));
  value.reduced_motion = value.reduced_motion === true;
  value.minimum_target_size = finite(value.minimum_target_size, 1, 1000, 44);
  value.alternative_text = value.alternative_text !== false;
  value.focus_visible = value.focus_visible !== false;
  value.palette = {
    surface: colour(value.palette && value.palette.surface, "#101828"),
    accent: colour(value.palette && value.palette.accent, "#2E90FA"),
    foreground: colour(value.palette && value.palette.foreground, "#F9FAFB"),
    attention: colour(value.palette && value.palette.attention, "#F79009")
  };
  return value;
}
function targetFrom(value) {
  return {
    medium: value.target ? value.target.medium : value.medium,
    dimensions: value.target ? clone(value.target.dimensions) : { width: value.width, height: value.height, unit: "px" },
    colour: {
      space: "srgb",
      transparency: value.target ? value.target.transparency : value.transparency,
      minimum_contrast_ratio: value.target ? value.target.minimum_contrast_ratio : value.minimum_contrast_ratio
    },
    behaviour: ["static", "interactive", "responsive"],
    intended_use: value.kind,
    responsive: {
      direction: value.target ? value.target.direction : value.direction,
      input_modalities: value.target ? value.target.input_modalities.slice() : value.input_modalities.slice(),
      reduced_motion: value.target ? value.target.reduced_motion : value.reduced_motion,
      minimum_target_size: value.target ? value.target.minimum_target_size : value.minimum_target_size
    },
    accessibility: {
      alternative_text: value.target ? value.target.alternative_text : value.alternative_text,
      focus_visible: value.target ? value.target.focus_visible : value.focus_visible
    },
    performance: { max_file_bytes: MAX_RESPONSE_BYTES }
  };
}
function sourceArtifact(recipe) {
  return {
    id: "ui-recipe",
    role: "editable-ui-recipe",
    name: recipe.title + " UI recipe",
    mime: "application/json",
    format: "JSON",
    content_schema: RECIPE_SCHEMA,
    editable: true,
    text: JSON.stringify(recipe),
    metadata: { schema: RECIPE_SCHEMA }
  };
}
function createBrief(input) {
  const value = normalizeCreate(input);
  return {
    id: value.id,
    title: value.title,
    kind: value.kind,
    operation_mode: "create",
    intended_use: value.kind,
    palette: Object.values(value.palette),
    target_canvas: targetFrom(value),
    required_outputs: ["image/svg+xml", "application/json"],
    editable_recipe_formats: [RECIPE_SCHEMA]
  };
}
function editBrief(recipe, validateRecipe) {
  const value = validateRecipe(recipe);
  return {
    id: value.id,
    title: value.title,
    kind: value.kind,
    operation_mode: "edit",
    intended_use: value.kind,
    palette: Object.values(value.palette),
    target_canvas: targetFrom(value),
    required_outputs: ["image/svg+xml", "application/json"],
    editable_recipe_formats: [RECIPE_SCHEMA],
    source_artifacts: [sourceArtifact(value)]
  };
}
function providerAvailable(hands) {
  try { return hands.list().some((hand) => hand.id === HAND_ID && hand.version === HAND_VERSION); }
  catch (_error) { return false; }
}
function validHost(req) {
  const host = String(req.headers.host || "").toLowerCase();
  return host.startsWith("127.0.0.1:") || host.startsWith("localhost:") || host.startsWith("[::1]:");
}
function validOrigin(req) {
  const origin = req.headers.origin;
  return !origin || /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(origin);
}
function jsonResponse(res, statusCode, body, enforceBudget = true) {
  let bytes = Buffer.from(JSON.stringify(body));
  if (enforceBudget && bytes.length > MAX_RESPONSE_BYTES) {
    statusCode = 413;
    bytes = Buffer.from(JSON.stringify({ schema: "axm.asset-ui-host-error/v1", code: "RESPONSE_BUDGET_EXCEEDED", message: "serialized response exceeds 2 MiB", response_bytes: bytes.length, response_body_max_bytes: MAX_RESPONSE_BYTES }));
  }
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Content-Length": bytes.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" });
  res.end(bytes);
}
function readPayload(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) { failed = true; reject(Object.assign(new Error("request body exceeds 256 KiB"), { code: "REQUEST_BUDGET_EXCEEDED" })); }
      else chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch (error) { reject(Object.assign(new Error("invalid JSON: " + error.message), { code: "INVALID_JSON" })); }
    });
    req.on("error", reject);
  });
}
function contentType(filename) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8" })[path.extname(filename).toLowerCase()] || "application/octet-stream";
}
function compactDiagnostic(result, handoff) {
  return {
    code: handoff && handoff.code || "RESULT_NOT_REVIEWABLE",
    message: handoff && handoff.message || "UI result is not reviewable",
    result_status: result && result.status || "FAIL",
    result_digest: result && result.digest || null,
    technical_pass: !!(result && result.technical && result.technical.pass),
    validation_status: result && result.validation_receipt && result.validation_receipt.status || null,
    candidate_bound: false,
    previous_candidate_must_be_preserved: true
  };
}
function createHandler(options) {
  const hands = options.hands;
  const fabric = options.fabric;
  const sensoryCore = options.sensoryCore;
  return function handler(req, res) {
    Promise.resolve().then(() => {
      if (!validHost(req)) return jsonResponse(res, 400, { schema: "axm.asset-ui-host-error/v1", code: "HOST_REFUSED", message: "loopback Host header required" });
      if (!validOrigin(req)) return jsonResponse(res, 403, { schema: "axm.asset-ui-host-error/v1", code: "ORIGIN_REFUSED", message: "cross-origin request refused" });
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/api/health") {
        const available = providerAvailable(hands) && fabric && typeof fabric.gateResult === "function";
        return jsonResponse(res, 200, { schema: "axm.asset-ui-sensory-host-health/v1", status: available ? "READY" : "DEGRADED", hand_id: HAND_ID, hand_version: HAND_VERSION, hand_registered: providerAvailable(hands), gate_version: fabric && fabric.VERSION || null, bind_address: "127.0.0.1", network_access: false, filesystem_writes: false, budgets: { request_body_max_bytes: MAX_BODY_BYTES, response_body_max_bytes: MAX_RESPONSE_BYTES }, authority: { installed: false, promoted: false, canonical: false } });
      }
      if (req.method === "POST" && (url.pathname === "/api/create" || url.pathname === "/api/edit")) {
        if (!/^application\/json(?:;|$)/i.test(String(req.headers["content-type"] || ""))) return jsonResponse(res, 415, { schema: "axm.asset-ui-host-error/v1", code: "CONTENT_TYPE_REFUSED", message: "application/json is required" });
        if (!providerAvailable(hands) || !fabric || typeof fabric.gateResult !== "function") return jsonResponse(res, 503, { schema: "axm.asset-ui-host-error/v1", code: "HAND_UNAVAILABLE", message: "ui-component@1.2.0 or deterministic UI gate is unavailable" });
        return readPayload(req).then((body) => {
          const mode = url.pathname === "/api/edit" ? "edit" : "create";
          const brief = mode === "edit" ? editBrief(body.recipe, sensoryCore.validateRecipe) : createBrief(body.create);
          const seed = cleanText(body.seed || (body.recipe && body.recipe.seed) || (body.create && body.create.seed), 180, "ui-sensory-01");
          const optionsValue = { seed };
          if (body.createdAt) optionsValue.createdAt = cleanText(body.createdAt, 80, undefined);
          optionsValue.host = { capabilities: ["svg", "json"], permissions: [], accepts: [hands.RESULT_SCHEMA, "image/svg+xml", "application/json", "axm.ui-component-spec/v1", RECIPE_SCHEMA] };
          const result = hands.create(HAND_ID, brief, optionsValue);
          const handoff = fabric.gateResult(result);
          if (handoff.status !== "PASS") return jsonResponse(res, 200, { schema: "axm.asset-ui-host-result/v1", status: result && result.status === "HOLD" ? "HOLD" : "FAIL", diagnostic: compactDiagnostic(result, handoff), previous_candidate_must_be_preserved: true });
          return jsonResponse(res, 200, { schema: "axm.asset-ui-host-result/v1", status: "READY", result, handoff });
        });
      }
      if (req.method !== "GET" && req.method !== "HEAD") return jsonResponse(res, 405, { schema: "axm.asset-ui-host-error/v1", code: "METHOD_REFUSED", message: "method not allowed" });
      const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
      const filename = path.resolve(TOOL_ROOT, relative);
      if (filename !== TOOL_ROOT && !filename.startsWith(TOOL_ROOT + path.sep)) return jsonResponse(res, 403, { schema: "axm.asset-ui-host-error/v1", code: "PATH_REFUSED", message: "path refused" });
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return jsonResponse(res, 404, { schema: "axm.asset-ui-host-error/v1", code: "NOT_FOUND", message: "not found" });
      const stat = fs.statSync(filename);
      res.writeHead(200, {
        "Content-Type": contentType(filename),
        "Content-Length": stat.size,
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer"
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(filename).pipe(res);
    }).catch((error) => {
      if (!res.headersSent) jsonResponse(res, error && error.code === "REQUEST_BUDGET_EXCEEDED" ? 413 : 400, { schema: "axm.asset-ui-host-error/v1", code: error && error.code || "HOST_REQUEST_FAILED", message: String(error && error.message || error).slice(0, 1000) });
      else res.destroy(error);
    });
  };
}
function loadHands() { return require(path.join(__dirname, "..", "..", "shared", "asset-hands", "asset-hands.js")); }
function loadFabric() { return require(path.join(__dirname, "..", "..", "shared", "deterministic-ui-fabric")); }
function loadCore() { return require(path.join(__dirname, "core.js")); }
function start(options = {}) {
  const port = Number(options.port == null ? process.env.AXM_UI_SENSORY_PORT || DEFAULT_PORT : options.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("port must be an integer from 0 to 65535");
  const hands = options.hands || loadHands();
  const fabric = options.fabric || loadFabric();
  const sensoryCore = options.sensoryCore || loadCore();
  const server = http.createServer(createHandler({ hands, fabric, sensoryCore }));
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    process.stdout.write("AXM Asset UI Sensory Workbench " + (providerAvailable(hands) ? "READY" : "DEGRADED") + " at http://127.0.0.1:" + address.port + "\n");
  });
  return server;
}
if (require.main === module) start();
module.exports = { HAND_ID, HAND_VERSION, RECIPE_SCHEMA, DEFAULT_PORT, MAX_BODY_BYTES, MAX_RESPONSE_BYTES, defaultCreate, normalizeCreate, targetFrom, sourceArtifact, createBrief, editBrief, providerAvailable, compactDiagnostic, createHandler, start };
