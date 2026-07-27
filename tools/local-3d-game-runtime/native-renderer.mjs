import { accessorData, applyAnimation, createRuntimeScene, imageBytes, jointMatrices, parseGlb, setAnimation, structuralSummary } from './native-glb.mjs';
import { composeTRS, lookAt4, multiply4, perspective4 } from './native-math.mjs';

const MAX_JOINTS = 64;

export const QUALITY_PRESETS = Object.freeze({
  PERFORMANCE: Object.freeze({ pixelRatioCap: 1, fogNear: 20, fogFar: 54, exposure: 0.98, vignette: 0.04, grain: 0, highlightLift: 0.04 }),
  PS2_BASELINE: Object.freeze({ pixelRatioCap: 1.25, fogNear: 24, fogFar: 62, exposure: 1.05, vignette: 0.14, grain: 0.008, highlightLift: 0.08 }),
  PS3_PREVIEW: Object.freeze({ pixelRatioCap: 1.75, fogNear: 30, fogFar: 86, exposure: 1.08, vignette: 0.22, grain: 0.014, highlightLift: 0.14 })
});

async function sha256Hex(bytes) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
layout(location=3) in vec4 aTangent;
layout(location=4) in vec4 aJoints;
layout(location=5) in vec4 aWeights;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat4 uJoints[${MAX_JOINTS}];
uniform int uSkinned;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTangent;
out float vTangentSign;
out vec2 vUv;
void main(){
  mat4 skin=mat4(1.0);
  if(uSkinned==1){
    skin=aWeights.x*uJoints[int(aJoints.x)]+aWeights.y*uJoints[int(aJoints.y)]+aWeights.z*uJoints[int(aJoints.z)]+aWeights.w*uJoints[int(aJoints.w)];
  }
  mat4 worldMatrix=uModel*skin;
  vec4 world=worldMatrix*vec4(aPosition,1.0);
  mat3 normalMatrix=mat3(worldMatrix);
  vWorld=world.xyz;
  vNormal=normalize(normalMatrix*aNormal);
  vTangent=normalize(normalMatrix*aTangent.xyz);
  vTangentSign=aTangent.w;
  vUv=aUv;
  gl_Position=uProjection*uView*world;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vTangent;
in float vTangentSign;
in vec2 vUv;
out vec4 fragColor;
uniform vec4 uBaseFactor;
uniform vec3 uEmissiveFactor;
uniform float uMetallic;
uniform float uRoughness;
uniform float uAlphaCutoff;
uniform int uAlphaMode;
uniform int uUnlit;
uniform int uDoubleSided;
uniform int uHasBase;
uniform int uHasMetalRough;
uniform int uHasNormal;
uniform int uHasEmissive;
uniform sampler2D uBaseTexture;
uniform sampler2D uMetalRoughTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uEmissiveTexture;
uniform vec4 uUvOffsetScale;
uniform float uUvRotation;
uniform vec3 uCamera;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uExposure;
uniform vec2 uViewport;
uniform float uTime;
uniform float uVignette;
uniform float uGrain;
uniform float uHighlightLift;
vec3 srgbToLinear(vec3 value){return pow(max(value,vec3(0.0)),vec3(2.2));}
vec3 linearToSrgb(vec3 value){return pow(max(value,vec3(0.0)),vec3(1.0/2.2));}
vec3 aces(vec3 value){return clamp((value*(2.51*value+0.03))/(value*(2.43*value+0.59)+0.14),0.0,1.0);}
float hashNoise(vec2 value){return fract(sin(dot(value,vec2(127.1,311.7)))*43758.5453123);}
vec2 materialUv(){vec2 centered=vUv*uUvOffsetScale.zw;float c=cos(uUvRotation),s=sin(uUvRotation);return mat2(c,-s,s,c)*centered+uUvOffsetScale.xy;}
void main(){
  vec2 uv=materialUv();
  vec4 base=uBaseFactor;
  if(uHasBase==1){vec4 sampleColor=texture(uBaseTexture,uv);base*=vec4(srgbToLinear(sampleColor.rgb),sampleColor.a);}
  if(uAlphaMode==1&&base.a<uAlphaCutoff)discard;
  vec3 normal=normalize(vNormal);
  if(uDoubleSided==1&&!gl_FrontFacing)normal=-normal;
  if(uHasNormal==1){
    vec3 tangent=normalize(vTangent-normal*dot(normal,vTangent));
    vec3 bitangent=normalize(cross(normal,tangent))*vTangentSign;
    vec3 mapped=texture(uNormalTexture,uv).xyz*2.0-1.0;
    normal=normalize(mat3(tangent,bitangent,normal)*mapped);
  }
  float metallic=uMetallic,roughness=clamp(uRoughness,0.04,1.0);
  if(uHasMetalRough==1){vec4 mr=texture(uMetalRoughTexture,uv);roughness*=mr.g;metallic*=mr.b;}
  vec3 emissive=uEmissiveFactor;
  if(uHasEmissive==1)emissive*=srgbToLinear(texture(uEmissiveTexture,uv).rgb);
  vec3 color;
  if(uUnlit==1){color=base.rgb+emissive;}else{
    vec3 light=normalize(-uSunDirection),viewDirection=normalize(uCamera-vWorld),halfVector=normalize(light+viewDirection);
    float diffuse=max(dot(normal,light),0.0);
    float sky=max(normal.y*0.5+0.5,0.0),ground=1.0-sky;
    vec3 ambient=uSkyColor*sky+uGroundColor*ground;
    vec3 dielectric=vec3(0.04),f0=mix(dielectric,base.rgb,metallic);
    float specPower=mix(128.0,4.0,roughness);
    float specular=pow(max(dot(normal,halfVector),0.0),specPower)*(1.0-roughness*0.55);
    color=base.rgb*(ambient+uSunColor*diffuse*(1.0-metallic*0.55))+f0*uSunColor*specular+emissive;
  }
  float distanceToCamera=length(uCamera-vWorld);
  float fog=smoothstep(uFogNear,uFogFar,distanceToCamera);
  color=mix(color,uFogColor,fog);
  color+=max(color-vec3(0.68),vec3(0.0))*uHighlightLift;
  color=linearToSrgb(aces(color*uExposure));
  vec2 screenUv=gl_FragCoord.xy/max(uViewport,vec2(1.0));
  vec2 vignetteOffset=screenUv-0.5;
  float vignette=1.0-uVignette*smoothstep(0.28,0.72,length(vignetteOffset)*1.4142);
  float grain=(hashNoise(gl_FragCoord.xy+fract(uTime)*61.0)-0.5)*uGrain;
  color=color*vignette+grain;
  fragColor=vec4(color,base.a);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader program link failed');
  return program;
}

function componentGlType(gl, componentType) {
  return ({ 5121: gl.UNSIGNED_BYTE, 5123: gl.UNSIGNED_SHORT, 5125: gl.UNSIGNED_INT, 5126: gl.FLOAT })[componentType];
}

function attributeArray(model, accessorIndex, count, components, fallback, Ctor = Float32Array) {
  if (accessorIndex !== undefined) return accessorData(model, accessorIndex);
  const array = new Ctor(count * components);
  for (let index = 0; index < count; index += 1) for (let component = 0; component < components; component += 1) array[index * components + component] = fallback[component] || 0;
  return { array, count, components, componentType: Ctor === Uint16Array ? 5123 : 5126, normalized: false };
}

function uploadAttribute(gl, location, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.array, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, data.components, componentGlType(gl, data.componentType), data.normalized, 0, 0);
  return buffer;
}

