import { accessorData, createRuntimeScene, imageBytes, parseGlb, structuralSummary } from '../local-3d-game-runtime/native-glb.mjs';

export const BRIDGE_SCHEMA = 'axm.asset-engine-roundtrip/v1';
export const ENGINE_SCHEMA = 'axm.engine-asset-contract/v1';
export const SOURCE_SCHEMA = 'axm.asset-source-descriptor/v1';

const RUNTIME_EXTENSIONS = new Set([
  'KHR_materials_emissive_strength',
  'KHR_materials_unlit',
  'KHR_texture_transform'
]);

function jsonCopy(value, fallback = null) {
  return value === undefined ? fallback : JSON.parse(JSON.stringify(value));
}

function parentMap(document) {
  const parents = new Map();
  (document.nodes || []).forEach((node, parent) => (node.children || []).forEach((child) => parents.set(child, parent)));
  return parents;
}

function accessorDescriptor(model, index) {
  const accessor = model.document.accessors?.[index];
  const decoded = accessorData(model, index);
  return {
    index,
    componentType: accessor.componentType,
    count: accessor.count,
    type: accessor.type,
    normalized: !!accessor.normalized,
    byteOffset: accessor.byteOffset || 0,
    min: jsonCopy(decoded.min, null),
    max: jsonCopy(decoded.max, null)
  };
}

function animationDescriptor(model, animation, index) {
  const samplers = animation.samplers.map((sampler, samplerIndex) => {
    const input = accessorData(model, sampler.input);
    const output = accessorData(model, sampler.output);
    return {
      index: samplerIndex,
      interpolation: sampler.interpolation || 'LINEAR',
      inputAccessor: sampler.input,
      outputAccessor: sampler.output,
      keyframes: input.count,
      outputValues: output.count,
      duration: input.array.length ? Number(input.array[input.array.length - 1]) : 0
    };
  });
  return {
    index,
    name: animation.name || `animation-${index}`,
    duration: samplers.reduce((maximum, sampler) => Math.max(maximum, sampler.duration), 0),
    samplers,
    channels: animation.channels.map((channel) => ({
      sampler: channel.sampler,
      node: channel.target.node,
      path: channel.target.path
    }))
  };
}

function materialDescriptor(material, index) {
  const pbr = material.pbrMetallicRoughness || {};
  return {
    index,
    name: material.name || `material-${index}`,
    baseColorFactor: jsonCopy(pbr.baseColorFactor, [1, 1, 1, 1]),
    baseColorTexture: jsonCopy(pbr.baseColorTexture, null),
    metallicFactor: pbr.metallicFactor ?? 1,
    roughnessFactor: pbr.roughnessFactor ?? 1,
    metallicRoughnessTexture: jsonCopy(pbr.metallicRoughnessTexture, null),
    normalTexture: jsonCopy(material.normalTexture, null),
    occlusionTexture: jsonCopy(material.occlusionTexture, null),
    emissiveTexture: jsonCopy(material.emissiveTexture, null),
    emissiveFactor: jsonCopy(material.emissiveFactor, [0, 0, 0]),
    alphaMode: material.alphaMode || 'OPAQUE',
    alphaCutoff: material.alphaCutoff ?? 0.5,
    doubleSided: !!material.doubleSided,
    extensions: jsonCopy(material.extensions, {})
  };
}

function collectLosses(model) {
  const document = model.document;
  const losses = [];
  const add = (id, severity, path, detail) => losses.push({ id, severity, path, detail });
  for (const extension of document.extensionsRequired || []) {
    if (!RUNTIME_EXTENSIONS.has(extension)) add('unsupported-required-extension', 'error', `extensionsRequired.${extension}`, `The native runtime has no executor for ${extension}.`);
  }
  (document.accessors || []).forEach((accessor, index) => {
    if (accessor.sparse) add('sparse-accessor', 'error', `accessors.${index}.sparse`, 'Sparse accessor data cannot enter the current runtime representation.');
  });
  (document.meshes || []).forEach((mesh, meshIndex) => (mesh.primitives || []).forEach((primitive, primitiveIndex) => {
    if (primitive.targets?.length) add('morph-targets', 'error', `meshes.${meshIndex}.primitives.${primitiveIndex}.targets`, 'Morph targets are preserved by glTF but not executed by the current runtime.');
    if (primitive.extensions?.KHR_draco_mesh_compression) add('draco-compression', 'error', `meshes.${meshIndex}.primitives.${primitiveIndex}.extensions`, 'Draco decoding is not implemented by the AXM-native core.');
  }));
  (document.animations || []).forEach((animation, animationIndex) => animation.samplers.forEach((sampler, samplerIndex) => {
    if (!['LINEAR', 'STEP'].includes(sampler.interpolation || 'LINEAR')) add('animation-interpolation', 'error', `animations.${animationIndex}.samplers.${samplerIndex}`, `${sampler.interpolation} interpolation is not executed by the current runtime.`);
  }));
  (document.skins || []).forEach((skin, index) => {
    if (skin.joints.length > 64) add('joint-palette-limit', 'error', `skins.${index}.joints`, `${skin.joints.length} joints exceed the 64-joint native palette.`);
  });
  (document.buffers || []).forEach((buffer, index) => {
    if (buffer.uri) add('external-buffer', 'error', `buffers.${index}.uri`, 'External buffers are outside the self-contained GLB route.');
  });
  (document.images || []).forEach((image, index) => {
    if (image.uri) add('external-image', 'error', `images.${index}.uri`, 'External images are outside the self-contained GLB route.');
  });
  return losses;
}

