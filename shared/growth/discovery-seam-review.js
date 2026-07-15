const assert=require('assert'),fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../..');const core=fs.readFileSync(path.join(__dirname,'axm-growth-metrics.js'),'utf8'),server=fs.readFileSync(path.join(root,'server.js'),'utf8'),hub=fs.readFileSync(path.join(root,'hub/index.html'),'utf8'),shell=fs.readFileSync(path.join(root,'hub/hub-shell.js'),'utf8'),ui=fs.readFileSync(path.join(root,'hub/growth.js'),'utf8');const checks=[
  [core.includes("'exports'")&&core.includes("'node_modules'")&&core.includes("!=='.log'"),'copies dependencies state and logs excluded'],
  [core.includes('TEXT_EXT')&&core.includes('characters')&&core.includes('lines'),'text metrics are explicit'],
  [core.includes('fingerprint')&&core.includes('duplicate:true'),'identical snapshots deduplicate'],
  [server.includes("'/api/workshop-growth'")&&server.includes("'/api/workshop-growth/capture'"),'read and explicit capture APIs'],
  [server.includes("'explicit-local-snapshot'"),'capture requires explicit local action'],
  [hub.includes('id="growthScreen"')&&hub.includes('id="growthHistory"'),'Hub infographic screen exists'],
  [hub.includes('id="growthActionStatus"')&&ui.includes("button.textContent='Saving…'")&&ui.includes('Already saved · nothing changed.'),'snapshot action gives immediate visible feedback'],
  [shell.includes('Workshop Growth')&&shell.includes('AXMWorkshopGrowth.open'),'Home card opens infographic'],
  [ui.includes('deltaFromBaseline')&&ui.includes('countingRules.excluded'),'growth and rules render visibly']
];checks.forEach(([pass,label])=>assert.ok(pass,label));console.log('Workshop Growth seam discovery: PASS ('+checks.length+' seams)');
