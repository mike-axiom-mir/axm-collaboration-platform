/* ============================================================
   AXM ANIM KIT — locomotion.js  (v0.1, DRAFT / TEST-not-canon)
   Procedural biped locomotion. A placeholder character that
   actually WALKS from sine channels + foot phase — zero hand
   keyframes. idle | walk | run.  Portable:
     - pose(mode, phase)  -> joint positions (drive any 2D/3D rig)
     - channels(mode)     -> axm.procedural-motion/v1 joint-angle channels
   Deterministic. Run: node locomotion.js (writes ./out filmstrips)
   ============================================================ */
'use strict';
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

/* gait parameter presets (degrees / px) ------------------------------ */
const GAITS = {
  idle: { thigh:3, knee:9,  kneeStance:6,  arm:3,  elbow:12, bob:2,  lean:2,  freq:1, stride:0 },
  walk: { thigh:24, knee:44, kneeStance:6,  arm:19, elbow:16, bob:6,  lean:6,  freq:1, stride:1 },
  run:  { thigh:40, knee:88, kneeStance:14, arm:36, elbow:52, bob:13, lean:18, freq:1, stride:1.6 }
};
const RIG = { thighLen:34, shinLen:32, torsoLen:46, upperArm:26, foreArm:22, headR:12, headGap:14 };

/* one leg: returns {knee, foot} given hip point + leg phase t (0..1) --- */
function legFK(hip, t, G, R){
  const thigh = G.thigh * Math.sin(TAU * t) * D2R;                 // + = forward (+x)
  // knee bends through the swing (just after toe-off), straight in stance
  const swing = Math.max(0, Math.sin(TAU * (t - 0.45)));
  const kneeBend = (G.knee * swing + G.kneeStance) * D2R;
  const kx = hip.x + R.thighLen * Math.sin(thigh);
  const ky = hip.y + R.thighLen * Math.cos(thigh);
  const shin = thigh - kneeBend;                                   // knee folds backward
  const fx = kx + R.shinLen * Math.sin(shin);
  const fy = ky + R.shinLen * Math.cos(shin);
  return { knee:{x:kx,y:ky}, foot:{x:fx,y:fy} };
}
/* one arm: shoulder point + arm phase t --------------------------------- */
function armFK(sh, t, G, R){
  const up = -G.arm * Math.sin(TAU * t) * D2R;                     // counter-swing vs same-side leg
  const el = (G.elbow * (0.6 + 0.4*Math.max(0,Math.sin(TAU*(t+0.1))))) * D2R;
  const ex = sh.x + R.upperArm * Math.sin(up);
  const ey = sh.y + R.upperArm * Math.cos(up);
  const fore = up + el;
  const hx = ex + R.foreArm * Math.sin(fore);
  const hy = ey + R.foreArm * Math.cos(fore);
  return { elbow:{x:ex,y:ey}, hand:{x:hx,y:hy} };
}

/* full pose at a normalized phase (0..1) -------------------------------- */
function pose(mode, phase, origin={x:0,y:0}, R=RIG){
  const G = GAITS[mode] || GAITS.walk;
  const t = ((phase % 1) + 1) % 1;
  const bob = -Math.cos(2 * TAU * t);                              // high at passing, low at contact
  const hip = { x: origin.x, y: origin.y - G.bob * bob };
  const leanR = G.lean * D2R;
  const chest = { x: hip.x + R.torsoLen * Math.sin(leanR),
                  y: hip.y - R.torsoLen * Math.cos(leanR) };
  const head  = { x: chest.x + R.headGap * Math.sin(leanR),
                  y: chest.y - R.headGap * Math.cos(leanR) };
  const legR = legFK(hip, t,        G, R);
  const legL = legFK(hip, t + 0.5,  G, R);
  const armR = armFK(chest, t + 0.5, G, R);   // arm opposes leg
  const armL = armFK(chest, t,       G, R);
  return { hip, chest, head, headR:R.headR,
           legR, legL, armR, armL, mode, phase:t };
}

