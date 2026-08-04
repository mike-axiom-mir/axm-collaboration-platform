(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  let pending=null,options=null;

  function elements(){
    return {
      dialog:$('#actionDialog'),form:$('#actionDialogForm'),title:$('#actionDialogTitle'),eyebrow:$('#actionDialogEyebrow'),
      message:$('#actionDialogMessage'),field:$('#actionDialogField'),label:$('#actionDialogLabel'),input:$('#actionDialogInput'),
      select:$('#actionDialogSelect'),hint:$('#actionDialogHint'),confirm:$('#actionDialogConfirm'),cancel:$('#actionDialogCancel'),close:$('#actionDialogClose')
    };
  }
  function finish(value){
    const e=elements();
    if(e.dialog?.open)e.dialog.close();
    const resolve=pending;pending=null;options=null;
    if(resolve)resolve(value);
  }
  function updateConfirm(){
    const e=elements();if(!options||!e.confirm)return;
    const value=options.kind==='select'?e.select.value:e.input.value;
    const exact=options.expectedValue===undefined||value===options.expectedValue;
    const required=!options.required||String(value).trim().length>0;
    e.confirm.disabled=!(exact&&required);
    e.input.removeAttribute?.('aria-invalid');e.select.removeAttribute?.('aria-invalid');
    if(options.kind!=='none'){
      const control=options.kind==='select'?e.select:e.input;
      control.setAttribute?.('aria-invalid',String(!(exact&&required)));
    }
    if(options.expectedValue!==undefined)e.hint.textContent=exact?'Exact confirmation matched.':`Type ${options.expectedValue} exactly to continue.`;
    else if(options.required)e.hint.textContent=required?(options.hint||'Required value provided.'):(options.hint||'Enter a value to continue.');
  }
  function request(config={}){
    const e=elements();
    if(!e.dialog||!e.form)return Promise.reject(new Error('AXM action dialog is unavailable.'));
    if(pending)finish(null);
    options={kind:'text',title:'Confirm action',eyebrow:'Explicit action',message:'',label:'Value',defaultValue:'',confirmLabel:'Continue',cancelLabel:'Cancel',required:false,danger:false,...config};
    e.title.textContent=options.title;e.eyebrow.textContent=options.eyebrow;e.message.textContent=options.message||'';e.label.textContent=options.label||'Value';e.hint.textContent=options.hint||'';
    e.confirm.textContent=options.confirmLabel;e.cancel.textContent=options.cancelLabel;e.confirm.className=options.danger?'danger-button':'primary-button';
    e.input.hidden=options.kind==='select';e.select.hidden=options.kind!=='select';e.field.hidden=options.kind==='none';
    if(options.kind==='select'){
      const items=Array.isArray(options.choices)?options.choices:[];
      e.select.innerHTML=items.map(item=>{const value=typeof item==='string'?item:item.value,label=typeof item==='string'?item:item.label;return `<option value="${String(value).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}">${String(label).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</option>`}).join('');
      e.select.value=String(options.defaultValue??items[0]?.value??items[0]??'');
    }else{
      e.input.type=options.inputType||'text';e.input.value=String(options.defaultValue??'');e.input.placeholder=options.placeholder||'';e.input.autocomplete=options.autocomplete||'off';
    }
    updateConfirm();
    e.dialog.showModal();
    requestAnimationFrame(()=>{(options.kind==='select'?e.select:options.kind==='none'?e.confirm:e.input).focus();if(options.kind!=='select'&&options.kind!=='none')e.input.select();});
    return new Promise(resolve=>{pending=resolve});
  }
  function askText(config={}){return request({...config,kind:'text'});}
  function choose(config={}){return request({...config,kind:'select',required:true});}
  function confirmPhrase(config={}){return request({...config,kind:'text',required:true,danger:config.danger!==false});}
  function confirm(config={}){return request({...config,kind:'none'});}

  function init(){
    const e=elements();if(!e.dialog||e.dialog.dataset.bound==='true')return;e.dialog.dataset.bound='true';
    e.form.addEventListener('submit',event=>{event.preventDefault();if(e.confirm.disabled)return;finish(options?.kind==='select'?e.select.value:options?.kind==='none'?true:e.input.value)});
    e.cancel.addEventListener('click',()=>finish(null));e.close.addEventListener('click',()=>finish(null));
    e.dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null)});
    e.input.addEventListener('input',updateConfirm);e.select.addEventListener('change',updateConfirm);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.AXMDialog={request,askText,choose,confirmPhrase,confirm,close:()=>finish(null)};
})();
