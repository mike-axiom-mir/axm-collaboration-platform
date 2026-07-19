#!/usr/bin/env node
"use strict";
const assert = require("assert");
const Hands = require("./asset-hands");
const Navigation = require("./spatial-navigation-codec");
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
    "model/gltf-binary",
  ],
};
function brief(overrides) {
  return Object.assign(
    {
      id: "spatial-navigation",
      title: "Walkable modular arena",
      kind: "environment",
      operation_mode: "create",
      intended_use: "environment",
      target_canvas: {
        medium: "game-world",
        dimensions: {
          width: 20,
          height: 2,
          depth: 20,
          unit: "game-world-unit",
        },
        colour: { space: "material-channel", transparency: "opaque" },
        spatial: {
          up_axis: "y",
          handedness: "right",
          world_scale: 1,
          collision: "solid-and-walkable",
        },
        behaviour: ["static", "interactive"],
        performance: {
          max_polygon_count: 200,
          max_vertices: 200,
          max_file_bytes: 1000000,
        },
        intended_use: "environment",
      },
      required_outputs: [
        "collision-mesh+json",
        "navigation-mesh+json",
        "model/gltf-binary",
      ],
      editable_recipe_formats: ["axm.spatial-navigation-recipe/v1"],
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
function source(recipe, digest) {
  return {
    id: "navigation-recipe-source",
    role: "source",
    mime: "application/json",
    format: "JSON",
    text: JSON.stringify(recipe),
    digest: digest || "navigation-recipe-digest",
    editable: true,
    metadata: { schema: "axm.spatial-navigation-recipe/v1" },
  };
}

(async function () {
  assert.equal(Hands.list().length, 34);
  assert.equal(Hands.listMissingHands().length, 0);
  assert(!Hands.getMissingHand("spatial-collision-navigation"));
  assert(
    Hands.routes(brief(), host).some(
      (route) => route.hand.id === "spatial-collision-navigation",
    ),
  );

  const result = await Hands.createAsync(
    "spatial-collision-navigation",
    brief(),
    { host, createdAt, seed: "spatial-navigation" },
  );
  assert.equal(result.status, "READY");
  assert(result.technical.pass);
  assert.equal(result.measures.collisionTriangles, 14);
  assert(result.measures.navigationPolygons > 0);
  assert(result.measures.totalTriangles <= 200);
  assert(result.measures.totalVertices <= 200);
  assert(result.measures.excludedRegions > 0);
  assert(result.measures.connected);

  const collision = JSON.parse(artifact(result, "collision-mesh").text);
  const navigation = JSON.parse(artifact(result, "navigation-mesh").text);
  const collisionInspection = Navigation.inspectCollision(collision);
  const navigationInspection = Navigation.inspectNavigation(
    navigation,
    collision,
  );
  assert(collisionInspection.pass, collisionInspection.errors.join(", "));
  assert(navigationInspection.pass, navigationInspection.errors.join(", "));
  assert(navigationInspection.connected);
  assert.equal(collision.shapes[1].type, "aabb");
  assert(
    navigation.excluded_regions.some(
      (region) => region.reason === "collision-obstacle",
    ),
  );
  assert(
    navigation.adjacency.every((neighbors, index) =>
      neighbors.every((neighbor) =>
        navigation.adjacency[neighbor].includes(index),
      ),
    ),
  );

  const glb = artifact(result, "collision-debug-glb");
  assert.equal(glb.mime, "model/gltf-binary");
  assert.equal(glb.metadata.collisionProxy, true);
  assert.equal(glb.metadata.renderGeometry, false);
  const glbInspection = GlTF.inspect(
    new Uint8Array(Buffer.from(glb.dataUrl.split(",")[1], "base64")),
  );
  assert(glbInspection.pass, glbInspection.errors.join(", "));
  assert.equal(glb.metadata.triangles, 14);

  const recipe = JSON.parse(artifact(result, "spatial-navigation-recipe").text);
  const report = JSON.parse(
    artifact(result, "spatial-navigation-validation").text,
  );
  assert(Schemas.validate(collision.schema, collision).pass);
  assert(Schemas.validate(navigation.schema, navigation).pass);
  assert(Schemas.validate(recipe.schema, recipe).pass);
  assert(Schemas.validate(report.schema, report).pass);
  assert.equal(report.status, "PASS");
  assert.equal(report.debug_delivery.render_geometry, false);
  assert(
    recipe.known_limits.some((limit) =>
      /no arbitrary render-mesh decomposition/.test(limit),
    ),
  );

  const proof = await Hands.verifyDeterminismAsync(
    "spatial-collision-navigation",
    brief(),
    { host, createdAt, seed: "spatial-navigation" },
  );
  assert(proof.pass, JSON.stringify(proof));

  const bounded = brief({
    id: "minimum-nav-budget",
    target_canvas: Object.assign({}, brief().target_canvas, {
      performance: {
        max_polygon_count: 20,
        max_vertices: 21,
        max_file_bytes: 1000000,
      },
    }),
  });
  const boundedResult = await Hands.createAsync(
    "spatial-collision-navigation",
    bounded,
    { host, createdAt, seed: "minimum-nav-budget" },
  );
  assert.equal(boundedResult.status, "READY");
  assert.equal(boundedResult.measures.divisions, 2);
  assert.equal(boundedResult.measures.totalTriangles, 20);
  assert.equal(boundedResult.measures.totalVertices, 21);
  assert(boundedResult.measures.connected);

  const editedRecipe = JSON.parse(JSON.stringify(recipe));
  editedRecipe.generation.max_slope_degrees = 30;
  const editBrief = brief({
    id: "edit-navigation",
    operation_mode: "edit",
    source_artifacts: [source(editedRecipe, "edited-navigation-source")],
  });
  const edited = await Hands.createAsync(
    "spatial-collision-navigation",
    editBrief,
    { host, createdAt, seed: "edit-navigation" },
  );
  assert.equal(edited.status, "READY");
  assert.equal(
    JSON.parse(artifact(edited, "navigation-mesh").text).settings
      .max_slope_degrees,
    30,
  );
  assert.deepEqual(
    JSON.parse(artifact(edited, "spatial-navigation-recipe").text).provenance
      .source_artifact_digests,
    ["edited-navigation-source"],
  );

  const validateBrief = brief({
    id: "validate-navigation",
    operation_mode: "validate",
    source_artifacts: [source(recipe, "validate-navigation-source")],
  });
  const validated = await Hands.createAsync(
    "spatial-collision-navigation",
    validateBrief,
    { host, createdAt, seed: "validate-navigation" },
  );
  assert.equal(validated.status, "READY");
  assert(
    validated.validation_receipt.checks.find(
      (check) => check.name === "source-recipe-integrity",
    ).pass,
  );
  const tamperedRecipe = JSON.parse(JSON.stringify(recipe));
  tamperedRecipe.navigation.digest = "tampered-navigation-digest";
  const tampered = await Hands.createAsync(
    "spatial-collision-navigation",
    brief({
      id: "tampered-navigation",
      operation_mode: "validate",
      source_artifacts: [source(tamperedRecipe, "tampered-navigation-source")],
    }),
    { host, createdAt, seed: "tampered-navigation" },
  );
  assert.equal(tampered.status, "HOLD");
  assert(
    !tampered.validation_receipt.checks.find(
      (check) => check.name === "source-recipe-integrity",
    ).pass,
  );

  const scaled = brief({
    id: "scaled-origin-navigation",
    target_canvas: {
      medium: "game-world",
      dimensions: { width: 40, height: 4, depth: 20, unit: "game-world-unit" },
      colour: { space: "material-channel", transparency: "opaque" },
      spatial: {
        up_axis: "y",
        handedness: "right",
        world_scale: 0.5,
        origin: [10, 2, -4],
        collision: "separate-proxy",
      },
      behaviour: ["static", "interactive"],
      performance: {
        max_polygon_count: 200,
        max_vertices: 200,
        max_file_bytes: 1000000,
      },
      intended_use: "environment",
    },
  });
  const scaledResult = await Hands.createAsync(
    "spatial-collision-navigation",
    scaled,
    { host, createdAt, seed: "scaled-origin-navigation" },
  );
  assert.equal(scaledResult.status, "READY");
  const scaledReport = JSON.parse(
    artifact(scaledResult, "spatial-navigation-validation").text,
  );
  assert.deepEqual(scaledReport.spatial.origin_metres, [5, 1, -2]);
  assert.equal(scaledReport.spatial.world_scale, 0.5);
  assert.equal(scaledReport.collision.policy, "separate-proxy");

  const badCollision = JSON.parse(JSON.stringify(collision));
  badCollision.triangles[0] = [0, 0, 0];
  assert(!Navigation.inspectCollision(badCollision).pass);
  const badNavigation = JSON.parse(JSON.stringify(navigation));
  badNavigation.adjacency[0] = [];
  assert(!Navigation.inspectNavigation(badNavigation, collision).pass);
  const corruptGlb = new Uint8Array(
    Buffer.from(glb.dataUrl.split(",")[1], "base64"),
  );
  corruptGlb[12] ^= 1;
  assert(!GlTF.inspect(corruptGlb).pass);

  const unsupportedPolicy = brief({
    id: "unsupported-collision-policy",
    target_canvas: Object.assign({}, brief().target_canvas, {
      spatial: {
        up_axis: "y",
        handedness: "right",
        world_scale: 1,
        collision: "none",
      },
    }),
  });
  const policyResult = await Hands.createAsync(
    "spatial-collision-navigation",
    unsupportedPolicy,
    { host, createdAt, seed: "unsupported-collision-policy" },
  );
  assert.equal(policyResult.status, "HOLD");
  assert(
    !policyResult.validation_receipt.checks.find(
      (check) => check.name === "collision-policy",
    ).pass,
  );
  const impossible = brief({
    id: "impossible-navigation-budget",
    target_canvas: Object.assign({}, brief().target_canvas, {
      performance: {
        max_polygon_count: 19,
        max_vertices: 21,
        max_file_bytes: 1000000,
      },
    }),
  });
  assert(
    !Hands.routes(impossible, host).some(
      (route) => route.hand.id === "spatial-collision-navigation",
    ),
  );
  const zUp = brief({
    id: "z-up-navigation",
    target_canvas: Object.assign({}, brief().target_canvas, {
      spatial: {
        up_axis: "z",
        handedness: "right",
        world_scale: 1,
        collision: "solid-and-walkable",
      },
    }),
  });
  assert(
    !Hands.routes(zUp, host).some(
      (route) => route.hand.id === "spatial-collision-navigation",
    ),
  );

  const legacy = Hands.create(
    "parametric-mesh",
    {
      id: "legacy-render-mesh",
      title: "Legacy render mesh",
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
      required_outputs: ["model/gltf-binary"],
      editable_recipe_formats: ["axm.spatial.project/v1"],
    },
    { host, createdAt, seed: "legacy-render-mesh" },
  );
  assert.equal(legacy.status, "READY");
  assert(
    !legacy.artifacts.find((item) => item.mime === "model/gltf-binary").metadata
      .collisionProxy,
  );

  console.log(
    "Asset Hands spatial-navigation selftest PASS (separate non-render collision triangles + navigation polygons, obstacle exclusion, symmetric adjacency/connectivity, world scale/origin/policy, fitted polygon/vertex/file budgets, real debug GLB, semantic source integrity, edit/validate/tamper/determinism/spatial refusal, legacy render mesh separation)",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
