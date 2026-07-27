/* ============================================================
   AXM ANIM KIT — morph.js  (v0.1, DRAFT / TEST-not-canon)
   Death -> respawn-EVOLUTION morph. The signature motion for a
   game where "dying makes you weirder, not weaker." A body
   collapses, a seed of its lineage carries, and it re-emerges as
   a DIRECTED variant — every mutation has a visible cause and is
   deterministic from (baseRig, mutationId).  No hidden rewrites.
   Portable: timeline() -> keyed scale+rig samples any engine plays.
   Run: node morph.js  (writes ./out death-respawn filmstrip)
   ============================================================ */
'use strict';
const { pose, RIG } = require('./locomotion.js');

/* ---- easing (local copy so this file stands alone) ---- */
const easeOutBack = t => { const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); };
const easeInQuad  = t => t*t;
const easeOutQuad = t => 1-(1-t)*(1-t);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp  = (a,b,t)=>a+(b-a)*t;
function lerpRig(A,B,t){ const R={}; for(const k in A) R[k]=lerp(A[k], B[k]??A[k], t); return R; }

/* ============================================================
   MUTATIONS — directed variants. Each has a VISIBLE CAUSE that
   maps a death type to a proportion change (the "you got weirder"
   made legible). Deterministic: same death -> same offered set.
   ============================================================ */
const MUTATIONS = {
  longReach:  { name:'Long Reach',  cause:'died to melee → grow longer arms',
                rig:{ upperArm:34, foreArm:32 }, color:'#5c8ff5' },
  bouncyHide: { name:'Bouncy Hide', cause:'died to ranged → rounder, springier body',
                rig:{ torsoLen:38, headR:15, thighLen:28, shinLen:26 }, color:'#57d9a3' },
  stiltLegs:  { name:'Stilt Legs',  cause:'died in the open → taller, longer legs',
                rig:{ thighLen:44, shinLen:42 }, color:'#ffb24d' },
  bigBrain:   { name:'Big Brain',   cause:'died to a trap → oversized head, wary',
                rig:{ headR:20, headGap:18 }, color:'#c98bff' }
};

/* directed offer: which mutations a given death presents (bounded, seeded) */
function offer(deathCause){
  const table = {
    melee:  ['longReach','bouncyHide','bigBrain'],
    ranged: ['bouncyHide','stiltLegs','longReach'],
    open:   ['stiltLegs','bigBrain','bouncyHide'],
    trap:   ['bigBrain','longReach','stiltLegs']
  };
  return (table[deathCause] || table.melee).map(id => ({ id, ...MUTATIONS[id] }));
}

/* ============================================================
   TIMELINE — the death->respawn morph as keyed samples
   phases: alive · anticipate · COLLAPSE · seed · EMERGE · settle · evolved
   returns per-t { scale:{sx,sy}, rig, alpha, seed, label }
   ============================================================ */
function timeline(mutationId, samples=11){
  const target = MUTATIONS[mutationId] || MUTATIONS.longReach;
  const evolvedRig = { ...RIG, ...target.rig };
  const out=[];
  for(let i=0;i<samples;i++){
    const t=i/(samples-1);
    let sx=1, sy=1, alpha=1, seed=0, rig=RIG, morphT=0;
    if(t<0.12){                    // alive
      sy=1; sx=1;
    } else if(t<0.24){             // anticipation dip
      const k=easeInQuad((t-0.12)/0.12); sy=lerp(1,0.86,k); sx=lerp(1,1.1,k);
    } else if(t<0.40){             // COLLAPSE (death squash)
      const k=easeOutQuad((t-0.24)/0.16); sy=lerp(0.86,0.32,k); sx=lerp(1.1,1.55,k); alpha=lerp(1,0.6,k);
    } else if(t<0.52){             // seed — lineage carries (tiny bright pop)
      const k=(t-0.40)/0.12; alpha=lerp(0.6,0.15,k); sy=0.3; sx=1.5; seed=1-Math.abs(k-0.5)*2;
    } else if(t<0.72){             // EMERGE (rise, stretch, rig morphs in)
      const k=easeOutQuad((t-0.52)/0.20); sy=lerp(0.3,1.32,k); sx=lerp(1.5,0.86,k); alpha=lerp(0.15,1,k); morphT=k;
    } else if(t<0.88){             // settle overshoot
      const k=easeOutBack((t-0.72)/0.16); sy=lerp(1.32,1,k); sx=lerp(0.86,1,k); morphT=1;
    } else {                       // evolved
      sy=1; sx=1; morphT=1;
    }
    rig = lerpRig(RIG, evolvedRig, morphT);
    out.push({ t:+t.toFixed(3), scale:{sx:+sx.toFixed(3),sy:+sy.toFixed(3)}, alpha:+alpha.toFixed(3),
               seed:+seed.toFixed(3), morphT:+morphT.toFixed(3), rig });
  }
  return { schema:'axm.procedural-motion/v1', id:`respawn-${mutationId}`, mutation:target.name,
           cause:target.cause, evolvedRig, frames:out };
}

