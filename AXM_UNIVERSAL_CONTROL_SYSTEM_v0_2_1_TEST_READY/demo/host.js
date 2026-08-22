import { ControlRuntime } from '/src/core/control-runtime.js';
import { InputMetrics } from '/src/core/metrics.js';
import { KeyboardMouseAdapter } from '/src/adapters/keyboard-mouse-adapter.js';
import { GamepadAdapter } from '/src/adapters/gamepad-adapter.js';
import { NetworkControllerAdapter } from '/src/adapters/network-controller-adapter.js';
import { ReconnectingJsonSocket } from '/src/network/reconnecting-websocket.js';

const [actionsDocument, profile, session] = await Promise.all([
  fetch('/profiles/core-actions.json').then(response => response.json()),
  fetch('/profiles/reference-twin-stick.profile.json').then(response => response.json()),
  fetch('/session').then(response => response.json())
]);

document.querySelector('#pairCode').textContent = session.pairCode;
const runtime = new ControlRuntime({actionsDocument,profile,initialContext:'gameplay'});
const {bus,contexts}=runtime;
const metrics = new InputMetrics();
let serverDiagnostics = null;
let testLogStartedAt = Date.now();
const testEvents = [];
let lastGamepadState = null;
function logTestEvent(type, details = {}) {
  const event = { at: Date.now(), iso: new Date().toISOString(), type, ...details };
  testEvents.push(event);
  while (testEvents.length > 500) testEvents.shift();
  renderEventLog();
  return event;
}

const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new ReconnectingJsonSocket(
  () => `${wsProtocol}//${location.host}/ws?role=screen&code=${encodeURIComponent(session.pairCode)}&deviceId=host-screen`,
  { metrics }
);
socket.connect();

socket.addEventListener('status', event => {
  logTestEvent('host_transport_status',{state:event.detail.state,reason:event.detail.reason||null,retryInMs:event.detail.retryInMs||null});
  const el = document.querySelector('#connection');
  el.textContent = event.detail.state === 'connected' ? 'Host connected · waiting for phone/gamepad/keyboard' : 'Reconnecting';
  el.className = event.detail.state === 'connected' ? 'status-good' : 'status-warn';
});
socket.addEventListener('message-object', event => {
  const message = event.detail;
  if (message.type === 'input_frame') {
    metrics.recordFrame(message.deviceId || message.playerId || 'phone', message);
    if (Number.isFinite(message.transportRttMs)) metrics.recordRtt(message.transportRttMs);
  }
  if (message.type === 'controller_connected') { document.querySelector('#connection').textContent = `${message.playerId} phone connected`; logTestEvent('controller_connected',{playerId:message.playerId,deviceId:message.deviceId}); }
  if (message.type === 'controller_resumed') { document.querySelector('#connection').textContent = `${message.playerId} phone resumed`; logTestEvent('controller_resumed',{playerId:message.playerId,deviceId:message.deviceId}); }
  if (message.type === 'controller_disconnected') { document.querySelector('#connection').textContent = `${message.playerId} disconnected · input neutralized · ${message.reason}`; logTestEvent('controller_disconnected',{playerId:message.playerId,deviceId:message.deviceId,reason:message.reason}); }
  if (message.type === 'input_frame' && message.context !== 'gameplay') logTestEvent('safety_neutral_frame',{playerId:message.playerId,context:message.context});
});

const gamepadAdapter = new GamepadAdapter(bus, {
  controllerLayout: profile.controllerLayout,
  onStatus(detail) {
    const el = document.querySelector('#gamepadStatus');
    const name = detail.id ? detail.id.replace(/\s*\([^)]*\)\s*/g, ' ').trim() : 'Xbox / standard gamepad';
    if (detail.state === 'connected') {
      el.textContent = `${name} ready`;
      el.className = 'status-good';
    } else if (detail.state === 'unsupported') {
      el.textContent = `${name}: ${detail.reason}`;
      el.className = 'status-bad';
    } else {
      el.textContent = 'No physical controller detected';
      el.className = 'status-warn';
    }
    if (lastGamepadState !== detail.state) logTestEvent('gamepad_status', detail);
    lastGamepadState = detail.state;
  }
});

runtime
  .addAdapter(new NetworkControllerAdapter(bus,socket))
  .addAdapter(new KeyboardMouseAdapter(bus))
  .addAdapter(gamepadAdapter)
  .start();

contexts.subscribe(context => {
  document.querySelector('#contextLabel').textContent = context?.visibleLabel || 'Default';
  document.querySelector('#contextLabel').className = 'status-good';
});

let menuOpen = false;
let lastMenuPressed = false;
bus.subscribe((event, snapshot) => {
  if (event.id === 'OPEN_MENU') {
    const nowPressed = Boolean(event.value);
    if (nowPressed && !lastMenuPressed) {
      lastMenuPressed = true;
      menuOpen = !menuOpen;
      contexts.replace(menuOpen ? 'menu' : 'gameplay');
    } else if (!nowPressed) {
      lastMenuPressed = false;
    }
  }
  document.querySelector('#actions').textContent = JSON.stringify(snapshot, null, 2);
});

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const player = { x: canvas.width / 2, y: canvas.height / 2, radius: 24, aimX: 1, aimY: 0, primaryAt: 0, superAt: 0 };
const pulses = [];
let previous = performance.now();

