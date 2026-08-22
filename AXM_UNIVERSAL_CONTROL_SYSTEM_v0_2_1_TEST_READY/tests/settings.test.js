import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsStore } from '../src/persistence/settings-store.js';

class MemoryStorage{
  constructor(value=null){this.value=value}
  getItem(){return this.value}
  setItem(_key,value){this.value=value}
}

test('settings migrate without losing old layouts and clamp unsafe values', () => {
  const storage=new MemoryStorage(JSON.stringify({version:'0.1.0',global:{stickSize:999,opacity:-4},games:{demo:{layout:{A:{x:20,y:30}},oneHandedMode:'left'}}}));
  const store=new SettingsStore(storage);
  const effective=store.effective('phone','demo');
  assert.equal(effective.stickSize,230);
  assert.equal(effective.opacity,.25);
  assert.equal(effective.oneHandedMode,'left');
  assert.deepEqual(effective.layout.A,{x:20,y:30});
  assert.equal(store.export().version,'0.2.0');
});

test('settings can reset one game without removing device preferences', () => {
  const store=new SettingsStore(new MemoryStorage());
  store.updateDevice('phone',{sensitivity:1.5});
  store.updateGame('game',{highContrast:true});
  store.resetGame('game');
  assert.equal(store.effective('phone','game').sensitivity,1.5);
  assert.equal(store.effective('phone','game').highContrast,false);
});
