export const VERIFIER_SCHEMA = 'axm.asset-engine-roundtrip-verification/v1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function same(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function check(id, label, sourceValue, engineValue, evidence) {
  const passed = same(sourceValue, engineValue);
  return {
    id,
    label,
    status: passed ? 'pass' : 'fail',
    evidence,
    expected: passed ? undefined : sourceValue,
    actual: passed ? undefined : engineValue
  };
}

export function verifyRoundTrip(sourceDescriptor, engineContract, expectedSource) {
  const payload = engineContract.payload || {};
  const checks = [
    check('source-digest', 'Original source digest retained', expectedSource.sha256, engineContract.source?.sha256, 'Exact SHA-256 identity'),
    check('source-size', 'Original source byte length retained', expectedSource.byteLength, engineContract.source?.byteLength, 'Exact byte count'),
    check('scale-units', 'Scale and distance units preserved', sourceDescriptor.coordinateSystem, payload.coordinateSystem, 'Right-handed +Y up, metre scale 1'),
    check('orientation', 'Orientation requires no hidden conversion', false, engineContract.importProfile?.transformApplied, 'No axis transform applied'),
    check('structure', 'Scene structure preserved', sourceDescriptor.structure, payload.structure, 'Scene/node/mesh/primitive counts'),
    check('scene-bounds', 'Scene roots and bounds preserved', sourceDescriptor.scene, payload.scene, 'Root indices and world bounds'),
    check('pivots-transforms', 'Pivots and node transforms preserved', sourceDescriptor.nodes, payload.nodes, 'Local TRS/matrix, parent, mesh, skin, pivot'),
    check('mesh-accessors', 'Mesh semantics and accessor contracts preserved', sourceDescriptor.meshes, payload.meshes, 'Attributes, indices, component types and bounds'),
    check('materials', 'Materials and texture bindings preserved', sourceDescriptor.materials, payload.materials, 'PBR factors, textures, alpha and extensions'),
    check('textures-images', 'Texture and embedded image contracts preserved', { textures: sourceDescriptor.textures, images: sourceDescriptor.images }, { textures: payload.textures, images: payload.images }, 'Texture sources and embedded byte lengths'),
    check('rigs', 'Skin and joint mappings preserved', sourceDescriptor.skins, payload.skins, 'Joint order, skeleton and inverse bind accessor'),
    check('animations', 'Animation clips and channels preserved', sourceDescriptor.animations, payload.animations, 'Clip duration, interpolation, target node and path'),
    check('extensions', 'Extension declarations preserved', { used: sourceDescriptor.extensionsUsed, required: sourceDescriptor.extensionsRequired }, { used: payload.extensionsUsed, required: payload.extensionsRequired }, 'Sorted extension identities')
  ];
  const errors = (engineContract.lossRegistry || []).filter((loss) => loss.severity === 'error');
  checks.push({
    id: 'loss-registry',
    label: 'No hidden runtime loss',
    status: errors.length ? 'fail' : 'pass',
    evidence: errors.length ? `${errors.length} blocking loss(es) declared` : 'Loss registry empty'
  });
  const failures = checks.filter((item) => item.status === 'fail');
  return {
    schema: VERIFIER_SCHEMA,
    assetId: sourceDescriptor.assetId,
    sourceSha256: expectedSource.sha256,
    status: failures.length ? 'blocked' : 'pass',
    checks,
    summary: { passed: checks.length - failures.length, failed: failures.length, losses: (engineContract.lossRegistry || []).length }
  };
}
