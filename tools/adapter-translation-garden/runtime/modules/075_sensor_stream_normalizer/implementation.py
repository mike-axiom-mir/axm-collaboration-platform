from __future__ import annotations
import copy
from typing import Any

_SENSITIVE={'camera','microphone','location','biometric'}


def run(sensor: dict[str, Any], samples: list[dict[str, Any]], *, consent_scopes: list[str], sequence_start: int = 0) -> dict[str, Any]:
    sensor_type=sensor.get('type'); errors=[]
    if not sensor.get('id') or not sensor_type: return {'verdict':'REFUSE','reason':'sensor id and type required','captured':False}
    if sensor_type in _SENSITIVE and f'sensor:{sensor_type}' not in set(consent_scopes): return {'verdict':'REFUSE','reason':'missing consent scope','captured':False}
    envelopes=[]; prior_time=None
    for offset,sample in enumerate(samples):
        if not isinstance(sample,dict) or 'timestamp' not in sample or 'value' not in sample: errors.append({'index':offset,'reason':'timestamp and value required'}); continue
        timestamp=str(sample['timestamp'])
        if prior_time is not None and timestamp<prior_time: errors.append({'index':offset,'reason':'non_monotonic_timestamp'})
        prior_time=timestamp
        envelopes.append({'schema':'axm.translation.sensor-sample/v1','sensor_id':sensor['id'],'sensor_type':sensor_type,'sequence':sequence_start+offset,'timestamp':timestamp,'value':copy.deepcopy(sample['value']),'unit':sample.get('unit',sensor.get('unit')),'coordinate_frame':sample.get('coordinate_frame',sensor.get('coordinate_frame')),'quality':copy.deepcopy(sample.get('quality')),'calibration_id':sensor.get('calibration_id'),'captured_by_module':False})
    return {'verdict':'NORMALIZED' if not errors else ('PARTIAL' if envelopes else 'REFUSE'),'sensor':copy.deepcopy(sensor),'samples':envelopes,'errors':errors,'captured':False}