/* export joint-angle channels as an engine-agnostic anim-clip ----------- */
function channels(mode, samples=16){
  const G = GAITS[mode] || GAITS.walk;
  const mk = fn => Array.from({length:samples}, (_,i)=>{ const t=i/samples;
    return { t:+t.toFixed(4), v:+fn(t).toFixed(4) }; });
  return {
    schema:'axm.procedural-motion/v1', id:`loco-${mode}`, loop:true,
    channels:{
      thighR: mk(t=>G.thigh*Math.sin(TAU*t)),
      thighL: mk(t=>G.thigh*Math.sin(TAU*(t+0.5))),
      kneeR:  mk(t=>G.knee*Math.max(0,Math.sin(TAU*(t-0.45)))+G.kneeStance),
      kneeL:  mk(t=>G.knee*Math.max(0,Math.sin(TAU*(t+0.05)))+G.kneeStance),
      armR:   mk(t=>-G.arm*Math.sin(TAU*(t+0.5))),
      armL:   mk(t=>-G.arm*Math.sin(TAU*t)),
      bobY:   mk(t=>-G.bob*(-Math.cos(2*TAU*t)))
    }
  };
}

/* ---------- filmstrip proof ---------- */
function limb(a,b,w,col){ return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; }
function drawFigure(p, ox, oy){
  const T=(pt)=>({x:pt.x+ox, y:pt.y+oy});
  const hip=T(p.hip), chest=T(p.chest), head=T(p.head);
  const back='#37507a', front='#5c8ff5', body='#2f3b56', headc='#ffd7a8';
  return `<g>
  ${limb(chest,T(p.legL.knee),8,back)}${limb(T(p.legL.knee),T(p.legL.foot),7,back)}
  ${limb(chest,T(p.armL.elbow),6,back)}${limb(T(p.armL.elbow),T(p.armL.hand),5,back)}
  ${limb(hip,chest,11,body)}
  ${limb(hip,T(p.legR.knee),9,front)}${limb(T(p.legR.knee),T(p.legR.foot),8,front)}
  ${limb(chest,T(p.armR.elbow),7,front)}${limb(T(p.armR.elbow),T(p.armR.hand),6,front)}
  <circle cx="${head.x.toFixed(1)}" cy="${head.y.toFixed(1)}" r="${p.headR}" fill="${headc}" stroke="#c98f5a" stroke-width="2"/>
</g>`;
}
function walkFilmstrip(mode='walk', frames=8){
  const cellW=88, cellH=190, pad=16, groundY=150;
  const W=pad*2+frames*cellW, H=pad+cellH+30;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#11141b"/>
<text x="${pad}" y="${pad}" fill="#fff" font-family="sans-serif" font-size="13" font-weight="bold">anim-kit proof — procedural ${mode} cycle (sine channels + foot phase, no hand-keys)</text>`;
  for(let i=0;i<frames;i++){
    const phase=i/frames;
    const p=pose(mode, phase);
    // foot-plant: translate the whole figure so the LOWER foot sits on the ground line
    const lowestFoot = Math.max(p.legR.foot.y, p.legL.foot.y);
    const ox=pad+i*cellW+cellW/2, oy=groundY - lowestFoot;
    s+=`<line x1="${pad+i*cellW+8}" y1="${groundY+4}" x2="${pad+i*cellW+cellW-8}" y2="${groundY+4}" stroke="#232c3d" stroke-width="2"/>`;
    s+=drawFigure(p, ox, oy);
    s+=`<text x="${ox}" y="${cellH+18}" fill="#7f8895" font-family="monospace" font-size="9" text-anchor="middle">${(phase).toFixed(2)}</text>`;
  }
  return s+'\n</svg>\n';
}

module.exports = { pose, channels, walkFilmstrip, GAITS, RIG };

if(require.main===module){
  const fs=require('fs'),path=require('path');
  const outDir=path.join(__dirname,'out'); fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'walk-filmstrip.svg'), walkFilmstrip('walk',8));
  fs.writeFileSync(path.join(outDir,'run-filmstrip.svg'), walkFilmstrip('run',8));
  fs.writeFileSync(path.join(outDir,'loco.channels.json'), JSON.stringify({walk:channels('walk'),run:channels('run'),idle:channels('idle')},null,2));
  console.log('locomotion demo written to ./out');
}
