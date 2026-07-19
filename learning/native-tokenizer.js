'use strict';

const SCHEMA = 'axm.mirror.tokenizer/bpe-byte-v1';
const SPECIAL = Object.freeze({
  BOS: 256,
  EOS: 257,
  SEP: 258,
  OBSERVE: 259,
  PROPOSE: 260,
  VERIFY: 261,
  REPAIR: 262
});
const FIRST_MERGE_ID = 263;

function bytes(text) {
  return Array.from(Buffer.from(String(text == null ? '' : text), 'utf8'));
}

function pairKey(left, right) {
  return `${left},${right}`;
}

function mergePair(sequence, left, right, replacement) {
  const out = [];
  for (let i = 0; i < sequence.length; i += 1) {
    if (sequence[i] === left && sequence[i + 1] === right) {
      out.push(replacement);
      i += 1;
    } else out.push(sequence[i]);
  }
  return out;
}

function train(texts, options) {
  options = options || {};
  const vocabSize = Math.max(FIRST_MERGE_ID, Math.min(8192, Number(options.vocabSize) || 512));
  const minFrequency = Math.max(2, Number(options.minFrequency) || 2);
  let sequences = (Array.isArray(texts) ? texts : []).map(bytes).filter(sequence => sequence.length);
  if (!sequences.length) throw new Error('tokenizer training requires at least one non-empty text');
  const merges = [];
  for (let id = FIRST_MERGE_ID; id < vocabSize; id += 1) {
    const counts = new Map();
    for (const sequence of sequences) {
      for (let i = 0; i + 1 < sequence.length; i += 1) {
        const key = pairKey(sequence[i], sequence[i + 1]);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    let winner = null;
    for (const [key, count] of counts.entries()) {
      if (count < minFrequency) continue;
      if (!winner || count > winner.count || (count === winner.count && key < winner.key)) winner = { key, count };
    }
    if (!winner) break;
    const [left, right] = winner.key.split(',').map(Number);
    merges.push({ id, left, right, count: winner.count });
    sequences = sequences.map(sequence => mergePair(sequence, left, right, id));
  }
  return {
    schema: SCHEMA,
    encoding: 'utf-8-byte-fallback',
    baseTokens: 256,
    specialTokens: SPECIAL,
    firstMergeId: FIRST_MERGE_ID,
    vocabSize: FIRST_MERGE_ID + merges.length,
    merges,
    training: { requestedVocabSize: vocabSize, minFrequency, documentCount: sequences.length }
  };
}

function assertModel(model) {
  if (!model || model.schema !== SCHEMA || !Array.isArray(model.merges)) throw new Error('invalid AXM native tokenizer model');
}

function encode(model, text, options) {
  assertModel(model);
  options = options || {};
  let sequence = bytes(text);
  for (const merge of model.merges) sequence = mergePair(sequence, merge.left, merge.right, merge.id);
  if (options.bos) sequence.unshift(SPECIAL.BOS);
  if (options.eos) sequence.push(SPECIAL.EOS);
  return sequence;
}

function decode(model, tokens, options) {
  assertModel(model);
  options = options || {};
  const byId = new Map(model.merges.map(merge => [merge.id, merge]));
  const specialIds = new Set(Object.values(SPECIAL));
  const output = [];
  const expand = token => {
    if (token >= 0 && token < 256) return output.push(token);
    if (specialIds.has(token)) {
      if (options.includeSpecial) output.push(...Buffer.from(`<${Object.keys(SPECIAL).find(key => SPECIAL[key] === token)}>`));
      return;
    }
    const merge = byId.get(token);
    if (!merge) throw new Error(`unknown tokenizer token ${token}`);
    expand(merge.left);
    expand(merge.right);
  };
  for (const token of (Array.isArray(tokens) ? tokens : [])) expand(Number(token));
  return Buffer.from(output).toString('utf8');
}

module.exports = { SCHEMA, SPECIAL, FIRST_MERGE_ID, train, encode, decode };