function gameLoop(now) {
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;

  if (!menuOpen) {
    const move = bus.get('MOVE');
    const aim = bus.get('AIM');
    const magnitude = Math.hypot(move.x, move.y) || 1;
    const speed = bus.isPressed('DODGE') ? 500 : 260;
    player.x += (move.x / Math.max(1,magnitude)) * speed * dt;
    player.y += (move.y / Math.max(1,magnitude)) * speed * dt;
    player.x = Math.max(player.radius, Math.min(canvas.width-player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height-player.radius, player.y));
    if (Math.hypot(aim.x, aim.y) > .1) { player.aimX = aim.x; player.aimY = aim.y; }
    if (bus.isPressed('PRIMARY_ACTION') && now - player.primaryAt > 180) {
      pulses.push({x:player.x,y:player.y,life:1,kind:'primary'});
      player.primaryAt = now;
    }
    if (bus.isPressed('SECONDARY_ACTION') && now - player.superAt > 650) {
      pulses.push({x:player.x,y:player.y,life:1,kind:'super'});
      player.superAt = now;
    }
  }

  for (const pulse of pulses) pulse.life -= dt * 1.7;
  while (pulses.length && pulses[0].life <= 0) pulses.shift();

  draw(now);
  updateMetrics();
  requestAnimationFrame(gameLoop);
}

function draw(now) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const gradient=ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  gradient.addColorStop(0,'#071827');gradient.addColorStop(1,'#090512');ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='rgba(53,230,255,.08)';ctx.lineWidth=1;
  for(let x=0;x<canvas.width;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}
  for(let y=0;y<canvas.height;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
  for(const pulse of pulses){ctx.beginPath();ctx.arc(pulse.x,pulse.y,(1-pulse.life)*(pulse.kind==='super'?320:180)+30,0,Math.PI*2);ctx.strokeStyle=pulse.kind==='super'?`rgba(255,200,90,${pulse.life})`:`rgba(53,230,255,${pulse.life})`;ctx.lineWidth=(pulse.kind==='super'?14:8)*pulse.life+1;ctx.stroke()}
  ctx.save();ctx.translate(player.x,player.y);ctx.shadowColor='#35e6ff';ctx.shadowBlur=28;ctx.fillStyle='#eafdff';ctx.beginPath();ctx.arc(0,0,player.radius,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ff4fc8';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(player.aimX*72,player.aimY*72);ctx.stroke();ctx.restore();
  if(menuOpen){ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 56px system-ui';ctx.fillText('MENU CONTEXT',canvas.width/2,canvas.height/2-20);ctx.font='24px system-ui';ctx.fillStyle='#ffc85a';ctx.fillText('Controls are visibly remapped. Press MENU / Esc to return.',canvas.width/2,canvas.height/2+35)}
  ctx.textAlign='left';ctx.font='700 18px ui-monospace,monospace';ctx.fillStyle='#91a0b4';ctx.fillText('GAME READS SEMANTIC ACTIONS — NEVER RAW BUTTONS, KEYS, OR TOUCH',24,34);
}

function updateMetrics(){
  const summary=metrics.summary();
  document.querySelector('#rtt').textContent=summary.rttMs.latest ?? '—';
  document.querySelector('#rate').textContent=summary.samplesPerSecond;
  document.querySelector('#gaps').textContent=summary.sequenceGaps;
  document.querySelector('#reconnects').textContent=serverDiagnostics?.totals?.resumes ?? 0;
  document.querySelector('#controllerCount').textContent=serverDiagnostics?.controllers?.length ?? 0;
  document.querySelector('#staleTimeouts').textContent=serverDiagnostics?.totals?.staleTimeouts ?? 0;
}

async function refreshDiagnostics(){
  try {
    const response=await fetch('/diagnostics',{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const next=await response.json();
    const previousStale=serverDiagnostics?.totals?.staleTimeouts || 0;
    serverDiagnostics=next;
    if((next.totals?.staleTimeouts||0)>previousStale) logTestEvent('watchdog_recovery_observed',{total:next.totals.staleTimeouts});
  } catch(error){ logTestEvent('diagnostics_fetch_failed',{error:error.message}); }
}
setInterval(refreshDiagnostics,1000);
refreshDiagnostics();

function renderEventLog(){
  const root=document.querySelector('#eventLog');
  if(!root)return;
  const recent=testEvents.slice(-10).reverse();
  root.textContent=recent.length?recent.map(event=>`${event.iso.slice(11,19)} · ${event.type}${event.reason?' · '+event.reason:''}${event.playerId?' · '+event.playerId:''}`).join('\n'):'No events yet.';
}
document.querySelector('#resetLog').addEventListener('click',()=>{testEvents.length=0;testLogStartedAt=Date.now();logTestEvent('test_log_reset')});
document.querySelector('#downloadLog').addEventListener('click',()=>{
  const report={
    format:'axm-control-live-test/0.1',version:session.version,startedAt:testLogStartedAt,exportedAt:Date.now(),
    browser:{userAgent:navigator.userAgent,platform:navigator.platform,online:navigator.onLine},
    measuredMetrics:metrics.summary(),serverDiagnostics,events:testEvents,
    limitation:'RTT is measured; this file does not claim synchronized one-way input latency.'
  };
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`AXM_CONTROL_LIVE_TEST_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  logTestEvent('test_log_downloaded');
});

requestAnimationFrame(gameLoop);
