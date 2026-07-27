import { NativeWebGL2Renderer } from '../local-3d-game-runtime/native-renderer.mjs';
import { composeTRS } from '../local-3d-game-runtime/native-math.mjs';
import { createGameState, startGame, stepGame, FIXED_DELTA } from '../local-3d-game-runtime/runtime-core.mjs';
import { imageBytes, parseGlb } from '../local-3d-game-runtime/native-glb.mjs';
import { GpuTimer, PostProcessor } from './post-processor.mjs';
import { buildSuite, dataUrlBytes, sealSuite, sha256Bytes, summarizeRun } from './profile-core.mjs';
import { verifyProfileSuite } from './profile-verifier.mjs';

const $ = selector => document.querySelector(selector);
const source = $('#source'), postCanvas = $('#post'), timeline = $('#timeline'), timelineContext = timeline.getContext('2d');
const specs = [
  { id:'district-storefront', url:'../ps2-asset-forge/proof/exports/storefront-technical-proof.glb', digest:'AFCB7802418930DEE6F8B7A410F1C78CE401D4C6F8B728336E99F62458237222', transform:composeTRS() },
  { id:'animated-pedestrian', url:'../ps2-asset-forge/proof/exports/animated-pedestrian.glb', digest:'B448863767B1A770D70EFD45F04DDDF1BBA93B7855D1DBA7A9A6456115685D63', transform:composeTRS([2.5,0,3.7]), animationPattern:/Man_Idle$/ },
  { id:'modular-commercial-building', url:'../ps2-asset-forge/assets/kenney/city-commercial/models/building-g.glb', digest:'9A28FA2FDFAC07492EE95589882213CFD6EB32D6752CB3B2F5404604C676D27A', transform:composeTRS([-4.5,0,2.2],[0,Math.sin(-.16),0,Math.cos(-.16)],[2.2,2.2,2.2]), externalTextureDigests:{'Textures/colormap.png':'191BEC3889AAACA5018380038FECC129EBB5C2182879A099B7B538B3FA050B5D'} },
  { id:'street-hatchback', url:'../ps2-asset-forge/assets/kenney/car-kit/models/hatchback-sports.glb', digest:'BD5C9D4C3B4BDD254A66B8426563A68B1487AE7A5076DF3A2488E6FFED7BE64F', transform:composeTRS([3.8,0,3.1],[0,Math.sin(.45),0,Math.cos(.45)],[.9,.9,.9]), externalTextureDigests:{'Textures/colormap.png':'F3622A03A20C6696065CAE9CBE391351BE873508AF190C2EBD1D420C055787A5'} },
  { id:'distance-tree', url:'../ps2-asset-forge/assets/kenney/retro-urban/models/tree-large.glb', digest:'2B17134078E452CFD4A074FD628E86DE0789F71E5215D6111FCFC98B15F3FD0C', transform:composeTRS([-3.4,0,5.3],[0,0,0,1],[1.45,1.45,1.45]), externalTextureDigests:{'Textures/treeA.png':'8445833D6AEF70E984BC8BEAE80389F407FE7CAF556D4909DA965E8919E36B0A'} }
];
let renderer, post, nativeTimer, postTimer, suite, verification, screenshots = {};

