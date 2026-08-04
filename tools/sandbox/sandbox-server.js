#!/usr/bin/env node
'use strict';
/*
 * AXM SANDBOX HOST — Session 1 (project skeleton only)
 * Pattern: reused from tools/game-hub/game-hub-server.js (nested-module host).
 * Port 8815. Ports 8792-8800 are already allocated to game runtimes.
 * Discovers projects/<folder>/ like Game Hub discovers game-library/<game>/.
 * Session 1 scope: list, validate, create, inspect projects. No engine yet.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const C = require('./project-contract');

const ROOT = __dirname;
// Local-only is the packaged default. A platform preview must use the
// Workshop's explicit private-preview adapter instead of widening this host.
const HOST = '127.0.0.1';
const PORT = Number(process.env.AXM_SANDBOX_PORT || 8815);
const WORKSHOP_PORT = Number(process.env.AXM_WORKSHOP_PORT || 8788);
const PROJECTS_DIR = path.join(ROOT, 'projects');
const CREATE_ACTION_HEADER = 'x-axm-sandbox-action';
const CREATE_ACTION_VALUE = 'create-project';
const MAX_CREATE_BODY_BYTES = 16 * 1024;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};

function loopbackOrigin(raw){
  if(!raw) return null;
  try{
    const value=new URL(String(raw));
    const loopback=value.hostname==='127.0.0.1'||value.hostname==='localhost'||value.hostname==='::1';
    const declaredPort=value.port===String(PORT)||value.port===String(WORKSHOP_PORT);
    return value.protocol==='http:'&&loopback&&declaredPort?value.origin:null;
  }catch(e){return null;}
}
function headers(req,type){
  const out={'content-type':type||'application/json; charset=utf-8','cache-control':'no-store','vary':'Origin'};
  const origin=loopbackOrigin(req&&req.headers&&req.headers.origin);
  if(origin){
    out['access-control-allow-origin']=origin;
    out['access-control-allow-methods']='GET,POST,OPTIONS';
    out['access-control-allow-headers']='content-type,'+CREATE_ACTION_HEADER;
  }
  return out;
}
function send(req,res,code,obj){res.writeHead(code,headers(req));res.end(JSON.stringify(obj,null,2));}
function sendFile(req,res,file){fs.readFile(file,(err,data)=>{if(err)return send(req,res,404,{ok:false,error:'file not found'});res.writeHead(200,headers(req,MIME[path.extname(file).toLowerCase()]||'application/octet-stream'));res.end(data);});}
function safeName(s){return String(s||'').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,48);}

function isWithin(parent,candidate){
  const relative=path.relative(parent,candidate);
  return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);
}
function ensureProjectRoot(){
  if(!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR,{recursive:true});
  const stat=fs.lstatSync(PROJECTS_DIR);
  if(!stat.isDirectory()||stat.isSymbolicLink()) throw new Error('projects root must be a physical directory');
}
function resolveProjectFile(urlPath){
  let decoded;
  try{decoded=decodeURIComponent(String(urlPath||''));}catch(e){return null;}
  const logical=path.resolve(ROOT,decoded.replace(/^[/\\]+/,''));
  if(!isWithin(PROJECTS_DIR,logical)) return null;
  if(!fs.existsSync(logical)) return logical;
  try{
    const realRoot=fs.realpathSync(PROJECTS_DIR);
    const realFile=fs.realpathSync(logical);
    return isWithin(realRoot,realFile)?realFile:null;
  }catch(e){return null;}
}
function authorizeCreateRequest(req){
  const origin=loopbackOrigin(req.headers.origin);
  if(!origin) return {ok:false,status:403,error:'declared loopback origin required'};
  if(req.headers[CREATE_ACTION_HEADER]!==CREATE_ACTION_VALUE) return {ok:false,status:403,error:'explicit create-project action required'};
  if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type']||''))) return {ok:false,status:415,error:'application/json required'};
  return {ok:true,origin};
}
function bodyError(status,message){const error=new Error(message);error.status=status;return error;}
function readJsonBody(req,limit){
  return new Promise((resolve,reject)=>{
    const chunks=[];let bytes=0,settled=false;
    req.on('data',chunk=>{
      if(settled) return;
      bytes+=chunk.length;
      if(bytes>limit){settled=true;reject(bodyError(413,'create request body exceeds 16 KiB'));return;}
      chunks.push(chunk);
    });
    req.on('end',()=>{
      if(settled) return;
      try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'));}
      catch(e){reject(bodyError(400,'invalid JSON body'));}
    });
    req.on('error',error=>{if(!settled){settled=true;reject(error);}});
  });
}

function listProjects(){
  if(!fs.existsSync(PROJECTS_DIR)) return [];
  ensureProjectRoot();
  return fs.readdirSync(PROJECTS_DIR,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>{
    const dir = path.join(PROJECTS_DIR,d.name);
    const files = fs.readdirSync(dir);
    const dirCheck = C.validateProjectDir(files);
    let manifest=null, manifestCheck={ok:false,errors:['manifest unreadable'],warnings:[]};
    if(files.includes('project.manifest.json')){
      try{ manifest=JSON.parse(fs.readFileSync(path.join(dir,'project.manifest.json'),'utf8')); manifestCheck=C.validateManifest(manifest);}catch(e){manifestCheck={ok:false,errors:['manifest JSON parse: '+e.message],warnings:[]};}
    }
    return { folder:d.name, id:manifest&&manifest.id||null, name:manifest&&manifest.name||d.name,
      kind:manifest&&manifest.kind||null, bodies:manifest&&manifest.bodies||null,
      valid: dirCheck.ok && manifestCheck.ok,
      errors:[...dirCheck.errors,...manifestCheck.errors], warnings:manifestCheck.warnings };
  });
}

function createProject(name){
  ensureProjectRoot();
  const clean = safeName(name);
  if(!clean) return {ok:false,error:'empty name'};
  const folder = clean.toLowerCase().replace(/\s+/g,'-');
  const dir = path.join(PROJECTS_DIR,folder);
  if(fs.existsSync(dir)) return {ok:false,error:'folder already exists: '+folder};
  const manifest = C.newManifest(clean);
  fs.mkdirSync(path.join(dir,'world'),{recursive:true});
  fs.mkdirSync(path.join(dir,'saves'),{recursive:true});
  fs.writeFileSync(path.join(dir,'project.manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(dir,'world','scene.json'),JSON.stringify({schema_version:1,scene:'main',entities:[],note:'Session 2 gives this file meaning (entity core). Empty is honest.'},null,2));
  return {ok:true,folder,manifest};
}

async function handleRequest(req,res){
  if(req.method==='OPTIONS'){
    if(!loopbackOrigin(req.headers.origin)) return send(req,res,403,{ok:false,error:'declared loopback origin required'});
    res.writeHead(204,headers(req));return res.end();
  }
  let u;
  try{u=new URL(req.url,'http://x');}catch(e){return send(req,res,400,{ok:false,error:'malformed URL'});}
  if(u.pathname==='/'||u.pathname==='/index.html') return sendFile(req,res,path.join(ROOT,'index.html'));
  if(u.pathname==='/api/health'){
    const address=server.address();
    return send(req,res,200,{ok:true,module:'sandbox',session:1,contract:C.CONTRACT_VERSION,port:address&&address.port||PORT});
  }
  if(u.pathname==='/api/projects'&&req.method==='GET') return send(req,res,200,{ok:true,projects:listProjects(),directory_contract:C.DIRECTORY_CONTRACT});
  if(u.pathname==='/api/projects/create'&&req.method==='POST'){
    const authorization=authorizeCreateRequest(req);
    if(!authorization.ok) return send(req,res,authorization.status,{ok:false,error:authorization.error});
    try{
      const parsed=await readJsonBody(req,MAX_CREATE_BODY_BYTES);
      const result=createProject(parsed.name);
      return send(req,res,result.ok?200:400,result);
    }catch(error){
      return send(req,res,error.status||409,{ok:false,error:String(error.message||error)});
    }
  }
  // Serve files inside a project folder for inspection (read-only and realpath-contained).
  if(u.pathname.startsWith('/projects/')){
    const file=resolveProjectFile(u.pathname);
    if(!file) return send(req,res,403,{ok:false,error:'outside physical projects boundary'});
    return sendFile(req,res,file);
  }
  return send(req,res,404,{ok:false,error:'unknown route'});
}

const server=http.createServer((req,res)=>{
  Promise.resolve(handleRequest(req,res)).catch(error=>{
    if(!res.headersSent) send(req,res,500,{ok:false,error:String(error.message||error)});
    else res.end();
  });
});
server.listen(PORT,HOST,()=>{
  const address=server.address();
  console.log(`[sandbox] Session-1 host on http://${HOST}:${address&&address.port||PORT} (projects: ${PROJECTS_DIR})`);
});
module.exports={listProjects,createProject,server,loopbackOrigin,authorizeCreateRequest,resolveProjectFile};
