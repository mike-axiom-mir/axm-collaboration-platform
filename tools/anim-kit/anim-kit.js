/* ============================================================
   AXM ANIM KIT  —  anim-kit.js   (v0.1, DRAFT / TEST-not-canon)
   Procedural motion "lego blocks". The cheapest path to game-feel
   for a small team: springs, squash & stretch, follow-through and
   easing are DATA, layered on top of even crude base poses.
   Portable outputs so anything consumes them:
     - clip     : engine-agnostic axm.procedural-motion/v1 (named channels + keyframes)
     - css      : @keyframes string (web / apps / OS UI)
     - sample() : per-time value (drive any engine each frame)
   Deterministic: no call-time randomness (shake uses a seed).
   Run:  node anim-kit.js  (writes ./out filmstrip proofs)
   ============================================================ */
'use strict';

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;

/* ============================================================
   1. EASING — the foundation everything reads
   Each entry: fn(t)->0..1  +  css cubic-bezier string (where exact)
   ============================================================ */
const Easing = {
  linear:        { fn: t=>t,                                            css:'linear' },
  easeInQuad:    { fn: t=>t*t,                                          css:'cubic-bezier(.55,.085,.68,.53)' },
  easeOutQuad:   { fn: t=>1-(1-t)*(1-t),                                css:'cubic-bezier(.25,.46,.45,.94)' },
  easeInOutCubic:{ fn: t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,          css:'cubic-bezier(.65,0,.35,1)' },
  easeOutBack:   { fn: t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);}, css:'cubic-bezier(.34,1.56,.64,1)' },
  easeOutElastic:{ fn: t=>{if(t===0||t===1)return t;const c4=(2*Math.PI)/3;return Math.pow(2,-10*t)*Math.sin((t*10-.75)*c4)+1;}, css:null },
  easeOutBounce: { fn: bounceOut,                                       css:null },
  anticipate:    { fn: t=>{const k=1.7;return t*t*((k+1)*t-k);},        css:'cubic-bezier(.36,0,.66,-.56)' }
};
function bounceOut(t){
  const n1=7.5625,d1=2.75;
  if(t<1/d1)return n1*t*t;
  if(t<2/d1)return n1*(t-=1.5/d1)*t+.75;
  if(t<2.5/d1)return n1*(t-=2.25/d1)*t+.9375;
  return n1*(t-=2.625/d1)*t+.984375;
}

/* ============================================================
   2. SPRING — damped harmonic sampler (the juice secret)
   Returns keyframes that overshoot and settle. Deterministic
   semi-implicit Euler.  from/to are scalars; sample N frames.
   ============================================================ */
function spring({ from=0, to=1, stiffness=170, damping=12, mass=1, frames=40, dt=1/60 }={}){
  let x=from, v=0; const out=[];
  for(let i=0;i<frames;i++){
    const f=-stiffness*(x-to)-damping*v;
    v+=(f/mass)*dt; x+=v*dt;
    out.push({ t:+(i/(frames-1)).toFixed(4), v:+x.toFixed(5) });
  }
  out[out.length-1].v=to; // clamp exact settle
  return out;
}

/* ============================================================
   3. SQUASH & STRETCH — volume-preserving scale from speed
   Give it a vertical speed (or contact flag); get {sx,sy}.
   Bounded by maxStretch (ties to toon-style squashStretchMax).
   ============================================================ */
function squashStretch(speed, { maxStretch=1.35, contact=false, squash=1.32 }={}){
  if(contact){ const sx=squash, sy=1/squash; return { sx:+sx.toFixed(4), sy:+sy.toFixed(4) }; }
  const s=clamp(1+Math.abs(speed)*2.2,1,maxStretch);
  return { sx:+(1/Math.sqrt(s)).toFixed(4), sy:+s.toFixed(4) }; // volume preserved
}

/* ============================================================
   4. JUICE PRESETS — ready clips for game/UI feedback
   Each returns an axm.procedural-motion/v1
   ============================================================ */
function clip(id, durationMs, channels){ return { schema:'axm.procedural-motion/v1', id, durationMs, channels }; }

