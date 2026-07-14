const fs=require('fs'),path=require('path'),root=__dirname;
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const core=require('./publish-library-core.js');
let fail=0;function check(ok,label){if(!ok){fail++;console.error('FAIL '+label);}else console.log('PASS '+label);}
const html=read('index.html'),js=read('publish-library.js'),manifest=JSON.parse(read('manifest.json')),contract=JSON.parse(read('module.contract.json'));
check(core.VIEWS.length===6,'six beginner-facing views');
check(core.VIEWS.some(v=>v.route==='library')&&core.VIEWS.some(v=>v.route==='packs'),'library and packs views');
check(core.VIEWS.some(v=>v.route==='release')&&core.VIEWS.some(v=>v.route==='packages')&&core.VIEWS.some(v=>v.route==='distribution'),'release, packaging and distribution views');
check(core.FORMATS.includes('PNG')&&core.FORMATS.includes('PDF')&&core.FORMATS.includes('SVG')&&core.FORMATS.includes('Audio')&&core.FORMATS.includes('Video')&&core.FORMATS.includes('3D')&&core.FORMATS.includes('Web')&&core.FORMATS.includes('Executable'),'requested output families are visible');
check(/data-src="\.\.\/asset-vault\//.test(html)&&/data-src="\.\.\/asset-pack-lab\//.test(html),'existing asset engines load lazily');
check(/data-src="\.\.\/workshop-packager\//.test(html)&&/data-src="\.\.\/launcher-card-installer\//.test(html),'existing package and distribution engines load lazily');
check(/axm\.publish-artifact\/v1/.test(js)&&/state:'INBOX'/.test(js),'versioned handoff enters unreviewed inbox');
check(/Review metadata/.test(js)&&/Accept evidence/.test(js),'artifact and release reviews stay separate');
check(/confirm\('Record this artifact as exported/.test(js),'export state requires confirmation');
check(/axm\.release-manifest\/v1/.test(js)&&/does not prove upload/.test(js),'release export keeps no-fake-done boundary');
check(manifest.id==='publish-library'&&manifest.version==='v1.0','manifest declares unified workspace v1.0');
check(contract.handoffs.accepts.includes('axm.publish-artifact/v1'),'contract declares artifact handoff');
check(contract.boundaries.refuses.includes('marketplace-publication'),'marketplace later is explicit');
if(fail)process.exit(1);console.log('Publish & Library selftest: PASS (shared library, reviewed release ledger, packages and distribution)');