function nextFrame() { return new Promise(resolve => requestAnimationFrame(resolve)); }
function camera(game) {
  const yaw = Math.PI, pitch = .28, distance = 9.6, horizontal = Math.cos(pitch) * distance;
  const target = [game.player.x, 1.05, game.player.z];
  return { target, eye:[target[0]-Math.sin(yaw)*horizontal,target[1]+Math.sin(pitch)*distance+1.15,target[2]-Math.cos(yaw)*horizontal], fov:47 };
}
function progress(title, copy, value) {
  $('#progress-title').textContent = title; $('#progress-copy').textContent = copy;
  $('#progress-value').textContent = `${Math.round(value * 100)}%`; $('#progress-bar').style.width = `${value * 100}%`;
}
function calibrateOverhead() {
  const count = 20000, start = performance.now(); let ring = [];
  for (let index = 0; index < count; index += 1) {
    const timestamp = performance.now(); ring.push({ timestamp, index }); if (ring.length > 256) ring.shift();
  }
  return (performance.now() - start) * 1000 / count;
}
async function inspectPayloads() {
  let sourceBytes = 0, textureBytes = 0;
  for (const spec of specs) {
    const response = await fetch(spec.url), buffer = await response.arrayBuffer(), sha = await sha256Bytes(new Uint8Array(buffer));
    if (sha !== spec.digest) throw new Error(`${spec.id} digest mismatch: ${sha}`);
    sourceBytes += buffer.byteLength;
    const model = parseGlb(buffer);
    for (let index = 0; index < (model.document.images || []).length; index += 1) {
      const embedded = imageBytes(model, index);
      if (embedded) { textureBytes += embedded.bytes.byteLength; continue; }
      const image = model.document.images[index], expected = spec.externalTextureDigests?.[image.uri];
      if (!expected) throw new Error(`${spec.id}: missing external texture digest for ${image.uri}`);
      const textureResponse = await fetch(new URL(image.uri, response.url)), textureBuffer = await textureResponse.arrayBuffer(), actual = await sha256Bytes(new Uint8Array(textureBuffer));
      if (actual !== expected) throw new Error(`${spec.id}: external texture digest mismatch for ${image.uri}`);
      textureBytes += textureBuffer.byteLength;
    }
  }
  return { sourceBytes, textureBytes };
}
function sumGpu(sample) {
  const values = [sample.gpuNativeMs, sample.gpuPostMs].filter(Number.isFinite);
  sample.gpuMs = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}
function pollTimers() { nativeTimer.poll(); postTimer.poll(); }
function profileInput(frameIndex) {
  return { forward:1, right:Math.sin(frameIndex * .07) * .35, sprint:frameIndex % 90 > 66, yaw:Math.PI + Math.sin(frameIndex * .013) * .18 };
}

async function profileMode(mode, startFrame) {
  let game = startGame(createGameState(`profile-${mode}`)), lastRaf = performance.now(), frameCounter = startFrame;
  const warmup = [], samples = [];
  async function measureOne(record) {
    const raf = await nextFrame(), frameIntervalMs = raf - lastRaf; lastRaf = raf;
    const begin = performance.now(), updateStart = performance.now();
    game = stepGame(game, profileInput(frameCounter), FIXED_DELTA);
    const updateMs = performance.now() - updateStart;
    const sample = { frameIndex:frameCounter, sceneTick:game.tick, frameIntervalMs, updateMs, gpuNativeMs:null, gpuPostMs:null };
    const renderStart = performance.now();
    nativeTimer.begin(sample, 'gpuNativeMs');
    const stats = renderer.render({ gameState:game, camera:camera(game), time:game.elapsed, night:mode === 'post' });
    nativeTimer.end();
    const renderSubmitMs = performance.now() - renderStart;
    const postStart = performance.now();
    let postStats = { draws:0, triangles:0, textureUploadBytes:0 };
    if (mode === 'post') {
      postTimer.begin(sample, 'gpuPostMs');
      postStats = post.render(source, 1.18);
      postTimer.end();
    }
    const postProcessMs = performance.now() - postStart;
    const telemetryStart = performance.now(), draws = stats.draws + postStats.draws, triangles = stats.triangles + postStats.triangles;
    const textureUploadBytes = postStats.textureUploadBytes;
    const overdrawProxy = 1 + draws * .018 + triangles / (source.width * source.height) * .7;
    const telemetryMs = performance.now() - telemetryStart, cpuTotalMs = performance.now() - begin;
    Object.assign(sample, { renderSubmitMs, postProcessMs, telemetryMs, cpuTotalMs, stallMs:Math.max(0, frameIntervalMs - 1000/60), draws, triangles, textureUploadBytes, overdrawProxy });
    pollTimers(); sumGpu(sample); record.push(sample); frameCounter += 1;
  }
  for (let index = 0; index < 30; index += 1) {
    await measureOne(warmup);
    progress(`${mode === 'native' ? 'Native' : 'Post'} warm-up`, `${index + 1}/30 frames are excluded from percentiles.`, (mode === 'native' ? 0 : .5) + (index + 1) / 30 * .125);
  }
  for (let index = 0; index < 90; index += 1) {
    await measureOne(samples);
    progress(`${mode === 'native' ? 'Native' : 'Post'} measurement`, `${index + 1}/90 retained timing rows.`, (mode === 'native' ? .125 : .625) + (index + 1) / 90 * .375);
  }
  for (let index = 0; index < 4; index += 1) { await nextFrame(); pollTimers(); }
  nativeTimer.finish(); postTimer.finish(); pollTimers(); for (const sample of samples) sumGpu(sample);
  const metadata = { gpuTimerStatus:nativeTimer.status === 'measured' && (mode === 'native' || postTimer.status === 'measured') ? 'measured' : 'unsupported', shaderCompileMs:{native:renderer.__compileMs,post:post.compileMs} };
  const run = summarizeRun(mode, warmup, samples, metadata), worstSample = samples.find(sample => sample.frameIndex === run.worstFrame.frameIndex);
  let replay = startGame(createGameState(`profile-${mode}`));
  for (let index = 0; index < worstSample.sceneTick; index += 1) replay = stepGame(replay, profileInput(startFrame + index), FIXED_DELTA);
  renderer.render({ gameState:replay, camera:camera(replay), time:replay.elapsed, night:mode === 'post' });
  const dataUrl = mode === 'post' ? (post.render(source, 1.18), post.frameProof()) : renderer.frameProof();
  const bytes = dataUrlBytes(dataUrl), sha = await sha256Bytes(bytes);
  run.screenshot = { kind:'deterministic-worst-state-replay', timingFrameIndex:run.worstFrame.frameIndex, sceneTick:run.worstFrame.sceneTick, sha256:sha, byteLength:bytes.byteLength, mimeType:'image/png' };
  screenshots[mode] = { dataUrl, bytes };
  return { run, nextFrame:frameCounter };
}

