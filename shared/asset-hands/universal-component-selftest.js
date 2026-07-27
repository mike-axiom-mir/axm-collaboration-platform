#!/usr/bin/env node
"use strict";

const assert = require("assert");
const UCP = require("./universal-component");
const TargetCanvas = require("./target-canvas");

const createdAt = "2026-07-22T00:00:00.000Z";
function component(input) {
  return UCP.sealComponent(Object.assign({
    version: "1.0.0",
    description: "UCP deterministic fixture",
    canvas_compatibility: { mediums: ["game-world"], intended_uses: ["street-scene"], constraints: [] },
    capabilities: { provides: [], requires: [] },
    artifact_refs: [],
    payload: {},
    provenance: { origin_type: "authored", source_id: "ucp-selftest", source_digest: UCP.sha256("ucp-selftest"), license_id: "CC0-1.0", created_by: "axm-selftest", created_at: createdAt },
    resource_profile: { cpu: "light", gpu: "none", peak_memory_bytes: 1024, working_storage_bytes: 2048, native_runtime: null },
    verification: { automatic_checks: ["schema-and-digest"], human_judgments: [], assurance_ceiling: "contract integrity only" },
    mutability: "immutable",
  }, input));
}

const canvas = TargetCanvas.normalize({
  medium: "game-world",
  dimensions: { width: 20, height: 20, depth: 6, unit: "m" },
  colour: { space: "linear-srgb", transparency: "opaque" },
  behaviour: ["static"],
  performance: { max_polygon_count: 100000, max_draw_calls: 200 },
  intended_use: "street-scene",
});

const gradient = component({
  id: "axm.colour.wet-night",
  kind: "gradient",
  title: "Wet-night colour field",
  ports: { inputs: [], outputs: [{ id: "colour", type: "colour.gradient", required: false, multiple: true }] },
  capabilities: { provides: ["design.gradient"], requires: [] },
  payload: { type: "linear", stops: [{ at: 0, colour: "#06101f" }, { at: 1, colour: "#35e6ff" }] },
});
const material = component({
  id: "axm.material.wet-brick",
  kind: "material",
  title: "Wet brick material",
  ports: {
    inputs: [{ id: "tint", type: "colour.gradient", required: true, multiple: false }],
    outputs: [{ id: "material", type: "material.pbr", required: false, multiple: true }],
  },
  capabilities: { provides: ["material.pbr"], requires: ["hand.material.compile"] },
  payload: { roughness: 0.42, metallic: 0, normal_scale: 0.8 },
  resource_profile: { cpu: "medium", gpu: "light", peak_memory_bytes: 4096, working_storage_bytes: 8192, native_runtime: null },
  verification: { automatic_checks: ["pbr-channel-range"], human_judgments: ["surface reads as wet brick"], assurance_ceiling: "technical material parameters; appearance requires review" },
});
const scene = component({
  id: "axm.template.street-corner",
  kind: "template",
  title: "Street-corner scene template",
  ports: {
    inputs: [{ id: "surface", type: "material.pbr", required: true, multiple: true }],
    outputs: [{ id: "scene", type: "scene.recipe", required: false, multiple: true }],
  },
  capabilities: { provides: ["scene.recipe"], requires: ["hand.scene.compose"] },
  payload: { slots: ["ground", "facade", "street-furniture", "lighting"] },
  resource_profile: { cpu: "light", gpu: "medium", peak_memory_bytes: 2048, working_storage_bytes: 4096, native_runtime: "webgl2" },
  verification: { automatic_checks: ["slot-coverage"], human_judgments: ["composition and atmosphere"], assurance_ceiling: "scene contract; not rendered quality" },
});

const registry = UCP.createRegistry([gradient, material, scene]);
assert.equal(registry.list().length, 3);
assert.throws(() => registry.register(Object.assign({}, gradient, { payload: { changed: true }, digest: gradient.digest })), /digest mismatch/);

