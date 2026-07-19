'use strict';
const {MAX_VOCAB}=require('./constants');
const SPECIAL=['<PAD>','<UNK>','<BOS>','<EOS>'];
function rawTokens(input){
  return String(input||'').normalize('NFKC').toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)?|[^\s\w]/gu)||[];
}
function buildVocabulary(texts,maxVocab=MAX_VOCAB,seedVocab=null){
  const counts=new Map();
  for(const text of texts||[]) for(const tok of rawTokens(text)) counts.set(tok,(counts.get(tok)||0)+1);
  const seedTokens=Array.isArray(seedVocab&&seedVocab.tokens)?seedVocab.tokens:[];
  const tokens=[];
  for(const tok of [...SPECIAL,...seedTokens]) if(!tokens.includes(tok)&&tokens.length<maxVocab) tokens.push(tok);
  const sorted=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  for(const [tok] of sorted){
    if(tokens.length>=maxVocab) break;
    if(!tokens.includes(tok)) tokens.push(tok);
  }
  return {tokens,index:Object.fromEntries(tokens.map((t,i)=>[t,i])),counts:Object.fromEntries(sorted),preserved_seed_tokens:seedTokens.filter(t=>tokens.includes(t)).length};
}
function encode(text,vocab,{boundary=true}={}){
  const idx=vocab.index||Object.fromEntries(vocab.tokens.map((t,i)=>[t,i]));
  const unk=idx['<UNK>'];
  const ids=rawTokens(text).map(t=>idx[t]===undefined?unk:idx[t]);
  return boundary?[idx['<BOS>'],...ids,idx['<EOS>']]:ids;
}
function decode(ids,vocab){
  const words=ids.map(i=>vocab.tokens[i]||'<UNK>').filter(t=>!SPECIAL.includes(t));
  let out='';
  for(const token of words){
    if(/^[,.;:!?%)\]}]$/.test(token)) out=out.replace(/\s+$/,'')+token+' ';
    else if(/^[([{]$/.test(token)) out+=token;
    else out+=token+' ';
  }
  return out.trim();
}
module.exports={SPECIAL,rawTokens,buildVocabulary,encode,decode};
