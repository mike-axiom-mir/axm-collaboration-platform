(function(root){
  'use strict';
  function request(url,options){return fetch(url,options).then(async function(response){var body;try{body=await response.json();}catch(_){body={ok:false,error:'Server returned non-JSON data'};}if(!response.ok||body.ok===false)throw new Error(body.error||('HTTP '+response.status));return body.result;});}
  function get(url){return request(url);}
  function post(url,data,headers){return request(url,{method:'POST',headers:Object.assign({'content-type':'application/json'},headers||{}),body:JSON.stringify(data||{})});}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];});}
  function bytes(value){var n=Number(value)||0,units=['B','KB','MB','GB'],i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return (i?n.toFixed(n>=10?1:2):Math.round(n))+' '+units[i];}
  function date(value){if(!value)return '—';try{return new Date(value).toLocaleString();}catch(_){return String(value);}}
  function notice(node,text,tone){node.className='notice '+(tone||'');node.textContent=text;node.classList.remove('hidden');}
  function pretty(value){return JSON.stringify(value,null,2);}
  root.AXMOps={request:request,get:get,post:post,esc:esc,bytes:bytes,date:date,notice:notice,pretty:pretty};
})(window);

