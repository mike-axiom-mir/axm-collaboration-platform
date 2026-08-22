from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'shared'))
from tools.module_loader import load_implementation

mapper = load_implementation(12)
units = load_implementation(13)
nulls = load_implementation(19)
fixtures = load_implementation(86)
fidelity = load_implementation(89)

source = {'display_name': 'Axiom', 'height_cm': 180, 'nickname': None, 'legacy_note': 'keep me'}
mapping = mapper.run(source, [
    {'source': '$.display_name', 'target': '$.person.name', 'meaning': 'display name', 'confirmed': True},
])
height = units.run(source['height_cm'], 'cm', 'm')
nickname = nulls.run(source, 'nickname', target_supported_states=['value', 'null'])
target = mapping['mapped']
target['person']['height_m'] = height['target']['value']
target['person']['nickname'] = nickname['target_value']

fixture_report = fixtures.run(
    lambda value: mapper.run(value, [{'source': '$.display_name', 'target': '$.person.name', 'meaning': 'display name', 'confirmed': True}]),
    [{'name': 'reviewed-name', 'kind': 'valid', 'reviewed': True, 'args': [{'display_name': 'Axiom'}], 'expect': {'path_equals': {'$.mapped.person.name': 'Axiom'}}}],
)
fidelity_report = fidelity.run(source, source, source_meaning='same entity', target_meaning='same entity', source_authority={'mode': 'read'}, target_authority={'mode': 'read'})

print(json.dumps({'target': target, 'mapping_ok': mapping['ok'], 'fixture_verdict': fixture_report['verdict'], 'fidelity_verdict': fidelity_report['verdict']}, indent=2, ensure_ascii=False))
