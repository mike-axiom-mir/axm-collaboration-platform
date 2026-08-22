import { PhoneController } from '/src/ui/phone-controller.js';
import { SettingsStore } from '/src/persistence/settings-store.js';
import { InputMetrics } from '/src/core/metrics.js';
import { ReconnectingJsonSocket } from '/src/network/reconnecting-websocket.js';
import { createInputFrame } from '/src/network/protocol.js';
import { compatibleProfileActions, missingRequiredPhoneActions } from '/src/core/binding-coverage.js';

const params = new URLSearchParams(location.search);
let pairCode = params.get('code') || '';
if (!pairCode) pairCode = prompt('Enter the six-digit pairing code') || '';
const playerRequest = params.get('player') || '';
const store = new SettingsStore();
const [profile,actionsDocument] = await Promise.all([
  fetch('/profiles/reference-twin-stick.profile.json').then(requiredJson('control profile')),
  fetch('/profiles/core-actions.json').then(requiredJson('action registry'))
]);
const actionDefinitions=new Map(actionsDocument.actions.map(action=>[action.id,action]));
const profileActions=new Map(profile.actions.map(action=>[action.id,action]));
const transmittedActions=new Set(profile.actions.map(action=>action.id));
const deviceId = getDeviceId();
const resumeTokenKey = `axm.controls.resumeToken.${location.host}.${deviceId}`;
let resumeToken = localStorage.getItem(resumeTokenKey) || '';
const gameId = profile.gameId;
const metrics = new InputMetrics();
const status = document.querySelector('#status');
const controllerRoot = document.querySelector('#controller');

let sequence = 0;
let playerId = playerRequest || null;
let dirty = true;
let latestState = {};
let editMode = false;
let framesAttempted = 0;
let framesSentDirectly = 0;
let rejectedFrames = 0;
let lastStatusDetail = {state:'connecting'};
let lastWelcomeAt = null;

let effectiveSettings=store.effective(deviceId,gameId);
const controller = new PhoneController(controllerRoot, {
  profile,
  bindingOverrides:effectiveSettings.bindings?.phone || {},
  settings:effectiveSettings,
  onState: state => { latestState = state; dirty = true; }
});
controllerRoot.addEventListener('layoutchange', event => store.updateGame(gameId, { layout: event.detail }));
buildRemapControls();

const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new ReconnectingJsonSocket(
  () => `${wsProtocol}//${location.host}/ws?role=controller&code=${encodeURIComponent(pairCode)}&deviceId=${encodeURIComponent(deviceId)}&player=${encodeURIComponent(playerRequest)}&resumeToken=${encodeURIComponent(resumeToken)}`,
  { metrics }
);
socket.connect();
socket.addEventListener('status', event => {
  lastStatusDetail = event.detail;
  const connected = event.detail.state === 'connected';
  const silent = event.detail.state === 'simulated-silence';
  status.textContent = connected ? `CONNECTED${playerId ? ' · '+playerId.toUpperCase() : ''}` : silent ? 'TEST STALL ACTIVE' : event.detail.state === 'connecting' ? 'CONNECTING' : 'RECONNECTING';
  status.className = `status ${connected ? 'status-good' : 'status-warn'}`;
  if (!connected) { controller.neutralize(); dirty = true; }
  updateDiagnostics();
});
socket.addEventListener('message-object', event => {
  const message = event.detail;
  if (message.type === 'welcome') {
    playerId = message.playerId;
    if (message.resumeToken) {
      resumeToken = message.resumeToken;
      localStorage.setItem(resumeTokenKey, resumeToken);
    }
    lastWelcomeAt = Date.now();
    status.textContent = `CONNECTED · ${playerId.toUpperCase()}${message.resumed ? ' · RESUMED' : ''}`;
  }
  if (message.type === 'input_rejected') {
    rejectedFrames += 1;
    status.textContent = 'INPUT REJECTED';
    status.className = 'status status-bad';
    console.warn('AXM input rejected', message.errors || []);
  }
  if (message.type === 'server_shutdown') {
    status.textContent = 'HOST STOPPED';
    status.className = 'status status-bad';
    controller.neutralize();
  }
});

