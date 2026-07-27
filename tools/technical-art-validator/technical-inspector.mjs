import { accessorData, createRuntimeScene, imageBytes, parseGlb } from '../local-3d-game-runtime/native-glb.mjs';

export const REPORT_SCHEMA = 'axm.technical-art-report/v1';
export const REQUIRED_CATEGORIES = [
  'identity', 'topology', 'transforms', 'naming', 'pivots', 'uvs', 'maps',
  'materials', 'rig', 'animation', 'lod', 'collision', 'bounds-budget', 'visual-quality'
];

export const PROFILES = Object.freeze({
  building: { label: 'Building', maxTriangles: 12000, maxMaterials: 24, maxImages: 24, requireUv1: true, requireRig: false, requireAnimation: false, requireLod: true, requireCollision: true },
  vehicle: { label: 'Vehicle', maxTriangles: 15000, maxMaterials: 24, maxImages: 24, requireUv1: false, requireRig: false, requireAnimation: false, requireLod: true, requireCollision: true },
  foliage: { label: 'Foliage', maxTriangles: 4000, maxMaterials: 8, maxImages: 12, requireUv1: false, requireRig: false, requireAnimation: false, requireLod: true, requireCollision: false },
  character: { label: 'Character', maxTriangles: 10000, maxMaterials: 24, maxImages: 24, requireUv1: false, requireRig: true, requireAnimation: true, requireLod: true, requireCollision: true }
});

const statusRank = { pass: 0, 'human-review': 1, repair: 2, blocked: 3 };

function finiteArray(values) { return values.every(Number.isFinite); }
function category(id, label, checks) {
  const status = checks.reduce((worst, item) => statusRank[item.status] > statusRank[worst] ? item.status : worst, 'pass');
  return { id, label, status, checks };
}
function gate(id, status, message, evidence) { return { id, status, message, evidence }; }

function determinant3(matrix) {
  return matrix[0] * (matrix[5] * matrix[10] - matrix[6] * matrix[9])
    - matrix[4] * (matrix[1] * matrix[10] - matrix[2] * matrix[9])
    + matrix[8] * (matrix[1] * matrix[6] - matrix[2] * matrix[5]);
}

function primitiveFacts(model) {
  let triangles = 0, vertices = 0, primitives = 0, degenerates = 0, missingPosition = 0;
  let unsupportedModes = 0, nonFinitePositions = 0, uv0Primitives = 0, uv1Primitives = 0;
  for (const mesh of model.document.meshes || []) for (const primitive of mesh.primitives || []) {
    primitives += 1;
    if ((primitive.mode ?? 4) !== 4) unsupportedModes += 1;
    if (primitive.attributes?.POSITION === undefined) { missingPosition += 1; continue; }
    const position = accessorData(model, primitive.attributes.POSITION);
    vertices += position.count;
    if (!finiteArray(Array.from(position.array))) nonFinitePositions += 1;
    if (primitive.attributes.TEXCOORD_0 !== undefined) uv0Primitives += 1;
    if (primitive.attributes.TEXCOORD_1 !== undefined) uv1Primitives += 1;
    const indices = primitive.indices === undefined ? null : accessorData(model, primitive.indices).array;
    const count = indices ? indices.length : position.count;
    triangles += Math.floor(count / 3);
    for (let i = 0; i + 2 < count; i += 3) {
      const ia = indices ? indices[i] : i, ib = indices ? indices[i + 1] : i + 1, ic = indices ? indices[i + 2] : i + 2;
      const a = ia * 3, b = ib * 3, c = ic * 3, p = position.array;
      if (ia === ib || ib === ic || ia === ic) { degenerates += 1; continue; }
      const abx = p[b] - p[a], aby = p[b + 1] - p[a + 1], abz = p[b + 2] - p[a + 2];
      const acx = p[c] - p[a], acy = p[c + 1] - p[a + 1], acz = p[c + 2] - p[a + 2];
      const x = aby * acz - abz * acy, y = abz * acx - abx * acz, z = abx * acy - aby * acx;
      if (x * x + y * y + z * z < 1e-14) degenerates += 1;
    }
  }
  return { triangles, vertices, primitives, degenerates, missingPosition, unsupportedModes, nonFinitePositions, uv0Primitives, uv1Primitives };
}

