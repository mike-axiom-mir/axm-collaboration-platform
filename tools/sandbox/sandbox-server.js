#!/usr/bin/env node
'use strict';
/*
 * AXM SANDBOX HOST — Session 1 (project skeleton only)
 * Pattern: reused from tools/game-hub/game-hub-server.js (nested-module host).
 * Port 8795. 8787=Bridge, 8788=Workshop, 8794=Game Hub — no collisions.
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
const PORT = Number(process.env.AXM_SANDBOX_PORT || 8795);
const PROJECTS_DIR = path.join(ROOT, 'projects');
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};

function headers(type){return{'content-type':type||'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','cache-control':'no-store'};}
function send(res,code,obj){res.writeHead(code,headers());res.end(JSON.stringify(obj,null,2));}
function sendFile(res,file){fs.readFile(file,(err,data)=>{if(err)return send(res,404,{ok:false,error:'file not found'});res.writeHead(200,headers(MIME[path.extname(file).toLowerCase()]||'application/octet-stream'));res.end(data);});}
function safeName(s){return String(s||'').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,48);}

function listProjects(){
  if(!fs.existsSync(PROJECTS_DIR)) return [];
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

const server = http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,headers());return res.end();}
  const u = new URL(req.url,'http://x');
  if(u.pathname==='/'||u.pathname==='/index.html') return sendFile(res,path.join(ROOT,'index.html'));
  if(u.pathname==='/api/health') return send(res,200,{ok:true,module:'sandbox',session:1,contract:C.CONTRACT_VERSION,port:PORT});
  if(u.pathname==='/api/projects'&&req.method==='GET') return send(res,200,{ok:true,projects:listProjects(),directory_contract:C.DIRECTORY_CONTRACT});
  if(u.pathname==='/api/projects/create'&&req.method==='POST'){
    let body='';req.on('data',c=>body+=c);req.on('end',()=>{
      try{const {name}=JSON.parse(body||'{}');const r=createProject(name);send(res,r.ok?200:400,r);}catch(e){send(res,400,{ok:false,error:e.message});}
    });return;
  }
  // serve files inside a project folder for inspection (read-only, path-guarded)
  if(u.pathname.startsWith('/projects/')){
    const rel = path.normalize(u.pathname.replace(/^\/+/,'')).replace(/^(\.\.[\/\\])+/,'');
    const file = path.join(ROOT,rel);
    if(!file.startsWith(PROJECTS_DIR)) return send(res,403,{ok:false,error:'outside projects dir'});
    return sendFile(res,file);
  }
  send(res,404,{ok:false,error:'unknown route'});
});
server.listen(PORT,HOST,()=>console.log(`[sandbox] Session-1 host on http://${HOST}:${PORT} (projects: ${PROJECTS_DIR})`));
module.exports = { listProjects, createProject };
