(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AXMChromaKeyer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function sat(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx===0?0:(mx-mn)/mx;}
  function dist(r,g,b,k){const dr=r-k[0],dg=g-k[1],db=b-k[2];return Math.sqrt(dr*dr+dg*dg+db*db);}
  function keyChannel(k){const[r,g,b]=k;if(g>r+18&&g>b+18)return'g';if(b>r+18&&b>g+18)return'b';return null;}
  function median(values){const a=values.slice().sort((x,y)=>x-y),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
  function sampleBackground(px,w,h){
    const patch=Math.max(4,Math.round(Math.min(w,h)*.04)),rs=[],gs=[],bs=[];
    const take=(x,y)=>{const i=(y*w+x)*4;rs.push(px[i]);gs.push(px[i+1]);bs.push(px[i+2]);};
    for(let d=0;d<patch;d++){
      for(let x=0;x<w;x+=Math.max(1,(w/40)|0)){take(x,d);take(x,h-1-d);}
      for(let y=0;y<h;y+=Math.max(1,(h/40)|0)){take(d,y);take(w-1-d,y);}
    }
    const key=[median(rs),median(gs),median(bs)];let spread=0;
    for(let i=0;i<rs.length;i++)spread+=dist(rs[i],gs[i],bs[i],key);
    spread/=rs.length;
    return{key,spread,sat:sat(key[0],key[1],key[2]),channel:keyChannel(key),samples:rs.length};
  }
  function deriveThreshold(bg,options){const o=options||{},base=o.base??42,min=o.min??26,max=o.max??150,raw=bg.spread*2.2+base,T=Math.min(max,Math.max(min,raw));return{T,feather:T*.7,clampedWide:raw>=max};}
  function keyToAlpha(px,w,h,bg,thr){const alpha=new Float32Array(w*h),key=bg.key,T=thr.T,feather=thr.feather;for(let p=0,i=0;p<w*h;p++,i+=4){const d=dist(px[i],px[i+1],px[i+2],key);alpha[p]=d<=T?0:d>=T+feather?1:(d-T)/feather;}return alpha;}
  function assess(alpha,w,h,bg){
    const reasons=[];if(bg.spread>60)reasons.push('uneven_background');let keyed=0,centreKeyed=0,centreTot=0;
    const cx0=w*.3,cx1=w*.7,cy0=h*.3,cy1=h*.7;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=alpha[y*w+x];if(a<.5)keyed++;if(x>=cx0&&x<=cx1&&y>=cy0&&y<=cy1){centreTot++;if(a<.5)centreKeyed++;}}
    const keyedFrac=keyed/(w*h),centreFrac=centreKeyed/Math.max(1,centreTot);
    if(keyedFrac>.93||centreFrac>.6)reasons.push('subject_blends_into_background');
    const confidence=reasons.length?0:Math.min(1,1-Math.abs(keyedFrac-.5)*.4);
    return{ok:reasons.length===0,reasons,confidence:+confidence.toFixed(3),keyedFrac:+keyedFrac.toFixed(3),centreFrac:+centreFrac.toFixed(3)};
  }
  function suppressSpill(px,w,h,alpha,bg){if(!bg.channel)return;for(let p=0,i=0;p<w*h;p++,i+=4){if(alpha[p]<=0)continue;const r=px[i],g=px[i+1],b=px[i+2];if(bg.channel==='g'){const cap=Math.max(r,b);if(g>cap)px[i+1]=Math.round(g+(cap-g)*(1-alpha[p]*.3));}else{const cap=Math.max(r,g);if(b>cap)px[i+2]=Math.round(b+(cap-b)*(1-alpha[p]*.3));}}}
  function despeckle(alpha,w,h){const out=new Float32Array(alpha.length),n=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){n.length=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;n.push(xx<0||yy<0||xx>=w||yy>=h?alpha[y*w+x]:alpha[yy*w+xx]);}n.sort((a,b)=>a-b);out[y*w+x]=n[4];}return out;}
  function applyAlpha(px,alpha){for(let p=0,i=3;p<alpha.length;p++,i+=4)px[i]=Math.round(alpha[p]*255);}
  function hasTransparency(px){let transparent=0,n=px.length/4;for(let i=3;i<px.length;i+=4)if(px[i]<250)transparent++;return transparent>n*.02;}
  function cutImage(px,w,h,options){
    if(hasTransparency(px))return{ok:true,passThrough:true,px,meta:{note:'already transparent - passed through, not re-keyed'}};
    const bg=sampleBackground(px,w,h),thr=deriveThreshold(bg,options),rawAlpha=keyToAlpha(px,w,h,bg,thr),verdict=assess(rawAlpha,w,h,bg);
    if(thr.clampedWide&&!verdict.reasons.includes('ambiguous_background')){verdict.reasons.push('ambiguous_background');verdict.ok=false;verdict.confidence=0;}
    const meta={key:bg.key.map(Math.round),threshold:+thr.T.toFixed(1),bgSat:+bg.sat.toFixed(3),bgSpread:+bg.spread.toFixed(1),channel:bg.channel,...verdict};
    if(!verdict.ok)return{ok:false,reasons:verdict.reasons,meta};
    suppressSpill(px,w,h,rawAlpha,bg);const alpha=despeckle(rawAlpha,w,h);applyAlpha(px,alpha);
    return{ok:true,passThrough:false,reasons:[],px,meta};
  }
  return{sampleBackground,deriveThreshold,keyToAlpha,assess,suppressSpill,despeckle,applyAlpha,hasTransparency,cutImage};
});