function sendState(force = false) {
  if (!dirty && !force) return;
  const actions = Object.entries(latestState).filter(([id])=>transmittedActions.has(id)).map(([id,value]) => ({id,value}));
  const frame = createInputFrame({deviceId,playerId,sequence:sequence++,actions,fullState:true,context:'gameplay'});
  frame.transportRttMs = metrics.summary().rttMs.latest;
  framesAttempted += 1;
  if (socket.send(frame)) framesSentDirectly += 1;
  dirty = false;
}
setInterval(() => sendState(false), 1000/30);
setInterval(() => sendState(true), 250);

document.querySelector('#edit').addEventListener('click', () => {
  editMode = !editMode;
  controller.setEditMode(editMode);
  document.querySelector('#edit').textContent = editMode ? 'SAVE LAYOUT' : 'EDIT LAYOUT';
});
const dialog = document.querySelector('#settingsDialog');
document.querySelector('#settings').addEventListener('click', () => { fillSettings(); dialog.showModal(); });
document.querySelector('#closeSettings').addEventListener('click', () => { applySettings(); dialog.close(); });
document.querySelector('#resetGame').addEventListener('click', () => {
  store.resetGame(gameId);
  effectiveSettings=store.effective(deviceId,gameId);
  controller.applyProfile(profile,effectiveSettings.bindings?.phone || {});
  controller.applySettings(effectiveSettings);
  buildRemapControls();
  fillSettings();
});

for (const id of ['stickSize','buttonSize','opacity','sensitivity','deadZone','snapDirections','floatingSticks','leftHanded','oneHandedMode','highContrast','reducedMotion','vibrationEnabled']) {
  document.querySelector('#'+id).addEventListener('input', applySettings);
}

function fillSettings() {
  effectiveSettings=store.effective(deviceId,gameId);
  for (const [key,value] of Object.entries(effectiveSettings)) {
    const input=document.querySelector('#'+key);
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value;
  }
  const overrides=effectiveSettings.bindings?.phone || {};
  for(const select of document.querySelectorAll('[data-binding-control]')){
    const defaultAction=profile.phoneLayout.controls.find(control=>control.id===select.dataset.bindingControl)?.action;
    select.value=overrides[select.dataset.bindingControl] || defaultAction || '';
  }
  updateBindingWarning();
}
function applySettings() {
  const patch = {
    stickSize:Number(document.querySelector('#stickSize').value),
    buttonSize:Number(document.querySelector('#buttonSize').value),
    opacity:Number(document.querySelector('#opacity').value),
    sensitivity:Number(document.querySelector('#sensitivity').value),
    deadZone:Number(document.querySelector('#deadZone').value),
    snapDirections:Number(document.querySelector('#snapDirections').value),
    floatingSticks:document.querySelector('#floatingSticks').checked,
    leftHanded:document.querySelector('#leftHanded').checked,
    oneHandedMode:document.querySelector('#oneHandedMode').value,
    highContrast:document.querySelector('#highContrast').checked,
    reducedMotion:document.querySelector('#reducedMotion').checked,
    vibrationEnabled:document.querySelector('#vibrationEnabled').checked
  };
  store.updateGame(gameId,patch);
  controller.applySettings({...patch,layout:controller.settings.layout});
}

