const assert=require('assert'),fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../..');
const core=fs.readFileSync(path.join(__dirname,'axm-profile-core.js'),'utf8');
const client=fs.readFileSync(path.join(__dirname,'axm-profile-client.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'hub/index.html'),'utf8');
const profile=fs.readFileSync(path.join(root,'hub/profile.js'),'utf8');
const game=fs.readFileSync(path.join(root,'tools/game-hub/index.html'),'utf8');
const studio=fs.readFileSync(path.join(root,'tools/studio/engine.html'),'utf8');
const project=fs.readFileSync(path.join(root,'tools/project-room/app.js'),'utf8');
const checks=[
  [core.includes('enabled:false'),'default opt-out'],
  [core.includes("state:'RESERVED'"),'future achievements reserved'],
  [core.includes('participants.forEach'),'equal participant contributions'],
  [core.includes('dedupeKey'),'deduplicated receipts'],
  [core.includes('code character receipt requires evidence'),'code evidence gate'],
  [server.includes("state', 'shared-profile"),'local persistence'],
  [server.includes("'/api/profile/opt-in'"),'explicit opt-in API'],
  [server.includes("'delete-local-profile'"),'explicit delete API'],
  [client.includes("'/api/profile/event'"),'shared browser activity adapter'],
  [hub.includes('Human + machine · one playful record'),'plain-language Hub screen'],
  [profile.includes('AXMAIPresence.members'),'live collaborator sync'],
  [game.includes("type:'game-played'"),'successful game launch receipt'],
  [studio.includes("type:'picture-made'"),'produced picture receipt'],
  [project.includes("type: 'project-completed'"),'completed project receipt']
];
checks.forEach(([pass,label])=>assert.ok(pass,label));
console.log('shared profile seam discovery: PASS ('+checks.length+' seams)');
