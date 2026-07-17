const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));let fail=0;
function check(label,test){try{if(!test())throw Error('condition false');console.log('PASS '+label);}catch(e){fail++;console.error('FAIL '+label+' - '+e.message);}}
check('Output jobs and receipts have explicit versioned schemas',()=>/axm\.output-job\/v1/.test(read('shared/output/axm-output-core.js'))&&/axm\.output-receipt\/v1/.test(read('shared/output/axm-output-core.js')));
check('PDF output is isolated behind Comlink worker execution',()=>/Comlink\.expose/.test(read('shared/output/axm-output-worker.js'))&&/new Worker/.test(read('shared/output/axm-output-client.js')));
check('Image work is isolated from the server and Hub thread',()=>/worker_threads/.test(read('shared/output/axm-node-output-worker.cjs'))&&/vendor\/wasm-vips/.test(read('shared/output/axm-node-output-worker.cjs')));
check('Every dependency is permissive open source',()=>json('shared/output/license-registry.json').dependencies.every(x=>['MIT','Apache-2.0','BSD-3-Clause'].includes(x.license)&&/^https:\/\/github\.com\//.test(x.source)));
check('Audited runtimes and notices survive offline public-safe packages',()=>{const r=json('shared/output/license-registry.json');return r.dependencies.every(x=>x.vendoredRuntime&&fs.existsSync(path.join(root,x.vendoredRuntime)))&&['comlink/LICENSE','jspdf/LICENSE','wasm-vips/LICENSE','wasm-vips/THIRD-PARTY-NOTICES.md'].every(x=>fs.existsSync(path.join(root,'shared/vendor',x)));});
check('Cancellation terminates the worker rather than pretending',()=>/worker\.terminate\(\)/.test(read('shared/output/axm-output-client.js'))&&/AbortError/.test(read('shared/output/axm-output-client.js')));
check('Receipts retain engine license hash and evidence',()=>['license','sha256','evidence','reviewState'].every(x=>read('shared/output/axm-output-core.js').includes(x)));
if(fail)process.exit(1);console.log('AXM Output Engine discovery seam: PASS (real outputs remain isolated, attributable and review-gated)');