function uploadPrimitive(gl, model, primitive, materialIndex = primitive.material) {
  const position = accessorData(model, primitive.attributes.POSITION);
  const count = position.count;
  const normal = attributeArray(model, primitive.attributes.NORMAL, count, 3, [0, 1, 0]);
  const uv = attributeArray(model, primitive.attributes.TEXCOORD_0, count, 2, [0, 0]);
  const tangent = attributeArray(model, primitive.attributes.TANGENT, count, 4, [1, 0, 0, 1]);
  const joints = attributeArray(model, primitive.attributes.JOINTS_0, count, 4, [0, 0, 0, 0], Uint16Array);
  const weights = attributeArray(model, primitive.attributes.WEIGHTS_0, count, 4, [1, 0, 0, 0]);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffers = [
    uploadAttribute(gl, 0, position), uploadAttribute(gl, 1, normal), uploadAttribute(gl, 2, uv),
    uploadAttribute(gl, 3, tangent), uploadAttribute(gl, 4, joints), uploadAttribute(gl, 5, weights)
  ];
  let indices;
  if (primitive.indices !== undefined) indices = accessorData(model, primitive.indices);
  else {
    const Ctor = count > 65535 ? Uint32Array : Uint16Array;
    const array = new Ctor(count);
    for (let index = 0; index < count; index += 1) array[index] = index;
    indices = { array, count, componentType: Ctor === Uint32Array ? 5125 : 5123 };
  }
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.array, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return {
    vao, buffers, indexBuffer, count: indices.count, indexType: componentGlType(gl, indices.componentType),
    materialIndex: materialIndex ?? -1, mode: primitive.mode ?? 4, skinned: primitive.attributes.JOINTS_0 !== undefined && primitive.attributes.WEIGHTS_0 !== undefined,
    triangles: (primitive.mode ?? 4) === 4 ? Math.floor(indices.count / 3) : 0
  };
}

