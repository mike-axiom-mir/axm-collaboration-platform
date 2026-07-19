#!/usr/bin/env node
"use strict";
const assert = require("assert");
const Hands = require("./asset-hands");
const Parity = require("./material-parity-codec");
const Schemas = require("./artifact-schema-catalog");

const createdAt = "2026-07-19T00:00:00Z";
const host = {
  capabilities: ["json", "png", "svg"],
  permissions: [],
  accepts: [
    Hands.RESULT_SCHEMA,
    "application/json",
    "image/png",
    "image/svg+xml",
    "application/mtlx+xml",
    "model/gltf-binary",
  ],
};
function materialBrief() {
  return {
    id: "parity-source",
    title: "Polished teal parity material",
    kind: "material",
    operation_mode: "create",
    intended_use: "material",
    target_canvas: {
      medium: "3d-surface",
      dimensions: { width: 1, height: 1, depth: 1, unit: "m" },
      colour: { space: "material-channel", transparency: "opaque" },
      behaviour: ["static"],
      performance: { max_polygon_count: 4000, max_file_bytes: 2000000 },
      intended_use: "material",
    },
    required_outputs: ["axm.material-graph/v1"],
    editable_recipe_formats: ["axm.material-graph/v1"],
  };
}
function parityBrief(source, overrides) {
  const base = {
    id: "parity-validation",
    title: "Portable material parity",
    kind: "material",
    operation_mode: "validate",
    intended_use: "material",
    target_canvas: {
      medium: "3d-surface",
      dimensions: { width: 1, height: 1, depth: 1, unit: "m" },
      colour: { space: "linear-srgb", transparency: "opaque" },
      spatial: { up_axis: "y", handedness: "right" },
      behaviour: ["static"],
      performance: { max_frame_ms: 16.7, max_file_bytes: 1000000 },
      intended_use: "material",
    },
    required_outputs: ["image/png", "material-parity-report"],
    editable_recipe_formats: ["axm.material-parity-recipe/v1"],
    quality_requirements: {
      require_preview: true,
      require_validation: true,
      require_editable_source: true,
    },
    source_artifacts: [source],
  };
  return Object.assign(base, overrides || {});
}
function artifact(result, id) {
  const found = result.artifacts.find((item) => item.id === id);
  assert(found, "missing " + id);
  return found;
}

