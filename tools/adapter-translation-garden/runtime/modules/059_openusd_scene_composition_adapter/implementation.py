from __future__ import annotations
from typing import Any


def run(scene: dict[str, Any], *, flatten: bool = False) -> dict[str, Any]:
    layers = {str(x.get('id')): x for x in scene.get('layers', []) if x.get('id') is not None}
    errors, cycles = [], []
    visiting, visited = set(), set()

    def visit(layer_id: str, stack: list[str]) -> None:
        if layer_id in visiting:
            start = stack.index(layer_id) if layer_id in stack else 0
            cycles.append(stack[start:] + [layer_id]); return
        if layer_id in visited: return
        if layer_id not in layers:
            errors.append(f'missing layer: {layer_id}'); return
        visiting.add(layer_id)
        for child in layers[layer_id].get('sublayers', []): visit(str(child), stack + [layer_id])
        visiting.remove(layer_id); visited.add(layer_id)

    root = str(scene.get('root_layer', ''))
    if not root: errors.append('root_layer is required')
    else: visit(root, [])
    variants = []
    arcs = []
    for prim in scene.get('prims', []):
        for name, options in prim.get('variants', {}).items(): variants.append({'prim': prim.get('path'), 'set': name, 'options': list(options)})
        for arc in prim.get('arcs', []): arcs.append({'prim': prim.get('path'), **arc})
    plan = []
    losses = []
    if flatten:
        plan.append({'operation': 'flatten_layer_stack', 'root_layer': root, 'performed': False})
        losses.append({'kind': 'composition_authorship_collapsed', 'severity': 'high', 'reversible': False})
    ok = not errors and not cycles
    return {'schema': 'axm.translation.openusd-composition-plan/v1', 'ok': ok, 'verdict': 'REFUSE' if not ok else ('PARTIAL' if plan else 'PASS'), 'errors': errors, 'cycles': cycles, 'layer_count': len(layers), 'variants': variants, 'arcs': arcs, 'plan': plan, 'losses': losses, 'usd_runtime_invoked': False}
