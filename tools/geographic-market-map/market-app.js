(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var VIEWS=['Overview','Patterns','Rankings','Compare','Data','Quality','Watchlist','Evidence','Export'];
var state={records:[],imports:[],watchlist:[],dictionary:null,pending:null,activeView:'Overview'};
var COLORS={NL:'#4bdce8',HR:'#f0bd5c',EU:'#b99cff'};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function fmt(v,d){return Number.isFinite(v)?Number(v).toFixed(d==null?2:d):'—';}
function pct(v){return Number.isFinite(v)?Math.round(v*100)+'%':'—';}
function money(v,unit){return Number.isFinite(v)?'€'+fmt(v,2)+' / '+esc(unit||'unit'):'not comparable';}
function currentMonth(){return $('scopeMonth').value;}
function currentGeo(){return $('scopeGeo').value||'ALL';}
function currentItem(){return $('scopeItem').value||'';}
function gate(action,detail){if(!window.AXMGate||!AXMGate.submit)return{allow:true};return AXMGate.submit({action:action,actor:'human-user',actorType:'human',tool:'geographic-market-map',detail:detail||{}});}
function setStatus(t,kind){$('status').textContent=t;$('bootPill').className='pill '+(kind||'ready');}
function download(name,content,type){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:type||'application/json'}));a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1200);}
function scoped(){return AXMMarketInsights.scopeRecords(state.records,{month:currentMonth(),geography:currentGeo()});}
function quality(){return AXMMarketInsights.qualityReport(state.records,state.dictionary,{month:currentMonth(),geography:currentGeo()});}
function patterns(){return AXMMarketInsights.detectPatterns(state.records,state.dictionary,{month:currentMonth(),geography:currentGeo()});}
function ranked(){return AXMMarketCore.rankPopularity(state.records,state.dictionary,currentMonth(),currentGeo());}
function geoname(code){return state.dictionary.geographies[code]?state.dictionary.geographies[code].name:code;}
function severityClass(v){return v==='strong'?'strong':v==='critical'?'critical':'observe';}
function diagnosticClass(v){return v>=75?'goodtext':v>=45?'warntext':'badtext';}
function switchView(name){state.activeView=name;VIEWS.forEach(function(v){$('view'+v).classList.toggle('hidden',v!==name);$('tab'+v).classList.toggle('on',v===name);});if(name==='Export')renderStatus();if(name==='Quality')renderQuality();if(name==='Watchlist')renderWatchlist();}

function populateStatic(){
  var d=state.dictionary,active=Object.keys(d.geographies).filter(function(k){return d.geographies[k].active;});
  $('scopeGeo').innerHTML='<option value="ALL">All active geographies</option>'+active.map(function(k){return'<option value="'+k+'">'+esc(d.geographies[k].name)+'</option>';}).join('');
  $('mGeo').innerHTML=active.map(function(k){return'<option value="'+k+'">'+esc(d.geographies[k].name)+'</option>';}).join('');
  $('mCategory').innerHTML=d.categories.map(function(x){return'<option>'+esc(x)+'</option>';}).join('');
  $('mCurrency').innerHTML=Object.keys(d.currencies).map(function(x){return'<option value="'+x+'">'+x+(d.currencies[x].active?'':' · planned')+'</option>';}).join('');
  $('mUnit').innerHTML=Object.keys(d.units).map(function(x){return'<option>'+x+'</option>';}).join('');
  $('mAvailability').innerHTML=d.availabilityValues.map(function(x){return'<option>'+x+'</option>';}).join('');
  $('mSourceType').innerHTML=Object.keys(d.sourceTypes).map(function(x){return'<option value="'+x+'">'+esc(d.sourceTypes[x].label)+'</option>';}).join('');
  $('mDate').value=new Date().toISOString().slice(0,10);$('scopeMonth').value=new Date().toISOString().slice(0,7);
}
function refreshItemSelect(){
  var old=currentItem(),items={};state.records.forEach(function(r){items[r.itemId]=r.itemName;});
  var keys=Object.keys(items).sort(function(a,b){return items[a].localeCompare(items[b]);});
  var options=keys.map(function(k){return'<option value="'+esc(k)+'">'+esc(items[k])+'</option>';}).join('');
  $('scopeItem').innerHTML=options||'<option value="">No items imported</option>';
  $('watchItem').innerHTML=options||'<option value="">No items imported</option>';
  if(old&&items[old])$('scopeItem').value=old;
}

