import { composeTRS, identity4, invert4, lerpArray, multiply4, slerp4, transformPoint4 } from './native-math.mjs';

const COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });
const COMPONENT_INFO = Object.freeze({
  5120: { bytes: 1, ctor: Int8Array, read: 'getInt8' },
  5121: { bytes: 1, ctor: Uint8Array, read: 'getUint8' },
  5122: { bytes: 2, ctor: Int16Array, read: 'getInt16' },
  5123: { bytes: 2, ctor: Uint16Array, read: 'getUint16' },
  5125: { bytes: 4, ctor: Uint32Array, read: 'getUint32' },
  5126: { bytes: 4, ctor: Float32Array, read: 'getFloat32' }
});

export function parseGlb(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) throw new Error('GLB magic is invalid');
  if (view.getUint32(4, true) !== 2) throw new Error('Only GLB version 2 is supported');
  if (view.getUint32(8, true) !== view.byteLength) throw new Error('GLB declared length does not match bytes');
  let offset = 12;
  let document = null;
  let binary = null;
  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    if (end > view.byteLength) throw new Error('GLB chunk exceeds file boundary');
    if (type === 0x4e4f534a) {
      const text = new TextDecoder().decode(new Uint8Array(arrayBuffer, start, length)).replace(/[\u0000\s]+$/g, '');
      document = JSON.parse(text);
    } else if (type === 0x004e4942) {
      binary = new Uint8Array(arrayBuffer.slice(start, end));
    }
    offset = end;
  }
  if (!document || !binary) throw new Error('GLB requires JSON and BIN chunks');
  const unsupported = (document.extensionsRequired || []).filter((id) => !['KHR_texture_transform', 'KHR_materials_emissive_strength', 'KHR_materials_unlit'].includes(id));
  if (unsupported.length) throw new Error(`Required GLB extensions are unsupported: ${unsupported.join(', ')}`);
  return { document, binary, accessors: new Map() };
}

export function accessorData(model, accessorIndex) {
  if (model.accessors.has(accessorIndex)) return model.accessors.get(accessorIndex);
  const accessor = model.document.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  if (accessor.sparse) throw new Error(`Sparse accessor ${accessorIndex} is not supported yet`);
  if (accessor.bufferView === undefined) throw new Error(`Accessor ${accessorIndex} has no buffer view`);
  const bufferView = model.document.bufferViews?.[accessor.bufferView];
  const info = COMPONENT_INFO[accessor.componentType];
  const components = COMPONENTS[accessor.type];
  if (!bufferView || !info || !components) throw new Error(`Accessor ${accessorIndex} has an unsupported layout`);
  const packedStride = info.bytes * components;
  const stride = bufferView.byteStride || packedStride;
  if (stride < packedStride) throw new Error(`Accessor ${accessorIndex} stride is too small`);
  const start = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const end = start + Math.max(0, accessor.count - 1) * stride + packedStride;
  if (end > model.binary.byteLength) throw new Error(`Accessor ${accessorIndex} exceeds BIN chunk`);
  const output = new info.ctor(accessor.count * components);
  const dataView = new DataView(model.binary.buffer, model.binary.byteOffset, model.binary.byteLength);
  for (let item = 0; item < accessor.count; item += 1) {
    for (let component = 0; component < components; component += 1) {
      const byteOffset = start + item * stride + component * info.bytes;
      output[item * components + component] = dataView[info.read](byteOffset, true);
    }
  }
  const result = {
    array: output,
    count: accessor.count,
    components,
    componentType: accessor.componentType,
    normalized: !!accessor.normalized,
    min: accessor.min || null,
    max: accessor.max || null,
    type: accessor.type
  };
  model.accessors.set(accessorIndex, result);
  return result;
}

function baseNode(node, index) {
  return {
    index,
    name: node.name || `node-${index}`,
    mesh: node.mesh,
    skin: node.skin,
    children: (node.children || []).slice(),
    parent: -1,
    baseMatrix: node.matrix ? new Float32Array(node.matrix) : null,
    baseTranslation: (node.translation || [0, 0, 0]).slice(),
    baseRotation: (node.rotation || [0, 0, 0, 1]).slice(),
    baseScale: (node.scale || [1, 1, 1]).slice(),
    translation: (node.translation || [0, 0, 0]).slice(),
    rotation: (node.rotation || [0, 0, 0, 1]).slice(),
    scale: (node.scale || [1, 1, 1]).slice(),
    localMatrix: identity4(),
    worldMatrix: identity4(),
    animated: false
  };
}

export function createRuntimeScene(model) {
  const document = model.document;
  const nodes = (document.nodes || []).map(baseNode);
  nodes.forEach((node) => node.children.forEach((child) => { if (nodes[child]) nodes[child].parent = node.index; }));
  const sceneIndex = document.scene || 0;
  const roots = (document.scenes?.[sceneIndex]?.nodes || []).slice();
  const runtime = { model, nodes, roots, animationIndex: -1, animationTime: 0, animationDuration: 0, bounds: null };
  updateWorldMatrices(runtime);
  runtime.bounds = sceneBounds(runtime);
  return runtime;
}

export function resetPose(runtime) {
  for (const node of runtime.nodes) {
    node.translation = node.baseTranslation.slice();
    node.rotation = node.baseRotation.slice();
    node.scale = node.baseScale.slice();
    node.animated = false;
  }
}

