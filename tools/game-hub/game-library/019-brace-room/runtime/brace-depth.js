(function (global) {
  'use strict';

  var PASS_ID = 'brace-room-station-depth-01';
  var WIDTH = 640;
  var HEIGHT = 640;

  var vertexSource = [
    'attribute vec3 aPosition;',
    'attribute vec4 aColor;',
    'uniform vec2 uResolution;',
    'varying vec4 vColor;',
    'void main(){',
    '  vec2 projected=vec2(aPosition.x+aPosition.z*.24,aPosition.y-aPosition.z*.68);',
    '  vec2 clip=(projected/uResolution)*2.0-1.0;',
    '  float depth=((aPosition.y-aPosition.z*.22)/uResolution.y)*1.65-0.72;',
    '  gl_Position=vec4(clip.x,-clip.y,depth,1.0);',
    '  vColor=aColor;',
    '}'
  ].join('\n');

  var fragmentSource = [
    'precision mediump float;',
    'varying vec4 vColor;',
    'void main(){ gl_FragColor=vColor; }'
  ].join('\n');

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Brace depth shader compilation failed.');
    return shader;
  }

  function buildProgram(gl) {
    var program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Brace depth program link failed.');
    return program;
  }

  function rgba(hex, alpha, shade) {
    var value = parseInt(String(hex || '#4f8bff').replace('#', ''), 16);
    var amount = shade == null ? 1 : shade;
    return [((value >> 16) & 255) / 255 * amount, ((value >> 8) & 255) / 255 * amount, (value & 255) / 255 * amount, alpha == null ? 1 : alpha];
  }

  function pushVertex(out, point, color) {
    out.push(point[0], point[1], point[2], color[0], color[1], color[2], color[3]);
  }

  function triangle(out, a, b, c, color) {
    pushVertex(out, a, color);
    pushVertex(out, b, color);
    pushVertex(out, c, color);
  }

  function prism(out, receipt, cx, cy, radius, sides, height, hex, alpha, rotation) {
    var top = rgba(hex, alpha, 1.05);
    var sideA = rgba(hex, alpha * .88, .56);
    var sideB = rgba(hex, alpha * .88, .72);
    var points = [];
    var angleOffset = rotation || 0;
    for (var index = 0; index < sides; index += 1) {
      var angle = angleOffset + index / sides * Math.PI * 2;
      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 0]);
    }
    for (var topIndex = 1; topIndex < sides - 1; topIndex += 1) {
      triangle(out, [cx, cy, height], [points[topIndex][0], points[topIndex][1], height], [points[topIndex + 1][0], points[topIndex + 1][1], height], top);
    }
    for (var sideIndex = 0; sideIndex < sides; sideIndex += 1) {
      var next = (sideIndex + 1) % sides;
      var a = points[sideIndex];
      var b = points[next];
      var upperA = [a[0], a[1], height];
      var upperB = [b[0], b[1], height];
      var sideColor = sideIndex % 2 ? sideA : sideB;
      triangle(out, a, b, upperB, sideColor);
      triangle(out, a, upperB, upperA, sideColor);
    }
    receipt.primitives += 1;
  }

  function annulus(out, receipt, cx, cy, inner, outer, segments, height, hex, alpha, phase) {
    var top = rgba(hex, alpha, 1.08);
    var side = rgba(hex, alpha * .72, .55);
    var offset = phase || 0;
    for (var index = 0; index < segments; index += 1) {
      var a = offset + index / segments * Math.PI * 2;
      var b = offset + (index + 1) / segments * Math.PI * 2;
      var oi = [cx + Math.cos(a) * outer, cy + Math.sin(a) * outer, height];
      var on = [cx + Math.cos(b) * outer, cy + Math.sin(b) * outer, height];
      var ii = [cx + Math.cos(a) * inner, cy + Math.sin(a) * inner, height];
      var inn = [cx + Math.cos(b) * inner, cy + Math.sin(b) * inner, height];
      triangle(out, ii, oi, on, top);
      triangle(out, ii, on, inn, top);
      var baseOuterA = [oi[0], oi[1], 0];
      var baseOuterB = [on[0], on[1], 0];
      triangle(out, baseOuterA, baseOuterB, on, side);
      triangle(out, baseOuterA, on, oi, side);
    }
    receipt.primitives += 1;
  }

  function stationSides(verb) {
    if (verb === 'hold') return 3;
    if (verb === 'rhythm') return 4;
    if (verb === 'twohold') return 12;
    return 4;
  }

  function stationRotation(verb) {
    return verb === 'rhythm' ? Math.PI / 4 : verb === 'hold' ? -Math.PI / 2 : Math.PI / 4;
  }

  function create(canvas) {
    var gl;
    var api;
    try {
      gl = canvas && canvas.getContext('webgl', { alpha: true, antialias: false, depth: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error('WebGL unavailable');
      var program = buildProgram(gl);
      var buffer = gl.createBuffer();
      var position = gl.getAttribLocation(program, 'aPosition');
      var color = gl.getAttribLocation(program, 'aColor');
      var resolution = gl.getUniformLocation(program, 'uResolution');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      canvas.dataset.renderer = 'raw-webgl';
      canvas.dataset.pass = PASS_ID;
      canvas.dataset.authority = 'canvas2d-gameplay';
      canvas.dataset.changesAuthority = 'false';
      canvas.dataset.changesCollision = 'false';
      canvas.dataset.fallback = 'canvas2d';
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);

      function clear() {
        gl.viewport(0, 0, WIDTH, HEIGHT);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      }

      function draw(view) {
        clear();
        view = view || {};
        var highContrast = Boolean(view.highContrast);
        canvas.dataset.highContrastPolicy = highContrast ? 'hidden-canvas2d-only' : 'hybrid-3d';
        canvas.dataset.motion = view.reducedMotion ? 'reduced-static' : 'animated';
        if (highContrast || !view.state) {
          canvas.dataset.primitives = '0';
          canvas.dataset.triangles = '0';
          canvas.dataset.stations = '0';
          canvas.dataset.players = '0';
          canvas.dataset.faults = '0';
          return;
        }
        var state = view.state;
        var now = Number(view.now) || 0;
        var t = view.reducedMotion ? 0 : now * .001;
        var vertices = [];
        var receipt = { primitives: 0 };
        var hull = Math.max(0, Math.min(100, Number(state.hull) || 0));
        var hullHex = hull <= 30 ? '#ff4d5e' : hull <= 60 ? '#f5c542' : '#35e58c';
        prism(vertices, receipt, 320, 320, 64, 16, 12, '#14233a', .72, Math.PI / 16);
        annulus(vertices, receipt, 320, 320, 67, 75, 28, 14, hullHex, .62, -Math.PI / 2);
        prism(vertices, receipt, 320, 320, 18, 8, 30 + (view.reducedMotion ? 0 : Math.sin(t * 1.7) * 2), hullHex, .52, Math.PI / 8);

        var stations = Array.isArray(view.stations) ? view.stations : [];
        var faults = Array.isArray(state.faults) ? state.faults : [];
        stations.forEach(function (station, index) {
          var fault = faults.find(function (candidate) { return candidate.stationId === station.id; });
          var sides = stationSides(station.verb);
          var height = fault ? 24 + (view.reducedMotion ? 0 : Math.sin(t * 3.1 + index) * 3) : 15;
          var stationColor = fault ? (fault.kind === 'false' ? '#7f91ad' : '#f5c542') : '#4f8bff';
          prism(vertices, receipt, station.x, station.y, 25, sides, height, stationColor, fault ? .7 : .44, stationRotation(station.verb));
          prism(vertices, receipt, station.x, station.y, 9, Math.max(4, sides), height + 10, fault ? '#eaf2ff' : '#6fa4ff', fault ? .62 : .34, stationRotation(station.verb));
          if (fault) annulus(vertices, receipt, station.x, station.y, 34, 39, 20, height + 4, stationColor, .62, t * .14 + index);
        });

        var activePlayers = [];
        var playerColors = { p1: '#1ed6d9', p2: '#ffcc4d', p3: '#e780ff', p4: '#ff6e83' };
        Object.keys(state.players || {}).forEach(function (id, index) {
          if (index >= state.playerCount) return;
          var player = state.players[id];
          activePlayers.push(player);
          var bob = view.reducedMotion ? 0 : Math.sin(t * 4 + index * 1.8) * 2;
          prism(vertices, receipt, player.x, player.y, 14, 8, 24 + bob, playerColors[id] || '#ffffff', .76, Math.PI / 8);
          prism(vertices, receipt, player.x, player.y, 6, 6, 34 + bob, '#eaf2ff', .66, 0);
        });

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 28, 0);
        gl.enableVertexAttribArray(color);
        gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 28, 12);
        gl.uniform2f(resolution, WIDTH, HEIGHT);
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 7);
        canvas.dataset.primitives = String(receipt.primitives);
        canvas.dataset.triangles = String(vertices.length / 21);
        canvas.dataset.stations = String(stations.length);
        canvas.dataset.players = String(activePlayers.length);
        canvas.dataset.faults = String(faults.length);
        canvas.dataset.frame = String((Number(canvas.dataset.frame) || 0) + 1);
      }

      api = { draw: draw, clear: clear, renderer: 'raw-webgl', pass: PASS_ID };
    } catch (error) {
      if (canvas) {
        canvas.hidden = true;
        canvas.dataset.renderer = 'canvas2d-fallback';
        canvas.dataset.pass = PASS_ID;
        canvas.dataset.fallbackReason = String(error && error.message || error);
      }
      api = { draw: function () {}, clear: function () {}, renderer: 'canvas2d-fallback', pass: PASS_ID };
    }
    return api;
  }

  global.AXMBraceDepth = Object.freeze({ create: create, PASS_ID: PASS_ID });
})(window);
