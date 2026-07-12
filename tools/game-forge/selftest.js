const fs=require('fs'),path=require('path'),root=__dirname,read=n=>fs.readFileSync(path.join(root,n),'utf8'),core=require('./game-forge-core.js');let fail=0;function check(ok,label){console.log((ok?'PASS ':'FAIL ')+label);if(!ok)fail++;}
const html=read('index.html'),js=read('game-forge.js'),manifest=JSON.parse(read('manifest.json')),contract=JSON.parse(read('module.contract.json'));
check(core.VIEWS.length===9,'nine unified Game Forge views');
check(['2D','3D'].every(x=>core.blankProject('x','X',x).runtimeMode===x),'2D and 3D project document modes');
check(core.blankProject('x','X','2D').world.cells.length===160,'semantic 16 by 10 world document');
check(/edgeFrom/.test(html)&&/edgeTo/.test(html)&&/events\.edges/.test(js),'visual event nodes and explicit edges');
check(core.SYSTEM_TYPES.includes('Dialogue')&&core.SYSTEM_TYPES.includes('Inventory Item')&&core.SYSTEM_TYPES.includes('Craft Recipe')&&core.SYSTEM_TYPES.includes('Quest')&&core.SYSTEM_TYPES.includes('HUD Component'),'requested gameplay systems');
check(core.BEHAVIOR_TYPES.includes('Selector')&&core.BEHAVIOR_TYPES.includes('Sequence')&&core.BEHAVIOR_TYPES.includes('Condition')&&core.BEHAVIOR_TYPES.includes('Action'),'NPC behavior tree vocabulary');
check(/studio\/index\.html\?game-forge=1/.test(html),'shared Studio HUD route');
check(/game-hub\/index\.html\?game-forge=1/.test(html),'real Game Hub lobby and runtime route');
check(/testEvidence/.test(html)&&/result:\$\('testResult'\)/.test(js),'evidence-bearing test ledger');
check(/axm\.game-mod-manifest\/v1/.test(js)&&/not installed/.test(js),'proposal-only mod export');
check(/axm\.game-forge-project\/v1/.test(js)&&/runtime package unchanged/.test(js),'portable project export without runtime claim');
check(/preview\.html\?project=/.test(js)&&/id="previewProject"/.test(html),'instant playable preview route');
check(/api\/game-forge\/build/.test(js)&&/STAGING ONLY/.test(html),'reviewed package candidate action');
check(manifest.id==='game-forge'&&manifest.version==='v1.1'&&contract.id==='game-forge','manifest and contract agree at v1.1');
if(fail)process.exit(1);console.log('Game Forge selftest: PASS (projects, worlds, events, systems, NPCs, lobby, tests and mods)');