function demoRows(){
  var month=currentMonth()||new Date().toISOString().slice(0,7),d=month+'-01';
  return[
    {itemId:'copper-cable',itemName:'Copper cable',category:'construction',geography:'NL',observedAt:d,price:15.4,currency:'EUR',unit:'kg',quantity:1,seller:'DEMO NL A',availability:'in_stock',sourceId:'demo-nl-1',sourceType:'demo',marketplaceActivity:76,searchInterest:68,sellerGrowth:55,tradeMovement:62,pricePressure:71,notes:'Synthetic demonstration row'},
    {itemId:'copper-cable',itemName:'Copper cable',category:'construction',geography:'HR',observedAt:d,price:14.2,currency:'EUR',unit:'kg',quantity:1,seller:'DEMO HR A',availability:'low_stock',sourceId:'demo-hr-1',sourceType:'demo',marketplaceActivity:70,searchInterest:64,sellerGrowth:48,tradeMovement:59,pricePressure:66,notes:'Synthetic demonstration row'},
    {itemId:'copper-cable',itemName:'Copper cable',category:'construction',geography:'EU',observedAt:d,price:14.8,currency:'EUR',unit:'kg',quantity:1,seller:'DEMO EU',availability:'unknown',sourceId:'demo-eu-1',sourceType:'demo',marketplaceActivity:73,searchInterest:67,sellerGrowth:52,tradeMovement:65,pricePressure:69,notes:'Synthetic demonstration row'},
    {itemId:'coffee-beans',itemName:'Coffee beans',category:'food',geography:'NL',observedAt:d,price:18.5,currency:'EUR',unit:'kg',quantity:1,seller:'DEMO NL B',availability:'in_stock',sourceId:'demo-nl-2',sourceType:'demo',marketplaceActivity:82,searchInterest:79,sellerGrowth:61,tradeMovement:53,pricePressure:74,notes:'Synthetic demonstration row'},
    {itemId:'coffee-beans',itemName:'Coffee beans',category:'food',geography:'HR',observedAt:d,price:17.1,currency:'EUR',unit:'kg',quantity:1,seller:'DEMO HR B',availability:'in_stock',sourceId:'demo-hr-2',sourceType:'demo',marketplaceActivity:78,searchInterest:72,sellerGrowth:57,tradeMovement:51,pricePressure:68,notes:'Synthetic demonstration row'},
    {itemId:'cement-bag',itemName:'Cement',category:'construction',geography:'NL',observedAt:d,price:8.9,currency:'EUR',unit:'kg',quantity:25,seller:'DEMO NL C',availability:'in_stock',sourceId:'demo-nl-3',sourceType:'demo',marketplaceActivity:58,searchInterest:54,sellerGrowth:49,tradeMovement:44,pricePressure:63,notes:'Synthetic demonstration row'},
    {itemId:'cement-bag',itemName:'Cement',category:'construction',geography:'HR',observedAt:d,price:7.6,currency:'EUR',unit:'kg',quantity:25,seller:'DEMO HR C',availability:'low_stock',sourceId:'demo-hr-3',sourceType:'demo',marketplaceActivity:66,searchInterest:60,sellerGrowth:56,tradeMovement:48,pricePressure:70,notes:'Synthetic demonstration row'},
    {itemId:'gaming-handheld',itemName:'Gaming handheld',category:'gaming',geography:'NL',observedAt:d,price:329,currency:'EUR',unit:'item',quantity:1,seller:'DEMO NL D',availability:'in_stock',sourceId:'demo-nl-4',sourceType:'demo',marketplaceActivity:88,searchInterest:90,sellerGrowth:73,tradeMovement:42,pricePressure:60,notes:'Synthetic demonstration row'},
    {itemId:'gaming-handheld',itemName:'Gaming handheld',category:'gaming',geography:'HR',observedAt:d,price:349,currency:'EUR',unit:'item',quantity:1,seller:'DEMO HR D',availability:'preorder',sourceId:'demo-hr-4',sourceType:'demo',marketplaceActivity:84,searchInterest:86,sellerGrowth:69,tradeMovement:39,pricePressure:64,notes:'Synthetic demonstration row'},
    {itemId:'electricity-household',itemName:'Household electricity',category:'energy',geography:'NL',observedAt:d,price:.31,currency:'EUR',unit:'kwh',quantity:1,seller:'DEMO NL E',availability:'in_stock',sourceId:'demo-nl-5',sourceType:'demo',marketplaceActivity:48,searchInterest:74,sellerGrowth:20,tradeMovement:58,pricePressure:82,notes:'Synthetic demonstration row'},
    {itemId:'electricity-household',itemName:'Household electricity',category:'energy',geography:'HR',observedAt:d,price:.19,currency:'EUR',unit:'kwh',quantity:1,seller:'DEMO HR E',availability:'in_stock',sourceId:'demo-hr-5',sourceType:'demo',marketplaceActivity:44,searchInterest:69,sellerGrowth:18,tradeMovement:55,pricePressure:77,notes:'Synthetic demonstration row'}
  ];
}

