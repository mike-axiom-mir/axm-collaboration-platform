'use strict';

const U = require('./foundation-utils');

const PROTOTYPE_SCHEMA = 'axm.interactive-prototype/v1';
const RUN_SCHEMA = 'axm.interactive-prototype-run/v1';

function create(spec) {
  spec = U.clone(spec || {});
  const states = U.boundedArray(spec.states, 1, 200, 'prototype states').map((state) => ({
    id: U.text(state.id, 80, 'prototype state id'), title: U.text(state.title, 120, 'prototype state title'),
    document: U.clone(state.document), accessibility: U.clone(state.accessibility || {}), responsive: U.clone(state.responsive || {}),
  }));
  U.ensure(new Set(states.map((item) => item.id)).size === states.length, 'prototype state ids must be unique');
  const stateIds = new Set(states.map((item) => item.id));
  const transitions = U.boundedArray(spec.transitions || [], 0, 1000, 'prototype transitions').map((transition) => ({
    id: U.text(transition.id, 100, 'prototype transition id'), from: U.text(transition.from, 80, 'transition from'), to: U.text(transition.to, 80, 'transition to'),
    input: U.text(transition.input, 100, 'transition input'), guard: transition.guard == null ? null : U.clone(transition.guard), animation: U.clone(transition.animation || { kind: 'none', duration_ms: 0 }),
  }));
  U.ensure(new Set(transitions.map((item) => item.id)).size === transitions.length, 'prototype transition ids must be unique');
  U.ensure(transitions.every((item) => stateIds.has(item.from) && stateIds.has(item.to)), 'prototype transition references missing state');
  U.ensure(new Set(transitions.map((item) => item.from + '|' + item.input)).size === transitions.length, 'prototype transitions must be deterministic for each state and input');
  const inputMap = {};
  for (const key of Object.keys(spec.input_map || {}).sort()) inputMap[U.text(key, 100, 'input map key')] = U.clone(spec.input_map[key]);
  const initial = U.text(spec.initial_state, 80, 'prototype initial state');
  U.ensure(stateIds.has(initial), 'prototype initial state is missing');
  const prototype = {
    schema: PROTOTYPE_SCHEMA, version: '1.0.0', id: U.text(spec.id, 100, 'prototype id'), title: U.text(spec.title, 160, 'prototype title'),
    target_canvas: U.clone(spec.target_canvas), target_canvas_digest: U.text(spec.target_canvas_digest, 128, 'prototype canvas digest'),
    initial_state: initial, states, transitions, input_map: inputMap,
    design_tokens: U.clone(spec.design_tokens || null), implementation_handoff: { state_schema: PROTOTYPE_SCHEMA, framework: 'host-neutral finite-state machine', automatic_publish: false },
  };
  prototype.digest = U.sha256(prototype);
  prototype.html = html(prototype);
  return prototype;
}

function html(prototype) {
  U.ensure(prototype && prototype.schema === PROTOTYPE_SCHEMA, 'prototype required');
  const data = JSON.stringify({ id: prototype.id, initial_state: prototype.initial_state, states: prototype.states.map((item) => ({ id: item.id, title: item.title })), transitions: prototype.transitions, input_map: prototype.input_map }).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="utf-8"><title>${prototype.title.replace(/[<>&"]/g, '')}</title><main id="prototype" tabindex="0" aria-live="polite"></main><script>const model=${data};let current=model.initial_state;const root=document.getElementById('prototype');function draw(){const state=model.states.find(x=>x.id===current);root.dataset.state=current;root.textContent=state.title;}function send(input){const edge=model.transitions.find(x=>x.from===current&&x.input===input);if(!edge)return false;current=edge.to;draw();return true;}root.addEventListener('keydown',event=>{const input=Object.keys(model.input_map).find(key=>model.input_map[key].key===event.key);if(input)send(input);});window.AXMPrototype=Object.freeze({send,state:()=>current});draw();</script>`;
}

function guardPass(guard, context) {
  if (!guard) return true;
  U.ensure(typeof guard.key === 'string', 'prototype guard key required');
  return context && context[guard.key] === guard.equals;
}

function run(prototype, inputs, evidence) {
  U.ensure(prototype && prototype.schema === PROTOTYPE_SCHEMA, 'prototype required');
  inputs = U.boundedArray(inputs, 1, 10000, 'prototype inputs');
  evidence = U.clone(evidence || {});
  let current = prototype.initial_state;
  const trace = [{ index: 0, state: current, event: null }];
  const issues = [];
  inputs.forEach((event, index) => {
    const input = U.text(event.input, 100, 'prototype input');
    const transition = prototype.transitions.find((item) => item.from === current && item.input === input && guardPass(item.guard, event.context));
    if (!transition) issues.push({ index, code: 'NO_TRANSITION', state: current, input });
    else { current = transition.to; trace.push({ index: index + 1, state: current, event: input, transition_id: transition.id }); }
  });
  const live = evidence.source && ['live-browser', 'native-host'].includes(evidence.source.kind) && evidence.source.fresh_session === true && !!evidence.source.driver_receipt_digest;
  const accessible = evidence.accessibility_receipt && evidence.accessibility_receipt.status === 'PASS' && evidence.accessibility_receipt.target_canvas_digest === prototype.target_canvas_digest;
  const receipt = {
    schema: RUN_SCHEMA, version: '1.0.0', prototype_digest: prototype.digest, inputs_digest: U.sha256(inputs), trace, final_state: current, issues,
    source: U.clone(evidence.source || null), accessibility_receipt_digest: evidence.accessibility_receipt && evidence.accessibility_receipt.digest || null,
    status: issues.length ? 'FAIL' : live && accessible ? 'PASS' : 'TEST_ONLY',
    implementation_handoff: U.clone(prototype.implementation_handoff),
  };
  receipt.digest = U.sha256(receipt);
  return receipt;
}

module.exports = { PROTOTYPE_SCHEMA, RUN_SCHEMA, create, html, run };
