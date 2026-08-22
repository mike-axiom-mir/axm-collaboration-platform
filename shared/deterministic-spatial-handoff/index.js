"use strict";

const crypto = require("node:crypto");
const GlTF = require("../asset-hands/gltf-codec");
const Geometry = require("../../tools/spatial-studio/spatial-geometry");

const VERSION = "1.0.0";
const HANDOFF_SCHEMA = "axm.deterministic-spatial-handoff/v1";
const RESULT_SCHEMA = "axm.asset-hand-result/v1";
const HAND_ID = "parametric-mesh";
const HAND_VERSION = "1.1.0";
const PROJECT_SCHEMA = "axm.spatial.project/v1";
const REQUEST_BODY_MAX_BYTES = 1024 * 1024;
const RESPONSE_BODY_MAX_BYTES = 8 * 1024 * 1024;
const PRIMITIVES = Object.freeze(["cube", "sphere", "cylinder", "cone", "plane", "torus"]);
const EMPTY_DELIVERY_COLLECTIONS = Object.freeze([
  "lights",
  "keyframes",
  "rigs",
  "emitters",
  "voxels",
  "captures",
  "simulationReceipts",
  "renderReceipts",
  "exports",
  "assetHandImports",
]);
const PROJECT_KEYS = Object.freeze([
  "assetHandImports", "camera", "captures", "createdAt", "durationFrames", "emitters", "exports", "format", "fps",
  "id", "keyframes", "lights", "materials", "name", "objects", "renderReceipts", "rigs", "simulationReceipts",
  "template", "updatedAt", "version", "voxels",
]);
const OBJECT_KEYS = Object.freeze([
  "castShadow", "createdAt", "geometry", "id", "locked", "materialId", "metadata", "name", "parentId", "position",
  "receiveShadow", "rotation", "scale", "type", "visible",
]);
const MATERIAL_KEYS = Object.freeze([
  "baseColor", "createdAt", "doubleSided", "emissive", "id", "metallic", "name", "opacity", "roughness", "source",
]);
const ARTIFACT_SPECS = Object.freeze({
  "mesh-obj": Object.freeze({ role: "triangulated-runtime-geometry", mime: "model/obj", format: "OBJ", editable: true, payload: "text" }),
  "mesh-glb": Object.freeze({ role: "runtime-scene-delivery", mime: "model/gltf-binary", format: "GLB", editable: false, payload: "dataUrl", schema: "glTF.2.0" }),
  "spatial-project": Object.freeze({ role: "editable-spatial-project", mime: "application/json", format: "JSON", editable: true, payload: "text", schema: PROJECT_SCHEMA }),
  "mesh-preview": Object.freeze({ role: "wireframe-preview", mime: "image/svg+xml", format: "SVG", editable: false, payload: "text" }),
});

const ENCODED_FIELDS = Object.freeze([
  "visible object geometry as baked POSITION/NORMAL/index buffers",
  "object position/rotation/scale and inflate/twist baked into vertex and normal data",
  "material baseColor plus opacity as baseColorFactor",
  "material metallic, roughness and doubleSided",
  "project id and triangle count in extras.axm",
]);
const OMITTED_FIELDS = Object.freeze([
  "material emissive",
  "castShadow and receiveShadow",
  "authoring camera",
  "lights and hierarchy",
  "keyframes, rigs, skinning and animation",
  "emitters, voxels, captures and receipts",
  "UVs, textures, samplers and KTX2",
  "procedural authoring recipe beyond baked delivery geometry",
]);

class SpatialHandoffError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SpatialHandoffError";
    this.code = code;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const output = {};
    Object.keys(value).sort().forEach((key) => { output[key] = stable(value[key]); });
    return output;
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  const input = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === "string" ? value : canonicalStringify(value), "utf8");
  return crypto.createHash("sha256").update(input).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fail(code, message) {
  throw new SpatialHandoffError(code, message);
}

function plainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  return plainObject(value) && canonicalStringify(Object.keys(value).sort()) === canonicalStringify(expected.slice().sort());
}

function finiteVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function near(actual, expected, epsilon) {
  return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= (epsilon == null ? 1e-6 : epsilon);
}

function parseJsonArtifact(artifact) {
  if (typeof artifact.text !== "string") fail("ARTIFACT_ENVELOPE_MISMATCH", "spatial-project must use a JSON text payload");
  try {
    return JSON.parse(artifact.text);
  } catch (_error) {
    fail("PROJECT_PROFILE_MISMATCH", "spatial-project text is not valid JSON");
  }
}

function decodeGlb(artifact) {
  const prefix = "data:model/gltf-binary;base64,";
  if (typeof artifact.dataUrl !== "string" || !artifact.dataUrl.startsWith(prefix))
    fail("ARTIFACT_ENVELOPE_MISMATCH", "mesh-glb must use a model/gltf-binary base64 dataUrl");
  const encoded = artifact.dataUrl.slice(prefix.length);
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) fail("GLB_INVALID", "mesh-glb base64 payload is malformed");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) fail("GLB_INVALID", "mesh-glb base64 payload is not canonical");
  return bytes;
}

function validateArtifacts(result) {
  if (!Array.isArray(result.artifacts) || result.artifacts.length !== 4)
    fail("ARTIFACT_ENVELOPE_MISMATCH", "exactly four spatial artifacts are required");
  const artifacts = new Map();
  result.artifacts.forEach((artifact) => {
    if (!plainObject(artifact) || typeof artifact.id !== "string" || artifacts.has(artifact.id))
      fail("ARTIFACT_ENVELOPE_MISMATCH", "spatial artifact ids must be present and unique");
    artifacts.set(artifact.id, artifact);
  });
  Object.entries(ARTIFACT_SPECS).forEach(([id, spec]) => {
    const artifact = artifacts.get(id);
    if (!artifact || artifact.role !== spec.role || artifact.mime !== spec.mime || artifact.format !== spec.format || artifact.editable !== spec.editable)
      fail("ARTIFACT_ENVELOPE_MISMATCH", id + " envelope mismatch");
    if (typeof artifact.digest !== "string" || !/^[a-f0-9]{8}$/i.test(artifact.digest))
      fail("ARTIFACT_ENVELOPE_MISMATCH", id + " transport digest is missing");
    if (spec.payload === "text" && typeof artifact.text !== "string")
      fail("ARTIFACT_ENVELOPE_MISMATCH", id + " must use a text payload");
    if (spec.payload === "dataUrl" && typeof artifact.dataUrl !== "string")
      fail("ARTIFACT_ENVELOPE_MISMATCH", id + " must use a dataUrl payload");
    if (spec.schema && (!plainObject(artifact.metadata) || artifact.metadata.schema !== spec.schema))
      fail("ARTIFACT_ENVELOPE_MISMATCH", id + " metadata schema mismatch");
  });
  const preview = artifacts.get("mesh-preview");
  if (!plainObject(preview.metadata) || preview.metadata.geometryDerived !== true || preview.metadata.sampled !== true)
    fail("ARTIFACT_ENVELOPE_MISMATCH", "mesh-preview must retain geometryDerived+sampled truth");
  const svg = preview.text;
  if (!/^<svg\b/i.test(svg.trim()) || /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(svg))
    fail("ARTIFACT_ENVELOPE_MISMATCH", "mesh-preview is not a bounded static SVG proof");
  return artifacts;
}

