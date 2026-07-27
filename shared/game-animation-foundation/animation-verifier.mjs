const item = (id, label, status, evidence) => ({ id, label, status, evidence });

export function verifyAnimationGraph(graph, options = {}) {
  const stateIds = new Set(graph.states.map((state) => state.id));
  const adjacency = new Map(graph.states.map((state) => [state.id, []]));
  for (const transition of graph.transitions) {
    if (transition.from === '*') for (const id of stateIds) adjacency.get(id).push(transition.to);
    else adjacency.get(transition.from)?.push(transition.to);
  }
  const reachable = new Set([graph.initial_state]), queue = [graph.initial_state];
  while (queue.length) for (const to of adjacency.get(queue.shift()) || []) if (!reachable.has(to)) { reachable.add(to); queue.push(to); }
  const required = options.required_states || ['idle', 'walk', 'run', 'action', 'hit', 'defeat', 'recover'];
  const missing = required.filter((id) => !stateIds.has(id));
  const unreachable = graph.states.filter((state) => !reachable.has(state.id)).map((state) => state.id);
  const stuck = graph.states.filter((state) => !state.loop && !state.tags.includes('terminal') && !graph.transitions.some((transition) => transition.from === state.id && transition.conditions.some((condition) => condition.complete))).map((state) => state.id);
  const silentFeet = graph.states.filter((state) => state.tags.includes('locomotion') && !state.events.some((event) => event.kind === 'contact')).map((state) => state.id);
  const silentActions = graph.states.filter((state) => state.tags.includes('action') && !state.events.length).map((state) => state.id);
  const keys = graph.transitions.map((transition) => `${transition.from}|${transition.priority}|${JSON.stringify(transition.conditions)}`);
  const ambiguous = keys.filter((key, index) => keys.indexOf(key) !== index);
  const checks = [
    item('schema', 'Typed animation graph', graph.schema === 'axm.game-animation-graph/v1' ? 'PASS' : 'FAIL', graph.schema),
    item('reachability', 'Every state is reachable', unreachable.length ? 'FAIL' : 'PASS', unreachable.join(', ') || `${reachable.size} states`),
    item('determinism', 'Equal-priority conditions are unambiguous', ambiguous.length ? 'FAIL' : 'PASS', ambiguous.length ? `${ambiguous.length} collisions` : `${graph.transitions.length} transitions`),
    item('one-shot-exits', 'One-shots recover through completion', stuck.length ? 'FAIL' : 'PASS', stuck.join(', ') || 'all bounded'),
    item('foot-contacts', 'Locomotion exposes timed contacts', silentFeet.length ? 'FAIL' : 'PASS', silentFeet.join(', ') || 'contact events present'),
    item('gameplay-events', 'Actions expose gameplay events', silentActions.length ? 'FAIL' : 'PASS', silentActions.join(', ') || 'timed events present'),
    item('coverage', 'Gameplay groups are represented', missing.length ? 'WARN' : 'PASS', missing.length ? `missing ${missing.join(', ')}` : required.join(', ')),
    item('human-gate', 'Appearance remains a human decision', graph.human_visual_review?.required && !graph.human_visual_review?.approved ? 'PASS' : 'FAIL', 'metrics cannot approve motion taste')
  ];
  const failed = checks.filter((check) => check.status === 'FAIL').length, warnings = checks.filter((check) => check.status === 'WARN').length;
  return { schema: 'axm.game-animation-verification/v1', graph_id: graph.id, status: failed ? 'FAIL' : warnings ? 'DEGRADED' : 'PASS', summary: { checks: checks.length, passed: checks.filter((check) => check.status === 'PASS').length, warnings, failed }, checks, missing_capabilities: missing, human_visual_review: { required: true, approved: false } };
}
