/* AXM Asset Pack Lab v0.1 — TEST helper for pack/template manifests. */
'use strict';
const $ = id => document.getElementById(id);
let currentPack = '';
let currentTpl = '';
function now(){ return new Date().toISOString(); }
function lines(id){ return $(id).value.split(/\r?\n/).map(s => s.trim()).filter(Boolean); }
function show(v){
  ['Pack','Template','Library','Status'].forEach(x => {
    $('view'+x).classList.toggle('hidden', x !== v);
    $('tab'+x).className = x === v ? 'on' : '';
  });
  if (v === 'Library') refreshTemplates();
  if (v === 'Status') refreshStatus();
}
['Pack','Template','Library','Status'].forEach(v => $('tab'+v).onclick = () => show(v));
function gate(action, detail){
  try {
    return AXMGate.submit({ action:'asset-pack-lab.' + action, actor:'mike', actorType:'human', tool:'asset-pack-lab', detail:detail || {} }).allow;
  } catch(e) { return true; }
}
async function exportFile(name, content){
  const text = String(content);
  if (window.AXMRegistry && AXMRegistry.connect) {
    try {
      const r = await AXMRegistry.connect({ kind:'asset.sink', action:'write', payload:{ filename:name, content:text }, actor:{ actor:'mike', actorType:'human' }, context:{ tool:'asset-pack-lab' } });
      if (r.ok && r.result && r.result.ok) { $('status').textContent = 'exported via registry'; return; }
    } catch(e) {}
  }
  try {
    const r = await fetch('/api/export', { method:'POST', body:JSON.stringify({ filename:name, content:text }) });
    const d = await r.json();
    if (d.ok) { $('status').textContent = 'exported direct'; return; }
  } catch(e) {}
  const a = document.createElement('a');
  a.download = name;
  a.href = URL.createObjectURL(new Blob([text], { type:'application/json' }));
  a.click();
  $('status').textContent = 'downloaded fallback';
}
function buildPack(){
  const pack = {
    format:'axm-asset-pack', v:1, generated:now(),
    id:$('packId').value.trim(), name:$('packName').value.trim(), family:$('packFamily').value,
    status:$('packStatus').value, targetNamespace:$('packNamespace').value.trim(),
    assets:lines('packAssets').map(ref => ({ ref, status:'planned-or-local' })),
    templates:lines('packTemplates'), qualityGates:lines('packGates'),
    templatePrinciple:'STABLE SHELL. FLEXIBLE SLOTS. PROTECTED OUTPUT.',
    noFakeDone:['Manifest only in v0.1.','Pack installation is not built yet.','Launcher auto-consumption is not built yet.']
  };
  currentPack = JSON.stringify(pack, null, 2);
  $('packOut').textContent = currentPack;
  gate('build-pack', { id:pack.id, family:pack.family });
  AXM.store.save('latest-pack-manifest', { currentPack });
}
function buildTpl(){
  const tpl = {
    format:'axm-template-shell', v:1, generated:now(),
    id:$('tplId').value.trim(), name:$('tplName').value.trim(), family:$('tplFamily').value,
    output:{ size:$('tplSize').value.trim() },
    stableShell:lines('tplShell'),
    flexibleSlots:lines('tplSlots').map(s => { const p=s.split(':'); return { id:p[0], type:p[1] || 'text', required:false }; }),
    principle:'Outer stable. Inner transparent / flexible.',
    status:'design-seed'
  };
  currentTpl = JSON.stringify(tpl, null, 2);
  $('tplOut').textContent = currentTpl;
  gate('build-template', { id:tpl.id, family:tpl.family });
  AXM.store.save('latest-template-shell', { currentTpl });
}
async function refreshTemplates(){
  const box = $('templateList'); box.textContent = 'loading';
  if (!window.AXMRegistry) { box.textContent = 'registry not loaded'; return; }
  const r = await AXMRegistry.connect({ kind:'template.source', action:'list', payload:{}, actor:{ actor:'mike', actorType:'human' }, context:{ tool:'asset-pack-lab' } });
  box.textContent = JSON.stringify(r.result || r, null, 2);
}
async function refreshStatus(){
  const st = await AXM.status();
  $('statusBox').textContent = JSON.stringify({
    tool:'asset-pack-lab',
    registry:window.AXMRegistry ? AXMRegistry.list({}) : null,
    assetsNamespace:window.AXMAssets ? { local:AXMAssets.LOCAL, namespace:AXMAssets.NAMESPACE, strategies:AXMAssets.strategies && AXMAssets.strategies() } : null,
    settings:window.AXMSettings && AXMSettings.describe ? AXMSettings.describe() : null,
    axm:st
  }, null, 2);
}
$('buildPack').onclick = buildPack;
$('exportPack').onclick = () => { if(!currentPack) buildPack(); exportFile('AXM_ASSET_PACK_' + ($('packId').value.trim() || 'pack') + '.json', currentPack); };
$('buildTpl').onclick = buildTpl;
$('exportTpl').onclick = () => { if(!currentTpl) buildTpl(); exportFile('AXM_TEMPLATE_SHELL_' + ($('tplId').value.trim() || 'template') + '.json', currentTpl); };
$('refreshTemplates').onclick = refreshTemplates;
$('refreshStatus').onclick = refreshStatus;
(async () => {
  const info = await AXM.init({ id:'asset-pack-lab', name:'AXM Asset Pack Lab', version:'v0_1' });
  if (window.AXMSettings && AXMSettings.init) { try { await AXMSettings.init(); } catch(e) {} }
  $('status').textContent = 'ready · ' + info.storageBackend;
  buildPack();
  buildTpl();
})();
