import test from 'node:test';
import assert from 'node:assert/strict';
import { ControlPerformanceProbe } from '../src/core/performance-probe.js';

test('performance probe records only measured evidence and exposes limitations', () => {
  const probe=new ControlPerformanceProbe();
  probe.startedAt=0;
  probe.recordFrameDuration(16);
  probe.recordFrameDuration(18);
  probe.recordPacket('in',{type:'input_frame'});
  probe.recordPacket('out',20);
  probe.recordAnalogSample('phone:p1',{x:.5,y:0},{x:.4,y:0});
  probe.recordAccidentalTouch('edge-palm',{control:'A'});
  probe.recordBatterySnapshot({timestamp:0,level:.8,charging:false});
  probe.recordBatterySnapshot({timestamp:600000,level:.76,charging:false});
  const summary=probe.summary(1000);
  assert.ok(summary.estimatedFps>50);
  assert.ok(summary.network.bytesIn>0);
  assert.equal(summary.accidentalTouches.count,1);
  assert.equal(summary.battery.levelChange,-.04);
  assert.ok(summary.limitations.some(item=>item.includes('Battery impact')));
});
