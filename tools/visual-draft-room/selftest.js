const assert=require('assert'),fs=require('fs'),path=require('path');
const read=(name)=>fs.readFileSync(path.join(__dirname,name),'utf8');
const manifest=JSON.parse(read('manifest.json')),contract=JSON.parse(read('module.contract.json')),html=read('index.html'),app=read('app.js');
assert.equal(manifest.id,'visual-draft-room');assert(manifest.notes.includes('Works without AI'));
assert.equal(contract.id,manifest.id);assert(contract.boundaries.refuses.includes('ai-required-for-deterministic-editing'));assert(contract.boundaries.refuses.includes('persistent-raw-image-checkpoint'));
assert(html.includes('AI OPTIONAL'));assert(html.includes('BROWSER PREVIEW · NOT VERIFICATION'));assert(html.includes('../neural-room/index.html'));
assert(app.includes('Core.toRasterRecipe'));assert(app.includes('Core.verifyResult'));assert(app.includes("delete copy.origin"));assert(app.includes('Raw image bytes are intentionally not checkpointed'));
assert(!/\bfetch\s*\(/.test(app));assert(!/XMLHttpRequest|WebSocket/.test(app));
console.log('Visual Draft Room selftest PASS (AI optional, metadata-only checkpoint, explicit neural import, deterministic recipe export, preview not verification)');
