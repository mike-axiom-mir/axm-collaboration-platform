'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),handlers=new Map();
function element(id){
  const local={};
  return {id,open:false,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',className:'',type:'text',placeholder:'',autocomplete:'off',dataset:{},
    addEventListener(type,fn){local[type]=fn;handlers.set(`${id}:${type}`,fn)},showModal(){this.open=true},close(){this.open=false},focus(){},select(){},
    fire(type,event={}){local[type]?.({preventDefault(){},...event})}};
}
const ids=['actionDialog','actionDialogForm','actionDialogTitle','actionDialogEyebrow','actionDialogMessage','actionDialogField','actionDialogLabel','actionDialogInput','actionDialogSelect','actionDialogHint','actionDialogConfirm','actionDialogCancel','actionDialogClose'];
const elements=Object.fromEntries(ids.map(id=>[id,element(id)]));
global.window=global;global.document={readyState:'complete',querySelector(selector){return elements[selector.replace(/^#/,'')]||null},addEventListener(){}};global.requestAnimationFrame=fn=>fn();
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'app/js/dialogs.js'),'utf8'),{filename:'app/js/dialogs.js'});
const checks=[];const check=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});
(async()=>{
  const phrasePromise=AXMDialog.confirmPhrase({title:'Restore',expectedValue:'RESTORE',confirmLabel:'Restore'});
  check('phrase starts locked',elements.actionDialogConfirm.disabled===true,String(elements.actionDialogConfirm.disabled));
  elements.actionDialogInput.value='RESTORE';elements.actionDialogInput.fire('input');
  check('phrase unlocks exactly',elements.actionDialogConfirm.disabled===false,String(elements.actionDialogConfirm.disabled));
  elements.actionDialogForm.fire('submit');
  check('phrase result',await phrasePromise==='RESTORE');

  const choosePromise=AXMDialog.choose({title:'Choose',choices:['view','export'],defaultValue:'export'});
  elements.actionDialogForm.fire('submit');
  check('select result',await choosePromise==='export');

  const cancelPromise=AXMDialog.askText({title:'Name',defaultValue:'Example'});
  elements.actionDialogCancel.fire('click');
  check('cancel is non-action',await cancelPromise===null);

  const ok=checks.every(item=>item.ok);console.log(JSON.stringify({status:ok?'PASS':'FAIL',checks},null,2));process.exit(ok?0:1);
})().catch(error=>{console.error(error);process.exit(1)});
