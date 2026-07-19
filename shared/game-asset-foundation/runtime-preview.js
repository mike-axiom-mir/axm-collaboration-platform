'use strict';

function html(entries,profile){
  const payload={profile:{id:profile.id,title:profile.title,palette:profile.palette},assets:entries.map(entry=>({id:entry.id,category:entry.category,triangles:entry.mesh.triangles}))},data=JSON.stringify(payload).replace(/</g,'\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AXM PS2 Asset Runtime Preview</title>
<style>*{box-sizing:border-box}body{margin:0;background:#07101c;color:#dcebf3;font:14px system-ui;overflow:hidden}header{height:58px;display:flex;align-items:center;gap:16px;padding:10px 16px;background:#0b1726;border-bottom:1px solid #20364b}header b{color:#68d9e7}select,button{background:#111f31;color:#dcebf3;border:1px solid #31516b;border-radius:7px;padding:8px}canvas{display:block;width:100vw;height:calc(100vh - 58px)}small{color:#7f98aa;margin-left:auto}</style></head>
<body><header><b>AXM PS2 ASSET PREVIEW</b><select id="asset"></select><button id="spin">PAUSE</button><span id="stats"></span><small>Local Canvas renderer · drag to rotate · wheel to zoom</small></header><canvas id="view"></canvas>
<script>
const PACK=${data},canvas=document.getElementById('view'),ctx=canvas.getContext('2d'),pick=document.getElementById('asset'),stats=document.getElementById('stats');
let current=0,yaw=.7,pitch=.48,zoom=1,spinning=true,drag=null;
PACK.assets.forEach((a,i)=>{const o=document.createElement('option');o.value=i;o.textContent=a.category.toUpperCase()+' · '+a.id;pick.appendChild(o)});
pick.onchange=()=>{current=+pick.value};
document.getElementById('spin').onclick=e=>{spinning=!spinning;e.target.textContent=spinning?'PAUSE':'SPIN'};
canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.008;pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY]};
canvas.onpointerup=()=>drag=null;
canvas.onwheel=e=>{zoom=Math.max(.25,Math.min(4,zoom*(e.deltaY>0?.9:1.1)));e.preventDefault()};
function resize(){const d=devicePixelRatio||1,w=innerWidth,h=innerHeight-58;if(canvas.width!==w*d||canvas.height!==h*d){canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0)}}
function rot(p){let x=p[0],y=p[1],z=p[2],c=Math.cos(yaw),s=Math.sin(yaw),x1=x*c-z*s,z1=x*s+z*c,cp=Math.cos(pitch),sp=Math.sin(pitch);return[x1,y*cp-z1*sp,y*sp+z1*cp]}
function frame(){
  resize();if(spinning&&!drag)yaw+=.004;
  const w=canvas.clientWidth,h=canvas.clientHeight,a=PACK.assets[current],all=a.triangles.flatMap(t=>t.points.map(rot)),extent=Math.max(1,...all.flatMap(p=>[Math.abs(p[0]),Math.abs(p[1])])),scale=Math.min(w,h)*.34/extent*zoom,project=p=>[w/2+p[0]*scale,h*.56-p[1]*scale,p[2]],tris=a.triangles.map(t=>{const p=t.points.map(rot).map(project);return{p,d:p.reduce((n,v)=>n+v[2],0)/3,m:t.material}}).sort((a,b)=>a.d-b.d),colours=PACK.profile.palette;
  ctx.fillStyle='#07101c';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#14283a';for(let x=0;x<w;x+=42){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  tris.forEach(t=>{ctx.beginPath();ctx.moveTo(t.p[0][0],t.p[0][1]);ctx.lineTo(t.p[1][0],t.p[1][1]);ctx.lineTo(t.p[2][0],t.p[2][1]);ctx.closePath();ctx.fillStyle=colours[t.m]||'#7b8792';ctx.fill();ctx.strokeStyle='rgba(5,10,16,.28)';ctx.stroke()});
  stats.textContent=a.triangles.length+' TRI · '+PACK.profile.title;requestAnimationFrame(frame);
}
frame();
</script></body></html>`;
}

module.exports={html};
