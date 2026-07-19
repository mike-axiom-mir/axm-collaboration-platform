'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {URL}=require('url');
const {MirrorLearningForge}=require('../core/forge');
const {LearningMetabolism}=require('../core/learning-metabolism');
const {text}=require('../core/utils');
const BodyPulseObserver=require('./body-pulse-observer');

const ROOT=path.resolve(__dirname,'..');
const UI=path.join(ROOT,'ui');
const HOST=process.env.AXM_MIRROR_FORGE_HOST||'127.0.0.1';
const PORT=Number(process.env.AXM_MIRROR_FORGE_PORT||8801);
const TOKEN_FILE=path.join(ROOT,'storage','runtime','forge-token.txt');
const forge=new MirrorLearningForge({root:ROOT});
const METABOLISM_POLICY_FILE=path.join(ROOT,'LEARNING_METABOLISM_POLICY.json');
const metabolism=new LearningMetabolism({policy:JSON.parse(fs.readFileSync(METABOLISM_POLICY_FILE,'utf8'))});
const UNMETERED_POST_ROUTES=new Set([
  '/api/opt-in','/api/opt-out',
  '/api/tracks/studio/sample','/api/tracks/roots/sample','/api/tracks/reasoning/sample','/api/tracks/reasoning/profile',
  '/api/tracks/adaptivity/sample','/api/tracks/adaptivity/profile','/api/growth/forecast','/api/infer'
]);

