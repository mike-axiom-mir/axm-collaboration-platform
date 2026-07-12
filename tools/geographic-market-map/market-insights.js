(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AXMMarketInsights=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var VERSION='0.2.0';
  var SIGNALS=['marketplaceActivity','searchInterest','sellerGrowth','tradeMovement','pricePressure'];

  function num(v){var n=Number(v);return Number.isFinite(n)?n:null;}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function mean(values){var a=(values||[]).filter(Number.isFinite);return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:null;}
  function median(values){var a=(values||[]).filter(Number.isFinite).slice().sort(function(a,b){return a-b;});if(!a.length)return null;var m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
  function monthKey(v){return String(v||'').slice(0,7);}
  function ageDays(v,now){var d=new Date(v);if(Number.isNaN(d.getTime()))return Infinity;return Math.max(0,((now||Date.now())-d.getTime())/86400000);}
  function scopeRecords(records,opts){
    opts=opts||{};return(records||[]).filter(function(r){
      return(!opts.month||monthKey(r.observedAt||r.month)===opts.month)&&(!opts.geography||opts.geography==='ALL'||r.geography===opts.geography);
    });
  }
  function issue(severity,code,message,record){return{severity:severity,code:code,message:message,recordKey:record&&record.recordKey||'',itemId:record&&record.itemId||'',sourceId:record&&record.sourceId||''};}
  function sourceTrust(dictionary,type){return dictionary&&dictionary.sourceTypes&&dictionary.sourceTypes[type]?Number(dictionary.sourceTypes[type].trust)||0:0;}
  function sourceClass(dictionary,type){var t=sourceTrust(dictionary,type);return t>=.95?'official':t>=.75?'documented':t>=.5?'observed':'weak';}

  function outlierIssues(rows){
    var groups={};(rows||[]).forEach(function(r){
      if(!Number.isFinite(r.unitPriceEur))return;
      var k=[r.itemId,r.geography,r.month||monthKey(r.observedAt),r.baseUnit||r.unit].join('|');
      (groups[k]||(groups[k]=[])).push(r);
    });
    var out=[];
    Object.keys(groups).forEach(function(k){
      var g=groups[k];if(g.length<3)return;
      var values=g.map(function(r){return r.unitPriceEur;});var m=median(values);
      var dev=median(values.map(function(v){return Math.abs(v-m);}))||0;
      g.forEach(function(r){
        var delta=Math.abs(r.unitPriceEur-m);
        var flagged=dev>0?delta>3*dev:(m>0&&delta/m>.5);
        if(flagged)out.push(issue('warning','price-outlier','Price is far from the group median; verify pack size, unit and source.',r));
      });
    });
    return out;
  }

  function qualityReport(records,dictionary,opts){
    opts=opts||{};var rows=scopeRecords(records,opts);var issues=[];var now=opts.now||Date.now();
    var staleWarning=(dictionary&&dictionary.qualityThresholds&&dictionary.qualityThresholds.staleWarningDays)||92;
    var staleCritical=(dictionary&&dictionary.qualityThresholds&&dictionary.qualityThresholds.staleCriticalDays)||365;
    rows.forEach(function(r){
      if(r.sourceType==='demo')issues.push(issue('critical','synthetic-demo','Synthetic demo row cannot support a real market claim.',r));
      if(!Number.isFinite(r.unitPriceEur))issues.push(issue('critical','not-eur-comparable','No comparable EUR unit price; add an explicit FX rate or keep this row outside comparisons.',r));
      if(!dictionary.geographies[r.geography])issues.push(issue('critical','unknown-geography','Geography is not present in the shared dictionary.',r));
      if(dictionary.categories.indexOf(r.category)<0)issues.push(issue('warning','unknown-category','Category is not present in the shared dictionary.',r));
      if(!dictionary.units[r.unit])issues.push(issue('critical','unknown-unit','Unit cannot be normalized by the shared dictionary.',r));
      if(!dictionary.sourceTypes[r.sourceType])issues.push(issue('critical','unknown-source-type','Source type is not present in the shared dictionary.',r));
      var age=ageDays(r.observedAt,now);
      if(age>staleCritical)issues.push(issue('critical','very-stale','Observation is more than '+staleCritical+' days old.',r));
      else if(age>staleWarning)issues.push(issue('warning','stale','Observation is more than '+staleWarning+' days old.',r));
      if(!r.seller)issues.push(issue('info','missing-seller','Seller or reporting entity is not recorded.',r));
      if(!r.sourceUrl&&sourceClass(dictionary,r.sourceType)!=='official')issues.push(issue('info','missing-source-url','No source URL is recorded for this non-official observation.',r));
      var sig=SIGNALS.filter(function(s){return r.popularity&&Number.isFinite(r.popularity[s]);}).length;
      if(sig===0)issues.push(issue('info','no-popularity-signals','This row can support price mapping but not popularity ranking.',r));
    });
    issues=issues.concat(outlierIssues(rows));
    var weights={critical:12,warning:4,info:1};var penalty=issues.reduce(function(a,x){return a+(weights[x.severity]||1);},0);
    var official=rows.filter(function(r){return sourceClass(dictionary,r.sourceType)==='official';}).length;
    var fresh=rows.filter(function(r){return ageDays(r.observedAt,now)<=staleWarning;}).length;
    var comparable=rows.filter(function(r){return Number.isFinite(r.unitPriceEur);}).length;
    var demo=rows.filter(function(r){return r.sourceType==='demo';}).length;
    var score=rows.length?Math.round(clamp(100-penalty/Math.max(1,rows.length),0,100)):0;
    return{
      version:VERSION,scope:{month:opts.month||'all',geography:opts.geography||'ALL'},
      metrics:{rows:rows.length,items:new Set(rows.map(function(r){return r.itemId;})).size,sources:new Set(rows.map(function(r){return r.sourceId;})).size,officialShare:rows.length?official/rows.length:0,freshShare:rows.length?fresh/rows.length:0,comparableShare:rows.length?comparable/rows.length:0,demoRows:demo,qualitySignal:score},
      counts:{critical:issues.filter(function(x){return x.severity==='critical';}).length,warning:issues.filter(function(x){return x.severity==='warning';}).length,info:issues.filter(function(x){return x.severity==='info';}).length},
      issues:issues,
      note:'Quality Signal is a diagnostic completeness score, not proof that the market claim is true.'
    };
  }

  function aggregateSignals(rows){
    var out={};SIGNALS.forEach(function(s){out[s]=mean(rows.map(function(r){return r.popularity&&num(r.popularity[s]);}));});return out;
  }
  function confidenceFromRows(rows,dictionary){
    if(!rows.length)return 0;
    var trust=mean(rows.map(function(r){return sourceTrust(dictionary,r.sourceType);}))||0;
    var sourceDiversity=Math.min(1,new Set(rows.map(function(r){return r.sourceId;})).size/3);
    var geographyDiversity=Math.min(1,new Set(rows.map(function(r){return r.geography;})).size/3);
    return Math.round(clamp((trust*.6+sourceDiversity*.25+geographyDiversity*.15)*100,0,100));
  }
  function card(type,itemId,title,summary,why,invalidation,rows,extra,dictionary){
    return Object.assign({
      id:[type,itemId,(extra&&extra.month)||'all',(extra&&extra.geographies||[]).join('-')].join(':'),
      type:type,itemId:itemId,title:title,summary:summary,why:why,invalidation:invalidation,
      evidenceCount:rows.length,sourceCount:new Set(rows.map(function(r){return r.sourceId;})).size,
      confidence:confidenceFromRows(rows,dictionary),geographies:Array.from(new Set(rows.map(function(r){return r.geography;}))),
      severity:'observe'
    },extra||{});
  }

  function detectPatterns(records,dictionary,opts){
    opts=opts||{};var rows=scopeRecords(records,opts);var byItem={};rows.forEach(function(r){(byItem[r.itemId]||(byItem[r.itemId]=[])).push(r);});
    var thresholds=dictionary.patternThresholds||{};var spreadThreshold=thresholds.geographicSpreadPct||12;var demandThreshold=thresholds.highDemandSignal||70;var alignmentThreshold=thresholds.signalAlignment||70;var monthMoveThreshold=thresholds.monthlyMovePct||8;
    var patterns=[];
    Object.keys(byItem).forEach(function(itemId){
      var itemRows=byItem[itemId],name=itemRows[0].itemName||itemId,signals=aggregateSignals(itemRows);
      var geo={};itemRows.forEach(function(r){if(Number.isFinite(r.unitPriceEur))(geo[r.geography]||(geo[r.geography]=[])).push(r.unitPriceEur);});
      var medians=Object.keys(geo).map(function(g){return{g:g,v:median(geo[g])};}).filter(function(x){return Number.isFinite(x.v)&&x.v>0;}).sort(function(a,b){return a.v-b.v;});
      if(medians.length>=2){
        var low=medians[0],high=medians[medians.length-1],spread=(high.v-low.v)/low.v*100;
        if(spread>=spreadThreshold){
          var p=card('geographic-price-gap',itemId,name+' shows a geographic price gap',
            high.g+' is '+spread.toFixed(1)+'% above '+low.g+' on comparable median unit price.',
            'A persistent spread can point to timing, logistics, taxes, scarcity, pack-size mistakes or different market structure.',
            'The gap disappears after matching exact product grade, date, tax, shipping and unit.',itemRows,{spreadPct:spread,low:low,high:high,severity:spread>=25?'strong':'observe'},dictionary);patterns.push(p);
        }
      }
      var demand=mean([signals.marketplaceActivity,signals.searchInterest].filter(Number.isFinite));
      var constrained=itemRows.filter(function(r){return r.availability==='low_stock'||r.availability==='out_of_stock'||r.availability==='preorder';}).length/itemRows.length;
      if(Number.isFinite(demand)&&demand>=demandThreshold&&constrained>=.25){
        patterns.push(card('demand-supply-pressure',itemId,name+' has demand with constrained availability',
          'Average demand signal is '+demand.toFixed(1)+' while '+Math.round(constrained*100)+'% of observations report constrained availability.',
          'Demand rising against limited availability can precede price movement or substitution.',
          'More complete inventory data shows normal availability, or the demand signal is promotional noise.',itemRows,{demand:demand,constrainedShare:constrained,severity:demand>=85&&constrained>=.5?'strong':'observe'},dictionary));
      }
      var aligned=SIGNALS.filter(function(s){return Number.isFinite(signals[s])&&signals[s]>=alignmentThreshold;});
      if(aligned.length>=3){
        patterns.push(card('signal-alignment',itemId,name+' has '+aligned.length+' aligned signals',
          aligned.join(', ')+' are all at or above '+alignmentThreshold+'.',
          'Several independent-looking channels moving together deserve review before a single-channel spike.',
          'The channels share one underlying source, use stale data, or reverse in the next period.',itemRows,{signals:signals,aligned:aligned,severity:aligned.length>=4?'strong':'observe'},dictionary));
      }
      var monthGroups={};itemRows.forEach(function(r){if(Number.isFinite(r.unitPriceEur))(monthGroups[monthKey(r.observedAt)]||(monthGroups[monthKey(r.observedAt)]=[])).push(r.unitPriceEur);});
      var months=Object.keys(monthGroups).sort();if(months.length>=2){
        var prev=months[months.length-2],latest=months[months.length-1],pv=median(monthGroups[prev]),lv=median(monthGroups[latest]);
        if(pv>0&&Number.isFinite(lv)){var move=(lv-pv)/pv*100;if(Math.abs(move)>=monthMoveThreshold){
          patterns.push(card('monthly-price-move',itemId,name+' moved '+(move>=0?'+':'')+move.toFixed(1)+'% month over month',
            'Comparable median moved from '+prev+' to '+latest+'.',
            'A material monthly move can expose transmission timing across products, geographies and companies.',
            'The change is caused by product mix, tax, currency, one outlier source or revised data.',itemRows,{movePct:move,previousMonth:prev,latestMonth:latest,severity:Math.abs(move)>=15?'strong':'observe'},dictionary));
        }}
      }
    });
    patterns.sort(function(a,b){var sev={strong:2,observe:1};return(sev[b.severity]-sev[a.severity])||(b.confidence-a.confidence)||(b.evidenceCount-a.evidenceCount);});
    return patterns;
  }

  function timeline(records,itemId,geographies){
    var set=new Set(geographies||[]),groups={};
    (records||[]).filter(function(r){return r.itemId===itemId&&Number.isFinite(r.unitPriceEur)&&(!set.size||set.has(r.geography));}).forEach(function(r){
      var m=monthKey(r.observedAt);var k=r.geography+'|'+m;(groups[k]||(groups[k]={geography:r.geography,month:m,values:[]})).values.push(r.unitPriceEur);
    });
    return Object.keys(groups).map(function(k){var g=groups[k];return{geography:g.geography,month:g.month,medianUnitPriceEur:median(g.values),count:g.values.length};}).sort(function(a,b){return a.month.localeCompare(b.month)||a.geography.localeCompare(b.geography);});
  }

  function sourceCoverage(records,dictionary,opts){
    var rows=scopeRecords(records,opts),by={};rows.forEach(function(r){var k=r.sourceType||'unknown';if(!by[k])by[k]={sourceType:k,rows:0,sources:new Set(),items:new Set(),trust:sourceTrust(dictionary,k)};by[k].rows++;by[k].sources.add(r.sourceId);by[k].items.add(r.itemId);});
    return Object.keys(by).map(function(k){var x=by[k];return{sourceType:k,rows:x.rows,sources:x.sources.size,items:x.items.size,trust:x.trust,className:sourceClass(dictionary,k)};}).sort(function(a,b){return b.rows-a.rows;});
  }

  return{VERSION:VERSION,qualityReport:qualityReport,detectPatterns:detectPatterns,timeline:timeline,sourceCoverage:sourceCoverage,scopeRecords:scopeRecords};
});