function validateProjectProfile(project, result) {
  if (!exactKeys(project, PROJECT_KEYS) || project.format !== PROJECT_SCHEMA || project.version !== 1)
    fail("PROJECT_PROFILE_MISMATCH", "spatial project does not match the exact bounded v1 profile");
  if (!Array.isArray(project.objects) || project.objects.length !== 1 || !Array.isArray(project.materials) || project.materials.length !== 1)
    fail("PROJECT_PROFILE_MISMATCH", "v1 requires exactly one object and one material");
  EMPTY_DELIVERY_COLLECTIONS.forEach((key) => {
    if (!Array.isArray(project[key]) || project[key].length !== 0)
      fail("PROJECT_PROFILE_MISMATCH", key + " must remain empty in the bounded delivery profile");
  });
  if (project.fps !== 24 || project.durationFrames !== 1 || project.template !== "blank")
    fail("PROJECT_PROFILE_MISMATCH", "timeline/template fields exceed the static bounded profile");
  if (!plainObject(project.camera) || !finiteVector(project.camera.target, 3))
    fail("PROJECT_PROFILE_MISMATCH", "authoring camera envelope is malformed");
  const object = project.objects[0];
  const material = project.materials[0];
  if (!exactKeys(object, OBJECT_KEYS) || !exactKeys(material, MATERIAL_KEYS))
    fail("PROJECT_PROFILE_MISMATCH", "object/material fields do not match the reviewed v1 profile");
  if (!exactKeys(object.geometry, ["detail", "inflate", "seed", "twist"]) || !exactKeys(object.metadata, ["domain", "note"]))
    fail("PROJECT_PROFILE_MISMATCH", "object geometry/metadata fields exceed the reviewed profile");
  if (object.visible !== true || object.locked !== false || object.parentId !== "" || object.materialId !== material.id)
    fail("PROJECT_PROFILE_MISMATCH", "the one object must be visible, unlocked, root-level and reference the one material");
  if (!PRIMITIVES.includes(object.type) || !finiteVector(object.position, 3) || !finiteVector(object.rotation, 3) || !finiteVector(object.scale, 3) || object.scale.some((value) => value <= 0))
    fail("PROJECT_PROFILE_MISMATCH", "object primitive/transform is invalid");
  if (!Number.isInteger(object.geometry.detail) || object.geometry.detail < 3 || object.geometry.detail > 64 || !Number.isFinite(object.geometry.inflate) || !Number.isFinite(object.geometry.twist))
    fail("PROJECT_PROFILE_MISMATCH", "object deformation recipe is invalid");
  if (typeof material.baseColor !== "string" || !/^#[0-9a-f]{6}$/i.test(material.baseColor) || !/^#[0-9a-f]{6}$/i.test(material.emissive) || !Number.isFinite(material.metallic) || !Number.isFinite(material.roughness) || !Number.isFinite(material.opacity) || typeof material.doubleSided !== "boolean")
    fail("PROJECT_PROFILE_MISMATCH", "material fields are invalid");
  const canvas = result.target_canvas;
  const dimensions = canvas && canvas.dimensions;
  if (!dimensions || !["m", "mm"].includes(dimensions.unit) || ![dimensions.width, dimensions.height, dimensions.depth].every((value) => Number.isFinite(value) && value > 0))
    fail("PROJECT_PROFILE_MISMATCH", "explicit positive width/height/depth in m or mm are required");
  const unitScale = dimensions.unit === "mm" ? 0.001 : 1;
  const expectedScale = [dimensions.width, dimensions.height, dimensions.depth].map((value) => Math.max(0.001, value * unitScale / 2));
  if (!object.scale.every((value, index) => near(value, expectedScale[index])))
    fail("PROJECT_PROFILE_MISMATCH", "object scale does not bind the effective target dimensions");
  return { object, material, dimensions, unitScale };
}

function componentReader(view, componentType, offset) {
  if (componentType === 5120) return view.getInt8(offset);
  if (componentType === 5121) return view.getUint8(offset);
  if (componentType === 5122) return view.getInt16(offset, true);
  if (componentType === 5123) return view.getUint16(offset, true);
  if (componentType === 5125) return view.getUint32(offset, true);
  if (componentType === 5126) return view.getFloat32(offset, true);
  fail("GLB_INVALID", "unsupported accessor component type " + componentType);
}

function readAccessor(bytes, json, accessorIndex) {
  const componentBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const typeComponents = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const accessor = json.accessors[accessorIndex];
  const bufferView = accessor && json.bufferViews[accessor.bufferView];
  const size = accessor && componentBytes[accessor.componentType];
  const components = accessor && typeComponents[accessor.type];
  if (!accessor || !bufferView || !size || !components) fail("GLB_INVALID", "accessor declaration is incomplete");
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = data.getUint32(12, true);
  const binStart = 20 + jsonLength + 8;
  const base = binStart + (Number(bufferView.byteOffset) || 0) + (Number(accessor.byteOffset) || 0);
  const stride = Number(bufferView.byteStride) || size * components;
  const values = [];
  for (let item = 0; item < accessor.count; item += 1) {
    const row = [];
    for (let component = 0; component < components; component += 1)
      row.push(componentReader(data, accessor.componentType, base + item * stride + component * size));
    values.push(components === 1 ? row[0] : row);
  }
  return { accessor, values };
}

function faceNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function expectedDeliveryGeometry(project) {
  const object = project.objects[0];
  const mesh = Geometry.build(object.type, object.geometry.detail, object.geometry);
  const positions = [];
  const normals = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const points = [mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]].map((vertex) => {
      const at = vertex * 3;
      return Geometry.transformPoint([mesh.positions[at], mesh.positions[at + 1], mesh.positions[at + 2]], object);
    });
    const normal = faceNormal(points[0], points[1], points[2]);
    points.forEach((point) => positions.push(point.map(Math.fround)));
    for (let count = 0; count < 3; count += 1) normals.push(normal.map(Math.fround));
  }
  return { positions, normals, triangleCount: mesh.indices.length / 3 };
}