function ensureToken(){
  try{
    const existing=fs.readFileSync(TOKEN_FILE,'utf8').trim();
    if(existing.length>=32)return existing;
  }catch(_error){}
  fs.mkdirSync(path.dirname(TOKEN_FILE),{recursive:true});
  const token=crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(TOKEN_FILE,token+'\n',{encoding:'utf8',mode:0o600});
  return token;
}
const API_TOKEN=ensureToken();
function safeEqual(left,right){
  const a=Buffer.from(String(left));
  const b=Buffer.from(String(right));
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function authorized(req){
  const header=String(req.headers.authorization||'');
  return header.startsWith('Bearer ')&&safeEqual(header.slice(7),API_TOKEN);
}

function send(res,status,payload,headers={}){
  const body=Buffer.from(typeof payload==='string'?payload:JSON.stringify(payload,null,2));
  res.writeHead(status,{'content-type':typeof payload==='string'?'text/plain; charset=utf-8':'application/json; charset=utf-8','content-length':body.length,'cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(body);
}
function readBody(req){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>1024*1024){reject(new Error('request body too large'));req.destroy();return;}chunks.push(c);});req.on('end',()=>{try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{});}catch(e){reject(new Error('invalid JSON body'));}});req.on('error',reject);});}
function contentType(file){return file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'application/octet-stream';}
function serveStatic(urlPath,res){
  const rel=urlPath==='/'?'index.html':urlPath.replace(/^\/+/, '');
  const file=path.resolve(UI,rel);
  if(!file.startsWith(UI+path.sep) && file!==path.join(UI,'index.html')) return send(res,403,{ok:false,error:'path blocked'});
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()) return send(res,404,{ok:false,error:'not found'});
  let body=fs.readFileSync(file);
  if(file===path.join(UI,'index.html')){
    body=Buffer.from(body.toString('utf8').replace('</head>','<meta name="axm-forge-session" content="'+API_TOKEN+'">\n</head>'));
  }
  res.writeHead(200,{'content-type':contentType(file),'content-length':body.length,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'"});res.end(body);
}
async function api(req,res,url){
  try{
    if(req.method==='GET'&&url.pathname==='/api/health') return send(res,200,{ok:true,service:'mirror-learning-forge',version:'0.7.1',host:HOST,port:PORT,status:forge.status()});
    if(!authorized(req)) return send(res,401,{ok:false,error:'local forge bearer token required'});
    if(req.method==='GET'&&url.pathname==='/api/status') return send(res,200,{ok:true,status:forge.status()});
    if(req.method==='GET'&&url.pathname==='/api/metabolism') return send(res,200,{ok:true,status:metabolism.status(await BodyPulseObserver.observe())});
    if(req.method==='GET'&&url.pathname==='/api/state') return send(res,200,{ok:true,state:forge.store.read()});
    if(req.method==='GET'&&url.pathname==='/api/tracks') return send(res,200,{ok:true,result:forge.trainingTracks()});
    if(req.method==='GET'&&url.pathname==='/api/journal') return send(res,200,{ok:true,events:forge.store.events(),verification:forge.store.verifyJournal()});
    if(req.method==='POST'){
      const body=await readBody(req);let result,metabolismSession=null,operationOutcome='FAILED',operationDetail='request did not complete';
      if(!UNMETERED_POST_ROUTES.has(url.pathname)){
        const mode=String(req.headers['x-axm-learning-mode']||'manual').toLowerCase()==='automatic'?'automatic':'manual';
        const leaseId=text(req.headers['x-axm-body-pulse-lease']||'',160)||null;
        const pulseStatus=await BodyPulseObserver.observe({maxAgeMs:mode==='automatic'?0:5000});
        const admission=metabolism.begin(url.pathname,{bodyPulseStatus:pulseStatus,mode,leaseId});
        if(!admission.granted)return send(res,429,{ok:false,error:'learning held: '+admission.reasons.join(', '),hold:{reasons:admission.reasons,body:admission.body,bodyPulse:admission.bodyPulse}});
        metabolismSession=admission.session;
      }
      try{
        switch(url.pathname){
        case '/api/opt-in': result=forge.optIn(body);break;
        case '/api/opt-out': result=forge.optOut(body);break;
        case '/api/sessions': result=forge.captureSession(body);break;
        case '/api/sessions/review': result=forge.reviewSession(body);break;
        case '/api/candidates': result=forge.createCandidate(body);break;
        case '/api/candidates/review': result=forge.reviewCandidate(body);break;
        case '/api/episodes': result=forge.createEpisode(body);break;
        case '/api/episodes/structured': result=forge.createStructuredEpisode(body);break;
        case '/api/episodes/coding': result=forge.createCodingEpisode(body);break;
        case '/api/episodes/studio': result=forge.createStudioEpisode(body);break;
        case '/api/episodes/rooted': result=forge.createRootedEpisode(body);break;
        case '/api/episodes/reasoning': result=forge.createReasoningEpisode(body);break;
        case '/api/episodes/adaptive': result=forge.createAdaptiveEpisode(body);break;
        case '/api/tracks/tasks': result=forge.createTrackTask(body);break;
        case '/api/tracks/tasks/review': result=forge.reviewTrackTask(body);break;
        case '/api/tracks/structured/grade': result=forge.gradeStructured(body);break;
        case '/api/tracks/coding/grade': result=forge.gradeCode(body);break;
        case '/api/tracks/studio/choose': result=forge.chooseStudioClass(body);break;
        case '/api/tracks/studio/grade': result=forge.gradeStudio(body);break;
        case '/api/tracks/studio/sample': result=forge.studioSample(body);break;
        case '/api/tracks/roots/choose': result=forge.chooseRootClass(body);break;
        case '/api/tracks/roots/grade': result=forge.gradeRooted(body);break;
        case '/api/tracks/roots/sample': result=forge.rootedSample(body);break;
        case '/api/tracks/roots/dissent': result=forge.fileRootDissent(body);break;
        case '/api/tracks/roots/dissent/review': result=forge.reviewRootDissent(body);break;
        case '/api/tracks/reasoning/choose': result=forge.chooseReasoningClass(body);break;
        case '/api/tracks/reasoning/grade': result=forge.gradeReasoning(body);break;
        case '/api/tracks/reasoning/sample': result=forge.reasoningSample(body);break;
        case '/api/tracks/reasoning/profile': result=forge.reasoningProfile();break;
        case '/api/tracks/adaptivity/choose': result=forge.chooseAdaptivityClass(body);break;
        case '/api/tracks/adaptivity/grade': result=forge.gradeAdaptivity(body);break;
        case '/api/tracks/adaptivity/sample': result=forge.adaptivitySample(body);break;
        case '/api/tracks/adaptivity/profile': result=forge.adaptivityProfile();break;
        case '/api/tracks/curriculum': result=forge.buildTrackCurriculum(body);break;
        case '/api/models/baseline': result=forge.createBaseline(body);break;
        case '/api/models/import': result=forge.importModel(body);break;
        case '/api/challengers/train': result=forge.trainChallenger(body);break;
        case '/api/challengers/evaluate': result=forge.evaluateChallenger(body);break;
        case '/api/growth/forecast': result=forge.growthForecast(body);break;
        case '/api/promotions/review': result=forge.reviewPromotion(body);break;
        case '/api/promotions/apply': result=forge.applyPromotion(body);break;
        case '/api/promotions/rollback': result=forge.rollback(body);break;
        case '/api/infer': result=forge.infer(body);break;
        case '/api/mirror-core/export': result=forge.exportMirrorCorePacket(body);break;
        default:{const error=new Error('api route not found');error.statusCode=404;throw error;}
        }
        operationOutcome='COMPLETED';operationDetail='bounded Forge operation completed';
        return send(res,200,{ok:true,result});
      }catch(operationError){operationDetail=text(operationError.message||operationError,500);throw operationError;}
      finally{
        if(metabolismSession)metabolism.finish(metabolismSession.sessionId,operationOutcome,operationDetail);
      }
    }
    return send(res,405,{ok:false,error:'method not allowed'});
  }catch(e){return send(res,Number(e.statusCode)||400,{ok:false,error:text(e.message||e,2000)});}
}
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://'+HOST+':'+PORT);if(url.pathname.startsWith('/api/'))return api(req,res,url);return serveStatic(url.pathname,res);});
server.headersTimeout=10000;
server.requestTimeout=35000;
server.keepAliveTimeout=5000;
server.maxRequestsPerSocket=100;
if(require.main===module)server.listen(PORT,HOST,()=>{console.log('AXM Mirror Learning Forge v0.7.1');console.log('Local only: http://'+HOST+':'+PORT);console.log('Learning metabolism: one session at a time; memory reserve and body pressure can hold; automatic work requires a Body Pulse lease.');console.log('Explicit start. No telemetry. No external network. No automatic promotion. Coding is static-first; Studio, Rooted Intelligence, Reasoning School, and Adaptive Communication School classes are proposal-first; reasoning uses inspectable checkpoints rather than a hidden-chain requirement or IQ benchmark; adaptation preserves semantic invariants and treats agreement as separate from success; execution, Studio access, canon-edit authority, and authority-from-grade are off.');});
module.exports={server,forge,metabolism,HOST,PORT,TOKEN_FILE};
