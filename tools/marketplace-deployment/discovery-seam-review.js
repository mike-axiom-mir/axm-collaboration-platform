'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
const checks = [
  ['Final parent matches saved Marketplace & Deployment scope', () => { const c=json('tools/marketplace-deployment/module.contract.json').provides; return ['local-distribution-catalog','license-and-provenance-review-gate','plugin-extension-package-proposals','deployment-and-self-hosting-plans','public-gallery-drafts','versioned-update-channel-drafts'].every(x=>c.includes(x)); }],
  ['Publish & Library remains an independently executable child', () => json('tools/publish-library/manifest.json').integratedInto==='marketplace-deployment' && fs.existsSync(path.join(root,'tools/publish-library/index.html'))],
  ['Nested package and launcher routes remain under Publish & Library', () => ['workshop-packager','launcher-card-installer'].every(id=>json('tools/'+id+'/manifest.json').integratedInto==='publish-library')],
  ['Marketplace has no payment or upload authority', () => { const r=json('tools/marketplace-deployment/module.contract.json').boundaries.refuses; return ['payment-processing','automatic-network-upload','marketplace-publication'].every(x=>r.includes(x)); }],
  ['Plugin distribution cannot install itself', () => /installAuthority: 'NONE'/.test(read('tools/marketplace-deployment/marketplace-deployment-core.js'))],
  ['Deployment plans retain rollback and execution boundaries', () => { const c=read('tools/marketplace-deployment/marketplace-deployment-core.js'); return /Rollback procedure is missing/.test(c)&&/executionAuthority: 'NONE'/.test(c)&&/networkAction: 'NONE'/.test(c); }],
  ['Update channels cannot auto-install', () => /automaticInstall: false/.test(read('tools/marketplace-deployment/marketplace-deployment-core.js'))],
  ['Gallery explicitly distinguishes draft from publication', () => /No external publication occurred/.test(read('tools/marketplace-deployment/marketplace-deployment-app.js'))],
  ['Dual review preserves human and machine seats', () => { const c=read('tools/marketplace-deployment/marketplace-deployment-core.js'); return /seatKind === 'human'/.test(c)&&/seatKind === 'machine'/.test(c); }],
  ['Solo review remains available to one intelligence', () => /\['solo', 'dual'\]/.test(read('tools/marketplace-deployment/marketplace-deployment-core.js'))],
  ['Live foundation checks stay on local APIs', () => { const a=read('tools/marketplace-deployment/marketplace-deployment-app.js'); return ['/api/health','/api/tools','/api/workshop-packages'].every(x=>a.includes(x))&&!/https?:\/\//.test(a); }],
  ['README names missing live adapters honestly', () => { const r=read('tools/marketplace-deployment/README.md'); return /no payment rail/i.test(r)&&/no remote marketplace API/i.test(r)&&/not a deployment claim/i.test(r); }]
];
let failed=0;
checks.forEach(([label,fn])=>{try{if(fn()){console.log('PASS '+label);}else{failed++;console.error('FAIL '+label);}}catch(error){failed++;console.error('FAIL '+label+': '+error.message);}});
if(failed) process.exit(1);
console.log('Marketplace & Deployment discovery seam review: PASS');
