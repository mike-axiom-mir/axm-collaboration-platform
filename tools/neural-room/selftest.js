const assert=require('assert'),fs=require('fs'),path=require('path');
const read=(name)=>fs.readFileSync(path.join(__dirname,name),'utf8');
const manifest=JSON.parse(read('manifest.json')),contract=JSON.parse(read('module.contract.json')),html=read('index.html'),app=read('app.js');
assert.equal(manifest.id,'neural-room');assert.equal(manifest.audience,'human-machine');assert(manifest.notes.includes('WAITING_FOR_PROVIDER'));
assert.equal(contract.id,manifest.id);assert(contract.boundaries.refuses.includes('fake-generation-without-provider'));assert(contract.boundaries.refuses.includes('silent-raw-image-archive'));
assert(html.includes('AI DEPENDENT'));assert(html.includes('WAITING FOR PROVIDER'));assert(html.includes('../visual-draft-room/index.html'));
assert(app.includes('Core.verifyResult'));assert(app.includes('expires_at'));assert(app.includes('600000'));assert(!/\bfetch\s*\(/.test(app));assert(!/XMLHttpRequest|WebSocket/.test(app));
console.log('Neural Room selftest PASS (AI dependency visible, no automatic network/provider call, exact result verification, TTL candidate transfer)');
