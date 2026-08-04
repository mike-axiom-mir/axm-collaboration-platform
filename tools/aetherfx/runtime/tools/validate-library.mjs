import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { packageDigest } from './canonical.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog/default-catalog.json'),'utf8'));
const errors=[], warnings=[]; const ids=new Map();
const semver=/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/; const idPattern=/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
for(const [i,m] of catalog.modules.entries()){
  if(!idPattern.test(m.id||'')) errors.push(`modules[${i}] invalid id`);
  if(ids.has(m.id)) errors.push(`duplicate module ${m.id}`); else ids.set(m.id,m);
  if(!semver.test(m.version||'')) errors.push(`${m.id} invalid version`);
  if(!['primitive','effect','organ','mold','scene'].includes(m.kind)) errors.push(`${m.id} invalid kind`);
  for(const tier of ['low','medium','high','cinematic']) if(!m.quality?.[tier]) errors.push(`${m.id} missing quality.${tier}`);
  if(!m.accessibility) errors.push(`${m.id} missing accessibility`);
  if(/unset|unknown/i.test(m.provenance?.license||'')) warnings.push(`${m.id} public license unset`);
  const pids=new Set(); for(const p of m.parameters||[]){ if(pids.has(p.id)) errors.push(`${m.id} duplicate parameter ${p.id}`); pids.add(p.id); }
}
for(const m of catalog.modules){
  for(const dep of m.dependencies||[]) if(!ids.has(dep)) errors.push(`${m.id} missing dependency ${dep}`);
  if(m.renderer?.type==='composite') for(const l of m.renderer.layers||[]) if(!ids.has(l.moduleId)) errors.push(`${m.id} missing composite child ${l.moduleId}`);
  if(m.renderer?.type==='derived'&&!ids.has(m.renderer.baseModuleId)) errors.push(`${m.id} missing derived base ${m.renderer.baseModuleId}`);
}
const visiting=new Set(),visited=new Set();
function walk(id,trail=[]){ if(visited.has(id))return; if(visiting.has(id)){errors.push(`cycle ${[...trail,id].join(' -> ')}`);return;} visiting.add(id); const m=ids.get(id); for(const d of m?.dependencies||[])walk(d,[...trail,id]); if(m?.renderer?.type==='composite')for(const l of m.renderer.layers||[])walk(l.moduleId,[...trail,id]); if(m?.renderer?.type==='derived')walk(m.renderer.baseModuleId,[...trail,id]); visiting.delete(id);visited.add(id); }
for(const id of ids.keys())walk(id);
const starterDir=path.join(ROOT,'packages/starter');
for(const file of fs.readdirSync(starterDir).filter(f=>f.endsWith('.json'))){ const p=JSON.parse(fs.readFileSync(path.join(starterDir,file),'utf8')); const local=new Map((p.modules||[]).map(m=>[m.id,m])); if(!local.has(p.entryModuleId)) errors.push(`${file} entry not bundled`); for(const m of p.modules||[]) for(const d of m.dependencies||[]) if(!local.has(d)&&!ids.has(d)) errors.push(`${file} missing dependency ${d}`); if(p.integrity?.value!==packageDigest(p)) errors.push(`${file} integrity mismatch`); }
const report={generated:new Date().toISOString(),catalogModules:catalog.modules.length,starterPackages:fs.readdirSync(starterDir).filter(f=>f.endsWith('.json')).length,errors,warnings};
fs.mkdirSync(path.join(ROOT,'reports'),{recursive:true}); fs.writeFileSync(path.join(ROOT,'reports/VALIDATION.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Catalog: ${report.catalogModules} modules; starter packages: ${report.starterPackages}; errors: ${errors.length}; warnings: ${warnings.length}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);} 
