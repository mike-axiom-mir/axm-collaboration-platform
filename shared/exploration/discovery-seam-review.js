const assert=require('assert'),fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../..');
const core=fs.readFileSync(path.join(__dirname,'axm-exploration-core.js'),'utf8'),server=fs.readFileSync(path.join(root,'server.js'),'utf8'),html=fs.readFileSync(path.join(root,'tools/ai-team/index.html'),'utf8'),ui=fs.readFileSync(path.join(root,'tools/ai-team/ai-team.js'),'utf8');
const checks=[
  [core.includes('enabled:false')&&core.includes("state:'OPTED_OUT'"),'default opt-out'],
  [core.includes('timeBudgetMin')&&core.includes('boundary')&&core.includes('question'),'bounded sessions'],
  [core.includes("identity already has an active exploration"),'one active exploration per identity'],
  [core.includes("state:'CANDIDATE'")&&core.includes('addWisdom'),'wisdom never auto-promotes'],
  [core.includes('discussion proposal requires at least one evidenced artifact'),'artifact evidence gate'],
  [core.includes('quality claim, AXM fit, risks and next test are required'),'proposal quality gate'],
  [server.includes('/api/exploration/opt-in')&&server.includes('explicit local exploration opt-in'),'explicit server opt-in'],
  [server.includes('EXPLORATION_STATE_FILE')&&server.includes('saveExplorationGarden'),'local durable service state'],
  [server.includes('type:')&&server.includes('proposal')&&server.includes('createCollaborationNotice'),'proposal enters discussion inbox'],
  [html.includes('id="exploreSurface"')&&ui.includes('renderGarden'),'AI Team owns visible workflow'],
  [html.includes('does not install software')&&html.includes('does not enter durable wisdom'),'honest UI boundaries'],
  [ui.includes("receipt||'identity-action'")&&ui.includes("'discussion-comment'"),'attributed machine and discussion routes']
];checks.forEach(([pass,label])=>assert.ok(pass,label));console.log('Exploration Garden seam discovery: PASS ('+checks.length+' seams)');
