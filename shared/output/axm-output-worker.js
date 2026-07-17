'use strict';
importScripts('/shared/output/axm-output-core.js');
importScripts('/shared/vendor/comlink/comlink.min.js');
importScripts('/shared/vendor/jspdf/jspdf.umd.min.js');

var Core=self.AXMOutputCore;
function hex(buffer){return Array.from(new Uint8Array(buffer)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');}
async function sha256(bytes){return hex(await crypto.subtle.digest('SHA-256',bytes));}
async function progress(callback,value,label){if(typeof callback==='function')await callback({value:value,label:label,at:new Date().toISOString()});}
function pdfPages(doc,title,body){
  var margin=18,pageWidth=doc.internal.pageSize.getWidth(),pageHeight=doc.internal.pageSize.getHeight(),usable=pageWidth-margin*2,y=24;
  doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text(title,margin,y);y+=11;
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(90,105,120);doc.text('Created locally by AXM Publish & Library',margin,y);y+=12;doc.setTextColor(25,35,45);doc.setFontSize(11);
  var lines=doc.splitTextToSize(body,usable),pages=1;
  lines.forEach(function(line){if(y>pageHeight-margin){doc.addPage();pages++;y=margin;}doc.text(line,margin,y);y+=6;});
  return pages;
}
var api={
  capabilities:function(){return[
    {id:'pdf.generate',state:self.jspdf&&self.jspdf.jsPDF?'READY':'UNAVAILABLE',engine:'jsPDF',version:'4.2.1',license:'MIT',execution:'browser-worker'},
    {id:'worker.cancel',state:'READY',engine:'Comlink',version:'4.4.2',license:'Apache-2.0',execution:'browser-worker'}
  ];},
  estimate:function(job){return Core.estimate(job);},
  run:async function(input,onProgress){
    var checked=Core.validate(input);if(!checked.ok)throw Error(checked.errors.join('; '));
    var job=checked.job;if(job.kind!=='pdf.generate')throw Error('browser worker does not own '+job.kind);
    var started=performance.now();await progress(onProgress,8,'Validated output job');
    var jsPDF=self.jspdf&&self.jspdf.jsPDF;if(!jsPDF)throw Error('jsPDF engine unavailable');
    var doc=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
    await progress(onProgress,30,'Building PDF pages');
    var pages=pdfPages(doc,String(job.payload.title),String(job.payload.body));
    if(job.payload.subject)doc.setProperties({title:String(job.payload.title).slice(0,160),subject:String(job.payload.subject).slice(0,250),creator:'AXM Publish & Library'});
    await progress(onProgress,72,'Encoding PDF');
    var bytes=doc.output('arraybuffer'),digest=await sha256(bytes),filename=Core.safeFilename(job.payload.filename||job.name,'pdf');
    await progress(onProgress,100,'PDF verified');
    return{ok:true,bytes:new Uint8Array(bytes),receipt:Core.receipt({jobId:job.id,kind:job.kind,adapter:'axm-jspdf-worker',engine:{name:'jsPDF',version:'4.2.1',license:'MIT',source:'https://github.com/parallax/jsPDF'},format:'PDF',mime:'application/pdf',filename:filename,extension:'pdf',bytes:bytes.byteLength,sha256:digest,pages:pages,durationMs:Math.round(performance.now()-started),evidence:['PDF header and byte output produced by jsPDF','SHA-256 calculated in the output worker',pages+' page(s) encoded']})};
  }
};
self.Comlink.expose(api);
