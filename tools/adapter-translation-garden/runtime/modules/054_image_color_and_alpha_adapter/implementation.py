from __future__ import annotations
from typing import Any


def convert_alpha_pixel(pixel: list[float] | tuple[float, float, float, float], *, source_mode: str, target_mode: str) -> dict[str, Any]:
    if len(pixel) != 4:
        raise ValueError('RGBA pixel must contain four values')
    r, g, b, a = (float(x) for x in pixel)
    if any(x < 0 or x > 1 for x in (r, g, b, a)):
        raise ValueError('normalized pixel values must be between 0 and 1')
    if source_mode not in {'straight', 'premultiplied'} or target_mode not in {'straight', 'premultiplied'}:
        raise ValueError('alpha mode must be straight or premultiplied')
    note = None
    if source_mode == target_mode:
        out = [r, g, b, a]
    elif source_mode == 'straight':
        out = [r * a, g * a, b * a, a]
    elif a == 0:
        out = [0.0, 0.0, 0.0, 0.0]
        note = 'RGB under fully transparent premultiplied pixel is unrecoverable'
    else:
        out = [min(1.0, r / a), min(1.0, g / a), min(1.0, b / a), a]
    return {'schema': 'axm.translation.alpha-pixel/v1', 'pixel': [round(x, 12) for x in out], 'note': note}


def run(source: dict[str, Any], target: dict[str, Any], *, flatten_background: list[float] | None = None, preserve_profile_sidecar: bool = True) -> dict[str, Any]:
    operations: list[dict[str, Any]] = []
    losses: list[dict[str, Any]] = []
    blocking = False
    src_alpha = source.get('alpha_mode', 'none')
    dst_alpha = target.get('alpha_mode', src_alpha)
    if src_alpha != 'none' and dst_alpha == 'none':
        if flatten_background is None:
            blocking = True
            losses.append({'kind': 'alpha_destroyed', 'severity': 'blocking', 'reason': 'target has no alpha and no explicit flatten background was supplied'})
        else:
            if len(flatten_background) not in {3, 4}:
                raise ValueError('flatten_background must contain RGB or RGBA values')
            operations.append({'operation': 'flatten_alpha', 'background': list(flatten_background), 'performed': False})
            losses.append({'kind': 'alpha_flattened', 'severity': 'high', 'reversible': False})
    elif src_alpha != dst_alpha and {src_alpha, dst_alpha} <= {'straight', 'premultiplied'}:
        operations.append({'operation': 'convert_alpha_mode', 'from': src_alpha, 'to': dst_alpha, 'performed': False})
    elif src_alpha != dst_alpha:
        blocking = True
        losses.append({'kind': 'unsupported_alpha_transition', 'severity': 'blocking', 'source': src_alpha, 'target': dst_alpha})

    for key, op in [('color_space', 'convert_color_space'), ('orientation', 'apply_orientation'), ('format', 'change_container')]:
        if source.get(key) is not None and target.get(key) is not None and source.get(key) != target.get(key):
            operations.append({'operation': op, 'from': source.get(key), 'to': target.get(key), 'performed': False})
    src_depth = source.get('bit_depth')
    dst_depth = target.get('bit_depth', src_depth)
    if isinstance(src_depth, int) and isinstance(dst_depth, int) and dst_depth < src_depth:
        operations.append({'operation': 'reduce_bit_depth', 'from': src_depth, 'to': dst_depth, 'performed': False})
        losses.append({'kind': 'bit_depth_reduction', 'severity': 'high', 'reversible': False})
    src_profile = source.get('color_profile')
    dst_profile = target.get('color_profile', src_profile)
    sidecar = None
    if src_profile and not dst_profile:
        if preserve_profile_sidecar:
            sidecar = {'color_profile': src_profile}
            losses.append({'kind': 'profile_not_embedded', 'severity': 'medium', 'preserved_in_sidecar': True})
        else:
            losses.append({'kind': 'profile_dropped', 'severity': 'high', 'reversible': False})
    verdict = 'REFUSE' if blocking else ('PARTIAL' if losses or operations else 'PASS_NO_CHANGE')
    return {'schema': 'axm.translation.image-plan/v1', 'verdict': verdict, 'operations': operations, 'losses': losses, 'sidecar': sidecar, 'conversion_performed': False, 'source_unchanged': True}
