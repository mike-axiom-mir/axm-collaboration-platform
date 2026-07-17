(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AXMFinanceCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var VERSION='0.1';
  function num(v){var n=Number(v);return Number.isFinite(n)?n:null;}
  function text(v){return String(v==null?'':v).trim();}
  function key(r){return [r.indicatorId,r.geography,r.period,r.sourceId].join('|').toLowerCase();}
  function validateObservation(raw,dictionary){
    var r=raw||{},errors=[],warnings=[];var indicatorId=text(r.indicatorId),geo=text(r.geography).toUpperCase(),period=text(r.period),sourceId=text(r.sourceId),value=num(r.value);
    var known=dictionary&&dictionary.indicators&&dictionary.indicators[indicatorId];
    if(!indicatorId)errors.push('indicatorId required');if(!/^[A-Z]{3}$/.test(geo))errors.push('geography must be ISO3');
    if(!/^\d{4}$/.test(period))errors.push('period must be a four-digit year');if(value===null)errors.push('value must be numeric');if(!sourceId)errors.push('sourceId required');
    var unit=text(r.unit||(known&&known.unit));if(!unit)errors.push('unit required');
    var sourceType=text(r.sourceType);if(!sourceType)errors.push('sourceType required');
    if(!known&&!text(r.indicatorName))warnings.push('custom indicator has no display name');
    var out={indicatorId:indicatorId,indicatorName:text(r.indicatorName||(known&&known.name)||indicatorId),geography:geo,countryName:text(r.countryName),period:period,value:value,unit:unit,sourceId:sourceId,sourceType:sourceType,sourceUrl:text(r.sourceUrl),retrievedAt:text(r.retrievedAt)||new Date().toISOString(),observationStatus:text(r.observationStatus)||'observed',notes:text(r.notes)};
    out.key=key(out);return{pass:errors.length===0,errors:errors,warnings:warnings,record:out};
  }
  function importRows(rows,dictionary,existing){
    var accepted=[],rejected=[],duplicates=[],seen=new Set((existing||[]).map(key));
    (rows||[]).forEach(function(row,index){var v=validateObservation(row,dictionary);if(!v.pass){rejected.push({index:index,errors:v.errors,row:row});return;}if(seen.has(v.record.key)){duplicates.push({index:index,key:v.record.key});return;}seen.add(v.record.key);accepted.push(v.record);});
    return{accepted:accepted,rejected:rejected,duplicates:duplicates};
  }
  function sortedPeriods(records){return Array.from(new Set((records||[]).map(function(r){return r.period;}))).sort();}
  function exactMap(records,indicatorId,period){var out={};(records||[]).filter(function(r){return r.indicatorId===indicatorId&&r.period===period;}).forEach(function(r){out[r.geography]=r;});return out;}
  function percentile(values,value){if(!values.length)return null;if(values.length===1)return 50;var sorted=values.slice().sort(function(a,b){return a-b;}),below=sorted.filter(function(x){return x<value;}).length,equal=sorted.filter(function(x){return x===value;}).length;return 100*(below+(equal-1)/2)/(sorted.length-1);}
  function lensScores(records,dictionary,lensId,period){
    var lens=dictionary.lenses[lensId];if(!lens)return{};var exact={};lens.components.forEach(function(c){exact[c.indicatorId]=exactMap(records,c.indicatorId,period);});var geos=new Set();Object.keys(exact).forEach(function(id){Object.keys(exact[id]).forEach(function(g){geos.add(g);});});var result={};
    geos.forEach(function(geo){var weighted=0,totalWeight=0,used=[];lens.components.forEach(function(c){var rec=exact[c.indicatorId][geo];if(!rec)return;var vals=Object.values(exact[c.indicatorId]).map(function(x){return x.value;});var p=percentile(vals,rec.value);if(c.direction==='low')p=100-p;weighted+=p*c.weight;totalWeight+=c.weight;used.push({indicatorId:c.indicatorId,value:rec.value,percentile:p,weight:c.weight,direction:c.direction});});if(used.length>=(lens.minimumComponents||1)){result[geo]={value:totalWeight?weighted/totalWeight:null,coverage:used.length/lens.components.length,components:used,period:period};}});return result;
  }
  function quantileBreaks(values,bins){var sorted=(values||[]).filter(Number.isFinite).sort(function(a,b){return a-b;});if(!sorted.length)return[];var n=bins||5,out=[];for(var i=1;i<n;i++){var ix=Math.min(sorted.length-1,Math.floor(i*sorted.length/n));out.push(sorted[ix]);}return out;}
  function bin(value,breaks){if(!Number.isFinite(value))return-1;var i=0;while(i<breaks.length&&value>=breaks[i])i++;return i;}
  function summary(records,indicatorId,period){var rows=(records||[]).filter(function(r){return r.indicatorId===indicatorId&&r.period===period;}),vals=rows.map(function(r){return r.value;}).sort(function(a,b){return a-b;});return{rows:rows.length,countries:new Set(rows.map(function(r){return r.geography;})).size,sources:new Set(rows.map(function(r){return r.sourceId;})).size,min:vals.length?vals[0]:null,max:vals.length?vals[vals.length-1]:null,median:vals.length?vals[Math.floor(vals.length/2)]:null};}
  function quality(records){var rows=records||[],official=rows.filter(function(r){return r.sourceType==='official-statistics';}).length,forecast=rows.filter(function(r){return r.observationStatus==='forecast';}).length,years=sortedPeriods(rows);return{rows:rows.length,countries:new Set(rows.map(function(r){return r.geography;})).size,indicators:new Set(rows.map(function(r){return r.indicatorId;})).size,sources:new Set(rows.map(function(r){return r.sourceId;})).size,officialShare:rows.length?official/rows.length:0,forecastRows:forecast,firstYear:years[0]||null,lastYear:years[years.length-1]||null};}
  return{VERSION:VERSION,validateObservation:validateObservation,importRows:importRows,sortedPeriods:sortedPeriods,exactMap:exactMap,lensScores:lensScores,quantileBreaks:quantileBreaks,bin:bin,summary:summary,quality:quality,key:key};
});