function expectedMaterial(material) {
  const rgb = parseInt(material.baseColor.slice(1), 16);
  return {
    baseColorFactor: [((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255, material.opacity],
    metallicFactor: Math.max(0, Math.min(1, Number(material.metallic) || 0)),
    roughnessFactor: Math.max(0, Math.min(1, material.roughness == null ? 0.6 : Number(material.roughness))),
    doubleSided: material.doubleSided === true,
    alphaMode: Number(material.opacity) < 1 ? "BLEND" : "OPAQUE",
  };
}

function validateGlb(bytes, project, profile, result, glbArtifact) {
  const inspection = GlTF.inspect(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  if (!inspection.pass) fail("GLB_INVALID", "GLB structural inspection failed: " + inspection.errors.join("; "));
  const json = inspection.json;
  if (!Array.isArray(json.scenes) || json.scenes.length !== 1 || !Array.isArray(json.nodes) || json.nodes.length !== 1 || !Array.isArray(json.meshes) || json.meshes.length !== 1 || !Array.isArray(json.materials) || json.materials.length !== 1 || !Array.isArray(json.bufferViews) || json.bufferViews.length !== 3 || !Array.isArray(json.accessors) || json.accessors.length !== 3)
    fail("GLB_INVALID", "GLB must contain exactly one scene/node/mesh/material and three buffer views/accessors");
  if (json.scene !== 0 || !Array.isArray(json.scenes[0].nodes) || canonicalStringify(json.scenes[0].nodes) !== "[0]" || json.nodes[0].mesh !== 0)
    fail("GLB_INVALID", "GLB scene/node route is not the bounded one-mesh profile");
  const primitives = json.meshes[0].primitives;
  if (!Array.isArray(primitives) || primitives.length !== 1) fail("GLB_INVALID", "GLB must contain one primitive");
  const primitive = primitives[0];
  if (primitive.mode !== 4 || primitive.material !== 0 || !plainObject(primitive.attributes) || canonicalStringify(Object.keys(primitive.attributes).sort()) !== canonicalStringify(["NORMAL", "POSITION"]))
    fail("GLB_INVALID", "GLB primitive must be indexed TRIANGLES with POSITION and NORMAL only");
  if (json.animations || json.skins || json.images || json.textures || json.samplers || json.cameras || json.extensionsUsed)
    fail("GLB_INVALID", "GLB contains fields outside the bounded delivery profile");
  const position = readAccessor(bytes, json, primitive.attributes.POSITION);
  const normal = readAccessor(bytes, json, primitive.attributes.NORMAL);
  const indices = readAccessor(bytes, json, primitive.indices);
  if (position.accessor.type !== "VEC3" || position.accessor.componentType !== 5126 || normal.accessor.type !== "VEC3" || normal.accessor.componentType !== 5126 || indices.accessor.type !== "SCALAR" || ![5121, 5123, 5125].includes(indices.accessor.componentType))
    fail("GLB_INVALID", "GLB accessor semantics mismatch");
  const expected = expectedDeliveryGeometry(project);
  if (position.values.length !== expected.positions.length || normal.values.length !== expected.normals.length || indices.values.length !== expected.positions.length || indices.values.length !== expected.triangleCount * 3)
    fail("GLB_PROJECT_BINDING_MISMATCH", "GLB accessor counts do not bind the project triangle topology");
  position.values.forEach((point, index) => {
    if (!finiteVector(point, 3) || !point.every((value, axis) => near(value, expected.positions[index][axis], 2e-6)))
      fail("GLB_PROJECT_BINDING_MISMATCH", "GLB POSITION data does not match baked project geometry");
  });
  normal.values.forEach((vector, index) => {
    if (!finiteVector(vector, 3) || !vector.every((value, axis) => near(value, expected.normals[index][axis], 2e-6)))
      fail("GLB_PROJECT_BINDING_MISMATCH", "GLB NORMAL data does not match baked project geometry at vertex " + index);
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    if (!(near(length, 1, 2e-5) || near(length, 0, 2e-5)))
      fail("GLB_PROJECT_BINDING_MISMATCH", "GLB NORMAL length is neither unit nor a declared degenerate-face zero");
  });
  indices.values.forEach((value, index) => {
    if (value !== index) fail("GLB_PROJECT_BINDING_MISMATCH", "GLB indices do not match the bounded sequential triangle profile");
  });
  const mins = [Infinity, Infinity, Infinity], maxs = [-Infinity, -Infinity, -Infinity];
  position.values.forEach((point) => point.forEach((value, axis) => { mins[axis] = Math.min(mins[axis], value); maxs[axis] = Math.max(maxs[axis], value); }));
  if (!finiteVector(position.accessor.min, 3) || !finiteVector(position.accessor.max, 3) || !position.accessor.min.every((value, axis) => near(value, mins[axis], 2e-6)) || !position.accessor.max.every((value, axis) => near(value, maxs[axis], 2e-6)))
    fail("GLB_PROJECT_BINDING_MISMATCH", "GLB accessor bounds do not match POSITION bytes");
  const axm = json.extras && json.extras.axm;
  if (!axm || axm.source_schema !== PROJECT_SCHEMA || axm.source_id !== project.id || axm.triangles !== expected.triangleCount)
    fail("GLB_PROJECT_BINDING_MISMATCH", "GLB extras do not bind project id/schema/triangle lineage");
  const encodedMaterial = json.materials[0];
  const pbr = encodedMaterial.pbrMetallicRoughness;
  const material = expectedMaterial(profile.material);
  if (!pbr || !finiteVector(pbr.baseColorFactor, 4) || !pbr.baseColorFactor.every((value, index) => near(value, material.baseColorFactor[index])) || !near(pbr.metallicFactor, material.metallicFactor) || !near(pbr.roughnessFactor, material.roughnessFactor) || encodedMaterial.doubleSided !== material.doubleSided || encodedMaterial.alphaMode !== material.alphaMode)
    fail("GLB_PROJECT_BINDING_MISMATCH", "GLB material projection does not match the editable project");
  const counts = [result.measures && result.measures.triangles, glbArtifact.metadata && glbArtifact.metadata.triangles, result.creation_recipe && result.creation_recipe.parameters && result.creation_recipe.parameters.triangles];
  if (!counts.every((value) => value === expected.triangleCount) || result.measures.objects !== 1 || result.measures.materials !== 1 || result.measures.glbBytes !== bytes.length)
    fail("GLB_PROJECT_BINDING_MISMATCH", "result measures/metadata do not bind the GLB topology");
  return {
    version: inspection.version,
    total_bytes: bytes.length,
    binary_bytes: inspection.binaryLength,
    scenes: 1,
    nodes: 1,
    meshes: 1,
    primitives: 1,
    materials: 1,
    vertex_count: position.values.length,
    normal_count: normal.values.length,
    zero_normal_count: normal.values.filter((vector) => near(Math.hypot(vector[0], vector[1], vector[2]), 0, 2e-5)).length,
    index_count: indices.values.length,
    triangle_count: expected.triangleCount,
    bounds: { min: mins, max: maxs, size: maxs.map((value, axis) => value - mins[axis]) },
    source_id: axm.source_id,
    material_projection: material,
  };
}

function validateAuthority(result) {
  if (!plainObject(result.hand) || result.hand.authority !== "candidate-only" || !plainObject(result.provenance) || result.provenance.authority !== "candidate-only")
    fail("AUTHORITY_VIOLATION", "hand and result provenance must remain candidate-only");
  if (result.installed === true || result.promoted === true || result.canonical === true)
    fail("AUTHORITY_VIOLATION", "result cannot grant installation, promotion or canon authority");
}

function assertResult(result) {
  if (!plainObject(result)) fail("RESULT_NOT_REVIEWABLE", "whole Asset Hand result object is required");
  let serialized;
  try { serialized = JSON.stringify(result); } catch (_error) { fail("RESULT_NOT_REVIEWABLE", "result must be JSON serializable"); }
  const serializedBytes = Buffer.byteLength(serialized, "utf8");
  if (serializedBytes > RESPONSE_BODY_MAX_BYTES)
    fail("RESPONSE_BUDGET_EXCEEDED", "serialized result exceeds the 8 MiB handoff ceiling");
  if (result.schema !== RESULT_SCHEMA || !plainObject(result.hand) || result.hand.id !== HAND_ID || result.hand.version !== HAND_VERSION || result.status !== "READY" || !result.technical || result.technical.pass !== true || !result.validation_receipt || result.validation_receipt.status !== "PASS")
    fail("RESULT_NOT_REVIEWABLE", "only READY/PASS parametric-mesh@1.1.0 results may enter spatial review");
  validateAuthority(result);
  if (!result.creation_recipe || !["create", "edit"].includes(result.creation_recipe.operation_mode) || !result.provenance || result.provenance.operationMode !== result.creation_recipe.operation_mode)
    fail("RESULT_NOT_REVIEWABLE", "create/edit operation provenance is missing or inconsistent");
  if (result.previewArtifactId !== "mesh-preview" || !result.preview || result.preview.available !== true || result.preview.artifactId !== "mesh-preview" || result.preview.mime !== "image/svg+xml")
    fail("RESULT_NOT_REVIEWABLE", "mesh-preview must be the available static preview");
  const artifacts = validateArtifacts(result);
  const projectArtifact = artifacts.get("spatial-project");
  const project = parseJsonArtifact(projectArtifact);
  const profile = validateProjectProfile(project, result);
  const expectedObj = Geometry.toOBJ(project);
  const objArtifact = artifacts.get("mesh-obj");
  if (objArtifact.text !== expectedObj || !objArtifact.metadata || objArtifact.metadata.triangles !== result.measures.triangles || objArtifact.metadata.units !== "metres" || objArtifact.metadata.lossy !== true)
    fail("PROJECT_PROFILE_MISMATCH", "OBJ delivery does not match the editable project/triangle profile");
  const glbArtifact = artifacts.get("mesh-glb");
  if (!glbArtifact.metadata || glbArtifact.metadata.lossy !== true)
    fail("ARTIFACT_ENVELOPE_MISMATCH", "mesh-glb must preserve lossy-delivery truth");
  const glbBytes = decodeGlb(glbArtifact);
  const glbSummary = validateGlb(glbBytes, project, profile, result, glbArtifact);
  const previewArtifact = artifacts.get("mesh-preview");
  const artifactSha256 = {
    "mesh-obj": sha256(objArtifact.text),
    "mesh-glb": sha256(glbBytes),
    "spatial-project": sha256(projectArtifact.text),
    "mesh-preview": sha256(previewArtifact.text),
  };
  const transportDigests = Object.fromEntries(result.artifacts.map((artifact) => [artifact.id, artifact.digest]));
  return {
    schema: HANDOFF_SCHEMA,
    version: VERSION,
    status: "PASS",
    hand: { id: HAND_ID, version: HAND_VERSION },
    operation_mode: result.creation_recipe.operation_mode,
    result_digest: result.digest,
    project_digest: sha256(project),
    artifact_sha256: artifactSha256,
    artifact_transport_digests: transportDigests,
    artifacts: result.artifacts.map((artifact) => ({
      id: artifact.id,
      role: artifact.role,
      mime: artifact.mime,
      format: artifact.format,
      editable: artifact.editable,
      edit_master: artifact.id === "spatial-project",
      transport_digest: artifact.digest,
      sha256: artifactSha256[artifact.id],
      bytes: artifact.id === "mesh-glb" ? glbBytes.length : Buffer.byteLength(artifact.text, "utf8"),
    })),
    preview: {
      artifact_id: "mesh-preview",
      available: true,
      geometry_derived: true,
      sampled: true,
      static_proof_only: true,
      dynamic_spatial_evidence: false,
    },
    project_profile: {
      schema: PROJECT_SCHEMA,
      id: project.id,
      object_id: profile.object.id,
      primitive: profile.object.type,
      material_id: profile.material.id,
      one_visible_unlocked_object: true,
      one_referenced_material: true,
      hierarchy: false,
      delivery_omitted_collections_empty: true,
    },
    glb: glbSummary,
    coordinate_system: { handedness: "right-handed", up_axis: "Y", linear_unit: "metre", project_rotation_unit: "degrees" },
    delivery_projection: {
      status: "LIMITED",
      contract_gap: "CONTRACT-SPATIAL-GLB-MATERIAL-PARITY-001",
      encoded_fields: ENCODED_FIELDS.slice(),
      omitted_fields: OMITTED_FIELDS.slice(),
    },
    edit_controls: {
      source_master: "spatial-project",
      primitive: { mode: "brief-semantic-inference", direct_project_field_authoritative: false, allowed: PRIMITIVES.slice() },
      target_dimensions: { mode: "brief-target-canvas", drives: "project object scale" },
      polygon_budget: { mode: "brief-target-canvas", drives: "project geometry detail" },
      contract_gap: "CONTRACT-PARAMETRIC-EDIT-CONTROL-001",
      status: "LIMITED",
    },
    budgets: { request_body_max_bytes: REQUEST_BODY_MAX_BYTES, response_body_max_bytes: RESPONSE_BODY_MAX_BYTES, serialized_result_bytes: serializedBytes },
    authority: { candidate_only: true, installed: false, promoted: false, canonical: false, human_review_required: true },
    claims: {
      deterministic_delivery_bytes: true,
      bounded_glb_project_binding: true,
      static_svg_is_dynamic_spatial_proof: false,
      dynamic_browser_render_observed: false,
      multi_angle_human_observation: false,
      target_renderer_parity: false,
      physical_scale_verified: false,
      controller_or_xr_verified: false,
      assistive_technology_verified: false,
      human_aesthetic_approval: false,
      external_gltf_conformance: false,
    },
  };
}

function gateResult(result) {
  try {
    return assertResult(result);
  } catch (error) {
    return {
      schema: HANDOFF_SCHEMA,
      version: VERSION,
      status: "FAIL",
      code: error && error.code ? error.code : "RESULT_NOT_REVIEWABLE",
      message: error && error.message ? error.message : String(error),
      authority: { candidate_only: true, installed: false, promoted: false, canonical: false },
    };
  }
}

module.exports = {
  VERSION,
  HANDOFF_SCHEMA,
  RESULT_SCHEMA,
  HAND_ID,
  HAND_VERSION,
  PROJECT_SCHEMA,
  REQUEST_BODY_MAX_BYTES,
  RESPONSE_BODY_MAX_BYTES,
  PRIMITIVES,
  ARTIFACT_SPECS,
  ENCODED_FIELDS,
  OMITTED_FIELDS,
  canonicalStringify,
  sha256,
  assertResult,
  gateResult,
};
