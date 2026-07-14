const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const core=require('./axm-foundation-services');
const html=read('hub/index.html'),ui=read('hub/foundation-services.js'),css=read('hub/foundation-services.css');
const checks=[
  ['Nine services exist once',()=>core.definitions.length===9&&new Set(core.definitions.map(x=>x.id)).size===9],
  ['Service contract matches implementation',()=>json('shared/services/service-contract.json').services.join('|')===core.definitions.map(x=>x.id).join('|')],
  ['Permanent panel exists in Hub',()=>/foundationToggle/.test(html)&&/foundationScreen/.test(html)],
  ['Compact health remains in outer top bar',()=>/foundation-summary/.test(css)&&/Foundation services/.test(html)],
  ['Offline rows are rendered instead of filtered',()=>/definitions\.forEach/.test(ui)&&!/filter\([^\n]+OFFLINE/.test(ui)],
  ['Dashboard visibility is explicitly independent',()=>/DASHBOARD_VISIBILITY/.test(read('shared/services/axm-foundation-services.js'))&&/never a lifecycle switch/.test(read('shared/services/axm-foundation-services.js'))],
  ['Live runtime endpoint is probed',()=>/\/api\/health/.test(ui)],
  ['Live Guardian endpoint is probed',()=>/\/api\/shell-guardian\/status/.test(ui)],
  ['Guardian reset retains explicit human header',()=>/x-axm-guardian[^\n]+human-reset/.test(ui)],
  ['Live connector presence is probed',()=>/\/api\/presence/.test(ui)],
  ['Live plugin registry is probed',()=>/\/api\/tools/.test(ui)],
  ['Live backup engine is probed',()=>/\/api\/workshop-packages/.test(ui)],
  ['Foundation bundle installation is checked',()=>/\/launcher\/axm-foundation\.js/.test(ui)],
  ['No retire or uninstall action exists',()=>!/data-action=["'](?:retire|uninstall)/.test(html+ui)]
];
checks.forEach(([name,fn])=>assert.ok(fn(),name));
console.log('foundation services discovery seam: PASS ('+checks.length+'/'+checks.length+')');
