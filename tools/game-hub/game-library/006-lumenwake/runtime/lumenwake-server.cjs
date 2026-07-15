#!/usr/bin/env node
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),Core=require('./lumenwake-core.cjs');
const HOST='0.0.0.0',PORT=Number(process.env.PORT||8796),ROOT=__dirname,CLIENT=path.join(ROOT,'lumenwake-client.html'),TICK=1000/30,STREAM=50;
function loadSeats(){try{const list=JSON.parse(process.env.AXM_PLAYERS_JSON||'[]');if(Array.isArray(list)&&list.length)return list.slice(0,4);}catch(e){}return[{display_name:'Player 1',type:'human'}];}
let game=Core.create(loadSeats(),Date.now()),last=Date.now();const inputs={},streams=new Set();Object.keys(game.players).forEach(id=>inputs[id]={moveX:0,moveY:0,action:false,dash:false,updatedAt:0});
function tick(){const now=Date.now(),dt=Math.min(.08,(now-last)/1000);last=now;Core.step(game,inputs,dt,now);}
function send(res,code,value){const body=JSON.stringify(value);res.writeHead(code,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store','access-control-allow-origin':'*'});res.end(body);}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>25000)req.destroy();});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(e){reject(e);}});req.on('error',reject);});}
function serve(file,res,type){res.writeHead(200,{'content-type':type,'cache-control':'no-store'});fs.createReadStream(file).pipe(res);}
const mime={'.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://lumenwake.local');try{
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end();}
  if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'))return serve(CLIENT,res,'text/html; charset=utf-8');
  if(req.method==='GET'&&(url.pathname==='/state'||url.pathname==='/health'))return send(res,200,Core.publicState(game));
  if(req.method==='GET'&&url.pathname==='/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache',connection:'keep-alive','access-control-allow-origin':'*'});res.write('retry: 800\n\n');streams.add(res);req.on('close',()=>streams.delete(res));return;}
  if(req.method==='GET'&&url.pathname.startsWith('/assets/')){const file=path.resolve(ROOT,'.'+url.pathname),base=path.resolve(ROOT,'assets')+path.sep;if(!file.startsWith(base)||!fs.existsSync(file))return send(res,404,{ok:false});return serve(file,res,mime[path.extname(file)]||'application/octet-stream');}
  if(req.method==='POST'&&url.pathname==='/input'){const id=/^p[1-4]$/.test(url.searchParams.get('player')||'')?url.searchParams.get('player'):'';if(!game.players[id]||game.players[id].kind!=='human')return send(res,403,{ok:false,error:'seat is not human-controlled'});inputs[id]=Object.assign(Core.inputShape(await body(req)),{updatedAt:Date.now()});return send(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/restart'){game=Core.create(loadSeats(),Date.now());Object.keys(inputs).forEach(id=>delete inputs[id]);Object.keys(game.players).forEach(id=>inputs[id]={moveX:0,moveY:0,action:false,dash:false,updatedAt:0});last=Date.now();return send(res,200,{ok:true,state:Core.publicState(game)});}
  return send(res,404,{ok:false,error:'not found'});
}catch(e){return send(res,400,{ok:false,error:e.message});}});
const physics=setInterval(tick,TICK),stream=setInterval(()=>{const packet='data: '+JSON.stringify(Core.publicState(game))+'\n\n';for(const client of streams){try{client.write(packet);}catch(e){streams.delete(client);}}},STREAM);
server.listen(PORT,HOST,()=>{console.log('Lumenwake 006 · 1–4 player co-op · Human/AI seats');console.log('Local: http://127.0.0.1:'+PORT+'/?player=screen');});
function shutdown(){clearInterval(physics);clearInterval(stream);for(const client of streams){try{client.end();}catch(e){}}server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),700).unref();}process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
