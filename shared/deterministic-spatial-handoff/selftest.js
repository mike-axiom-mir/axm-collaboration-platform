"use strict";

const assert = require("node:assert/strict");
const Hands = require("../asset-hands/asset-hands");
const Spatial = require(".");

const host = {
  capabilities: ["json", "svg", "obj", "glb"],
  permissions: [],
  accepts: [Hands.RESULT_SCHEMA, "model/obj", "model/gltf-binary", "application/json", "image/svg+xml", Spatial.PROJECT_SCHEMA],
};

function sourceArtifact(project) {
  return {
    id: "spatial-project-source",
    role: "source",
    name: "Editable Spatial project",
    mime: "application/json",
    format: "JSON",
    content_schema: Spatial.PROJECT_SCHEMA,
    metadata: { schema: Spatial.PROJECT_SCHEMA },
    editable: true,
    text: JSON.stringify(project),
  };
}

function brief(options) {
  const dimensions = options.dimensions || { width: 2, height: 3, depth: 1, unit: "m" };
  return {
    id: "spatial-sensory-fixture-" + options.operation,
    title: options.primitive + " spatial candidate",
    purpose: "unambiguous parametric " + options.primitive + " candidate",
    kind: "mesh",
    operation_mode: options.operation,
    intended_use: "mesh",
    styleTags: [options.primitive],
    target_canvas: {
      medium: "3d-surface",
      dimensions,
      colour: { space: "material-channel", transparency: "allowed" },
      behaviour: ["static"],
      performance: { max_polygon_count: options.polygonBudget || 1200, max_file_bytes: Spatial.RESPONSE_BODY_MAX_BYTES },
      intended_use: "mesh",
    },
    required_outputs: ["model/obj", "model/gltf-binary", "application/json", "image/svg+xml"],
    editable_recipe_formats: [Spatial.PROJECT_SCHEMA],
    source_artifacts: options.project ? [sourceArtifact(options.project)] : [],
  };
}

function create(options) {
  return Hands.create(Spatial.HAND_ID, brief(options), {
    seed: "spatial-sensory-fixture",
    createdAt: "2026-08-22T00:00:00.000Z",
    host,
  });
}

function projectFrom(result) {
  return JSON.parse(result.artifacts.find((artifact) => artifact.id === "spatial-project").text);
}

function mutateGlbSourceId(result) {
  const tampered = JSON.parse(JSON.stringify(result));
  const artifact = tampered.artifacts.find((item) => item.id === "mesh-glb");
  const prefix = "data:model/gltf-binary;base64,";
  const bytes = Buffer.from(artifact.dataUrl.slice(prefix.length), "base64");
  const projectId = Buffer.from(projectFrom(result).id, "utf8");
  const offset = bytes.indexOf(projectId);
  assert(offset > 0, "project id must exist in GLB JSON extras");
  bytes[offset] = bytes[offset] === 0x61 ? 0x62 : 0x61;
  artifact.dataUrl = prefix + bytes.toString("base64");
  return tampered;
}