const Juice = {
  // scale pop with overshoot — collect, spawn, confirm
  hitPop({ id='hit-pop', peak=1.35, ms=320 }={}){
    return clip(id, ms, { scale:[
      { t:0, v:1, ease:'easeOutBack' },
      { t:.4, v:peak, ease:'easeInOutCubic' },
      { t:1, v:1 }
    ]});
  },
  // deterministic screen shake from a seed (trauma decays)
  screenShake({ id='screen-shake', magnitude=8, ms=350, frames=14, seed=1 }={}){
    let s=seed>>>0; const rand=()=>{ s=(s*1664525+1013904223)>>>0; return (s/4294967296)*2-1; };
    const x=[],y=[];
    for(let i=0;i<frames;i++){ const t=i/(frames-1), trauma=Math.pow(1-t,2);
      x.push({t:+t.toFixed(3), v:+(rand()*magnitude*trauma).toFixed(2)});
      y.push({t:+t.toFixed(3), v:+(rand()*magnitude*trauma).toFixed(2)}); }
    return clip(id, ms, { offsetX:x, offsetY:y });
  },
  // squash landing — for jumps/impacts
  landSquash({ id='land-squash', ms=260 }={}){
    return clip(id, ms, {
      scaleY:[{t:0,v:1},{t:.15,v:.7,ease:'easeOutQuad'},{t:.5,v:1.12,ease:'easeOutBack'},{t:1,v:1}],
      scaleX:[{t:0,v:1},{t:.15,v:1.3,ease:'easeOutQuad'},{t:.5,v:.92,ease:'easeOutBack'},{t:1,v:1}]
    });
  },
  // idle breathing/bob — kills the "dead pose" look for free
  idleBob({ id='idle-bob', ms=2200, amp=3 }={}){
    return clip(id, ms, { offsetY:[
      {t:0,v:0},{t:.5,v:-amp,ease:'easeInOutCubic'},{t:1,v:0,ease:'easeInOutCubic'} ]});
  },
  // anticipation -> action -> follow-through wrapper for a move
  windup({ id='windup', ms=520 }={}){
    return clip(id, ms, { offsetX:[
      {t:0,v:0},{t:.25,v:-14,ease:'anticipate'},{t:.6,v:40,ease:'easeOutQuad'},
      {t:.8,v:34,ease:'easeOutBack'},{t:1,v:36} ]});
  }
};

/* ============================================================
   5. SECONDARY MOTION — trailing follow-through on appended parts
   Delay a driver channel and spring toward it (hair, tail, gun, cloth).
   ============================================================ */
function followThrough(driverSamples, { lagFrames=4, stiffness=120, damping=14 }={}){
  const out=[]; let x=driverSamples[0].v, v=0, dt=1/60;
  for(let i=0;i<driverSamples.length;i++){
    const target=driverSamples[Math.max(0,i-lagFrames)].v;
    const f=-stiffness*(x-target)-damping*v; v+=f*dt; x+=v*dt;
    out.push({ t:driverSamples[i].t, v:+x.toFixed(4) });
  }
  return out;
}

/* ============================================================
   6. EXPORTERS
   ============================================================ */
function sampleChannel(kf, t, ease=Easing){
  // kf: [{t,v,ease?}] ; linear-in-time, eased-in-value between stops
  if(t<=kf[0].t)return kf[0].v;
  if(t>=kf[kf.length-1].t)return kf[kf.length-1].v;
  for(let i=0;i<kf.length-1;i++){
    const a=kf[i],b=kf[i+1];
    if(t>=a.t&&t<=b.t){ const local=(t-a.t)/(b.t-a.t);
      const e=(ease[a.ease]||ease.linear).fn(local); return lerp(a.v,b.v,e); }
  }
  return kf[kf.length-1].v;
}
function toCSSKeyframes(cl){
  // maps scale/scaleX/scaleY/offsetX/offsetY channels to a transform @keyframes
  const times=new Set(); Object.values(cl.channels).forEach(kf=>kf.forEach(k=>times.add(k.t)));
  const stops=[...times].sort((a,b)=>a-b);
  const body=stops.map(t=>{
    let sx=1,sy=1,tx=0,ty=0;
    const C=cl.channels;
    if(C.scale)  sx=sy=sampleChannel(C.scale,t);
    if(C.scaleX) sx=sampleChannel(C.scaleX,t);
    if(C.scaleY) sy=sampleChannel(C.scaleY,t);
    if(C.offsetX)tx=sampleChannel(C.offsetX,t);
    if(C.offsetY)ty=sampleChannel(C.offsetY,t);
    return `  ${(t*100).toFixed(1)}% { transform: translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) scale(${sx.toFixed(3)},${sy.toFixed(3)}); }`;
  }).join('\n');
  return `@keyframes ${cl.id} {\n${body}\n}\n/* usage: animation: ${cl.id} ${cl.durationMs}ms both; */`;
}

/* ============================================================
   PROOF: bouncing-ball squash & stretch filmstrip (SVG)
   Renders the single most-recognized test of animation principles.
   ============================================================ */