function renderSummary(){
  var rows=scoped(),q=quality(),p=patterns(),r=ranked();
  var cards=[
    ['Evidence rows',rows.length,'raw observations in scope'],
    ['Observed items',new Set(rows.map(function(x){return x.itemId;})).size,'distinct item identities'],
    ['Source IDs',new Set(rows.map(function(x){return x.sourceId;})).size,'traceable sources'],
    ['EUR comparable',Math.round(q.metrics.comparableShare*100)+'%','normalized comparison coverage'],
    ['Pattern candidates',p.length,'review questions, not predictions'],
    ['Ranked items',r.length,'items with popularity signals']
  ];
  $('summaryStats').innerHTML=cards.map(function(x){return'<div class="kpi"><b>'+x[1]+'</b><small>'+x[0]+'</small><div class="delta">'+esc(x[2])+'</div></div>';}).join('');
  $('qualityGauge').style.setProperty('--score',q.metrics.qualitySignal);$('qualityScore').textContent=q.metrics.qualitySignal;
  $('qualityLabel').textContent=q.metrics.rows?(q.metrics.qualitySignal>=75?'Stronger diagnostic coverage':q.metrics.qualitySignal>=45?'Partial diagnostic coverage':'Weak diagnostic coverage'):'No evidence yet';
  $('qualityNote').textContent=q.note;
  $('qualityMini').innerHTML=[['Official',pct(q.metrics.officialShare)],['Fresh',pct(q.metrics.freshShare)],['Critical',q.counts.critical],['Warnings',q.counts.warning]].map(function(x){return'<div class="kpi"><b>'+x[1]+'</b><small>'+x[0]+'</small></div>';}).join('');
  $('scopeReadout').textContent='Scope: '+(currentMonth()||'all months')+' · '+(currentGeo()==='ALL'?'all active geographies':geoname(currentGeo()))+' · '+rows.length+' rows'+(q.metrics.demoRows?' · '+q.metrics.demoRows+' demo rows present':' · no demo rows in scope');
}
function renderMap(){
  var item=currentItem(),ag=AXMMarketCore.compareGeographies(state.records,state.dictionary,item,currentMonth(),['NL','HR','EU']),by={};ag.forEach(function(g){by[g.geography]=g;});
  var d=state.dictionary,svg=[];
  svg.push('<defs><radialGradient id="ocean"><stop offset="0" stop-color="#153b4c"/><stop offset="1" stop-color="#07131c"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>');
  svg.push('<rect width="820" height="390" fill="url(#ocean)"/><path d="M110 235 L146 112 L238 63 L331 73 L421 42 L529 70 L655 129 L696 218 L628 314 L501 345 L392 315 L292 347 L185 304 Z" fill="#173544" stroke="#31596a" stroke-width="2"/><path d="M223 122 L301 92 L369 110 L431 84 L516 110 L590 166 L552 226 L475 230 L426 277 L357 249 L297 270 L244 222 L187 200 Z" fill="#1d414e" stroke="#31596a"/>');
  function project(lon,lat){return{x:90+(lon+12)/45*660,y:330-(lat-34)/38*270};}
  ['EU','NL','HR'].forEach(function(code){var geo=d.geographies[code],pos=project(geo.lon,geo.lat),g=by[code],count=g?g.count:0,conf=g?g.confidence:0,rad=13+Math.min(19,count*3),ring=conf>=70?'#69dda0':conf>=45?'#f0bd5c':'#f17870',fill=COLORS[code]||'#4bdce8',label=g?money(g.medianUnitPriceEur,g.units[0]):'no evidence';svg.push('<g filter="url(#glow)"><circle cx="'+pos.x+'" cy="'+pos.y+'" r="'+rad+'" fill="'+fill+'" fill-opacity=".22" stroke="'+ring+'" stroke-width="4"/><circle cx="'+pos.x+'" cy="'+pos.y+'" r="5" fill="'+fill+'"/></g><text x="'+(pos.x+rad+8)+'" y="'+(pos.y-4)+'" fill="#edf5f7" font-size="13" font-weight="700">'+code+' · '+esc(geo.name)+'</text><text x="'+(pos.x+rad+8)+'" y="'+(pos.y+14)+'" fill="#8ea7b2" font-size="11">'+esc(label)+'</text>');});
  if(!item)svg.push('<text x="410" y="370" text-anchor="middle" fill="#8ea7b2" font-size="12">Import evidence to activate item comparison.</text>');
  $('geoMap').innerHTML=svg.join('');$('mapScopeBadge').textContent=item||'no item selected';
}
function renderAggregates(){
  var ag=AXMMarketCore.aggregateItem(scoped(),state.dictionary);
  $('aggregateRows').innerHTML=ag.length?ag.sort(function(a,b){return a.itemName.localeCompare(b.itemName)||a.geography.localeCompare(b.geography);}).map(function(g){return'<tr><td><b>'+esc(g.itemName)+'</b><br><span class="badge">'+esc(g.category)+'</span></td><td>'+esc(geoname(g.geography))+'</td><td>'+money(g.medianUnitPriceEur,g.units[0])+'</td><td>'+((g.minUnitPriceEur!=null&&g.maxUnitPriceEur!=null)?'€'+fmt(g.minUnitPriceEur)+'–€'+fmt(g.maxUnitPriceEur):'—')+'</td><td>'+g.count+'</td><td>'+g.sourceCount+'</td><td class="'+diagnosticClass(g.confidence)+'">'+g.confidence+'%</td><td>'+esc((g.newestObservedAt||'').slice(0,10)||'—')+'</td></tr>';}).join(''):'<tr><td colspan="8" class="muted">No evidence in this scope.</td></tr>';
}
function signalCard(p,compact){
  return'<article class="signal '+severityClass(p.severity)+'"><div class="row"><span class="badge '+severityClass(p.severity)+'">'+esc(p.severity)+'</span><span class="badge">'+p.confidence+'% confidence</span></div><h3>'+esc(p.title)+'</h3><p>'+esc(p.summary)+'</p>'+(!compact?'<p class="why"><b>Why review:</b> '+esc(p.why)+'</p><div class="invalidate"><b>Invalidates when:</b> '+esc(p.invalidation)+'</div><div class="row" style="margin-top:9px"><span class="badge">'+p.evidenceCount+' rows</span><span class="badge">'+p.sourceCount+' sources</span><button class="btn" data-watch-item="'+esc(p.itemId)+'">Add to watchlist</button></div>':'')+'</article>';
}
function renderPatterns(){
  var p=patterns();$('patternCount').textContent=p.length+' candidate'+(p.length===1?'':'s');
  $('overviewPatterns').innerHTML=p.length?p.slice(0,3).map(function(x){return signalCard(x,true);}).join(''):'<div class="empty">No candidate pattern yet. Import at least two comparable geographies or multiple months.</div>';
  $('patternCards').innerHTML=p.length?p.map(function(x){return signalCard(x,false);}).join(''):'<div class="empty">No pattern passed the visible thresholds in this scope.</div>';
  var t=state.dictionary.patternThresholds;$('patternRules').innerHTML=[
    ['Geographic gap','≥ '+t.geographicSpreadPct+'% comparable median spread'],
    ['Demand pressure','Demand ≥ '+t.highDemandSignal+' plus constrained availability'],
    ['Signal alignment','Three or more signals ≥ '+t.signalAlignment],
    ['Monthly movement','Absolute median change ≥ '+t.monthlyMovePct+'%']
  ].map(function(x){return'<div class="onboarding"><span class="stepnum">•</span><div><b>'+x[0]+'</b><div class="hint">'+x[1]+'</div></div></div>';}).join('');
}
function renderRankings(){
  var r=ranked();$('rankingScope').textContent=(currentMonth()||'all months')+' · '+currentGeo();
  $('rankingRows').innerHTML=r.length?r.slice(0,100).map(function(x){return'<tr><td class="rank">'+x.rank+'</td><td><b>'+esc(x.itemName)+'</b><br><span class="badge">'+esc(x.itemId)+'</span></td><td>'+esc(x.category)+'</td><td><b>'+fmt(x.score,1)+'</b><div class="bar"><span style="width:'+Math.max(0,Math.min(100,x.score))+'%"></span></div></td><td>'+Math.round(x.coverage*100)+'%</td><td class="'+diagnosticClass(x.confidence)+'">'+x.confidence+'%</td><td>'+x.observationCount+'</td><td>'+esc(x.geographies.join(', '))+'</td></tr>';}).join(''):'<tr><td colspan="8" class="muted">No items have popularity signals in this scope.</td></tr>';
  var cats=AXMMarketCore.topByCategory(r,10);$('categoryRankings').innerHTML=Object.keys(cats).sort().map(function(c){return'<div class="category-block"><h3>'+esc(c)+'</h3><div class="scroll"><table><tbody>'+cats[c].map(function(x){return'<tr><td class="rank">'+x.rank+'</td><td>'+esc(x.itemName)+'</td><td>'+fmt(x.score,1)+'</td><td>'+x.confidence+'% confidence</td></tr>';}).join('')+'</tbody></table></div></div>';}).join('')||'<div class="empty">No category rankings yet.</div>';
}
function renderCompare(){
  var item=currentItem(),ag=AXMMarketCore.compareGeographies(state.records,state.dictionary,item,currentMonth(),['NL','HR','EU']),name=state.records.filter(function(r){return r.itemId===item;})[0];
  $('compareItemBadge').textContent=name?name.itemName:'no item';
  $('compareSummary').textContent=item?'Comparing '+(name?name.itemName:item)+' for '+(currentMonth()||'all months')+'. Only rows with explicit EUR comparability receive euro medians.':'No item selected.';
  $('compareRows').innerHTML=ag.length?ag.map(function(g){return'<tr><td><b>'+esc(geoname(g.geography))+'</b></td><td>'+money(g.medianUnitPriceEur,g.units[0])+'</td><td>'+((g.minUnitPriceEur!=null&&g.maxUnitPriceEur!=null)?'€'+fmt(g.minUnitPriceEur)+'–€'+fmt(g.maxUnitPriceEur):'—')+'</td><td>'+g.count+'</td><td>'+g.sellerCount+'</td><td>'+g.sourceCount+'</td><td class="'+diagnosticClass(g.confidence)+'">'+g.confidence+'%</td></tr>';}).join(''):'<tr><td colspan="7" class="muted">No matching evidence.</td></tr>';
  renderBars(ag);renderTimeline(item);
}
function renderBars(ag){
  var max=Math.max.apply(null,ag.map(function(g){return g.medianUnitPriceEur||0;}).concat([1])),svg=['<rect width="760" height="280" fill="#08151e"/>'];
  ag.forEach(function(g,i){var y=42+i*70,w=(g.medianUnitPriceEur||0)/max*500;svg.push('<text x="20" y="'+(y+18)+'" fill="#edf5f7" font-size="13">'+esc(g.geography)+'</text><rect x="85" y="'+y+'" width="520" height="28" rx="8" fill="#17303e"/><rect x="85" y="'+y+'" width="'+w+'" height="28" rx="8" fill="'+(COLORS[g.geography]||'#4bdce8')+'" opacity=".82"/><text x="620" y="'+(y+18)+'" fill="#8ea7b2" font-size="12">'+esc(money(g.medianUnitPriceEur,g.units[0]))+'</text>');});
  if(!ag.length)svg.push('<text x="380" y="145" text-anchor="middle" fill="#8ea7b2">No comparable data</text>');$('compareBars').innerHTML=svg.join('');
}
function renderTimeline(item){
  var pts=AXMMarketInsights.timeline(state.records,item,['NL','HR','EU']),months=Array.from(new Set(pts.map(function(x){return x.month;}))).sort(),max=Math.max.apply(null,pts.map(function(x){return x.medianUnitPriceEur||0;}).concat([1])),min=Math.min.apply(null,pts.map(function(x){return x.medianUnitPriceEur||0;}).concat([0])),svg=['<rect width="760" height="280" fill="#08151e"/>'];
  function x(m){return months.length<=1?380:70+months.indexOf(m)/(months.length-1)*610;}function y(v){return 225-(v-min)/(Math.max(.0001,max-min))*165;}
  months.forEach(function(m){svg.push('<text x="'+x(m)+'" y="255" text-anchor="middle" fill="#8ea7b2" font-size="10">'+esc(m)+'</text>');});
  ['NL','HR','EU'].forEach(function(g){var series=pts.filter(function(p){return p.geography===g;});if(!series.length)return;var path=series.map(function(p,i){return(i?'L':'M')+x(p.month)+' '+y(p.medianUnitPriceEur);}).join(' ');svg.push('<path d="'+path+'" fill="none" stroke="'+COLORS[g]+'" stroke-width="3"/>');series.forEach(function(p){svg.push('<circle cx="'+x(p.month)+'" cy="'+y(p.medianUnitPriceEur)+'" r="4" fill="'+COLORS[g]+'"/>');});});
  if(pts.length<2)svg.push('<text x="380" y="140" text-anchor="middle" fill="#8ea7b2">Add multiple months to reveal timing</text>');$('timelineChart').innerHTML=svg.join('');
}
function renderSourceCatalog(){
  var list=state.dictionary.sourceCatalog||[];$('sourceCatalog').innerHTML=list.map(function(s){return'<article class="source-card"><div class="row"><span class="badge '+(s.status==='import-ready'?'strong':'observe')+'">'+esc(s.status)+'</span><span class="badge official">'+esc(s.scope.join(' · '))+'</span></div><h3>'+esc(s.name)+'</h3><p>'+esc(s.coverage)+'</p><div class="route">'+esc(s.route)+'</div></article>';}).join('');
}
function renderReceipts(){
  $('receiptList').innerHTML=state.imports.length?state.imports.slice().reverse().map(function(r){return'<article class="receipt"><b>'+esc(r.filename||r.kind)+'</b><div class="hint">'+esc(r.importedAt)+'</div><p>'+r.accepted+' accepted · '+r.rejected+' rejected · '+r.duplicates+' duplicate</p><code>'+(r.sha256?esc(r.sha256):'hash unavailable')+'</code></article>';}).join(''):'<div class="empty">No imports recorded.</div>';
}
function renderQuality(){
  var q=quality(),coverage=AXMMarketInsights.sourceCoverage(state.records,state.dictionary,{month:currentMonth(),geography:currentGeo()});
  $('qualityStats').innerHTML=[['Quality Signal',q.metrics.qualitySignal],['Comparable',pct(q.metrics.comparableShare)],['Official share',pct(q.metrics.officialShare)],['Fresh share',pct(q.metrics.freshShare)],['Critical issues',q.counts.critical],['Warnings',q.counts.warning]].map(function(x){return'<div class="kpi"><b>'+x[1]+'</b><small>'+x[0]+'</small></div>';}).join('');
  $('qualityIssues').innerHTML=q.issues.length?q.issues.slice(0,80).map(function(x){return'<div class="issue"><span class="badge '+(x.severity==='critical'?'critical':'observe')+'">'+esc(x.severity)+'</span><span class="issue-code">'+esc(x.code)+'</span><span>'+esc(x.message)+'</span><span class="hint">'+esc(x.itemId||x.sourceId||'dataset')+'</span></div>';}).join(''):'<div class="empty">No diagnostic issues in this scope.</div>';
  $('sourceCoverageRows').innerHTML=coverage.length?coverage.map(function(x){return'<tr><td>'+esc(x.sourceType)+'</td><td><span class="badge '+(x.className==='official'?'official':'')+'">'+esc(x.className)+'</span></td><td>'+x.rows+'</td><td>'+x.sources+'</td><td>'+x.items+'</td><td>'+fmt(x.trust,2)+'</td></tr>';}).join(''):'<tr><td colspan="6" class="muted">No source coverage yet.</td></tr>';
}
function renderWatchlist(){
  $('watchCount').textContent=state.watchlist.length+' item'+(state.watchlist.length===1?'':'s');
  $('watchCards').innerHTML=state.watchlist.length?state.watchlist.map(function(w){var rec=state.records.filter(function(r){return r.itemId===w.itemId;})[0];return'<article class="watch-card"><div class="row"><span class="badge '+(w.status==='RESEARCH'?'strong':w.status==='IGNORE'?'critical':'observe')+'">'+esc(w.status)+'</span><span class="badge">'+esc(w.updatedAt.slice(0,10))+'</span></div><h3>'+esc(rec?rec.itemName:w.itemId)+'</h3><p><b>Thesis:</b> '+esc(w.thesis||'—')+'</p><p><b>Invalidation:</b> '+esc(w.invalidation||'—')+'</p><p>'+esc(w.notes||'')+'</p><div class="row"><button class="btn" data-edit-watch="'+esc(w.itemId)+'">Edit</button><button class="btn danger" data-remove-watch="'+esc(w.itemId)+'">Remove</button></div></article>';}).join(''):'<div class="empty">No watch entries. Add a candidate only after stating what would invalidate it.</div>';
}
function renderEvidence(){
  var query=$('evidenceSearch').value.trim().toLowerCase(),q=quality(),flagMap={};q.issues.forEach(function(i){(flagMap[i.recordKey]||(flagMap[i.recordKey]=[])).push(i.code);});
  var rows=scoped().filter(function(r){return!query||[r.itemName,r.itemId,r.seller,r.sourceId,r.sourceType,r.geography,r.notes].join(' ').toLowerCase().includes(query);}).sort(function(a,b){return b.observedAt.localeCompare(a.observedAt);});
  $('evidenceCount').textContent=rows.length+' rows';
  $('evidenceRows').innerHTML=rows.length?rows.map(function(r){var flags=flagMap[r.recordKey]||[];return'<tr><td>'+esc(r.observedAt.slice(0,10))+'</td><td><b>'+esc(r.itemName)+'</b><br><span class="badge">'+esc(r.category)+'</span></td><td>'+esc(r.geography)+'</td><td>'+esc(r.currency)+' '+fmt(r.price)+' / '+esc(r.quantity+' '+r.unit)+'</td><td>'+money(r.unitPriceEur,r.baseUnit)+'</td><td>'+esc(r.seller||'—')+'</td><td>'+esc(r.availability)+'</td><td>'+esc(r.sourceId)+'<br><span class="badge">'+esc(r.sourceType)+'</span></td><td class="'+(flags.length?'warntext':'goodtext')+'">'+esc(flags.join(' · ')||'clean')+'</td></tr>';}).join(''):'<tr><td colspan="9" class="muted">No matching evidence rows.</td></tr>';
}
function renderStatus(){
  var report=AXMMarketCore.buildReport(state.records,state.dictionary,{month:currentMonth(),geography:currentGeo()}),q=quality();
  $('statusBox').textContent=JSON.stringify({module:'geographic-market-map',version:'v0.1-polished-review',status:'EXPERIMENTAL',records:state.records.length,imports:state.imports.length,watchlist:state.watchlist.length,scope:report.scope,evidence:report.evidence,qualitySignal:q.metrics.qualitySignal,activeGeographies:state.dictionary.scope.active,plannedGeographies:state.dictionary.scope.planned,liveSourceAdapters:'SOURCE-READY CATALOG ONLY · automated fetch adapters not claimed',browserClickTest:'UNRUN until recorded',promotion:'REFUSED until real data accuracy and device stability pass'},null,2);
  $('dictionaryBox').textContent=JSON.stringify(state.dictionary,null,2);
}
function renderAll(){refreshItemSelect();renderSummary();renderMap();renderAggregates();renderPatterns();renderRankings();renderCompare();renderSourceCatalog();renderReceipts();renderQuality();renderWatchlist();renderEvidence();renderStatus();}

