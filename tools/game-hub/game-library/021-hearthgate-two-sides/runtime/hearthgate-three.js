(function () {
  'use strict';

  const VERTEX_SHADER = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uMvp;
    uniform mat4 uModel;
    varying vec3 vNormal;
    void main() {
      gl_Position = uMvp * vec4(aPosition, 1.0);
      vNormal = mat3(uModel) * aNormal;
    }
  `;
  const FRAGMENT_SHADER = `
    precision mediump float;
    uniform vec3 uColor;
    uniform vec3 uLight;
    varying vec3 vNormal;
    void main() {
      float diffuse = max(0.0, dot(normalize(vNormal), normalize(uLight)));
      float shade = 0.48 + diffuse * 0.52;
      vec3 lit = clamp(uColor * shade, 0.0, 1.0);
      vec3 quantized = floor(lit * 15.0 + 0.5) / 15.0;
      gl_FragColor = vec4(quantized, 1.0);
    }
  `;

  const CUBE = new Float32Array([
    -1,-1, 1, 0,0,1,  1,-1, 1, 0,0,1,  1, 1, 1, 0,0,1, -1,-1, 1, 0,0,1,  1, 1, 1, 0,0,1, -1, 1, 1, 0,0,1,
     1,-1,-1, 0,0,-1, -1,-1,-1, 0,0,-1, -1, 1,-1, 0,0,-1, 1,-1,-1, 0,0,-1, -1, 1,-1, 0,0,-1, 1, 1,-1, 0,0,-1,
    -1,-1,-1,-1,0,0, -1,-1, 1,-1,0,0, -1, 1, 1,-1,0,0, -1,-1,-1,-1,0,0, -1, 1, 1,-1,0,0, -1, 1,-1,-1,0,0,
     1,-1, 1, 1,0,0,  1,-1,-1, 1,0,0,  1, 1,-1, 1,0,0,  1,-1, 1, 1,0,0,  1, 1,-1, 1,0,0,  1, 1, 1, 1,0,0,
    -1, 1, 1, 0,1,0,  1, 1, 1, 0,1,0,  1, 1,-1, 0,1,0, -1, 1, 1, 0,1,0,  1, 1,-1, 0,1,0, -1, 1,-1, 0,1,0,
    -1,-1,-1, 0,-1,0, 1,-1,-1, 0,-1,0, 1,-1, 1, 0,-1,0, -1,-1,-1, 0,-1,0, 1,-1, 1, 0,-1,0, -1,-1, 1, 0,-1,0
  ]);

  function facetedVertices(points, faces) {
    const values = [];
    faces.forEach(face => {
      const a = points[face[0]], b = points[face[1]], c = points[face[2]];
      const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
      const ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
      const normal = normalize([
        ab[1]*ac[2]-ab[2]*ac[1],
        ab[2]*ac[0]-ab[0]*ac[2],
        ab[0]*ac[1]-ab[1]*ac[0]
      ]);
      [a,b,c].forEach(point => values.push(point[0],point[1],point[2],normal[0],normal[1],normal[2]));
    });
    return new Float32Array(values);
  }

  const OCTAHEDRON = facetedVertices(
    [[0,1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,-1,0]],
    [[0,2,1],[0,3,2],[0,4,3],[0,1,4],[5,1,2],[5,2,3],[5,3,4],[5,4,1]]
  );
  const PYRAMID = facetedVertices(
    [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,1,0]],
    [[0,2,1],[0,3,2],[0,1,4],[1,2,4],[2,3,4],[3,0,4]]
  );

  function ringVertices(segments) {
    const values = [];
    for (let index = 0; index < segments; index += 1) {
      const a = index / segments * Math.PI * 2;
      const b = (index + 1) / segments * Math.PI * 2;
      const inner = 0.78;
      [[Math.cos(a)*inner,Math.sin(a)*inner],[Math.cos(a),Math.sin(a)],[Math.cos(b),Math.sin(b)],
       [Math.cos(a)*inner,Math.sin(a)*inner],[Math.cos(b),Math.sin(b)],[Math.cos(b)*inner,Math.sin(b)*inner]].forEach(point => {
        values.push(point[0], 0, point[1], 0, 1, 0);
      });
    }
    return new Float32Array(values);
  }

  function identity() {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  }

  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  }

  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const range = 1 / (near - far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(near+far)*range,-1, 0,0,near*far*2*range,0]);
  }

  function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return vector.map(value => value / length);
  }

  function lookAt(eye, center, up) {
    const z = normalize([eye[0]-center[0], eye[1]-center[1], eye[2]-center[2]]);
    const x = normalize([up[1]*z[2]-up[2]*z[1], up[2]*z[0]-up[0]*z[2], up[0]*z[1]-up[1]*z[0]]);
    const y = [z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];
    return new Float32Array([
      x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]), -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]), -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]), 1
    ]);
  }

  function modelMatrix(x, y, z, sx, sy, sz, yaw) {
    const cosine = Math.cos(yaw || 0), sine = Math.sin(yaw || 0);
    return new Float32Array([
      cosine*sx,0,-sine*sx,0, 0,sy,0,0, sine*sz,0,cosine*sz,0, x,y,z,1
    ]);
  }

  function hexColor(value) {
    const text = String(value || '#d98959').replace('#', '');
    const full = text.length === 3 ? text.split('').map(char => char + char).join('') : text.padEnd(6, '0');
    return [parseInt(full.slice(0,2),16)/255, parseInt(full.slice(2,4),16)/255, parseInt(full.slice(4,6),16)/255];
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'shader compile failed');
    return shader;
  }

  function createProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'shader link failed');
    return program;
  }

  function worldX(x) { return (Number(x) - 480) / 70; }
  function worldZ(y) { return (Number(y) - 270) / 55; }

  function create(canvas) {
    const gl = canvas && (canvas.getContext('webgl', { antialias: false, alpha: false, depth: true }) || canvas.getContext('experimental-webgl'));
    if (!gl) {
      if (canvas) canvas.dataset.status = 'fallback-canvas-authority';
      return { available: false, render: function () {} };
    }
    const program = createProgram(gl);
    const cubeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, CUBE, gl.STATIC_DRAW);
    const ring = ringVertices(16);
    const ringBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, ring, gl.STATIC_DRAW);
    const octaBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, octaBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, OCTAHEDRON, gl.STATIC_DRAW);
    const pyramidBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pyramidBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, PYRAMID, gl.STATIC_DRAW);
    const locations = {
      position: gl.getAttribLocation(program, 'aPosition'), normal: gl.getAttribLocation(program, 'aNormal'),
      mvp: gl.getUniformLocation(program, 'uMvp'), model: gl.getUniformLocation(program, 'uModel'),
      color: gl.getUniformLocation(program, 'uColor'), light: gl.getUniformLocation(program, 'uLight')
    };
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.uniform3f(locations.light, -0.35, 0.9, 0.42);
    canvas.dataset.status = 'active';
    canvas.dataset.renderer = 'webgl-low-poly';
    canvas.dataset.paletteSteps = '16';
    canvas.dataset.modelProfile = 'faceted-models-v1';

    let viewProjection = identity();
    let drawCalls = 0;
    let triangles = 0;
    let frameCount = 0;
    function bind(buffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(locations.position);
      gl.enableVertexAttribArray(locations.normal);
      gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 24, 12);
    }
    function drawMesh(buffer, count, x, y, z, sx, sy, sz, color, yaw) {
      const model = modelMatrix(x, y, z, sx, sy, sz, yaw);
      gl.uniformMatrix4fv(locations.model, false, model);
      gl.uniformMatrix4fv(locations.mvp, false, multiply(viewProjection, model));
      const rgb = hexColor(color);
      gl.uniform3f(locations.color, rgb[0], rgb[1], rgb[2]);
      bind(buffer);
      gl.drawArrays(gl.TRIANGLES, 0, count);
      drawCalls += 1;
      triangles += count / 3;
    }
    function cube(x, y, z, sx, sy, sz, color, yaw) { drawMesh(cubeBuffer, CUBE.length / 6, x, y, z, sx, sy, sz, color, yaw); }
    function aura(x, y, z, radius, color) { drawMesh(ringBuffer, ring.length / 6, x, y, z, radius, 1, radius, color, 0); }
    function octa(x, y, z, sx, sy, sz, color, yaw) { drawMesh(octaBuffer, OCTAHEDRON.length / 6, x, y, z, sx, sy, sz, color, yaw); }
    function pyramid(x, y, z, sx, sy, sz, color, yaw) { drawMesh(pyramidBuffer, PYRAMID.length / 6, x, y, z, sx, sy, sz, color, yaw); }

    function drawTerrain(accent) {
      cube(0, -0.38, 0, 7.4, 0.32, 5.2, '#30273a');
      cube(-3.95, -0.04, 0, 3.5, 0.12, 3.65, '#4c654e');
      cube(3.1, -0.02, 0, 3.75, 0.14, 3.65, '#5f5c48');
      [-0.62,0.62].forEach(z => cube(-3.9, 0.1, z, 3.45, 0.08, 0.36, '#8b7559'));
      [-1.55,0,1.55].forEach(z => cube(3.15, 0.11, z, 3.55, 0.07, 0.32, '#786f58'));
      cube(worldX(430), 0.88, -3.38, 0.48, 1.05, 1.12, '#716553');
      cube(worldX(430), 0.88, 3.38, 0.48, 1.05, 1.12, '#716553');
      cube(worldX(430), 1.52, 0, 0.35, 1.55, 2.55, '#776a55');
      cube(worldX(430), 1.22, 0, 0.42, 0.3, 0.7, '#372b39');
      cube(worldX(858), 1.15, 0, 0.46, 1.35, 2.25, '#8e795e');
      cube(worldX(858), 2.55, 0, 0.62, 0.14, 2.48, '#4f3543');
      cube(worldX(858), 1.0, 0, 0.5, 0.75, 0.45, accent);
    }

    function drawTower(tower) {
      const z = worldZ(tower.side === 'north' ? 202 : 298);
      const x = worldX(423);
      if (tower.down) {
        cube(x, 0.18, z, 0.5, 0.18, 0.45, '#4e4240', 0.4);
        cube(x + 0.4, 0.14, z - 0.22, 0.27, 0.12, 0.23, '#796a57', -0.5);
        return;
      }
      const color = tower.side === 'north' ? '#c47a4f' : '#62906b';
      cube(x, 0.72, z, 0.58, 0.72, 0.64, '#82705a');
      cube(x, 1.48, z, 0.69, 0.12, 0.75, color);
      cube(x - 0.65, 1.02, z, 0.55, 0.08, 0.08, '#c9a76b');
    }

    function drawBuilding(building, slot) {
      if (!building) return;
      const x = worldX(slot.x), z = worldZ(slot.y);
      const colors = { forge: '#d98959', market: '#eac06c', ballista: '#83b36a', alchemist: '#be79a7' };
      const height = 0.35 + building.level * 0.13;
      cube(x, height, z, 0.35, height, 0.3, colors[building.type] || '#a68b62');
      if (building.type === 'forge') {
        cube(x + 0.24, height + 0.35, z, 0.09, 0.42, 0.1, '#44343e');
        octa(x - 0.12, height + 0.32, z, 0.14, 0.12, 0.13, '#f0a45a');
      }
      if (building.type === 'market') pyramid(x, height + 0.38, z, 0.5, 0.24, 0.4, '#8b5362');
      if (building.type === 'ballista') cube(x - 0.28, height + 0.28, z, 0.55, 0.06, 0.08, '#d4bb77');
      if (building.type === 'alchemist') octa(x, height + 0.4, z, 0.18, 0.28, 0.18, '#ee8e65');
    }

    function drawWarden(warden, index) {
      if (!warden.active) return;
      const x = worldX(warden.x), z = worldZ(warden.y), color = index ? '#85c29a' : '#e9a85e';
      const yaw = -Math.atan2(warden.aimY, warden.aimX);
      octa(x, 0.035, z, 0.28, 0.025, 0.2, '#25202b');
      cube(x, 0.48, z, 0.16, 0.3, 0.14, color, yaw);
      octa(x, 0.9, z, 0.15, 0.18, 0.15, '#d8ad80', yaw);
      pyramid(x, 1.12, z, 0.19, 0.13, 0.18, index ? '#3f6654' : '#8b5547', yaw);
      cube(x - 0.18, 0.54, z, 0.055, 0.22, 0.055, '#c98d61', yaw);
      cube(x + 0.18, 0.54, z, 0.055, 0.22, 0.055, '#c98d61', yaw);
      cube(x - 0.08, 0.16, z, 0.05, 0.18, 0.06, '#342631', yaw);
      cube(x + 0.08, 0.16, z, 0.05, 0.18, 0.06, '#342631', yaw);
      cube(x + warden.aimX * 0.27, 0.55, z + warden.aimY * 0.27, 0.3, 0.035, 0.035, '#f1d28a', yaw);
      octa(x + warden.aimX * 0.58, 0.55, z + warden.aimY * 0.58, 0.09, 0.07, 0.07, '#ffe37e', yaw);
    }

    function drawEnemy(enemy, reducedMotion) {
      const x = worldX(enemy.x), z = worldZ(enemy.y);
      const bob = reducedMotion ? 0 : Math.sin(enemy.phase) * 0.035;
      const colors = { raider: '#74415e', skitter: '#4f9b96', brute: '#53604a', relic: '#b98948', hexer: '#7c5ba7', warlord: '#9b4e55' };
      const scale = enemy.kind === 'warlord' ? 0.44 : enemy.kind === 'brute' ? 0.31 : enemy.kind === 'relic' ? 0.28 : enemy.kind === 'skitter' ? 0.19 : 0.24;
      const height = enemy.kind === 'warlord' ? 0.68 : enemy.kind === 'hexer' ? 0.54 : enemy.kind === 'brute' ? 0.46 : 0.36;
      if (enemy.warded) aura(x, 0.03, z, 0.34, '#65d5c7');
      if (enemy.commanded) aura(x, 0.045, z, 0.43, '#dc6b68');
      octa(x, 0.03, z, scale * 1.35, 0.025, scale, '#24202a');
      if (enemy.kind === 'skitter') {
        octa(x, 0.3 + bob, z, scale * 1.25, 0.24, scale, enemy.flash > 0 ? '#fff0cf' : colors[enemy.kind]);
        [-1,1].forEach(side => {
          cube(x + side * 0.2, 0.16 + bob, z - 0.12, 0.18, 0.035, 0.035, '#315f61', side * 0.5);
          cube(x + side * 0.2, 0.16 + bob, z + 0.12, 0.18, 0.035, 0.035, '#315f61', -side * 0.5);
        });
        return;
      }
      if (enemy.kind === 'hexer') pyramid(x, height + bob, z, scale * 1.15, height, scale * 1.15, colors[enemy.kind]);
      else cube(x, height + bob, z, scale, height, scale, enemy.flash > 0 ? '#fff0cf' : colors[enemy.kind]);
      octa(x, height * 2 + 0.14 + bob, z, scale * 0.78, 0.18, scale * 0.78, enemy.kind === 'relic' ? '#e9bb58' : enemy.kind === 'hexer' ? '#c18ae0' : '#4b2d43');
      cube(x - scale * 0.58, 0.17 + bob, z, scale * 0.2, 0.18, scale * 0.28, '#332733');
      cube(x + scale * 0.58, 0.17 + bob, z, scale * 0.2, 0.18, scale * 0.28, '#332733');
      if (enemy.kind === 'raider') pyramid(x + 0.27, 0.6 + bob, z, 0.18, 0.27, 0.07, '#b8a173', 1.57);
      if (enemy.kind === 'brute') {
        octa(x - 0.34, 0.76 + bob, z, 0.24, 0.22, 0.25, '#394136');
        octa(x + 0.34, 0.76 + bob, z, 0.24, 0.22, 0.25, '#394136');
      }
      if (enemy.kind === 'relic') pyramid(x, height * 2 + 0.42 + bob, z, 0.2, 0.22, 0.2, '#ffd86d');
      if (enemy.kind === 'hexer') {
        cube(x, height * 2 + 0.52 + bob, z, 0.07, 0.28, 0.07, '#8de1d4');
        octa(x, height * 2 + 0.82 + bob, z, 0.13, 0.16, 0.13, '#c18ae0');
        aura(x, 0.055, z, 0.58, '#65d5c7');
      }
      if (enemy.kind === 'warlord') {
        pyramid(x - 0.38, height * 2 + 0.28, z, 0.22, 0.18, 0.14, '#f0b46a', -0.55);
        pyramid(x + 0.38, height * 2 + 0.28, z, 0.22, 0.18, 0.14, '#f0b46a', 0.55);
        aura(x, 0.06, z, 0.78, '#dc6b68');
      }
    }

    function drawProjectile(projectile) {
      const fromX = worldX(projectile.fromX), fromZ = worldZ(projectile.fromY);
      const toX = worldX(projectile.toX), toZ = worldZ(projectile.toY);
      const dx = toX - fromX, dz = toZ - fromZ;
      const length = Math.hypot(dx, dz);
      const color = projectile.kind === 'power' ? '#ffe07a' : projectile.kind === 'ember' ? '#ed7b62' : '#f5d99d';
      cube((fromX + toX) / 2, 0.72, (fromZ + toZ) / 2, length / 2, projectile.kind === 'power' ? 0.045 : 0.025, 0.025, color, -Math.atan2(dz, dx));
    }

    function render(timeMs, state, reducedMotion) {
      if (!state) return;
      drawCalls = 0;
      triangles = 0;
      const chapter = window.HearthgateCore && window.HearthgateCore.activeSiegeChapter(state);
      const accent = chapter ? chapter.accent : '#d98959';
      const accentRgb = hexColor(accent);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0.055 + accentRgb[0] * 0.055, 0.045 + accentRgb[1] * 0.04, 0.085 + accentRgb[2] * 0.04, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const drift = reducedMotion ? 0 : Math.sin((Number(timeMs) || 0) / 11000) * 0.25;
      const projection = perspective(Math.PI / 4.15, canvas.width / canvas.height, 0.1, 50);
      const view = lookAt([8.4 + drift, 10.7, 12.5 - drift], [0.45, 0.55, 0], [0,1,0]);
      viewProjection = multiply(projection, view);
      drawTerrain(accent);
      state.towers.forEach(drawTower);
      state.buildings.forEach((building, index) => drawBuilding(building, window.HearthgateCore.BUILDING_SLOTS[index]));
      state.wardens.forEach(drawWarden);
      state.enemies.slice().sort((a,b) => a.y - b.y).forEach(enemy => drawEnemy(enemy, reducedMotion));
      state.projectiles.forEach(drawProjectile);
      canvas.dataset.chapter = state.chronicle ? state.chronicle.currentChapterId : 'unknown';
      canvas.dataset.enemyCount = String(state.enemies.length);
      canvas.dataset.drawCalls = String(drawCalls);
      canvas.dataset.triangles = String(triangles);
      canvas.dataset.frame = String(++frameCount);
      canvas.dataset.motion = reducedMotion ? 'reduced-static' : 'animated-drift-bob';
    }

    return { available: true, render: render };
  }

  window.HearthgateThree = { create: create };
})();