function sourceNames(document) {
  const items = [
    ...(document.nodes || []).map((item, index) => ({ kind: 'node', index, name: item.name })),
    ...(document.meshes || []).map((item, index) => ({ kind: 'mesh', index, name: item.name })),
    ...(document.materials || []).map((item, index) => ({ kind: 'material', index, name: item.name }))
  ];
  const missing = items.filter(item => !item.name || !item.name.trim());
  const seen = new Map(), duplicates = [];
  for (const item of items.filter(item => item.name)) {
    const key = `${item.kind}:${item.name.trim().toLowerCase()}`;
    if (seen.has(key)) duplicates.push({ ...item, duplicateOf: seen.get(key) }); else seen.set(key, item.index);
  }
  return { count: items.length, missing, duplicates };
}

function externalReceipt(evidence, key, sourceSha256) {
  const value = evidence?.[key];
  if (!value) return { status: 'missing', reason: `No ${key} receipt attached` };
  const digest = value.sourceSha256 || value.source?.sha256;
  if (!digest || digest !== sourceSha256) return { status: 'invalid', reason: `${key} receipt is not bound to these exact bytes` };
  if (!value.schema || !value.status) return { status: 'invalid', reason: `${key} receipt lacks schema or status` };
  return { status: value.status === 'pass' ? 'pass' : 'invalid', reason: `${value.schema} says ${value.status}` };
}

