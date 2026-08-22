(function () {
  'use strict';

  var VERTEX_SHADER = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uModel;
    varying vec3 vNormal;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      gl_Position = vec4(world.x / 6.0, world.z / 4.0 + world.y * 0.10, 0.42 - world.y * 0.08 + world.z * 0.002, 1.0);
      vNormal = mat3(uModel) * aNormal;
    }
  `;
  var FRAGMENT_SHADER = `
    precision mediump float;
    uniform vec3 uColor;
    varying vec3 vNormal;
    void main() {
      vec3 light = normalize(vec3(-0.38, 0.9, 0.46));
      float diffuse = max(0.0, dot(normalize(vNormal), light));
      vec3 lit = uColor * (0.42 + diffuse * 0.58);
      vec3 quantized = floor(clamp(lit, 0.0, 1.0) * 15.0 + 0.5) / 15.0;
      gl_FragColor = vec4(quantized, 0.96);
    }
  `;

  var CUBE = new Float32Array([
    -1,-1, 1,0,0,1, 1,-1, 1,0,0,1, 1, 1, 1,0,0,1, -1,-1, 1,0,0,1, 1, 1, 1,0,0,1, -1, 1, 1,0,0,1,
     1,-1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1, 1,-1,0,0,-1, 1,-1,-1,0,0,-1,-1, 1,-1,0,0,-1, 1, 1,-1,0,0,-1,
    -1,-1,-1,-1,0,0,-1,-1, 1,-1,0,0,-1, 1, 1,-1,0,0,-1,-1,-1,-1,0,0,-1, 1, 1,-1,0,0,-1, 1,-1,-1,0,0,
     1,-1, 1,1,0,0, 1,-1,-1,1,0,0, 1, 1,-1,1,0,0, 1,-1, 1,1,0,0, 1, 1,-1,1,0,0, 1, 1, 1,1,0,0,
    -1, 1, 1,0,1,0, 1, 1, 1,0,1,0, 1, 1,-1,0,1,0,-1, 1, 1,0,1,0, 1, 1,-1,0,1,0,-1, 1,-1,0,1,0,
    -1,-1,-1,0,-1,0,1,-1,-1,0,-1,0,1,-1, 1,0,-1,0,-1,-1,-1,0,-1,0,1,-1, 1,0,-1,0,-1,-1, 1,0,-1,0
  ]);

  function normalize(vector) {
    var length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return vector.map(function (value) { return value / length; });
  }
  function facetedVertices(points, faces) {
    var values = [];
    faces.forEach(function (face) {
      var a=points[face[0]], b=points[face[1]], c=points[face[2]];
      var ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      var normal=normalize([ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]);
      [a,b,c].forEach(function (point) { values.push(point[0],point[1],point[2],normal[0],normal[1],normal[2]); });
    });
    return new Float32Array(values);
  }
  var OCTAHEDRON = facetedVertices(
    [[0,1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,-1,0]],
    [[0,2,1],[0,3,2],[0,4,3],[0,1,4],[5,1,2],[5,2,3],[5,3,4],[5,4,1]]
  );

  function compile(gl, type, source) {
    var shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)||'shader compile failed');
    return shader;
  }
  function program(gl) {
    var result=gl.createProgram();
    gl.attachShader(result,compile(gl,gl.VERTEX_SHADER,VERTEX_SHADER));
    gl.attachShader(result,compile(gl,gl.FRAGMENT_SHADER,FRAGMENT_SHADER));
    gl.linkProgram(result);
    if(!gl.getProgramParameter(result,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result)||'program link failed');
    return result;
  }
  function buffer(gl, values) {
    var result=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,result); gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW); return result;
  }
  function modelMatrix(x,y,z,sx,sy,sz,yaw) {
    var cosine=Math.cos(yaw||0), sine=Math.sin(yaw||0);
    return new Float32Array([cosine*sx,0,-sine*sx,0, 0,sy,0,0, sine*sz,0,cosine*sz,0, x,y,z,1]);
  }
  function color(value) {
    var text=String(value||'#46d7e7').replace('#','');
    if(text.length===3) text=text.split('').map(function(c){return c+c;}).join('');
    return [parseInt(text.slice(0,2),16)/255,parseInt(text.slice(2,4),16)/255,parseInt(text.slice(4,6),16)/255];
  }
  function worldX(x) { return (Number(x)-600)/100; }
  function worldZ(y) { return (400-Number(y))/100; }

  function create(canvas) {
    var gl=canvas&&(canvas.getContext('webgl',{alpha:true,antialias:false,depth:true,premultipliedAlpha:false})||canvas.getContext('experimental-webgl'));
    if(!gl){if(canvas)canvas.dataset.status='fallback-canvas-authority';return{available:false,render:function(){}};}
    var shaderProgram=program(gl), cubeBuffer=buffer(gl,CUBE), octaBuffer=buffer(gl,OCTAHEDRON);
    var locations={position:gl.getAttribLocation(shaderProgram,'aPosition'),normal:gl.getAttribLocation(shaderProgram,'aNormal'),model:gl.getUniformLocation(shaderProgram,'uModel'),color:gl.getUniformLocation(shaderProgram,'uColor')};
    gl.useProgram(shaderProgram); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    canvas.dataset.status='active'; canvas.dataset.renderer='webgl-low-poly'; canvas.dataset.paletteSteps='16'; canvas.dataset.modelProfile='duet-relief-v1';
    var drawCalls=0, triangles=0, frame=0;
    function bind(mesh){gl.bindBuffer(gl.ARRAY_BUFFER,mesh);gl.enableVertexAttribArray(locations.position);gl.enableVertexAttribArray(locations.normal);gl.vertexAttribPointer(locations.position,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(locations.normal,3,gl.FLOAT,false,24,12);}
    function draw(mesh,count,x,y,z,sx,sy,sz,tint,yaw){
      gl.uniformMatrix4fv(locations.model,false,modelMatrix(x,y,z,sx,sy,sz,yaw));var rgb=color(tint);gl.uniform3f(locations.color,rgb[0],rgb[1],rgb[2]);bind(mesh);gl.drawArrays(gl.TRIANGLES,0,count);drawCalls+=1;triangles+=count/3;
    }
    function cube(x,y,z,sx,sy,sz,tint,yaw){draw(cubeBuffer,CUBE.length/6,x,y,z,sx,sy,sz,tint,yaw);}
    function octa(x,y,z,sx,sy,sz,tint,yaw){draw(octaBuffer,OCTAHEDRON.length/6,x,y,z,sx,sy,sz,tint,yaw);}
    function paddle(value,tint,active,warden){
      if(!value)return;var x=worldX(value.x),z=worldZ(value.y),half=Number(value.width||150)/200;
      cube(x,0.11,z,half+0.06,0.11,0.15,'#07101b');
      cube(x,0.23,z,half,0.10,0.12,tint);
      cube(x,0.38,z,half*0.46,0.035,0.13,active?'#edf6ff':warden?'#ffe092':'#9cf6ff');
      octa(x-half,0.25,z,0.12,0.18,0.16,tint);octa(x+half,0.25,z,0.12,0.18,0.16,tint);
    }
    function render(timeMs,state,ball){
      gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawCalls=0;triangles=0;
      var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var arena=state&&state.arenas&&state.arenas.find(function(item){return item.id===state.arenaId;});var accent=arena&&arena.accent||'#46d7e7';
      cube(-5.74,0.09,0,0.06,0.09,3.35,'#46d7e7');cube(5.74,0.09,0,0.06,0.09,3.35,'#69dc9a');
      [-3.4,3.4].forEach(function(z){cube(0,0.055,z,5.72,0.055,0.045,'#243647');});
      octa(0,0.10,0,0.38,0.10,0.38,accent);octa(0,0.22,0,0.18,0.20,0.18,'#edf6ff');
      if(state){
        if(state.playMode==='story-coop')paddle(state.paddles.warden,'#f0bd63',false,true);
        paddle(state.paddles.p1,state.players.p1.color,state.power&&state.power.p1&&state.power.p1.active,false);
        paddle(state.paddles.p2,state.players.p2.color,state.power&&state.power.p2&&state.power.p2.active,false);
      }
      if(ball){var bob=reduced?0:Math.sin((Number(timeMs)||0)/180)*0.035,x=worldX(ball.x),z=worldZ(ball.y),radius=Number(ball.radius||16)/100;octa(x,0.21+bob,z,radius*1.15,radius*1.15,radius*1.15,'#46d7e7');octa(x,0.23+bob,z,radius*0.62,radius*0.62,radius*0.62,'#edf6ff');}
      canvas.dataset.drawCalls=String(drawCalls);canvas.dataset.triangles=String(triangles);canvas.dataset.frame=String(++frame);canvas.dataset.arena=state&&state.arenaId||'loading';canvas.dataset.motion=reduced?'reduced-static':'animated-ball-lift';
    }
    return{available:true,render:render};
  }
  window.NeonPongDuetDepth={create:create};
})();