function bounceFilmstrip({ frames=12, bounces=2.5, maxH=90, R=20 }={}){
  const cellW=70, cellH=150, pad=16, groundY=cellH-22;
  const W=pad*2+frames*cellW, H=pad+cellH+40;
  const hAt = t => Math.abs(Math.cos(bounces*Math.PI*t))*(1-t); // decaying bounces, 0=ground
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#12151c"/>
<text x="${pad}" y="${pad}" fill="#fff" font-family="sans-serif" font-size="13" font-weight="bold">anim-kit proof — bouncing ball, procedural squash &amp; stretch (each frame = data, no hand-keys)</text>`;
  for(let i=0;i<frames;i++){
    const t=i/(frames-1);
    const h=hAt(t);
    const hPrev=hAt(Math.max(0,(i-1)/(frames-1))), hNext=hAt(Math.min(1,(i+1)/(frames-1)));
    const vy=(hNext-hPrev); // vertical speed proxy
    const contact = h<0.05;
    const {sx,sy}=squashStretch(vy,{maxStretch:1.5,contact,squash:1.4});
    const cx=pad+i*cellW+cellW/2;
    const cy=groundY - h*maxH - R*sy; // sit on ground
    const gx=pad+i*cellW+6, gw=cellW-12;
    // cell
    s+=`<g>
  <line x1="${gx}" y1="${groundY+R*0.2}" x2="${gx+gw}" y2="${groundY+R*0.2}" stroke="#39405020" stroke-width="0"/>
  <line x1="${gx}" y1="${groundY+2}" x2="${gx+gw}" y2="${groundY+2}" stroke="#2a3140" stroke-width="2"/>
  <ellipse cx="${cx}" cy="${groundY+4}" rx="${(R*sx*0.9).toFixed(1)}" ry="3.2" fill="#000" opacity="${(0.28*(1-h)).toFixed(2)}"/>
  <ellipse cx="${cx}" cy="${(cy+R*sy).toFixed(1)}" rx="${(R*sx).toFixed(1)}" ry="${(R*sy).toFixed(1)}" fill="#ff5d5d" stroke="#8a1f1f" stroke-width="2"/>
  <text x="${cx}" y="${cellH+14}" fill="#7f8895" font-family="monospace" font-size="9" text-anchor="middle">${i}</text>
</g>`;
  }
  return s+'\n</svg>\n';
}

/* strip showing a UI hit-pop (scale overshoot) frame by frame */
function popFilmstrip({ frames=10 }={}){
  const cl=Juice.hitPop({peak:1.45,ms:320});
  const cellW=70, cellH=90, pad=16;
  const W=pad*2+frames*cellW, H=pad+cellH+34;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#12151c"/>
<text x="${pad}" y="${pad}" fill="#fff" font-family="sans-serif" font-size="13" font-weight="bold">anim-kit proof — UI hit-pop (easeOutBack scale overshoot)</text>`;
  for(let i=0;i<frames;i++){
    const t=i/(frames-1); const sc=sampleChannel(cl.channels.scale,t);
    const cx=pad+i*cellW+cellW/2, cy=pad+18+cellH/2, r=16*sc;
    s+=`<g><rect x="${cx-r}" y="${cy-r}" width="${(r*2).toFixed(1)}" height="${(r*2).toFixed(1)}" rx="${(r*0.35).toFixed(1)}" fill="#00e0ff" stroke="#0b6b7d" stroke-width="2"/>
  <text x="${cx}" y="${cy+cellH/2+2}" fill="#7f8895" font-family="monospace" font-size="9" text-anchor="middle">${sc.toFixed(2)}x</text></g>`;
  }
  return s+'\n</svg>\n';
}

module.exports = { Easing, spring, squashStretch, Juice, followThrough, sampleChannel, toCSSKeyframes, clip, bounceFilmstrip, popFilmstrip };

/* ---------- run demo ---------- */
if(require.main===module){
  const fs=require('fs'),path=require('path');
  const outDir=path.join(__dirname,'out'); fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'bounce-filmstrip.svg'), bounceFilmstrip());
  fs.writeFileSync(path.join(outDir,'pop-filmstrip.svg'), popFilmstrip());
  // export sample clips as portable JSON + CSS
  const clips={ hitPop:Juice.hitPop(), landSquash:Juice.landSquash(), idleBob:Juice.idleBob(), windup:Juice.windup(), screenShake:Juice.screenShake() };
  fs.writeFileSync(path.join(outDir,'clips.json'), JSON.stringify(clips,null,2));
  fs.writeFileSync(path.join(outDir,'clips.css'), Object.values(clips).filter(c=>!c.channels.offsetX||c.id!=='screen-shake').map(toCSSKeyframes).join('\n\n'));
  // spring sample proof
  fs.writeFileSync(path.join(outDir,'spring.sample.json'), JSON.stringify(spring({from:0,to:100,stiffness:180,damping:12,frames:40}),null,2));
  console.log('anim-kit demo written to ./out');
  console.log(' clips:', Object.keys(clips).join(', '));
}