function geometryModel(positions, normals, uvs, indices) {
  return {
    document: { accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: uvs.length / 2, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: indices.length, type: 'SCALAR' }
    ], bufferViews: [] },
    binary: new Uint8Array(),
    accessors: new Map([
      [0, { array: new Float32Array(positions), count: positions.length / 3, components: 3, componentType: 5126, normalized: false }],
      [1, { array: new Float32Array(normals), count: normals.length / 3, components: 3, componentType: 5126, normalized: false }],
      [2, { array: new Float32Array(uvs), count: uvs.length / 2, components: 2, componentType: 5126, normalized: false }],
      [3, { array: new Uint16Array(indices), count: indices.length, components: 1, componentType: 5123, normalized: false }]
    ])
  };
}

function boxGeometry() {
  const p = [], n = [], uv = [], indices = [];
  const faces = [
    [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]], [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],
    [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]], [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]],
    [[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1],[0,1,0]], [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0]]
  ];
  faces.forEach((face) => { const start=p.length/3; for(let i=0;i<4;i+=1){p.push(...face[i]);n.push(...face[4]);uv.push(i===1||i===2?1:0,i>=2?1:0);} indices.push(start,start+1,start+2,start,start+2,start+3); });
  return geometryModel(p,n,uv,indices);
}

function planeGeometry() {
  return geometryModel([-1,0,-1, 1,0,-1, 1,0,1, -1,0,1], [0,1,0, 0,1,0, 0,1,0, 0,1,0], [0,0, 1,0, 1,1, 0,1], [0,1,2,0,2,3]);
}

function textureTransform(textureInfo) {
  const transform = textureInfo?.extensions?.KHR_texture_transform || {};
  return { offsetScale: [...(transform.offset || [0, 0]), ...(transform.scale || [1, 1])], rotation: transform.rotation || 0 };
}

function materialDescriptor(document, materialIndex) {
  if (materialIndex < 0) return { baseFactor: [0.7, 0.76, 0.82, 1], emissive: [0,0,0], metallic: 0, roughness: 0.8, alphaMode: 'OPAQUE', alphaCutoff: 0.5, doubleSided: false, unlit: false };
  const material = document.materials?.[materialIndex] || {};
  const pbr = material.pbrMetallicRoughness || {};
  return {
    baseFactor: pbr.baseColorFactor || [1, 1, 1, 1], baseTexture: pbr.baseColorTexture,
    metalRoughTexture: pbr.metallicRoughnessTexture, normalTexture: material.normalTexture,
    emissiveTexture: material.emissiveTexture,
    emissive: (material.emissiveFactor || [0, 0, 0]).map((value) => value * (material.extensions?.KHR_materials_emissive_strength?.emissiveStrength || 1)),
    metallic: pbr.metallicFactor ?? 1, roughness: pbr.roughnessFactor ?? 1,
    alphaMode: material.alphaMode || 'OPAQUE', alphaCutoff: material.alphaCutoff ?? 0.5,
    doubleSided: !!material.doubleSided, unlit: !!material.extensions?.KHR_materials_unlit,
    transform: textureTransform(pbr.baseColorTexture)
  };
}

