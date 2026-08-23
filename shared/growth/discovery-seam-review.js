const assert=require('assert'),fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../..');const core=fs.readFileSync(path.join(__dirname,'axm-growth-metrics.js'),'utf8'),server=fs.readFileSync(path.join(root,'server.js'),'utf8'),hub=fs.readFileSync(path.join(root,'hub/index.html'),'utf8'),shell=fs.readFileSync(path.join(root,'hub/hub-shell.js'),'utf8'),ui=fs.readFileSync(path.join(root,'hub/growth.js'),'utf8');const checks=[
  [core.includes("'exports'")&&core.includes("'node_modules'")&&core.includes("'local-data'")&&/path\.extname\(entry\.name\)\.toLowerCase\(\)\s*!==\s*'\.log'/.test(core),'copies dependencies runtime state and logs excluded'],
  [core.includes('TEXT_EXT')&&core.includes('characters')&&core.includes('lines'),'text metrics are explicit'],
  [core.includes('fingerprint')&&/duplicate\s*:\s*true/.test(core),'identical snapshots deduplicate'],
  [server.includes('/api/workshop-growth')&&server.includes('/api/workshop-growth/capture'),'read and explicit capture APIs'],
  [server.includes('explicit-local-snapshot'),'capture requires explicit local action'],
  [hub.includes('id="growthScreen"')&&hub.includes('id="growthHistory"'),'Hub infographic screen exists'],
  [hub.includes('id="growthYear"')&&hub.includes('id="growthMonth"')&&core.includes("SNAPSHOT_RETENTION = 'all-compact-history'")&&!core.includes('snapshots.slice(-365)'),'year/month journey keeps all compact snapshots'],
  [hub.includes('id="growthActionStatus"')&&/button\.textContent\s*=\s*'Saving…'/.test(ui)&&ui.includes('Already saved · nothing changed.'),'snapshot action gives immediate visible feedback'],
  [shell.includes('Workshop Observatory')&&shell.includes('AXMWorkshopGrowth.open')&&shell.includes("$('growthNavBtn').onclick"),'Home card and sidebar open the Observatory'],
  [ui.includes('deltaFromPrevious')&&ui.includes('countingRules.excluded'),'growth and rules render visibly'],
  [core.includes('worldFingerprints')&&core.includes('worldChanges')&&server.includes('worldChangeSignal')&&server.includes('worldDeltaReady')&&ui.includes('Existing worlds updated')&&ui.includes('old and new modules and worlds all count'),'living-world characters stay in totals while deep world upgrades remain explicit'],
  [core.includes('scanMirror')&&core.includes('mirrorSpecializations')&&server.includes('scanGrowthBodies'),'Mirror family measurement reaches the API'],
  [hub.includes('id="growthMirrorParent"')&&hub.includes('id="growthMirrorSpecializations"')&&ui.includes('Original Mirror'),'Original Mirror renders first with separate declared specialists'],
  [ui.includes('sharedParentCode')&&ui.includes('Owned body / source')&&ui.includes('Installed substrates'),'Mirror parent code and installed runtimes stay visibly distinct'],
  [hub.includes('no private contents read')&&ui.includes('Inventory only')&&ui.includes('organ source files')&&server.includes('lineage-declared, not live-measured'),'Mirror metadata boundary and structural inventory remain explicit']
];checks.forEach(([pass,label])=>assert.ok(pass,label));console.log('Workshop Growth seam discovery: PASS ('+checks.length+' seams)');
