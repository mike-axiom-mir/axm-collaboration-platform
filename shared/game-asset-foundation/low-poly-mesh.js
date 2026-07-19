'use strict';

function finite3(value) { return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite); }
function mesh(name) { return { name:String(name || 'asset'), triangles:[] }; }
function tri(target, a, b, c, material) {
  if (![a,b,c].every(finite3)) throw new Error('Triangle vertices must be finite vec3 values');
  target.triangles.push({ points:[a,b,c], material:String(material || 'concrete') });
}
function quad(target, a, b, c, d, material) { tri(target,a,b,c,material); tri(target,a,c,d,material); }
function addBox(target, center, size, materials) {
  const [cx,cy,cz]=center,[sx,sy,sz]=size,x0=cx-sx/2,x1=cx+sx/2,y0=cy-sy/2,y1=cy+sy/2,z0=cz-sz/2,z1=cz+sz/2;
  const m=typeof materials==='string'?{side:materials,front:materials,top:materials,bottom:materials}:Object.assign({side:'concrete',front:'concrete',top:'roof',bottom:'concrete'},materials||{});
  quad(target,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],m.front);
  quad(target,[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],m.side);
  quad(target,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],m.side);
  quad(target,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],m.side);
  quad(target,[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],m.top);
  quad(target,[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],m.bottom);
}
function mapAxis(axis, along, u, v) { return axis==='x'?[along,u,v]:axis==='z'?[u,v,along]:[u,along,v]; }
function addCylinder(target, center, radius, length, segments, material, axis) {
  const count=Math.max(3,Math.floor(segments||8)),half=length/2,front=[],back=[];
  for(let i=0;i<count;i++){const angle=Math.PI*2*i/count,u=Math.cos(angle)*radius,v=Math.sin(angle)*radius;front.push(mapAxis(axis||'y',half,u,v).map((n,j)=>n+center[j]));back.push(mapAxis(axis||'y',-half,u,v).map((n,j)=>n+center[j]));}
  const fc=mapAxis(axis||'y',half,0,0).map((n,j)=>n+center[j]),bc=mapAxis(axis||'y',-half,0,0).map((n,j)=>n+center[j]);
  for(let i=0;i<count;i++){const next=(i+1)%count;quad(target,back[i],back[next],front[next],front[i],material);tri(target,fc,front[i],front[next],material);tri(target,bc,back[next],back[i],material);}
}
function addGableRoof(target, center, size, material) {
  const [cx,cy,cz]=center,[sx,sy,sz]=size,x0=cx-sx/2,x1=cx+sx/2,y0=cy-sy/2,y1=cy+sy/2,z0=cz-sz/2,z1=cz+sz/2;
  const p=[[x0,y0,z0],[x1,y0,z0],[x0,y0,z1],[x1,y0,z1],[cx,y1,z0],[cx,y1,z1]];
  quad(target,p[0],p[2],p[5],p[4],material);quad(target,p[3],p[1],p[4],p[5],material);tri(target,p[0],p[4],p[1],material);tri(target,p[2],p[3],p[5],material);quad(target,p[0],p[1],p[3],p[2],material);
}
function addOctahedron(target, center, radius, material) {
  const [x,y,z]=center,r=radius,p=[[x,y+r,z],[x+r,y,z],[x,y,z+r],[x-r,y,z],[x,y,z-r],[x,y-r,z]];
  [[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2],[5,4,3],[5,1,4]].forEach(f=>tri(target,p[f[0]],p[f[1]],p[f[2]],material));
}
function building(id,lod) {
  const out=mesh(id),warehouse=id==='warehouse',shop=id==='corner-shop',row=id==='row-houses',w=warehouse?12:row?12:shop?8:9,d=warehouse?10:shop?8:7,h=warehouse?5:shop?6:row?7:15;
  addBox(out,[0,h/2,0],[w,h,d],{front:id==='apartment-midrise'?'brick':'concrete',side:warehouse?'metal':'brick',top:'roof'});
  if(lod<2){addGableRoof(out,[0,h+.65,0],[w+.25,1.3,d+.25],'roof');addBox(out,[0,1.25,d/2+.08],[shop?2.4:1.2,2.5,.16],{side:'trim',front:'trim',top:'trim'});}
  if(lod===0){const floors=Math.max(1,Math.min(5,Math.floor(h/2.5))),columns=warehouse?3:row?5:3;for(let floor=0;floor<floors;floor++)for(let col=0;col<columns;col++){const x=-w*.36+(columns===1?0:col*(w*.72/(columns-1))),y=2.2+floor*2.25;addBox(out,[x,y,d/2+.06],[w/(columns*2.4),.9,.12],{side:'glass',front:'glass',top:'glass'});}if(shop)addBox(out,[0,3.25,d/2+.35],[w*.75,.45,.7],{side:'sign',front:'sign',top:'sign'});}
  return out;
}
function road(id,lod) {
  const out=mesh(id),size=id==='sidewalk-plaza'?12:16;addBox(out,[0,.05,0],[size,.1,size],id==='sidewalk-plaza'?'concrete':'asphalt');
  if(id==='sidewalk-plaza'&&lod<2)addBox(out,[0,.115,0],[size*.55,.03,size*.55],'trim');
  if(lod<2&&id!=='sidewalk-plaza'){if(id==='road-straight'||id==='road-cross')for(let z=-6;z<=6;z+=4)addBox(out,[0,.12,z],[.18,.04,1.8],'lane');if(id==='road-corner'||id==='road-cross')for(let x=-6;x<=6;x+=4)addBox(out,[x,.12,0],[1.8,.04,.18],'lane');}
  if(lod===0){addBox(out,[-size/2+.5,.18,0],[1,.25,size],'concrete');addBox(out,[size/2-.5,.18,0],[1,.25,size],'concrete');}
  return out;
}
function prop(id,lod) {
  const out=mesh(id),seg=lod===0?8:lod===1?5:3;
  if(id==='streetlamp'){addCylinder(out,[0,2,0],.09,4,seg,'metal','y');if(lod<2)addBox(out,[0,4.05,.22],[.6,.18,.55],{side:'metal',front:'emissive',top:'metal'});}
  else if(id==='bench'){addBox(out,[0,.75,0],[2.2,.18,.65],'wood');if(lod<2){addBox(out,[0,1.3,-.28],[2.2,1,.16],'wood');addBox(out,[-.8,.38,0],[.12,.75,.55],'metal');addBox(out,[.8,.38,0],[.12,.75,.55],'metal');}if(lod===0){addBox(out,[-1.02,1.05,0],[.12,.18,.75],'metal');addBox(out,[1.02,1.05,0],[.12,.18,.75],'metal');}}
  else if(id==='street-bin'){addCylinder(out,[0,.65,0],.42,1.3,seg,'metal','y');}
  else if(id==='hydrant'){addCylinder(out,[0,.55,0],.28,1.1,seg,'vehicle','y');if(lod<2)addCylinder(out,[0,1.05,0],.4,.16,seg,'metal','y');}
  else if(id==='barrier'){addBox(out,[0,.8,0],[2.6,.28,.25],{side:'lane',front:'lane',top:'lane'});if(lod<2){addBox(out,[-.9,.35,0],[.18,.9,.18],'metal');addBox(out,[.9,.35,0],[.18,.9,.18],'metal');}if(lod===0){addBox(out,[-.55,.81,.14],[.34,.12,.04],'emissive');addBox(out,[.55,.81,.14],[.34,.12,.04],'emissive');}}
  else {addCylinder(out,[0,1.4,0],.25,2.8,seg,'bark','y');if(lod<2){addOctahedron(out,[0,3.2,0],1.35,'grass');if(lod===0){addOctahedron(out,[.7,3,0],.8,'grass');addOctahedron(out,[-.65,3.05,.2],.75,'grass');}}}
  return out;
}
function vehicle(id,lod) {
  const out=mesh(id),van=id==='van',h=van?1.65:1.15,colour=id==='taxi'?'lane':id==='patrol-car'?'sign':'vehicle';addBox(out,[0,.65,0],[1.75,.65,4.1],{side:colour,front:colour,top:colour});addBox(out,[0,1.2,van?-.25:.1],[1.55,h,van?2.8:2.05],{side:'glass',front:'glass',top:colour});
  if(lod<2){const seg=lod===0?8:5;[-.88,.88].forEach(x=>[-1.25,1.25].forEach(z=>addCylinder(out,[x,.48,z],.38,.22,seg,'tire','x')));}
  if(lod===0){addBox(out,[0,.62,2.1],[1.45,.22,.18],'trim');addBox(out,[0,.62,-2.1],[1.45,.22,.18],'trim');if(id==='taxi')addBox(out,[0,2.03,0],[.6,.2,.35],'sign');if(id==='patrol-car')addBox(out,[0,1.95,0],[.9,.14,.22],'emissive');}
  return out;
}
function character(id,lod) {
  const out=mesh(id),skin=id==='civilian-b'?'trim':'skin',cloth=id==='civilian-b'?'vehicle':'cloth';addBox(out,[0,1.25,0],[.55,.9,.32],cloth);addOctahedron(out,[0,1.92,0],.3,skin);if(lod===0){addBox(out,[-.38,1.22,0],[.18,.9,.2],skin);addBox(out,[.38,1.22,0],[.18,.9,.2],skin);addBox(out,[-.18,.48,0],[.2,.95,.24],cloth);addBox(out,[.18,.48,0],[.2,.95,.24],cloth);}else if(lod===1){addBox(out,[-.16,.5,0],[.22,.95,.24],cloth);addBox(out,[.16,.5,0],[.22,.95,.24],cloth);}return out;
}
function build(definition,lod) {
  if(!definition||!definition.id||!definition.category)throw new Error('Asset definition requires id and category');
  if(![0,1,2].includes(lod))throw new Error('LOD must be 0, 1 or 2');
  if(definition.category==='building')return building(definition.id,lod);
  if(definition.category==='road')return road(definition.id,lod);
  if(definition.category==='prop')return prop(definition.id,lod);
  if(definition.category==='vehicle')return vehicle(definition.id,lod);
  if(definition.category==='character')return character(definition.id,lod);
  throw new Error('Unsupported game asset category');
}
function normal(a,b,c){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,l=Math.hypot(x,y,z)||1;return[x/l,y/l,z/l];}
function bounds(value){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];value.triangles.forEach(t=>t.points.forEach(p=>p.forEach((n,i)=>{min[i]=Math.min(min[i],n);max[i]=Math.max(max[i],n);})));return{min,max,size:max.map((n,i)=>n-min[i])};}
function toObj(value, uvRects) {
  const lines=['# AXM Game Asset Foundation','mtllib ../../../../textures/urban-atlas.mtl','o '+value.name,'usemtl urban_atlas'];let index=1;
  value.triangles.forEach(t=>{const n=normal(...t.points),r=uvRects[t.material]||uvRects.concrete,uv=[[r.u0,r.v0],[r.u1,r.v0],[r.u1,r.v1]];t.points.forEach(p=>lines.push('v '+p.map(x=>x.toFixed(6)).join(' ')));uv.forEach(p=>lines.push('vt '+p.map(x=>x.toFixed(6)).join(' ')));for(let i=0;i<3;i++)lines.push('vn '+n.map(x=>x.toFixed(6)).join(' '));lines.push('f '+[0,1,2].map(i=>(index+i)+'/'+(index+i)+'/'+(index+i)).join(' '));index+=3;});
  return lines.join('\n')+'\n';
}
function validate(value,budget){const issues=[];if(!value.triangles.length)issues.push('no triangles');if(value.triangles.some(t=>t.points.some(p=>!finite3(p))))issues.push('non-finite vertex');if(budget!=null&&value.triangles.length>budget)issues.push('triangle budget exceeded');const box=bounds(value);if(box.size.some(n=>!Number.isFinite(n)||n<=0))issues.push('invalid bounds');return{pass:!issues.length,issues,triangles:value.triangles.length,vertices:value.triangles.length*3,bounds:box};}

module.exports={mesh,tri,quad,addBox,addCylinder,addGableRoof,addOctahedron,build,toObj,bounds,validate};
