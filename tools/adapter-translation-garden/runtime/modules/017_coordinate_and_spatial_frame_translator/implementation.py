from __future__ import annotations
from copy import deepcopy
from decimal import Decimal
from typing import Any

from axm_translation_core import add_loss, new_loss_ledger

_UNIT = {'m': Decimal('1'), 'cm': Decimal('0.01'), 'mm': Decimal('0.001'), 'km': Decimal('1000'), 'in': Decimal('0.0254'), 'ft': Decimal('0.3048'), 'px': None}
_DIRECTION = {
    'right': ('right', Decimal('1')), 'left': ('right', Decimal('-1')),
    'up': ('up', Decimal('1')), 'down': ('up', Decimal('-1')),
    'forward': ('forward', Decimal('1')), 'backward': ('forward', Decimal('-1')),
}


def _validate_frame(frame: dict[str, Any]) -> tuple[dict[str, str], Decimal, dict[str, Decimal]]:
    if frame.get('frame_type') == 'geospatial':
        raise ValueError('geospatial frames require a reviewed geodesy implementation')
    axes = frame.get('axes')
    if not isinstance(axes, dict) or not axes:
        raise ValueError('frame.axes must map coordinate names to semantic directions')
    semantics = []
    for direction in axes.values():
        if direction not in _DIRECTION:
            raise ValueError(f'unsupported axis direction: {direction}')
        semantics.append(_DIRECTION[direction][0])
    if len(set(semantics)) != len(semantics):
        raise ValueError('frame contains duplicate semantic axes')
    unit = frame.get('unit', 'm')
    if unit not in _UNIT:
        raise ValueError(f'unsupported coordinate unit: {unit}')
    if _UNIT[unit] is None:
        if 'meters_per_pixel' not in frame:
            raise ValueError('pixel frames require explicit meters_per_pixel')
        factor = Decimal(str(frame['meters_per_pixel']))
    else:
        factor = _UNIT[unit]
    origins = {axis: Decimal(str(frame.get('origin', {}).get(axis, 0))) for axis in axes}
    return axes, factor, origins


def run(point: dict[str, Any], source_frame: dict[str, Any], target_frame: dict[str, Any], *, vector: bool = False) -> dict[str, Any]:
    ledger = new_loss_ledger()
    try:
        source_axes, source_factor, source_origin = _validate_frame(source_frame)
        target_axes, target_factor, target_origin = _validate_frame(target_frame)
    except ValueError as exc:
        add_loss(ledger, kind='unsupported_spatial_frame', path='$.frame', reason=str(exc), severity='blocking')
        return {'schema': 'axm.translation.coordinate-frame/v1', 'ok': False, 'point': None, 'loss': ledger}
    source_semantics = {_DIRECTION[d][0] for d in source_axes.values()}
    target_semantics = {_DIRECTION[d][0] for d in target_axes.values()}
    if source_semantics != target_semantics:
        add_loss(ledger, kind='spatial_dimension_mismatch', path='$.axes', source_value=sorted(source_semantics), target_value=sorted(target_semantics), reason='source and target do not describe the same semantic dimensions', severity='blocking')
        return {'schema': 'axm.translation.coordinate-frame/v1', 'ok': False, 'point': None, 'loss': ledger}
    canonical: dict[str, Decimal] = {}
    trace = []
    for axis, direction in source_axes.items():
        if axis not in point:
            add_loss(ledger, kind='coordinate_missing', path=f'$.point.{axis}', reason='source coordinate is absent', severity='blocking')
            continue
        semantic, sign = _DIRECTION[direction]
        raw = Decimal(str(point[axis]))
        origin = Decimal('0') if vector else source_origin[axis]
        canonical[semantic] = (raw - origin) * source_factor * sign
        trace.append({'source_axis': axis, 'semantic_axis': semantic, 'canonical_meters': str(canonical[semantic])})
    if ledger['summary']['has_blocking_loss']:
        return {'schema': 'axm.translation.coordinate-frame/v1', 'ok': False, 'point': None, 'loss': ledger}
    target: dict[str, int | float] = {}
    for axis, direction in target_axes.items():
        semantic, sign = _DIRECTION[direction]
        origin = Decimal('0') if vector else target_origin[axis]
        value = canonical[semantic] / (target_factor * sign) + origin
        target[axis] = int(value) if value == value.to_integral_value() else float(value)
    if source_frame.get('handedness') and target_frame.get('handedness') and source_frame.get('handedness') != target_frame.get('handedness'):
        add_loss(ledger, kind='handedness_representation_change', path='$.frame.handedness', source_value=source_frame.get('handedness'), target_value=target_frame.get('handedness'), reason='explicit axis mapping performed a handedness change', severity='info', reversible=True)
    return {
        'schema': 'axm.translation.coordinate-frame/v1', 'ok': True,
        'point': target, 'vector': vector, 'canonical_basis': {k: str(v) for k, v in canonical.items()},
        'trace': trace, 'loss': ledger, 'orientation_translation': 'not_implemented',
    }
