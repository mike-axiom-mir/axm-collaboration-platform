(async()=>{
  'use strict';
  const checks=[],check=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});
  const storageImage=()=>{
    const out={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      out[key]=localStorage.getItem(key);
    }
    return Object.fromEntries(Object.entries(out).sort(([a],[b])=>a.localeCompare(b)));
  };
  const storageBefore=storageImage();
  try {
    const mold=AXM.getMold('axm.mold.universal-visual-card'),controls=AXM.defaultControls(mold),variant={theme:'aetherglass',format:'landscape',motion:'still',performance:'low',state:'idle'};
    check('registry-loaded',AXM.REG.molds.length===32&&AXM.REG.tokens.length>=140&&AXM.REG.presets.length>=38&&Object.keys(AXM.REG.adapters).length===6,`${AXM.REG.molds.length}/${AXM.REG.tokens.length}`);
    const report=AXMValidate.validate(mold,controls,variant,{reducedMotion:true});check('validation-runs',report.summary.fail===0,JSON.stringify(report.summary));
    const canvas=AXMRender.renderCanvasForMold(mold,controls,variant,.25);check('canvas-render',canvas.width>100&&canvas.height>100,`${canvas.width}x${canvas.height}`);
    const svg=AXMExport.cardSVG(controls,variant);check('svg-export',svg.includes('<svg')&&svg.includes(controls.title),String(svg.length));
    const html=AXMExport.cardHTML(controls,variant),remoteReference=/\b(?:src|href)\s*=\s*["']https?:\/\//i.test(html)||/@import\s+[^;]*https?:\/\//i.test(html)||/url\(\s*["']?https?:\/\//i.test(html);
    check('html-export',html.includes('<!doctype html>')&&!html.includes('<script')&&!remoteReference,String(html.length));
    check('png-export',canvas.toDataURL('image/png').startsWith('data:image/png;base64,'),'canvas data URL');
    const renderPacket=AXMExport.packet(mold,controls,variant);
    check('packet-integrity',AXM.verifyPacketIntegrity(renderPacket).status==='PASS',renderPacket.integrity?.fingerprint||'missing');
    check('core-integrity',AXM.coreIntegrityReport().status==='PASS',JSON.stringify(AXM.coreIntegrityReport()));
    let traversalRejected=false,unsafeKeyRejected=false;
    try{AXM.safeParseJSON('{"path":"../escape"}')}catch{traversalRejected=true}
    try{AXM.safeParseJSON('{"__proto__":{"polluted":true}}')}catch{unsafeKeyRejected=true}
    check('unsafe-import-rejected',traversalRejected&&unsafeKeyRejected,'traversal and unsafe key guards');
    check('recovery-apis-loaded',typeof AXM.stageSafetyCapsule==='function'&&typeof AXM.restoreSnapshot==='function'&&typeof AXM.withStorageTransaction==='function','read-only API presence check');
  } catch (error) {check('uncaught-exception',false,error.stack||error.message)}
  const storageAfter=storageImage();
  check('browser-smoke-read-only',JSON.stringify(storageAfter)===JSON.stringify(storageBefore),JSON.stringify({before:Object.keys(storageBefore).length,after:Object.keys(storageAfter).length}));
  const passed=checks.every(item=>item.ok);document.body.dataset.testStatus=passed?'PASS':'FAIL';document.getElementById('testReport').textContent=JSON.stringify({status:passed?'PASS':'FAIL',checks},null,2);
})();
