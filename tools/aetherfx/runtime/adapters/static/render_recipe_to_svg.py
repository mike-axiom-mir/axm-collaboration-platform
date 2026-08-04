#!/usr/bin/env python3
"""Render an AXM recipe to a dependency-free, explicitly approximate SVG."""
from __future__ import annotations
import argparse, json, math
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]

def load_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))

def num(value, fallback):
    try: return float(value)
    except (TypeError, ValueError): return fallback

def defaults(module):
    return {parameter['id']: parameter.get('default') for parameter in module.get('parameters', [])}

def sanitize(module, values):
    result = defaults(module)
    result.update(values or {})
    for parameter in module.get('parameters', []):
        if parameter.get('type') != 'number':
            continue
        value = num(result.get(parameter['id']), num(parameter.get('default'), 0))
        if isinstance(parameter.get('min'), (int, float)): value = max(parameter['min'], value)
        if isinstance(parameter.get('max'), (int, float)): value = min(parameter['max'], value)
        result[parameter['id']] = value
    return result

def compile_recipe(recipe, modules):
    quality = recipe.get('globals', {}).get('quality', 'high')
    if quality == 'auto':
        quality = recipe.get('globals', {}).get('resolvedQuality', 'high')
    plan, warnings, exclusive = [], [], {}

    def expand(module_id, values, source='recipe', stack=()):
        if module_id in stack:
            raise ValueError('Composite cycle: ' + ' -> '.join((*stack, module_id)))
        if len(stack) >= 64:
            raise ValueError('Composite depth exceeds the 64-level safety limit')
        if len(plan) >= 2048:
            raise ValueError('Resolved plan exceeds the 2048-operation safety budget')
        if module_id not in modules:
            raise ValueError(f'Unknown nested module: {module_id}')
        module = modules[module_id]
        tier = module.get('quality', {}).get(quality, {'enabled': True})
        if tier.get('enabled') is False:
            fallback = tier.get('fallbackModuleId')
            if fallback:
                warnings.append(f'{module_id} -> {fallback} at {quality}')
                expand(fallback, {}, f'fallback:{module_id}', (*stack, module_id))
            else:
                warnings.append(f'{module_id} disabled at {quality}')
            return
        params = sanitize(module, {**(values or {}), **tier.get('parameterOverrides', {})})
        renderer = module.get('renderer', {})
        if renderer.get('type') == 'derived':
            inherited = {**params, **renderer.get('parameterOverrides', {})}
            expand(renderer['baseModuleId'], inherited, f'derived:{module_id}', (*stack, module_id))
            return
        if renderer.get('type') == 'composite':
            for child in renderer.get('layers', []):
                child_params = dict(child.get('params', {}))
                for child_id, parent_id in child.get('bindings', {}).items():
                    if parent_id in params: child_params[child_id] = params[parent_id]
                expand(child['moduleId'], child_params, f'composite:{module_id}', (*stack, module_id))
            return
        group = module.get('exclusiveGroup')
        if group in exclusive:
            plan[exclusive[group]]['superseded'] = True
        if group:
            exclusive[group] = len(plan)
        plan.append({'moduleId': module_id, 'module': module, 'params': params, 'source': source, 'superseded': False})

    for layer in recipe.get('layers', []):
        if layer.get('enabled', True):
            expand(layer['moduleId'], layer.get('params', {}))
    return [item for item in plan if not item['superseded']], warnings, quality

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('recipe', type=Path)
    parser.add_argument('--catalog', type=Path, default=ROOT/'catalog/default-catalog.json')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--width', type=int, default=1400)
    parser.add_argument('--height', type=int, default=820)
    args = parser.parse_args()

    recipe = load_json(args.recipe)
    catalog = load_json(args.catalog)
    modules = {m['id']: m for m in catalog['modules']}
    moods = {m['id']: m for m in catalog.get('moods', [])}
    unknown = [l['moduleId'] for l in recipe.get('layers', []) if l.get('enabled', True) and l['moduleId'] not in modules]
    if unknown: raise SystemExit('Unknown modules: ' + ', '.join(unknown))

    mood = moods.get(recipe.get('globals', {}).get('mood')) or next(iter(moods.values()))
    accent, accent2, warm, bg = mood.get('accent','#58e6ff'), mood.get('accent2','#a56cff'), mood.get('warm','#ff75d8'), mood.get('bg','#050814')
    intensity = num(recipe.get('globals',{}).get('intensity'), .72)
    depth = num(recipe.get('globals',{}).get('depth'), .64)
    try:
        plan, compile_warnings, quality = compile_recipe(recipe, modules)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    active = {item['moduleId']: item for item in plan}
    title = escape(recipe.get('name','AXM Visual Scene'))
    scene = recipe.get('sceneId','scene.dashboard')
    W,H=args.width,args.height

    has_particles = 'atmosphere.ambient-field' in active or 'atmosphere.dust-motes' in active
    has_beam = 'light.volumetric-beam' in active or 'light.godray-fan' in active
    has_vignette = 'atmosphere.vignette' in active
    has_holo = 'material.hologram-skin' in active
    glow = active.get('light.neon-edge-glow',{}).get('params',{}).get('intensity',.45)
    blur = active.get('material.aetherglass', active.get('material.liquid-glass', {})).get('params',{}).get('blur',18)

    pieces=[]
    add=pieces.append
    add(f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">
<title id="title">{title}</title><desc id="desc">Static SVG approximation generated by AXM AetherFX Visual Effect Fabric.</desc>
<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{bg}"/><stop offset=".55" stop-color="#07111e"/><stop offset="1" stop-color="#03040a"/></linearGradient>
 <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{accent}"/><stop offset=".55" stop-color="{accent2}"/><stop offset="1" stop-color="{warm}"/></linearGradient>
 <radialGradient id="halo"><stop stop-color="{accent}" stop-opacity="{.34*intensity}"/><stop offset="1" stop-color="{accent}" stop-opacity="0"/></radialGradient>
 <filter id="soft"><feGaussianBlur stdDeviation="{max(1,blur/6):.2f}"/></filter>
 <filter id="glow"><feGaussianBlur stdDeviation="{max(2,8*float(glow)):.2f}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="{accent}" stroke-opacity=".055"/></pattern>
</defs>
<rect width="100%" height="100%" fill="url(#bg)"/><rect width="100%" height="100%" fill="url(#grid)"/>""")
    add(f'<ellipse cx="{W*.68:.0f}" cy="{H*.28:.0f}" rx="{W*.3:.0f}" ry="{H*.35:.0f}" fill="url(#halo)" filter="url(#soft)"/>')
    if has_beam:
        add(f'<path d="M{W*.15:.0f},0 L{W*.48:.0f},{H:.0f} L{W*.72:.0f},{H:.0f} L{W*.38:.0f},0Z" fill="{accent}" opacity=".06" filter="url(#soft)"/>')
    if has_particles:
        for i in range(38):
            x=(i*97+41)%W; y=(i*151+73)%H; r=1+(i%4)*.45
            add(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{accent if i%3 else accent2}" opacity="{.18+(i%5)*.06:.2f}"/>')

    # Scene shell and deliberately generic content blocks.
    margin=70; panel_y=120; panel_h=H-190
    add(f'<rect x="{margin}" y="{panel_y}" width="{W-2*margin}" height="{panel_h}" rx="30" fill="#09121e" fill-opacity=".70" stroke="url(#edge)" stroke-opacity="{.45+float(glow)*.3:.2f}" stroke-width="2" filter="url(#glow)"/>')
    add(f'<rect x="{margin+22}" y="{panel_y+22}" width="{W-2*margin-44}" height="{panel_h-44}" rx="22" fill="#07101b" fill-opacity=".68" stroke="{accent}" stroke-opacity=".13"/>')
    add(f'<text x="{margin+48}" y="{panel_y+70}" font-family="system-ui,sans-serif" font-size="16" letter-spacing="5" fill="{accent}">AXM VISUAL EFFECT FABRIC</text>')
    add(f'<text x="{margin+48}" y="{panel_y+128}" font-family="system-ui,sans-serif" font-size="42" font-weight="700" fill="#f4f8ff">{title}</text>')
    add(f'<text x="{margin+48}" y="{panel_y+162}" font-family="system-ui,sans-serif" font-size="16" fill="#a9b9cc">{escape(scene)} · static {escape(quality)} approximation · {len(plan)} resolved modules</text>')
    base_y=panel_y+210
    cols=3 if scene!='scene.hero' else 2
    card_w=(W-2*margin-120-(cols-1)*22)/cols
    rows=2
    for r in range(rows):
      for c in range(cols):
        x=margin+48+c*(card_w+22); y=base_y+r*150
        add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{card_w:.1f}" height="122" rx="18" fill="#0b1725" fill-opacity=".78" stroke="{accent if (r+c)%2==0 else accent2}" stroke-opacity=".24"/>')
        add(f'<rect x="{x+18:.1f}" y="{y+18:.1f}" width="42" height="42" rx="12" fill="{accent}" fill-opacity=".12" stroke="{accent}" stroke-opacity=".4"/>')
        operation = plan[(r*cols+c) % max(1, len(plan))] if plan else None
        operation_name = operation['module'].get('name', operation['moduleId']) if operation else 'Empty resolved plan'
        add(f'<text x="{x+76:.1f}" y="{y+42:.1f}" font-family="system-ui,sans-serif" font-size="17" font-weight="650" fill="#eaf4ff">{escape(operation_name)}</text>')
        add(f'<rect x="{x+76:.1f}" y="{y+58:.1f}" width="{card_w-100:.1f}" height="7" rx="4" fill="#9db3c9" opacity=".22"/>')
        add(f'<rect x="{x+76:.1f}" y="{y+78:.1f}" width="{(card_w-100)*.68:.1f}" height="7" rx="4" fill="{accent2}" opacity=".28"/>')
    if has_holo:
        for y in range(panel_y+30,panel_y+panel_h-20,8): add(f'<line x1="{margin+20}" y1="{y}" x2="{W-margin-20}" y2="{y}" stroke="{accent}" stroke-opacity=".018"/>')
    if has_vignette:
        add(f'<rect width="100%" height="100%" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="70"/>')
    unsupported = sum(1 for item in plan if item['module'].get('renderer', {}).get('type') == 'interaction')
    add(f'<text x="{W-70}" y="{H-32}" text-anchor="end" font-family="system-ui,sans-serif" font-size="13" fill="#8192a7">Approximation: {unsupported} interaction operations unsupported; exact browser blending is not preserved.</text></svg>')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(''.join(pieces),encoding='utf-8')
    print(f'Wrote {args.output}')

if __name__=='__main__': main()
