import { MATERIAL_FAMILIES, bakeMaterial, renderMaterialBall } from './pbr-baker-core.mjs';
import { verifyMaterialBake } from './pbr-baker-verifier.mjs';

const tabs=[...document.querySelectorAll('.family-tab')],seedInput=document.querySelector('#seed-input'),sizeSelect=document.querySelector('#size-select'),strengthInput=document.querySelector('#strength-input'),strengthValue=document.querySelector('#strength-value'),bakeButton=document.querySelector('#bake-button'),exportButton=document.querySelector('#export-button'),familyTitle=document.querySelector('#family-title'),previewTitle=document.querySelector('#preview-title'),gatePill=document.querySelector('#gate-pill'),recipeDigest=document.querySelector('#recipe-digest'),ballCanvas=document.querySelector('#ball-canvas'),verificationList=document.querySelector('#verification-list'),verificationTotal=document.querySelector('#verification-total'),receiptSha=document.querySelector('#receipt-sha'),receiptJson=document.querySelector('#receipt-json');
const mapCanvases=Object.fromEntries(['albedo','normal','orm','height','emissive'].map(name=>[name,document.querySelector(`#map-${name}`)]));
const hashFields=Object.fromEntries(['albedo','normal','orm','height','emissive'].map(name=>[name,document.querySelector(`#hash-${name}`)]));
const signals={albedo:document.querySelector('#albedo-signal'),height:document.querySelector('#height-signal'),normal:document.querySelector('#normal-length'),score:document.querySelector('#verify-score')};
let family='brick',currentBake=null,currentReceipt=null;

function draw(canvas,pixels,size){canvas.width=size;canvas.height=size;const context=canvas.getContext('2d',{alpha:false});context.putImageData(new ImageData(pixels,size,size),0,0);}
async function digestPixels(pixels){const copy=pixels.buffer.slice(pixels.byteOffset,pixels.byteOffset+pixels.byteLength),digest=await crypto.subtle.digest('SHA-256',copy);return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();}
async function digestText(text){return digestPixels(new TextEncoder().encode(text));}
function stable(value){const sort=input=>Array.isArray(input)?input.map(sort):input&&typeof input==='object'?Object.fromEntries(Object.keys(input).sort().map(key=>[key,sort(input[key])])):input;return JSON.stringify(sort(value));}

function renderVerification(verification){verificationList.replaceChildren(...verification.checks.map(check=>{const item=document.createElement('article');item.className=`verify-item ${check.status}`;item.innerHTML=`<i>${check.status==='pass'?'✓':'×'}</i><div><strong>${check.label}</strong><small>${check.evidence}</small></div>`;return item;}));verificationTotal.textContent=`${verification.summary.passed} / ${verification.checks.length} PASS`;}

async function bake(){bakeButton.disabled=true;exportButton.disabled=true;gatePill.textContent='BAKING';gatePill.className='gate-pill';try{
  currentBake=bakeMaterial({family,seed:seedInput.value,size:Number(sizeSelect.value),normalStrength:Number(strengthInput.value)});const verification=verifyMaterialBake(currentBake),mapDigests={};
  for(const [name,canvas] of Object.entries(mapCanvases)){draw(canvas,currentBake.maps[name],currentBake.recipe.size);mapDigests[name]=await digestPixels(currentBake.maps[name]);hashFields[name].textContent=`PIXEL SHA256 ${mapDigests[name].slice(0,12)}…${mapDigests[name].slice(-8)}`;}
  draw(ballCanvas,renderMaterialBall(currentBake),currentBake.recipe.size);renderVerification(verification);
  const receiptBase={schema:'axm.pbr-material-bake-receipt/v1',recipe:currentBake.recipe,mapPixelSha256:mapDigests,verification};const receiptDigest=await digestText(stable(receiptBase));currentReceipt={...receiptBase,receiptSha256:receiptDigest};
  const statistics=verification.statistics;signals.albedo.textContent=`σ ${Math.max(...statistics.albedo.map(value=>value.stddev)).toFixed(1)}`;signals.height.textContent=`σ ${statistics.height.stddev.toFixed(1)}`;signals.normal.textContent=statistics.normalMeanLength.toFixed(4);signals.score.textContent=`${verification.summary.passed}/${verification.checks.length}`;
  gatePill.textContent=verification.status==='pass'?'TECHNICAL PASS':'REPAIR';gatePill.className=`gate-pill ${verification.status}`;recipeDigest.textContent=`RECEIPT ${receiptDigest.slice(0,16)}…`;receiptSha.textContent=`SHA256 ${receiptDigest}`;receiptJson.textContent=JSON.stringify(currentReceipt,null,2);exportButton.disabled=verification.status!=='pass';document.body.dataset.bakeStatus=verification.status;document.body.dataset.family=family;document.body.dataset.receiptSha256=receiptDigest;
}catch(error){gatePill.textContent='STOPPED';receiptJson.textContent=error.stack||String(error);console.error(error);}finally{bakeButton.disabled=false;}}

function selectFamily(next){family=next;const profile=MATERIAL_FAMILIES[family];tabs.forEach(tab=>{const active=tab.dataset.family===family;tab.classList.toggle('active',active);tab.setAttribute('aria-pressed',String(active));});familyTitle.textContent=profile.label;previewTitle.textContent=profile.label;strengthInput.value=String(profile.normalStrength);strengthValue.textContent=String(profile.normalStrength);seedInput.value=`${family}-01`;bake();}
tabs.forEach(tab=>tab.addEventListener('click',()=>selectFamily(tab.dataset.family)));
strengthInput.addEventListener('input',()=>strengthValue.textContent=Number(strengthInput.value).toFixed(1));
bakeButton.addEventListener('click',bake);
exportButton.addEventListener('click',async()=>{if(!currentBake||!currentReceipt)return;for(const [name,canvas] of Object.entries(mapCanvases)){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${family}-${name}-${currentReceipt.mapPixelSha256[name].slice(0,12)}.png`;link.click();URL.revokeObjectURL(url);}const receiptUrl=URL.createObjectURL(new Blob([JSON.stringify(currentReceipt,null,2)],{type:'application/json'})),receiptLink=document.createElement('a');receiptLink.href=receiptUrl;receiptLink.download=`${family}-${currentReceipt.receiptSha256.slice(0,12)}-bake.json`;receiptLink.click();URL.revokeObjectURL(receiptUrl);});
window.__AXM_PBR_BAKER__={bake,getReceipt:()=>currentReceipt?structuredClone(currentReceipt):null};
bake();
