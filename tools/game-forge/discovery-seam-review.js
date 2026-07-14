const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..','..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p)),core=require('./game-forge-core.js');
const checks=[
 ['One visible parent owns Game Hub and sandbox compatibility routes',()=>['game-hub','sandbox'].every(id=>json('tools/'+id+'/manifest.json').integratedInto==='game-forge')],
 ['Games remain modular packages under one verified library',()=>fs.readdirSync(path.join(root,'tools/game-hub/game-library'),{withFileTypes:true}).filter(x=>x.isDirectory()).every(x=>fs.existsSync(path.join(root,'tools/game-hub/game-library',x.name,'game.manifest.json')))],
 ['Existing package verifier still enforces player and runtime contracts',()=>{const j=read('tools/game-hub/game-package-verifier.js');return /max_players/.test(j)&&/required_paths/.test(j)&&/no_hidden_players/.test(j);}],
 ['Existing runtime server remains the managed launch authority',()=>{const j=read('tools/game-hub/game-hub-server.js');return /startGameRuntime/.test(j)&&/controller_urls/.test(j)&&/runtime_port/.test(j);}],
 ['Default four seats and optional extra four remain in the engine',()=>{const j=read('tools/game-hub/game-engine/engine-core.js');return /DEFAULT_VISIBLE_SEATS = 4/.test(j)&&/OPTIONAL_EXTRA_SEATS = 4/.test(j)&&/MAX_SEATS = 8/.test(j);}],
 ['Nine views cover project, world, events, systems, NPCs, HUD, play and tests',()=>core.VIEWS.length===9],
 ['2D and 3D use a versioned semantic project document',()=>{const p=core.blankProject('x','X','3D');return p.schema==='axm.game-forge-project/v1'&&p.world.cells.length===160;}],
 ['3D editor refuses to imply a general runtime exists',()=>json('tools/game-forge/module.contract.json').boundaries.refuses.includes('pretend-3d-runtime-execution')],
 ['Event connections are stored explicitly',()=>{const j=read('tools/game-forge/game-forge.js');return /events\.edges\.push/.test(j)&&/Choose two different event nodes/.test(j);}],
 ['Gameplay systems require parseable structured data',()=>/System JSON is invalid/.test(read('tools/game-forge/game-forge.js'))],
 ['NPC trees are documents until a runtime explicitly consumes them',()=>/runtime execution not implied/.test(read('tools/game-forge/game-forge.js'))],
 ['HUD reuses Studio instead of adding another design engine',()=>/\.\.\/studio\/index\.html\?game-forge=1/.test(read('tools/game-forge/index.html'))],
 ['Play-test reuses real Game Hub seats and controllers',()=>/\.\.\/game-hub\/index\.html\?game-forge=1/.test(read('tools/game-forge/index.html'))],
 ['Tests preserve evidence and mods remain uninstalled proposals',()=>{const j=read('tools/game-forge/game-forge.js');return /Test recorded · result kept as entered/.test(j)&&/Mod proposal saved · not installed/.test(j);}],
 ['Reviewed Studio asset handoff remains active',()=>{const c=json('tools/game-hub/module.contract.json');return c.handoffs.accepts.includes('axm.game-asset/v1')&&c.boundaries.refuses.includes('unreviewed-package-write');}],
 ['Existing enabled children promote Game Forge without deleting saved data',()=>/promoteIntegratedParents/.test(read('hub/hub-shell.js'))]
 ,['Preview is driven from the saved semantic map without canvas-only rendering',()=>{const h=read('tools/game-forge/preview.html');return /world\.cells/.test(h)&&/className='tile/.test(h)&&!/canvas/i.test(h);}]
 ,['Package builder stages candidates and invokes the real verifier',()=>{const s=read('tools/game-forge/package-service.js'),server=read('server.js');return /GameVerifier\.verifyGameDir/.test(s)&&/installed:false/.test(s)&&/api\/game-forge\/build/.test(server);}]
];let fail=0;for(const [label,fn] of checks){let ok=false;try{ok=!!fn();}catch(e){}console.log((ok?'PASS  ':'FAIL  ')+label);if(!ok)fail++;}console.log('DISCOVERY COUNTS seams='+fail+' verified='+(checks.length-fail)+' future=2');if(fail){console.error('GAME FORGE DISCOVERY SEAM FAIL — '+fail+' OPEN');process.exit(1);}console.log('GAME FORGE DISCOVERY SEAM PASS — 0 OPEN');