function sampleChannel(runtime, sampler, path, time) {
  const input = accessorData(runtime.model, sampler.input);
  const output = accessorData(runtime.model, sampler.output);
  const times = input.array;
  if (!times.length) return null;
  const duration = times[times.length - 1];
  const localTime = duration > 0 ? time % duration : 0;
  let right = 1;
  while (right < times.length && times[right] < localTime) right += 1;
  if (right >= times.length) right = times.length - 1;
  const left = Math.max(0, right - 1);
  const range = times[right] - times[left];
  const amount = range > 0 ? (localTime - times[left]) / range : 0;
  const components = path === 'rotation' ? 4 : 3;
  const first = Array.from(output.array.slice(left * components, left * components + components));
  const second = Array.from(output.array.slice(right * components, right * components + components));
  if ((sampler.interpolation || 'LINEAR') === 'STEP' || left === right) return first;
  return path === 'rotation' ? slerp4(first, second, amount) : lerpArray(first, second, amount);
}

export function setAnimation(runtime, animationIndex) {
  const animation = runtime.model.document.animations?.[animationIndex];
  if (!animation) {
    runtime.animationIndex = -1;
    runtime.animationDuration = 0;
    return;
  }
  runtime.animationIndex = animationIndex;
  runtime.animationTime = 0;
  runtime.animationDuration = animation.samplers.reduce((duration, sampler) => {
    const times = accessorData(runtime.model, sampler.input).array;
    return Math.max(duration, times[times.length - 1] || 0);
  }, 0);
}

export function applyAnimation(runtime, time) {
  resetPose(runtime);
  const animation = runtime.model.document.animations?.[runtime.animationIndex];
  if (!animation) {
    updateWorldMatrices(runtime);
    return;
  }
  runtime.animationTime = time;
  for (const channel of animation.channels) {
    const node = runtime.nodes[channel.target.node];
    const path = channel.target.path;
    if (!node || !['translation', 'rotation', 'scale'].includes(path)) continue;
    const value = sampleChannel(runtime, animation.samplers[channel.sampler], path, time);
    if (value) {
      node[path] = value;
      node.animated = true;
    }
  }
  updateWorldMatrices(runtime);
}

export function updateWorldMatrices(runtime) {
  const visit = (nodeIndex, parentWorld) => {
    const node = runtime.nodes[nodeIndex];
    if (!node) return;
    node.localMatrix = node.baseMatrix && !node.animated ? new Float32Array(node.baseMatrix) : composeTRS(node.translation, node.rotation, node.scale);
    node.worldMatrix = parentWorld ? multiply4(parentWorld, node.localMatrix) : new Float32Array(node.localMatrix);
    node.children.forEach((child) => visit(child, node.worldMatrix));
  };
  runtime.roots.forEach((root) => visit(root, null));
}

export function jointMatrices(runtime, meshNodeIndex, maximumJoints = 64) {
  const meshNode = runtime.nodes[meshNodeIndex];
  const skin = runtime.model.document.skins?.[meshNode?.skin];
  if (!meshNode || !skin) return null;
  if (skin.joints.length > maximumJoints) throw new Error(`Skin has ${skin.joints.length} joints; maximum is ${maximumJoints}`);
  const inverseMesh = invert4(meshNode.worldMatrix);
  if (!inverseMesh) throw new Error(`Skinned node ${meshNode.name} has a singular world transform`);
  const inverseBind = skin.inverseBindMatrices !== undefined ? accessorData(runtime.model, skin.inverseBindMatrices).array : null;
  const output = new Float32Array(maximumJoints * 16);
  for (let index = 0; index < maximumJoints; index += 1) output.set(identity4(), index * 16);
  skin.joints.forEach((jointNodeIndex, jointIndex) => {
    const bind = inverseBind ? new Float32Array(inverseBind.slice(jointIndex * 16, jointIndex * 16 + 16)) : identity4();
    const matrix = multiply4(multiply4(inverseMesh, runtime.nodes[jointNodeIndex].worldMatrix), bind);
    output.set(matrix, jointIndex * 16);
  });
  return output;
}

export function sceneBounds(runtime) {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  let points = 0;
  for (const node of runtime.nodes) {
    if (node.mesh === undefined) continue;
    const mesh = runtime.model.document.meshes?.[node.mesh];
    for (const primitive of mesh?.primitives || []) {
      const position = accessorData(runtime.model, primitive.attributes.POSITION);
      if (!position.min || !position.max) continue;
      for (const x of [position.min[0], position.max[0]]) for (const y of [position.min[1], position.max[1]]) for (const z of [position.min[2], position.max[2]]) {
        const world = transformPoint4(node.worldMatrix, [x, y, z]);
        for (let axis = 0; axis < 3; axis += 1) {
          minimum[axis] = Math.min(minimum[axis], world[axis]);
          maximum[axis] = Math.max(maximum[axis], world[axis]);
        }
        points += 1;
      }
    }
  }
  if (!points) return { minimum: [-1, -1, -1], maximum: [1, 1, 1], center: [0, 0, 0], size: [2, 2, 2] };
  return {
    minimum,
    maximum,
    center: minimum.map((value, axis) => (value + maximum[axis]) / 2),
    size: minimum.map((value, axis) => maximum[axis] - value)
  };
}

export function imageBytes(model, imageIndex) {
  const image = model.document.images?.[imageIndex];
  if (!image || image.bufferView === undefined) return null;
  const view = model.document.bufferViews?.[image.bufferView];
  if (!view) return null;
  const start = view.byteOffset || 0;
  return { bytes: model.binary.slice(start, start + view.byteLength), mimeType: image.mimeType || 'application/octet-stream' };
}

export function structuralSummary(model) {
  const document = model.document;
  return {
    scenes: document.scenes?.length || 0,
    nodes: document.nodes?.length || 0,
    meshes: document.meshes?.length || 0,
    primitives: (document.meshes || []).reduce((count, mesh) => count + mesh.primitives.length, 0),
    materials: document.materials?.length || 0,
    textures: document.textures?.length || 0,
    images: document.images?.length || 0,
    skins: document.skins?.length || 0,
    animations: document.animations?.length || 0
  };
}
