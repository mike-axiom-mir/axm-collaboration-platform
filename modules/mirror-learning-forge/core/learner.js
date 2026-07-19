'use strict';
const C=require('./constants');
const {buildVocabulary,encode,decode}=require('./tokenizer');
const {sha256,now,clone}=require('./utils');

function key(context){return context.join(',');}
function increment(table,k,next,weight=1){
  if(!table[k]) table[k]={total:0,next:{}};
  table[k].total+=weight;
  table[k].next[next]=(table[k].next[next]||0)+weight;
}
function cloneCounts(counts){return JSON.parse(JSON.stringify(counts||{}));}
function countTransitions(counts){return Object.values(counts||{}).reduce((n,row)=>n+Number(row.total||0),0);}
function train({texts,baseModel=null,order=C.DEFAULT_ORDER,maxVocab=C.MAX_VOCAB,modelId='model:challenger',inheritBase=true}){
  const clean=[...new Set((texts||[]).map(String).map(x=>x.trim()).filter(Boolean))];
  const seedVocab=inheritBase&&baseModel&&baseModel.tokenizer&&baseModel.tokenizer.vocab||null;
  const vocab=buildVocabulary(clean,maxVocab,seedVocab);
  const counts=inheritBase&&baseModel?cloneCounts(baseModel.counts):{};
  const beforeTransitions=countTransitions(counts);
  for(const text of clean){
    const ids=encode(text,vocab);
    for(let i=0;i<ids.length-1;i++){
      for(let n=0;n<=order;n++){
        const start=Math.max(0,i-n+1);
        const ctx=ids.slice(start,i+1);
        increment(counts,key(ctx),ids[i+1]);
      }
    }
  }
  const incrementalTokens=clean.reduce((n,t)=>n+encode(t,vocab).length,0);
  const model={
    schema:C.SCHEMAS.MODEL,
    model_id:modelId,
    lineage:{base_model_id:baseModel&&baseModel.model_id||null,base_hash:baseModel&&baseModel.hash||null},
    tokenizer:{kind:'axm-simple-tokenizer/v2',max_vocab:maxVocab,vocab},
    order,counts,
    training:{
      documents:clean.length,
      tokens:incrementalTokens,
      incremental_documents:clean.length,
      incremental_tokens:incrementalTokens,
      cumulative_documents:(baseModel&&baseModel.training&&Number(baseModel.training.cumulative_documents||baseModel.training.documents)||0)+clean.length,
      cumulative_tokens:(baseModel&&baseModel.training&&Number(baseModel.training.cumulative_tokens||baseModel.training.tokens)||0)+incrementalTokens,
      inherited_base_counts:!!(inheritBase&&baseModel),
      inherited_transitions:beforeTransitions,
      total_transitions:countTransitions(counts),
      unique_training_hashes:clean.map(sha256)
    },
    created_at:now()
  };
  model.hash=sha256({...model,hash:undefined});
  return model;
}
function distribution(model,contextIds){
  for(let n=Math.min(model.order,contextIds.length);n>=0;n--){
    const ctx=n===0?[]:contextIds.slice(-n);
    const row=model.counts[key(ctx)];
    if(row){
      const entries=Object.entries(row.next).map(([id,count])=>({id:Number(id),count}));
      entries.sort((a,b)=>b.count-a.count||a.id-b.id);
      return {entries,total:row.total,context:ctx};
    }
  }
  return {entries:[],total:0,context:[]};
}
function predictNext(model,contextText){
  const ids=encode(contextText,model.tokenizer.vocab,{boundary:true});
  const dist=distribution(model,ids.slice(0,-1));
  if(!dist.entries.length)return{token:'<UNK>',token_id:model.tokenizer.vocab.index['<UNK>'],probability:0,context:dist.context};
  const top=dist.entries[0];
  return{token:model.tokenizer.vocab.tokens[top.id],token_id:top.id,probability:top.count/dist.total,context:dist.context};
}
function generate(model,prompt,{maxTokens=32}={}){
  const vocab=model.tokenizer.vocab;let ids=encode(prompt,vocab,{boundary:true}).slice(0,-1);const eos=vocab.index['<EOS>'];
  for(let i=0;i<maxTokens;i++){const dist=distribution(model,ids);if(!dist.entries.length)break;const next=dist.entries[0].id;if(next===eos)break;ids.push(next);}
  return decode(ids.slice(1),vocab);
}
function scoreSequence(model,text){
  const ids=encode(text,model.tokenizer.vocab),vocabSize=model.tokenizer.vocab.tokens.length;let nll=0,correct=0,total=0,unknown=0;
  for(let i=0;i<ids.length-1;i++){
    const dist=distribution(model,ids.slice(0,i+1)),target=ids[i+1],count=dist.entries.find(x=>x.id===target)?.count||0;
    const prob=(count+1)/(dist.total+vocabSize);nll-=Math.log(prob);total++;
    if(dist.entries[0]&&dist.entries[0].id===target)correct++;
    if(target===model.tokenizer.vocab.index['<UNK>'])unknown++;
  }
  return{tokens:total,avg_nll:total?nll/total:null,perplexity:total?Math.exp(nll/total):null,next_token_accuracy:total?correct/total:0,unknown_rate:total?unknown/total:0};
}
function evaluate(model,cases){
  const rows=(cases||[]).map((item,i)=>{
    const expected=String(item.expected||item.text||''),context=String(item.input||''),combined=(context+' '+expected).trim();
    const metrics=scoreSequence(model,combined),generated=generate(model,context,{maxTokens:Math.max(8,expected.split(/\s+/).length+4)});
    const expectedTokens=new Set(expected.toLowerCase().match(/[a-z0-9]+/g)||[]),generatedTokens=new Set(generated.toLowerCase().match(/[a-z0-9]+/g)||[]);
    const overlap=[...expectedTokens].filter(x=>generatedTokens.has(x)).length,semantic_overlap=expectedTokens.size?overlap/expectedTokens.size:0;
    return{case_id:item.case_id||'case:'+i,input:context,expected,generated,semantic_overlap,...metrics};
  });
  const avg=k=>rows.length?rows.reduce((n,r)=>n+(Number(r[k])||0),0)/rows.length:0;
  return{cases:rows,summary:{case_count:rows.length,perplexity:avg('perplexity'),next_token_accuracy:avg('next_token_accuracy'),unknown_rate:avg('unknown_rate'),semantic_overlap:avg('semantic_overlap')}};
}
function compare(baseline,challenger,baselineCases=[],challengerCases=[]){
  const keys=['perplexity','next_token_accuracy','unknown_rate','semantic_overlap'],delta={};for(const k of keys)delta[k]=(challenger[k]||0)-(baseline[k]||0);
  const caseMap=new Map((baselineCases||[]).map(x=>[x.case_id,x])),wins=[];
  for(const c of challengerCases||[]){const b=caseMap.get(c.case_id);if(!b)continue;const score=(c.perplexity<b.perplexity?1:0)+(c.semantic_overlap>b.semantic_overlap?1:0)+(c.next_token_accuracy>b.next_token_accuracy?1:0);wins.push({case_id:c.case_id,challenger_win:score>=2,score});}
  const case_win_rate=wins.length?wins.filter(x=>x.challenger_win).length/wins.length:0;
  const regressions={perplexity:delta.perplexity>Math.max(0.01,(baseline.perplexity||0)*0.1),accuracy:delta.next_token_accuracy<-0.05,unknown:delta.unknown_rate>0.05,semantic:delta.semantic_overlap<-0.05};
  const composite=(delta.semantic_overlap*0.35)+(delta.next_token_accuracy*0.3)-(delta.unknown_rate*0.15)-((baseline.perplexity?delta.perplexity/baseline.perplexity:0)*0.2);
  const improved=composite>0&&case_win_rate>=0.6&&!Object.values(regressions).some(Boolean);
  return{baseline:clone(baseline),challenger:clone(challenger),delta,case_wins:wins,case_win_rate,composite_score:composite,regressions,improved};
}
module.exports={train,predictNext,generate,scoreSequence,evaluate,compare,countTransitions};
