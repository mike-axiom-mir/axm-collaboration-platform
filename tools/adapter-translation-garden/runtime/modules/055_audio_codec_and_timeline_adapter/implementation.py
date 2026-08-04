from __future__ import annotations
from fractions import Fraction
from typing import Any


def _fraction(value: Any) -> Fraction:
    if isinstance(value, Fraction): return value
    if isinstance(value, int): return Fraction(value, 1)
    if isinstance(value, float): return Fraction(str(value))
    if isinstance(value, str): return Fraction(value)
    if isinstance(value, (list, tuple)) and len(value) == 2: return Fraction(int(value[0]), int(value[1]))
    raise ValueError('unsupported rational value')


def sample_time(sample_index: int, sample_rate: Any) -> dict[str, Any]:
    if sample_index < 0: raise ValueError('sample index cannot be negative')
    rate = _fraction(sample_rate)
    if rate <= 0: raise ValueError('sample rate must be positive')
    value = Fraction(sample_index, 1) / rate
    return {'numerator': value.numerator, 'denominator': value.denominator, 'seconds_decimal': format(float(value), '.12g')}


def map_ticks(ticks: int, source_timebase: Any, target_timebase: Any) -> dict[str, Any]:
    exact = Fraction(ticks, 1) * _fraction(source_timebase) / _fraction(target_timebase)
    return {'exact_numerator': exact.numerator, 'exact_denominator': exact.denominator, 'integer_exact': exact.denominator == 1, 'integer_ticks': exact.numerator if exact.denominator == 1 else None}


def run(source: dict[str, Any], target: dict[str, Any], *, channel_map: dict[str, str] | None = None) -> dict[str, Any]:
    operations, losses = [], []
    src_channels = list(source.get('channels', []))
    dst_channels = list(target.get('channels', src_channels))
    if src_channels != dst_channels:
        if channel_map is None:
            return {'schema': 'axm.translation.audio-plan/v1', 'verdict': 'REFUSE', 'reason': 'channel layouts differ and no explicit channel_map was supplied', 'conversion_performed': False}
        unmapped = [c for c in src_channels if c not in channel_map]
        operations.append({'operation': 'remap_channels', 'map': dict(channel_map), 'performed': False})
        if unmapped:
            losses.append({'kind': 'channels_unmapped', 'severity': 'high', 'channels': unmapped})
    for key, op in [('sample_rate', 'resample'), ('bit_depth', 'change_bit_depth'), ('codec', 'transcode'), ('timebase', 'retime')]:
        if source.get(key) is not None and target.get(key) is not None and source.get(key) != target.get(key):
            operations.append({'operation': op, 'from': source.get(key), 'to': target.get(key), 'performed': False})
    if isinstance(source.get('bit_depth'), int) and isinstance(target.get('bit_depth'), int) and target['bit_depth'] < source['bit_depth']:
        losses.append({'kind': 'bit_depth_reduction', 'severity': 'high', 'reversible': False})
    if target.get('codec_lossless') is False and source.get('codec') != target.get('codec'):
        losses.append({'kind': 'lossy_codec_target', 'severity': 'high', 'reversible': False})
    return {'schema': 'axm.translation.audio-plan/v1', 'verdict': 'PARTIAL' if operations or losses else 'PASS_NO_CHANGE', 'operations': operations, 'losses': losses, 'conversion_performed': False, 'source_unchanged': True}
