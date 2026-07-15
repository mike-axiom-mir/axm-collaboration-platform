const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const checks=[
 ['One visible parent owns all four compatibility destinations',()=>['asset-vault','asset-pack-lab','workshop-packager','launcher-card-installer'].every(id=>json('tools/'+id+'/manifest.json').integratedInto==='publish-library')],
 ['Six views cover library, reuse, export, packages and distribution',()=>require('./publish-library-core.js').VIEWS.length===6],
 ['Specialist tools load lazily instead of booting together',()=>{const h=read('tools/publish-library/index.html');return (h.match(/data-src=/g)||[]).length===4&&!/<iframe[^>]+\ssrc="\.\.\/asset-vault/.test(h);}],
 ['Incoming artifacts are bounded and remain unreviewed',()=>{const j=read('tools/publish-library/publish-library.js');return /event\.origin!==location\.origin/.test(j)&&/axm\.publish-artifact\/v1/.test(j)&&/state:'INBOX'/.test(j);}],
 ['Metadata review and output readiness are distinct',()=>{const j=read('tools/publish-library/publish-library.js');return /Review metadata/.test(j)&&/Mark output ready/.test(j);}],
 ['Export recording requires explicit confirmation',()=>/confirm\('Record this artifact as exported/.test(read('tools/publish-library/publish-library.js'))],
 ['Release evidence is never accepted automatically',()=>{const j=read('tools/publish-library/publish-library.js');return /accepted:false/.test(j)&&/Accept evidence/.test(j);}],
 ['Release manifest preserves the no-upload boundary',()=>{const j=read('tools/publish-library/publish-library.js');return /axm\.release-manifest\/v1/.test(j)&&/does not prove upload/.test(j);}],
 ['All requested output families are surfaced honestly',()=>{const c=require('./publish-library-core.js');return ['PNG','PDF','SVG','Audio','Video','3D','Web','Executable'].every(x=>c.FORMATS.includes(x));}],
 ['Real PDF and image engines live inside Publish instead of becoming modules',()=>{const h=read('tools/publish-library/index.html'),j=read('tools/publish-library/publish-library.js');return /pdfOutputForm/.test(h)&&/imageOutputForm/.test(h)&&/AXMOutput\.run/.test(j);}],
 ['Generated outputs retain review gate and verifiable receipts',()=>/review still required/.test(read('tools/publish-library/publish-library.js'))&&/axm\.output-receipt\/v1/.test(read('shared/output/axm-output-core.js'))],
 ['Output dependencies are permissive open source only',()=>json('shared/output/license-registry.json').dependencies.every(x=>['MIT','Apache-2.0','BSD-3-Clause'].includes(x.license))],
 ['Public-safe packaging keeps the existing secret-scanning engine',()=>{const h=read('tools/workshop-packager/index.html');return /Public-safe package/.test(h)&&/secret scan/.test(h)&&/REFUSED \/ FAILED/.test(h);}],
 ['Existing child data routes remain available',()=>['asset-vault','asset-pack-lab','workshop-packager','launcher-card-installer'].every(id=>fs.existsSync(path.join(root,'tools',id,'index.html')))],
 ['Existing enabled children promote the unified parent',()=>/promoteIntegratedParents/.test(read('hub/hub-shell.js'))],
 ['Forge Line remains an advanced proposal tool, not falsely swallowed whole',()=>!json('tools/forge-line/manifest.json').integratedInto],
 ['Marketplace publishing is visibly future, not simulated',()=>json('tools/publish-library/module.contract.json').boundaries.refuses.includes('marketplace-publication')]
];
let fail=0;for(const [label,fn] of checks){let ok=false;try{ok=!!fn();}catch(e){}console.log((ok?'PASS  ':'FAIL  ')+label);if(!ok)fail++;}
console.log('DISCOVERY COUNTS seams='+fail+' verified='+(checks.length-fail)+' future=1');
if(fail){console.error('PUBLISH & LIBRARY DISCOVERY SEAM FAIL — '+fail+' OPEN');process.exit(1);}console.log('PUBLISH & LIBRARY DISCOVERY SEAM PASS — 0 OPEN');
