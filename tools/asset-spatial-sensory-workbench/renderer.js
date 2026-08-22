(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AXMSpatialRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "0.1.0";
  function requireValue(condition, message) { if (!condition) throw new Error(message); }
  function decodeDataUrl(dataUrl) {
    var prefix = "data:model/gltf-binary;base64,";
    requireValue(typeof dataUrl === "string" && dataUrl.indexOf(prefix) === 0, "Exact model/gltf-binary base64 dataUrl is required");
    var encoded = dataUrl.slice(prefix.length);
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(encoded, "base64"));
    var binary = atob(encoded);
    var output = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
    return output;
  }
  function componentSize(type) { return ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 })[type] || 0; }
  function componentCount(type) { return ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 })[type] || 0; }
  function readComponent(view, type, offset) {
    if (type === 5120) return view.getInt8(offset);
    if (type === 5121) return view.getUint8(offset);
    if (type === 5122) return view.getInt16(offset, true);
    if (type === 5123) return view.getUint16(offset, true);
    if (type === 5125) return view.getUint32(offset, true);
    if (type === 5126) return view.getFloat32(offset, true);
    throw new Error("Unsupported GLB accessor component type");
  }
  function parseGlb(dataUrl) {
    var bytes = decodeDataUrl(dataUrl);
    requireValue(bytes.byteLength >= 28, "GLB is truncated");
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    requireValue(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === bytes.byteLength, "GLB2 header mismatch");
    var jsonLength = view.getUint32(12, true);
    requireValue(view.getUint32(16, true) === 0x4e4f534a && jsonLength > 0 && 20 + jsonLength + 8 <= bytes.byteLength, "GLB JSON chunk mismatch");
    var jsonBytes = bytes.subarray(20, 20 + jsonLength);
    var jsonText = typeof TextDecoder !== "undefined" ? new TextDecoder().decode(jsonBytes) : Buffer.from(jsonBytes).toString("utf8");
    var json = JSON.parse(jsonText.trim());
    var binHeader = 20 + jsonLength;
    var binLength = view.getUint32(binHeader, true);
    requireValue(view.getUint32(binHeader + 4, true) === 0x004e4942 && binHeader + 8 + binLength === bytes.byteLength, "GLB BIN chunk mismatch");
    var binStart = binHeader + 8;
    requireValue(json.asset && json.asset.version === "2.0" && json.meshes && json.meshes.length === 1, "Bounded one-mesh glTF 2.0 is required");
    var primitive = json.meshes[0].primitives && json.meshes[0].primitives[0];
    requireValue(primitive && primitive.mode === 4 && primitive.attributes && primitive.attributes.POSITION != null && primitive.attributes.NORMAL != null && primitive.indices != null, "Indexed POSITION/NORMAL TRIANGLES primitive is required");
    function accessor(index) {
      var descriptor = json.accessors[index];
      var bufferView = descriptor && json.bufferViews[descriptor.bufferView];
      var size = descriptor && componentSize(descriptor.componentType);
      var count = descriptor && componentCount(descriptor.type);
      requireValue(descriptor && bufferView && size && count, "GLB accessor declaration is invalid");
      var stride = Number(bufferView.byteStride) || size * count;
      var base = binStart + (Number(bufferView.byteOffset) || 0) + (Number(descriptor.byteOffset) || 0);
      var values = new Float32Array(descriptor.count * count);
      for (var item = 0; item < descriptor.count; item += 1) {
        for (var component = 0; component < count; component += 1) values[item * count + component] = readComponent(view, descriptor.componentType, base + item * stride + component * size);
      }
      return { descriptor: descriptor, values: values, components: count };
    }
    var positions = accessor(primitive.attributes.POSITION);
    var normals = accessor(primitive.attributes.NORMAL);
    var indices = accessor(primitive.indices);
    requireValue(positions.components === 3 && normals.components === 3 && indices.components === 1 && positions.descriptor.count === normals.descriptor.count && indices.descriptor.count === positions.descriptor.count, "Bounded sequential spatial accessor counts mismatch");
    var barycentric = new Float32Array(positions.descriptor.count * 3);
    for (var vertex = 0; vertex < positions.descriptor.count; vertex += 1) barycentric[vertex * 3 + (vertex % 3)] = 1;
    var zeroNormals = 0;
    for (var normal = 0; normal < normals.values.length; normal += 3) if (Math.hypot(normals.values[normal], normals.values[normal + 1], normals.values[normal + 2]) < 0.00001) zeroNormals += 1;
    var pbr = json.materials[0].pbrMetallicRoughness;
    return {
      bytes: bytes,
      json: json,
      positions: positions.values,
      normals: normals.values,
      indices: indices.values,
      barycentric: barycentric,
      vertex_count: positions.descriptor.count,
      triangle_count: positions.descriptor.count / 3,
      zero_normal_count: zeroNormals,
      bounds: { min: positions.descriptor.min.slice(), max: positions.descriptor.max.slice(), size: positions.descriptor.max.map(function (value, axis) { return value - positions.descriptor.min[axis]; }) },
      material: {
        baseColorFactor: (pbr.baseColorFactor || [1, 1, 1, 1]).slice(),
        metallicFactor: Number(pbr.metallicFactor) || 0,
        roughnessFactor: pbr.roughnessFactor == null ? 1 : Number(pbr.roughnessFactor),
        doubleSided: json.materials[0].doubleSided === true,
        alphaMode: json.materials[0].alphaMode || "OPAQUE"
      }
    };
  }

  function multiply(a, b) {
    var out = new Float32Array(16);
    for (var column = 0; column < 4; column += 1) for (var row = 0; row < 4; row += 1) {
      out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
    return out;
  }
  function perspective(fov, aspect, near, far) {
    var f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function orthographic(left, right, bottom, top, near, far) {
    return new Float32Array([2 / (right - left), 0, 0, 0, 0, 2 / (top - bottom), 0, 0, 0, 0, -2 / (far - near), 0, -(right + left) / (right - left), -(top + bottom) / (top - bottom), -(far + near) / (far - near), 1]);
  }
  function normalize3(value) {
    var length = Math.hypot(value[0], value[1], value[2]) || 1;
    return [value[0] / length, value[1] / length, value[2] / length];
  }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function lookAt(eye, target, up) {
    var z = normalize3([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
    var x = normalize3(cross(up, z));
    var y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1]);
  }
  function radians(degrees) { return degrees * Math.PI / 180; }
  function colourForBackground(name) {
    return ({ "studio-dark": [0.025, 0.04, 0.075, 1], "studio-light": [0.72, 0.75, 0.78, 1], neutral: [0.18, 0.19, 0.21, 1], black: [0, 0, 0, 1] })[name] || [0.025, 0.04, 0.075, 1];
  }
  function shader(gl, type, source) {
    var output = gl.createShader(type);
    gl.shaderSource(output, source);
    gl.compileShader(output);
    if (!gl.getShaderParameter(output, gl.COMPILE_STATUS)) throw new Error("WebGL shader compile failed: " + gl.getShaderInfoLog(output));
    return output;
  }
  function program(gl, vertex, fragment) {
    var output = gl.createProgram();
    gl.attachShader(output, shader(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(output, shader(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(output);
    if (!gl.getProgramParameter(output, gl.LINK_STATUS)) throw new Error("WebGL program link failed: " + gl.getProgramInfoLog(output));
    return output;
  }
  function buffer(gl, values) {
    var output = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, output);
    gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
    return output;
  }
  function lineGeometry(bounds) {
    var size = Math.max.apply(Math, bounds.size.concat([0.001]));
    var exponent = Math.floor(Math.log(size) / Math.LN10);
    var step = Math.pow(10, exponent) / 2;
    if (size / step < 4) step /= 2;
    var extent = step * 10;
    var y = Math.min(0, bounds.min[1]);
    var grid = [], axes = [], box = [];
    function line(target, a, b, colour) { target.push(a[0], a[1], a[2], colour[0], colour[1], colour[2], a[3] == null ? 1 : a[3], b[0], b[1], b[2], colour[0], colour[1], colour[2], b[3] == null ? 1 : b[3]); }
    for (var index = -10; index <= 10; index += 1) {
      var tone = index === 0 ? [0.35, 0.45, 0.58] : [0.19, 0.25, 0.34];
      line(grid, [-extent, y, index * step], [extent, y, index * step], tone);
      line(grid, [index * step, y, -extent], [index * step, y, extent], tone);
    }
    line(axes, [0, y, 0], [extent * 0.55, y, 0], [1, 0.28, 0.25]);
    line(axes, [0, y, 0], [0, y + extent * 0.55, 0], [0.32, 1, 0.52]);
    line(axes, [0, y, 0], [0, y, extent * 0.55], [0.3, 0.55, 1]);
    var min = bounds.min, max = bounds.max;
    var points = [[min[0], min[1], min[2]], [max[0], min[1], min[2]], [min[0], max[1], min[2]], [max[0], max[1], min[2]], [min[0], min[1], max[2]], [max[0], min[1], max[2]], [min[0], max[1], max[2]], [max[0], max[1], max[2]]];
    [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]].forEach(function (edge) { line(box, points[edge[0]], points[edge[1]], [0.98, 0.75, 0.24]); });
    return { grid: new Float32Array(grid), axes: new Float32Array(axes), bounds: new Float32Array(box), step: step };
  }

  var MESH_VERTEX = "#version 300 es\nprecision highp float;in vec3 aPosition;in vec3 aNormal;in vec3 aBarycentric;uniform mat4 uViewProjection;out vec3 vPosition;out vec3 vNormal;out vec3 vBarycentric;void main(){vPosition=aPosition;vNormal=aNormal;vBarycentric=aBarycentric;gl_Position=uViewProjection*vec4(aPosition,1.0);}";
  var MESH_FRAGMENT = "#version 300 es\nprecision highp float;in vec3 vPosition;in vec3 vNormal;in vec3 vBarycentric;uniform vec4 uBaseColor;uniform float uMetallic;uniform float uRoughness;uniform vec3 uLightDirection;uniform float uLightIntensity;uniform float uAmbient;uniform vec3 uEye;uniform int uViewMode;uniform bool uRepairNormals;out vec4 outColor;float edge(){vec3 d=fwidth(vBarycentric);vec3 a=smoothstep(vec3(0.0),d*1.25,vBarycentric);return min(min(a.x,a.y),a.z);}void main(){vec3 delivered=length(vNormal)>0.00001?normalize(vNormal):vec3(0.0);vec3 face=normalize(cross(dFdx(vPosition),dFdy(vPosition)));vec3 n=(uRepairNormals&&length(delivered)<0.5)?face:delivered;if(uViewMode==2){outColor=vec4(n*0.5+0.5,1.0);return;}vec3 l=normalize(uLightDirection);vec3 v=normalize(uEye-vPosition);vec3 h=normalize(l+v);float ndl=max(dot(n,l),0.0);float spec=pow(max(dot(n,h),0.0),mix(90.0,8.0,uRoughness));vec3 dielectric=vec3(0.04);vec3 f0=mix(dielectric,uBaseColor.rgb,uMetallic);vec3 colour=uBaseColor.rgb*(uAmbient+ndl*uLightIntensity*(1.0-uMetallic*0.35))+f0*spec*uLightIntensity;if(length(n)<0.5)colour=uBaseColor.rgb*uAmbient;float e=edge();if(uViewMode==1)colour=mix(vec3(0.02,0.035,0.06),vec3(0.22,0.95,1.0),1.0-e);outColor=vec4(colour,uBaseColor.a);}";
  var LINE_VERTEX = "#version 300 es\nprecision highp float;in vec3 aPosition;in vec4 aColor;uniform mat4 uViewProjection;out vec4 vColor;void main(){vColor=aColor;gl_Position=uViewProjection*vec4(aPosition,1.0);}";
  var LINE_FRAGMENT = "#version 300 es\nprecision highp float;in vec4 vColor;out vec4 outColor;void main(){outColor=vColor;}";

  function SpatialRenderer(canvas) {
    requireValue(canvas && typeof canvas.getContext === "function", "Canvas is required");
    var gl = canvas.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: true });
    requireValue(gl, "WebGL2 is unavailable");
    this.canvas = canvas;
    this.gl = gl;
    this.meshProgram = program(gl, MESH_VERTEX, MESH_FRAGMENT);
    this.lineProgram = program(gl, LINE_VERTEX, LINE_FRAGMENT);
    this.viewer = null;
    this.geometry = null;
    this.meshBuffers = null;
    this.lineBuffers = null;
    this.frameCount = 0;
    this.contextLost = false;
    var self = this;
    canvas.addEventListener("webglcontextlost", function (event) { event.preventDefault(); self.contextLost = true; });
  }
  SpatialRenderer.prototype.load = function (dataUrl) {
    var gl = this.gl;
    this.geometry = parseGlb(dataUrl);
    this.meshBuffers = { position: buffer(gl, this.geometry.positions), normal: buffer(gl, this.geometry.normals), barycentric: buffer(gl, this.geometry.barycentric) };
    var lines = lineGeometry(this.geometry.bounds);
    this.lineBuffers = {
      grid: { buffer: buffer(gl, lines.grid), count: lines.grid.length / 7 },
      axes: { buffer: buffer(gl, lines.axes), count: lines.axes.length / 7 },
      bounds: { buffer: buffer(gl, lines.bounds), count: lines.bounds.length / 7 },
      step: lines.step
    };
    this.frameCount = 0;
    return this.geometry;
  };
  SpatialRenderer.prototype.setViewer = function (viewer) { this.viewer = viewer; return this; };
  SpatialRenderer.prototype.resize = function () {
    var ratio = Math.min(2, typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
    var width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    var height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.gl.viewport(0, 0, width, height);
  };
  SpatialRenderer.prototype.viewProjection = function () {
    var viewer = this.viewer;
    var yaw = radians(viewer.yaw_deg), pitch = radians(viewer.pitch_deg), distance = viewer.distance;
    var eye = [viewer.target[0] + distance * Math.cos(pitch) * Math.sin(yaw), viewer.target[1] + distance * Math.sin(pitch), viewer.target[2] + distance * Math.cos(pitch) * Math.cos(yaw)];
    var view = lookAt(eye, viewer.target, [0, 1, 0]);
    var aspect = this.canvas.width / Math.max(1, this.canvas.height);
    var near = Math.max(0.0001, distance / 1000), far = Math.max(100, distance * 1000);
    var projection;
    if (viewer.projection === "orthographic") {
      var half = distance * 0.42;
      projection = orthographic(-half * aspect, half * aspect, -half, half, near, far);
    } else projection = perspective(radians(viewer.fov_deg), aspect, near, far);
    return { matrix: multiply(projection, view), eye: eye };
  };
  SpatialRenderer.prototype.bindAttribute = function (programValue, name, source, size, stride, offset) {
    var gl = this.gl, location = gl.getAttribLocation(programValue, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, source);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride || 0, offset || 0);
  };
  SpatialRenderer.prototype.drawLines = function (entry, matrix) {
    if (!entry || !entry.count) return;
    var gl = this.gl, programValue = this.lineProgram;
    gl.useProgram(programValue);
    gl.uniformMatrix4fv(gl.getUniformLocation(programValue, "uViewProjection"), false, matrix);
    this.bindAttribute(programValue, "aPosition", entry.buffer, 3, 28, 0);
    this.bindAttribute(programValue, "aColor", entry.buffer, 4, 28, 12);
    gl.drawArrays(gl.LINES, 0, entry.count);
  };
  SpatialRenderer.prototype.render = function () {
    requireValue(this.geometry && this.viewer, "Renderer requires geometry and viewer state");
    var gl = this.gl, viewer = this.viewer, geometry = this.geometry;
    this.resize();
    var background = colourForBackground(viewer.background);
    gl.clearColor(background[0], background[1], background[2], background[3]);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var camera = this.viewProjection();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (viewer.show_grid) this.drawLines(this.lineBuffers.grid, camera.matrix);
    if (viewer.show_axes) this.drawLines(this.lineBuffers.axes, camera.matrix);
    var mesh = this.meshProgram;
    gl.useProgram(mesh);
    gl.uniformMatrix4fv(gl.getUniformLocation(mesh, "uViewProjection"), false, camera.matrix);
    this.bindAttribute(mesh, "aPosition", this.meshBuffers.position, 3);
    this.bindAttribute(mesh, "aNormal", this.meshBuffers.normal, 3);
    this.bindAttribute(mesh, "aBarycentric", this.meshBuffers.barycentric, 3);
    gl.uniform4fv(gl.getUniformLocation(mesh, "uBaseColor"), geometry.material.baseColorFactor);
    gl.uniform1f(gl.getUniformLocation(mesh, "uMetallic"), geometry.material.metallicFactor);
    gl.uniform1f(gl.getUniformLocation(mesh, "uRoughness"), geometry.material.roughnessFactor);
    var azimuth = radians(viewer.light_azimuth_deg), elevation = radians(viewer.light_elevation_deg);
    gl.uniform3fv(gl.getUniformLocation(mesh, "uLightDirection"), [Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth)]);
    gl.uniform1f(gl.getUniformLocation(mesh, "uLightIntensity"), viewer.light_intensity);
    gl.uniform1f(gl.getUniformLocation(mesh, "uAmbient"), viewer.ambient_intensity);
    gl.uniform3fv(gl.getUniformLocation(mesh, "uEye"), camera.eye);
    gl.uniform1i(gl.getUniformLocation(mesh, "uViewMode"), viewer.view_mode === "wireframe" ? 1 : viewer.view_mode === "normals" ? 2 : 0);
    gl.uniform1i(gl.getUniformLocation(mesh, "uRepairNormals"), viewer.normal_policy === "face-repair-diagnostic" ? 1 : 0);
    if (geometry.material.doubleSided) gl.disable(gl.CULL_FACE);
    else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
    gl.drawArrays(gl.TRIANGLES, 0, geometry.vertex_count);
    gl.disable(gl.CULL_FACE);
    if (viewer.show_bounds) this.drawLines(this.lineBuffers.bounds, camera.matrix);
    this.frameCount += 1;
    return this.snapshot();
  };
  SpatialRenderer.prototype.snapshot = function () {
    return {
      renderer_id: "axm-spatial-webgl2-reviewer",
      renderer_version: VERSION,
      backend: "WebGL2",
      webgl2: !!this.gl && !this.contextLost,
      dynamic_frame_observed: this.frameCount > 0,
      frame_count: this.frameCount,
      triangle_count: this.geometry ? this.geometry.triangle_count : 0,
      vertex_count: this.geometry ? this.geometry.vertex_count : 0,
      zero_normal_count: this.geometry ? this.geometry.zero_normal_count : 0,
      bounds: this.geometry ? this.geometry.bounds : null,
      grid_step_metres: this.lineBuffers ? this.lineBuffers.step : null,
      context_lost: this.contextLost
    };
  };

  return { VERSION: VERSION, parseGlb: parseGlb, SpatialRenderer: SpatialRenderer };
});
