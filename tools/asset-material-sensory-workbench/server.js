#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const TOOL_ROOT = __dirname;
const HAND_ID = "pbr-material-bake";
const RECIPE_SCHEMA = "axm.pbr-material-recipe/v1";
const DEFAULT_PORT = 8793;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const output = {};
    Object.keys(value).sort().forEach((key) => { output[key] = stable(value[key]); });
    return output;
  }
  return value;
}

function canonical(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

function defaultRecipe() {
  return {
    schema: RECIPE_SCHEMA,
    version: "1.0.0",
    id: "material-sensory-brick",
    family: "brick",
    seed: "material-sensory-01",
    size: 128,
    normal_strength: 3.1,
    authority: "candidate-only"
  };
}

function validateRecipe(recipe) {
  if (!recipe || recipe.schema !== RECIPE_SCHEMA || recipe.version !== "1.0.0" || recipe.authority !== "candidate-only") throw new Error("exact candidate-only axm.pbr-material-recipe/v1 is required");
  const keys = Object.keys(recipe).sort();
  const expected = ["authority", "family", "id", "normal_strength", "schema", "seed", "size", "version"];
  if (canonical(keys) !== canonical(expected)) throw new Error("recipe fields do not match the v1 allowlist");
  if (!Number.isInteger(recipe.size) || recipe.size < 32 || recipe.size > 512) throw new Error("recipe size must be an integer from 32 to 512");
  if (!Number.isFinite(recipe.normal_strength) || recipe.normal_strength < 0.25 || recipe.normal_strength > 8) throw new Error("normal_strength must be within 0.25..8");
  if (!["brick", "asphalt", "painted-metal", "glass", "skin", "vehicle-paint"].includes(recipe.family)) throw new Error("unsupported material family");
  if (!String(recipe.id || "").trim() || String(recipe.id).length > 120 || !String(recipe.seed || "").trim() || String(recipe.seed).length > 120) throw new Error("recipe id and seed must contain 1..120 characters");
  return JSON.parse(JSON.stringify(recipe));
}

function sourceArtifact(recipe) {
  const value = validateRecipe(recipe);
  const text = canonical(value);
  return {
    schema: "axm.asset-source-artifact/v1",
    id: "pbr-material-recipe-source",
    role: "source",
    name: "PBR material recipe source",
    mime: "application/json",
    format: "JSON",
    content_schema: RECIPE_SCHEMA,
    editable: true,
    text,
    dataUrl: "",
    digest: sha256(text),
    metadata: { schema: RECIPE_SCHEMA, digest_algorithm: "sha256" }
  };
}

function buildBrief(recipe, operationMode, baseBrief) {
  const value = validateRecipe(recipe);
  const previous = baseBrief && typeof baseBrief === "object" ? JSON.parse(JSON.stringify(baseBrief)) : {};
  const target = previous.target_canvas && typeof previous.target_canvas === "object" ? previous.target_canvas : {};
  const performance = Object.assign({}, target.performance, { max_file_bytes: Math.max(12000000, Number(target.performance && target.performance.max_file_bytes) || 0) });
  const brief = {
    id: String(previous.id || value.id).slice(0, 140) + (operationMode === "edit" ? "-edit" : ""),
    title: String(previous.title || (value.family + " material sensory candidate")).slice(0, 160),
    kind: "material",
    operation_mode: operationMode,
    intended_use: "texture",
    target_canvas: {
      medium: "3d-surface",
      dimensions: { width: value.size, height: value.size, unit: "px" },
      colour: { space: "srgb", transparency: "opaque" },
      behaviour: ["static", "tileable"],
      intended_use: "texture",
      physical: { material_behaviour: [] },
      performance
    },
    required_outputs: ["image/png", "application/json"],
    editable_recipe_formats: [RECIPE_SCHEMA],
    quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true },
    source_artifacts: [sourceArtifact(value)]
  };
  return brief;
}

function providerAvailable(hands) {
  try { return hands.list().some((hand) => hand.id === HAND_ID && hand.version === "1.1.0"); }
  catch (_error) { return false; }
}

function jsonResponse(res, statusCode, body, enforceBudget = true) {
  let bytes = Buffer.from(JSON.stringify(body));
  if (enforceBudget && bytes.length > MAX_RESPONSE_BYTES) {
    statusCode = 413;
    bytes = Buffer.from(JSON.stringify({
      schema: "axm.asset-material-host-error/v1",
      code: "RESPONSE_BUDGET_EXCEEDED",
      message: "serialized response exceeds the 12 MiB material host ceiling",
      response_bytes: bytes.length,
      response_body_max_bytes: MAX_RESPONSE_BYTES
    }));
  }
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": bytes.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin"
  });
  res.end(bytes);
}

function readPayload(req, contentTypeHeader) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        reject(Object.assign(new Error("request body exceeds 256 KiB"), { code: "REQUEST_BUDGET_EXCEEDED" }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) return;
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        if (/^application\/x-www-form-urlencoded(?:;|$)/i.test(contentTypeHeader)) {
          const encoded = new URLSearchParams(text).get("payload");
          if (encoded == null) throw new Error("form payload field is required");
          resolve(JSON.parse(encoded));
        } else resolve(JSON.parse(text || "{}"));
      } catch (error) { reject(Object.assign(new Error("invalid request body: " + error.message), { code: "INVALID_JSON" })); }
    });
    req.on("error", reject);
  });
}

function contentType(filename) {
  const extension = path.extname(filename).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png"
  })[extension] || "application/octet-stream";
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

