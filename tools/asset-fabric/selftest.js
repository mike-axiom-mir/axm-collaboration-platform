#!/usr/bin/env node
"use strict";
const assert = require("assert"),
  fs = require("fs"),
  path = require("path");
const Core = require("./fabric-core");
const Creation = require("../governed-evolution-lab/creation-core");
const Hands = require("../../shared/asset-hands/asset-hands");
const HandCore = require("../../shared/asset-hands/asset-hand-core");
const UCP = require("../../shared/asset-hands/universal-component");
const Composer = require("../../shared/asset-hands/play-composer");
let pass = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log("PASS " + name);
  } catch (error) {
    console.error("FAIL " + name + "\n  " + error.stack);
    process.exitCode = 1;
  }
}
const publishedContract = require('./module.contract.json');
test('contract declares browser persistence lifecycle seams', () =>
  assert.deepStrictEqual(publishedContract.lifecycle, {
    state_owner: 'browser',
    reload: 'resume',
    disconnect: 'not-applicable',
    cleanup: 'explicit',
  }));
function reviewReceipt(candidate, overrides) {
  return Object.assign(
    {
      schema: Core.MACHINE_REVIEW_RECEIPT_SCHEMA,
      receiptId: "receipt-" + candidate.id,
      candidateId: candidate.id,
      candidateDigest: Core.candidateDigest(candidate),
      reviewer: {
        identityId: "axiom-mir",
        kind: "machine",
        model: "test-model",
        sessionId: "test-session",
      },
      issuer: { kind: "connector", id: "codex-local-test" },
      verdict: "UP",
      reviewedAt: new Date().toISOString(),
      evidence: {
        summary: "Distinct and readable on the declared target canvas.",
      },
    },
    overrides || {},
  );
}
const host = {
  capabilities: ["svg", "json"],
  permissions: [],
  accepts: [
    Hands.RESULT_SCHEMA,
    "image/svg+xml",
    "image/png",
    "image/apng",
    "image/ktx2",
    "application/json",
    "application/pdf",
    "application/dxf",
    "application/mtlx+xml",
    "application/vnd.opentimelineio+json",
    "text/css",
    "text/plain",
    "model/obj",
    "model/gltf-binary",
  ],
};

test("starter needs declare target canvas, intended use, quality, outputs and recipes", () =>
  Core.baseState().needs.forEach((need) => {
    assert.equal(need.schema, Core.NEED_SCHEMA);
    assert.equal(need.target_canvas.schema, Hands.TARGET_CANVAS_SCHEMA);
    assert(need.intended_use);
    assert(need.quality_requirements);
    assert(need.required_outputs.length);
    assert(need.editable_recipe_formats.length);
  }));
test("future asset kinds retain semantic identity for later modular hands", () =>
  assert.equal(
    Core.normalizeNeed({ kind: "future-projection-map" }).kind,
    "future-projection-map",
  ));
