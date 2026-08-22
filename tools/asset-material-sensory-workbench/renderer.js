(function (root, factory) {
  "use strict";
  root.AXMMaterialLookdevRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERTEX_SOURCE = "#version 300 es\n" +
    "precision highp float;\n" +
    "in vec3 aPosition; in vec3 aNormal; in vec2 aUv; in vec3 aTangent;\n" +
    "uniform mat4 uProjection; uniform mat4 uView; uniform mat4 uModel; uniform float uTiling;\n" +
    "out vec3 vWorld; out vec3 vNormal; out vec3 vTangent; out vec2 vUv;\n" +
    "void main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vNormal=normalize(mat3(uModel)*aNormal);vTangent=normalize(mat3(uModel)*aTangent);vUv=aUv*uTiling;gl_Position=uProjection*uView*world;}";

  var FRAGMENT_SOURCE = "#version 300 es\n" +
    "precision highp float;\n" +
    "in vec3 vWorld; in vec3 vNormal; in vec3 vTangent; in vec2 vUv; out vec4 outColor;\n" +
    "uniform sampler2D uAlbedo; uniform sampler2D uNormal; uniform sampler2D uOrm; uniform sampler2D uEmissive; uniform sampler2D uHeight;\n" +
    "uniform bool uUseAlbedo; uniform bool uUseNormal; uniform bool uUseOrm; uniform bool uUseEmissive;\n" +
    "uniform int uViewMode; uniform vec3 uCamera; uniform vec3 uLightDir; uniform float uLightIntensity; uniform float uAmbient; uniform float uFill; uniform float uExposure;\n" +
    "vec3 linearToDisplay(vec3 c){c=vec3(1.0)-exp(-max(c,vec3(0.0))*uExposure);return pow(clamp(c,0.0,1.0),vec3(1.0/2.2));}\n" +
    "void main(){\n" +
    " vec4 albedoSample=texture(uAlbedo,vUv); vec3 normalSample=texture(uNormal,vUv).xyz; vec4 ormSample=texture(uOrm,vUv); vec3 emissiveSample=texture(uEmissive,vUv).rgb; float heightSample=texture(uHeight,vUv).r;\n" +
    " if(uViewMode==1){outColor=vec4(pow(max(albedoSample.rgb,vec3(0.0)),vec3(1.0/2.2)),1.0);return;}\n" +
    " if(uViewMode==2){outColor=vec4(normalSample,1.0);return;}\n" +
    " if(uViewMode==3){outColor=vec4(vec3(ormSample.r),1.0);return;}\n" +
    " if(uViewMode==4){outColor=vec4(vec3(ormSample.g),1.0);return;}\n" +
    " if(uViewMode==5){outColor=vec4(vec3(ormSample.b),1.0);return;}\n" +
    " if(uViewMode==6){outColor=vec4(linearToDisplay(emissiveSample),1.0);return;}\n" +
    " if(uViewMode==7){outColor=vec4(vec3(heightSample),1.0);return;}\n" +
    " vec3 base=uUseAlbedo?albedoSample.rgb:vec3(0.52); vec3 N=normalize(vNormal); vec3 T=normalize(vTangent-N*dot(N,vTangent)); vec3 B=normalize(cross(N,T));\n" +
    " if(uUseNormal){vec3 mapped=normalSample*2.0-1.0;N=normalize(mat3(T,B,N)*mapped);}\n" +
    " float ao=uUseOrm?ormSample.r:1.0; float rough=uUseOrm?clamp(ormSample.g,0.04,1.0):0.62; float metal=uUseOrm?ormSample.b:0.0; vec3 emissive=uUseEmissive?emissiveSample:vec3(0.0);\n" +
    " vec3 L=normalize(uLightDir); vec3 V=normalize(uCamera-vWorld); vec3 H=normalize(L+V); float ndl=max(dot(N,L),0.0); float ndh=max(dot(N,H),0.0);\n" +
    " vec3 f0=mix(vec3(0.04),base,metal); float power=mix(120.0,3.0,rough); vec3 spec=f0*pow(ndh,power)*mix(1.8,0.15,rough);\n" +
    " float fill=max(dot(N,normalize(vec3(-L.x,0.35,-L.z))),0.0); vec3 diffuse=base*(1.0-metal)*(uAmbient*ao+ndl*uLightIntensity+fill*uFill); vec3 color=diffuse+spec*uLightIntensity+emissive;\n" +
    " outColor=vec4(linearToDisplay(color),1.0);\n" +
    "}";

  var VIEW_MODES = { lookdev: 0, albedo: 1, normal: 2, ao: 3, roughness: 4, metalness: 5, emissive: 6, height: 7 };
  var MAP_IDS = {
    albedo: "pbr-albedo-map",
    normal: "pbr-normal-map",
    orm: "pbr-orm-map",
    emissive: "pbr-emissive-map",
    height: "pbr-height-map"
  };

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "WebGL shader compilation failed");
    return shader;
  }

  function program(gl) {
    var output = gl.createProgram();
    gl.attachShader(output, compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE));
    gl.attachShader(output, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE));
    gl.linkProgram(output);
    if (!gl.getProgramParameter(output, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(output) || "WebGL program link failed");
    return output;
  }

  function perspective(fov, aspect, near, far) {
    var f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }

  function normalize(v) {
    var length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  }

  function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function lookAt(eye, target, up) {
    var z = normalize(subtract(eye, target)), x = normalize(cross(up, z)), y = cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ]);
  }

  function identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function sphereGeometry(latitudeSegments, longitudeSegments) {
    var positions = [], normals = [], tangents = [], uvs = [], indices = [];
    for (var lat = 0; lat <= latitudeSegments; lat += 1) {
      var v = lat / latitudeSegments, phi = v * Math.PI;
      for (var lon = 0; lon <= longitudeSegments; lon += 1) {
        var u = lon / longitudeSegments, theta = u * Math.PI * 2;
        var x = Math.sin(phi) * Math.sin(theta), y = Math.cos(phi), z = Math.sin(phi) * Math.cos(theta);
        positions.push(x, y, z); normals.push(x, y, z); tangents.push(Math.cos(theta), 0, -Math.sin(theta)); uvs.push(u, v);
      }
    }
    for (lat = 0; lat < latitudeSegments; lat += 1) {
      for (lon = 0; lon < longitudeSegments; lon += 1) {
        var first = lat * (longitudeSegments + 1) + lon, second = first + longitudeSegments + 1;
        indices.push(first, second, first + 1, second, second + 1, first + 1);
      }
    }
    return { positions: positions, normals: normals, tangents: tangents, uvs: uvs, indices: indices };
  }

  function planeGeometry(segments) {
    var positions = [], normals = [], tangents = [], uvs = [], indices = [];
    for (var row = 0; row <= segments; row += 1) {
      var v = row / segments;
      for (var column = 0; column <= segments; column += 1) {
        var u = column / segments;
        positions.push((u - 0.5) * 2, (0.5 - v) * 2, 0); normals.push(0, 0, 1); tangents.push(1, 0, 0); uvs.push(u, v);
      }
    }
    for (row = 0; row < segments; row += 1) {
      for (column = 0; column < segments; column += 1) {
        var first = row * (segments + 1) + column, second = first + segments + 1;
        indices.push(first, second, first + 1, second, second + 1, first + 1);
      }
    }
    return { positions: positions, normals: normals, tangents: tangents, uvs: uvs, indices: indices };
  }

  function createMesh(gl, source, locations) {
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    function attribute(name, values, size) {
      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(locations[name]);
      gl.vertexAttribPointer(locations[name], size, gl.FLOAT, false, 0, 0);
    }
    attribute("aPosition", source.positions, 3);
    attribute("aNormal", source.normals, 3);
    attribute("aUv", source.uvs, 2);
    attribute("aTangent", source.tangents, 3);
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(source.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao: vao, count: source.indices.length };
  }

  function backgroundColor(name) {
    if (name === "studio-light") return [0.72, 0.75, 0.78, 1];
    if (name === "neutral-gray") return [0.18, 0.19, 0.2, 1];
    if (name === "black") return [0, 0, 0, 1];
    return [0.018, 0.026, 0.04, 1];
  }

  async function bytesFromDataUrl(dataUrl) {
    var match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
    if (!match) throw new Error("Unable to decode material PNG data URL");
    var binary = atob(match[1]), bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }

  async function sha256Hex(arrayBuffer) {
    var hash = await crypto.subtle.digest("SHA-256", arrayBuffer);
    return Array.from(new Uint8Array(hash), function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
  }

  function sameJson(a, b) {
    function stableJson(value) {
      if (Array.isArray(value)) return value.map(stableJson);
      if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(function (key) { return [key, stableJson(value[key])]; }));
      return value;
    }
    return JSON.stringify(stableJson(a)) === JSON.stringify(stableJson(b));
  }

  async function verifyCandidate(result, handoff) {
    if (!result || !handoff || handoff.status !== "PASS" || result.digest !== handoff.result_digest) throw new Error("Material result/handoff binding failed");
    var checks = [];
    for (var index = 0; index < handoff.pngs.length; index += 1) {
      var png = handoff.pngs[index], artifact = result.artifacts.find(function (item) { return item.id === png.id; });
      if (!artifact || !artifact.metadata || !sameJson(artifact.metadata.sampling, png.sampling)) throw new Error(png.id + " sampling contract mismatch");
      var buffer = await bytesFromDataUrl(artifact.dataUrl), actual = await sha256Hex(buffer), expected = handoff.png_sha256[png.id];
      if (actual !== expected) throw new Error(png.id + " full SHA-256 mismatch");
      checks.push({ id: png.id, sha256: actual, bytes: buffer.byteLength, sampling: png.sampling, arrayBuffer: buffer });
    }
    return checks;
  }

  function LookdevRenderer(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.available = !!this.gl;
    this.reason = this.available ? null : "WebGL2 is unavailable";
    this.cache = new Map();
    this.activeKey = null;
    this.frameCount = 0;
    this.lastStats = { frames: 0, triangles: 0, width: 0, height: 0 };
    if (!this.available) return;
    var gl = this.gl;
    this.program = program(gl);
    this.attributes = {
      aPosition: gl.getAttribLocation(this.program, "aPosition"),
      aNormal: gl.getAttribLocation(this.program, "aNormal"),
      aUv: gl.getAttribLocation(this.program, "aUv"),
      aTangent: gl.getAttribLocation(this.program, "aTangent")
    };
    this.uniforms = {};
    ["uProjection", "uView", "uModel", "uTiling", "uAlbedo", "uNormal", "uOrm", "uEmissive", "uHeight", "uUseAlbedo", "uUseNormal", "uUseOrm", "uUseEmissive", "uViewMode", "uCamera", "uLightDir", "uLightIntensity", "uAmbient", "uFill", "uExposure"].forEach(function (name) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }, this);
    this.meshes = {
      sphere: createMesh(gl, sphereGeometry(48, 64), this.attributes),
      plane: createMesh(gl, planeGeometry(32), this.attributes)
    };
    gl.useProgram(this.program);
    gl.uniform1i(this.uniforms.uAlbedo, 0);
    gl.uniform1i(this.uniforms.uNormal, 1);
    gl.uniform1i(this.uniforms.uOrm, 2);
    gl.uniform1i(this.uniforms.uEmissive, 3);
    gl.uniform1i(this.uniforms.uHeight, 4);
  }

  LookdevRenderer.prototype.uploadTexture = async function (artifact, pngRecord, buffer) {
    var gl = this.gl;
    var bitmap = await createImageBitmap(new Blob([buffer], { type: "image/png" }));
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    var colour = pngRecord.sampling.interpretation === "colour" && pngRecord.sampling.transfer_function === "srgb";
    gl.texImage2D(gl.TEXTURE_2D, 0, colour ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    var wrap = pngRecord.sampling.wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    bitmap.close();
    return texture;
  };

  LookdevRenderer.prototype.loadCandidate = async function (key, result, handoff) {
    if (!this.available) throw new Error(this.reason);
    if (this.cache.has(key)) { this.activeKey = key; return this.cache.get(key); }
    var verified = await verifyCandidate(result, handoff), textures = {};
    for (var name of Object.keys(MAP_IDS)) {
      var id = MAP_IDS[name], record = handoff.pngs.find(function (item) { return item.id === id; });
      var artifact = result.artifacts.find(function (item) { return item.id === id; });
      var check = verified.find(function (item) { return item.id === id; });
      textures[name] = await this.uploadTexture(artifact, record, check.arrayBuffer);
    }
    var entry = { key: key, resultDigest: result.digest, handoff: handoff, textures: textures, verified: verified.map(function (item) { return { id: item.id, sha256: item.sha256, bytes: item.bytes, sampling: item.sampling }; }) };
    this.cache.set(key, entry);
    this.activeKey = key;
    return entry;
  };

  LookdevRenderer.prototype.selectCandidate = function (key) {
    if (!this.cache.has(key)) throw new Error("Material candidate is not loaded: " + key);
    this.activeKey = key;
  };

  LookdevRenderer.prototype.dropCandidate = function (key) {
    var entry = this.cache.get(key);
    if (!entry || !this.available) return;
    Object.keys(entry.textures).forEach(function (name) { this.gl.deleteTexture(entry.textures[name]); }, this);
    this.cache.delete(key);
    if (this.activeKey === key) this.activeKey = null;
  };

  LookdevRenderer.prototype.resize = function () {
    if (!this.available) return;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.max(1, Math.round(this.canvas.clientWidth * ratio)), height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.gl.viewport(0, 0, width, height);
  };

  LookdevRenderer.prototype.render = function (viewer) {
    if (!this.available || !this.activeKey) return null;
    var entry = this.cache.get(this.activeKey);
    if (!entry) return null;
    this.resize();
    var gl = this.gl, u = this.uniforms, mesh = this.meshes[viewer.geometry] || this.meshes.sphere;
    var background = backgroundColor(viewer.background);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(background[0], background[1], background[2], background[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    var orbit = viewer.orbit_deg * Math.PI / 180, pitch = viewer.pitch_deg * Math.PI / 180, distance = viewer.zoom;
    var eye = [Math.sin(orbit) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, Math.cos(orbit) * Math.cos(pitch) * distance];
    var azimuth = viewer.light_azimuth_deg * Math.PI / 180, elevation = viewer.light_elevation_deg * Math.PI / 180;
    var light = [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)];
    gl.uniformMatrix4fv(u.uProjection, false, perspective(44 * Math.PI / 180, this.canvas.width / this.canvas.height, 0.05, 50));
    gl.uniformMatrix4fv(u.uView, false, lookAt(eye, [0, 0, 0], [0, 1, 0]));
    gl.uniformMatrix4fv(u.uModel, false, identity());
    gl.uniform1f(u.uTiling, viewer.uv_tiling);
    gl.uniform3fv(u.uCamera, new Float32Array(eye));
    gl.uniform3fv(u.uLightDir, new Float32Array(light));
    gl.uniform1f(u.uLightIntensity, viewer.light_intensity);
    gl.uniform1f(u.uAmbient, viewer.ambient_intensity);
    gl.uniform1f(u.uFill, viewer.fill_intensity);
    gl.uniform1f(u.uExposure, viewer.exposure);
    gl.uniform1i(u.uUseAlbedo, viewer.albedo_enabled ? 1 : 0);
    gl.uniform1i(u.uUseNormal, viewer.normal_enabled ? 1 : 0);
    gl.uniform1i(u.uUseOrm, viewer.orm_enabled ? 1 : 0);
    gl.uniform1i(u.uUseEmissive, viewer.emissive_enabled ? 1 : 0);
    gl.uniform1i(u.uViewMode, VIEW_MODES[viewer.view_mode] == null ? 0 : VIEW_MODES[viewer.view_mode]);
    ["albedo", "normal", "orm", "emissive", "height"].forEach(function (name, index) {
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, entry.textures[name]);
    });
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    this.frameCount += 1;
    this.lastStats = { frames: this.frameCount, triangles: mesh.count / 3, width: this.canvas.width, height: this.canvas.height, geometry: viewer.geometry, viewMode: viewer.view_mode, resultDigest: entry.resultDigest };
    return this.lastStats;
  };

  LookdevRenderer.prototype.info = function () {
    if (!this.available) return { available: false, reason: this.reason };
    var gl = this.gl;
    return {
      available: true,
      id: "axm-material-lookdev-webgl2",
      version: "0.1.0",
      api: gl.getParameter(gl.VERSION),
      shading_language: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      target_renderer_parity: false,
      ibl: false,
      height_displacement: false
    };
  };

  LookdevRenderer.prototype.frameProof = function () {
    if (!this.available) throw new Error(this.reason);
    return this.canvas.toDataURL("image/png");
  };

  return {
    LookdevRenderer: LookdevRenderer,
    verifyCandidate: verifyCandidate,
    bytesFromDataUrl: bytesFromDataUrl,
    sha256Hex: sha256Hex,
    MAP_IDS: Object.assign({}, MAP_IDS),
    VIEW_MODES: Object.assign({}, VIEW_MODES)
  };
});
