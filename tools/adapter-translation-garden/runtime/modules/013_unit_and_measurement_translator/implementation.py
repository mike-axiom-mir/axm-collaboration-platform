from __future__ import annotations
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_DOWN, ROUND_FLOOR, ROUND_HALF_EVEN, ROUND_HALF_UP
from typing import Any

from axm_translation_core import add_loss, new_loss_ledger

_D = Decimal
_UNITS = {
    'm': ('length', _D('1'), _D('0')), 'cm': ('length', _D('0.01'), _D('0')),
    'mm': ('length', _D('0.001'), _D('0')), 'km': ('length', _D('1000'), _D('0')),
    'in': ('length', _D('0.0254'), _D('0')), 'ft': ('length', _D('0.3048'), _D('0')),
    'yd': ('length', _D('0.9144'), _D('0')), 'mi': ('length', _D('1609.344'), _D('0')),
    'kg': ('mass', _D('1'), _D('0')), 'g': ('mass', _D('0.001'), _D('0')),
    'mg': ('mass', _D('0.000001'), _D('0')), 'lb': ('mass', _D('0.45359237'), _D('0')),
    'oz': ('mass', _D('0.028349523125'), _D('0')),
    's': ('duration', _D('1'), _D('0')), 'ms': ('duration', _D('0.001'), _D('0')),
    'min': ('duration', _D('60'), _D('0')), 'h': ('duration', _D('3600'), _D('0')),
    'rad': ('angle', _D('1'), _D('0')), 'deg': ('angle', _D('0.01745329251994329576923690768489'), _D('0')),
    'K': ('temperature', _D('1'), _D('0')), 'C': ('temperature', _D('1'), _D('273.15')),
    'F': ('temperature', _D('0.5555555555555555555555555556'), _D('255.3722222222222222222222222')),
}
_ROUNDING = {
    'half_even': ROUND_HALF_EVEN, 'half_up': ROUND_HALF_UP, 'down': ROUND_DOWN,
    'floor': ROUND_FLOOR, 'ceiling': ROUND_CEILING,
}


def _decimal(value: Any) -> Decimal:
    if isinstance(value, bool):
        raise ValueError('boolean is not a measurement')
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError('value is not a finite decimal') from exc
    if not result.is_finite():
        raise ValueError('value is not finite')
    return result


def _json_number(value: Decimal) -> int | float:
    if value == value.to_integral_value():
        return int(value)
    return float(value)


def run(
    value: Any,
    source_unit: str,
    target_unit: str,
    *,
    precision: int | None = None,
    rounding: str = 'half_even',
    tolerance: Any | None = None,
) -> dict[str, Any]:
    ledger = new_loss_ledger()
    if source_unit not in _UNITS or target_unit not in _UNITS:
        unknown = [u for u in (source_unit, target_unit) if u not in _UNITS]
        add_loss(ledger, kind='unknown_unit', path='$.unit', source_value=unknown, reason='unit is not in the reviewed local registry', severity='blocking')
        return {'schema': 'axm.translation.measurement/v1', 'ok': False, 'value': None, 'loss': ledger}
    source_family, source_scale, source_offset = _UNITS[source_unit]
    target_family, target_scale, target_offset = _UNITS[target_unit]
    if source_family != target_family:
        add_loss(ledger, kind='incompatible_unit_families', path='$.unit', source_value=source_family, target_value=target_family, reason='different measurement families cannot be converted', severity='blocking')
        return {'schema': 'axm.translation.measurement/v1', 'ok': False, 'value': None, 'loss': ledger}
    number = _decimal(value)
    base = number * source_scale + source_offset
    exact = (base - target_offset) / target_scale
    output = exact
    rounding_error = Decimal('0')
    if precision is not None:
        if precision < 0 or precision > 18:
            raise ValueError('precision must be between 0 and 18')
        if rounding not in _ROUNDING:
            raise ValueError(f'unsupported rounding mode: {rounding}')
        quantum = Decimal('1').scaleb(-precision)
        output = exact.quantize(quantum, rounding=_ROUNDING[rounding])
        rounding_error = abs(output - exact)
        if rounding_error:
            severity = 'low'
            if tolerance is not None and rounding_error > _decimal(tolerance):
                severity = 'high'
            add_loss(ledger, kind='rounded_measurement', path='$.value', source_value=str(exact), target_value=str(output), reason=f'rounded to {precision} decimal places using {rounding}', severity=severity, reversible=False)
    within_tolerance = True if tolerance is None else rounding_error <= _decimal(tolerance)
    return {
        'schema': 'axm.translation.measurement/v1',
        'ok': not ledger['summary']['has_blocking_loss'] and within_tolerance,
        'source': {'value': _json_number(number), 'unit': source_unit},
        'target': {'value': _json_number(output), 'unit': target_unit},
        'exact_target_decimal': str(exact),
        'rounding_error_decimal': str(rounding_error),
        'within_tolerance': within_tolerance,
        'family': source_family,
        'loss': ledger,
    }


def reviewed_units() -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for unit, (family, _, __) in _UNITS.items():
        result.setdefault(family, []).append(unit)
    return {family: sorted(units) for family, units in sorted(result.items())}
