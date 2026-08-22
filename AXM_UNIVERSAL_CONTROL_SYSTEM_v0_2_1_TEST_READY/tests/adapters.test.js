import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardMouseAdapter } from '../src/adapters/keyboard-mouse-adapter.js';
import { GamepadAdapter } from '../src/adapters/gamepad-adapter.js';

class FakeBus {
  constructor(){
    this.frames=[];this.released=[];
    this.registry={get:(id)=>({type:['MOVE','AIM','NAVIGATE'].includes(id)?'axis2':['ACCELERATE','BRAKE'].includes(id)?'trigger':'digital'})};
  }
  applyFrame(sourceId,frame,meta){this.frames.push({sourceId,frame,meta})}
  releaseSource(sourceId){this.released.push(sourceId)}
}
function keyEvent(type,code){
  const event=new Event(type,{cancelable:true});
  Object.defineProperty(event,'code',{value:code});
  Object.defineProperty(event,'repeat',{value:false});
  return event;
}

test('keyboard adapter publishes one full semantic frame per state change', () => {
  const bus=new FakeBus();
  const target=new EventTarget();
  const adapter=new KeyboardMouseAdapter(bus,{target});
  adapter.start();
  const before=bus.frames.length;
  target.dispatchEvent(keyEvent('keydown','KeyD'));
  assert.equal(bus.frames.length,before+1);
  const frame=bus.frames.at(-1).frame;
  assert.equal(frame.fullState,true);
  assert.deepEqual(frame.actions.find(action=>action.id==='MOVE').value,{x:1,y:0});
  target.dispatchEvent(keyEvent('keyup','KeyD'));
  assert.deepEqual(bus.frames.at(-1).frame.actions.find(action=>action.id==='MOVE').value,{x:0,y:0});
  adapter.stop();
});

test('gamepad adapter batches axes and buttons into one frame per poll', () => {
  const bus=new FakeBus();
  const oldNavigator=globalThis.navigator;
  const oldRaf=globalThis.requestAnimationFrame;
  const oldCancel=globalThis.cancelAnimationFrame;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[{
    axes:[.5,0,0,-.5],timestamp:12,mapping:'standard',id:'Test pad',
    buttons:Array.from({length:10},(_,index)=>({pressed:index===0,value:index===7?.7:0}))
  }]}});
  globalThis.requestAnimationFrame=()=>1;
  globalThis.cancelAnimationFrame=()=>{};
  try{
    const adapter=new GamepadAdapter(bus);
    adapter.start();
    assert.equal(bus.frames.length,1);
    const ids=bus.frames[0].frame.actions.map(action=>action.id);
    assert.ok(ids.includes('MOVE'));
    assert.ok(ids.includes('AIM'));
    assert.ok(ids.includes('PRIMARY_ACTION'));
    adapter.stop();
  }finally{
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:oldNavigator});
    globalThis.requestAnimationFrame=oldRaf;
    globalThis.cancelAnimationFrame=oldCancel;
  }
});

test('profile controller layout maps standard Xbox controls and dpad without game-specific button reads', () => {
  const bus=new FakeBus();
  const buttons=Array.from({length:17},()=>({pressed:false,value:0}));
  buttons[0]={pressed:true,value:1};
  buttons[7]={pressed:true,value:.72};
  buttons[15]={pressed:true,value:1};
  const adapter=new GamepadAdapter(bus,{controllerLayout:{
    MOVE:'leftStick',AIM:'rightStick',PRIMARY_ACTION:'rightTrigger',DODGE:'south',NAVIGATE:'dpad'
  }});
  const frame=adapter.sample({axes:[.6,0,0,-.7],buttons,mapping:'standard',id:'Xbox test pad',timestamp:20});
  assert.equal(frame.actions.find(action=>action.id==='PRIMARY_ACTION').value,1);
  assert.equal(frame.actions.find(action=>action.id==='DODGE').value,1);
  assert.deepEqual(frame.actions.find(action=>action.id==='NAVIGATE').value,{x:1,y:0});
  assert.ok(frame.actions.find(action=>action.id==='MOVE').value.x>0);
  assert.ok(frame.actions.find(action=>action.id==='AIM').value.y<0);
});

test('Brawl-style right-stick release creates exactly one semantic primary-action pulse', () => {
  const bus=new FakeBus();
  const buttons=Array.from({length:17},()=>({pressed:false,value:0}));
  const adapter=new GamepadAdapter(bus,{controllerLayout:{
    AIM:'rightStick',PRIMARY_ACTION:{control:'rightStick',gesture:'release',threshold:.55,releaseThreshold:.3}
  }});
  let frame=adapter.sample({axes:[0,0,.8,0],buttons,mapping:'standard',id:'Xbox test pad',timestamp:30});
  assert.equal(frame.actions.find(action=>action.id==='PRIMARY_ACTION').value,0,'aiming arms but does not fire');
  frame=adapter.sample({axes:[0,0,0,0],buttons,mapping:'standard',id:'Xbox test pad',timestamp:31});
  assert.equal(frame.actions.find(action=>action.id==='PRIMARY_ACTION').value,1,'release fires once');
  frame=adapter.sample({axes:[0,0,0,0],buttons,mapping:'standard',id:'Xbox test pad',timestamp:32});
  assert.equal(frame.actions.find(action=>action.id==='PRIMARY_ACTION').value,0,'next frame releases the pulse');
});

test('non-standard pads are rejected unless a calibrated mapping is explicitly allowed', () => {
  const bus=new FakeBus();
  const statuses=[];
  const adapter=new GamepadAdapter(bus,{onStatus:status=>statuses.push(status)});
  const frame=adapter.sample({axes:[],buttons:[],mapping:'',id:'Unmapped USB pad'});
  assert.equal(frame,null);
  assert.deepEqual(bus.released,['gamepad:0']);
  assert.equal(statuses.at(-1).state,'unsupported');
});
