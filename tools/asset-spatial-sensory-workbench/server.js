#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const TOOL_ROOT = __dirname;
const HAND_ID = "parametric-mesh";
const HAND_VERSION = "1.1.0";
const PROJECT_SCHEMA = "axm.spatial.project/v1";
const DEFAULT_PORT = 8794;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const PRIMITIVES = ["cube", "sphere", "cylinder", "cone", "plane", "torus"];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const output = {};
    Object.keys(value).sort().forEach((key) => { output[key] = stable(value[key]); });
    return output;
  }
  return value;
}
function canonical(value) { return JSON.stringify(stable(value)); }
function sha256(value) { return crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex"); }
function finite(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw new Error(label + " must be within " + minimum + ".." + maximum);
  return number;
}
function vector(value, minimum, maximum, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(label + " must be a three-number vector");
  return value.map((item, index) => finite(item, minimum, maximum, label + "[" + index + "]"));
}
function colour(value, label) {
  const output = String(value || "");
  if (!/^#[0-9a-f]{6}$/i.test(output)) throw new Error(label + " must be #RRGGBB");
  return output.toLowerCase();
}

function defaultControls() {
  return {
    primitive: "sphere",
    dimensions: { width: 2, height: 1.5, depth: 1, unit: "m" },
    max_polygon_count: 1200,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    inflate: 0,
    twist: 0,
    baseColor: "#ff765e",
    metallic: 0.15,
    roughness: 0.55,
    opacity: 1,
    doubleSided: false,
    seed: "spatial-sensory-01"
  };
}

function validateControls(input) {
  const value = Object.assign(defaultControls(), clone(input || {}));
  value.dimensions = Object.assign(defaultControls().dimensions, clone(input && input.dimensions || {}));
  if (!PRIMITIVES.includes(value.primitive)) throw new Error("primitive is unsupported");
  if (!["m", "mm"].includes(value.dimensions.unit)) throw new Error("dimension unit must be m or mm");
  ["width", "height", "depth"].forEach((key) => { value.dimensions[key] = finite(value.dimensions[key], 0.001, 10000, key); });
  value.max_polygon_count = Math.round(finite(value.max_polygon_count, 1, 100000, "polygon budget"));
  value.position = vector(value.position, -10000, 10000, "position");
  value.rotation = vector(value.rotation, -36000, 36000, "rotation");
  value.inflate = finite(value.inflate, -0.9, 4, "inflate");
  value.twist = finite(value.twist, -720, 720, "twist");
  value.baseColor = colour(value.baseColor, "base colour");
  value.metallic = finite(value.metallic, 0, 1, "metallic");
  value.roughness = finite(value.roughness, 0.02, 1, "roughness");
  value.opacity = finite(value.opacity, 0, 1, "opacity");
  value.doubleSided = value.doubleSided === true;
  value.seed = String(value.seed == null ? "" : value.seed).trim().slice(0, 120);
  if (!value.seed) throw new Error("seed is required");
  return value;
}

function validateProjectSource(project) {
  if (!project || project.format !== PROJECT_SCHEMA || project.version !== 1 || !Array.isArray(project.objects) || project.objects.length !== 1 || !Array.isArray(project.materials) || project.materials.length !== 1) {
    throw new Error("exact one-object axm.spatial.project/v1 source is required");
  }
  return clone(project);
}

function applyProjectControls(project, controls) {
  const next = validateProjectSource(project);
  const object = next.objects[0];
  const material = next.materials[0];
  object.position = controls.position.slice();
  object.rotation = controls.rotation.slice();
  object.geometry.inflate = controls.inflate;
  object.geometry.twist = controls.twist;
  material.baseColor = controls.baseColor;
  material.metallic = controls.metallic;
  material.roughness = controls.roughness;
  material.opacity = controls.opacity;
  material.doubleSided = controls.doubleSided;
  return next;
}

function sourceArtifact(project) {
  const value = validateProjectSource(project);
  const text = canonical(value);
  return {
    schema: "axm.asset-source-artifact/v1",
    id: "spatial-project-source",
    role: "source",
    name: "Spatial project edit master",
    mime: "application/json",
    format: "JSON",
    content_schema: PROJECT_SCHEMA,
    editable: true,
    text,
    dataUrl: "",
    digest: sha256(text),
    metadata: { schema: PROJECT_SCHEMA, digest_algorithm: "sha256" }
  };
}

function buildBrief(controls, operationMode, project) {
  const value = validateControls(controls);
  const primitiveSignal = value.primitive + " primitive";
  return {
    id: "spatial-sensory-" + value.primitive + (operationMode === "edit" ? "-edit" : "-create"),
    title: primitiveSignal + " spatial sensory candidate",
    kind: "mesh",
    operation_mode: operationMode,
    intended_use: "mesh",
    purpose: "Create only the unambiguous " + primitiveSignal + " for bounded spatial sensory review",
    style_tags: [value.primitive, "bounded-spatial-review"],
    target_canvas: {
      medium: "3d-surface",
      dimensions: clone(value.dimensions),
      colour: { space: "material-channel", transparency: value.opacity < 1 ? "allowed" : "opaque" },
      behaviour: ["static"],
      performance: { max_polygon_count: value.max_polygon_count, max_file_bytes: 4000000 },
      intended_use: "mesh"
    },
    required_outputs: ["model/obj", "model/gltf-binary", "application/json", "image/svg+xml"],
    editable_recipe_formats: [PROJECT_SCHEMA],
    quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true },
    source_artifacts: operationMode === "edit" ? [sourceArtifact(applyProjectControls(project, value))] : []
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
    bytes = Buffer.from(JSON.stringify({
      schema: "axm.asset-spatial-host-error/v1",
      code: "RESPONSE_BUDGET_EXCEEDED",
      message: "serialized response exceeds the 8 MiB spatial host ceiling",
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

function readPayload(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        reject(Object.assign(new Error("request body exceeds 1 MiB"), { code: "REQUEST_BUDGET_EXCEEDED" }));
        return;
      }
      chunks.push(chunk);
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
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".svg": "image/svg+xml"
  })[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

function compactDiagnostic(result, handoff) {
  return {
    code: handoff && handoff.code || "RESULT_NOT_REVIEWABLE",
    message: handoff && handoff.message || "Spatial result is not reviewable",
    result_status: result && result.status || "FAIL",
    result_digest: result && result.digest || null,
    technical_pass: !!(result && result.technical && result.technical.pass),
    validation_status: result && result.validation_receipt && result.validation_receipt.status || null,
    candidate_bound: false
  };
}

function createHandler(options) {
  const hands = options.hands;
  const spatial = options.spatial;
  return async function handler(req, res) {
    try {
      if (!validHost(req)) return jsonResponse(res, 400, { schema: "axm.asset-spatial-host-error/v1", code: "HOST_REFUSED", message: "loopback Host header required" });
      if (!validOrigin(req)) return jsonResponse(res, 403, { schema: "axm.asset-spatial-host-error/v1", code: "ORIGIN_REFUSED", message: "cross-origin request refused" });
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/api/health") {
        const available = providerAvailable(hands);
        return jsonResponse(res, 200, {
          schema: "axm.asset-spatial-sensory-host-health/v1",
          status: available ? "READY" : "DEGRADED",
          hand_id: HAND_ID,
          hand_version: HAND_VERSION,
          hand_registered: available,
          gate_version: spatial.VERSION,
          bind_address: "127.0.0.1",
          network_access: false,
          filesystem_writes: false,
          budgets: { request_body_max_bytes: MAX_BODY_BYTES, response_body_max_bytes: MAX_RESPONSE_BYTES },
          authority: { installed: false, promoted: false, canonical: false }
        });
      }
      if (req.method === "POST" && (url.pathname === "/api/create" || url.pathname === "/api/edit")) {
        if (!/^application\/json(?:;|$)/i.test(String(req.headers["content-type"] || ""))) return jsonResponse(res, 415, { schema: "axm.asset-spatial-host-error/v1", code: "CONTENT_TYPE_REQUIRED", message: "application/json is required" });
        if (!providerAvailable(hands)) return jsonResponse(res, 503, { schema: "axm.asset-spatial-host-error/v1", code: "HAND_UNAVAILABLE", message: HAND_ID + "@" + HAND_VERSION + " is not registered" });
        const body = await readPayload(req);
        const controls = validateControls(body.controls || defaultControls());
        const mode = url.pathname === "/api/edit" ? "edit" : "create";
        const brief = buildBrief(controls, mode, body.project);
        const host = { capabilities: ["svg", "json", "canvas-2d", "output:image.transform"], permissions: [], accepts: [hands.RESULT_SCHEMA, "model/obj", "model/gltf-binary", "application/json", "image/svg+xml"] };
        const result = hands.create(HAND_ID, brief, { seed: controls.seed, createdAt: body.createdAt, host });
        const handoff = spatial.gateResult(result);
        if (handoff.status !== "PASS") {
          return jsonResponse(res, 200, {
            schema: "axm.asset-spatial-host-result/v1",
            status: result && result.status === "HOLD" ? "HOLD" : "FAIL",
            diagnostic: compactDiagnostic(result, handoff),
            previous_candidate_must_be_preserved: true
          });
        }
        return jsonResponse(res, 200, { schema: "axm.asset-spatial-host-result/v1", status: "READY", result, handoff });
      }
      if (req.method !== "GET" && req.method !== "HEAD") return jsonResponse(res, 405, { schema: "axm.asset-spatial-host-error/v1", code: "METHOD_NOT_ALLOWED", message: "method not allowed" });
      const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
      const filename = path.resolve(TOOL_ROOT, relative);
      if (filename !== TOOL_ROOT && !filename.startsWith(TOOL_ROOT + path.sep)) return jsonResponse(res, 403, { schema: "axm.asset-spatial-host-error/v1", code: "PATH_REFUSED", message: "path refused" });
      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return jsonResponse(res, 404, { schema: "axm.asset-spatial-host-error/v1", code: "NOT_FOUND", message: "not found" });
      const stat = fs.statSync(filename);
      res.writeHead(200, {
        "Content-Type": contentType(filename),
        "Content-Length": stat.size,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(filename).pipe(res);
    } catch (error) {
      jsonResponse(res, error.code === "REQUEST_BUDGET_EXCEEDED" ? 413 : 400, { schema: "axm.asset-spatial-host-error/v1", code: error.code || "REQUEST_INVALID", message: error.message || String(error) });
    }
  };
}

function createServer(options = {}) {
  const hands = options.hands || require("../../shared/asset-hands/asset-hands");
  const spatial = options.spatial || require("../../shared/deterministic-spatial-handoff");
  return http.createServer(createHandler({ hands, spatial }));
}

function start(options = {}) {
  const port = Number(options.port || process.env.AXM_SPATIAL_SENSORY_PORT || DEFAULT_PORT);
  const server = createServer(options);
  server.listen(port, "127.0.0.1", () => console.log("AXM spatial sensory workbench: http://127.0.0.1:" + port));
  return server;
}

if (require.main === module) start();

module.exports = { DEFAULT_PORT, MAX_BODY_BYTES, MAX_RESPONSE_BYTES, PRIMITIVES, defaultControls, validateControls, validateProjectSource, applyProjectControls, sourceArtifact, buildBrief, createHandler, createServer, start };
