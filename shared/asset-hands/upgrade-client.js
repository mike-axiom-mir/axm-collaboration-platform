(function(root,factory){var api=factory(root&&root.fetch?root.fetch.bind(root):null);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.AXMAssetHandUpgradeClient=api;})(typeof globalThis!=='undefined'?globalThis:this,function(defaultFetch){
'use strict';
var BASE='/api/asset-hands/upgrades',SUBSTRATE_BASE='/api/asset-hands/substrates';
function transport(custom){var call=custom||defaultFetch;if(typeof call!=='function')throw Error('fetch transport required');return call;}
function decode(response){if(!response||typeof response.json!=='function')throw Error('invalid upgrade registry response');return response.json().then(function(body){if(!response.ok||!body.ok)throw Error(body&&body.error||('HTTP '+response.status));return body;});}
function list(customFetch){return transport(customFetch)(BASE,{cache:'no-store'}).then(decode).then(function(body){return body.hands;});}
function audit(customFetch){return transport(customFetch)(BASE+'/audit',{cache:'no-store'}).then(decode).then(function(body){return body.audit;});}
function substrates(customFetch){return transport(customFetch)(SUBSTRATE_BASE,{cache:'no-store'}).then(decode).then(function(body){return body.inventory;});}
function post(route,request,customFetch){return transport(customFetch)(BASE+'/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request||{})}).then(decode).then(function(body){return body.result;});}
function diagnose(request,customFetch){return post('diagnose',request,customFetch);}
function plan(request,customFetch){return post('plan',request,customFetch);}
return{VERSION:'1.1.0',BASE:BASE,SUBSTRATE_BASE:SUBSTRATE_BASE,list:list,audit:audit,substrates:substrates,diagnose:diagnose,plan:plan};
});
