'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function now(){ return new Date().toISOString(); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function stableStringify(value){
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stableStringify(value[k])).join(',') + '}';
}
function sha256(value){
  const body = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value));
  return crypto.createHash('sha256').update(body).digest('hex');
}
function atomicWriteJson(file,value){
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(value,null,2) + '\n', 'utf8');
  fs.renameSync(tmp,file);
}
function readJson(file,fallback){
  try { return JSON.parse(fs.readFileSync(file,'utf8')); }
  catch (e) { return clone(fallback); }
}
function text(value,max=10000){
  const s = String(value == null ? '' : value).replace(/\u0000/g,'').trim();
  return s.slice(0,max);
}
function safeId(prefix,input){
  const base = text(input || '',120).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');
  if (base) return prefix + ':' + base;
  return prefix + ':' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
}
function listFiles(root){
  const out=[];
  function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(['node_modules','.git','storage/runtime'].includes(entry.name)) continue;
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()) walk(full); else out.push(full);
    }
  }
  walk(root); return out.sort();
}
module.exports={now,clone,ensureDir,stableStringify,sha256,atomicWriteJson,readJson,text,safeId,listFiles};
