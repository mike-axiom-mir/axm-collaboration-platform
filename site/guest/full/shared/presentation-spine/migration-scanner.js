#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');

const SKIP_DIRS=new Set(['.git','node_modules','exports','logs','state','cache','backups','assets','game-library','vendor','out','dist']);
const PROFILE_WORDS={
  cockpit:['command','control','runtime','operations','team','bridge','game-hub','launcher'],
  studio:['studio','editor','builder','forge','foundry','design','chroma','skinner','composer','asset'],
  lab:['lab','verifier','research','audit','evidence','test','observatory','readiness','diagnostic'],
  dashboard:['hub','library','gallery','museum','growth','profile','overview']
};

function walkHtml(root,relative=''){
  const absolute=path.join(root,relative);
  if(!fs.existsSync(absolute)) return [];
  const entries=fs.readdirSync(absolute,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name));
  const files=[];
  for(const entry of entries){
    const rel=path.join(relative,entry.name);
    if(entry.isDirectory()){
      if(!SKIP_DIRS.has(entry.name.toLowerCase())) files.push(...walkHtml(root,rel));
    }else if(entry.isFile()&&/\.html?$/i.test(entry.name)) files.push(rel);
  }
  return files;
}

function recommendProfile(relativePath,html=''){
  const haystack=(relativePath+' '+String(html).slice(0,5000)).toLowerCase();
  const score={cockpit:0,studio:0,lab:0,dashboard:0};
  Object.entries(PROFILE_WORDS).forEach(([profile,words])=>words.forEach(word=>{if(haystack.includes(word)) score[profile]+=1;}));
  return Object.entries(score).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];
}

function analyzeHtmlText(relativePath,html){
  const styleBlocks=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match=>match[1]).join('\n');
  const inlineStyles=(html.match(/\sstyle\s*=\s*["'][^"']*["']/gi)||[]).length;
  const hardcodedColors=(styleBlocks.match(/#[0-9a-f]{3,8}\b|rgba?\s*\(/gi)||[]).length;
  const externalRuntimeUrls=(html.match(/(?:src|href)\s*=\s*["']https?:\/\//gi)||[]).length;
  const declared=(html.match(/data-axm-profile\s*=\s*["'](cockpit|studio|dashboard|lab)["']/i)||[])[1]||null;
  const recommendations=[];
  if(!/shared\/visual-kernel\/axm-kernel\.css/i.test(html)) recommendations.push('adopt-visual-kernel');
  if(!/shared\/presentation-spine\/presentation-spine\.css/i.test(html)) recommendations.push('adopt-presentation-spine');
  if(!declared) recommendations.push('declare-profile');
  if(inlineStyles) recommendations.push('extract-inline-styles');
  if(hardcodedColors) recommendations.push('map-local-colors-to-tokens');
  if(externalRuntimeUrls) recommendations.push('review-external-runtime-dependency');
  return {
    path:relativePath.replace(/\\/g,'/'),
    recommendedProfile:declared||recommendProfile(relativePath,html),
    declaredProfile:declared,
    seams:{
      visualKernel:/shared\/visual-kernel\/axm-kernel\.css/i.test(html),
      presentationSpine:/shared\/presentation-spine\/presentation-spine\.css/i.test(html),
      profileDeclared:Boolean(declared)
    },
    observations:{inlineStyles,hardcodedColors,externalRuntimeUrls},
    recommendations
  };
}

function scanRoot(root){
  const absolute=path.resolve(root);
  const roots=['hub','tools','museum'].filter(name=>fs.existsSync(path.join(absolute,name)));
  const surfaces=[];
  roots.forEach(name=>walkHtml(path.join(absolute,name)).forEach(rel=>{
    const full=path.join(absolute,name,rel);
    surfaces.push(analyzeHtmlText(path.join(name,rel),fs.readFileSync(full,'utf8')));
  }));
  surfaces.sort((a,b)=>a.path.localeCompare(b.path));
  const profileTotals={cockpit:0,studio:0,dashboard:0,lab:0};
  surfaces.forEach(item=>{profileTotals[item.recommendedProfile]+=1;});
  return {
    schema:'axm.presentation-spine.migration-report/v1',
    deterministic:true,
    authority:'read-only-advice',
    scope:roots,
    totals:{
      surfaces:surfaces.length,
      onSpine:surfaces.filter(item=>item.seams.presentationSpine&&item.seams.profileDeclared).length,
      missingSpine:surfaces.filter(item=>!item.seams.presentationSpine).length,
      missingVisualKernel:surfaces.filter(item=>!item.seams.visualKernel).length,
      externalRuntimeReferences:surfaces.reduce((sum,item)=>sum+item.observations.externalRuntimeUrls,0),
      profiles:profileTotals
    },
    surfaces
  };
}

function parseArgs(argv){
  const result={root:process.cwd(),out:null};
  for(let i=0;i<argv.length;i+=1){
    if(argv[i]==='--root') result.root=argv[++i];
    else if(argv[i]==='--out') result.out=argv[++i];
  }
  return result;
}

if(require.main===module){
  const options=parseArgs(process.argv.slice(2));
  const report=scanRoot(options.root);
  const json=JSON.stringify(report,null,2)+'\n';
  if(options.out){
    const destination=path.resolve(options.out);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,json);
    console.log(`PASS Presentation Spine scan · ${report.totals.surfaces} surfaces · ${report.totals.onSpine} on spine · report ${destination}`);
  }else process.stdout.write(json);
}

module.exports={analyzeHtmlText,recommendProfile,scanRoot};