/* ---------- filmstrip proof ---------- */
function limb(a,b,w,col,alpha){ return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${alpha}"/>`; }
function drawFigure(p, ox, oy, sx, sy, alpha, col){
  // scale about the feet (ground), volume via sx/sy
  const groundLocalY = Math.max(p.legR.foot.y, p.legL.foot.y);
  const T=(pt)=>({ x: ox + pt.x*sx, y: oy + (pt.y-groundLocalY)*sy });
  const hip=T(p.hip), chest=T(p.chest), head=T(p.head);
  const back='#37507a', body='#2f3b56', headc='#ffd7a8';
  return `<g opacity="${alpha}">
  ${limb(chest,T(p.legL.knee),8*sx,back,1)}${limb(T(p.legL.knee),T(p.legL.foot),7*sx,back,1)}
  ${limb(chest,T(p.armL.elbow),6*sx,back,1)}${limb(T(p.armL.elbow),T(p.armL.hand),5*sx,back,1)}
  ${limb(hip,chest,11*sx,body,1)}
  ${limb(hip,T(p.legR.knee),9*sx,col,1)}${limb(T(p.legR.knee),T(p.legR.foot),8*sx,col,1)}
  ${limb(chest,T(p.armR.elbow),7*sx,col,1)}${limb(T(p.armR.elbow),T(p.armR.hand),6*sx,col,1)}
  <circle cx="${head.x.toFixed(1)}" cy="${head.y.toFixed(1)}" r="${(p.headR*((sx+sy)/2)).toFixed(1)}" fill="${headc}" stroke="#c98f5a" stroke-width="2"/>
</g>`;
}
function morphFilmstrip(mutationId='longReach'){
  const tl=timeline(mutationId, 11);
  const target=MUTATIONS[mutationId];
  const cellW=92, cellH=200, pad=18, groundY=168;
  const W=pad*2+tl.frames.length*cellW, H=pad+cellH+44;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#0f1218"/>
<text x="${pad}" y="${pad}" fill="#fff" font-family="sans-serif" font-size="13" font-weight="bold">anim-kit proof — death → respawn-evolution morph  ·  ${tl.mutation}  (${tl.cause})</text>`;
  tl.frames.forEach((f,i)=>{
    const evolvedColor = target.color;
    const col = f.morphT>0.5 ? evolvedColor : '#5c8ff5';
    const p = pose('idle', 0.25, {x:0,y:0}, f.rig);   // static standing pose
    const ox=pad+i*cellW+cellW/2, oy=groundY;
    s+=`<line x1="${pad+i*cellW+8}" y1="${groundY+3}" x2="${pad+i*cellW+cellW-8}" y2="${groundY+3}" stroke="#212a3b" stroke-width="2"/>`;
    if(f.seed>0.05){ // the lineage seed spark
      s+=`<circle cx="${ox}" cy="${groundY-10}" r="${(3+f.seed*6).toFixed(1)}" fill="#ffe58a" opacity="${(f.seed).toFixed(2)}"/>`;
    }
    s+=drawFigure(p, ox, oy, f.scale.sx, f.scale.sy, f.alpha, col);
    s+=`<text x="${ox}" y="${cellH+22}" fill="#7f8895" font-family="monospace" font-size="9" text-anchor="middle">${f.t.toFixed(2)}</text>`;
  });
  // phase labels
  const labels=[['alive',0.06],['collapse',0.33],['seed',0.46],['emerge',0.62],['evolved',0.93]];
  labels.forEach(([txt,tt])=>{ const x=pad+tt*(tl.frames.length*cellW);
    s+=`<text x="${x}" y="${groundY+22}" fill="#4a5568" font-family="sans-serif" font-size="10" text-anchor="middle" font-style="italic">${txt}</text>`; });
  return s+'\n</svg>\n';
}

module.exports = { MUTATIONS, offer, timeline, morphFilmstrip };

if(require.main===module){
  const fs=require('fs'),path=require('path');
  const outDir=path.join(__dirname,'out'); fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'respawn-longReach.svg'), morphFilmstrip('longReach'));
  fs.writeFileSync(path.join(outDir,'respawn-stiltLegs.svg'), morphFilmstrip('stiltLegs'));
  fs.writeFileSync(path.join(outDir,'respawn.timeline.json'), JSON.stringify(timeline('longReach'),null,2));
  fs.writeFileSync(path.join(outDir,'respawn.offer.json'), JSON.stringify({ deathCause:'melee', offered:require('./morph.js').offer('melee') },null,2));
  console.log('morph demo written to ./out — mutations:', Object.keys(MUTATIONS).join(', '));
}
