(function (global) {
  'use strict';

  const PASS_ID = 'neverafter-rooftop-depth-01';
  const PALETTE = Object.freeze(['#75ffd1', '#b27cff', '#ff9a3d', '#ffe2a8', '#69d8ff', '#ff657d']);
  const VERTEX_SOURCE = [
    'attribute vec3 aPosition;',
    'attribute vec4 aColor;',
    'uniform vec2 uResolution;',
    'uniform vec2 uCamera;',
    'uniform float uZoom;',
    'uniform float uShake;',
    'varying vec4 vColor;',
    'void main(){',
    '  vec2 screen=vec2((aPosition.x-uCamera.x)*uZoom+uResolution.x*.5+aPosition.z*uZoom*.16+uShake,',
    '                   (aPosition.y-uCamera.y)*uZoom+uResolution.y*.5-aPosition.z*uZoom*.74+uShake);',
    '  vec2 clip=vec2(screen.x/uResolution.x*2.0-1.0,1.0-screen.y/uResolution.y*2.0);',
    '  gl_Position=vec4(clip,clamp(-aPosition.z/256.0,-.9,.9),1.0);',
    '  vColor=aColor;',
    '}'
  ].join('\n');
  const FRAGMENT_SOURCE = 'precision mediump float; varying vec4 vColor; void main(){gl_FragColor=vColor;}';

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'shader compile failed';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function programFor(gl) {
    const program = gl.createProgram();
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'program link failed';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  function tint(value, alpha) {
    const source = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : PALETTE[0];
    return [parseInt(source.slice(1, 3), 16) / 255, parseInt(source.slice(3, 5), 16) / 255, parseInt(source.slice(5, 7), 16) / 255, alpha == null ? 1 : alpha];
  }

  function shade(source, factor, alpha) {
    return [Math.min(1, source[0] * factor), Math.min(1, source[1] * factor), Math.min(1, source[2] * factor), alpha == null ? source[3] : alpha];
  }

  function create(options) {
    const settings = options || {};
    const canvas = settings.canvas;
    const host = settings.host;
    const reducedMotion = Boolean(settings.reducedMotion);
    if (!canvas) return null;

    let gl;
    let program;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: true, premultipliedAlpha: false });
      if (!gl) throw new Error('WebGL unavailable');
      program = programFor(gl);
    } catch (_) {
      canvas.dataset.depthState = 'fallback';
      if (host) { host.dataset.depthRenderer = 'canvas-fallback'; host.dataset.depthPass = PASS_ID; }
      return null;
    }

    const buffer = gl.createBuffer();
    const position = gl.getAttribLocation(program, 'aPosition');
    const color = gl.getAttribLocation(program, 'aColor');
    const resolution = gl.getUniformLocation(program, 'uResolution');
    const camera = gl.getUniformLocation(program, 'uCamera');
    const zoom = gl.getUniformLocation(program, 'uZoom');
    const shake = gl.getUniformLocation(program, 'uShake');
    let frame = 0;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    canvas.dataset.depthState = 'webgl';
    if (host) {
      host.dataset.depthRenderer = 'raw-webgl';
      host.dataset.depthPass = PASS_ID;
      host.dataset.depthMotion = reducedMotion ? 'reduced-static' : 'live-bounded';
      host.dataset.depthFogPolicy = 'visible-territory-only';
    }

    function clear() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    function render(scene, view) {
      const world = scene || {};
      const cameraView = view || {};
      const width = Math.max(1, Math.round(Number(cameraView.width || canvas.clientWidth || 1)));
      const height = Math.max(1, Math.round(Number(cameraView.height || canvas.clientHeight || 1)));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const vertices = [];
      let primitives = 0;

      function vertex(point, colorValue) { vertices.push(point[0], point[1], point[2], colorValue[0], colorValue[1], colorValue[2], colorValue[3]); }
      function triangle(a, b, c, colorValue) { vertex(a, colorValue); vertex(b, colorValue); vertex(c, colorValue); }

      function prism(x, y, z, radius, heightValue, sides, rotation, yScale, colorValue, topAlpha) {
        const base = [];
        const top = [];
        for (let side = 0; side < sides; side += 1) {
          const angle = rotation + side / sides * Math.PI * 2;
          base.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * yScale, z]);
          top.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * yScale, z + heightValue]);
        }
        for (let side = 0; side < sides; side += 1) {
          const next = (side + 1) % sides;
          const sideColor = shade(colorValue, .52 + (side % 4) * .12, colorValue[3]);
          triangle(base[side], base[next], top[next], sideColor);
          triangle(base[side], top[next], top[side], sideColor);
          triangle([x, y, z + heightValue], top[side], top[next], shade(colorValue, 1.12, topAlpha));
        }
        primitives += 1;
      }

      function segmentBox(a, b, lateral, widthValue, z, heightValue, colorValue) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / length;
        const ny = dx / length;
        const x1 = a.x + nx * lateral;
        const y1 = a.y + ny * lateral;
        const x2 = b.x + nx * lateral;
        const y2 = b.y + ny * lateral;
        const half = widthValue * .5;
        const base = [[x1 + nx * half, y1 + ny * half, z], [x2 + nx * half, y2 + ny * half, z], [x2 - nx * half, y2 - ny * half, z], [x1 - nx * half, y1 - ny * half, z]];
        const top = base.map(function (point) { return [point[0], point[1], point[2] + heightValue]; });
        for (let side = 0; side < 4; side += 1) {
          const next = (side + 1) % 4;
          triangle(base[side], base[next], top[next], shade(colorValue, .58 + side * .1, colorValue[3]));
          triangle(base[side], top[next], top[side], shade(colorValue, .58 + side * .1, colorValue[3]));
        }
        triangle(top[0], top[1], top[2], shade(colorValue, 1.16, colorValue[3]));
        triangle(top[0], top[2], top[3], shade(colorValue, 1.16, colorValue[3]));
        primitives += 1;
      }

      const anchors = world.anchors || [];
      const visibleByIndex = new Map();
      anchors.forEach(function (anchor) { if (anchor.visible) visibleByIndex.set(anchor.index, anchor); });
      const mapTint = tint(world.mapColor || PALETTE[1], .46);
      const pulse = reducedMotion ? 0 : Math.sin(Number(world.elapsed || 0) * 2.1) * 1.5;

      (world.links || []).forEach(function (pair, index) {
        const a = visibleByIndex.get(pair[0]);
        const b = visibleByIndex.get(pair[1]);
        if (!a || !b) return;
        const railTint = tint(index % 2 ? PALETTE[1] : PALETTE[4], .58);
        segmentBox(a, b, -15, 4.5, 2, 13 + pulse, railTint);
        segmentBox(a, b, 15, 4.5, 2, 13 - pulse, railTint);
      });

      visibleByIndex.forEach(function (anchor, index) {
        prism(anchor.x, anchor.y, 0, Number(anchor.radius || 94) * .94, 13 + (index % 3) * 3, 9, (index % 3 - .5) * .08, .72, mapTint, .16);
        prism(anchor.x, anchor.y, 12 + (index % 3) * 3, 8, 13 + pulse, 6, index * .2, 1, tint(index % 2 ? PALETTE[2] : PALETTE[0], .46), .34);
        for (let corner = 0; corner < 3; corner += 1) {
          const angle = corner / 3 * Math.PI * 2 + index * .41;
          const distance = Number(anchor.radius || 94) * .66;
          prism(anchor.x + Math.cos(angle) * distance, anchor.y + Math.sin(angle) * distance * .72, 10, 4.5, 20 + corner * 3 + pulse, 5, angle, 1, tint(PALETTE[(index + corner) % PALETTE.length], .68), .62);
        }
      });

      (world.buildings || []).forEach(function (building, index) {
        const progress = Math.max(.25, Math.min(1, Number(building.progress || 0)));
        const radius = building.kind === 'command' ? 27 : building.kind === 'wonderwork' ? 23 : 16;
        const heightValue = (building.kind === 'command' ? 42 : building.kind === 'wonderwork' ? 52 : 27) * progress;
        prism(building.x, building.y, 8, radius * progress, heightValue, building.kind === 'wonderwork' ? 6 : 5, index * .31, .86, tint(building.color, .68), .52);
      });

      (world.squads || []).forEach(function (squad, index) {
        const scale = Math.max(.72, Math.min(1.2, Number(squad.members || 8) / 12));
        const heightValue = (squad.selected ? 25 : 17) + pulse * (index % 2 ? -1 : 1);
        prism(squad.x, squad.y, 5, 7 * scale, heightValue, 4, Math.PI / 4, 1, tint(squad.color, squad.selected ? .84 : .66), squad.selected ? .76 : .56);
      });

      const data = new Float32Array(vertices);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(color);
      gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 28, 12);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform2f(camera, Number(cameraView.cameraX || 0), Number(cameraView.cameraY || 0));
      gl.uniform1f(zoom, Number(cameraView.zoom || 1));
      gl.uniform1f(shake, Number(cameraView.shake || 0));
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 7);

      frame += 1;
      const diagnostics = {
        schema: 'axm.hexbound-depth-diagnostics/v1',
        passId: PASS_ID,
        renderer: 'raw-webgl',
        projection: 'camera-registered-oblique-low-poly',
        visibleAnchors: visibleByIndex.size,
        primitives: primitives,
        triangles: data.length / 21,
        frame: frame,
        fogPolicy: 'visible-territory-only',
        reducedMotion: reducedMotion,
        changesAuthority: false,
        changesCollision: false
      };
      global.__HEXBOUND_DEPTH__ = diagnostics;
      if (host) {
        host.dataset.depthVisibleAnchors = String(diagnostics.visibleAnchors);
        host.dataset.depthPrimitives = String(diagnostics.primitives);
        host.dataset.depthTriangles = String(diagnostics.triangles);
        host.dataset.depthFrame = String(diagnostics.frame);
      }
    }

    clear();
    return { id: PASS_ID, clear: clear, render: render };
  }

  global.HexboundDepth = Object.freeze({ passId: PASS_ID, create: create });
})(window);
