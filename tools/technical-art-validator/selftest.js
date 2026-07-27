import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { inspectTechnicalAsset, REQUIRED_CATEGORIES, sealTechnicalReport } from './technical-inspector.mjs';
import { verifyTechnicalReport } from './technical-verifier.mjs';
import { verifyExternalTextureSet } from './external-texture-verifier.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'); let checks=0;
function ok(value,message){if(!value)throw new Error(message);checks++}
async function digest(buffer){const hash=await crypto.subtle.digest('SHA-256',buffer);return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase()}
function arrayBuffer(file){const bytes=fs.readFileSync(file);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}
const fixtures=[
  {id:'building',profile:'building',file:'ps2-asset-forge/assets/kenney/city-commercial/models/building-g.glb',sha:'9A28FA2FDFAC07492EE95589882213CFD6EB32D6752CB3B2F5404604C676D27A',textures:{'Textures/colormap.png':{file:'ps2-asset-forge/assets/kenney/city-commercial/models/Textures/colormap.png',sha:'191BEC3889AAACA5018380038FECC129EBB5C2182879A099B7B538B3FA050B5D'}}},
  {id:'vehicle',profile:'vehicle',file:'ps2-asset-forge/assets/kenney/car-kit/models/hatchback-sports.glb',sha:'BD5C9D4C3B4BDD254A66B8426563A68B1487AE7A5076DF3A2488E6FFED7BE64F',textures:{'Textures/colormap.png':{file:'ps2-asset-forge/assets/kenney/car-kit/models/Textures/colormap.png',sha:'F3622A03A20C6696065CAE9CBE391351BE873508AF190C2EBD1D420C055787A5'}}},
  {id:'foliage',profile:'foliage',file:'ps2-asset-forge/assets/kenney/retro-urban/models/tree-large.glb',sha:'2B17134078E452CFD4A074FD628E86DE0789F71E5215D6111FCFC98B15F3FD0C',textures:{'Textures/treeA.png':{file:'ps2-asset-forge/assets/kenney/retro-urban/models/Textures/treeA.png',sha:'8445833D6AEF70E984BC8BEAE80389F407FE7CAF556D4909DA965E8919E36B0A'}}},
  {id:'character',profile:'character',file:'ps2-asset-forge/proof/exports/animated-pedestrian.glb',sha:'B448863767B1A770D70EFD45F04DDDF1BBA93B7855D1DBA7A9A6456115685D63'}
];

for(const fixture of fixtures){
  const buffer=arrayBuffer(path.join(root,fixture.file)),sha=await digest(buffer); ok(sha===fixture.sha,`${fixture.id} digest`);
  let evidence={};
  if(fixture.textures){
    const payloads={},expected={}; for(const[uri,spec]of Object.entries(fixture.textures)){payloads[uri]=arrayBuffer(path.join(root,spec.file));expected[uri]=spec.sha}
    const textureSet=await verifyExternalTextureSet(buffer,{sha256:sha},payloads,expected); ok(textureSet.status==='pass',`${fixture.id} external textures independently pass`); ok(textureSet.summary.external===Object.keys(fixture.textures).length,`${fixture.id} external texture count`); evidence={textureSet};
    const uri=Object.keys(payloads)[0],tampered=payloads[uri].slice(0);new Uint8Array(tampered)[0]^=255;
    ok((await verifyExternalTextureSet(buffer,{sha256:sha},{...payloads,[uri]:tampered},expected)).status==='blocked',`${fixture.id} tampered texture blocked`);
  }
  const report=await sealTechnicalReport(inspectTechnicalAsset(buffer,{assetId:fixture.id,sha256:sha,byteLength:buffer.byteLength},fixture.profile,evidence));
  ok(report.schema==='axm.technical-art-report/v1',`${fixture.id} schema`); ok(report.sourceSha256===sha,`${fixture.id} binds digest`); ok(report.sourceByteLength===buffer.byteLength,`${fixture.id} binds length`); ok(REQUIRED_CATEGORIES.every(category=>report.categories.filter(item=>item.id===category).length===1),`${fixture.id} complete categories`); ok(report.categories.find(item=>item.id==='visual-quality').status==='human-review',`${fixture.id} visual stays human`); ok(report.promotion==='not-approved',`${fixture.id} not promoted`); ok(report.reportSha256.length===64,`${fixture.id} report sealed`); ok(report.categories.find(item=>item.id==='maps').status==='pass',`${fixture.id} texture route passes`);
  const verification=await verifyTechnicalReport(buffer,report,{sha256:sha,byteLength:buffer.byteLength}); ok(verification.status==='pass',`${fixture.id} independent verification`); ok(verification.summary.passed===verification.summary.checks,`${fixture.id} all verifier checks`); ok(report.categories.find(item=>item.id==='lod').status==='repair',`${fixture.id} missing LOD explained`); if(fixture.profile!=='foliage')ok(report.categories.find(item=>item.id==='collision').status==='repair',`${fixture.id} missing collision explained`);
  const tampered={...report,sourceSha256:'0'.repeat(64)};ok((await verifyTechnicalReport(buffer,tampered,{sha256:sha,byteLength:buffer.byteLength})).status==='blocked',`${fixture.id} fake digest blocked`);
  const incomplete={...report,categories:report.categories.slice(1)};ok((await verifyTechnicalReport(buffer,incomplete,{sha256:sha,byteLength:buffer.byteLength})).status==='blocked',`${fixture.id} missing category blocked`);
  const visualLie=structuredClone(report);visualLie.categories.find(item=>item.id==='visual-quality').status='pass';visualLie.categories.find(item=>item.id==='visual-quality').checks[0].status='pass';ok((await verifyTechnicalReport(buffer,visualLie,{sha256:sha,byteLength:buffer.byteLength})).status==='blocked',`${fixture.id} visual self-approval blocked`);
  const proofLie=structuredClone(report),lod=proofLie.categories.find(item=>item.id==='lod');lod.status='pass';lod.checks[0].status='pass';lod.checks[0].evidence='No lod receipt attached';ok((await verifyTechnicalReport(buffer,proofLie,{sha256:sha,byteLength:buffer.byteLength})).status==='blocked',`${fixture.id} impossible proof blocked`);
}
console.log(`Technical Art Validator self-test passed ${checks} checks.`);