async function saveState(note){
  await AXM.store.save('market-map-state',{records:state.records,imports:state.imports,watchlist:state.watchlist},{title:'AXM Geographic Market Map'});
  AXMHub.save({records:state.records.length,imports:state.imports.length,watchlist:state.watchlist.length,updatedAt:new Date().toISOString()});
  setStatus((note||'saved')+' · '+state.records.length+' rows','ready');
}
function stageRows(rows,meta){
  var result=AXMMarketCore.importRows(rows,state.dictionary,state.records);state.pending={result:result,meta:meta};
  $('pendingBox').classList.remove('hidden');$('pendingTitle').textContent=meta.filename||meta.kind||'Pending import';
  $('pendingSummary').textContent=result.accepted.length+' accepted · '+result.rejected.length+' rejected · '+result.duplicates.length+' duplicate';
  $('pendingPreview').textContent=JSON.stringify({acceptedPreview:result.accepted.slice(0,8),rejected:result.rejected.slice(0,8),duplicates:result.duplicates.slice(0,8),note:'Nothing has been added yet.'},null,2);
  $('commitPending').disabled=result.accepted.length===0;setStatus('import staged · review required','info');
}
async function previewFile(){
  var f=$('dataFile').files[0];if(!f){$('importResult').textContent='Choose a CSV or JSON file first.';return;}
  try{var text=await f.text(),rows=AXMMarketSources.parse(text,f.name),hash=await AXMMarketSources.sha256(text);stageRows(rows,{kind:'file',filename:f.name,bytes:f.size,sha256:hash,importedAt:new Date().toISOString()});}
  catch(e){$('importResult').textContent='Preview failed before mutation: '+e.message;setStatus('preview failed','exp');}
}
async function commitPending(){
  if(!state.pending)return;var p=state.pending,g=gate('market-map.import',{rows:p.result.accepted.length,filename:p.meta.filename||p.meta.kind});if(!g.allow){setStatus('import denied · '+g.reason,'exp');return;}
  state.records=state.records.concat(p.result.accepted);state.imports.push(Object.assign({},p.meta,{accepted:p.result.accepted.length,rejected:p.result.rejected.length,duplicates:p.result.duplicates.length}));
  $('importResult').textContent=JSON.stringify({committed:p.result.accepted.length,rejected:p.result.rejected.length,duplicates:p.result.duplicates.length},null,2);state.pending=null;$('pendingBox').classList.add('hidden');await saveState('import committed');renderAll();
}
function discardPending(){state.pending=null;$('pendingBox').classList.add('hidden');$('pendingPreview').textContent='';setStatus('pending import discarded','info');}
function manualObject(){return{itemId:$('mItemId').value,itemName:$('mItemName').value,category:$('mCategory').value,geography:$('mGeo').value,observedAt:$('mDate').value,price:$('mPrice').value,currency:$('mCurrency').value,unit:$('mUnit').value,quantity:$('mQuantity').value,seller:$('mSeller').value,availability:$('mAvailability').value,sourceId:$('mSourceId').value,sourceType:$('mSourceType').value,sourceUrl:$('mSourceUrl').value,fxRateToEur:$('mFx').value,marketplaceActivity:$('mMarketplace').value,searchInterest:$('mSearch').value,sellerGrowth:$('mSellerGrowth').value,tradeMovement:$('mTrade').value,pricePressure:$('mPressure').value,notes:$('mNotes').value};}
async function addManual(){
  var row=manualObject(),v=AXMMarketCore.validateObservation(row,state.dictionary);if(!v.pass){$('importResult').textContent=JSON.stringify(v,null,2);switchView('Data');return;}
  var g=gate('market-map.add-observation',{itemId:v.record.itemId,sourceId:v.record.sourceId});if(!g.allow)return;
  var result=AXMMarketCore.importRows([row],state.dictionary,state.records);if(!result.accepted.length){$('importResult').textContent=JSON.stringify(result,null,2);return;}
  state.records.push(result.accepted[0]);state.imports.push({kind:'manual',filename:'manual observation',accepted:1,rejected:0,duplicates:0,sha256:null,importedAt:new Date().toISOString()});await saveState('observation added');renderAll();
}
async function clearData(){var g=gate('market-map.clear-local-data',{records:state.records.length});if(!g.allow)return;if(!confirm('Clear all local Market Map evidence and import receipts? The watchlist will remain.'))return;state.records=[];state.imports=[];state.pending=null;await saveState('dataset cleared');renderAll();}
async function saveWatch(){
  var item=$('watchItem').value;if(!item)return;var entry={itemId:item,status:$('watchStatus').value,thesis:$('watchThesis').value.trim(),invalidation:$('watchInvalidation').value.trim(),notes:$('watchNotes').value.trim(),updatedAt:new Date().toISOString()};
  if(!entry.invalidation){alert('Add an invalidation condition before saving the watch entry.');return;}
  var ix=state.watchlist.findIndex(function(w){return w.itemId===item;});if(ix>=0)state.watchlist[ix]=entry;else state.watchlist.push(entry);await saveState('watchlist saved');renderWatchlist();
}
function editWatch(item){var w=state.watchlist.find(function(x){return x.itemId===item;});if(!w)return;switchView('Watchlist');$('watchItem').value=w.itemId;$('watchStatus').value=w.status;$('watchThesis').value=w.thesis;$('watchInvalidation').value=w.invalidation;$('watchNotes').value=w.notes;}
async function removeWatch(item){state.watchlist=state.watchlist.filter(function(w){return w.itemId!==item;});await saveState('watch entry removed');renderWatchlist();}
function addPatternToWatch(item){switchView('Watchlist');$('watchItem').value=item;var p=patterns().find(function(x){return x.itemId===item;});if(p){$('watchThesis').value=p.summary;$('watchInvalidation').value=p.invalidation;$('watchNotes').value='Added from '+p.type+' candidate. Human review required.';}}
function exportDataset(){var g=gate('market-map.export-evidence',{records:state.records.length});if(!g.allow)return;download('axm-market-evidence-'+Date.now()+'.json',JSON.stringify({schema:'axm.geographic-market-evidence/0.2',exportedAt:new Date().toISOString(),dictionaryVersion:state.dictionary.version,records:state.records,imports:state.imports,watchlist:state.watchlist},null,2));}
function exportReport(){var g=gate('market-map.export-report',{month:currentMonth(),geography:currentGeo()});if(!g.allow)return;var report=AXMMarketCore.buildReport(state.records,state.dictionary,{month:currentMonth(),geography:currentGeo()});report.patternCandidates=patterns();report.quality=quality();download('axm-market-report-'+(currentMonth()||'all')+'-'+currentGeo()+'.json',JSON.stringify(report,null,2));}
function exportWatchlist(){download('axm-market-watchlist-'+Date.now()+'.json',JSON.stringify({schema:'axm.market-watchlist/0.1',exportedAt:new Date().toISOString(),entries:state.watchlist},null,2));}