const graph = UCP.sealGraph({
  id: "axm.scene.wet-night-corner",
  title: "Wet-night street corner",
  target_canvas: canvas,
  components: [
    { instance_id: "colour", component_id: gradient.id, component_version: gradient.version, component_digest: gradient.digest, configuration: {} },
    { instance_id: "brick", component_id: material.id, component_version: material.version, component_digest: material.digest, configuration: { uv_scale: 2 } },
    { instance_id: "street", component_id: scene.id, component_version: scene.version, component_digest: scene.digest, configuration: {} },
  ],
  connections: [
    { from: { instance_id: "colour", port: "colour" }, to: { instance_id: "brick", port: "tint" }, relation: "applies" },
    { from: { instance_id: "brick", port: "material" }, to: { instance_id: "street", port: "surface" }, relation: "applies" },
  ],
  outputs: [{ id: "scene-recipe", instance_id: "street", port: "scene", role: "editable-scene-recipe" }],
});

const validation = UCP.validateGraph(graph, registry);
assert.deepEqual(validation.errors, []);
assert.deepEqual(validation.execution_order, ["colour", "brick", "street"]);
const receipt = UCP.compose(graph, registry, { createdAt });
assert.equal(receipt.status, "READY_CONTRACT");
assert.deepEqual(receipt.required_capabilities, ["hand.material.compile", "hand.scene.compose"]);
assert.equal(receipt.resource_summary.gpu, "medium");
assert.equal(receipt.resource_summary.peak_memory_bytes, 7168);
assert.equal(receipt.truth.executed, false);
assert.equal(receipt.truth.visually_approved, false);
assert(UCP.validateReceipt(receipt, graph).pass);

const missing = UCP.sealGraph(Object.assign({}, graph, {
  components: graph.components.map((item) => item.instance_id === "brick" ? Object.assign({}, item, { component_digest: "0".repeat(64) }) : item),
  digest: undefined,
}));
assert.equal(UCP.compose(missing, registry, { createdAt }).status, "MISSING_COMPONENT");

const mismatched = UCP.sealGraph(Object.assign({}, graph, {
  connections: [{ from: { instance_id: "colour", port: "colour" }, to: { instance_id: "street", port: "surface" }, relation: "feeds" }],
  digest: undefined,
}));
assert(UCP.validateGraph(mismatched, registry).errors.some((error) => error.includes("type mismatch")));

const cyclicMaterial = component(Object.assign({}, material, {
  id: "axm.material.cyclic",
  ports: {
    inputs: [{ id: "source", type: "material.pbr", required: true, multiple: false }],
    outputs: [{ id: "material", type: "material.pbr", required: false, multiple: true }],
  },
  digest: undefined,
}));
const cyclicRegistry = UCP.createRegistry([cyclicMaterial]);
const cyclic = UCP.sealGraph({
  id: "axm.graph.cycle",
  target_canvas: canvas,
  components: [
    { instance_id: "a", component_id: cyclicMaterial.id, component_version: cyclicMaterial.version, component_digest: cyclicMaterial.digest, configuration: {} },
    { instance_id: "b", component_id: cyclicMaterial.id, component_version: cyclicMaterial.version, component_digest: cyclicMaterial.digest, configuration: {} },
  ],
  connections: [
    { from: { instance_id: "a", port: "material" }, to: { instance_id: "b", port: "source" }, relation: "feeds" },
    { from: { instance_id: "b", port: "material" }, to: { instance_id: "a", port: "source" }, relation: "feeds" },
  ],
  outputs: [{ id: "material", instance_id: "a", port: "material", role: "material" }],
});
assert(UCP.validateGraph(cyclic, cyclicRegistry).errors.includes("component graph contains a cycle"));

assert.throws(() => component({
  id: "axm.bad.absolute-path",
  kind: "texture",
  title: "Non-portable path",
  ports: { inputs: [], outputs: [{ id: "texture", type: "texture.rgba", required: false, multiple: true }] },
  artifact_refs: [{ id: "source", role: "texture", mime: "image/png", digest: UCP.sha256("source"), storage_ref: "C:\\assets\\source.png", bytes: 12 }],
}), /storage_ref must be portable/);

console.log("AXM Universal Component Protocol selftest PASS (immutable components, exact registry resolution, typed DAG composition, canvas fit, resource plan, portable storage and contract-only truth)");