export class NativeWebGL2Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.available = !!this.gl;
    this.assets = [];
    this.assetCache = new Map();
    this.qualityName = 'PS2_BASELINE';
    this.quality = QUALITY_PRESETS[this.qualityName];
    this.lastStats = { draws: 0, triangles: 0, assets: 0 };
    if (!this.gl) { this.reason = 'WebGL2 is unavailable; the native runtime refuses to fake a 3D surface.'; return; }
    const gl = this.gl;
    this.program = createProgram(gl);
    this.uniforms = {};
    for (const name of ['uProjection','uView','uModel','uJoints','uSkinned','uBaseFactor','uEmissiveFactor','uMetallic','uRoughness','uAlphaCutoff','uAlphaMode','uUnlit','uDoubleSided','uHasBase','uHasMetalRough','uHasNormal','uHasEmissive','uBaseTexture','uMetalRoughTexture','uNormalTexture','uEmissiveTexture','uUvOffsetScale','uUvRotation','uCamera','uSunDirection','uSunColor','uSkyColor','uGroundColor','uFogColor','uFogNear','uFogFar','uExposure','uViewport','uTime','uVignette','uGrain','uHighlightLift']) this.uniforms[name] = gl.getUniformLocation(this.program, name);
    this.whiteTexture = this.createSolidTexture([255,255,255,255]);
    this.normalTexture = this.createSolidTexture([128,128,255,255]);
    const boxModel = boxGeometry(), planeModel = planeGeometry();
    this.procedural = {
      box: uploadPrimitive(gl, boxModel, { attributes:{ POSITION:0,NORMAL:1,TEXCOORD_0:2 }, indices:3 }, -1),
      plane: uploadPrimitive(gl, planeModel, { attributes:{ POSITION:0,NORMAL:1,TEXCOORD_0:2 }, indices:3 }, -1)
    };
    this.identityJoints = new Float32Array(MAX_JOINTS * 16);
    for (let joint = 0; joint < MAX_JOINTS; joint += 1) this.identityJoints.set([1,0,0,0,0,1,0,0,0,1,0,0,0,0,1], joint * 16);
  }

  createSolidTexture(bytes) {
    const gl = this.gl, texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(bytes));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }

  async loadImageTexture(payload) {
    const bitmap = await createImageBitmap(new Blob([payload.bytes], { type: payload.mimeType }));
    const gl = this.gl, texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    bitmap.close();
    return texture;
  }

  async loadAsset(specification) {
    let cached = this.assetCache.get(specification.url);
    if (!cached) {
      const response = await fetch(specification.url);
      if (!response.ok) throw new Error(`${specification.id}: HTTP ${response.status}`);
      const model = parseGlb(await response.arrayBuffer());
      const runtime = createRuntimeScene(model);
      const externalTextureReceipts = [];
      const images = await Promise.all((model.document.images || []).map(async (image, index) => {
        let payload = imageBytes(model, index);
        if (!payload) {
          if (!image.uri) throw new Error(`${specification.id}: image ${index} has no embedded payload or URI.`);
          const imageUrl = new URL(image.uri, response.url);
          if (imageUrl.origin !== new URL(response.url).origin) throw new Error(`${specification.id}: cross-origin texture URI refused.`);
          const expectedDigest = specification.externalTextureDigests?.[image.uri];
          if (!expectedDigest) throw new Error(`${specification.id}: external texture ${image.uri} has no declared digest.`);
          const textureResponse = await fetch(imageUrl);
          if (!textureResponse.ok) throw new Error(`${specification.id}: texture ${image.uri} HTTP ${textureResponse.status}`);
          const textureBuffer = await textureResponse.arrayBuffer(), actualDigest = await sha256Hex(textureBuffer);
          if (actualDigest !== expectedDigest) throw new Error(`${specification.id}: texture ${image.uri} digest mismatch: ${actualDigest}`);
          payload = { bytes: new Uint8Array(textureBuffer), mimeType: image.mimeType || textureResponse.headers.get('content-type') || 'image/png' };
          externalTextureReceipts.push({ uri:image.uri, sha256:actualDigest, byteLength:textureBuffer.byteLength });
        }
        return this.loadImageTexture(payload);
      }));
      const meshes = (model.document.meshes || []).map((mesh) => mesh.primitives.map((primitive) => uploadPrimitive(this.gl, model, primitive)));
      cached = { model, runtime, images, meshes, summary: structuralSummary(model), externalTextureReceipts };
      this.assetCache.set(specification.url, cached);
    }
    const runtime = createRuntimeScene(cached.model);
    const animations = cached.model.document.animations || [];
    const animationIndex = specification.animationPattern ? animations.findIndex((animation) => specification.animationPattern.test(animation.name || '')) : -1;
    if (animationIndex >= 0) setAnimation(runtime, animationIndex);
    const asset = {
      id: specification.id, url: specification.url, cached, runtime,
      transform: specification.transform || composeTRS(), animationIndex,
      animationName: animationIndex >= 0 ? animations[animationIndex].name : null
    };
    this.assets.push(asset);
    return asset;
  }

  resize() {
    if (!this.available) return;
    const ratio = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatioCap);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.gl.viewport(0, 0, width, height);
  }

  setQualityPreset(name) {
    if (!QUALITY_PRESETS[name]) throw new Error(`Unknown render preset ${name}`);
    this.qualityName = name;
    this.quality = QUALITY_PRESETS[name];
    this.resize();
    return this.qualityName;
  }

  textureFor(cached, textureInfo, fallback) {
    const textureIndex = textureInfo?.index;
    const imageIndex = textureIndex === undefined ? undefined : cached.model.document.textures?.[textureIndex]?.source;
    return imageIndex === undefined ? fallback : cached.images[imageIndex] || fallback;
  }

  bindTexture(unit, texture, uniform) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniform, unit);
  }

  applyMaterial(cached, materialIndex, override = null) {
    const gl = this.gl, u = this.uniforms;
    const material = override || materialDescriptor(cached?.model.document || {}, materialIndex);
    gl.uniform4fv(u.uBaseFactor, material.baseFactor);
    gl.uniform3fv(u.uEmissiveFactor, material.emissive || [0,0,0]);
    gl.uniform1f(u.uMetallic, material.metallic ?? 0);
    gl.uniform1f(u.uRoughness, material.roughness ?? 0.8);
    gl.uniform1f(u.uAlphaCutoff, material.alphaCutoff ?? 0.5);
    gl.uniform1i(u.uAlphaMode, material.alphaMode === 'MASK' ? 1 : material.alphaMode === 'BLEND' ? 2 : 0);
    gl.uniform1i(u.uUnlit, material.unlit ? 1 : 0);
    gl.uniform1i(u.uDoubleSided, material.doubleSided ? 1 : 0);
    const transform = material.transform || { offsetScale:[0,0,1,1], rotation:0 };
    gl.uniform4fv(u.uUvOffsetScale, transform.offsetScale);
    gl.uniform1f(u.uUvRotation, transform.rotation);
    for (const [flag, info, unit, sampler, fallback] of [
      [u.uHasBase, material.baseTexture, 0, u.uBaseTexture, this.whiteTexture],
      [u.uHasMetalRough, material.metalRoughTexture, 1, u.uMetalRoughTexture, this.whiteTexture],
      [u.uHasNormal, material.normalTexture, 2, u.uNormalTexture, this.normalTexture],
      [u.uHasEmissive, material.emissiveTexture, 3, u.uEmissiveTexture, this.whiteTexture]
    ]) {
      gl.uniform1i(flag, info ? 1 : 0);
      this.bindTexture(unit, cached ? this.textureFor(cached, info, fallback) : fallback, sampler);
    }
    if (material.alphaMode === 'BLEND') { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); } else gl.disable(gl.BLEND);
    if (material.doubleSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
  }

  drawPrimitive(primitive, modelMatrix, cached, skinData, overrideMaterial = null) {
    const gl = this.gl, u = this.uniforms;
    gl.bindVertexArray(primitive.vao);
    gl.uniformMatrix4fv(u.uModel, false, modelMatrix);
    gl.uniform1i(u.uSkinned, skinData && primitive.skinned ? 1 : 0);
    gl.uniformMatrix4fv(u.uJoints, false, skinData || this.identityJoints);
    this.applyMaterial(cached, primitive.materialIndex, overrideMaterial);
    gl.drawElements(primitive.mode === 4 ? gl.TRIANGLES : primitive.mode, primitive.count, primitive.indexType, 0);
    this.lastStats.draws += 1;
    this.lastStats.triangles += primitive.triangles;
  }

  drawProcedural(kind, matrix, material) {
    this.drawPrimitive(this.procedural[kind], matrix, null, null, material);
  }

  render({ gameState, camera, time = 0, night = false }) {
    if (!this.available) return this.lastStats;
    this.resize();
    const gl = this.gl, u = this.uniforms;
    this.lastStats = { draws: 0, triangles: 0, assets: this.assets.length };
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.depthFunc(gl.LEQUAL);
    const background = night ? [0.01,0.025,0.055] : [0.075,0.13,0.19];
    gl.clearColor(...background, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const projection = perspective4((camera.fov || 48) * Math.PI / 180, this.canvas.width / this.canvas.height, 0.05, 180);
    const view = lookAt4(camera.eye, camera.target, [0,1,0]);
    gl.uniformMatrix4fv(u.uProjection, false, projection); gl.uniformMatrix4fv(u.uView, false, view);
    gl.uniform3fv(u.uCamera, camera.eye); gl.uniform3fv(u.uSunDirection, night ? [-0.3,-0.9,-0.2] : [-0.5,-1,-0.35]);
    gl.uniform3fv(u.uSunColor, night ? [0.35,0.48,0.72] : [1.1,0.93,0.72]);
    gl.uniform3fv(u.uSkyColor, night ? [0.045,0.075,0.14] : [0.21,0.32,0.43]);
    gl.uniform3fv(u.uGroundColor, night ? [0.018,0.025,0.04] : [0.08,0.075,0.06]);
    gl.uniform3fv(u.uFogColor, background); gl.uniform1f(u.uFogNear, this.quality.fogNear); gl.uniform1f(u.uFogFar, this.quality.fogFar); gl.uniform1f(u.uExposure, night ? this.quality.exposure + 0.2 : this.quality.exposure);
    gl.uniform2f(u.uViewport, this.canvas.width, this.canvas.height); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uVignette, this.quality.vignette); gl.uniform1f(u.uGrain, this.quality.grain); gl.uniform1f(u.uHighlightLift, this.quality.highlightLift);

    this.drawProcedural('plane', composeTRS([0,-0.035,1],[0,0,0,1],[13,1,11]), { baseFactor:[0.055,0.085,0.1,1], emissive:[0,0,0], metallic:0.08, roughness:0.94, alphaMode:'OPAQUE', transform:{offsetScale:[0,0,8,8],rotation:0} });
    for (const asset of this.assets) {
      if (asset.animationIndex >= 0) applyAnimation(asset.runtime, time);
      for (const node of asset.runtime.nodes) {
        if (node.mesh === undefined) continue;
        const matrix = multiply4(asset.transform, node.worldMatrix);
        const skinData = node.skin !== undefined ? jointMatrices(asset.runtime, node.index, MAX_JOINTS) : null;
        for (const primitive of asset.cached.meshes[node.mesh] || []) this.drawPrimitive(primitive, matrix, asset.cached, skinData);
      }
    }

    const playerYawHalf = gameState.player.yaw / 2;
    const playerRotation = [0, Math.sin(playerYawHalf), 0, Math.cos(playerYawHalf)];
    this.drawProcedural('box', composeTRS([gameState.player.x,0.55,gameState.player.z],playerRotation,[0.22,0.55,0.3]), { baseFactor:[0.08,0.72,0.74,1], emissive:[0.015,0.18,0.2], metallic:0.22, roughness:0.42, alphaMode:'OPAQUE', transform:{offsetScale:[0,0,1,1],rotation:0} });
    for (const beacon of gameState.beacons) {
      if (beacon.collected) continue;
      const pulse = 0.18 + Math.sin(time * 3 + beacon.x) * 0.035;
      this.drawProcedural('box', composeTRS([beacon.x,0.38,beacon.z],[0,Math.sin(time*.4),0,Math.cos(time*.4)],[pulse,pulse,pulse]), { baseFactor:[0.95,0.46,0.08,1], emissive:[1.4,0.34,0.02], metallic:0.1, roughness:0.28, alphaMode:'OPAQUE', transform:{offsetScale:[0,0,1,1],rotation:0} });
    }
    gl.bindVertexArray(null);
    return this.lastStats;
  }

  summaries() { return this.assets.map((asset) => ({ id:asset.id, ...asset.cached.summary, animation:asset.animationName, bounds:asset.runtime.bounds, externalTextures:asset.cached.externalTextureReceipts })); }
  qualityEvidence() { return { name: this.qualityName, ...this.quality, scope: 'render-presentation-only' }; }
  frameProof() { return this.canvas.toDataURL('image/png'); }
}
