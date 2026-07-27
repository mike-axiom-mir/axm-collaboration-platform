import { inspectTechnicalAsset, sealTechnicalReport } from './technical-inspector.mjs';
import { verifyTechnicalReport } from './technical-verifier.mjs';
import { verifyExternalTextureSet } from './external-texture-verifier.mjs';

const assets = {
  building:{label:'Building',profile:'building',url:'../ps2-asset-forge/assets/kenney/city-commercial/models/building-g.glb',sha256:'9A28FA2FDFAC07492EE95589882213CFD6EB32D6752CB3B2F5404604C676D27A',externalTextures:{'Textures/colormap.png':'191BEC3889AAACA5018380038FECC129EBB5C2182879A099B7B538B3FA050B5D'}},
  vehicle:{label:'Vehicle',profile:'vehicle',url:'../ps2-asset-forge/assets/kenney/car-kit/models/hatchback-sports.glb',sha256:'BD5C9D4C3B4BDD254A66B8426563A68B1487AE7A5076DF3A2488E6FFED7BE64F',externalTextures:{'Textures/colormap.png':'F3622A03A20C6696065CAE9CBE391351BE873508AF190C2EBD1D420C055787A5'}},
  foliage:{label:'Foliage',profile:'foliage',url:'../ps2-asset-forge/assets/kenney/retro-urban/models/tree-large.glb',sha256:'2B17134078E452CFD4A074FD628E86DE0789F71E5215D6111FCFC98B15F3FD0C',externalTextures:{'Textures/treeA.png':'8445833D6AEF70E984BC8BEAE80389F407FE7CAF556D4909DA965E8919E36B0A'}},
  character:{label:'Character',profile:'character',url:'../ps2-asset-forge/proof/exports/animated-pedestrian.glb',sha256:'B448863767B1A770D70EFD45F04DDDF1BBA93B7855D1DBA7A9A6456115685D63'}
};
const $ = selector => document.querySelector(selector), tabs = [...document.querySelectorAll('.tab')];
let selected = 'building';
async function sha256(buffer) { const hash=await crypto.subtle.digest('SHA-256',buffer); return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase(); }
async function textureEvidence(asset, sourceBuffer, sourceSha256) {
  if (!asset.externalTextures) return {};
  const payloads = {};
  for (const uri of Object.keys(asset.externalTextures)) {
    const response = await fetch(new URL(uri, new URL(asset.url, location.href)));
    if (!response.ok) throw new Error(`${asset.label}: texture ${uri} HTTP ${response.status}`);
    payloads[uri] = await response.arrayBuffer();
  }
  return { textureSet:await verifyExternalTextureSet(sourceBuffer,{sha256:sourceSha256},payloads,asset.externalTextures) };
}
function renderCategories(categories) {
  $('#categories').replaceChildren(...categories.map(item=>{const article=document.createElement('article');article.className='category';article.innerHTML=`<header><h3>${item.label}</h3><span class="pill ${item.status}">${item.status}</span></header>${item.checks.map(check=>`<div class="gate ${check.status}"><i></i><div><strong>${check.message}</strong><small>${check.evidence}</small></div></div>`).join('')}`;return article}));
}
function renderChecks(verification) {
  $('#checks').replaceChildren(...verification.checks.map(item=>{const div=document.createElement('div');div.className=`verify-check ${item.status}`;div.innerHTML=`<i>${item.status==='pass'?'✓':'×'}</i><div><strong>${item.label}</strong><small>${item.evidence}</small></div>`;return div}));
}
async function inspect() {
  const asset=assets[selected]; $('#title').textContent=`Inspecting ${asset.label.toLowerCase()}`;
  try {
    const buffer=await(await fetch(asset.url)).arrayBuffer(),actual=await sha256(buffer);
    if(actual!==asset.sha256)throw new Error(`Fixture digest mismatch: ${actual}`);
    const evidence=await textureEvidence(asset,buffer,actual);
    const raw=inspectTechnicalAsset(buffer,{assetId:selected,sha256:actual,byteLength:buffer.byteLength},asset.profile,evidence),report=await sealTechnicalReport(raw),verification=await verifyTechnicalReport(buffer,report,{sha256:actual,byteLength:buffer.byteLength});
    renderCategories(report.categories); renderChecks(verification); $('#verdict').className=`verdict ${report.status}`; $('#verdict-icon').textContent=report.status==='technical-pass'?'✓':report.status==='blocked'?'×':'!';
    $('#title').textContent=report.status==='technical-pass'?`${asset.label} is technically ready`:`${asset.label} needs ${report.status==='blocked'?'a blocking repair':'repairs'}`;
    $('#copy').textContent=`${report.summary.blockers} blockers · ${report.summary.repairs} repair categories · permanent promotion remains off`; $('#score').textContent=report.status.replace('-',' ').toUpperCase(); $('#source').textContent=actual; $('#geometry').textContent=`${report.facts.triangles.toLocaleString('en-US')} tris · ${report.facts.vertices.toLocaleString('en-US')} verts`; $('#structure').textContent=`${report.facts.nodes} nodes · ${report.facts.materials} mats · ${report.facts.animations} clips`; $('#verification').textContent=report.reportSha256; $('#verify-title').textContent=`${verification.summary.passed}/${verification.summary.checks} independent checks pass`; $('#report-json').textContent=JSON.stringify({evidence,report,verification},null,2);
    document.body.dataset.assetId=selected; document.body.dataset.technicalStatus=report.status; document.body.dataset.verificationStatus=verification.status; document.body.dataset.reportSha256=report.reportSha256;
  } catch(error) { $('#verdict').className='verdict blocked'; $('#verdict-icon').textContent='×'; $('#title').textContent='Inspection stopped honestly'; $('#copy').textContent=error.message||String(error); console.error(error); }
}
function select(id){selected=id;tabs.forEach(tab=>{const active=tab.dataset.id===id;tab.classList.toggle('active',active);tab.setAttribute('aria-pressed',String(active))});inspect()}
tabs.forEach(tab=>tab.addEventListener('click',()=>select(tab.dataset.id)));
inspect();