VIEWS.forEach(function(v){$('tab'+v).onclick=function(){switchView(v);};});
$('scopeMonth').onchange=renderAll;$('scopeGeo').onchange=renderAll;$('scopeItem').onchange=function(){renderMap();renderCompare();};
$('saveNow').onclick=function(){saveState('checkpoint saved');};$('openPatterns').onclick=function(){switchView('Patterns');};
$('previewFile').onclick=previewFile;$('commitPending').onclick=commitPending;$('discardPending').onclick=discardPending;$('stageDemo').onclick=function(){stageRows(demoRows(),{kind:'demo',filename:'clearly labeled synthetic demo',bytes:0,sha256:null,importedAt:new Date().toISOString()});};
$('downloadSchema').onclick=function(){download('axm-market-import-schema.csv',AXMMarketSources.schemaCsv(),'text/csv');};$('addManual').onclick=addManual;
$('clearData').onclick=clearData;$('saveWatch').onclick=saveWatch;$('evidenceSearch').oninput=renderEvidence;
$('exportDataset').onclick=exportDataset;$('exportReport').onclick=exportReport;$('exportWatchlist').onclick=exportWatchlist;
document.addEventListener('click',function(ev){var w=ev.target.getAttribute('data-watch-item'),e=ev.target.getAttribute('data-edit-watch'),r=ev.target.getAttribute('data-remove-watch');if(w)addPatternToWatch(w);if(e)editWatch(e);if(r)removeWatch(r);});