function buildRemapControls(){
  const root=document.querySelector('#remapControls');
  root.replaceChildren();
  const overrides=store.effective(deviceId,gameId).bindings?.phone || {};
  for(const control of profile.phoneLayout.controls || []){
    const compatible=compatibleProfileActions(profile,actionDefinitions,control.id);
    const row=document.createElement('label');
    row.className='binding-row';
    const name=document.createElement('span');
    name.textContent=control.id;
    const select=document.createElement('select');
    select.dataset.bindingControl=control.id;
    for(const actionId of compatible){
      const option=document.createElement('option');
      option.value=actionId;
      option.textContent=profileActions.get(actionId)?.label || actionDefinitions.get(actionId)?.name || actionId;
      select.append(option);
    }
    select.value=overrides[control.id] || control.action;
    select.addEventListener('change',()=>applyBinding(control.id,select.value));
    row.append(name,select); root.append(row);
  }
  updateBindingWarning();
}
function applyBinding(controlId,actionId){
  const settings=store.effective(deviceId,gameId);
  const phone={...(settings.bindings?.phone || {}),[controlId]:actionId};
  store.updateGame(gameId,{bindings:{phone}});
  controller.remapControl(controlId,actionId,profileActions.get(actionId)?.label || actionDefinitions.get(actionId)?.name || actionId);
  updateBindingWarning();
}
function updateBindingWarning(){
  const warning=document.querySelector('#bindingWarning');
  const settings=store.effective(deviceId,gameId);
  const overrides=settings.bindings?.phone || {};
  const missing=missingRequiredPhoneActions(profile,overrides).map(actionId=>profileActions.get(actionId)?.label || actionId);
  warning.textContent=missing.length ? `Required action not assigned: ${missing.join(', ')}. The setting is kept, but this layout may be incomplete.` : 'All required actions have a phone control path.';
  warning.style.color=missing.length?'#ffc85a':'#63e68c';
}
function requiredJson(label){
  return async response=>{if(!response.ok) throw new Error(`${label} failed to load`);return response.json()};
}
function getDeviceId(){
  const key='axm.controls.deviceId';
  let id=localStorage.getItem(key);
  if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}
  return id;
}
const testPanel=document.querySelector('#testPanel');
document.querySelector('#test').addEventListener('click',()=>{testPanel.hidden=!testPanel.hidden;updateDiagnostics()});
document.querySelector('#closeTest').addEventListener('click',()=>{testPanel.hidden=true});
document.querySelector('#sendNeutral').addEventListener('click',()=>neutralizeAndSend('manual neutral'));
document.querySelector('#forceReconnect').addEventListener('click',()=>{neutralizeAndSend('manual reconnect');socket.forceReconnect('Saturday test: forced reconnect')});
document.querySelector('#simulateStall').addEventListener('click',()=>{socket.suspendOutbound(5000);updateDiagnostics()});

function neutralizeAndSend(reason){
  controller.neutralize(); dirty=true; sendState(true);
  status.textContent=`NEUTRAL SENT · ${reason.toUpperCase()}`;
}
function recoverConnection(reason){
  socket.wake(reason); dirty=true;
  setTimeout(()=>sendState(true),80);
}
function updateDiagnostics(){
  const output=document.querySelector('#diagnosticsText');
  if(!output)return;
  const now=Date.now();
  const summary=metrics.summary(now);
  const transport=socket.statusSnapshot(now);
  output.textContent=JSON.stringify({
    time:new Date(now).toISOString(), playerId, online:navigator.onLine, visibility:document.visibilityState,
    transport, rttMs:summary.rttMs, reconnects:summary.reconnects,
    framesAttempted,framesSentDirectly,rejectedFrames,lastWelcomeAgeMs:lastWelcomeAt?now-lastWelcomeAt:null,
    lastStatus:{state:lastStatusDetail.state,reason:lastStatusDetail.reason||null,retryInMs:lastStatusDetail.retryInMs||null}
  },null,2);
}
setInterval(updateDiagnostics,500);

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden') neutralizeAndSend('phone hidden');
  else recoverConnection('phone visible');
});
window.addEventListener('pagehide',()=>neutralizeAndSend('page hidden'));
window.addEventListener('pageshow',()=>recoverConnection('page shown'));
window.addEventListener('online',()=>recoverConnection('network online'));
window.addEventListener('offline',()=>{neutralizeAndSend('network offline');status.textContent='OFFLINE · INPUT NEUTRALIZED';status.className='status status-bad'});
window.addEventListener('beforeunload',()=>{controller.neutralize();dirty=true;sendState(true);socket.close(1000,'page unload')});