function main() {
  const createOptions = { operation: "create", primitive: "sphere", polygonBudget: 1200 };
  const firstResult = create(createOptions);
  const repeatedResult = create(createOptions);
  assert.equal(firstResult.status, "READY");
  assert.equal(firstResult.technical.pass, true);
  assert.equal(firstResult.validation_receipt.status, "PASS");
  assert.equal(firstResult.digest, repeatedResult.digest);
  assert.deepEqual(firstResult.artifacts.map((artifact) => artifact.digest), repeatedResult.artifacts.map((artifact) => artifact.digest));

  const first = Spatial.gateResult(firstResult);
  const repeated = Spatial.gateResult(repeatedResult);
  assert.equal(first.status, "PASS", JSON.stringify(first, null, 2));
  assert.deepEqual(first, repeated);
  assert.equal(first.hand.id, "parametric-mesh");
  assert.equal(first.hand.version, "1.1.0");
  assert.equal(first.operation_mode, "create");
  assert.equal(first.project_profile.primitive, "sphere");
  assert.equal(first.preview.static_proof_only, true);
  assert.equal(first.preview.dynamic_spatial_evidence, false);
  assert.equal(first.glb.triangle_count, 1200);
  assert.equal(first.glb.index_count, 3600);
  assert.equal(first.glb.source_id, first.project_profile.id);
  assert(Object.values(first.artifact_sha256).every((digest) => /^[a-f0-9]{64}$/.test(digest)));
  assert.equal(first.artifacts.find((artifact) => artifact.id === "spatial-project").edit_master, true);
  assert(first.artifacts.filter((artifact) => artifact.id !== "spatial-project").every((artifact) => artifact.edit_master === false));
  assert.equal(first.delivery_projection.status, "LIMITED");
  assert(first.delivery_projection.omitted_fields.includes("material emissive"));
  assert.equal(first.edit_controls.primitive.direct_project_field_authoritative, false);
  assert.equal(first.claims.target_renderer_parity, false);
  assert.equal(first.claims.human_aesthetic_approval, false);
  assert(first.budgets.serialized_result_bytes < Spatial.RESPONSE_BODY_MAX_BYTES);

  const editedSource = projectFrom(firstResult);
  editedSource.objects[0].type = "cube";
  editedSource.objects[0].position = [0.25, -0.1, 0.4];
  editedSource.objects[0].rotation = [15, 35, -10];
  editedSource.objects[0].geometry.inflate = 0.18;
  editedSource.objects[0].geometry.twist = 55;
  editedSource.materials[0].baseColor = "#6f5bff";
  editedSource.materials[0].metallic = 0.72;
  editedSource.materials[0].roughness = 0.24;
  editedSource.materials[0].opacity = 0.84;
  editedSource.materials[0].doubleSided = true;
  const editResult = create({
    operation: "edit",
    primitive: "torus",
    polygonBudget: 900,
    dimensions: { width: 2400, height: 1600, depth: 800, unit: "mm" },
    project: editedSource,
  });
  const edit = Spatial.gateResult(editResult);
  assert.equal(editResult.status, "READY");
  assert.equal(edit.status, "PASS", JSON.stringify(edit, null, 2));
  assert.equal(edit.operation_mode, "edit");
  assert.equal(edit.project_profile.primitive, "torus", "brief-driven primitive must override direct project type edit");
  assert.equal(edit.coordinate_system.linear_unit, "metre");
  assert(edit.glb.triangle_count <= 900);
  assert.notEqual(edit.result_digest, first.result_digest);
  Object.keys(first.artifact_sha256).forEach((id) => assert.notEqual(edit.artifact_sha256[id], first.artifact_sha256[id], id + " must regenerate transactionally"));

  const badPreview = JSON.parse(JSON.stringify(firstResult));
  badPreview.artifacts.find((artifact) => artifact.id === "mesh-preview").metadata.sampled = false;
  assert.equal(Spatial.gateResult(badPreview).code, "ARTIFACT_ENVELOPE_MISMATCH");

  const extraObject = JSON.parse(JSON.stringify(firstResult));
  const extraProjectArtifact = extraObject.artifacts.find((artifact) => artifact.id === "spatial-project");
  const extraProject = JSON.parse(extraProjectArtifact.text);
  extraProject.objects.push(JSON.parse(JSON.stringify(extraProject.objects[0])));
  extraProjectArtifact.text = JSON.stringify(extraProject);
  assert.equal(Spatial.gateResult(extraObject).code, "PROJECT_PROFILE_MISMATCH");

  const glbMismatch = Spatial.gateResult(mutateGlbSourceId(firstResult));
  assert.equal(glbMismatch.code, "GLB_PROJECT_BINDING_MISMATCH");

  const badGlb = JSON.parse(JSON.stringify(firstResult));
  const badGlbArtifact = badGlb.artifacts.find((artifact) => artifact.id === "mesh-glb");
  badGlbArtifact.dataUrl = badGlbArtifact.dataUrl.slice(0, -8) + "AAAAAAAA";
  assert.equal(Spatial.gateResult(badGlb).code, "GLB_INVALID");

  const hold = JSON.parse(JSON.stringify(firstResult));
  hold.status = "HOLD";
  hold.technical.pass = false;
  assert.equal(Spatial.gateResult(hold).code, "RESULT_NOT_REVIEWABLE");

  const authority = JSON.parse(JSON.stringify(firstResult));
  authority.hand.authority = "canonical";
  assert.equal(Spatial.gateResult(authority).code, "AUTHORITY_VIOLATION");

  const oversized = JSON.parse(JSON.stringify(firstResult));
  oversized.untrusted_padding = "x".repeat(Spatial.RESPONSE_BODY_MAX_BYTES);
  assert.equal(Spatial.gateResult(oversized).code, "RESPONSE_BUDGET_EXCEEDED");

  console.log("AXM deterministic spatial handoff selftest: PASS (deterministic create/edit, exact four-artifact profile, OBJ+GLB project binding, full SHA-256, static-preview boundary, tamper/HOLD/authority/budget fail-close)");
}

try { main(); } catch (error) { console.error(error.stack || error); process.exitCode = 1; }
