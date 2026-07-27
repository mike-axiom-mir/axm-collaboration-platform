#!/usr/bin/env node
"use strict";
const assert = require("assert");
const Hands = require("./asset-hands");
const USD = require("./openusd-codec");
const Schemas = require("./artifact-schema-catalog");

const createdAt = "2026-07-19T00:00:00Z";
const host = {
  capabilities: ["json", "svg"],
  permissions: [],
  accepts: [
    Hands.RESULT_SCHEMA,
    "model/vnd.usd",
    "model/vnd.usdz+zip",
    "application/json",
    "image/svg+xml",
    "model/gltf-binary",
    "model/obj",
  ],
};
function brief(overrides) {
  return Object.assign(
    {
      id: "openusd-scene",
      title: "Modular OpenUSD environment",
      kind: "scene",
      operation_mode: "create",
      intended_use: "scene",
      target_canvas: {
        medium: "3d-surface",
        dimensions: { width: 10, height: 4, depth: 8, unit: "m" },
        colour: { space: "linear-srgb", transparency: "opaque" },
        spatial: { up_axis: "y", handedness: "right", world_scale: 1 },
        behaviour: ["static", "interactive"],
        performance: {
          max_polygon_count: 100,
          max_vertices: 100,
          max_file_bytes: 1000000,
        },
        intended_use: "scene",
      },
      required_outputs: [
        "model/vnd.usd",
        "model/vnd.usdz+zip",
        "scene-composition-report",
      ],
      editable_recipe_formats: ["axm.openusd-scene-recipe/v1"],
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
  const value = result.artifacts.find((item) => item.id === id);
  assert(value, "missing " + id);
  return value;
}

(async function () {
  assert.equal(new Set(Hands.list().map((hand) => hand.id)).size, Hands.list().length);
  assert.equal(Hands.listMissingHands().length, 0);
  assert(!Hands.getMissingHand("openusd-scene-composition"));
  assert(
    Hands.routes(brief(), host).some(
      (route) => route.hand.id === "openusd-scene-composition",
    ),
  );

  const result = await Hands.createAsync("openusd-scene-composition", brief(), {
    host,
    createdAt,
    seed: "openusd-scene",
  });
  assert.equal(result.status, "READY");
  assert(result.technical.pass);
  assert.equal(result.measures.layers, 5);
  assert.equal(result.measures.references, 4);
  assert.equal(result.measures.variants, 2);
  assert.equal(result.measures.activeTriangles, 26);
  assert.equal(result.measures.activeVertices, 20);
  assert(result.measures.aligned64);

  const root = artifact(result, "openusd-root-layer");
  assert.equal(root.mime, "model/vnd.usd");
  assert.equal(root.format, "USDA");
  assert(root.text.startsWith("#usda 1.0\n"));
  assert(root.text.includes('variantSet "model"'));
  assert(root.text.includes("prepend references"));
  assert(root.text.includes("prepend payload"));
  assert(root.text.includes("metersPerUnit = 1"));
  assert(!root.text.trimStart().startsWith("{"));

  const packageArtifact = artifact(result, "openusd-scene-package");
  assert.equal(packageArtifact.mime, "model/vnd.usdz+zip");
  assert.equal(packageArtifact.format, "USDZ");
  assert(packageArtifact.dataUrl.startsWith("data:model/vnd.usdz+zip;base64,"));
  const packageBytes = USD.bytesFromDataUrl(packageArtifact.dataUrl);
  assert.equal(packageBytes[0], 0x50);
  assert.equal(packageBytes[1], 0x4b);
  const inspection = USD.inspectPackage(packageBytes);
  assert(inspection.pass, inspection.errors.join(", "));
  assert.equal(inspection.rootLayer, "root.usda");
  assert.equal(inspection.layerCount, 5);
  assert.equal(inspection.missingReferences.length, 0);
  assert(inspection.allDataAligned64);
  assert(inspection.entries.every((entry) => entry.data_offset % 64 === 0));
  assert.deepEqual(
    inspection.entries.map((entry) => entry.name),
    [
      "root.usda",
      "layers/cube.usda",
      "layers/ground.usda",
      "layers/sphere.usda",
      "payloads/environment.usda",
    ],
  );

  const composition = JSON.parse(
    artifact(result, "usd-scene-composition").text,
  );
  const recipe = JSON.parse(artifact(result, "openusd-scene-recipe").text);
  const report = JSON.parse(artifact(result, "scene-composition-report").text);
  assert(Schemas.validate(composition.schema, composition).pass);
  assert(Schemas.validate(recipe.schema, recipe).pass);
  assert(Schemas.validate(report.schema, report).pass);
  assert.equal(report.status, "PASS");
  assert.equal(report.external_openusd_validation, false);
  assert.equal(report.composition_arcs.payloads, 1);
  assert.equal(report.resolver.missing_references.length, 0);
  assert.equal(recipe.package.alignment_bytes, 64);
  assert(
    recipe.known_limits.some((limit) => /full OpenUSD composition/.test(limit)),
  );

  const proof = await Hands.verifyDeterminismAsync(
    "openusd-scene-composition",
    brief(),
    { host, createdAt, seed: "openusd-scene" },
  );
  assert(proof.pass, JSON.stringify(proof));

  const editedComposition = JSON.parse(JSON.stringify(composition));
  editedComposition.id = "sphere-active-scene";
  editedComposition.active_variant = "Sphere";
  const editBrief = brief({
    id: "edit-openusd-scene",
    operation_mode: "edit",
    source_artifacts: [
      {
        id: "composition-source",
        role: "source",
        mime: "application/json",
        format: "JSON",
        text: JSON.stringify(editedComposition),
        digest: "composition-digest",
        editable: true,
        metadata: { schema: "axm.usd-scene-composition/v1" },
      },
    ],
  });
  const edited = await Hands.createAsync(
    "openusd-scene-composition",
    editBrief,
    { host, createdAt, seed: "edit-openusd-scene" },
  );
  assert.equal(edited.status, "READY");
  assert(
    artifact(edited, "openusd-root-layer").text.includes(
      'string model = "Sphere"',
    ),
  );
  assert.notEqual(
    artifact(edited, "openusd-scene-package").digest,
    packageArtifact.digest,
  );
  assert.deepEqual(
    JSON.parse(artifact(edited, "openusd-scene-recipe").text).provenance
      .source_artifact_digests,
    ["composition-digest"],
  );

  const validateBrief = brief({
    id: "validate-openusd-package",
    operation_mode: "validate",
    required_outputs: ["model/vnd.usdz+zip", "scene-composition-report"],
    source_artifacts: [
      {
        id: "usdz-source",
        role: "source",
        mime: "model/vnd.usdz+zip",
        format: "USDZ",
        dataUrl: packageArtifact.dataUrl,
        digest: "usdz-source-digest",
      },
    ],
  });
  const validated = await Hands.createAsync(
    "openusd-scene-composition",
    validateBrief,
    { host, createdAt, seed: "validate-openusd-package" },
  );
  assert.equal(validated.status, "READY");
  assert.equal(
    artifact(validated, "validated-openusd-package").dataUrl,
    packageArtifact.dataUrl,
  );
  assert.equal(
    JSON.parse(artifact(validated, "scene-composition-report").text).source
      .digest,
    "usdz-source-digest",
  );

  const gameWorld = brief({
    id: "game-world-usd",
    target_canvas: {
      medium: "game-world",
      dimensions: { width: 20, height: 8, depth: 16, unit: "game-world-unit" },
      colour: { space: "linear-srgb", transparency: "opaque" },
      spatial: { up_axis: "y", handedness: "right", world_scale: 0.25 },
      behaviour: ["static", "interactive"],
      performance: {
        max_polygon_count: 100,
        max_vertices: 100,
        max_file_bytes: 1000000,
      },
      intended_use: "scene",
    },
  });
  const worldResult = await Hands.createAsync(
    "openusd-scene-composition",
    gameWorld,
    { host, createdAt, seed: "game-world-usd" },
  );
  assert.equal(worldResult.status, "READY");
  assert(
    artifact(worldResult, "openusd-root-layer").text.includes(
      "metersPerUnit = 0.25",
    ),
  );
  assert.equal(
    JSON.parse(artifact(worldResult, "usd-scene-composition").text)
      .meters_per_unit,
    0.25,
  );

  const archive = USD.inspectArchive(packageBytes);
  const missingFiles = {};
  Object.keys(archive.files).forEach((name) => {
    missingFiles[name] = archive.files[name];
  });
  missingFiles["root.usda"] = USD.decode(missingFiles["root.usda"]).replace(
    "layers/cube.usda",
    "layers/missing.usda",
  );
  assert.throws(
    () => USD.packageUsd(missingFiles, "root.usda"),
    /unresolved package references/,
  );
  assert.throws(
    () =>
      USD.packageUsd(
        { "root.usda": root.text, "../escape.usda": root.text },
        "root.usda",
      ),
    /unsafe USDZ path/,
  );

  const corrupt = packageBytes.slice();
  corrupt[inspection.entries[1].data_offset + 10] ^= 1;
  assert(!USD.inspectPackage(corrupt).pass);

  const tooSmall = brief({
    id: "too-small-usd-budget",
    target_canvas: Object.assign({}, brief().target_canvas, {
      performance: {
        max_polygon_count: 20,
        max_vertices: 100,
        max_file_bytes: 1000000,
      },
    }),
  });
  assert(
    !Hands.routes(tooSmall, host).some(
      (route) => route.hand.id === "openusd-scene-composition",
    ),
  );
  const zUp = brief({
    id: "z-up-usd",
    target_canvas: Object.assign({}, brief().target_canvas, {
      spatial: { up_axis: "z", handedness: "right", world_scale: 1 },
    }),
  });
  assert(
    !Hands.routes(zUp, host).some(
      (route) => route.hand.id === "openusd-scene-composition",
    ),
  );

  const legacy = Hands.create(
    "parametric-mesh",
    {
      id: "legacy-static-glb",
      title: "Legacy static GLB",
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
    { host, createdAt, seed: "legacy-static-glb" },
  );
  assert.equal(legacy.status, "READY");
  assert(legacy.artifacts.some((item) => item.mime === "model/gltf-binary"));

  console.log(
    "Asset Hands OpenUSD selftest PASS (real USDA reference/payload/variant layers, stored USDZ ZIP with CRC and 64-byte file alignment, package-relative closure/missing-reference refusal, canvas scale/spatial and geometry/file budgets, edit/inspect/validate/tamper/determinism, honest external-runtime boundary, legacy GLB)",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
