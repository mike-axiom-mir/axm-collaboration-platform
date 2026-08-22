(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const canvas = document.getElementById('arena3d');
  const stage = document.getElementById('stage');
  let gl = null;
  let program = null;
  let buffer = null;
  let dynamicBuffer = null;
  let positionLocation = -1;
  let colorLocation = -1;
  let vertexCount = 0;
  let dynamicVertexCount = 0;
  let venueKey = '';
  let frames = 0;
  let lastError = null;

  function hex(value) {
    const text = String(value || '#ffffff').replace('#', '');
    const full = text.length === 3 ? text.split('').map(char => char + char).join('') : text.padEnd(6, 'f').slice(0, 6);
    return [parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255];
  }
  function shade(color, factor) { return color.map(channel => Math.max(0, Math.min(1, channel * factor))); }
  function vertex(target, point, color) { target.push(point[0], point[1], point[2], color[0], color[1], color[2]); }
  function quad(target, a, b, c, d, color) {
    vertex(target, a, color); vertex(target, b, color); vertex(target, c, color);
    vertex(target, a, color); vertex(target, c, color); vertex(target, d, color);
  }
  function triangle(target, a, b, c, color) {
    vertex(target, a, color); vertex(target, b, color); vertex(target, c, color);
  }
  function box(target, x, y, z, width, height, depth, color) {
    const x0 = x - width / 2, x1 = x + width / 2;
    const y0 = y, y1 = y + height;
    const z0 = z - depth / 2, z1 = z + depth / 2;
    quad(target, [x0,y1,z0], [x1,y1,z0], [x1,y1,z1], [x0,y1,z1], shade(color, 1.16));
    quad(target, [x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1], shade(color, .92));
    quad(target, [x1,y0,z0], [x0,y0,z0], [x0,y1,z0], [x1,y1,z0], shade(color, .62));
    quad(target, [x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0], shade(color, .72));
    quad(target, [x1,y0,z1], [x1,y0,z0], [x1,y1,z0], [x1,y1,z1], shade(color, 1));
  }
  function pyramid(target, x, y, z, width, height, depth, color) {
    const a=[x-width/2,y,z-depth/2], b=[x+width/2,y,z-depth/2], c=[x+width/2,y,z+depth/2], d=[x-width/2,y,z+depth/2], p=[x,y+height,z];
    quad(target,a,b,c,d,shade(color,.55));
    [ [a,b,p,1.05], [b,c,p,.9], [c,d,p,.72], [d,a,p,.82] ].forEach(face => {
      vertex(target,face[0],shade(color,face[3])); vertex(target,face[1],shade(color,face[3])); vertex(target,face[2],shade(color,face[3]));
    });
  }
  function octahedron(target, x, y, z, radius, color) {
    const top = [x, y + radius, z], bottom = [x, y - radius, z];
    const points = [
      [x - radius, y, z], [x, y, z - radius],
      [x + radius, y, z], [x, y, z + radius]
    ];
    for (let index = 0; index < 4; index += 1) {
      const next = (index + 1) % 4;
      triangle(target, top, points[index], points[next], shade(color, 1.08 - index * .08));
      triangle(target, bottom, points[next], points[index], shade(color, .72 + index * .05));
    }
  }
  function ring(target, x, y, z, inner, outer, segments, color, phase) {
    for (let index = 0; index < segments; index += 1) {
      const a = Number(phase || 0) + index / segments * Math.PI * 2;
      const b = Number(phase || 0) + (index + 1) / segments * Math.PI * 2;
      quad(target,
        [x + Math.cos(a) * inner, y, z + Math.sin(a) * inner],
        [x + Math.cos(a) * outer, y, z + Math.sin(a) * outer],
        [x + Math.cos(b) * outer, y, z + Math.sin(b) * outer],
        [x + Math.cos(b) * inner, y, z + Math.sin(b) * inner],
        index % 2 ? shade(color, .78) : shade(color, 1.12));
    }
  }
  function worldPoint(x, y) {
    return { x: Number(x || 0) - 50, z: Number(y || 0) - 31 };
  }
  function addFloor(target, colors) {
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 11; col += 1) {
        const edge = row === 0 || row === 6 || col === 0 || col === 10;
        const tone = edge ? shade(colors[1], .42) : shade(colors[0], .62 + ((row + col) % 2) * .11);
        box(target, -45 + col * 9, -.65, -27 + row * 9, 8.5, .55, 8.5, tone);
      }
    }
    box(target, 0, -.2, 0, 18, 1.1, 18, shade(colors[1], .5));
    box(target, 0, .9, 0, 12, 1.2, 12, shade(colors[2], .55));
    pyramid(target, 0, 2.1, 0, 7, 6, 7, shade(colors[1], 1.15));
    ring(target, 0, .44, 0, 13, 14.2, 24, shade(colors[1], .8), 0);
    ring(target, 0, .35, 0, 24, 24.7, 32, shade(colors[2], .62), Math.PI / 32);
  }
  function addVenueArchitecture(target, venue, colors) {
    const index = Math.max(0, (window.PulseChoirCore && window.PulseChoirCore.VENUE_CIRCUIT || []).findIndex(item => item.id === venue.id));
    for (let side of [-1, 1]) {
      for (let step = 0; step < 5; step += 1) {
        const z = -22 + step * 11;
        const height = 8 + ((step + index * 2) % 4) * 3;
        box(target, side * 48, 0, z, 3.4, height, 3.4, step % 2 ? colors[1] : colors[2]);
        pyramid(target, side * 48, height, z, 4.6, 3.5, 4.6, colors[2]);
      }
    }
    if (venue.id === 'moonwell-atrium') {
      [-28,-14,14,28].forEach(x => box(target,x,0,-29,4,12,4,colors[1]));
      box(target,0,0,28,38,3,5,colors[2]);
    } else if (venue.id === 'prism-causeway') {
      for(let step=-4;step<=4;step+=1) pyramid(target,step*10,0,-27+Math.abs(step)*2,7,8+Math.abs(step),7,step%2?colors[1]:colors[2]);
    } else if (venue.id === 'static-garden') {
      for(let step=-4;step<=4;step+=2){ box(target,step*10,0,-24,7,4+Math.abs(step),7,colors[2]); box(target,step*10,0,24,7,8-Math.abs(step)/2,7,colors[1]); }
    } else if (venue.id === 'twin-comet-bridge') {
      box(target,-25,0,0,34,3,5,colors[1]); box(target,25,0,0,34,3,5,colors[2]);
      pyramid(target,-42,3,0,9,15,9,colors[2]); pyramid(target,42,3,0,9,15,9,colors[1]);
    } else {
      for(let tier=0;tier<4;tier+=1){ box(target,0,tier*2.2,-30+tier*3,78-tier*12,2,5, tier%2?colors[1]:colors[2]); }
      [-36,-18,18,36].forEach((x,i)=>box(target,x,0,25,6,11+i%2*5,6,i%2?colors[1]:colors[2]));
    }
  }
  function buildGeometry(venue, highContrast) {
    const colors = highContrast ? [hex('#08080c'), hex('#ffffff'), hex('#ffe54f')] : (venue.palette || ['#10183d','#39dff2','#b76cff']).map(hex);
    const vertices = [];
    addFloor(vertices, colors);
    addVenueArchitecture(vertices, venue, colors);
    for(let index=0;index<22;index+=1){
      const x=((index*37)%97)-48, z=((index*53)%61)-30, height=1+(index%3);
      box(vertices,x,18+(index%5)*4,z,1.2,height,1.2,index%2?colors[1]:colors[2]);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    vertexCount = vertices.length / 6;
  }
  function addCore(target, state, colors, now, motion) {
    const core = state.core || { x: 50, y: 31, charge: 0 };
    const point = worldPoint(core.x, core.y);
    const charge = Math.max(0, Math.min(1, Number(core.charge || 0) / 100));
    const pulse = 1 + Math.sin(Number(now || 0) * .004) * .08 * motion;
    const coreColor = state.sync ? hex('#ff65bd') : colors[1];
    box(target, point.x, .1, point.z, 10.5, 1.1, 10.5, shade(colors[0], .72));
    ring(target, point.x, 1.35, point.z, 6.4 * pulse, 7.1 * pulse, 20, coreColor, Number(now || 0) * .00035 * motion);
    ring(target, point.x, 2.15, point.z, 8.2, 8.65, 24, colors[2], -Number(now || 0) * .00022 * motion);
    octahedron(target, point.x, 5.2, point.z, 4.15 * pulse, coreColor);
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      const active = index / 12 <= charge;
      box(target, point.x + Math.cos(angle) * 10.4, .45, point.z + Math.sin(angle) * 10.4,
        1.15, active ? 3.1 : 1.3, 1.15, active ? hex('#ffe36b') : shade(colors[0], .72));
    }
  }
  function addBeat(target, beat, index, colors, now, motion) {
    const recipe = window.PulseChoirCore && window.PulseChoirCore.BEAT_TYPES && window.PulseChoirCore.BEAT_TYPES[beat.kind];
    const color = recipe ? hex(recipe.color) : colors[1];
    const point = worldPoint(beat.x, beat.y);
    const bob = 2.1 + Math.sin(Number(now || 0) * .006 + index * 1.7) * .45 * motion;
    ring(target, point.x, .34, point.z, 1.5, 2.15, 8, shade(color, .65), index * .31);
    if (beat.kind === 'chord') {
      box(target, point.x, bob - 1.05, point.z, 2.35, 2.35, 2.35, color);
    } else if (beat.kind === 'wild') {
      octahedron(target, point.x, bob, point.z, 1.75, color);
    } else {
      pyramid(target, point.x, bob - 1.25, point.z, 3.1, 3.2, 3.1, color);
    }
  }
  function addPlayer(target, player, index, state, colors, now, motion) {
    const point = worldPoint(player.x, player.y);
    const color = hex(player.recipe && player.recipe.color || '#6df7ff');
    const bounce = Math.abs(Math.sin(Number(now || 0) * .009 + index * 1.2)) * .28 * motion;
    box(target, point.x, .12, point.z, 3.7, .42, 3.7, shade(color, .35));
    box(target, point.x, .54 + bounce, point.z, 2.5, 3.9, 2.5, shade(color, .9));
    pyramid(target, point.x, 4.44 + bounce, point.z, 3.35, 2.65, 3.35, color);
    box(target, point.x, 5.15 + bounce, point.z - 1.48, 1.85, .55, .22, hex('#d9ffff'));
    const cargo = Array.isArray(player.carrying) ? player.carrying : [];
    cargo.forEach((kind, cargoIndex) => {
      const recipe = window.PulseChoirCore && window.PulseChoirCore.BEAT_TYPES && window.PulseChoirCore.BEAT_TYPES[kind];
      const cargoColor = recipe ? hex(recipe.color) : colors[2];
      octahedron(target, point.x + (cargoIndex - 1) * 1.35, 7.75 + bounce, point.z, .58, cargoColor);
    });
    if (player.shieldCharges) ring(target, point.x, 1.1, point.z, 3.2, 3.6, 16, hex('#d9ffff'), Number(now || 0) * .001 * motion);
    if (state.sync && player.pulsedSyncId === state.sync.id) ring(target, point.x, 1.35, point.z, 4.1, 4.55, 16, color, -Number(now || 0) * .0014 * motion);
  }
  function addGlitch(target, state) {
    if (!state.glitch) return;
    const glitch = state.glitch;
    const active = glitch.phase === 'active';
    const color = active ? hex('#ff245f') : hex('#ffd34f');
    if (glitch.axis === 'horizontal') {
      const point = worldPoint(50, glitch.line);
      box(target, 0, .12, point.z, 100, active ? 2.7 : .8, 4.6, color);
    } else {
      const point = worldPoint(glitch.line, 31);
      box(target, point.x, .12, 0, 4.6, active ? 2.7 : .8, 62, color);
    }
  }
  function buildDynamicGeometry(state, venue, now, options) {
    const highContrast = Boolean(options && options.highContrast);
    const colors = highContrast ? [hex('#08080c'), hex('#ffffff'), hex('#ffe54f')] : (venue.palette || ['#10183d','#39dff2','#b76cff']).map(hex);
    const motion = options && options.reducedMotion ? 0 : 1;
    const vertices = [];
    addCore(vertices, state, colors, now, motion);
    (state.beats || []).forEach((beat, index) => addBeat(vertices, beat, index, colors, now, motion));
    Object.values(state.players || {}).sort((a, b) => String(a.id).localeCompare(String(b.id))).forEach((player, index) => addPlayer(vertices, player, index, state, colors, now, motion));
    addGlitch(vertices, state);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    dynamicVertexCount = vertices.length / 6;
  }
  function shader(type, source) {
    const value = gl.createShader(type);
    gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value) || 'shader compile failed');
    return value;
  }
  function bindGeometry(source) {
    gl.bindBuffer(gl.ARRAY_BUFFER, source);
    const stride = 6 * 4;
    gl.enableVertexAttribArray(positionLocation); gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(colorLocation); gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, stride, 3 * 4);
  }
  function init() {
    if (!canvas) throw new Error('3D canvas missing');
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL unavailable');
    const vertexShader = shader(gl.VERTEX_SHADER, 'attribute vec3 aPosition;attribute vec3 aColor;uniform mat4 uMatrix;varying vec3 vColor;varying float vHeight;void main(){vColor=aColor;vHeight=aPosition.y;gl_Position=uMatrix*vec4(aPosition,1.0);}');
    const fragmentShader = shader(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec3 vColor;varying float vHeight;void main(){float p=mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),2.0);float scan=mod(floor(gl_FragCoord.y),4.0)==0.0?0.94:1.0;float lift=clamp(vHeight/32.0,0.0,1.0)*0.09;vec3 c=floor((vColor+vec3(lift))*(0.94+p*0.06)*scan*31.0)/31.0;gl_FragColor=vec4(c,1.0);}');
    program = gl.createProgram(); gl.attachShader(program, vertexShader); gl.attachShader(program, fragmentShader); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'program link failed');
    buffer = gl.createBuffer(); dynamicBuffer = gl.createBuffer(); gl.useProgram(program);
    positionLocation = gl.getAttribLocation(program, 'aPosition');
    colorLocation = gl.getAttribLocation(program, 'aColor');
    bindGeometry(buffer);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    canvas.dataset.renderer = 'webgl';
    canvas.dataset.visualPass = 'constellation-depth-02';
    stage && stage.classList.add('stage-webgl');
  }
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  }
  function lookAt(eye, center, up) {
    let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2];let len=Math.hypot(zx,zy,zz)||1;zx/=len;zy/=len;zz/=len;
    let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;len=Math.hypot(xx,xy,xz)||1;xx/=len;xy/=len;xz/=len;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return [xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0, -(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1];
  }
  function multiply(a,b) {
    const out=new Array(16).fill(0);for(let row=0;row<4;row+=1)for(let col=0;col<4;col+=1)for(let k=0;k<4;k+=1)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out;
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.min(800, Math.round(rect.width * .68)));
    const height = Math.max(240, Math.round(width * Math.max(.45, rect.height / Math.max(1, rect.width))));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  function render(state, now, options) {
    if (!gl || !state) return false;
    const venue = state.venue || (window.PulseChoirCore && window.PulseChoirCore.venueForRound(1));
    if (!venue) return false;
    const highContrast = Boolean(options && options.highContrast);
    const key = venue.id + ':' + highContrast;
    if (key !== venueKey) { venueKey = key; buildGeometry(venue, highContrast); }
    resize();
    const palette = venue.palette || ['#10183d'];
    const clear = highContrast ? [0,0,0] : shade(hex(palette[0]), .24);
    gl.clearColor(clear[0], clear[1], clear[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const motion = options && options.reducedMotion ? 0 : 1;
    const drift = Math.sin(Number(now || 0) * .00017) * 3.2 * motion;
    const eye = [drift, 76 + Math.cos(Number(now || 0) * .00013) * 2 * motion, 88];
    const matrix = multiply(perspective(Math.PI / 3.45, canvas.width / canvas.height, .1, 260), lookAt(eye, [0,1,0], [0,1,0]));
    gl.useProgram(program); gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uMatrix'), false, new Float32Array(matrix));
    bindGeometry(buffer); gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    buildDynamicGeometry(state, venue, now, options);
    bindGeometry(dynamicBuffer); gl.drawArrays(gl.TRIANGLES, 0, dynamicVertexCount); frames += 1;
    canvas.dataset.venue = venue.id; canvas.dataset.frames = String(frames);
    canvas.dataset.motion = motion ? 'full' : 'reduced';
    canvas.dataset.cameraDrift = drift.toFixed(3);
    canvas.dataset.staticVertices = String(vertexCount);
    canvas.dataset.dynamicVertices = String(dynamicVertexCount);
    canvas.dataset.worldActors = String(Object.keys(state.players || {}).length);
    canvas.dataset.worldBeats = String((state.beats || []).length);
    canvas.dataset.worldCore = 'dynamic-octahedron';
    return true;
  }
  try { init(); }
  catch (error) { lastError = error && error.message || String(error); canvas && (canvas.hidden = true); stage && stage.classList.add('stage-webgl-fallback'); }
  window.PulseChoirStage3D = {
    available: Boolean(gl),
    render,
    diagnostics: () => ({ renderer: gl ? 'webgl' : 'fallback', visualPass: canvas && canvas.dataset.visualPass || null, venue: canvas && canvas.dataset.venue || null, frames, staticVertices: vertexCount, dynamicVertices: dynamicVertexCount, width: canvas && canvas.width || 0, height: canvas && canvas.height || 0, error: lastError })
  };
})();
