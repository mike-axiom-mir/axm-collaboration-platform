function summarize(values) {
  if (!values.length) return { samples:0, latest:null, average:null, p95:null, max:null };
  const sorted=[...values].sort((a,b)=>a-b);
  const average=values.reduce((sum,value)=>sum+value,0)/values.length;
  return {
    samples:values.length,
    latest:round(values.at(-1)),
    average:round(average),
    p95:round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]),
    max:round(sorted.at(-1))
  };
}
function round(value){ return Math.round(value*100)/100; }

/**
 * Explicit measurement ledger for performance claims that cannot be inferred
 * safely from the action bus alone.
 */
export class ControlPerformanceProbe {
  constructor(options={}) {
    this.windowSize=options.windowSize || 600;
    this.frameDurations=[];
    this.analogErrors=[];
    this.packetBytes={in:0,out:0};
    this.packetCount={in:0,out:0};
    this.accidentalTouches=[];
    this.controllerSamples=new Map();
    this.batterySnapshots=[];
    this.startedAt=Date.now();
  }

  recordFrameDuration(milliseconds){
    if(Number.isFinite(milliseconds) && milliseconds>=0) this.#push(this.frameDurations,milliseconds);
  }

  recordPacket(direction, packetOrBytes){
    if(!['in','out'].includes(direction)) throw new Error('direction must be in or out');
    let bytes=packetOrBytes;
    if(typeof packetOrBytes!=='number') bytes=new TextEncoder().encode(JSON.stringify(packetOrBytes)).byteLength;
    if(!Number.isFinite(bytes) || bytes<0) return;
    this.packetBytes[direction]+=bytes;
    this.packetCount[direction]+=1;
  }

  recordAnalogSample(sourceId, raw, normalized){
    const rawMagnitude=magnitude(raw);
    const normalizedMagnitude=magnitude(normalized);
    const error=Math.abs(rawMagnitude-normalizedMagnitude);
    this.#push(this.analogErrors,error);
    const item=this.controllerSamples.get(sourceId) || {samples:0,maxRaw:0,maxNormalized:0};
    item.samples+=1;
    item.maxRaw=Math.max(item.maxRaw,rawMagnitude);
    item.maxNormalized=Math.max(item.maxNormalized,normalizedMagnitude);
    this.controllerSamples.set(sourceId,item);
  }

  recordAccidentalTouch(reason, detail={}){
    this.accidentalTouches.push({timestamp:Date.now(),reason:String(reason||'unknown'),detail:structuredClone(detail)});
    while(this.accidentalTouches.length>100) this.accidentalTouches.shift();
  }

  recordBatterySnapshot(snapshot={}){
    if(!Number.isFinite(snapshot.level)) return;
    this.batterySnapshots.push({
      timestamp:Number.isFinite(snapshot.timestamp)?snapshot.timestamp:Date.now(),
      level:Math.max(0,Math.min(1,snapshot.level)),
      charging:Boolean(snapshot.charging)
    });
    while(this.batterySnapshots.length>60) this.batterySnapshots.shift();
  }

  summary(now=Date.now()){
    const frameStats=summarize(this.frameDurations);
    const fps=frameStats.average && frameStats.average>0 ? round(1000/frameStats.average) : null;
    const elapsedSeconds=Math.max(.001,(now-this.startedAt)/1000);
    const battery=calculateBattery(this.batterySnapshots);
    return {
      runtimeSeconds:round(elapsedSeconds),
      frameDurationMs:frameStats,
      estimatedFps:fps,
      analogMagnitudeError:summarize(this.analogErrors),
      network:{
        bytesIn:this.packetBytes.in,bytesOut:this.packetBytes.out,
        packetsIn:this.packetCount.in,packetsOut:this.packetCount.out,
        bytesPerSecond:round((this.packetBytes.in+this.packetBytes.out)/elapsedSeconds)
      },
      accidentalTouches:{count:this.accidentalTouches.length,recent:structuredClone(this.accidentalTouches.slice(-10))},
      controllers:Object.fromEntries([...this.controllerSamples.entries()].map(([id,value])=>[id,{...value}])),
      battery,
      limitations:[
        'Estimated FPS is based only on frame durations explicitly recorded by the game loop.',
        'Battery impact requires comparable controlled sessions; snapshots alone do not prove causation.',
        'Accidental touches are counted only when the UI or tester explicitly marks them.'
      ]
    };
  }

  #push(array,value){ array.push(value); while(array.length>this.windowSize) array.shift(); }
}

function magnitude(value){
  if(value && typeof value==='object') return Math.hypot(Number(value.x)||0,Number(value.y)||0);
  return Math.abs(Number(value)||0);
}
function calculateBattery(samples){
  if(samples.length<2) return {samples:samples.length,levelChange:null,elapsedMinutes:null,chargingChanged:null};
  const first=samples[0],last=samples.at(-1);
  return {
    samples:samples.length,
    levelChange:round(last.level-first.level),
    elapsedMinutes:round((last.timestamp-first.timestamp)/60000),
    chargingChanged:first.charging!==last.charging
  };
}
