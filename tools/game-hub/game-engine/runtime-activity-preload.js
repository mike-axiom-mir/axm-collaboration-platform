'use strict';

/* Loaded by the Game Hub before a managed child runtime. It observes genuine
   input traffic and adds a tiny browser-side activity sensor to HTML served by
   that runtime. It never reads payloads, keys, form values, or game state. */
const http = require('http');

const PATCH = Symbol.for('axm.runtime-activity-preload/v1');
const ACTIVITY_PATH = '/__axm/activity';
const CLIENT_PATH = '/__axm/activity-client.js';
const SCRIPT_MARKER = 'data-axm-runtime-activity="v1"';
const CLIENT_SOURCE = `(function(){
  'use strict';
  var endpoint='${ACTIVITY_PATH}',last=0,gamepadState='';
  function ping(kind){
    var now=Date.now(); if(now-last<4000)return; last=now;
    var body=JSON.stringify({kind:String(kind||'browser-input').slice(0,80)});
    try{if(navigator.sendBeacon&&navigator.sendBeacon(endpoint,new Blob([body],{type:'application/json'})))return;}catch(e){}
    try{fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:body,keepalive:true,cache:'no-store'}).catch(function(){});}catch(e){}
  }
  ['pointerdown','pointermove','touchstart','keydown','input','change','wheel'].forEach(function(type){
    addEventListener(type,function(){ping(type);},{capture:true,passive:true});
  });
  addEventListener('gamepadconnected',function(){ping('gamepadconnected');});
  setInterval(function(){
    if(document.visibilityState!=='visible'||!navigator.getGamepads)return;
    var pads=Array.prototype.slice.call(navigator.getGamepads()||[]).filter(Boolean);
    var next=pads.map(function(p){return (p.buttons||[]).map(function(b){return b.pressed?1:0;}).join('')+'|'+(p.axes||[]).map(function(a){return Math.round(a*10)/10;}).join(',');}).join(';');
    if(gamepadState&&next&&next!==gamepadState)ping('gamepad'); gamepadState=next;
  },500);
})();\n`;

function report(kind, request) {
  if (typeof process.send !== 'function' || !process.connected) return;
  try {
    process.send({
      type: 'axm.runtime-activity/v1',
      gameId: process.env.AXM_GAME_ID || null,
      sessionId: process.env.AXM_GAME_SESSION_ID || null,
      kind: String(kind || 'runtime-request').slice(0, 160),
      method: request && request.method || null,
      path: request && String(request.url || '').split('?')[0].slice(0, 240) || null,
      observedAt: new Date().toISOString()
    });
  } catch (error) {}
}

function injectActivityClient(html) {
  if (!html || html.includes(SCRIPT_MARKER)) return html;
  const tag = `<script src="${CLIENT_PATH}" ${SCRIPT_MARKER}></script>`;
  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, tag + '</body>') : html + tag;
}

function headerFromObject(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const key = Object.keys(headers).find(item => item.toLowerCase() === name);
  return key ? String(headers[key] || '') : '';
}

function deleteHeaderFromObject(headers, name) {
  if (!headers || typeof headers !== 'object') return;
  for (const key of Object.keys(headers)) if (key.toLowerCase() === name) delete headers[key];
}

function instrumentHtmlResponse(response) {
  const originalWriteHead = response.writeHead;
  const originalWrite = response.write;
  const originalEnd = response.end;
  const chunks = [];
  let bufferHtml = false;

  function consider(headers) {
    if (response.headersSent) return;
    const contentType = headerFromObject(headers, 'content-type') || String(response.getHeader('content-type') || '');
    const contentEncoding = headerFromObject(headers, 'content-encoding') || String(response.getHeader('content-encoding') || '');
    if (/\btext\/html\b/i.test(contentType) && !contentEncoding) {
      bufferHtml = true;
      deleteHeaderFromObject(headers, 'content-length');
      response.removeHeader('content-length');
    }
  }

  response.writeHead = function (statusCode, statusMessage, headers) {
    const headerBag = typeof statusMessage === 'object' && statusMessage !== null ? statusMessage : headers;
    consider(headerBag);
    return originalWriteHead.apply(this, arguments);
  };
  response.write = function (chunk, encoding, callback) {
    consider(null);
    if (!bufferHtml) return originalWrite.apply(this, arguments);
    if (chunk != null) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof callback === 'function') process.nextTick(callback);
    return true;
  };
  response.end = function (chunk, encoding, callback) {
    consider(null);
    if (!bufferHtml) return originalEnd.apply(this, arguments);
    if (chunk != null) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    const body = injectActivityClient(Buffer.concat(chunks).toString('utf8'));
    return originalEnd.call(this, Buffer.from(body, 'utf8'), callback);
  };
}

if (!http.Server.prototype[PATCH]) {
  const originalEmit = http.Server.prototype.emit;
  Object.defineProperty(http.Server.prototype, PATCH, { value: true });
  http.Server.prototype.emit = function (event, request, response) {
    if (event === 'request' && request && response) {
      let pathname = '';
      try { pathname = new URL(request.url, 'http://127.0.0.1').pathname; } catch (error) {}
      if (request.method === 'GET' && pathname === CLIENT_PATH) {
        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
        response.end(CLIENT_SOURCE);
        return true;
      }
      if (request.method === 'POST' && pathname === ACTIVITY_PATH) {
        report('browser-input', request);
        request.resume();
        response.writeHead(204, { 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
        response.end();
        return true;
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(String(request.method || '').toUpperCase())) {
        report('http-' + String(request.method || 'mutation').toLowerCase() + ':' + pathname, request);
      }
      instrumentHtmlResponse(response);
    }
    return originalEmit.apply(this, arguments);
  };
}

module.exports = { ACTIVITY_PATH, CLIENT_PATH, CLIENT_SOURCE, injectActivityClient };
