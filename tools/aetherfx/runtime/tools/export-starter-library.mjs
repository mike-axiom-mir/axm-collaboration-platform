import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const out=path.join(ROOT,'library'); const pkgOut=path.join(out,'packages'); fs.mkdirSync(pkgOut,{recursive:true});
fs.copyFileSync(path.join(ROOT,'catalog/default-catalog.json'),path.join(out,'default-catalog.json'));
const entries=[]; for(const file of fs.readdirSync(path.join(ROOT,'packages/starter')).filter(f=>f.endsWith('.json')).sort()){ const src=path.join(ROOT,'packages/starter',file),dst=path.join(pkgOut,file); fs.copyFileSync(src,dst); const p=JSON.parse(fs.readFileSync(src,'utf8')); entries.push({file:`packages/${file}`,packageId:p.packageId,name:p.name,version:p.version,entryModuleId:p.entryModuleId,modules:p.modules.length,integrity:p.integrity}); }
fs.writeFileSync(path.join(out,'index.json'),JSON.stringify({schema:'axm.visual-library-index/1',name:'AXM AetherFX Visual Effect Fabric Starter Library',version:'1.3.0',generated:new Date().toISOString(),entries},null,2)+'\n');
fs.writeFileSync(path.join(out,'README.md'),'# Intake Library\n\n`default-catalog.json` is the full built-in catalog. `packages/` contains individually importable starter packages. `index.json` records entries and integrity values.\n');
console.log(`Exported ${entries.length} starter packages to library/.`);