function compactDiagnostic(result, gate) {
  return {
    code: gate && gate.code || "RESULT_NOT_REVIEWABLE",
    message: gate && gate.message || "Material result is not reviewable",
    result_status: result && result.status || "FAIL",
    result_digest: result && result.digest || null,
    technical_pass: !!(result && result.technical && result.technical.pass),
    validation_status: result && result.validation_receipt && result.validation_receipt.status || null,
    failed_checks: result && result.validation_receipt && Array.isArray(result.validation_receipt.checks)
      ? result.validation_receipt.checks.filter((check) => check.pass !== true).map((check) => ({ name: check.name, details: check.details }))
      : [],
    candidate_bound: false
  };
}

function createHandler(options) {
  const hands = options.hands;
  const material = options.material;
  return async function handler(req, res) {
    try {
      if (!validHost(req)) return jsonResponse(res, 400, { schema: "axm.asset-material-host-error/v1", code: "HOST_REFUSED", message: "loopback Host header required" });
      if (!validOrigin(req)) return jsonResponse(res, 403, { schema: "axm.asset-material-host-error/v1", code: "ORIGIN_REFUSED", message: "cross-origin request refused" });
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/api/health") {
        const available = providerAvailable(hands);
        return jsonResponse(res, 200, {
          schema: "axm.asset-material-sensory-host-health/v1",
          status: available ? "READY" : "DEGRADED",
          hand_id: HAND_ID,
          hand_version: "1.1.0",
          hand_registered: available,
          gate_version: material.VERSION,
          bind_address: "127.0.0.1",
          network_access: false,
          filesystem_writes: false,
          budgets: { request_body_max_bytes: MAX_BODY_BYTES, response_body_max_bytes: MAX_RESPONSE_BYTES },
          authority: { installed: false, promoted: false, canonical: false }
        });
      }
      if (req.method === "POST" && (url.pathname === "/api/create" || url.pathname === "/api/edit")) {
        const requestContentType = String(req.headers["content-type"] || "");
        if (!/^(application\/json|application\/x-www-form-urlencoded)(?:;|$)/i.test(requestContentType)) return jsonResponse(res, 415, { schema: "axm.asset-material-host-error/v1", code: "CONTENT_TYPE_REQUIRED", message: "application/json or exact same-origin form bridge required" });
        if (!providerAvailable(hands)) return jsonResponse(res, 503, { schema: "axm.asset-material-host-error/v1", code: "HAND_UNAVAILABLE", message: "pbr-material-bake@1.1.0 is not registered" });
        const body = await readPayload(req, requestContentType);
        const recipe = validateRecipe(body.recipe || defaultRecipe());
        const mode = url.pathname === "/api/edit" ? "edit" : "create";
        const brief = buildBrief(recipe, mode, body.brief);
        const seed = String(body.seed == null ? recipe.seed : body.seed).slice(0, 120);
        const result = await hands.createAsync(HAND_ID, brief, { seed });
        const handoff = material.gateResult(result);
        if (handoff.status !== "PASS") {
          return jsonResponse(res, 200, {
            schema: "axm.asset-material-host-result/v1",
            status: result.status === "HOLD" ? "HOLD" : "FAIL",
            diagnostic: compactDiagnostic(result, handoff),
            previous_candidate_must_be_preserved: true
          });
        }
        return jsonResponse(res, 200, {
          schema: "axm.asset-material-host-result/v1",
          status: "READY",
          result,
          handoff
        });
      }
      if (req.method !== "GET" && req.method !== "HEAD") return jsonResponse(res, 405, { schema: "axm.asset-material-host-error/v1", code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
      const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
      const filename = path.resolve(TOOL_ROOT, relative);
      if (filename !== TOOL_ROOT && !filename.startsWith(TOOL_ROOT + path.sep)) return jsonResponse(res, 403, { schema: "axm.asset-material-host-error/v1", code: "PATH_REFUSED", message: "path refused" });
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return jsonResponse(res, 404, { schema: "axm.asset-material-host-error/v1", code: "NOT_FOUND", message: "not found" });
      const stat = fs.statSync(filename);
      res.writeHead(200, {
        "Content-Type": contentType(filename),
        "Content-Length": stat.size,
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer"
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(filename).pipe(res);
    } catch (error) {
      if (!res.headersSent) jsonResponse(res, error && error.code === "REQUEST_BUDGET_EXCEEDED" ? 413 : 400, {
        schema: "axm.asset-material-host-error/v1",
        code: error && error.code || "HOST_REQUEST_FAILED",
        message: String(error && error.message || error).slice(0, 1000)
      });
      else res.destroy(error);
    }
  };
}

function loadHands() {
  return require(path.join(__dirname, "..", "..", "shared", "asset-hands", "asset-hands.js"));
}

function loadMaterialGate() {
  return require(path.join(__dirname, "..", "..", "shared", "deterministic-material-fabric"));
}

function start(options = {}) {
  const port = Number(options.port == null ? process.env.AXM_MATERIAL_SENSORY_PORT || DEFAULT_PORT : options.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("port must be an integer from 0 to 65535");
  const hands = options.hands || loadHands();
  const material = options.material || loadMaterialGate();
  const server = http.createServer(createHandler({ hands, material }));
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const status = providerAvailable(hands) ? "READY" : "DEGRADED";
    process.stdout.write("AXM Asset Material Sensory Workbench " + status + " at http://127.0.0.1:" + address.port + "\n");
  });
  return server;
}

if (require.main === module) start();

module.exports = {
  HAND_ID,
  RECIPE_SCHEMA,
  DEFAULT_PORT,
  MAX_BODY_BYTES,
  MAX_RESPONSE_BYTES,
  canonical,
  sha256,
  defaultRecipe,
  validateRecipe,
  sourceArtifact,
  buildBrief,
  providerAvailable,
  compactDiagnostic,
  createHandler,
  start
};
