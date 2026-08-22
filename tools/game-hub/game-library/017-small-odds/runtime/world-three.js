const INTERNAL_WIDTH = 480;
const INTERNAL_HEIGHT = 270;
const PALETTE_STEPS = 16;

const vertexSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uMvp;
uniform mat4 uModel;
uniform vec3 uColor;
varying vec3 vColor;
void main() {
  vec3 normal = normalize(mat3(uModel) * aNormal);
  float light = 0.34 + max(0.0, dot(normal, normalize(vec3(-0.42, 0.82, 0.55)))) * 0.66;
  vColor = floor((uColor * light) * 15.0 + 0.5) / 15.0;
  gl_Position = uMvp * vec4(aPosition, 1.0);
}`;

const fragmentSource = `
precision mediump float;
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 1.0); }`;

function multiply(a,b) {
  const out = new Float32Array(16);
  for (let column=0; column<4; column+=1) {
    for (let row=0; row<4; row+=1) {
      out[column*4+row] = a[row] * b[column*4] + a[4+row] * b[column*4+1] + a[8+row] * b[column*4+2] + a[12+row] * b[column*4+3];
    }
  }
  return out;
}

function perspective(fov,aspect,near,far) {
  const f = 1 / Math.tan(fov/2), nf = 1/(near-far);
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}

function lookAt(eye,target,up=[0,1,0]) {
  let zx=eye[0]-target[0], zy=eye[1]-target[1], zz=eye[2]-target[2];
  let length=Math.hypot(zx,zy,zz)||1; zx/=length; zy/=length; zz/=length;
  let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
  length=Math.hypot(xx,xy,xz)||1; xx/=length; xy/=length; xz/=length;
  const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
  return new Float32Array([
    xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
    -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
    -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
    -(zx*eye[0]+zy*eye[1]+zz*eye[2]),1
  ]);
}

function model(position=[0,0,0],scale=[1,1,1],rotationY=0,rotationZ=0) {
  const cy=Math.cos(rotationY), sy=Math.sin(rotationY), cz=Math.cos(rotationZ), sz=Math.sin(rotationZ);
  return new Float32Array([
    cy*cz*scale[0], sz*scale[0], -sy*cz*scale[0], 0,
    -cy*sz*scale[1], cz*scale[1], sy*sz*scale[1], 0,
    sy*scale[2], 0, cy*scale[2], 0,
    position[0],position[1],position[2],1
  ]);
}

function color(hex) {
  const value=parseInt(hex.replace('#',''),16);
  return [(value>>16&255)/255,(value>>8&255)/255,(value&255)/255];
}

function compile(gl,type,source) {
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'WebGL shader compilation failed.');
  return shader;
}

function buildProgram(gl) {
  const program=gl.createProgram();
  gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertexSource));
  gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'WebGL program link failed.');
  return program;
}

function cubeData() {
  const vertices=[];
  const face=(normal,a,b,c,d) => {
    for (const point of [a,b,c,a,c,d]) vertices.push(...point,...normal);
  };
  face([0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]);
  face([0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]);
  face([1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]);
  face([-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]);
  face([0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]);
  face([0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]);
  return vertices;
}

function pyramidData() {
  const vertices=[];
  const tri=(normal,a,b,c) => vertices.push(...a,...normal,...b,...normal,...c,...normal);
  tri([0,.55,.83],[-1,-1,1],[1,-1,1],[0,1,0]);
  tri([.83,.55,0],[1,-1,1],[1,-1,-1],[0,1,0]);
  tri([0,.55,-.83],[1,-1,-1],[-1,-1,-1],[0,1,0]);
  tri([-.83,.55,0],[-1,-1,-1],[-1,-1,1],[0,1,0]);
  tri([0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1]);
  tri([0,-1,0],[-1,-1,-1],[1,-1,1],[-1,-1,1]);
  return vertices;
}

function octahedronData() {
  const vertices=[];
  const tri=(normal,a,b,c) => vertices.push(...a,...normal,...b,...normal,...c,...normal);
  const top=[0,1,0], bottom=[0,-1,0], front=[0,0,1], right=[1,0,0], back=[0,0,-1], left=[-1,0,0];
  tri([.58,.58,.58],top,front,right);
  tri([.58,.58,-.58],top,right,back);
  tri([-.58,.58,-.58],top,back,left);
  tri([-.58,.58,.58],top,left,front);
  tri([.58,-.58,.58],bottom,right,front);
  tri([.58,-.58,-.58],bottom,back,right);
  tri([-.58,-.58,-.58],bottom,left,back);
  tri([-.58,-.58,.58],bottom,front,left);
  return vertices;
}

function createMesh(gl,values) {
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);
  return { buffer, count:values.length/6, triangles:values.length/18 };
}

const scenePalette = {
  shore:{ sky:'#24142f',ground:'#356482',accent:'#cb6bb7',structure:'#694463' },
  room:{ sky:'#2e1c3a',ground:'#503147',accent:'#f0b95e',structure:'#76536a' },
  kitchen:{ sky:'#39212d',ground:'#674638',accent:'#80d8b1',structure:'#8c5947' },
  district:{ sky:'#182c3b',ground:'#3d5260',accent:'#f0b95e',structure:'#785064' },
  market:{ sky:'#291736',ground:'#68405b',accent:'#dd75c6',structure:'#80506f' },
  starspite:{ sky:'#0b0820',ground:'#251e4b',accent:'#b79aff',structure:'#4d3d7b' }
};

export class WorldThreeRenderer {
  constructor(canvas,getView) {
    this.canvas=canvas;
    this.getView=getView;
    this.running=false;
    try {
      this.gl=canvas?.getContext('webgl',{ alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true });
      if (!this.gl) throw new Error('WebGL unavailable');
      this.program=buildProgram(this.gl);
      this.cube=createMesh(this.gl,cubeData());
      this.pyramid=createMesh(this.gl,pyramidData());
      this.octahedron=createMesh(this.gl,octahedronData());
      this.position=this.gl.getAttribLocation(this.program,'aPosition');
      this.normal=this.gl.getAttribLocation(this.program,'aNormal');
      this.mvp=this.gl.getUniformLocation(this.program,'uMvp');
      this.modelUniform=this.gl.getUniformLocation(this.program,'uModel');
      this.colorUniform=this.gl.getUniformLocation(this.program,'uColor');
      canvas.width=INTERNAL_WIDTH;
      canvas.height=INTERNAL_HEIGHT;
      canvas.dataset.renderer='webgl-low-poly';
      canvas.dataset.resolution=`${INTERNAL_WIDTH}x${INTERNAL_HEIGHT}`;
      canvas.dataset.paletteSteps=String(PALETTE_STEPS);
      canvas.dataset.authority='visual-only-canvas2d-simulation-authority';
      canvas.dataset.pass='small-odds-faceted-world-01';
      canvas.dataset.changesAuthority='false';
      canvas.dataset.changesCollision='false';
      this.gl.enable(this.gl.DEPTH_TEST);
      this.gl.enable(this.gl.CULL_FACE);
      this.gl.cullFace(this.gl.BACK);
      this.projection=perspective(Math.PI/4,INTERNAL_WIDTH/INTERNAL_HEIGHT,.1,100);
      this.running=true;
      this.frame=time => {
        if (!this.running) return;
        this.draw(time*.001);
        this.frameId=requestAnimationFrame(this.frame);
      };
      this.frameId=requestAnimationFrame(this.frame);
    } catch (error) {
      if (canvas) {
        canvas.dataset.renderer='canvas2d-fallback';
        canvas.dataset.fallbackReason=String(error.message || error);
        canvas.hidden=true;
        const authority=canvas.nextElementSibling;
        if (authority) authority.style.opacity='1';
      }
    }
  }

  stop() {
    this.running=false;
    cancelAnimationFrame(this.frameId);
  }

  mesh(meshType,position,scale,hex,rotationY=0,rotationZ=0) {
    const gl=this.gl;
    const mesh=meshType === 'pyramid' ? this.pyramid : meshType === 'octahedron' ? this.octahedron : this.cube;
    const modelMatrix=model(position,scale,rotationY,rotationZ);
    const mvp=multiply(this.viewProjection,modelMatrix);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(this.normal);
    gl.vertexAttribPointer(this.normal,3,gl.FLOAT,false,24,12);
    gl.uniformMatrix4fv(this.mvp,false,mvp);
    gl.uniformMatrix4fv(this.modelUniform,false,modelMatrix);
    gl.uniform3fv(this.colorUniform,color(hex));
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
    this.drawCalls+=1;
    this.triangles+=mesh.triangles;
  }

  building(x,z,height,palette,roof=true) {
    this.mesh('cube',[x,height/2,z],[.72,height/2,.65],palette.structure,(x+z)*.06);
    if (roof) this.mesh('pyramid',[x,height+.32,z],[.82,.36,.74],palette.accent,(x+z)*.06);
    this.mesh('cube',[x-.22,height*.62,z+.67],[.09,.12,.025],palette.accent);
    this.mesh('cube',[x+.24,height*.38,z+.67],[.08,.1,.025],palette.accent);
  }

  drawShore(p,t) {
    this.mesh('cube',[0,-.65,0],[8,.55,6],p.ground);
    for (let i=0;i<9;i+=1) this.building(-5.7+i*1.45,2.2+(i%2)*.5,1.1+(i%4)*.48,p,false);
    for (let i=0;i<6;i+=1) this.mesh('cube',[-4.8+i*1.9,-.04,1.2+Math.sin(t*.5+i)*.12],[1.05,.055,2.6],i%2?p.accent:'#508da0',0,.04*Math.sin(t+i));
    for (let i=0;i<8;i+=1) {
      const x=-5.25+i*1.5, z=.72+(i%3)*.74, bob=Math.sin(t*.72+i*1.9)*.07;
      this.mesh('octahedron',[x,.18+bob,z],[.18+(i%2)*.08,.24,.16+(i%3)*.035],i%2?'#7fd5d1':'#d476c2',t*.08+i);
    }
    this.mesh('octahedron',[2.3,.65,.7],[1.05,.95,.88],'#3f6975',t*.08);
    this.mesh('cube',[2.3,.62,1.53],[.24,.24,.08],'#f2bd67');
    for (let i=0;i<7;i+=1) {
      const angle=-1.2+i*.4;
      this.mesh('cube',[2.3+Math.sin(angle)*.78,.12,.7+Math.cos(angle)*.62],[.085,.38,.085],'#31535e',-angle,angle*.16);
    }
  }

  drawRoom(p,t,state) {
    this.mesh('cube',[0,-.35,0],[6,.25,5],p.ground);
    this.mesh('cube',[0,2.2,-4.5],[6,2.6,.18],p.structure);
    this.mesh('cube',[-4.9,2.2,0],[.18,2.6,4.5],p.structure);
    this.mesh('cube',[-2.4,.35,-1.2],[1.45,.35,1.3],'#7d5166');
    this.mesh('cube',[-2.4,.79,-1.2],[1.48,.09,1.34],'#d9a76c');
    for (let i=0;i<3;i+=1) this.mesh('cube',[1.7+i*.85,.45,-2.4],[.31,.5,.4],i%2?p.accent:'#87576f',0,.06*i);
    if (state.business) {
      this.mesh('cube',[2.1,.62,.4],[1.25,.12,.72],'#30233b');
      this.mesh('cube',[2.1,1.2,.25],[1.08,.48,.07],p.accent);
    }
    if (state.home.score>5) this.mesh('pyramid',[-.2,1.25,-3.9],[.35,.65,.32],'#7fe3b1',t*.14);
    this.mesh('cube',[4.15,.72,-3.75],[.11,.72,.11],'#d59a55');
    this.mesh('octahedron',[4.15,1.62,-3.75],[.48,.54,.48],'#f2bd67',t*.08);
    for (let i=0;i<4;i+=1) this.mesh('cube',[-.6+i*.42,.26,2.9],[.15,.26,.18],i%2?'#6c4862':'#d18769',0,.08*(i-1.5));
  }

  drawKitchen(p,t) {
    this.mesh('cube',[0,-.35,0],[6,.25,5],p.ground);
    this.mesh('cube',[0,2.2,-4.5],[6,2.6,.18],p.structure);
    this.mesh('cube',[0,.78,.1],[2.35,.1,1.05],'#b67855');
    for (const x of [-1.7,1.7]) this.mesh('cube',[x,.35,.1],[.14,.55,.14],'#6a463b');
    this.mesh('cube',[-3.7,.65,-2.7],[.75,.75,.55],'#526b69');
    this.mesh('pyramid',[-3.7,1.68,-2.7],[.38,.62,.38],p.accent,t*.2);
    for (let i=0;i<5;i+=1) this.mesh('cube',[2.7,.3+i*.42,-3.9],[.85,.12,.25],i%2?p.accent:'#8c5947');
    for (let i=0;i<5;i+=1) {
      const angle=i/5*Math.PI*2+t*.035;
      this.mesh('octahedron',[Math.cos(angle)*.76,.98,Math.sin(angle)*.42],[.16,.12,.16],i%2?'#f2bd67':'#7fe3b1',angle);
    }
  }

  drawDistrict(p,t,state) {
    this.mesh('cube',[0,-.42,0],[7,.22,6],p.ground);
    this.mesh('cube',[0,-.16,.2],[1.18,.08,6],'#273442');
    for (let i=0;i<7;i+=1) {
      this.building(-5.2+i*1.75,2.1+(i%2)*1.15,1.45+(i%3)*.42,p,true);
      this.mesh('cube',[-5.2+i*1.75,.02,.25],[.42,.025,.16],i%2?'#f2bd67':'#7fe3b1',0,.08*(i%2?1:-1));
    }
    this.mesh('cube',[-1.55,.48,-.35],[.85,.48,.55],'#9b5c55');
    this.mesh('pyramid',[-1.55,1.28,-.35],[.95,.42,.65],'#f2bd67');
    this.mesh('cube',[2.15,.38,-.5],[1.15,.38,.55],'#526c73');
    this.mesh('cube',[2.15,.86,-.5],[1.05,.1,.52],'#8bd9ef');
    for (const x of [-4.25,0,4.25]) {
      this.mesh('cube',[x,.72,1.18],[.07,.72,.07],'#9bcbd0');
      this.mesh('octahedron',[x,1.58,1.18],[.28,.34,.28],'#f2bd67',t*.06+x);
    }
    const marks=[...(state.starspite?.aftermath?.history||[]).map(entry=>entry.visual),state.starspite?.aftermath?.active?.visual].filter(Boolean);
    this.canvas.dataset.debtMarkers=[...new Set(marks)].join(',') || 'none';
    const unique=[...new Set(marks)];
    unique.forEach((visual,index) => this.debtMarker(visual,-2.4+index*2.35,.15,1.2,t));
  }

  debtMarker(visual,x,y,z,t) {
    if (visual === 'solidarity-ribbons') {
      for (let i=0;i<3;i+=1) this.mesh('cube',[x+i*.18,y+.65+i*.13,z],[.055,.55,.055],i%2?'#7fe3b1':'#f2bd67',0,.16*Math.sin(t+i));
    } else if (visual === 'repayment-stamp') {
      this.mesh('cube',[x,y+.38,z],[.62,.38,.12],'#f2bd67',-.12);
      this.mesh('cube',[x,y+.87,z],[.22,.12,.2],'#7b4c60');
    } else if (visual === 'breathing-room-lamp') {
      this.mesh('cube',[x,y+.42,z],[.08,.42,.08],'#8bd9ef');
      this.mesh('pyramid',[x,y+1.02,z],[.38,.42,.34],'#b8eff3',t*.15);
    }
  }

  drawMarket(p,t) {
    this.mesh('cube',[0,-.4,0],[7,.22,6],p.ground);
    for (let i=0;i<8;i+=1) {
      const x=-4.8+(i%4)*3.15, z=-2.2+Math.floor(i/4)*3.4;
      this.mesh('cube',[x,.32,z],[1.05,.32,.72],i%2?'#76536a':'#5c4962',.07*(i%3-1));
      this.mesh('pyramid',[x,1.1,z],[1.25,.72,.88],i%2?p.accent:'#8bd9ef',.07*(i%3-1));
    }
    for (let i=0;i<10;i+=1) this.mesh('pyramid',[-5+i*1.08,.06,1.2+Math.sin(i)*.8],[.16,.22,.16],i%2?'#f2bd67':'#7fe3b1',t*.1+i);
    for (let i=0;i<6;i+=1) {
      const x=-4.15+i*1.65;
      this.mesh('octahedron',[x,1.75+Math.sin(t*.8+i)*.12,-3.15],[.2,.3,.2],i%2?'#8bd9ef':'#f2bd67',t*.12+i);
    }
  }

  drawStarspite(p,t) {
    this.mesh('cube',[0,-.42,0],[7,.22,6],p.ground);
    this.mesh('cube',[0,2.45,-4.8],[7,2.8,.13],p.structure);
    for (let i=0;i<12;i+=1) {
      const angle=i/12*Math.PI*2+t*.025;
      this.mesh('cube',[Math.cos(angle)*4.2,1.25,Math.sin(angle)*2.75],[.11,1.25,.11],i%3===0?'#f2bd67':p.accent,-angle);
    }
    for (let i=0;i<3;i+=1) {
      const x=-2.5+i*2.5;
      this.mesh('cube',[x,.22,.25],[.82,.22,.72],'#302a58',i*.1);
      this.mesh('pyramid',[x,.78,.25],[.52,.45,.48],i===1?'#8bd9ef':p.accent,t*.16+i);
    }
    this.mesh('pyramid',[0,1.95,-3.95],[.72,1.2,.55],'#b79aff',-t*.09);
    for (let i=0;i<7;i+=1) {
      const angle=i/7*Math.PI*2;
      this.mesh('octahedron',[Math.cos(angle)*2.1,1.25+Math.sin(t*.6+i)*.12,-3.55+Math.sin(angle)*.42],[.18,.34,.18],i%2?'#8bd9ef':'#b79aff',t*.16+i);
    }
  }

  drawPip(t,state) {
    const focuses=[-2.8,0,2.8];
    const x=focuses[Math.max(0,Math.min(2,state.focus||0))];
    const bob=Math.sin(t*2.4)*.035, sway=.08*Math.sin(t), stride=.12*Math.sin(t*2.4);
    this.mesh('cube',[x,.025,2.55],[.5,.025,.28],'#241a31',0,.03*Math.sin(t));
    this.mesh('cube',[x,.48+bob,2.55],[.29,.4,.24],'#e36d62',sway);
    this.mesh('cube',[x,.54+bob,2.79],[.23,.25,.08],'#70445b',sway);
    this.mesh('octahedron',[x,.99+bob,2.55],[.39,.3,.34],'#f28b70',sway);
    this.mesh('pyramid',[x-.22,1.25+bob,2.52],[.12,.22,.12],'#d66560',-.22+sway);
    this.mesh('pyramid',[x+.22,1.25+bob,2.52],[.12,.22,.12],'#d66560',.22+sway);
    this.mesh('cube',[x-.13,1.02+bob,2.87],[.065,.072,.035],'#f6efc8');
    this.mesh('cube',[x+.13,1.02+bob,2.87],[.065,.072,.035],'#f6efc8');
    this.mesh('cube',[x-.13,1.02+bob,2.91],[.024,.032,.018],'#21182c');
    this.mesh('cube',[x+.13,1.02+bob,2.91],[.024,.032,.018],'#21182c');
    this.mesh('cube',[x-.38,.53+bob,2.56],[.075,.3,.075],'#d66560',0,-.18+stride);
    this.mesh('cube',[x+.38,.53+bob,2.56],[.075,.3,.075],'#d66560',0,.18-stride);
    this.mesh('octahedron',[x-.43,.25+bob,2.58],[.1,.1,.1],'#f28b70');
    this.mesh('octahedron',[x+.43,.25+bob,2.58],[.1,.1,.1],'#f28b70');
    this.mesh('cube',[x-.2,.16,2.55],[.09,.21,.1],'#663f54',0,stride);
    this.mesh('cube',[x+.2,.16,2.55],[.09,.21,.1],'#663f54',0,-stride);
  }

  draw(time) {
    const view=this.getView();
    if (!view?.state) return;
    const state=view.state;
    const motion=state.settings.motion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t=motion?time:0;
    const palette=scenePalette[state.location] || scenePalette.shore;
    const gl=this.gl;
    const clear=color(palette.sky);
    gl.viewport(0,0,INTERNAL_WIDTH,INTERNAL_HEIGHT);
    gl.clearColor(clear[0],clear[1],clear[2],1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    this.drawCalls=0;
    this.triangles=0;
    const cameraX=Math.sin(t*.08)*.35;
    const viewMatrix=lookAt([cameraX,5.1,10.8],[0,.75,.25]);
    this.viewProjection=multiply(this.projection,viewMatrix);
    this.canvas.dataset.location=state.location;
    this.canvas.dataset.motion=motion?'animated':'reduced';
    if (state.location==='shore') this.drawShore(palette,t,state);
    else if (state.location==='room') this.drawRoom(palette,t,state);
    else if (state.location==='kitchen') this.drawKitchen(palette,t,state);
    else if (state.location==='district') this.drawDistrict(palette,t,state);
    else if (state.location==='market') this.drawMarket(palette,t,state);
    else this.drawStarspite(palette,t,state);
    this.drawPip(t,state);
    this.canvas.dataset.drawCalls=String(this.drawCalls);
    this.canvas.dataset.triangles=String(this.triangles);
    this.canvas.dataset.frame=String((Number(this.canvas.dataset.frame)||0)+1);
  }
}
