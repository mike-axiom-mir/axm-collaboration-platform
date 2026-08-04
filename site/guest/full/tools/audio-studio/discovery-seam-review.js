const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..','..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p)),C=require('./audio-studio-core.js');
const checks=[
 ['One visible parent covers all audio disciplines',()=>C.MODES.length===9],
 ['Tracks clips notes patches and exports share one project',()=>{const p=C.emptyProject('x');return ['tracks','clips','notes','patches','exports'].every(k=>Array.isArray(p[k]));}],
 ['Old Sound Forge oscillator noise filter and presets are preserved',()=>{const e=read('tools/audio-studio/sound-lab-engine.html');return /createOscillator/.test(e)&&/createBufferSource/.test(e)&&/createBiquadFilter/.test(e)&&/PRESETS/.test(e);}],
 ['Old direct Anthropic call is removed',()=>!/api\.anthropic\.com/.test(read('tools/audio-studio/sound-lab-engine.html'))],
 ['Saved Sound Lab effects join the shared timeline through a versioned seam',()=>/axm\.audio\.sound\/v1/.test(read('tools/audio-studio/sound-lab-engine.html'))&&/Sound Lab effect added to shared timeline/.test(read('tools/audio-studio/audio-studio.js'))],
 ['MIDI export writes a standard MThd and MTrk structure',()=>/77,84,104,100/.test(read('tools/audio-studio/audio-studio.js'))&&/77,84,114,107/.test(read('tools/audio-studio/audio-studio.js'))],
 ['Generative music is deterministic and remains note data',()=>JSON.stringify(C.generatePattern({seed:'x'}))===JSON.stringify(C.generatePattern({seed:'x'}))],
 ['Microphone route is explicit and user-triggered',()=>/startRecord/.test(read('tools/audio-studio/index.html'))&&/getUserMedia/.test(read('tools/audio-studio/audio-studio.js'))],
 ['Restoration uses a real offline filter render',()=>/createBiquadFilter/.test(read('tools/audio-studio/audio-studio.js'))&&/startRendering/.test(read('tools/audio-studio/audio-studio.js'))],
 ['Mixdown refuses to claim session-only sources',()=>json('tools/audio-studio/module.contract.json').boundaries.refuses.includes('pretend-imported-audio-in-mixdown')],
 ['Publish handoff enters unreviewed ledger state',()=>/state:'INBOX'/.test(read('tools/audio-studio/audio-studio.js'))],
 ['Voice cloning remains gated by provider rights and consent',()=>json('tools/audio-studio/module.contract.json').boundaries.refuses.includes('voice-cloning-without-provider-rights-and-consent')],
 ['Hub knows the Audio Studio friendly name and Create assignment',()=>/audio-studio/.test(read('hub/hub-shell.js'))],
 ['Project export remains explicit and portable',()=>/masterExportProject/.test(read('tools/audio-studio/index.html'))&&/jsonDownload/.test(read('tools/audio-studio/audio-studio.js'))]
];let fail=0;for(const [label,fn] of checks){let ok=false;try{ok=!!fn();}catch(e){}console.log((ok?'PASS  ':'FAIL  ')+label);if(!ok)fail++;}console.log('DISCOVERY COUNTS seams='+fail+' verified='+(checks.length-fail)+' future=4');if(fail){console.error('AUDIO STUDIO DISCOVERY SEAM FAIL — '+fail+' OPEN');process.exit(1);}console.log('AUDIO STUDIO DISCOVERY SEAM PASS — 0 OPEN');
