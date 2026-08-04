"use strict";
const { spawn } = require("child_process"); const path=require("path"); const { iso, sha256 }=require("../common");
function runNodeProbe(spec={}) {
  return new Promise((resolve,reject)=>{
    if (!spec.scriptPath) return reject(new TypeError("scriptPath required"));
    const timeoutMs=Math.max(10,Math.min(spec.timeoutMs||2000,60000)); const memoryMb=Math.max(16,Math.min(spec.memoryMb||64,1024));
    const maxOutputBytes=Math.max(256,Math.min(spec.maxOutputBytes||65536,1048576)); const started=Date.now(); let stdout="",stderr="",overflow=false,timedOut=false,settled=false;
    const allowedEnv={}; for (const key of spec.allowedEnv||[]) if (Object.prototype.hasOwnProperty.call(process.env,key)) allowedEnv[key]=process.env[key];
    const args=[`--max-old-space-size=${memoryMb}`,path.resolve(spec.scriptPath),...(spec.args||[]).map(String)];
    const child=spawn(process.execPath,args,{cwd:path.resolve(spec.cwd||path.dirname(spec.scriptPath)),env:allowedEnv,shell:false,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    const finish=(status,code,signal,error)=>{ if(settled)return; settled=true; clearTimeout(timer); const receipt={schema:"axm.probe-run.receipt/v1",probeId:spec.probeId||path.basename(spec.scriptPath),startedAt:iso(started),finishedAt:iso(),durationMs:Date.now()-started,status,exitCode:code,signal,stdout,stderr,timedOut,outputOverflow:overflow,limits:{timeoutMs,memoryMb,maxOutputBytes},sideEffectsPermitted:false,error:error?String(error.message||error):null,authority:"OBSERVE_ONLY"}; receipt.digest=sha256(receipt); resolve(receipt); };
    const collect=(kind,chunk)=>{ const next=(kind==="stdout"?stdout:stderr)+chunk.toString("utf8"); if(Buffer.byteLength(next)>maxOutputBytes){overflow=true; child.kill("SIGKILL");} else if(kind==="stdout") stdout=next; else stderr=next; };
    child.stdout.on("data",c=>collect("stdout",c)); child.stderr.on("data",c=>collect("stderr",c)); child.on("error",e=>finish("ERROR",null,null,e)); child.on("close",(code,signal)=>finish(overflow?"OUTPUT_LIMIT":timedOut?"TIMEOUT":code===0?"PASS":"FAIL",code,signal,null));
    const timer=setTimeout(()=>{timedOut=true; child.kill("SIGKILL");},timeoutMs);
  });
}
module.exports={runNodeProbe};