export function describeSource(model, assetId = 'asset') {
  const document = model.document;
  const parents = parentMap(document);
  const runtime = createRuntimeScene(model);
  return {
    schema: SOURCE_SCHEMA,
    assetId,
    format: 'model/gltf-binary;version=2.0',
    generator: document.asset?.generator || null,
    coordinateSystem: { handedness: 'right', up: '+Y', forward: '+Z', distanceUnit: 'metre', unitScale: 1 },
    structure: structuralSummary(model),
    scene: {
      defaultScene: document.scene || 0,
      roots: jsonCopy(document.scenes?.[document.scene || 0]?.nodes, []),
      bounds: jsonCopy(runtime.bounds)
    },
    nodes: (document.nodes || []).map((node, index) => ({
      index,
      name: node.name || `node-${index}`,
      parent: parents.has(index) ? parents.get(index) : null,
      children: jsonCopy(node.children, []),
      mesh: node.mesh ?? null,
      skin: node.skin ?? null,
      camera: node.camera ?? null,
      translation: jsonCopy(node.translation, [0, 0, 0]),
      rotation: jsonCopy(node.rotation, [0, 0, 0, 1]),
      scale: jsonCopy(node.scale, [1, 1, 1]),
      matrix: jsonCopy(node.matrix, null),
      pivot: [0, 0, 0]
    })),
    meshes: (document.meshes || []).map((mesh, meshIndex) => ({
      index: meshIndex,
      name: mesh.name || `mesh-${meshIndex}`,
      primitives: mesh.primitives.map((primitive, primitiveIndex) => ({
        index: primitiveIndex,
        mode: primitive.mode ?? 4,
        material: primitive.material ?? null,
        indices: primitive.indices ?? null,
        attributes: Object.fromEntries(Object.entries(primitive.attributes || {}).sort(([a], [b]) => a.localeCompare(b))),
        attributeContracts: Object.entries(primitive.attributes || {}).sort(([a], [b]) => a.localeCompare(b)).map(([semantic, accessor]) => ({ semantic, ...accessorDescriptor(model, accessor) })),
        indexContract: primitive.indices === undefined ? null : accessorDescriptor(model, primitive.indices)
      }))
    })),
    materials: (document.materials || []).map(materialDescriptor),
    textures: jsonCopy(document.textures, []),
    images: (document.images || []).map((image, index) => {
      const payload = imageBytes(model, index);
      return { index, name: image.name || `image-${index}`, mimeType: image.mimeType || null, embeddedBytes: payload?.bytes.byteLength || 0 };
    }),
    skins: (document.skins || []).map((skin, index) => ({
      index,
      name: skin.name || `skin-${index}`,
      skeleton: skin.skeleton ?? null,
      joints: jsonCopy(skin.joints, []),
      inverseBindMatrices: skin.inverseBindMatrices ?? null
    })),
    animations: (document.animations || []).map((animation, index) => animationDescriptor(model, animation, index)),
    extensionsUsed: jsonCopy(document.extensionsUsed, []).slice().sort(),
    extensionsRequired: jsonCopy(document.extensionsRequired, []).slice().sort()
  };
}

export function compileEngineContract(sourceDescriptor, sourceMeta) {
  const lossRegistry = jsonCopy(sourceMeta.losses, []);
  return {
    schema: ENGINE_SCHEMA,
    assetId: sourceDescriptor.assetId,
    source: {
      sha256: sourceMeta.sha256,
      byteLength: sourceMeta.byteLength,
      format: sourceDescriptor.format,
      immutable: true
    },
    importProfile: {
      id: 'axm-native-gltf-right-y-up-v1',
      sourceAxis: jsonCopy(sourceDescriptor.coordinateSystem),
      engineAxis: jsonCopy(sourceDescriptor.coordinateSystem),
      transformApplied: false,
      unitConversionApplied: false
    },
    payload: {
      coordinateSystem: jsonCopy(sourceDescriptor.coordinateSystem),
      structure: jsonCopy(sourceDescriptor.structure),
      scene: jsonCopy(sourceDescriptor.scene),
      nodes: jsonCopy(sourceDescriptor.nodes),
      meshes: jsonCopy(sourceDescriptor.meshes),
      materials: jsonCopy(sourceDescriptor.materials),
      textures: jsonCopy(sourceDescriptor.textures),
      images: jsonCopy(sourceDescriptor.images),
      skins: jsonCopy(sourceDescriptor.skins),
      animations: jsonCopy(sourceDescriptor.animations),
      extensionsUsed: jsonCopy(sourceDescriptor.extensionsUsed),
      extensionsRequired: jsonCopy(sourceDescriptor.extensionsRequired)
    },
    lossRegistry,
    execution: {
      renderer: 'local-3d-game-runtime/native-webgl2/v0.1',
      maximumSkinJoints: 64,
      animationInterpolation: ['LINEAR', 'STEP']
    }
  };
}

export function inspectBytes(arrayBuffer, assetId = 'asset') {
  const model = parseGlb(arrayBuffer);
  const descriptor = describeSource(model, assetId);
  return { model, descriptor, losses: collectLosses(model) };
}

export async function sha256Hex(arrayBuffer) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function stableJson(value) {
  const sort = (input) => {
    if (Array.isArray(input)) return input.map(sort);
    if (!input || typeof input !== 'object') return input;
    return Object.fromEntries(Object.keys(input).sort().map((key) => [key, sort(input[key])]));
  };
  return JSON.stringify(sort(value));
}

export function sourceLosses(model) {
  return collectLosses(model);
}