test("legacy local SVG family remains valid", () => {
  const family = Core.family(Core.baseState().needs[0], 1);
  assert.equal(family.length, 3);
  family.forEach((candidate) => assert(Core.validate(candidate).pass));
});
test("UCP graph becomes a first-class governed Fabric candidate and vocabulary recipe", () => {
  let state = Core.baseState();
  const candidate = Core.family(state.needs[0], 1)[0];
  candidate.archiveDecision = "PRESERVE_SOURCE_AND_RECIPE";
  state.candidates = [candidate];
  state = Core.vote(state, candidate.id, "mike", true);
  state = Core.applyMachineReview(state, reviewReceipt(state.candidates[0]));
  assert(state.candidates[0].votes.mike);
  assert(state.candidates[0].votes["axiom-mir"]);

  const component = UCP.sealComponent({
    id: "axm.ui.revive-shape",
    version: "1.0.0",
    kind: "shape",
    title: "Revive icon shape",
    ports: {
      inputs: [],
      outputs: [
        {
          id: "draft",
          type: "visual.draft",
          required: false,
          multiple: true,
        },
      ],
    },
    canvas_compatibility: {
      mediums: ["ui"],
      intended_uses: ["icon"],
      constraints: [],
    },
    capabilities: { provides: ["visual.draft"], requires: [] },
    artifact_refs: [],
    payload: { shape: "cross", corner_radius: 0.22, inset: 0.18 },
    provenance: {
      origin_type: "authored",
      source_id: "asset-fabric-selftest",
      source_digest: UCP.sha256("asset-fabric-selftest"),
      license_id: "CC0-1.0",
      created_by: "axm-selftest",
      created_at: "2026-07-22T00:00:00.000Z",
    },
    resource_profile: {
      cpu: "light",
      gpu: "none",
      peak_memory_bytes: 2048,
      working_storage_bytes: 0,
      native_runtime: null,
    },
    verification: {
      automatic_checks: ["schema-and-digest"],
      human_judgments: ["readability and taste"],
      assurance_ceiling: "contract and draft parameters only",
    },
    mutability: "immutable",
  });
  const registry = UCP.createRegistry([component]);
  const graph = UCP.sealGraph({
    id: "axm.graph.revive-icon",
    title: "Revive icon component graph",
    target_canvas: candidate.target_canvas,
    components: [
      {
        instance_id: "shape",
        component_id: component.id,
        component_version: component.version,
        component_digest: component.digest,
        configuration: {},
      },
    ],
    connections: [],
    outputs: [
      {
        id: "draft",
        instance_id: "shape",
        port: "draft",
        role: "ephemeral-preview-draft",
      },
    ],
  });
  const receipt = UCP.compose(graph, registry, {
    createdAt: "2026-07-22T00:00:00.000Z",
  });
  state = Core.attachComponentGraph(state, candidate.id, graph, receipt);
  const attached = state.candidates[0];
  assert.equal(attached.componentGraph.digest, graph.digest);
  assert.equal(attached.componentReceipt.status, "READY_CONTRACT");
  assert.equal(attached.votes.mike, null);
  assert.equal(attached.votes["axiom-mir"], null);
  const packet = Core.machineReviewRequest(state, candidate.id);
  assert.equal(packet.componentGraph.digest, graph.digest);
  assert.equal(packet.componentReceipt.digest, receipt.digest);
  state = Core.vote(state, candidate.id, "mike", true);
  state = Core.applyMachineReview(state, reviewReceipt(state.candidates[0]));
  state = Core.promote(state, candidate.id);
  assert.equal(state.vocabulary[0].componentGraph.digest, graph.digest);
  assert.equal(state.vocabulary[0].componentReceipt.digest, receipt.digest);
});
test("Fabric refuses a component graph bound to another target canvas", () => {
  const state = Core.baseState();
  const candidate = Core.family(state.needs[0], 1)[0];
  state.candidates = [candidate];
  const component = UCP.sealComponent({
    id: "axm.world.ground-seed",
    version: "1.0.0",
    kind: "tile",
    title: "Ground seed",
    ports: {
      inputs: [],
      outputs: [
        {
          id: "tile",
          type: "terrain.tile",
          required: false,
          multiple: true,
        },
      ],
    },
    canvas_compatibility: {
      mediums: ["game-world"],
      intended_uses: ["ground-tile"],
      constraints: [],
    },
    capabilities: { provides: ["terrain.tile"], requires: [] },
    artifact_refs: [],
    payload: { seed: 7 },
    provenance: {
      origin_type: "authored",
      source_id: "asset-fabric-selftest",
      source_digest: UCP.sha256("asset-fabric-selftest"),
      license_id: "CC0-1.0",
      created_by: "axm-selftest",
      created_at: "2026-07-22T00:00:00.000Z",
    },
    resource_profile: {
      cpu: "light",
      gpu: "none",
      peak_memory_bytes: 1024,
      working_storage_bytes: 0,
      native_runtime: null,
    },
    verification: {
      automatic_checks: ["schema-and-digest"],
      human_judgments: [],
      assurance_ceiling: "contract only",
    },
    mutability: "immutable",
  });
  const registry = UCP.createRegistry([component]);
  const graph = UCP.sealGraph({
    id: "axm.graph.ground-seed",
    target_canvas: Core.baseState().needs[1].target_canvas,
    components: [
      {
        instance_id: "ground",
        component_id: component.id,
        component_version: component.version,
        component_digest: component.digest,
        configuration: {},
      },
    ],
    connections: [],
    outputs: [
      {
        id: "tile",
        instance_id: "ground",
        port: "tile",
        role: "terrain-tile",
      },
    ],
  });
  const receipt = UCP.compose(graph, registry);
  assert.throws(
    () => Core.attachComponentGraph(state, candidate.id, graph, receipt),
    /target canvas does not match candidate/,
  );
});
test("human play controls become a valid deterministic Fabric candidate only after explicit incubation", () => {
  const draft = Composer.buildDraft({
    title: "Human component branch",
    label: "GO",
    growth_direction: "balance",
    growth_energy: 3,
  });
  const need = Core.normalizeNeed({
    title: draft.spec.title,
    target: "shared",
    kind: "ui-component",
    intended_use: "component-draft",
    width: 640,
    height: 360,
    target_canvas: draft.graph.target_canvas,
    required_outputs: ["image/svg+xml"],
    editable_recipe_formats: [Core.UCP_GRAPH_SCHEMA],
  });
  const candidate = Core.candidateFromComponentDraft(need, 1, draft);
  assert(candidate.technical.pass);
  assert.equal(candidate.origin.kind, "human-play-to-compose/v1");
  assert.equal(candidate.componentGraph.digest, draft.graph.digest);
  assert.equal(candidate.votes.mike, null);
  assert.equal(candidate.votes["axiom-mir"], null);
  const tampered = JSON.parse(JSON.stringify(draft));
  tampered.preview.svg = tampered.preview.svg.replace("GO", "NO");
  assert.throws(
    () => Core.candidateFromComponentDraft(need, 1, tampered),
    /preview digest mismatch/,
  );
});
test("canvas-aware need routes through compatible hands only", () => {
  const need = Core.baseState().needs[1],
    handFamily = Hands.createFamily(need, {
      maxHands: 8,
      seed: "fabric-test",
      createdAt: "2026-07-18T00:00:00Z",
      host,
    }),
    family = Core.familyFromHands(need, 1, handFamily);
  assert.equal(handFamily.status, "READY");
  assert(
    handFamily.results.some((result) => result.hand.id === "surface-pattern"),
  );
  assert(
    !handFamily.results.some((result) => result.hand.id === "print-layout"),
  );
  family.forEach((candidate) => {
    assert(candidate.technical.pass);
    assert.equal(candidate.target_canvas.medium, "game-world");
    assert(candidate.handResult.creation_recipe);
    assert(candidate.handResult.validation_receipt);
  });
});
test("reference-validation envelopes survive candidates, review handoffs and state reload", () => {
  const need = Core.baseState().needs[0];
  const result = Hands.createFamily(need, {
    maxHands: 1,
    seed: "fabric-reference-validation",
    createdAt: "2026-07-19T14:00:00Z",
    host,
  }).results[0];
  result.reference_validation = {
    schema: "axm.asset-verification-envelope/v1",
    version: "1.0.0",
    status: "CORROBORATED",
    result_id: result.id,
    result_digest: result.digest,
    target_canvas_digest: result.validation_receipt.target_canvas_digest,
    target_canvas_sha256: "0".repeat(64),
    requirements: [],
    receipts: [],
    createdAt: "2026-07-19T14:00:00Z",
  };
  const candidate = Core.candidateFromHandResult(need, 1, result, 0);
  assert(candidate.technical.pass, candidate.technical.errors.join(", "));
  assert.equal(candidate.referenceValidation.result_digest, result.digest);
  const state = Core.baseState();
  state.candidates = [candidate];
  assert.equal(Core.machineReviewRequest(state, candidate.id).referenceValidation.result_id, result.id);
  assert.equal(Core.normalizeState(state).candidates[0].referenceValidation.result_digest, result.digest);
  const bad = JSON.parse(JSON.stringify(candidate));
  bad.handResult.reference_validation.result_digest = "wrong";
  assert(!Core.validate(bad).pass);
});
test("physical canvas constraints reach the chosen hand and candidate", () => {
  const need = Core.normalizeNeed({
      id: "engrave",
      title: "Wood mark",
      kind: "logo",
      intended_use: "engraving",
      target_canvas: {
        medium: "wood",
        dimensions: { width: 180, height: 80, unit: "mm" },
        colour: { space: "grayscale", transparency: "opaque" },
        physical: { minimum_stroke: 0.8, cutting_tool_width: 1.2, depth: 2 },
        behaviour: ["static"],
        intended_use: "engraving",
      },
      required_outputs: ["application/dxf"],
      editable_recipe_formats: ["axm.physical-toolpath-recipe/v1"],
    }),
    family = Hands.createFamily(need, {
      host,
      maxHands: 8,
      createdAt: "2026-07-18T00:00:00Z",
    }),
    candidate = Core.familyFromHands(need, 1, family)[0];
  assert.equal(family.results[0].hand.id, "physical-mark");
  assert.equal(candidate.handResult.creation_recipe.parameters.toolWidth, 1.2);
  assert.equal(candidate.target_canvas.physical.depth, 2);
});
test("3D material canvas enters Fabric as real MaterialX plus GLB preview", () => {
  const need = Core.normalizeNeed({
      id: "mat",
      title: "Armour material",
      kind: "texture",
      intended_use: "material",
      target_canvas: {
        medium: "3d-surface",
        dimensions: { width: 1, height: 1, unit: "m" },
        colour: { space: "material-channel", transparency: "opaque" },
        behaviour: ["static"],
        performance: { max_polygon_count: 5000 },
        intended_use: "material",
      },
      required_outputs: ["model/gltf-binary"],
      editable_recipe_formats: ["axm.material-graph/v1"],
    }),
    family = Hands.createFamily(need, {
      host,
      maxHands: 8,
      seed: "material-fabric",
      createdAt: "2026-07-18T00:00:00Z",
    }),
    candidate = Core.familyFromHands(need, 1, family)[0];
  assert.equal(family.status, "READY");
  assert.equal(candidate.handResult.hand.id, "material-shader");
  assert.equal(candidate.primaryArtifact.format, "GLB");
  assert(
    candidate.handResult.artifacts.some(
      (artifact) =>
        artifact.format === "MTLX" &&
        artifact.text.includes('<materialx version="1.38">'),
    ),
  );
  assert(
    candidate.handResult.hand.portability.unsupported_features.includes(
      "KTX2 compression",
    ),
  );
});
test("supported parametric 3D canvas enters Fabric as OBJ, GLB and editable project", () => {
  const need = Core.normalizeNeed({
      id: "mesh",
      title: "Workshop crate",
      kind: "mesh",
      intended_use: "mesh",
      target_canvas: {
        medium: "3d-surface",
        dimensions: { width: 2, height: 1, depth: 1, unit: "m" },
        colour: { space: "material-channel", transparency: "opaque" },
        behaviour: ["static"],
        performance: { max_polygon_count: 100 },
        intended_use: "mesh",
      },
      required_outputs: ["model/obj"],
      editable_recipe_formats: ["axm.parametric-mesh-recipe/v1"],
    }),
    handFamily = Hands.createFamily(need, {
      host,
      maxHands: 8,
      seed: "mesh-fabric",
      createdAt: "2026-07-18T00:00:00Z",
    }),
    candidate = Core.familyFromHands(need, 1, handFamily)[0];
  assert.equal(handFamily.status, "READY");
  assert.equal(handFamily.results[0].hand.id, "parametric-mesh");
  assert.equal(candidate.primaryArtifact.format, "OBJ");
  assert(
    candidate.handResult.artifacts.some(
      (artifact) =>
        artifact.metadata &&
        artifact.metadata.schema === "axm.spatial.project/v1",
    ),
  );
  assert(
    candidate.handResult.artifacts.some(
      (artifact) => artifact.format === "GLB",
    ),
  );
  assert(
    candidate.handResult.hand.portability.unsupported_features.includes("KTX2"),
  );
});
test("production print canvas enters Fabric as PDF with editable print source", () => {
  const need = Core.normalizeNeed({
      id: "pdf",
      title: "Production poster",
      kind: "poster",
      intended_use: "poster",
      target_canvas: {
        medium: "print",
        dimensions: { width: 210, height: 297, unit: "mm" },
        colour: {
          space: "cmyk",
          transparency: "opaque",
          printable_colours: true,
        },
        physical: { bleed: 3, minimum_stroke: 0.25 },
        behaviour: ["static"],
        intended_use: "poster",
      },
      required_outputs: ["application/pdf"],
      editable_recipe_formats: ["axm.production-print-recipe/v1"],
    }),
    family = Hands.createFamily(need, {
      host,
      maxHands: 8,
      seed: "pdf-fabric",
      createdAt: "2026-07-18T00:00:00Z",
    }),
    candidate = Core.familyFromHands(need, 1, family).find(
      (item) => item.handResult.hand.id === "production-print",
    );
  assert(candidate);
  assert.equal(candidate.primaryArtifact.format, "PDF");
  assert(
    candidate.handResult.artifacts.some(
      (artifact) =>
        artifact.metadata &&
        artifact.metadata.schema === "axm.print-document/v1",
    ),
  );
});
test("animated raster canvas enters Fabric as APNG rather than SVG", () => {
  const need = Core.normalizeNeed({
      id: "apng",
      title: "Animated runner",
      kind: "character",
      intended_use: "character",
      target_canvas: {
        medium: "game-world",
        dimensions: { width: 48, height: 48, unit: "px" },
        colour: { space: "srgb", transparency: "required" },
        behaviour: ["animated"],
        performance: { max_animation_frames: 6, frames_per_second: 12 },
        intended_use: "character",
      },
      required_outputs: ["image/apng"],
      editable_recipe_formats: ["axm.animated-raster-recipe/v1"],
    }),
    family = Hands.createFamily(need, {
      host,
      maxHands: 8,
      seed: "apng-fabric",
      createdAt: "2026-07-18T00:00:00Z",
    }),
    candidate = Core.familyFromHands(need, 1, family)[0];
  assert.equal(candidate.primaryArtifact.format, "APNG");
  assert.equal(candidate.svg, "");
  assert(
    candidate.handResult.artifacts.some(
      (artifact) =>
        artifact.metadata &&
        artifact.metadata.schema === "axm.animated-raster-recipe/v1",
    ),
  );
});
test("raster hand result becomes a generic candidate and is not treated as SVG", () => {
  const registry = HandCore.createRegistry([]);
  registry.register({
    descriptor: {
      id: "raster",
      title: "Raster",
      version: "1.0.0",
      kinds: ["icon"],
      produces: [HandCore.RESULT_SCHEMA, "image/png"],
      output_types: [{ mime: "image/png", format: "PNG" }],
      canvas_types: [
        {
          medium: "screen",
          units: ["px"],
          colour_spaces: ["srgb"],
          behaviours: ["static"],
          intended_uses: ["icon"],
        },
      ],
      constraints_honoured: [
        "dimensions",
        "dimensions.unit",
        "colour.space",
        "colour.transparency",
        "behaviour.static",
      ],
      editable_recipe_formats: [HandCore.RECIPE_SCHEMA],
      operations: { preview: true, validate: true, edit: false },
    },
    create: () => ({
      artifacts: [
        {
          id: "png",
          filename: "x.png",
          mime: "image/png",
          format: "PNG",
          width: 1,
          height: 1,
          dataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        },
      ],
      previewArtifactId: "png",
    }),
  });
  const need = Core.normalizeNeed({
      id: "r",
      title: "Raster",
      kind: "icon",
      target_canvas: {
        medium: "screen",
        dimensions: { width: 1, height: 1, unit: "px" },
        colour: { space: "srgb", transparency: "allowed" },
        behaviour: ["static"],
        intended_use: "icon",
      },
      required_outputs: ["image/png"],
    }),
    result = registry.create("raster", need, {
      createdAt: "2026-07-18T00:00:00Z",
    }),
    candidate = Core.candidateFromHandResult(need, 1, result, 0);
  assert.equal(candidate.primaryArtifact.format, "PNG");
  assert.equal(candidate.svg, "");
  assert.equal(candidate.svgDigest, null);
  assert(candidate.candidateDigest);
  assert(candidate.technical.pass);
});
test("native raster provider enters Fabric as PNG plus editable procedural recipe", () => {
  const need = Core.normalizeNeed({
      id: "native-tile",
      title: "Native tile",
      kind: "texture",
      intended_use: "ground-tile",
      target_canvas: {
        medium: "game-world",
        dimensions: { width: 16, height: 16, unit: "px" },
        colour: { space: "srgb", transparency: "opaque" },
        physical: { repeat: { mode: "xy" } },
        behaviour: ["static", "tileable"],
        performance: { max_texture_memory_bytes: 1024 },
        intended_use: "ground-tile",
      },
      required_outputs: ["image/png"],
      editable_recipe_formats: ["axm.native-raster-recipe/v1"],
    }),
    handFamily = Hands.createFamily(need, {
      host,
      maxHands: 8,
      seed: "native-fabric",
      createdAt: "2026-07-18T00:00:00Z",
    }),
    candidate = Core.familyFromHands(need, 1, handFamily)[0];
  assert.equal(handFamily.results[0].hand.id, "raster-texture");
  assert.equal(candidate.primaryArtifact.format, "PNG");
  assert.equal(candidate.handResult.measures.nativeRaster, true);
  assert(
    candidate.handResult.artifacts.some(
      (artifact) => artifact.editable && artifact.format === "JSON",
    ),
  );
});
test("old saved v1 state remains readable with records and votes intact", () => {
  const oldCandidate = Core.family(
    { id: "old-need", title: "Old icon", kind: "icon", width: 64, height: 64 },
    2,
  )[0];
  delete oldCandidate.target_canvas;
  delete oldCandidate.candidateDigest;
  delete oldCandidate.primaryArtifact;
  oldCandidate.votes.mike = { value: "UP", at: "2026-01-01T00:00:00Z" };
  const old = {
      schema: Core.STATE_SCHEMA,
      version: "0.3.0",
      generation: 2,
      needs: [
        {
          schema: Core.NEED_SCHEMA,
          id: "old-need",
          title: "Old icon",
          kind: "icon",
          width: 64,
          height: 64,
          status: "open",
        },
      ],
      candidates: [oldCandidate],
      vocabulary: [{ id: "kept-vocabulary" }],
      log: [],
    },
    migrated = Core.normalizeState(old);
  assert.equal(migrated.needs[0].id, "old-need");
  assert.equal(migrated.needs[0].target_canvas.declaration, "legacy-inferred");
  assert.equal(migrated.candidates[0].votes.mike.value, "UP");
  assert(migrated.candidates[0].candidateDigest);
  assert.equal(migrated.vocabulary[0].id, "kept-vocabulary");
});
test("creation archive preserves visually distinct family members", () => {
  let archive = Creation.newArchive("x");
  Core.family(Core.baseState().needs[0], 1).forEach((candidate) => {
    archive = Creation.consider(archive, {
      id: candidate.id,
      nicheId: candidate.need.id,
      nodes: candidate.nodes,
      descriptors: candidate.descriptors,
      values: candidate.values,
      constraints: {
        valid: candidate.technical.pass,
        violations: candidate.technical.errors,
      },
    }).archive;
  });
  assert(archive.entries.length >= 2);
});
test("browser vote cannot impersonate the machine seat", () => {
  let state = Core.baseState(),
    candidate = Core.family(state.needs[0], 1)[0];
  state.candidates = [candidate];
  assert.throws(
    () => Core.vote(state, candidate.id, "axiom-mir", true),
    /independent review receipt/,
  );
});
test("machine review request binds generic digest, canvas and artifacts", () => {
  const state = Core.baseState(),
    candidate = Core.family(state.needs[0], 1)[0];
  state.candidates = [candidate];
  const packet = Core.machineReviewRequest(state, candidate.id);
  assert.equal(packet.candidateDigest, Core.candidateDigest(candidate));
  assert.equal(packet.target_canvas.schema, Hands.TARGET_CANVAS_SCHEMA);
  assert.equal(packet.requestedReviewer.identityId, "axiom-mir");
});
test("wrong-digest machine receipt is refused", () => {
  const state = Core.baseState(),
    candidate = Core.family(state.needs[0], 1)[0];
  state.candidates = [candidate];
  assert.throws(
    () =>
      Core.applyMachineReview(
        state,
        reviewReceipt(candidate, { candidateDigest: "00000000" }),
      ),
    /digest/,
  );
});
test("promotion still needs human approval and independent machine receipt", () => {
  let state = Core.baseState(),
    candidate = Core.family(state.needs[0], 1)[0];
  candidate.archiveDecision = "PRESERVE_NOVEL";
  state.candidates = [candidate];
  state = Core.vote(state, candidate.id, "mike", true);
  assert.throws(() => Core.promote(state, candidate.id));
  state = Core.applyMachineReview(state, reviewReceipt(candidate));
  state = Core.promote(state, candidate.id);
  assert.equal(state.vocabulary.length, 1);
  assert.equal(state.vocabulary[0].immutable, true);
  assert.equal(
    state.vocabulary[0].target_canvas.schema,
    Hands.TARGET_CANVAS_SCHEMA,
  );
});
test("legacy machine click is quarantined and cannot promote", () => {
  const state = Core.baseState(),
    candidate = Core.family(state.needs[0], 1)[0];
  candidate.archiveDecision = "PRESERVE_NOVEL";
  candidate.votes["axiom-mir"] = {
    value: "UP",
    kind: "local-explicit-seat-signal",
  };
  state.candidates = [candidate];
  const quarantine = Core.quarantineLegacyMachineSignals(state);
  assert.equal(quarantine.count, 1);
  assert.equal(quarantine.state.candidates[0].votes["axiom-mir"], null);
});
test("every form control has an accessible name", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  function attr(tag, name) {
    const match = String(tag).match(
      new RegExp("\\s" + name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i"),
    );
    return match ? match[2] : null;
  }
  const markup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const labelIds = new Set(
    Array.from(
      markup.matchAll(/<label\b[^>]*\bfor\s*=\s*(["'])(.*?)\1/gi),
      (match) => match[2],
    ),
  );
  for (const label of markup.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)) {
    for (const control of label[1].matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)) {
      const id = attr(control[0], "id");
      if (id) labelIds.add(id);
    }
  }
  const unnamed = Array.from(
    markup.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi),
    (match) => match[0],
  )
    .filter((tag) => {
      const type = String(attr(tag, "type") || "").toLowerCase();
      if (["hidden", "button", "submit"].includes(type)) return false;
      const id = attr(tag, "id");
      const name =
        attr(tag, "aria-label") ||
        attr(tag, "aria-labelledby") ||
        attr(tag, "title");
      return !name && !(id && labelIds.has(id));
    })
    .map((tag) => attr(tag, "id") || tag);
  assert.deepEqual(unnamed, []);
});
test("UI contains no clickable machine-seat vote", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  assert(!/data-(?:human-)?vote=["']axiom-mir/.test(app));
  assert(app.includes("Machine review pending"));
});
test("solo candidates remain exportable in their actual artifact type", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  assert(app.includes("data-candidate-artifact"));
  assert(app.includes("downloadCandidateArtifact"));
});
test("UI loads target canvas, interchange codecs, contract-v2 providers and missing-hand diagnostics", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8"),
    html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert(html.includes("target-canvas.js"));
  assert(html.includes("physical-mark.js"));
  assert(html.includes("raster-codec.js"));
  assert(html.includes("ktx2-codec.js"));
  assert(html.includes("basis_encoder.js"));
  assert(html.includes("pdf-codec.js"));
  assert(html.includes("gltf-codec.js"));
  assert(html.includes("otio-codec.js"));
  assert(html.includes("production-print.js"));
  assert(html.includes("animated-raster.js"));
  assert(html.includes("material-shader.js"));
  assert(html.includes("theme-token.js"));
  assert(html.includes("layout-responsive.js"));
  assert(html.includes("parametric-mesh.js"));
  assert(html.includes("timeline-sequence.js"));
  assert(html.includes("ktx2-texture-delivery.js"));
  assert(html.includes("native-bridge-codec.js"));
  assert(html.includes("universal-component.js"));
  assert(html.includes("play-composer.js"));
  assert(html.includes('id="composerIncubate"'));
  assert(
    html.indexOf("gltf-codec.js") < html.indexOf("uv-material-codec.js"),
    "glTF codec must load before the UV codec that consumes it",
  );
  assert(
    html.indexOf("gltf-codec.js") < html.indexOf("rigged-gltf-codec.js"),
    "glTF codec must load before the rigged codec that consumes it",
  );
  assert(html.includes("native-dcc-bridge.js"));
  assert(app.includes("Composer.directedVariation"));
  assert(app.includes("Core.candidateFromComponentDraft"));
  assert(app.includes("Human Play Composer · typed UCP graph"));
  assert(app.includes('"unscored"'));
  assert(app.includes("Hands.createFamilyAsync"));
  assert(app.includes("Hands.diagnose"));
  assert(app.includes("data-candidate-bundle"));
});
test("new technological-canvas kinds receive honest routable form defaults", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8"),
    compact = app.replace(/\s+/g, "");
  assert(app.includes("function applyKindDefaults()"));
  assert(compact.includes('outputs:"model/obj,model/gltf-binary"'));
  assert(compact.includes('outputs:"application/mtlx+xml,model/gltf-binary"'));
  assert(compact.includes('outputs:"image/apng"'));
  assert(compact.includes('outputs:"application/pdf"'));
  assert(compact.includes('outputs:"application/vnd.opentimelineio+json"'));
  assert(compact.includes('recipes:"axm.parametric-mesh-recipe/v1"'));
  assert(compact.includes('recipes:"axm.material-graph/v1"'));
  assert(compact.includes('recipes:"axm.timeline-sequence-recipe/v1"'));
  assert(compact.includes('recipes:"axm.theme-token-recipe/v1"'));
  assert(compact.includes('recipes:"axm.responsive-layout-recipe/v1"'));
  assert(
    compact.includes(
      'outputs:"audio/midi,application/vnd.recordare.musicxml+xml,audio-device+json"',
    ),
  );
});
test("texture form defaults expose the installed KTX2 hand and its GPU-memory canvas budget", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  assert(/outputs:\s*["']image\/ktx2["']/.test(app));
  assert(/recipes:\s*["']axm\.ktx2-texture-recipe\/v1["']/.test(app));
  assert(/textureMemory:\s*["']131072["']/.test(app));
  assert(
    /\$\(["']needTextureBudget["']\)\.value\s*=\s*profile\.textureMemory/.test(
      app,
    ),
  );
});
test("Asset Fabric form keeps dimensional and physical depth separate and accepts the full additive canvas contract", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8"),
    app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  assert(html.includes('id="needDepth"'));
  assert(html.includes('id="needPhysicalDepth"'));
  assert(html.includes('id="needCanvasJson"'));
  assert(/depth:\s*maybe\(["']needDepth["']\)/.test(app));
  assert(/depth:\s*maybe\(["']needPhysicalDepth["']\)/.test(app));
  assert(/JSON\.parse\(\$\(["']needCanvasJson["']\)\.value\)/.test(app));
  assert(
    /generalist:\s*\$\(["']needGeneralistFallback["']\)\.checked\s*\?\s*["']permitted["']\s*:\s*["']forbidden["']/.test(
      app,
    ),
  );
});
test("registry failure never invokes legacy fallback when Hands is present", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  assert(/var family\s*=\s*handFamily\s*\?\s*Core\.familyFromHands/.test(app));
  assert(app.includes("state.routeIssues"));
  assert(app.includes("UNSUPPORTED_CANVAS") || app.includes("issue.code"));
});
test("automatic cycles require a bounded Body Pulse lease", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8"),
    html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert(html.includes("axm-body-pulse-client.js"));
  assert(/Pulse\.runOnce\(\s*PULSE_MODULE_ID/.test(app));
  assert(!/generate\(\s*["']heartbeat["']\s*\)/.test(app));
});
test("review attention is bounded without deleting candidates", () => {
  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  assert(app.includes("Review attention queue for this goal is full"));
  assert(app.includes("defaultLimitPerGoal"));
  assert(!app.includes("state.candidates.splice"));
});
test("module refuses heartbeat-on and user-cast machine seat", () => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(__dirname, "module.contract.json"), "utf8"),
  );
  assert(contract.boundaries.refuses.includes("heartbeat-on-by-default"));
  assert(contract.boundaries.refuses.includes("user-cast-machine-seat"));
  assert(contract.consumes.includes("axm.ktx2-texture-recipe/v1"));
  assert(contract.consumes.includes("axm.ktx2-validation-report/v1"));
  assert(contract.consumes.includes("KTX.2.0"));
});
if (!process.exitCode)
  console.log("\n" + pass + " PASS · 0 FAIL · asset-fabric " + Core.VERSION);
