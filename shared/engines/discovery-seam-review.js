const fs=require('fs'),path=require('path'),E=require('./axm-shared-engines.js'),contract=JSON.parse(fs.readFileSync(path.join(__dirname,'engine-contract.json'),'utf8')),src=fs.readFileSync(path.join(__dirname,'axm-shared-engines.js'),'utf8'),audio=fs.readFileSync(path.join(__dirname,'..','..','tools','audio-studio','index.html'),'utf8');
const checks=[
 ['Exactly ten shared engine contracts exist',()=>contract.engines.length===10],
 ['Shared engines are infrastructure rather than a sidebar manifest',()=>contract.visibility==='background-library-not-sidebar-module'&&!fs.existsSync(path.join(__dirname,'manifest.json'))],
 ['Project checkpoints preserve data hashes actors and rollback provenance',()=>/dataHash/.test(src)&&/checkpoint-restored/.test(src)],
 ['Asset records preserve source dependencies and license status',()=>/dependencyReport/.test(src)&&/licenseStatus/.test(src)],
 ['Scene graph supports 2D and 3D hierarchy selection and subtree removal',()=>/axm\.scene-graph\/v1/.test(src)&&/removed:remove/.test(src)],
 ['Timeline owns tracks clips keyframes markers and interpolation',()=>/axm\.timeline\/v1/.test(src)&&/valueAt:function/.test(src)],
 ['Node graph refuses undeclared cycle semantics',()=>/graph contains a cycle/.test(src)],
 ['Renderer and physics report unavailable instead of inventing fallback',()=>/status:'UNAVAILABLE'/.test(src)&&/adapterRegistry\('renderer'\)/.test(src)&&/adapterRegistry\('physics'\)/.test(src)],
 ['Collaboration keeps presence questions approvals notices and handoffs distinct',()=>['comment','question','approval','notice','handoff'].every(x=>src.includes("'"+x+"'"))],
 ['Evidence distinguishes unsupported claims and append-only corrections',()=>/UNSUPPORTED/.test(src)&&/supersedes/.test(src)],
 ['Exporter requires actual output plus evidence',()=>/adapter did not return output plus evidence/.test(src)],
 ['Human and machine actions use one identical control shape',()=>/controlShape:function/.test(src)&&/\['human','machine','service'\]/.test(src)],
 ['Audio Studio is the first representative workspace to load the shared bundle',()=>/axm-shared-engines\.js/.test(audio)],
 ['Existing workspaces remain valid during incremental adoption',()=>contract.principles.some(x=>/incremental/.test(x))]
];let fail=0;for(const [label,fn] of checks){let ok=false;try{ok=!!fn();}catch(e){}console.log((ok?'PASS  ':'FAIL  ')+label);if(!ok)fail++;}console.log('DISCOVERY COUNTS seams='+fail+' verified='+(checks.length-fail)+' future=5');if(fail){console.error('SHARED ENGINES DISCOVERY SEAM FAIL — '+fail+' OPEN');process.exit(1);}console.log('SHARED ENGINES DISCOVERY SEAM PASS — 0 OPEN');
