(function (global) {
  'use strict';

  const PASS_ID = 'mirrorshift-neon-depth-01';
  const PALETTE = Object.freeze(['#35f2ff', '#7a6cff', '#ff4fbd', '#ffad52', '#f5f7ff']);

  const VERTEX_SHADER = [
    'attribute vec3 aPosition;',
    'attribute vec4 aColor;',
    'uniform vec2 uResolution;',
    'uniform vec2 uOffset;',
    'uniform float uScale;',
    'varying vec4 vColor;',
    'void main(){',
    '  vec2 screen=vec2(aPosition.x*uScale+uOffset.x+aPosition.z*uScale*.16,',
    '                   aPosition.y*uScale+uOffset.y-aPosition.z*uScale*.72);',
    '  vec2 clip=vec2(screen.x/uResolution.x*2.0-1.0,1.0-screen.y/uResolution.y*2.0);',
    '  gl_Position=vec4(clip,clamp(-aPosition.z/256.0,-.9,.9),1.0);',
    '  vColor=aColor;',
    '}'
  ].join('\n');

  const FRAGMENT_SHADER = [
    'precision mediump float;',
    'varying vec4 vColor;',
    'void main(){ gl_FragColor=vColor; }'
  ].join('\n');

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'shader compilation failed';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(gl) {
    const program = gl.createProgram();
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'program linking failed';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  function color(value, alpha) {
    const source = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#f5f7ff';
    return [
      parseInt(source.slice(1, 3), 16) / 255,
      parseInt(source.slice(3, 5), 16) / 255,
      parseInt(source.slice(5, 7), 16) / 255,
      alpha == null ? 1 : alpha
    ];
  }

  function shade(source, factor, alpha) {
    return [
      Math.min(1, source[0] * factor),
      Math.min(1, source[1] * factor),
      Math.min(1, source[2] * factor),
      alpha == null ? source[3] : alpha
    ];
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
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false
      });
      if (!gl) throw new Error('WebGL unavailable');
      program = createProgram(gl);
    } catch (_) {
      canvas.dataset.depthState = 'fallback';
      if (host) {
        host.dataset.depthRenderer = 'canvas-fallback';
        host.dataset.depthPass = PASS_ID;
      }
      return null;
    }

    const buffer = gl.createBuffer();
    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const colorLocation = gl.getAttribLocation(program, 'aColor');
    const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    const offsetLocation = gl.getUniformLocation(program, 'uOffset');
    const scaleLocation = gl.getUniformLocation(program, 'uScale');
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
    }

    function clear() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    function render(state, view) {
      const settingsView = view || {};
      const track = state && state.track;
      if (!track || !Array.isArray(track.points) || !track.points.length) {
        clear();
        return;
      }

      const sourceCanvas = canvas.previousElementSibling;
      const width = sourceCanvas && sourceCanvas.width ? sourceCanvas.width : canvas.clientWidth;
      const height = sourceCanvas && sourceCanvas.height ? sourceCanvas.height : canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
      }

      const vertices = [];
      let primitives = 0;

      function vertex(point, tint) {
        vertices.push(point[0], point[1], point[2], tint[0], tint[1], tint[2], tint[3]);
      }

      function triangle(a, b, c, tint) {
        vertex(a, tint); vertex(b, tint); vertex(c, tint);
      }

      function prism(x, y, z, radius, heightValue, sides, rotation, tint) {
        const base = [];
        const top = [];
        for (let side = 0; side < sides; side += 1) {
          const angle = rotation + side / sides * Math.PI * 2;
          base.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z]);
          top.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z + heightValue]);
        }
        for (let side = 0; side < sides; side += 1) {
          const next = (side + 1) % sides;
          const sideTint = shade(tint, .48 + (side % 3) * .16, tint[3]);
          triangle(base[side], base[next], top[next], sideTint);
          triangle(base[side], top[next], top[side], sideTint);
          triangle([x, y, z + heightValue], top[side], top[next], shade(tint, 1.15, tint[3]));
        }
        primitives += 1;
      }

      function diamond(x, y, z, radius, heightValue, tint) {
        const ring = [[x + radius, y, z + heightValue * .45], [x, y + radius, z + heightValue * .45], [x - radius, y, z + heightValue * .45], [x, y - radius, z + heightValue * .45]];
        const top = [x, y, z + heightValue];
        const bottom = [x, y, z];
        for (let side = 0; side < 4; side += 1) {
          const next = (side + 1) % 4;
          triangle(top, ring[side], ring[next], shade(tint, 1.12, tint[3]));
          triangle(bottom, ring[next], ring[side], shade(tint, .58, tint[3]));
        }
        primitives += 1;
      }

      const points = track.points;
      const pulse = reducedMotion ? 0 : Math.sin(Number(settingsView.frameNow || 0) / 520) * 2.5;
      const roadWidth = Number(track.roadWidth || 100);
      const trackGlow = color((track.theme && track.theme.glow) || PALETTE[0], .78);
      const trackAccent = color((track.theme && track.theme.accent) || PALETTE[2], .72);

      for (let index = 0; index < points.length; index += 24) {
        const previous = points[(index - 2 + points.length) % points.length];
        const next = points[(index + 2) % points.length];
        const dx = next.x - previous.x;
        const dy = next.y - previous.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const normalX = -dy / length;
        const normalY = dx / length;
        [-1, 1].forEach(function (side) {
          const distance = roadWidth * .67;
          const point = points[index];
          const tint = side < 0 ? trackGlow : trackAccent;
          prism(point.x + normalX * distance * side, point.y + normalY * distance * side, 0, 5.5, 24 + (index % 48 ? 8 : 15) + pulse, 5, index * .07, tint);
        });
      }

      (track.landmarks || []).forEach(function (landmark, index) {
        const tint = color(index % 2 ? PALETTE[2] : PALETTE[0], .78);
        if (landmark.type === 'core') {
          prism(landmark.x, landmark.y, 0, 31, 13 + pulse * .35, 8, Math.PI / 8, tint);
          prism(landmark.x, landmark.y, 13, 19, 18, 6, Math.PI / 6, color(PALETTE[1], .8));
          diamond(landmark.x, landmark.y, 31, 10, 24 + pulse, color(PALETTE[4], .86));
          return;
        }
        const angle = Number(landmark.rotation || 0);
        const normalX = Math.cos(angle + Math.PI / 2) * 23;
        const normalY = Math.sin(angle + Math.PI / 2) * 23;
        prism(landmark.x - normalX, landmark.y - normalY, 0, 7, 46 + pulse, 6, angle, tint);
        prism(landmark.x + normalX, landmark.y + normalY, 0, 7, 46 - pulse, 6, angle, color(PALETTE[1], .78));
      });

      (track.hazards || []).forEach(function (hazard, index) {
        diamond(hazard.x, hazard.y, 3, 13, 25 + pulse * (index % 2 ? -1 : 1), color(index % 2 ? PALETTE[3] : PALETTE[2], .72));
      });

      (track.padIndices || []).forEach(function (pointIndex, index) {
        if (index % 2) return;
        const point = points[pointIndex % points.length];
        if (point) diamond(point.x, point.y, 2, 6, 9, color(PALETTE[index % PALETTE.length], .64));
      });

      (settingsView.racers || []).forEach(function (racer, index) {
        const tint = color(racer.color || PALETTE[index % PALETTE.length], .84);
        prism(racer.x, racer.y, 4, 12, 12, 4, Number(racer.heading || 0) + Math.PI / 4, tint);
        prism(racer.x, racer.y, 16, 4, 9 + (reducedMotion ? 0 : Math.sin(Number(settingsView.frameNow || 0) / 180 + index) * 1.4), 4, Number(racer.heading || 0), shade(tint, 1.22, .88));
      });

      const data = new Float32Array(vertices);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(colorLocation);
      gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 28, 12);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(offsetLocation, Number(settingsView.offsetX || 0), Number(settingsView.offsetY || 0));
      gl.uniform1f(scaleLocation, Number(settingsView.scale || 1));
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 7);

      frame += 1;
      const diagnostics = {
        schema: 'axm.mirrorshift-depth-diagnostics/v1',
        passId: PASS_ID,
        renderer: 'raw-webgl',
        projection: 'oblique-low-poly',
        primitives: primitives,
        triangles: data.length / 21,
        frame: frame,
        reducedMotion: reducedMotion,
        changesAuthority: false,
        changesCollision: false
      };
      global.__MIRRORSHIFT_DEPTH__ = diagnostics;
      if (host) {
        host.dataset.depthPrimitives = String(diagnostics.primitives);
        host.dataset.depthTriangles = String(diagnostics.triangles);
        host.dataset.depthFrame = String(diagnostics.frame);
        host.dataset.depthMotion = reducedMotion ? 'reduced-static' : 'live-bounded';
      }
    }

    clear();
    return { clear: clear, render: render, id: PASS_ID };
  }

  global.MirrorShiftDepth = Object.freeze({ create: create, passId: PASS_ID });
})(window);