function renderTimeline(run) {
  const values = run.samples.map(sample => sample.cpuTotalMs), maximum = Math.max(run.stages.cpuTotalMs.p95 * 1.35, ...values, 1), width = timeline.width, height = timeline.height;
  timelineContext.clearRect(0,0,width,height); timelineContext.fillStyle='#091019'; timelineContext.fillRect(0,0,width,height);
  timelineContext.strokeStyle='#26364a';
  for (let index=1; index<4; index+=1) { timelineContext.beginPath(); timelineContext.moveTo(0,height*index/4); timelineContext.lineTo(width,height*index/4); timelineContext.stroke(); }
  timelineContext.strokeStyle='#5de3e2'; timelineContext.lineWidth=2; timelineContext.beginPath();
  values.forEach((value,index)=>{const x=index/(values.length-1)*width,y=height-12-value/maximum*(height-24);if(index)timelineContext.lineTo(x,y);else timelineContext.moveTo(x,y)}); timelineContext.stroke();
  const p95Y=height-12-run.stages.cpuTotalMs.p95/maximum*(height-24); timelineContext.strokeStyle='#ffc36a'; timelineContext.setLineDash([7,5]); timelineContext.beginPath(); timelineContext.moveTo(0,p95Y); timelineContext.lineTo(width,p95Y); timelineContext.stroke(); timelineContext.setLineDash([]);
}
function renderChecks() {
  $('#checks').replaceChildren(...verification.checks.map(item=>{const element=document.createElement('div');element.className=`check ${item.status}`;element.innerHTML=`<i>${item.status==='pass'?'✓':'×'}</i><div><strong>${item.label}</strong><small>${item.evidence}</small></div>`;return element}));
}
function show(mode) {
  const run=suite.runs.find(item=>item.mode===mode);
  [...document.querySelectorAll('#modes button')].forEach(button=>{const active=button.dataset.mode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
  source.hidden=true; postCanvas.hidden=true; $('#worst-shot').hidden=false; $('#worst-shot').src=screenshots[mode].dataUrl;
  $('#stage-title').textContent=`${mode==='native'?'Native':'Post-processed'} frame ${run.worstFrame.frameIndex}`; $('#shot-sha').textContent=run.screenshot.sha256;
  $('#p50').textContent=`${run.stages.cpuTotalMs.p50.toFixed(2)} ms`; $('#p95').textContent=`${run.stages.cpuTotalMs.p95.toFixed(2)} ms`; $('#worst').textContent=`${run.stages.cpuTotalMs.worst.toFixed(2)} ms`; $('#worst-meta').textContent=`frame ${run.worstFrame.frameIndex} · tick ${run.worstFrame.sceneTick}`;
  $('#gpu').textContent=run.gpu.p95===null?'N/A':`${run.gpu.p95.toFixed(2)} ms`; $('#gpu-status').textContent=`${run.gpu.status} · ${run.gpu.samples}/${run.window.measurementFrames} samples`; $('#window').textContent=`${run.window.warmupFrames} WARM-UP → ${run.window.measurementFrames} MEASURED`;
  const labels={updateMs:'Update',renderSubmitMs:'Render submit',postProcessMs:'Post-process',telemetryMs:'Profiler book-keeping'};
  $('#stages').innerHTML=Object.entries(labels).map(([id,label])=>`<article class="stage-card"><span>${label}</span><strong>${run.stages[id].p95.toFixed(3)} ms</strong><small>P95 · worst ${run.stages[id].worst.toFixed(3)}</small></article>`).join('');
  $('#resources-title').textContent=`${Math.round(run.resources.drawCalls.p50)} draws · ${Math.round(run.resources.triangles.p50).toLocaleString('en-US')} tris`;
  $('#resources').innerHTML=[['Texture upload / frame',`${Math.round(run.resources.textureUploadBytesPerFrame.p50).toLocaleString('en-US')} bytes`],['Overdraw pressure',`${run.resources.overdrawProxy.p95.toFixed(2)}× proxy`],['Frame stall P95',`${run.stages.stallMs.p95.toFixed(2)} ms`],['Shader compile',`${run.metadata.shaderCompileMs.native.toFixed(2)} + ${run.metadata.shaderCompileMs.post.toFixed(2)} ms`]].map(([label,value])=>`<div class="resource"><span>${label}</span><strong>${value}</strong></div>`).join('');
  renderTimeline(run); document.body.dataset.mode=mode;
}

async function boot() {
  try {
    progress('Loading exact Forge scene','Digesting asset and texture payloads.',.01);
    const payloads=await inspectPayloads(),compileStart=performance.now(); renderer=new NativeWebGL2Renderer(source); renderer.__compileMs=performance.now()-compileStart;
    if(!renderer.available)throw new Error(renderer.reason); for(const spec of specs)await renderer.loadAsset(spec);
    post=new PostProcessor(postCanvas); nativeTimer=new GpuTimer(renderer.gl); postTimer=new GpuTimer(post.gl);
    const profilerOverheadMicroseconds=calibrateOverhead(),nativeResult=await profileMode('native',0),postResult=await profileMode('post',nativeResult.nextFrame);
    suite=await sealSuite(buildSuite([nativeResult.run,postResult.run],{machine:'current-browser-session',profilerOverheadMicroseconds,capturePolicy:'deterministic-worst-state-replay-outside-window',overdrawMethod:'draw-and-triangle-screen-pressure-proxy',overdrawClaim:'proxy-not-pixel-exact',staticSourceBytes:payloads.sourceBytes,staticTexturePayloadBytes:payloads.textureBytes,shaderCompileMs:{native:renderer.__compileMs,post:post.compileMs}}));
    verification=await verifyProfileSuite(suite,Object.fromEntries(Object.entries(screenshots).map(([mode,value])=>[mode,value.bytes])));
    $('#modes').hidden=false; $('#progress').hidden=true; $('#verify-title').textContent=`${verification.summary.passed}/${verification.summary.checks} profile checks pass`; $('#receipt').textContent=suite.receiptSha256; renderChecks();
    $('#profile-json').textContent=JSON.stringify({suite:{...suite,runs:suite.runs.map(run=>({...run,samples:`${run.samples.length} retained rows`}))},verification},null,2);
    document.body.dataset.profileStatus=verification.status; document.body.dataset.receiptSha256=suite.receiptSha256; show('native');
  } catch(error) { $('#progress-title').textContent='Profiler stopped honestly'; $('#progress-copy').textContent=error.message||String(error); console.error(error); }
}
document.querySelectorAll('#modes button').forEach(button=>button.addEventListener('click',()=>show(button.dataset.mode)));
boot();
