'use strict';

const Raster = require('../asset-hands/raster-codec');

const MATERIALS = ['concrete','brick','glass','metal','asphalt','lane','grass','bark','roof','vehicle','tire','skin','cloth','trim','emissive','sign','window-lit','window-dark','stone','stucco','wood','chrome','headlight','taillight','pavement','dirt','foliage-dark','denim','leather','concrete-dark','brick-light','roof-tile'];

function rgb(hex){const value=parseInt(String(hex||'#808080').slice(1),16);return[(value>>16)&255,(value>>8)&255,value&255];}
function hashSeed(text){let value=2166136261;for(const char of String(text||'')){value^=char.charCodeAt(0);value=Math.imul(value,16777619);}return value>>>0;}
function random(seed){let state=hashSeed(seed)||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};}
function clamp(value){return Math.max(0,Math.min(255,Math.round(value)));}
function create(profile,seed){
  const width=profile.textureAtlas.width,height=profile.textureAtlas.height,across=profile.textureAtlas.tilesAcross,tile=Math.floor(width/across),rgba=new Uint8Array(width*height*4),uvRects={},noise=random(seed+'-atlas'),materials=across>=8?MATERIALS:MATERIALS.slice(0,16);
  materials.forEach((name,index)=>{
    const tx=index%across,ty=Math.floor(index/across),base=rgb(profile.palette[name]||profile.palette.bark),pad=2;
    uvRects[name]={u0:(tx*tile+pad)/width,v0:1-(ty*tile+tile-pad)/height,u1:(tx*tile+tile-pad)/width,v1:1-(ty*tile+pad)/height};
    if(name==='bark')uvRects.wood=uvRects[name];
    for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
      let shade=(noise()-.5)*18;
      if(name==='brick'&&((y%22)<2||((x+(Math.floor(y/22)%2)*16)%32)<2))shade-=45;
      if(name==='glass'&&((x%28)<2||(y%32)<2))shade+=35;
      if(name==='asphalt')shade+=(noise()>.94?30:0);
      if(name==='lane'&&((x+y)%24)<3)shade+=18;
      if(name==='grass')shade+=(Math.sin(x*.22)+Math.cos(y*.17))*8;
      if(name==='bark')shade+=(x%13<2?-28:0);
      if(name==='metal')shade+=(x%20<2?22:0);
      if(name==='stone'||name==='pavement')shade+=((x%32)<2||(y%32)<2)?-24:6;
      if(name==='stucco')shade+=(noise()>.88?18:noise()<.08?-16:0);
      if(name==='wood')shade+=(x%17<2?-25:Math.sin(y*.18)*5);
      if(name==='chrome')shade+=Math.sin(x*.08)*30+18;
      if(name==='window-lit')shade+=((x%24)<3||(y%28)<3)?-42:22;
      if(name==='window-dark')shade+=((x+y)%38<3)?22:-8;
      if(name==='headlight')shade+=Math.max(0,55-Math.hypot(x-tile/2,y-tile/2));
      if(name==='taillight')shade+=((x%18)<4?30:-8);
      if(name==='dirt')shade+=(noise()>.82?22:noise()<.12?-18:0);
      if(name==='foliage-dark')shade+=(Math.sin(x*.31)+Math.cos(y*.27))*10;
      if(name==='denim')shade+=((x+y)%11<2?-13:5);
      if(name==='leather')shade+=(Math.sin(x*.12+y*.08))*9;
      if(name==='concrete-dark')shade+=(noise()>.9?14:0);
      if(name==='brick-light'&&((y%22)<2||((x+(Math.floor(y/22)%2)*16)%32)<2))shade-=38;
      if(name==='roof-tile')shade+=((x%24)<3||(y%18)<2)?-28:4;
      const px=tx*tile+x,py=ty*tile+y,at=(py*width+px)*4;rgba[at]=clamp(base[0]+shade);rgba[at+1]=clamp(base[1]+shade);rgba[at+2]=clamp(base[2]+shade);rgba[at+3]=255;
    }
  });
  const encoded=Raster.encodeRgba(width,height,rgba,{colourSpace:'srgb'});
  return{schema:'axm.game-texture-atlas/v1',width,height,materials:materials.slice(),uvRects,rgba,png:encoded.bytes,dataUrl:encoded.dataUrl,inspection:encoded.inspection};
}
function mtl(){return['# AXM shared urban atlas','newmtl urban_atlas','Ka 0.150 0.150 0.150','Kd 1.000 1.000 1.000','Ks 0.050 0.050 0.050','Ns 8.000','d 1.0','illum 2','map_Kd urban-atlas.png',''].join('\n');}

module.exports={MATERIALS,create,mtl,rgb};
