(function () {
  'use strict';
  var VERTEX_SHADER=`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uModel;varying vec3 vNormal;void main(){vec4 world=uModel*vec4(aPosition,1.0);gl_Position=vec4(world.x/5.0,world.z/5.0+world.y*0.09,0.42-world.y*0.08+world.z*0.002,1.0);vNormal=mat3(uModel)*aNormal;}`;
  var FRAGMENT_SHADER=`precision mediump float;uniform vec3 uColor;varying vec3 vNormal;void main(){vec3 light=normalize(vec3(-0.38,0.9,0.46));float diffuse=max(0.0,dot(normalize(vNormal),light));vec3 lit=uColor*(0.42+diffuse*0.58);vec3 quantized=floor(clamp(lit,0.0,1.0)*15.0+0.5)/15.0;gl_FragColor=vec4(quantized,0.96);}`;
  var CUBE=new Float32Array([
    -1,-1,1,0,0,1,1,-1,1,0,0,1,1,1,1,0,0,1,-1,-1,1,0,0,1,1,1,1,0,0,1,-1,1,1,0,0,1,
    1,-1,-1,0,0,-1,-1,-1,-1,0,0,-1,-1,1,-1,0,0,-1,1,-1,-1,0,0,-1,-1,1,-1,0,0,-1,1,1,-1,0,0,-1,
    -1,-1,-1,-1,0,0,-1,-1,1,-1,0,0,-1,1,1,-1,0,0,-1,-1,-1,-1,0,0,-1,1,1,-1,0,0,-1,1,-1,-1,0,0,
    1,-1,1,1,0,0,1,-1,-1,1,0,0,1,1,-1,1,0,0,1,-1,1,1,0,0,1,1,-1,1,0,0,1,1,1,1,0,0,
    -1,1,1,0,1,0,1,1,1,0,1,0,1,1,-1,0,1,0,-1,1,1,0,1,0,1,1,-1,0,1,0,-1,1,-1,0,1,0,
    -1,-1,-1,0,-1,0,1,-1,-1,0,-1,0,1,-1,1,0,-1,0,-1,-1,-1,0,-1,0,1,-1,1,0,-1,0,-1,-1,1,0,-1,0
  ]);
  function normalize(v){var length=Math.hypot(v[0],v[1],v[2])||1;return v.map(function(value){return value/length;});}
  function facetedVertices(points,faces){var values=[];faces.forEach(function(face){var a=points[face[0]],b=points[face[1]],c=points[face[2]],ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],n=normalize([ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]);[a,b,c].forEach(function(p){values.push(p[0],p[1],p[2],n[0],n[1],n[2]);});});return new Float32Array(values);}
  var OCTAHEDRON=facetedVertices([[0,1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,-1,0]],[[0,2,1],[0,3,2],[0,4,3],[0,1,4],[5,1,2],[5,2,3],[5,3,4],[5,4,1]]);
  function compile(gl,type,source){var shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'shader compile failed');return shader;}
  function makeProgram(gl){var result=gl.createProgram();gl.attachShader(result,compile(gl,gl.VERTEX_SHADER,VERTEX_SHADER));gl.attachShader(result,compile(gl,gl.FRAGMENT_SHADER,FRAGMENT_SHADER));gl.linkProgram(result);if(!gl.getProgramParameter(result,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(result)||'program link failed');return result;}
  function makeBuffer(gl,data){var result=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,result);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return result;}
  function modelMatrix(x,y,z,sx,sy,sz,yaw){var c=Math.cos(yaw||0),s=Math.sin(yaw||0);return new Float32Array([c*sx,0,-s*sx,0,0,sy,0,0,s*sz,0,c*sz,0,x,y,z,1]);}
  function color(value){var text=String(value||'#46d7e7').replace('#','');if(text.length===3)text=text.split('').map(function(c){return c+c;}).join('');return[parseInt(text.slice(0,2),16)/255,parseInt(text.slice(2,4),16)/255,parseInt(text.slice(4,6),16)/255];}
  function worldX(x){return(Number(x)-500)/100;}function worldZ(y){return(500-Number(y))/100;}
  function create(canvas){
    var gl=canvas&&(canvas.getContext('webgl',{alpha:true,antialias:false,depth:true,premultipliedAlpha:false})||canvas.getContext('experimental-webgl'));
    if(!gl){if(canvas)canvas.dataset.status='fallback-canvas-authority';return{available:false,render:function(){}};}
    var shaderProgram=makeProgram(gl),cubeBuffer=makeBuffer(gl,CUBE),octaBuffer=makeBuffer(gl,OCTAHEDRON),locations={position:gl.getAttribLocation(shaderProgram,'aPosition'),normal:gl.getAttribLocation(shaderProgram,'aNormal'),model:gl.getUniformLocation(shaderProgram,'uModel'),color:gl.getUniformLocation(shaderProgram,'uColor')};
    gl.useProgram(shaderProgram);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    canvas.dataset.status='active';canvas.dataset.renderer='webgl-low-poly';canvas.dataset.paletteSteps='16';canvas.dataset.modelProfile='cross-relief-v1';
    var drawCalls=0,triangles=0,frame=0;
    function bind(mesh){gl.bindBuffer(gl.ARRAY_BUFFER,mesh);gl.enableVertexAttribArray(locations.position);gl.enableVertexAttribArray(locations.normal);gl.vertexAttribPointer(locations.position,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(locations.normal,3,gl.FLOAT,false,24,12);}
    function draw(mesh,count,x,y,z,sx,sy,sz,tint,yaw){gl.uniformMatrix4fv(locations.model,false,modelMatrix(x,y,z,sx,sy,sz,yaw));var rgb=color(tint);gl.uniform3f(locations.color,rgb[0],rgb[1],rgb[2]);bind(mesh);gl.drawArrays(gl.TRIANGLES,0,count);drawCalls+=1;triangles+=count/3;}
    function cube(x,y,z,sx,sy,sz,tint,yaw){draw(cubeBuffer,CUBE.length/6,x,y,z,sx,sy,sz,tint,yaw);}function octa(x,y,z,sx,sy,sz,tint,yaw){draw(octaBuffer,OCTAHEDRON.length/6,x,y,z,sx,sy,sz,tint,yaw);}
    function paddle(value,player,active){if(!value||!player||!player.alive)return;var x=worldX(value.x),z=worldZ(value.y),half=Number(value.length||160)/200,yaw=value.horizontal?0:Math.PI/2,tint=player.color||'#46d7e7',warden=player.role==='warden';cube(x,0.11,z,half+0.06,0.11,Number(value.thickness||24)/200+0.03,'#07101b',yaw);cube(x,0.23,z,half,0.10,Number(value.thickness||24)/200,tint,yaw);cube(x,0.38,z,half*0.44,0.035,0.13,active?'#edf6ff':warden?'#ffe092':'#9cf6ff',yaw);if(value.horizontal){octa(x-half,0.25,z,0.12,0.18,0.16,tint);octa(x+half,0.25,z,0.12,0.18,0.16,tint);}else{octa(x,0.25,z-half,0.16,0.18,0.12,tint);octa(x,0.25,z+half,0.16,0.18,0.12,tint);}}
    function render(timeMs,state){
      gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawCalls=0;triangles=0;var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      cube(0,0.055,4.74,4.72,0.055,0.045,'#ff3dd8');cube(0,0.055,-4.74,4.72,0.055,0.045,'#46d7e7');cube(-4.74,0.055,0,4.72,0.055,0.045,'#f0bd63',Math.PI/2);cube(4.74,0.055,0,4.72,0.055,0.045,'#69dc9a',Math.PI/2);
      if(state){
        var armed=state.playMode==='coop'&&state.mission&&state.mission.relayArmed,prism=armed?'#69dc9a':'#f2877f',radius=Number(state.diamond&&state.diamond.radius||60)/100,angle=Number(state.diamond&&state.diamond.angle||0)+Math.PI/4;
        cube(0,0.17,0,radius,0.17,radius,'#101827',angle);cube(0,0.37,0,radius*0.72,0.08,radius*0.72,prism,angle);octa(0,0.56,0,radius*0.32,0.26,radius*0.32,armed?'#edf6ff':'#ffb29f',angle);
        ['p1','p2','p3','p4'].forEach(function(id){paddle(state.paddles[id],state.players[id],state.power&&state.power[id]&&state.power[id].active);});
        gl.disable(gl.DEPTH_TEST);
        (state.balls||[state.ball]).filter(Boolean).forEach(function(ball,index){var bob=reduced?0:Math.sin((Number(timeMs)||0)/170+index)*0.035,x=worldX(ball.x),z=worldZ(ball.y),r=Number(ball.radius||14)/100,tint=index?'#f0bd63':'#46d7e7';octa(x,0.20+bob,z,r*1.18,r*1.18,r*1.18,tint);octa(x,0.22+bob,z,r*0.60,r*0.60,r*0.60,'#edf6ff');});
        gl.enable(gl.DEPTH_TEST);
      }
      canvas.dataset.drawCalls=String(drawCalls);canvas.dataset.triangles=String(triangles);canvas.dataset.frame=String(++frame);canvas.dataset.arena=state&&state.arenaId||'loading';canvas.dataset.mode=state&&state.playMode||'loading';canvas.dataset.motion=reduced?'reduced-static':'animated-ball-lift';
    }
    return{available:true,render:render};
  }
  window.NeonPongCrossDepth={create:create};
})();