export function inspectTechnicalAsset(arrayBuffer, metadata, profileId, externalEvidence = {}) {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`Unknown technical-art profile: ${profileId}`);
  const model = parseGlb(arrayBuffer), document = model.document, facts = primitiveFacts(model);
  const runtime = createRuntimeScene(model), names = sourceNames(document);
  const nodes = document.nodes || [], materials = document.materials || [], images = document.images || [];
  const badTransforms = nodes.filter(node => {
    const arrays = [node.translation || [0, 0, 0], node.rotation || [0, 0, 0, 1], node.scale || [1, 1, 1], node.matrix || []];
    if (!arrays.every(finiteArray)) return true;
    if (node.scale && Math.abs(node.scale[0] * node.scale[1] * node.scale[2]) < 1e-8) return true;
    return node.matrix ? Math.abs(determinant3(node.matrix)) < 1e-8 : false;
  });
  const embeddedImages = images.filter((_, index) => (imageBytes(model, index)?.bytes.byteLength || 0) > 0).length;
  const missingImagePayloads = images.length - embeddedImages;
  const materialRefErrors = [];
  for (const [meshIndex, mesh] of (document.meshes || []).entries()) for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
    if (primitive.material !== undefined && !materials[primitive.material]) materialRefErrors.push(`mesh ${meshIndex} primitive ${primitiveIndex}`);
  }
  const skins = document.skins || [], animations = document.animations || [];
  const invalidSkins = skins.filter(skin => !skin.joints?.length || skin.joints.length > 64 || skin.joints.some(index => !nodes[index]));
  const invalidAnimations = animations.filter(animation => !animation.channels?.length || !animation.samplers?.length || animation.channels.some(channel => !['translation', 'rotation', 'scale', 'weights'].includes(channel.target?.path)));
  const searchableNames = nodes.map(node => node.name || '');
  const collisionNames = searchableNames.filter(name => /(^|[_ .-])(ucx|collision|collider|col)([_ .-]|$)/i.test(name));
  const lodNames = searchableNames.filter(name => /(^|[_ .-])lod[0-9]([_ .-]|$)/i.test(name));
  const lodReceipt = externalReceipt(externalEvidence, 'lod', metadata.sha256);
  const collisionReceipt = externalReceipt(externalEvidence, 'collision', metadata.sha256);
  const textureSetReceipt = externalReceipt(externalEvidence, 'textureSet', metadata.sha256);
  const bounds = runtime.bounds;
  const boundsFinite = bounds && finiteArray([...(bounds.minimum || []), ...(bounds.maximum || []), ...(bounds.size || [])]);
  const categories = [
    category('identity', 'Exact artifact identity', [
      gate('sha256', /^[A-F0-9]{64}$/.test(metadata.sha256) ? 'pass' : 'blocked', 'Bind the report to one SHA-256 digest.', metadata.sha256 || 'missing'),
      gate('byte-length', metadata.byteLength === arrayBuffer.byteLength ? 'pass' : 'blocked', 'Bind the report to the exact byte count.', `${arrayBuffer.byteLength} bytes`)
    ]),
    category('topology', 'Topology integrity', [
      gate('positions', facts.missingPosition === 0 && facts.nonFinitePositions === 0 ? 'pass' : 'blocked', 'Every primitive needs finite POSITION data.', `${facts.missingPosition} missing · ${facts.nonFinitePositions} non-finite`),
      gate('triangle-mode', facts.unsupportedModes === 0 ? 'pass' : 'blocked', 'The current game route accepts triangle primitives only.', `${facts.unsupportedModes} unsupported primitive(s)`),
      gate('degenerates', facts.degenerates === 0 ? 'pass' : 'repair', 'Remove zero-area or repeated-index triangles.', `${facts.degenerates} degenerate triangle(s)`)
    ]),
    category('transforms', 'Transforms and scale', [
      gate('finite-invertible', badTransforms.length === 0 ? 'pass' : 'blocked', 'Node transforms must be finite and invertible.', `${badTransforms.length} invalid node transform(s)`)
    ]),
    category('naming', 'Stable naming', [
      gate('missing-names', names.missing.length === 0 ? 'pass' : 'repair', 'Name nodes, meshes, and materials before promotion.', `${names.missing.length}/${names.count} unnamed`),
      gate('duplicate-names', names.duplicates.length === 0 ? 'pass' : 'repair', 'Names must be unique within each technical kind.', `${names.duplicates.length} duplicate(s)`)
    ]),
    category('pivots', 'Semantic pivots', [
      gate('pivot-proof', externalReceipt(externalEvidence, 'pivot', metadata.sha256).status === 'pass' ? 'pass' : 'human-review', 'A mesh origin cannot prove that a door hinge, wheel axle, or placement pivot is useful.', externalReceipt(externalEvidence, 'pivot', metadata.sha256).reason)
    ]),
    category('uvs', 'UV and lightmap readiness', [
      gate('uv0', facts.uv0Primitives === facts.primitives ? 'pass' : 'repair', 'Every rendered primitive needs primary UVs for this production route.', `${facts.uv0Primitives}/${facts.primitives} primitives have UV0`),
      gate('uv1', !profile.requireUv1 || facts.uv1Primitives === facts.primitives ? 'pass' : 'repair', profile.requireUv1 ? 'This profile requires non-overlapping lightmap UV1.' : 'UV1 is optional for this profile.', `${facts.uv1Primitives}/${facts.primitives} primitives have UV1`)
    ]),
    category('maps', 'Texture payloads', [
      gate('verified-images', missingImagePayloads === 0 || textureSetReceipt.status === 'pass' ? 'pass' : 'blocked', 'Every image must be embedded or supplied through an independently digest-verified same-origin texture set.', missingImagePayloads === 0 ? `${embeddedImages}/${images.length} embedded` : textureSetReceipt.reason)
    ]),
    category('materials', 'Material bindings', [
      gate('material-references', materialRefErrors.length === 0 ? 'pass' : 'blocked', 'Primitive material indices must resolve.', materialRefErrors.length ? materialRefErrors.join(', ') : `${materials.length} material(s)`),
      gate('pbr-review', 'human-review', 'Numeric PBR validity does not prove that the surface looks intentional.', 'Human material and lighting review required')
    ]),
    category('rig', 'Rig integrity', [
      gate('skin-required', !profile.requireRig || skins.length > 0 ? 'pass' : 'repair', profile.requireRig ? 'This profile requires a skin.' : 'A skin is optional for this profile.', `${skins.length} skin(s)`),
      gate('skin-validity', invalidSkins.length === 0 ? 'pass' : 'blocked', 'Skin joints must resolve and stay within the 64-joint runtime palette.', `${invalidSkins.length} invalid skin(s)`)
    ]),
    category('animation', 'Animation integrity', [
      gate('animation-required', !profile.requireAnimation || animations.length > 0 ? 'pass' : 'repair', profile.requireAnimation ? 'This profile requires at least one clip.' : 'Animation is optional for this profile.', `${animations.length} clip(s)`),
      gate('channels-valid', invalidAnimations.length === 0 ? 'pass' : 'blocked', 'Animation samplers and target paths must be executable.', `${invalidAnimations.length} invalid clip(s)`)
    ]),
    category('lod', 'Distance representation', [
      gate('lod-proof', !profile.requireLod || lodNames.length >= 2 || lodReceipt.status === 'pass' ? 'pass' : lodReceipt.status === 'invalid' ? 'blocked' : 'repair', 'Attach digest-bound LOD evidence or embed a named LOD family.', lodNames.length >= 2 ? `${lodNames.length} embedded LOD nodes` : lodReceipt.reason)
    ]),
    category('collision', 'Gameplay collision', [
      gate('collision-proof', !profile.requireCollision || collisionNames.length > 0 || collisionReceipt.status === 'pass' ? 'pass' : collisionReceipt.status === 'invalid' ? 'blocked' : 'repair', profile.requireCollision ? 'Attach digest-bound collision evidence or embed a named collision shape.' : 'Collision is optional for this profile.', !profile.requireCollision ? `Optional for ${profile.label}` : collisionNames.length ? `${collisionNames.length} collision node(s)` : collisionReceipt.reason)
    ]),
    category('bounds-budget', 'Bounds and platform budget', [
      gate('finite-bounds', boundsFinite ? 'pass' : 'blocked', 'World bounds must be finite.', boundsFinite ? `size ${bounds.size.map(value => value.toFixed(3)).join(' × ')} m` : 'invalid bounds'),
      gate('triangle-budget', facts.triangles <= profile.maxTriangles ? 'pass' : 'repair', `Stay inside the ${profile.label} triangle budget.`, `${facts.triangles.toLocaleString('en-US')} / ${profile.maxTriangles.toLocaleString('en-US')}`),
      gate('material-budget', materials.length <= profile.maxMaterials ? 'pass' : 'repair', 'Stay inside the material-slot budget.', `${materials.length} / ${profile.maxMaterials}`),
      gate('image-budget', images.length <= profile.maxImages ? 'pass' : 'repair', 'Stay inside the embedded-image budget.', `${images.length} / ${profile.maxImages}`)
    ]),
    category('visual-quality', 'Human visual quality gate', [
      gate('beauty-review', 'human-review', 'Code cannot approve silhouette, readability, deformation, material taste, or transition pop.', 'Required before permanent-library promotion')
    ])
  ];
  const technicalCategories = categories.filter(item => item.id !== 'visual-quality');
  const blockers = technicalCategories.filter(item => item.status === 'blocked').length;
  const repairs = technicalCategories.filter(item => item.status === 'repair').length;
  const status = blockers ? 'blocked' : repairs ? 'repair' : 'technical-pass';
  return {
    schema: REPORT_SCHEMA, assetId: metadata.assetId, profileId, sourceSha256: metadata.sha256,
    sourceByteLength: metadata.byteLength, status, promotion: 'not-approved',
    summary: { blockers, repairs, humanReview: categories.filter(item => item.status === 'human-review').length, categories: categories.length },
    facts: { ...facts, nodes: nodes.length, meshes: (document.meshes || []).length, materials: materials.length, images: images.length, skins: skins.length, animations: animations.length, bounds },
    categories
  };
}

export function stableJson(value) {
  const sort = input => Array.isArray(input) ? input.map(sort) : input && typeof input === 'object' ? Object.fromEntries(Object.keys(input).sort().map(key => [key, sort(input[key])])) : input;
  return JSON.stringify(sort(value));
}

export async function sealTechnicalReport(report) {
  const bytes = new TextEncoder().encode(stableJson(report));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const reportSha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return { ...report, reportSha256 };
}
