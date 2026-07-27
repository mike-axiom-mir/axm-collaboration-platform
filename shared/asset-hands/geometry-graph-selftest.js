#!/usr/bin/env node
"use strict";
const assert = require("assert");
const Hands = require("./asset-hands");
const Graph = require("./geometry-graph-codec");
const GlTF = require("./gltf-codec");
const Schemas = require("./artifact-schema-catalog");

const createdAt = "2026-07-19T00:00:00Z";
const host = {
  capabilities: ["json", "svg"],
  permissions: [],
  accepts: [
    Hands.RESULT_SCHEMA,
    "application/json",
    "image/svg+xml",
    "model/obj",
    "model/gltf-binary",
  ],
};
function brief(overrides) {
  return Object.assign(
    {
      id: "geometry-graph",
      title: "Modular cube array",
      kind: "3d-model",
      operation_mode: "create",
      intended_use: "3d-model",
      target_canvas: {
        medium: "3d-surface",
        dimensions: { width: 4, height: 2, depth: 2, unit: "m" },
        colour: { space: "material-channel", transparency: "opaque" },
        spatial: { up_axis: "y", handedness: "right" },
        behaviour: ["static"],
        performance: {
          max_polygon_count: 60,
          max_vertices: 120,
          max_file_bytes: 1000000,
        },
        intended_use: "3d-model",
      },
      required_outputs: [
        "geometry-graph+json",
        "model/obj",
        "model/gltf-binary",
      ],
      editable_recipe_formats: ["axm.geometry-graph-recipe/v1"],
      quality_requirements: {
        require_preview: true,
        require_validation: true,
        require_editable_source: true,
      },
    },
    overrides || {},
  );
}
function artifact(result, id) {
  const found = result.artifacts.find((item) => item.id === id);
  assert(found, "missing " + id);
  return found;
}
function source(graph, digest) {
  return {
    id: "graph-source",
    role: "source",
    mime: "application/json",
    format: "JSON",
    text: JSON.stringify(graph),
    digest: digest || "graph-source-digest",
    editable: true,
    metadata: { schema: "geometry-graph+json" },
  };
}

