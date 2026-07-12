(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AXMMarketCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var VERSION='0.1.0';
  var REQUIRED=['itemId','itemName','category','geography','observedAt','price','currency','unit','sourceId','sourceType'];
  var SIGNALS=['marketplaceActivity','searchInterest','sellerGrowth','tradeMovement','pricePressure'];

  function text(v){return String(v==null?'':v).trim();}
  function number(v){
    if(typeof v==='number')return Number.isFinite(v)?v:null;
    var s=text(v).replace(/\s/g,'').replace(/,(?=\d{1,2}$)/,'.');
    if(!s)return null;
    var n=Number(s);return Number.isFinite(n)?n:null;
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function dateValue(v){var d=new Date(v);return Number.isNaN(d.getTime())?null:d;}
  function monthKey(v){var d=dateValue(v);return d?d.toISOString().slice(0,7):'';}
  function median(values){
    var a=(values||[]).filter(function(v){return Number.isFinite(v);}).slice().sort(function(a,b){return a-b;});
    if(!a.length)return null;var m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
  }
  function mean(values){var a=(values||[]).filter(function(v){return Number.isFinite(v);});return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:null;}
  function mad(values){var m=median(values);if(m==null)return null;return median(values.map(function(v){return Math.abs(v-m);}));}
  function stableId(record){
    return [record.itemId,record.geography,record.observedAt,record.seller||'',record.sourceId,record.price,record.unit,record.quantity||1].join('|').toLowerCase();
  }
  function unitMeta(dictionary,unit){return dictionary&&dictionary.units&&dictionary.units[unit]||null;}
  function currencyMeta(dictionary,currency){return dictionary&&dictionary.currencies&&dictionary.currencies[currency]||null;}

  function normalizeObservation(input,dictionary){
    var raw=Object.assign({},input||{});var out={};
    Object.keys(raw).forEach(function(k){out[k]=raw[k];});
    REQUIRED.forEach(function(k){if(typeof out[k]==='string')out[k]=out[k].trim();});
    out.itemId=text(out.itemId).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');
    out.itemName=text(out.itemName);
    out.category=text(out.category).toLowerCase();
    out.geography=text(out.geography).toUpperCase();
    out.observedAt=text(out.observedAt);
    out.price=number(out.price);
    out.quantity=number(out.quantity);if(!(out.quantity>0))out.quantity=1;
    out.currency=text(out.currency).toUpperCase();
    out.unit=text(out.unit).toLowerCase();
    out.sourceId=text(out.sourceId);
    out.sourceType=text(out.sourceType).toLowerCase();
    out.seller=text(out.seller);
    out.availability=text(out.availability||'unknown').toLowerCase();
    out.sourceUrl=text(out.sourceUrl);
    out.notes=text(out.notes);
    out.fxRateToEur=number(out.fxRateToEur);
    out.popularity={};
    SIGNALS.forEach(function(s){
      var v=out.popularity&&out.popularity[s];
      if(v==null&&raw[s]!=null)v=raw[s];
      v=number(v);if(v!=null)out.popularity[s]=clamp(v,0,100);
    });
    var u=unitMeta(dictionary,out.unit);
    currencyMeta(dictionary,out.currency);
    if(u&&u.factorToBase>0){
      out.baseUnit=u.baseUnit;
      out.normalizedQuantity=out.quantity*u.factorToBase;
      out.unitPrice=out.price/out.normalizedQuantity;
    }else{
      out.baseUnit=out.unit;
      out.normalizedQuantity=out.quantity;
      out.unitPrice=out.price/out.quantity;
    }
    if(out.currency==='EUR')out.unitPriceEur=out.unitPrice;
    else if(out.fxRateToEur>0)out.unitPriceEur=out.unitPrice*out.fxRateToEur;
    else out.unitPriceEur=null;
    out.month=monthKey(out.observedAt);
    out.recordKey=stableId(out);
    out.raw=raw;
    return out;
  }

  function validateObservation(input,dictionary){
    var r=normalizeObservation(input,dictionary);var errors=[];var warnings=[];
    REQUIRED.forEach(function(k){if(r[k]==null||r[k]==='')errors.push(k+' is required');});
    if(!(r.price>=0))errors.push('price must be zero or higher');
    if(!dateValue(r.observedAt))errors.push('observedAt must be a valid date');
    if(dictionary&&dictionary.geographies&&!dictionary.geographies[r.geography])warnings.push('geography is not in the current dictionary');
    if(dictionary&&dictionary.categories&&dictionary.categories.indexOf(r.category)<0)warnings.push('category is not in the current dictionary');
    if(!unitMeta(dictionary,r.unit))warnings.push('unit is not normalized by the current dictionary');
    if(!currencyMeta(dictionary,r.currency))warnings.push('currency is not in the current dictionary');
    if(r.currency!=='EUR'&&!(r.fxRateToEur>0))warnings.push('non-EUR row cannot be compared in EUR without fxRateToEur');
    if(dictionary&&dictionary.sourceTypes&&!dictionary.sourceTypes[r.sourceType])warnings.push('sourceType is not in the current dictionary');
    if(r.sourceType==='demo')warnings.push('demo data is synthetic and must not be treated as market evidence');
    return{pass:errors.length===0,errors:errors,warnings:warnings,record:r};
  }

  function importRows(rows,dictionary,existing){
    var seen={};(existing||[]).forEach(function(r){seen[r.recordKey||stableId(r)]=1;});
    var accepted=[],rejected=[],duplicates=[];
    (rows||[]).forEach(function(row,index){
      var v=validateObservation(row,dictionary);
      if(!v.pass){rejected.push({index:index,row:row,errors:v.errors,warnings:v.warnings});return;}
      if(seen[v.record.recordKey]){duplicates.push({index:index,recordKey:v.record.recordKey});return;}
      seen[v.record.recordKey]=1;accepted.push(v.record);
    });
    return{accepted:accepted,rejected:rejected,duplicates:duplicates};
  }

  function filterPeriod(records,month,geography){
    return (records||[]).filter(function(r){
      return (!month||r.month===month)&&(!geography||geography==='ALL'||r.geography===geography);
    });
  }

  function aggregateItem(records,dictionary){
    var groups={};
    (records||[]).forEach(function(r){
      var k=[r.itemId,r.geography,r.month].join('|');
      if(!groups[k])groups[k]={itemId:r.itemId,itemName:r.itemName,category:r.category,geography:r.geography,month:r.month,records:[]};
      groups[k].records.push(r);
    });
    return Object.keys(groups).map(function(k){
      var g=groups[k];var eur=g.records.map(function(r){return r.unitPriceEur;}).filter(function(v){return Number.isFinite(v);});
      var raw=g.records.map(function(r){return r.unitPrice;}).filter(function(v){return Number.isFinite(v);});
      var currencies=Array.from(new Set(g.records.map(function(r){return r.currency;})));
      var units=Array.from(new Set(g.records.map(function(r){return r.baseUnit||r.unit;})));
      var signals={};SIGNALS.forEach(function(s){signals[s]=mean(g.records.map(function(r){return r.popularity&&r.popularity[s];}));});
      var sourceTypes=g.records.map(function(r){return r.sourceType;});
      var sourceTrust=mean(sourceTypes.map(function(s){return dictionary&&dictionary.sourceTypes&&dictionary.sourceTypes[s]?dictionary.sourceTypes[s].trust:0.35;}));
      var newest=g.records.map(function(r){return dateValue(r.observedAt);}).filter(Boolean).sort(function(a,b){return b-a;})[0]||null;
      var ageDays=newest?Math.max(0,(Date.now()-newest.getTime())/86400000):9999;
      var recency=ageDays<=31?1:ageDays<=92?.8:ageDays<=365?.5:.25;
      var sample=Math.min(1,g.records.length/5);
      var m=median(eur.length?eur:raw);var dispersion=m>0?mad(eur.length?eur:raw)/m:1;
      var consistency=clamp(1-dispersion,0,1);
      var confidence=clamp((sourceTrust||0)*.45+recency*.25+sample*.2+consistency*.1,0,1);
      return Object.assign(g,{
        count:g.records.length,
        sellerCount:new Set(g.records.map(function(r){return r.seller;}).filter(Boolean)).size,
        sourceCount:new Set(g.records.map(function(r){return r.sourceId;})).size,
        sourceTypes:Array.from(new Set(sourceTypes)),
        currencies:currencies,
        units:units,
        comparableEur:eur.length===g.records.length,
        medianUnitPriceEur:eur.length?median(eur):null,
        minUnitPriceEur:eur.length?Math.min.apply(null,eur):null,
        maxUnitPriceEur:eur.length?Math.max.apply(null,eur):null,
        medianUnitPrice:median(raw),
        signals:signals,
        confidence:Math.round(confidence*100),
        newestObservedAt:newest?newest.toISOString():null
      });
    });
  }

  function popularityScore(signals,weights){
    var total=0,used=0,parts={};
    SIGNALS.forEach(function(s){
      var v=number(signals&&signals[s]);var w=number(weights&&weights[s]);
      if(v!=null&&w>0){total+=v*w;used+=w;parts[s]={value:v,weight:w};}
    });
    return{score:used?total/used:null,coverage:used,parts:parts};
  }

  function rankPopularity(records,dictionary,month,geography){
    var filtered=filterPeriod(records,month,geography);var ag=aggregateItem(filtered,dictionary);var weights=dictionary&&dictionary.popularityWeights||{};
    var byItem={};
    ag.forEach(function(g){
      var k=g.itemId;if(!byItem[k])byItem[k]={itemId:g.itemId,itemName:g.itemName,category:g.category,groups:[],signalLists:{}};
      byItem[k].groups.push(g);SIGNALS.forEach(function(s){(byItem[k].signalLists[s]||(byItem[k].signalLists[s]=[])).push(g.signals[s]);});
    });
    var ranked=Object.keys(byItem).map(function(k){
      var x=byItem[k],signals={};SIGNALS.forEach(function(s){signals[s]=mean(x.signalLists[s]);});
      var p=popularityScore(signals,weights);var confidence=Math.round(mean(x.groups.map(function(g){return g.confidence;}))||0);
      return Object.assign(x,{signals:signals,score:p.score==null?null:Math.round(p.score*100)/100,coverage:Math.round(p.coverage*100)/100,confidence:confidence,observationCount:x.groups.reduce(function(a,g){return a+g.count;},0),geographies:Array.from(new Set(x.groups.map(function(g){return g.geography;})))});
    }).filter(function(x){return x.score!=null;});
    ranked.sort(function(a,b){return b.score-a.score||b.confidence-a.confidence||b.observationCount-a.observationCount;});
    ranked.forEach(function(x,i){x.rank=i+1;});return ranked;
  }

  function topByCategory(ranked,limit){
    var out={};(ranked||[]).forEach(function(x){if(!out[x.category])out[x.category]=[];if(out[x.category].length<(limit||10))out[x.category].push(x);});return out;
  }

  function compareGeographies(records,dictionary,itemId,month,geographies){
    var set=new Set((geographies||[]).map(function(x){return String(x).toUpperCase();}));
    return aggregateItem(filterPeriod(records,month,'ALL').filter(function(r){return r.itemId===itemId&&(!set.size||set.has(r.geography));}),dictionary)
      .sort(function(a,b){return (a.medianUnitPriceEur==null?Infinity:a.medianUnitPriceEur)-(b.medianUnitPriceEur==null?Infinity:b.medianUnitPriceEur);});
  }

  function buildReport(records,dictionary,opts){
    opts=opts||{};var month=opts.month||'';var geography=opts.geography||'ALL';
    var filtered=filterPeriod(records,month,geography);var ranked=rankPopularity(records,dictionary,month,geography);
    return{
      schema:'axm.geographic-market-report/0.1',
      generatedAt:new Date().toISOString(),
      scope:{month:month||'all',geography:geography},
      evidence:{observations:filtered.length,sources:new Set(filtered.map(function(r){return r.sourceId;})).size,items:new Set(filtered.map(function(r){return r.itemId;})).size},
      top100:ranked.slice(0,100),
      top10ByCategory:topByCategory(ranked,10),
      noFakeDone:'Ranking covers only imported observations and connected sources. Missing markets are not silently estimated.'
    };
  }

  return{VERSION:VERSION,REQUIRED:REQUIRED,SIGNALS:SIGNALS,number:number,median:median,mean:mean,mad:mad,monthKey:monthKey,stableId:stableId,normalizeObservation:normalizeObservation,validateObservation:validateObservation,importRows:importRows,filterPeriod:filterPeriod,aggregateItem:aggregateItem,popularityScore:popularityScore,rankPopularity:rankPopularity,topByCategory:topByCategory,compareGeographies:compareGeographies,buildReport:buildReport};
});
