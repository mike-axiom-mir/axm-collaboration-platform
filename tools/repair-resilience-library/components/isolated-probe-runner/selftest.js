"use strict"; const assert=require("assert"),fs=require("fs"),os=require("os"),path=require("path"); const {runNodeProbe}=require("./index");
(async()=>{ const d=fs.mkdtempSync(path.join(os.tmpdir(),"axm-probe-"));
 const ok=path.join(d,"ok.js"); fs.writeFileSync(ok,'console.log("ok")'); const r=await runNodeProbe({scriptPath:ok,timeoutMs:500}); assert.equal(r.status,"PASS"); assert.match(r.stdout,/ok/);
 const slow=path.join(d,"slow.js"); fs.writeFileSync(slow,'setTimeout(()=>{},1000)'); const t=await runNodeProbe({scriptPath:slow,timeoutMs:30}); assert.equal(t.status,"TIMEOUT");
 const noisy=path.join(d,"noisy.js"); fs.writeFileSync(noisy,'console.log("x".repeat(5000))'); const n=await runNodeProbe({scriptPath:noisy,maxOutputBytes:300}); assert.equal(n.status,"OUTPUT_LIMIT");
 fs.rmSync(d,{recursive:true,force:true}); console.log("PASS isolated-probe-runner"); })().catch(e=>{console.error(e);process.exit(1)});