(async function () {
  const installed = Hands.list();
  assert.equal(installed.length, 34);
  assert.equal(Hands.listMissingHands().length, 0);
  assert(!Hands.getMissingHand("renderer-material-parity"));

  const material = Hands.create("material-shader", materialBrief(), {
    host,
    createdAt,
    seed: "parity-source",
  });
  assert.equal(material.status, "READY");
  const graphArtifact = material.artifacts.find(
    (item) => item.metadata && item.metadata.schema === "axm.material-graph/v1",
  );
  assert(graphArtifact && graphArtifact.editable);
  const source = {
    id: "portable-material-graph",
    role: "source",
    mime: "application/json",
    format: "JSON",
    text: graphArtifact.text,
    digest: graphArtifact.digest,
    editable: true,
    metadata: { schema: "axm.material-graph/v1" },
  };
  const brief = parityBrief(source);
  assert(
    Hands.routes(brief, host).some(
      (route) => route.hand.id === "renderer-material-parity",
    ),
  );
  const result = await Hands.createAsync("renderer-material-parity", brief, {
    host,
    createdAt,
    seed: "parity-check",
  });
  assert.equal(result.status, "READY");
  assert(result.technical.pass);
  assert.equal(result.preview.artifactId, "material-parity-diff");
  assert.equal(
    result.artifacts.filter((item) => item.mime === "image/png").length,
    3,
  );

  [
    "gltf-reference-swatch",
    "materialx-reference-swatch",
    "material-parity-diff",
  ].forEach((id) => {
    const item = artifact(result, id);
    assert.equal(item.format, "PNG");
    assert(item.dataUrl.startsWith("data:image/png;base64,"));
    const inspection = Parity.inspectPng(item.dataUrl);
    assert(inspection.pass, inspection.errors.join(", "));
    assert(inspection.hasSrgb);
    assert(inspection.width <= 128 && inspection.height <= 128);
  });

  const recipe = JSON.parse(artifact(result, "material-parity-recipe").text);
  const report = JSON.parse(artifact(result, "material-parity-report").text);
  assert(Schemas.validate(recipe.schema, recipe).pass);
  assert(Schemas.validate(report.schema, report).pass);
  assert.equal(report.status, "PASS");
  assert.equal(report.native_renderer_validation, false);
  assert.equal(report.backends.length, 2);
  assert.equal(report.metrics.mean_absolute_linear, 0);
  assert.equal(report.metrics.rmse_linear, 0);
  assert.equal(report.metrics.mismatched_pixels, 0);
  assert(recipe.known_limits.some((limit) => /native Unity/.test(limit)));
  assert.equal(recipe.target_canvas.performance.max_frame_ms, 16.7);
  assert(result.measures.estimatedFrameMs <= 16.7);
  assert.deepEqual(recipe.provenance.source_artifact_digests, [
    graphArtifact.digest,
  ]);

  const proof = await Hands.verifyDeterminismAsync(
    "renderer-material-parity",
    brief,
    { host, createdAt, seed: "parity-check" },
  );
  assert(proof.pass, JSON.stringify(proof));

  const changedGraph = JSON.parse(graphArtifact.text);
  changedGraph.bindings = [
    {
      backend: Parity.MATERIALX_BACKEND,
      parameter: "specular_roughness",
      scale: 0.25,
    },
  ];
  const changedSource = Object.assign({}, source, {
    id: "mismatched-material",
    digest: "mismatched-binding",
    text: JSON.stringify(changedGraph),
  });
  const mismatch = await Hands.createAsync(
    "renderer-material-parity",
    parityBrief(changedSource, { id: "mismatched-parity" }),
    { host, createdAt, seed: "mismatched-parity" },
  );
  assert.equal(mismatch.status, "HOLD");
  const mismatchReport = JSON.parse(
    artifact(mismatch, "material-parity-report").text,
  );
  assert.equal(mismatchReport.status, "HOLD");
  assert(mismatchReport.metrics.mismatched_pixels > 0);
  assert(
    !mismatchReport.checks.find(
      (check) => check.name === "parity-within-declared-thresholds",
    ).pass,
  );

  const invalidGraph = JSON.parse(graphArtifact.text);
  invalidGraph.parameters.roughness = 2;
  const invalidBrief = parityBrief(
    Object.assign({}, source, {
      id: "invalid-material",
      digest: "invalid-material",
      text: JSON.stringify(invalidGraph),
    }),
    { id: "invalid-parity" },
  );
  await assert.rejects(
    () =>
      Hands.createAsync("renderer-material-parity", invalidBrief, {
        host,
        createdAt,
        seed: "invalid-parity",
      }),
    /roughness must be finite/,
  );

  const pngBytes = Parity.bytesFromDataUrl(
    artifact(result, "gltf-reference-swatch").dataUrl,
  ).slice();
  pngBytes[pngBytes.length - 16] ^= 1;
  assert(!Parity.inspectPng(pngBytes).pass);

  const impossibleTiming = parityBrief(source, {
    id: "impossible-reference-budget",
    target_canvas: Object.assign({}, brief.target_canvas, {
      performance: { max_frame_ms: 0.01, max_file_bytes: 1000000 },
    }),
  });
  const timed = await Hands.createAsync(
    "renderer-material-parity",
    impossibleTiming,
    { host, createdAt, seed: "impossible-reference-budget" },
  );
  assert.equal(timed.status, "HOLD");
  assert(
    !timed.validation_receipt.checks.find(
      (check) => check.name === "deterministic-frame-work-budget",
    ).pass,
  );

  const zUp = parityBrief(source, {
    id: "unsupported-z-up-parity",
    target_canvas: Object.assign({}, brief.target_canvas, {
      spatial: { up_axis: "z", handedness: "right" },
    }),
  });
  assert(
    !Hands.routes(zUp, host).some(
      (route) => route.hand.id === "renderer-material-parity",
    ),
  );

  const legacy = Hands.create("material-shader", materialBrief(), {
    host,
    createdAt,
    seed: "legacy-material",
  });
  assert.equal(legacy.status, "READY");
  assert(legacy.artifacts.some((item) => item.mime === "model/gltf-binary"));
  assert(legacy.artifacts.some((item) => item.mime === "application/mtlx+xml"));

  console.log(
    "Asset Hands material-parity selftest PASS (dual versioned CPU material interpreters, three real sRGB PNGs, linear-light diff thresholds, binding mismatch HOLD, graph/PNG tamper rejection, deterministic frame/file budgets, source provenance, routing refusal, determinism, legacy material workflow)",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
