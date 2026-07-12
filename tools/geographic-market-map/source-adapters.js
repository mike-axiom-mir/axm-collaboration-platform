(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AXMMarketSources=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function parseCsv(text){
    var rows=[],row=[],cell='',quoted=false;var s=String(text||'');
    for(var i=0;i<s.length;i++){
      var c=s[i],n=s[i+1];
      if(c==='"'&&quoted&&n==='"'){cell+='"';i++;continue;}
      if(c==='"'){quoted=!quoted;continue;}
      if(c===','&&!quoted){row.push(cell);cell='';continue;}
      if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);cell='';if(row.some(function(x){return x!=='';}))rows.push(row);row=[];continue;}
      cell+=c;
    }
    row.push(cell);if(row.some(function(x){return x!=='';}))rows.push(row);
    if(!rows.length)return[];var headers=rows.shift().map(function(h){return h.trim();});
    return rows.map(function(r){var o={};headers.forEach(function(h,j){o[h]=r[j]==null?'':r[j];});return o;});
  }

  function parseJson(text){
    var data=typeof text==='string'?JSON.parse(text):text;
    if(Array.isArray(data))return data;
    if(data&&Array.isArray(data.records))return data.records;
    if(data&&Array.isArray(data.observations))return data.observations;
    throw new Error('JSON must be an array or contain records/observations');
  }

  function parse(text,filename){
    var name=String(filename||'').toLowerCase();
    if(name.endsWith('.csv'))return parseCsv(text);
    if(name.endsWith('.json'))return parseJson(text);
    try{return parseJson(text);}catch(e){return parseCsv(text);}
  }

  async function sha256(text){
    if(typeof crypto==='undefined'||!crypto.subtle)return null;
    var bytes=new TextEncoder().encode(String(text||''));var hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }

  function schemaCsv(){
    return [
      'itemId,itemName,category,geography,observedAt,price,currency,unit,quantity,seller,availability,sourceId,sourceType,sourceUrl,marketplaceActivity,searchInterest,sellerGrowth,tradeMovement,pricePressure,notes',
      'copper-cable,Copper cable,construction,NL,2026-07-01,14.95,EUR,kg,1,Example seller,in_stock,source-001,retailer-manual,,72,61,55,48,66,Replace this example with sourced evidence'
    ].join('\n');
  }

  return{parseCsv:parseCsv,parseJson:parseJson,parse:parse,sha256:sha256,schemaCsv:schemaCsv};
});
