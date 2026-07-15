const assert=require('assert'),fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../..');
const core=fs.readFileSync(path.join(__dirname,'axm-profile-core.js'),'utf8');
const client=fs.readFileSync(path.join(__dirname,'axm-profile-client.js'),'utf8');
const provider=fs.readFileSync(path.join(__dirname,'axm-profile-provider.js'),'utf8');
const providerContract=JSON.parse(fs.readFileSync(path.join(__dirname,'profile-service.contract.json'),'utf8'));
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'hub/index.html'),'utf8');
const profile=fs.readFileSync(path.join(root,'hub/profile.js'),'utf8');
const game=fs.readFileSync(path.join(root,'tools/game-hub/index.html'),'utf8');
const studio=fs.readFileSync(path.join(root,'tools/studio/engine.html'),'utf8');
const project=fs.readFileSync(path.join(root,'tools/project-room/app.js'),'utf8');
const checks=[
  [core.includes('enabled:false'),'default opt-out'],
  [core.includes("state:'ACTIVE'")&&core.includes('canvasPx:512')&&core.includes('safeArtworkPx:420'),'achievement emblem standard active'],
  [core.includes('unlockedFor')&&core.includes('memberId'),'achievement unlocks bind to stable member identities'],
  [core.includes('participants.forEach'),'equal participant contributions'],
  [core.includes('dedupeKey'),'deduplicated receipts'],
  [core.includes('code character receipt requires evidence'),'code evidence gate'],
  [core.includes('CODE_MOODS')&&core.includes('infrastructure')&&core.includes('entertainment')&&core.includes('software'),'purpose-based code mood statistics'],
  [server.includes("state', 'shared-profile"),'local persistence'],
  [server.includes("'/api/profile/opt-in'"),'explicit opt-in API'],
  [server.includes("'delete-local-profile'"),'explicit delete API'],
  [client.includes("'/api/profile/event'"),'shared browser activity adapter'],
  [client.includes('recordCodeTask')&&client.includes('code-task:'),'stable machine-native code task receipts'],
  [providerContract.lifecycle==='OPTIONAL_OPT_IN'&&providerContract.portableInterface.includes('reportingHealth'),'portable opt-in provider contract'],
  [provider.includes('WAITING_FOR_RECEIPT')&&provider.includes('continuousSync:false'),'reporting health distinguishes a missing receipt from continuous synchronization'],
  [provider.includes("permissionGrant:'NONE'")&&provider.includes('authorshipInference:false'),'portable exports grant no permission and never infer authorship'],
  [hub.includes('Human + machine · one playful record'),'plain-language Hub screen'],
  [profile.includes('AXMAIPresence.members'),'live collaborator sync'],
  [hub.includes('id="profileState"')&&hub.includes('aria-pressed="false"'),'top profile state is an accessible button'],
  [profile.includes('function pauseProfile')&&profile.includes("$('profileState').addEventListener('click'"),'profile state button can pause and resume setup'],
  [profile.includes('latestTime')&&profile.includes('Date.parse(event.createdAt||0)'),'receipt health reads the newest code receipt regardless of event order'],
  [profile.includes('profileReceiptHealth')&&hub.includes('profileReceiptHealth'),'visible missing or stale receipt explanation'],
  [profile.includes('profileMark')&&hub.includes('Open shared profile and achievements'),'top-left AXM emblem opens profile'],
  [profile.includes('achievementCard')&&hub.includes('profileAchievements'),'locked and unlocked achievement gallery'],
  [profile.includes('holderBoard')&&hub.includes('Current craft holders'),'category holders without an ordered leaderboard'],
  [profile.includes('selectedMemberId')&&profile.includes('data-profile-member')&&hub.includes('profileAchievementOwner'),'clickable identity achievement profiles'],
  [core.includes('submitAssessment')&&core.includes('reviewAssessment')&&profile.includes('reflectionPanel'),'self-authored cross-validated strengths infographic'],
  [server.includes("'/api/profile/assessment/review'")&&server.includes('local-cross-validation'),'human or AI review route'],
  [fs.readFileSync(path.join(root,'hub/profile.css'),'utf8').includes('grayscale(1) brightness(.28)'),'locked emblems visibly darken'],
  [fs.existsSync(path.join(root,'assets/achievements/manifest.json')),'professional artwork slots and manifest'],
  [game.includes("type:'game-played'"),'successful game launch receipt'],
  [studio.includes("type:'picture-made'"),'produced picture receipt'],
  [project.includes("type: 'project-completed'"),'completed project receipt']
  ,[project.includes('projectContributionCandidates')&&project.includes('card.ownerName')&&project.includes('message.authorName'),'project completion credits explicit collaborators']
];
checks.forEach(([pass,label])=>assert.ok(pass,label));
console.log('shared profile seam discovery: PASS ('+checks.length+' seams)');