(async function () {
  assert.equal(new Set(Hands.list().map((hand) => hand.id)).size, Hands.list().length);
  assert.equal(Hands.listMissingHands().length, 0);
  assert(!Hands.getMissingHand("procedural-geometry-graph"));
  assert(
    Hands.routes(brief(), host).some(
      (route) => route.hand.id === "procedural-geometry-graph",
    ),
  );

  const result = await Hands.createAsync("procedural-geometry-graph", brief(), {
    host,
    createdAt,
    seed: "geometry-graph",
  });
  assert.equal(result.status, "READY");
  assert(result.technical.pass);
  assert.equal(result.measures.nodes, 4);
  assert.equal(result.measures.instances, 5);
  assert.equal(result.measures.triangles, 60);
  assert.equal(result.measures.vertices, 120);

  const graph = JSON.parse(artifact(result, "geometry-graph").text);
  const graphInspection = Graph.inspect(graph);
  assert(graphInspection.pass, graphInspection.errors.join(", "));
  assert.deepEqual(
    graph.nodes.map((node) => node.type),
    ["primitive", "transform", "linear-array", "output"],
  );
  assert.equal(graph.cache_policy.cross_request_state, false);
  const evaluation = Graph.evaluate(graph, {
    maxTriangles: 60,
    maxVertices: 120,
  });
  assert(evaluation.pass);
  assert.equal(
    evaluation.graphDigest,
    artifact(result, "geometry-graph").metadata.graphDigest,
  );

  const obj = artifact(result, "geometry-graph-obj");
  const glb = artifact(result, "geometry-graph-glb");
  assert.equal(obj.mime, "model/obj");
  assert(/^# AXM Spatial Studio OBJ/.test(obj.text));
  assert(/\nv [-0-9]/.test(obj.text));
  assert(/\nf [0-9]/.test(obj.text));
  assert.equal(glb.mime, "model/gltf-binary");
  assert(glb.dataUrl.startsWith("data:model/gltf-binary;base64,"));
  const glbInspection = GlTF.inspect(
    new Uint8Array(Buffer.from(glb.dataUrl.split(",")[1], "base64")),
  );
  assert(glbInspection.pass, glbInspection.errors.join(", "));
  assert(!obj.text.trimStart().startsWith("<svg"));
  assert(!glb.dataUrl.startsWith("data:image/svg+xml"));

  const recipe = JSON.parse(artifact(result, "geometry-graph-recipe").text);
  const report = JSON.parse(artifact(result, "geometry-graph-validation").text);
  assert(Schemas.validate(graph.schema, graph).pass);
  assert(Schemas.validate(recipe.schema, recipe).pass);
  assert(Schemas.validate(report.schema, report).pass);
  assert.equal(report.status, "PASS");
  assert.equal(report.bake_integrity.graph_digest, evaluation.graphDigest);
  assert.equal(report.cache.scope, "request-local");
  assert.equal(report.cache.deterministic, true);
  assert(recipe.known_limits.some((limit) => /no boolean CSG/.test(limit)));

  const proof = await Hands.verifyDeterminismAsync(
    "procedural-geometry-graph",
    brief(),
    { host, createdAt, seed: "geometry-graph" },
  );
  assert(proof.pass, JSON.stringify(proof));

  const sharedGraph = {
    schema: "geometry-graph+json",
    version: "1.0.0",
    id: "shared-subgraph",
    name: "Shared cached subgraph",
    target_canvas: graph.target_canvas,
    coordinate_unit: "metre",
    nodes: [
      { id: "base", type: "primitive", shape: "cube", detail: 6 },
      {
        id: "placed",
        type: "transform",
        input: "base",
        translate: [0, 0, 0],
        rotate: [0, 0, 0],
        scale: [0.5, 0.5, 0.5],
      },
      { id: "twice", type: "merge", inputs: ["placed", "placed"] },
      { id: "result", type: "output", input: "twice" },
    ],
    output: "result",
    cache_policy: {
      scope: "request-local",
      key: "canonical-node-plus-input-digests",
      deterministic: true,
      cross_request_state: false,
    },
    provenance: { hand: "test" },
  };
  const sharedEvaluation = Graph.evaluate(sharedGraph, {
    maxTriangles: 24,
    maxVertices: 48,
  });
  assert(sharedEvaluation.pass);
  assert.equal(sharedEvaluation.instances.length, 2);
  assert(sharedEvaluation.cache.hits >= 1);
  const editBrief = brief({
    id: "edit-shared-graph",
    operation_mode: "edit",
    source_artifacts: [source(sharedGraph, "shared-graph-digest")],
    target_canvas: Object.assign({}, brief().target_canvas, {
      performance: {
        max_polygon_count: 24,
        max_vertices: 48,
        max_file_bytes: 1000000,
      },
    }),
  });
  const edited = await Hands.createAsync(
    "procedural-geometry-graph",
    editBrief,
    { host, createdAt, seed: "edit-shared-graph" },
  );
  assert.equal(edited.status, "READY");
  assert(edited.measures.cacheHits >= 1);
  assert.deepEqual(
    JSON.parse(artifact(edited, "geometry-graph-recipe").text).provenance
      .source_artifact_digests,
    ["shared-graph-digest"],
  );

  const cycle = JSON.parse(JSON.stringify(sharedGraph));
  cycle.nodes.find((node) => node.id === "placed").input = "result";
  assert(!Graph.inspect(cycle).pass);
  await assert.rejects(
    () =>
      Hands.createAsync(
        "procedural-geometry-graph",
        brief({
          id: "cycle-graph",
          operation_mode: "validate",
          source_artifacts: [source(cycle, "cycle")],
        }),
        { host, createdAt, seed: "cycle-graph" },
      ),
    /cycle detected/,
  );
  const unknown = JSON.parse(JSON.stringify(sharedGraph));
  unknown.nodes[0].type = "execute-javascript";
  assert(!Graph.inspect(unknown).pass);
  await assert.rejects(
    () =>
      Hands.createAsync(
        "procedural-geometry-graph",
        brief({
          id: "unknown-node",
          operation_mode: "validate",
          source_artifacts: [source(unknown, "unknown")],
        }),
        { host, createdAt, seed: "unknown-node" },
      ),
    /not allowlisted/,
  );

  const overBudget = brief({
    id: "over-budget-graph",
    operation_mode: "validate",
    source_artifacts: [source(sharedGraph, "over-budget")],
    target_canvas: Object.assign({}, brief().target_canvas, {
      performance: {
        max_polygon_count: 12,
        max_vertices: 24,
        max_file_bytes: 1000000,
      },
    }),
  });
  const held = await Hands.createAsync(
    "procedural-geometry-graph",
    overBudget,
    { host, createdAt, seed: "over-budget-graph" },
  );
  assert.equal(held.status, "HOLD");
  assert(
    !held.validation_receipt.checks.find(
      (check) => check.name === "evaluation-budget",
    ).pass,
  );

  const physical = brief({
    id: "tolerance-graph",
    kind: "physical-object",
    intended_use: "physical-object",
    target_canvas: {
      medium: "physical-object",
      dimensions: { width: 100, height: 100, depth: 100, unit: "mm" },
      colour: { space: "grayscale", transparency: "opaque" },
        physical: { tolerance: 0.5 },
      spatial: { up_axis: "y", handedness: "right" },
      behaviour: ["static"],
      performance: {
        max_polygon_count: 24,
        max_vertices: 48,
        max_file_bytes: 1000000,
      },
      intended_use: "physical-object",
    },
  });
  const physicalResult = await Hands.createAsync(
    "procedural-geometry-graph",
    physical,
    { host, createdAt, seed: "tolerance-graph" },
  );
  assert.equal(physicalResult.status, "READY");
  assert.equal(physicalResult.measures.toleranceMetres, 0.0005);
  const physicalGraph = JSON.parse(
    artifact(physicalResult, "geometry-graph").text,
  );
  const physicalEval = Graph.evaluate(physicalGraph, {
    toleranceMetres: 0.0005,
    maxTriangles: 24,
    maxVertices: 48,
  });
  physicalEval.instances.forEach((instance) =>
    instance.position
      .concat(instance.scale)
      .forEach((value) =>
        assert(
          Math.abs(value / 0.0005 - Math.round(value / 0.0005)) < 0.000001,
        ),
      ),
  );

  const corrupt = new Uint8Array(
    Buffer.from(glb.dataUrl.split(",")[1], "base64"),
  );
  corrupt[12] ^= 1;
  assert(!GlTF.inspect(corrupt).pass);
  const zUp = brief({
    id: "z-up-graph",
    target_canvas: Object.assign({}, brief().target_canvas, {
      spatial: { up_axis: "z", handedness: "right" },
    }),
  });
  assert(
    !Hands.routes(zUp, host).some(
      (route) => route.hand.id === "procedural-geometry-graph",
    ),
  );

  const legacy = Hands.create(
    "parametric-mesh",
    {
      id: "legacy-parametric",
      title: "Legacy parametric",
      kind: "mesh",
      intended_use: "mesh",
      target_canvas: {
        medium: "3d-surface",
        dimensions: { width: 1, height: 1, depth: 1, unit: "m" },
        colour: { space: "material-channel", transparency: "opaque" },
        behaviour: ["static"],
        performance: { max_polygon_count: 5000, max_file_bytes: 1000000 },
        intended_use: "mesh",
      },
      required_outputs: ["model/obj", "model/gltf-binary"],
      editable_recipe_formats: ["axm.spatial.project/v1"],
    },
    { host, createdAt, seed: "legacy-parametric" },
  );
  assert.equal(legacy.status, "READY");

  console.log(
    "Asset Hands geometry-graph selftest PASS (allowlisted acyclic DAG, primitive/transform/array/merge/output execution, deterministic request-local content cache and shared-node hits, target fit/tolerance, polygon/vertex/file budgets, integrity-bound real OBJ+GLB bakes, cycle/unknown-node/budget/tamper/spatial refusal, edit/validate/determinism, legacy parametric mesh)",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
