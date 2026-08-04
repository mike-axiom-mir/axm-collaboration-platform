from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from axm_translation_core import add_loss, new_loss_ledger

_DURATION = {'ns': Decimal('0.000000001'), 'us': Decimal('0.000001'), 'ms': Decimal('0.001'), 's': Decimal('1'), 'min': Decimal('60'), 'h': Decimal('3600'), 'day': Decimal('86400')}


def _timezone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f'unknown IANA time zone: {name}') from exc


def _parse_timestamp(value: str, assume_timezone: str | None, ledger: dict[str, Any]) -> datetime:
    text = value[:-1] + '+00:00' if value.endswith('Z') else value
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        if not assume_timezone:
            raise ValueError('naive timestamp requires explicit assume_timezone')
        parsed = parsed.replace(tzinfo=_timezone(assume_timezone))
        add_loss(ledger, kind='timezone_assumption', path='$.timestamp', source_value=value, target_value=assume_timezone, reason='source timestamp had no offset; caller supplied an assumption', severity='high', reversible=True)
    return parsed


def translate_timestamp(value: str, *, target_timezone: str, assume_timezone: str | None = None) -> dict[str, Any]:
    ledger = new_loss_ledger()
    parsed = _parse_timestamp(value, assume_timezone, ledger)
    converted = parsed.astimezone(_timezone(target_timezone))
    return {
        'schema': 'axm.translation.timestamp/v1', 'ok': True,
        'source': value, 'target': converted.isoformat(), 'target_timezone': target_timezone,
        'instant_utc': converted.astimezone(ZoneInfo('UTC')).isoformat(),
        'loss': ledger, 'leap_second_support': False,
    }


def translate_duration(value: Any, *, source_unit: str, target_unit: str) -> dict[str, Any]:
    if source_unit not in _DURATION or target_unit not in _DURATION:
        raise ValueError('unsupported duration unit')
    exact = Decimal(str(value)) * _DURATION[source_unit] / _DURATION[target_unit]
    return {'schema': 'axm.translation.duration/v1', 'value': float(exact) if exact % 1 else int(exact), 'exact_decimal': str(exact), 'unit': target_unit}


def frame_time(frame: int, *, frames_per_second: Any, start_seconds: Any = 0) -> dict[str, Any]:
    fps = Decimal(str(frames_per_second))
    if fps <= 0:
        raise ValueError('frames_per_second must be positive')
    seconds = Decimal(str(start_seconds)) + Decimal(frame) / fps
    return {'schema': 'axm.translation.frame-time/v1', 'frame': frame, 'frames_per_second': str(fps), 'seconds_decimal': str(seconds)}


def sample_time(sample: int, *, sample_rate: Any, start_seconds: Any = 0) -> dict[str, Any]:
    rate = Decimal(str(sample_rate))
    if rate <= 0:
        raise ValueError('sample_rate must be positive')
    seconds = Decimal(str(start_seconds)) + Decimal(sample) / rate
    return {'schema': 'axm.translation.sample-time/v1', 'sample': sample, 'sample_rate': str(rate), 'seconds_decimal': str(seconds)}


def validity_contains(moment: str, *, valid_from: str | None = None, valid_until: str | None = None, assume_timezone: str | None = None) -> dict[str, Any]:
    ledger = new_loss_ledger()
    point = _parse_timestamp(moment, assume_timezone, ledger)
    start = _parse_timestamp(valid_from, assume_timezone, ledger) if valid_from else None
    end = _parse_timestamp(valid_until, assume_timezone, ledger) if valid_until else None
    contains = (start is None or point >= start) and (end is None or point < end)
    return {'schema': 'axm.translation.validity-window/v1', 'contains': contains, 'inclusive_start': True, 'exclusive_end': True, 'loss': ledger}


def normalize_recurrence(descriptor: dict[str, Any]) -> dict[str, Any]:
    allowed = {'hourly', 'daily', 'weekly', 'monthly', 'yearly'}
    frequency = descriptor.get('frequency')
    if frequency not in allowed:
        raise ValueError('unsupported recurrence frequency')
    interval = int(descriptor.get('interval', 1))
    if interval < 1:
        raise ValueError('recurrence interval must be positive')
    result = {
        'schema': 'axm.translation.recurrence-descriptor/v1',
        'frequency': frequency, 'interval': interval,
        'timezone': descriptor.get('timezone'), 'start': descriptor.get('start'),
        'count': descriptor.get('count'), 'until': descriptor.get('until'),
        'by_weekday': list(descriptor.get('by_weekday', [])),
        'expanded_occurrences': False,
    }
    if result['timezone']:
        _timezone(result['timezone'])
    return result


def run(kind: str, **kwargs: Any) -> dict[str, Any]:
    handlers = {
        'timestamp': translate_timestamp, 'duration': translate_duration,
        'frame_time': frame_time, 'sample_time': sample_time,
        'validity': validity_contains, 'recurrence': normalize_recurrence,
    }
    if kind not in handlers:
        raise ValueError(f'unsupported temporal kind: {kind}')
    if kind == 'recurrence':
        return normalize_recurrence(kwargs['descriptor'])
    return handlers[kind](**kwargs)
