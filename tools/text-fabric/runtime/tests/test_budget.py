from axm_text_fabric.budget import apply_render_budget, choose_quality_tier


def run():
    effects = {
        'glow': {'blur_px': 30, 'opacity': .5},
        'plate': {'blur_px': 18},
        'shadow': [{}, {}],
        'sheen': {'enabled': True},
        'sparkle': {'enabled': True},
        'bevel': {'enabled': True},
        'glitch': {'enabled': True, 'offset_px': 3, 'jitter_px': 2, 'scanline_opacity': .1},
    }
    out, motion, budget, changes = apply_render_budget(effects, 'signal_glitch', 'low', 'display', 48)
    assert out['glow']['blur_px'] <= 12
    assert out['plate']['blur_px'] <= 4
    assert out['sheen']['enabled'] is False
    assert out['glitch']['jitter_px'] == 0
    assert motion == 'none'
    assert budget['quality_tier'] == 'low'
    assert changes
    assert choose_quality_tier('auto', 'handheld') == 'low'
