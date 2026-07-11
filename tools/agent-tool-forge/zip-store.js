/* Minimal deterministic ZIP writer: UTF-8, STORE method, fixed timestamp.
   Creates packages only; it does not read, extract, install, or execute them. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof window!=='undefined')root.AXMZipStore=api;})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const enc=s=>typeof TextEncoder!=='undefined'?new TextEncoder().encode(String(s)):Uint8Array.from(Buffer.from(String(s),'utf8'));
  const table=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  const crc32=b=>{let c=0xffffffff;for(let i=0;i<b.length;i++)c=table[(c^b[i])&255]^(c>>>8);return(c^0xffffffff)>>>0;};
  function u16(a,n){a.push(n&255,(n>>>8)&255);} function u32(a,n){a.push(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255);}
  function build(files,prefix){const local=[],central=[];let offset=0,count=0;prefix=String(prefix||'').replace(/^\/+|\/+$/g,'');Object.keys(files).sort().forEach(path=>{const name=enc((prefix?prefix+'/':'')+path),data=enc(files[path]),crc=crc32(data),head=[];u32(head,0x04034b50);u16(head,20);u16(head,0x0800);u16(head,0);u16(head,0);u16(head,0x0021);u32(head,crc);u32(head,data.length);u32(head,data.length);u16(head,name.length);u16(head,0);const h=Uint8Array.from(head);local.push(h,name,data);const c=[];u32(c,0x02014b50);u16(c,20);u16(c,20);u16(c,0x0800);u16(c,0);u16(c,0);u16(c,0x0021);u32(c,crc);u32(c,data.length);u32(c,data.length);u16(c,name.length);u16(c,0);u16(c,0);u16(c,0);u16(c,0);u32(c,0);u32(c,offset);central.push(Uint8Array.from(c),name);offset+=h.length+name.length+data.length;count++;});const centralSize=central.reduce((n,b)=>n+b.length,0),end=[];u32(end,0x06054b50);u16(end,0);u16(end,0);u16(end,count);u16(end,count);u32(end,centralSize);u32(end,offset);u16(end,0);const all=local.concat(central,[Uint8Array.from(end)]),size=all.reduce((n,b)=>n+b.length,0),out=new Uint8Array(size);let p=0;all.forEach(b=>{out.set(b,p);p+=b.length;});return out;}
  function blob(files,prefix){return new Blob([build(files,prefix)],{type:'application/zip'});} return{build,blob,crc32};
});
