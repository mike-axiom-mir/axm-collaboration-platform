import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const excluded=new Set(['node_modules','.git']);
const generatedReports=new Set(['reports/INVENTORY.json','reports/INVENTORY.md','reports/SHA256SUMS.txt','reports/BUILD_SUMMARY.json']);
const relativePath=file=>path.relative(ROOT,file).replaceAll('\\','/');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>excluded.has(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk(ROOT).filter(file=>!generatedReports.has(relativePath(file))&&!relativePath(file).toLowerCase().endsWith('.log'));
const rows=files.map(f=>{const b=fs.readFileSync(f);return{path:relativePath(f),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}}).sort((a,b)=>a.path.localeCompare(b.path));
const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog/default-catalog.json'),'utf8')); const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')); const byKind=Object.fromEntries([...new Set(catalog.modules.map(m=>m.kind))].sort().map(k=>[k,catalog.modules.filter(m=>m.kind===k).length]));
const inventory={schema:'axm.artifact-inventory/1',generated:new Date().toISOString(),version:pkg.version,fileCount:rows.length,totalBytes:rows.reduce((s,r)=>s+r.bytes,0),catalog:{modules:catalog.modules.length,moods:catalog.moods.length,byKind},files:rows};
fs.mkdirSync(path.join(ROOT,'reports'),{recursive:true}); fs.writeFileSync(path.join(ROOT,'reports/INVENTORY.json'),JSON.stringify(inventory,null,2)+'\n');
const md=['# Inventory','',`Generated: ${inventory.generated}`,`Files: ${inventory.fileCount}`,`Bytes: ${inventory.totalBytes}`,`Catalog modules: ${catalog.modules.length}`,`Kinds: ${Object.entries(byKind).map(([k,v])=>`${k} ${v}`).join(', ')}`,'','## Files','',...rows.map(r=>`- \`${r.path}\` — ${r.bytes} bytes — \`${r.sha256}\``),'']; fs.writeFileSync(path.join(ROOT,'reports/INVENTORY.md'),md.join('\n'));
fs.writeFileSync(path.join(ROOT,'reports/SHA256SUMS.txt'),rows.map(r=>`${r.sha256}  ${r.path}`).join('\n')+'\n'); console.log(`Inventory: ${rows.length} files, ${inventory.totalBytes} bytes.`);
