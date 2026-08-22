(function (root) {
  'use strict';

  const canvas = document.getElementById('world3d');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: true, powerPreference: 'high-performance' });
  if (!gl) {
    canvas.hidden = true;
    root.BloomvaleStage3D = { available: false, render: function () {} };
    return;
  }

  const vertexSource = [
    'attribute vec3 aPosition;',
    'attribute vec3 aColor;',
    'uniform mat4 uMatrix;',
    'varying vec3 vColor;',
    'varying float vDepth;',
    'void main(){',
    '  gl_Position=uMatrix*vec4(aPosition,1.0);',
    '  vColor=aColor;',
    '  vDepth=clamp((gl_Position.z/gl_Position.w)*.5+.5,0.0,1.0);',
    '}'
  ].join('\n');
  const fragmentSource = [
    'precision mediump float;',
    'varying vec3 vColor;',
    'varying float vDepth;',
    'void main(){',
    '  vec3 ink=vec3(.025,.055,.09);',
    '  float checker=mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),2.0)*.016;',
    '  float scanline=mod(floor(gl_FragCoord.y),4.0)==0.0 ? -.018 : 0.0;',
    '  vec3 quantized=floor(clamp(vColor+checker+scanline,0.0,1.0)*15.0+.5)/15.0;',
    '  gl_FragColor=vec4(mix(quantized,ink,vDepth*.26),1.0);',
    '}'
  ].join('\n');

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const positionLocation = gl.getAttribLocation(program, 'aPosition');
  const colorLocation = gl.getAttribLocation(program, 'aColor');
  const matrixLocation = gl.getUniformLocation(program, 'uMatrix');
  const buffer = gl.createBuffer();
  let frames = 0;

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
    return new Float32Array([f / aspect,0,0,0, 0,f,0,0, 0,0,(near + far) * range,-1, 0,0,near * far * range * 2,0]);
  }

  function lookAt(eye, target) {
    let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    let size = Math.hypot(zx, zy, zz) || 1; zx /= size; zy /= size; zz /= size;
    let xx = zz, xy = 0, xz = -zx;
    size = Math.hypot(xx, xy, xz) || 1; xx /= size; xy /= size; xz /= size;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]),1
    ]);
  }

  function hex(value) {
    const clean = String(value || '#ffffff').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(item => item + item).join('') : clean;
    return [parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255];
  }

  function shade(color, amount) {
    return color.map(channel => Math.max(0, Math.min(1, channel * amount)));
  }

  function pushFace(vertices, corners, color) {
    [0,1,2, 0,2,3].forEach(index => {
      const point = corners[index];
      vertices.push(point[0], point[1], point[2], color[0], color[1], color[2]);
    });
  }

  function pushTriangle(vertices, a, b, c, color) {
    [a,b,c].forEach(point => vertices.push(point[0], point[1], point[2], color[0], color[1], color[2]));
  }

  function box(vertices, x, y, z, width, height, depth, colorValue, yaw) {
    const color = hex(colorValue), c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    const local = [
      [-width/2,-height/2,-depth/2],[width/2,-height/2,-depth/2],[width/2,height/2,-depth/2],[-width/2,height/2,-depth/2],
      [-width/2,-height/2,depth/2],[width/2,-height/2,depth/2],[width/2,height/2,depth/2],[-width/2,height/2,depth/2]
    ].map(point => [x + point[0] * c - point[2] * s, y + point[1], z + point[0] * s + point[2] * c]);
    pushFace(vertices, [local[4],local[5],local[6],local[7]], shade(color, .92));
    pushFace(vertices, [local[1],local[0],local[3],local[2]], shade(color, .72));
    pushFace(vertices, [local[0],local[4],local[7],local[3]], shade(color, .64));
    pushFace(vertices, [local[5],local[1],local[2],local[6]], shade(color, .82));
    pushFace(vertices, [local[3],local[7],local[6],local[2]], shade(color, 1.12));
    pushFace(vertices, [local[0],local[1],local[5],local[4]], shade(color, .55));
  }

  function road(vertices, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    box(vertices, (ax + bx) / 2, -.08, (az + bz) / 2, Math.hypot(dx, dz), .06, .31, '#d5b96f', Math.atan2(dz, dx));
  }

  function pyramid(vertices, x, y, z, radius, height, colorValue, yaw) {
    const color = hex(colorValue), c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    const rotate = (px, pz) => [x + px * c - pz * s, y - height / 2, z + px * s + pz * c];
    const corners = [rotate(-radius,-radius),rotate(radius,-radius),rotate(radius,radius),rotate(-radius,radius)];
    const tip = [x, y + height / 2, z];
    pushFace(vertices, [corners[3],corners[2],corners[1],corners[0]], shade(color, .46));
    pushTriangle(vertices, corners[0], corners[1], tip, shade(color, .72));
    pushTriangle(vertices, corners[1], corners[2], tip, shade(color, .92));
    pushTriangle(vertices, corners[2], corners[3], tip, shade(color, 1.12));
    pushTriangle(vertices, corners[3], corners[0], tip, shade(color, .82));
  }

  function octahedron(vertices, x, y, z, radius, height, colorValue, yaw) {
    const color = hex(colorValue), c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    const equator = [[-radius,0],[0,-radius],[radius,0],[0,radius]].map(point => [x + point[0] * c - point[1] * s, y, z + point[0] * s + point[1] * c]);
    const top = [x,y + height / 2,z], bottom = [x,y - height / 2,z];
    for (let index = 0; index < 4; index += 1) {
      const next = (index + 1) % 4;
      pushTriangle(vertices, equator[index], equator[next], top, shade(color, [1.08,.84,.68,.94][index]));
      pushTriangle(vertices, equator[next], equator[index], bottom, shade(color, [.58,.72,.48,.64][index]));
    }
  }

  function flatRing(vertices, x, y, z, innerRadius, outerRadius, colorValue, segments, rotation) {
    const color = hex(colorValue), count = segments || 12, offset = rotation || 0;
    for (let index = 0; index < count; index += 1) {
      const angleA = offset + index / count * Math.PI * 2;
      const angleB = offset + (index + 1) / count * Math.PI * 2;
      const innerA = [x + Math.cos(angleA) * innerRadius,y,z + Math.sin(angleA) * innerRadius];
      const innerB = [x + Math.cos(angleB) * innerRadius,y,z + Math.sin(angleB) * innerRadius];
      const outerB = [x + Math.cos(angleB) * outerRadius,y,z + Math.sin(angleB) * outerRadius];
      const outerA = [x + Math.cos(angleA) * outerRadius,y,z + Math.sin(angleA) * outerRadius];
      pushFace(vertices, [innerA,innerB,outerB,outerA], shade(color, index % 2 ? .72 : 1.04));
    }
  }

  function worldPoint(x, y) { return [(x - 1200) / 200, (y - 675) / 200]; }

  function actorYaw(actor) {
    const x = Number(actor && actor.facingX);
    const y = Number(actor && actor.facingY);
    return Math.atan2(Number.isFinite(y) ? y : 0, Number.isFinite(x) ? x : 1);
  }

  function addActor(vertices, actor, state, time, reducedMotion, isAlly) {
    if (!actor) return;
    const point = worldPoint(actor.x, actor.y), yaw = actorYaw(actor);
    const down = Number(actor.downUntil) > Number(state && state.now);
    const color = down ? '#586270' : actor.color || (isAlly ? '#ffd35c' : '#5cecff');
    const dark = isAlly ? '#744b43' : '#244780';
    const bob = reducedMotion || down ? 0 : Math.sin(time / 150 + (isAlly ? 1.7 : 0)) * .025;
    box(vertices, point[0] + .035, .035, point[1] + .055, .62, .035, .38, '#102238', yaw);
    flatRing(vertices, point[0], .06, point[1], .30, .38, color, 8, yaw);
    if (down) {
      box(vertices, point[0], .16, point[1], .62, .24, .28, color, yaw);
      return;
    }
    box(vertices, point[0] - Math.sin(yaw) * .10, .16 + bob, point[1] + Math.cos(yaw) * .10, .09, .28, .10, dark, yaw);
    box(vertices, point[0] + Math.sin(yaw) * .10, .16 + bob, point[1] - Math.cos(yaw) * .10, .09, .28, .10, dark, yaw);
    box(vertices, point[0], .43 + bob, point[1], isAlly ? .34 : .30, .42, .25, color, yaw);
    octahedron(vertices, point[0], .77 + bob, point[1], isAlly ? .21 : .19, .34, isAlly ? '#fff0a0' : '#e9ffff', yaw + Math.PI / 4);
    box(vertices, point[0] + Math.cos(yaw) * .23, .47 + bob, point[1] + Math.sin(yaw) * .23, .42, .10, .12, isAlly ? '#ff8f72' : '#8779ff', yaw);
    box(vertices, point[0] + Math.cos(yaw) * .43, .47 + bob, point[1] + Math.sin(yaw) * .43, .14, .13, .15, color, yaw);
    if (!isAlly && Number(state && state.counterReadyUntil) > Number(state && state.now)) {
      const spin = reducedMotion ? 0 : time * .0028;
      flatRing(vertices, point[0], .13, point[1], .43, .51, '#d7ff72', 12, spin);
      octahedron(vertices, point[0], 1.08, point[1], .10, .22, '#d7ff72', spin);
    }
  }

  function enemyPalette(kind) {
    if (kind === 'sprinter') return ['#ffca5f','#ff6f91'];
    if (kind === 'bruiser') return ['#ff72b6','#6b2c78'];
    if (kind === 'siphon') return ['#75f0df','#3350a0'];
    if (kind === 'crown') return ['#ff617f','#6f204d'];
    return ['#b77aff','#492a77'];
  }

  function addEnemy(vertices, enemy, state, time, reducedMotion) {
    const point = worldPoint(enemy.x, enemy.y), yaw = actorYaw(enemy);
    const palette = enemyPalette(enemy.kind), scale = Math.max(.74, Math.min(2.15, Number(enemy.radius || 20) / 20));
    const pulse = reducedMotion ? 0 : Math.sin(time / 135 + point[0]) * .035;
    const winding = Number(enemy.windupUntil) > Number(state && state.now);
    box(vertices, point[0] + .04, .028, point[1] + .05, .54 * scale, .03, .36 * scale, '#15152e', yaw);
    if (winding) {
      const progress = Math.max(0, Math.min(1, (Number(state.now) - Number(enemy.windupStartedAt || state.now)) / Math.max(1, Number(enemy.windupUntil) - Number(enemy.windupStartedAt || state.now))));
      flatRing(vertices, point[0], .075, point[1], .31 * scale, (.39 + progress * .11) * scale, '#ffef70', 12, reducedMotion ? 0 : time * .004);
    }
    if (enemy.kind === 'sprinter') {
      octahedron(vertices, point[0], .32 + pulse, point[1], .23 * scale, .48 * scale, palette[0], yaw);
      box(vertices, point[0] - Math.cos(yaw) * .18, .33, point[1] - Math.sin(yaw) * .18, .42 * scale, .08, .18, palette[1], yaw);
    } else if (enemy.kind === 'bruiser') {
      box(vertices, point[0], .32, point[1], .52 * scale, .58 * scale, .44 * scale, palette[1], yaw);
      pyramid(vertices, point[0], .73 * scale, point[1], .28 * scale, .48 * scale, palette[0], yaw + Math.PI / 4);
      box(vertices, point[0] - Math.sin(yaw) * .34 * scale, .34, point[1] + Math.cos(yaw) * .34 * scale, .18 * scale, .38 * scale, .20, palette[0], yaw);
      box(vertices, point[0] + Math.sin(yaw) * .34 * scale, .34, point[1] - Math.cos(yaw) * .34 * scale, .18 * scale, .38 * scale, .20, palette[0], yaw);
    } else if (enemy.kind === 'siphon') {
      pyramid(vertices, point[0], .42, point[1], .31 * scale, .82 * scale, palette[1], yaw);
      octahedron(vertices, point[0], .79 * scale, point[1], .24 * scale, .42 * scale, palette[0], -yaw);
      flatRing(vertices, point[0], .23, point[1], .34 * scale, .40 * scale, palette[0], 8, time * (reducedMotion ? 0 : -.0018));
    } else if (enemy.kind === 'crown') {
      box(vertices, point[0], .52, point[1], .64 * scale, .88 * scale, .58 * scale, palette[1], yaw);
      for (let spike = -2; spike <= 2; spike += 1) pyramid(vertices, point[0] + spike * .16 * scale, 1.08 * scale - Math.abs(spike) * .08, point[1], .12 * scale, (.54 - Math.abs(spike) * .06) * scale, palette[0], yaw);
      flatRing(vertices, point[0], .09, point[1], .43 * scale, .53 * scale, '#ffca72', 12, time * (reducedMotion ? 0 : .001));
    } else {
      octahedron(vertices, point[0], .34 + pulse, point[1], .28 * scale, .56 * scale, palette[0], yaw);
      pyramid(vertices, point[0] - Math.sin(yaw) * .23 * scale, .34, point[1] + Math.cos(yaw) * .23 * scale, .10 * scale, .35 * scale, palette[1], yaw);
      pyramid(vertices, point[0] + Math.sin(yaw) * .23 * scale, .34, point[1] - Math.cos(yaw) * .23 * scale, .10 * scale, .35 * scale, palette[1], yaw);
    }
  }

  function addProjectile(vertices, projectile, time, reducedMotion) {
    const point = worldPoint(projectile.x, projectile.y);
    const yaw = Math.atan2(Number(projectile.vy) || 0, Number(projectile.vx) || 1);
    const scale = projectile.counter ? 1.7 : 1;
    box(vertices, point[0], .28, point[1], .30 * scale, .10 * scale, .10 * scale, projectile.color || '#ffffff', yaw);
    octahedron(vertices, point[0] + Math.cos(yaw) * .17 * scale, .28, point[1] + Math.sin(yaw) * .17 * scale, .08 * scale, .18 * scale, projectile.counter ? '#f7ffb5' : '#ffffff', reducedMotion ? yaw : yaw + time * .006);
  }

  function addPickup(vertices, pickup, time, reducedMotion) {
    const point = worldPoint(pickup.x, pickup.y), spin = reducedMotion ? Math.PI / 4 : time * .002;
    flatRing(vertices, point[0], .07, point[1], .24, .31, '#ff7cae', 8, spin);
    octahedron(vertices, point[0] - .09, .39, point[1], .14, .30, '#ff6c9c', spin);
    octahedron(vertices, point[0] + .09, .39, point[1], .14, .30, '#ff6c9c', -spin);
    pyramid(vertices, point[0], .29, point[1], .20, .38, '#ffd0df', Math.PI / 4);
  }

  function buildScene(state, time, reducedMotion) {
    const vertices = [];
    const wave = state ? Number(state.wave) || 0 : 0;
    const profile = root.ToonfallCore && root.ToonfallCore.WAVE_CHRONICLE[Math.max(0, Math.min(4, (state && state.phase === 'explore') ? wave : wave - 1))];
    const accent = profile ? profile.accent : '#62e7ef';
    const towerPulse = reducedMotion ? 0 : Math.sin(time / 420) * .08;
    box(vertices, 0, .36, 0, .72, 1.08, .72, '#493679', 0);
    box(vertices, 0, 1.18 + towerPulse / 2, 0, .38, .72 + towerPulse, .38, '#d9ff78', Math.PI / 4);
    pyramid(vertices, 0, 1.65 + towerPulse, 0, .31, .64, '#7ffff2', Math.PI / 4);
    flatRing(vertices, 0, .08, 0, .72, .86, '#7ffff2', 12, reducedMotion ? 0 : time * .00045);
    flatRing(vertices, 0, .11, 0, 1.02, 1.08, '#d9ff78', 16, reducedMotion ? 0 : -time * .00025);
    const gates = [[520,360],[1880,370],[1200,120],[610,1130],[1810,1120]];
    gates.forEach((gate, index) => {
      if (!state || state.phase !== 'wave' || index + 1 !== wave) return;
      const point = worldPoint(gate[0], gate[1]);
      const height = .93 + wave * .045;
      box(vertices, point[0] - .3, height / 2, point[1], .2, height, .28, accent, 0);
      box(vertices, point[0] + .3, height / 2, point[1], .2, height, .28, accent, 0);
      box(vertices, point[0], height, point[1], .8, .18, .28, accent, 0);
    });
    if (state) {
      addActor(vertices, state.player, state, time, reducedMotion, false);
      addActor(vertices, state.ally, state, time, reducedMotion, true);
      (state.enemies || []).forEach(enemy => addEnemy(vertices, enemy, state, time, reducedMotion));
      (state.projectiles || []).forEach(projectile => addProjectile(vertices, projectile, time, reducedMotion));
      (state.pickups || []).forEach(pickup => addPickup(vertices, pickup, time, reducedMotion));
    }
    return {
      vertices,
      stats: {
        actors: state ? Number(!!state.player) + Number(!!state.ally) : 0,
        enemies: state && state.enemies ? state.enemies.length : 0,
        projectiles: state && state.projectiles ? state.projectiles.length : 0,
        pickups: state && state.pickups ? state.pickups.length : 0
      }
    };
  }

  function resize() {
    const width = Math.max(1, Math.min(640, Math.round(canvas.clientWidth / 3)));
    const height = Math.max(1, Math.min(360, Math.round(canvas.clientHeight / 3)));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
  }

  function render(time, state, reducedMotion) {
    resize();
    const scene = buildScene(state, time, reducedMotion);
    const vertices = scene.vertices;
    const orbit = reducedMotion ? 0 : Math.sin(time / 9000) * .12;
    const eye = [Math.sin(orbit) * .28, 7.25, .52];
    const matrix = multiply(perspective(Math.PI / 3.12, canvas.width / canvas.height, .1, 40), lookAt(eye, [0,.08,0]));
    gl.clearColor(.025, .055, .09, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 24, 12);
    gl.uniformMatrix4fv(matrixLocation, false, matrix);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
    frames += 1;
    canvas.dataset.renderer = 'webgl-low-poly';
    canvas.dataset.palette = '16-step-channel-quantized';
    canvas.dataset.visualPass = 'bloomvale-depth-02';
    canvas.dataset.dynamicActors = String(scene.stats.actors);
    canvas.dataset.dynamicEnemies = String(scene.stats.enemies);
    canvas.dataset.dynamicProjectiles = String(scene.stats.projectiles);
    canvas.dataset.dynamicPickups = String(scene.stats.pickups);
    canvas.dataset.vertices = String(vertices.length / 6);
    canvas.dataset.motion = reducedMotion ? 'reduced-locked-camera' : 'slow-orbit';
    canvas.dataset.phase = state ? state.phase : 'loading';
    canvas.dataset.wave = state ? String(state.wave || 0) : '0';
    canvas.dataset.watch = state && state.chronicle ? String(state.chronicle.currentWatchId || 'approach') : 'approach';
    canvas.dataset.frames = String(frames);
  }

  root.BloomvaleStage3D = { available: true, render: render };
})(window);
