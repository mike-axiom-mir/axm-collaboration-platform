#!/usr/bin/env node
'use strict';
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const SERVER_PORT=8812;
const DEBUG_PORT=9223;
const PAIR_CODE='445566';
const CHROMIUM=process.env.CHROMIUM_PATH || 'chromium';
const profileDir=fs.mkdtempSync(path.join(os.tmpdir(),'axm-control-chrome-'));
const errors=[];
let server=null,browser=null,cdp=null;

(async()=>{
  try{
    server=spawn(process.execPath,['server/reference-server.cjs'],{cwd:ROOT,env:{...process.env,PORT:String(SERVER_PORT),AXM_PAIR_CODE:PAIR_CODE,AXM_CONTROLLER_STALE_MS:'10000'},stdio:['ignore','pipe','pipe']});
    await waitForHttp(`http://127.0.0.1:${SERVER_PORT}/health`);
    browser=spawn(CHROMIUM,[
      '--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking',
      '--remote-allow-origins=*',`--remote-debugging-port=${DEBUG_PORT}`,`--user-data-dir=${profileDir}`,'about:blank'
    ],{stdio:['ignore','ignore','pipe']});
    await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets=await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then(response=>response.json());
    const target=targets.find(item=>item.type==='page');
    if(!target?.webSocketDebuggerUrl) throw new Error('Chromium page target unavailable');
    cdp=new CdpClient(target.webSocketDebuggerUrl);
    await cdp.open();
    cdp.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails?.text || 'runtime exception'));
    cdp.on('Log.entryAdded',event=>{if(['error','warning'].includes(event.entry?.level)) errors.push(event.entry.text)});
    await cdp.call('Page.enable'); await cdp.call('Runtime.enable'); await cdp.call('Log.enable');

    await navigate(`http://127.0.0.1:${SERVER_PORT}/host`);
    await waitForExpression(`document.querySelector('#pairCode')?.textContent.trim()==='${PAIR_CODE}'`);
    await waitForExpression("document.querySelector('#connection')?.textContent.includes('Host connected')");
    const host=await evaluate(`({pair:document.querySelector('#pairCode').textContent.trim(),context:document.querySelector('#contextLabel').textContent.trim(),canvas:Boolean(document.querySelector('#game'))})`);
    if(host.pair!==PAIR_CODE || !host.canvas) throw new Error('host smoke assertions failed');

    await navigate(`http://127.0.0.1:${SERVER_PORT}/phone?code=${PAIR_CODE}`);
    await waitForExpression("document.querySelector('#status')?.textContent.includes('CONNECTED')",7000);
    await waitForExpression("document.querySelectorAll('[data-binding-control]').length>=5");
    const phone=await evaluate(`({
      status:document.querySelector('#status').textContent.trim(),
      remaps:document.querySelectorAll('[data-binding-control]').length,
      oneHanded:Boolean(document.querySelector('#oneHandedMode')),
      yHidden:document.querySelector('[data-label="Y"]').hidden,
      controller:Boolean(document.querySelector('.axm-phone-controller'))
    })`);
    if(!phone.controller || !phone.oneHanded || phone.remaps<5 || !phone.yHidden) throw new Error('phone smoke assertions failed');
    const screenshot=await cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(ROOT,'proof','phone-browser-smoke.png'),Buffer.from(screenshot.data,'base64'));

    if(errors.length) throw new Error(`browser console errors: ${errors.join(' | ')}`);
    const report={ok:true,checkedAt:new Date().toISOString(),chromium:CHROMIUM,host,phone,consoleErrors:errors};
    fs.writeFileSync(path.join(ROOT,'proof','BROWSER_SMOKE_REPORT.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }finally{
    try{cdp?.close()}catch{}
    if(browser && !browser.killed) browser.kill('SIGKILL');
    if(server && !server.killed) server.kill('SIGTERM');
    fs.rmSync(profileDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});

async function navigate(url){ await cdp.call('Page.navigate',{url}); await new Promise(resolve=>setTimeout(resolve,500)); }
async function evaluate(expression){ const result=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
async function waitForExpression(expression,timeout=5000){ const started=Date.now(); while(Date.now()-started<timeout){try{if(await evaluate(expression))return}catch{} await new Promise(resolve=>setTimeout(resolve,100));} const debug=await evaluate(`({href:location.href,title:document.title,text:document.body?.innerText?.slice(0,300)})`).catch(()=>null); throw new Error(`browser expression timeout: ${expression} :: ${JSON.stringify(debug)}`); }
async function waitForHttp(url,timeout=6000){ const started=Date.now(); while(Date.now()-started<timeout){try{const response=await fetch(url);if(response.ok)return}catch{} await new Promise(resolve=>setTimeout(resolve,80));}throw new Error(`HTTP timeout: ${url}`); }

class CdpClient{
  constructor(url){this.url=url;this.socket=null;this.nextId=1;this.pending=new Map();this.listeners=new Map()}
  open(){return new Promise((resolve,reject)=>{this.socket=new WebSocket(this.url);this.socket.addEventListener('open',resolve,{once:true});this.socket.addEventListener('error',()=>reject(new Error('CDP websocket error')),{once:true});this.socket.addEventListener('message',event=>this.#message(event.data));})}
  call(method,params={}){const id=this.nextId++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(this.pending.delete(id))reject(new Error(`CDP timeout: ${method}`))},8000)})}
  on(method,listener){if(!this.listeners.has(method))this.listeners.set(method,new Set());this.listeners.get(method).add(listener)}
  close(){this.socket?.close()}
  #message(text){let message;try{message=JSON.parse(text)}catch{return}if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);if(message.error)pending.reject(new Error(message.error.message));else pending.resolve(message.result);return}for(const listener of this.listeners.get(message.method)||[])listener(message.params||{})}
}
