import { createRuntimeScene, parseGlb } from '../local-3d-game-runtime/native-glb.mjs';

export const SOURCE_PARTS = [
  ['road-straight','city-roads/models/road-straight.glb','C3D524D39FF60AE4CA418AA99E83AF25EE87DDBDC3C1A021774F30314BF73CA4','road',['N','S']],
  ['road-bend-square','city-roads/models/road-bend-square.glb','53994443059959B5D9C02689DEE8E9B670143B967402562F0537F2BFD40EAB7C','road',['N','E']],
  ['road-crossroad','city-roads/models/road-crossroad.glb','26DE3EC9C54F909331FF071060310F6B9E454C4ED3213394B7B52352CE2A45F9','road',['N','E','S','W']],
  ['road-intersection','city-roads/models/road-intersection.glb','3EBC88956FC771C505F30D616A86F5509B83AA07A0D893DDC82A91553C173ECA','road',['N','E','S']],
  ['road-end','city-roads/models/road-end.glb','0205B5FF8EFA84418C625FC99C6B31B71DF7D905A06825230C68C6921B391362','road',['N']],
  ['building-b','city-commercial/models/building-b.glb','3B5D3AC0799C024781D92BB15971D42F4F8E380554DC5CF6A40C2F07D948947A','building',[]],
  ['building-g','city-commercial/models/building-g.glb','9A28FA2FDFAC07492EE95589882213CFD6EB32D6752CB3B2F5404604C676D27A','building',[]],
  ['wall-a-flat','retro-urban/models/wall-a-flat.glb','C8E2D94E330EE62A476CD4350FB62FE1577EE87843D8D344E12C675C386A9408','facade',[]],
  ['wall-a-window','retro-urban/models/wall-a-window.glb','4A5ECC11C1C8820F555375CCABB426C6420EBD2BC9C7BCB5F2C472F655C3B03B','facade',[]],
  ['wall-a-door','retro-urban/models/wall-a-door.glb','554F1C0CEDAC9B31B73EE8C623395059A4BCA05290ECF8F6A8920363D6F487BF','facade',[]],
  ['wall-a-roof','retro-urban/models/wall-a-roof.glb','74B8263E1A28ECFCA6B59E84709DD9DAE1DF9C9AA9B81EC0D3F83906C934545C','roof',[]],
  ['scaffolding-floor','retro-urban/models/scaffolding-floor.glb','64E205F2863A5DE7B23089932A06BEA1549DD44FB617BB3E310A48CFDE36F9A0','floor',[]],
  ['door-type-a','retro-urban/models/door-type-a.glb','84583C26676636E3E0274A9842D841B04684D18A8B6E7F58EBEFB7D91E5A0142','door',[]],
  ['detail-bench','retro-urban/models/detail-bench.glb','CCF6F0A95B04DB1720C9A7040404CA0D676A0F850815AEE90DE5EDC33B96C47C','prop',[]],
  ['detail-dumpster-closed','retro-urban/models/detail-dumpster-closed.glb','C2B54E446C95FA413929793F3D89CB0176077FA29E4A449DC03CADA558BD07D9','prop',[]],
  ['detail-light-traffic','retro-urban/models/detail-light-traffic.glb','C4A5653388CE3AE34057B39B95F28C46CE8AE8CDC55DC5E60143D6A295D901C7','prop',[]],
  ['detail-barrier-strong-damaged','retro-urban/models/detail-barrier-strong-damaged.glb','BC14280B2AC6C4DF26E0BDC8AB2F25B789170BF2B030D34FC9953C1E41413487','damage',[]],
  ['wall-broken-type-a','retro-urban/models/wall-broken-type-a.glb','0BD361F3821635C11D1CFAA05CB259A478EFD51FE94E9B36BF0F0BBF9359684F','damage',[]],
  ['roof-metal-type-a','retro-urban/models/roof-metal-type-a.glb','91C5F28BE3D30DFD209A6BE24786A20D5C279256BAAA8274D933E34A058DE40A','roof',[]],
  ['grass','retro-urban/models/grass.glb','9F7D3BC84706E31102EA82950522E2DB6539640D5AEE45072595B4A29F3FD580','ground',[]]
].map(([id,path,sha256,role,connectors])=>({id,path,sha256,role,connectors,pivot:[0,0,0],pivotPolicy:'source-origin-ground',gridFootprint:[1,1]}));

async function digestHex(buffer){const hash=await globalThis.crypto.subtle.digest('SHA-256',buffer);return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase()}
export async function inspectSourceCatalog(load){const records=[];for(const definition of SOURCE_PARTS){const buffer=await load(definition),sha256=await digestHex(buffer);if(sha256!==definition.sha256)throw new Error(`${definition.id} digest mismatch: ${sha256}`);const bounds=createRuntimeScene(parseGlb(buffer)).bounds;records.push({...definition,byteLength:buffer.byteLength,bounds})}return records}