(async function(){
  if(!window.AXMMarketCore||!window.AXMMarketInsights||!window.AXMMarketSources)throw new Error('market modules missing');
  state.dictionary=await fetch('market-dictionary.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('dictionary HTTP '+r.status);return r.json();});
  populateStatic();var info=await AXM.init({id:'geographic-market-map',name:'AXM Geographic Market Map',version:'v0.1-polished-review'});AXM.wisdom.on(localStorage.getItem('axm.identity.growth.enabled')!=='false');
  try{var saved=await AXM.store.load('market-map-state');if(saved&&saved.data){state.records=Array.isArray(saved.data.records)?saved.data.records:[];state.imports=Array.isArray(saved.data.imports)?saved.data.imports:[];state.watchlist=Array.isArray(saved.data.watchlist)?saved.data.watchlist:[];}}catch(e){AXMHub.error('Market Map restore failed: '+e.message);}
  renderAll();setStatus('ready · '+info.storageBackend+' · '+state.records.length+' rows','ready');AXMHub.log('Geographic Market Map polished review ready · '+state.records.length+' evidence rows');AXMHub.verifyPass();
})().catch(function(e){setStatus('boot failed · '+e.message,'exp');if(window.AXMHub)AXMHub.error(e.message);});
AXMHub.ready({id:'geographic-market-map',name:'AXM Geographic Market Map',version:'v0.1-polished-review',hubApiVersion:'1.0',permissions:[],savesState:true,handlesShutdown:false,notes:'Evidence-first geographic market mapping. Pattern candidates remain human-reviewed research material.'});
})();
