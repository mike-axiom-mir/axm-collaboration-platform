from __future__ import annotations
from fractions import Fraction
from typing import Any


def _f(value: Any) -> Fraction:
    if isinstance(value, Fraction): return value
    if isinstance(value, int): return Fraction(value, 1)
    if isinstance(value, float): return Fraction(str(value))
    if isinstance(value, str): return Fraction(value)
    if isinstance(value, (tuple, list)) and len(value) == 2: return Fraction(int(value[0]), int(value[1]))
    raise ValueError('unsupported rational')


def map_timestamp(ticks: int, *, source_timebase: Any, target_timebase: Any, rounding: str = 'refuse') -> dict[str, Any]:
    exact = Fraction(ticks) * _f(source_timebase) / _f(target_timebase)
    if exact.denominator == 1:
        return {'ok': True, 'ticks': exact.numerator, 'exact': True, 'loss': None}
    if rounding == 'refuse':
        return {'ok': False, 'ticks': None, 'exact': False, 'exact_fraction': [exact.numerator, exact.denominator], 'loss': 'non_integer_target_timestamp'}
    if rounding == 'floor': value = exact.numerator // exact.denominator
    elif rounding == 'ceil': value = -(-exact.numerator // exact.denominator)
    elif rounding == 'nearest': value = round(float(exact))
    else: raise ValueError('rounding must be refuse, floor, ceil, or nearest')
    return {'ok': True, 'ticks': int(value), 'exact': False, 'exact_fraction': [exact.numerator, exact.denominator], 'loss': 'timestamp_rounded'}


def run(source: dict[str, Any], target: dict[str, Any]) -> dict[str, Any]:
    operations, losses = [], []
    for key, op in [('container', 'remux'), ('video_codec', 'transcode_video'), ('audio_codec', 'transcode_audio'), ('frame_rate', 'change_frame_rate'), ('color_space', 'convert_color'), ('timebase', 'retime')]:
        if source.get(key) is not None and target.get(key) is not None and source.get(key) != target.get(key):
            operations.append({'operation': op, 'from': source.get(key), 'to': target.get(key), 'performed': False})
    if source.get('variable_frame_rate') and target.get('variable_frame_rate') is False:
        losses.append({'kind': 'variable_timing_collapsed', 'severity': 'high', 'reversible': False})
    if target.get('video_lossless') is False and source.get('video_codec') != target.get('video_codec'):
        losses.append({'kind': 'lossy_video_target', 'severity': 'high', 'reversible': False})
    src_tracks = source.get('tracks')
    dst_tracks = target.get('tracks')
    if isinstance(src_tracks, list) and isinstance(dst_tracks, list) and len(dst_tracks) < len(src_tracks):
        losses.append({'kind': 'tracks_removed', 'severity': 'high', 'count': len(src_tracks) - len(dst_tracks)})
    return {'schema': 'axm.translation.video-plan/v1', 'verdict': 'PARTIAL' if operations or losses else 'PASS_NO_CHANGE', 'operations': operations, 'losses': losses, 'conversion_performed': False}
