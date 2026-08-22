from __future__ import annotations
import unittest

from tools.module_loader import load_implementation


class SemanticModuleTests(unittest.TestCase):
    def test_012_explicit_mapping_and_unmapped_preservation(self):
        mod = load_implementation(12)
        result = mod.run({'display_name': 'Mir', 'legacy': 7}, [{'source': '$.display_name', 'target': '$.person.name', 'meaning': 'display name', 'confirmed': True}])
        self.assertTrue(result['ok'])
        self.assertEqual(result['mapped']['person']['name'], 'Mir')
        self.assertEqual(result['mapped']['_axm_unmapped_source']['legacy'], 7)

    def test_012_refuses_disputed_candidates(self):
        mod = load_implementation(12)
        result = mod.run({'a': 1, 'b': 2}, [{'sources': ['$.a', '$.b'], 'target': '$.x', 'meaning': 'same intended value', 'confirmed': True}])
        self.assertFalse(result['ok'])
        self.assertEqual(result['disputes'][0]['reason'], 'candidate source values disagree')

    def test_012_requires_confirmation(self):
        mod = load_implementation(12)
        result = mod.run({'a': 1}, [{'source': '$.a', 'target': '$.x', 'meaning': 'x'}])
        self.assertEqual(result['mapped'], {'_axm_unmapped_source': {'a': 1}})
        self.assertEqual(result['unresolved'][0]['reason'], 'mapping was not explicitly confirmed')

    def test_013_length_conversion(self):
        mod = load_implementation(13)
        result = mod.run(100, 'cm', 'm')
        self.assertTrue(result['ok'])
        self.assertEqual(result['target']['value'], 1)

    def test_013_temperature_conversion(self):
        mod = load_implementation(13)
        result = mod.run(32, 'F', 'C', precision=2)
        self.assertEqual(result['target']['value'], 0)

    def test_013_incompatible_families_refuse(self):
        mod = load_implementation(13)
        result = mod.run(1, 'm', 'kg')
        self.assertFalse(result['ok'])
        self.assertTrue(result['loss']['summary']['has_blocking_loss'])

    def test_013_rounding_is_visible(self):
        mod = load_implementation(13)
        result = mod.run(1, 'm', 'ft', precision=2)
        self.assertGreaterEqual(result['loss']['summary']['count'], 1)

    def test_014_maps_and_preserves_unknown(self):
        mod = load_implementation(14)
        result = mod.run(['queued', 'mystery'], {'queued': 'pending'})
        self.assertEqual(result['result'][0], 'pending')
        self.assertEqual(result['result'][1]['state'], 'unmapped')

    def test_014_ambiguous_mapping_refuses(self):
        mod = load_implementation(14)
        result = mod.run('old', {'old': ['legacy', 'deprecated']})
        self.assertFalse(result['ok'])
        self.assertEqual(result['entries'][0]['status'], 'AMBIGUOUS')

    def test_015_resolves_scoped_record(self):
        mod = load_implementation(15)
        records = [mod.make_record(source_system='a', source_id='42', source_scope='s1', target_system='b', target_id='x')]
        result = mod.run(source_system='a', source_id='42', source_scope='s1', target_system='b', records=records)
        self.assertEqual(result['verdict'], 'RESOLVED')

    def test_015_preserves_ambiguity(self):
        mod = load_implementation(15)
        records = [mod.make_record(source_system='a', source_id='42', target_system='b', target_id='x'), mod.make_record(source_system='a', source_id='42', target_system='b', target_id='y')]
        result = mod.run(source_system='a', source_id='42', target_system='b', records=records)
        self.assertEqual(result['verdict'], 'AMBIGUOUS')

    def test_015_redacts_private_target(self):
        mod = load_implementation(15)
        records = [mod.make_record(source_system='a', source_id='42', target_system='b', target_id='secret', privacy='restricted')]
        result = mod.run(source_system='a', source_id='42', target_system='b', records=records, max_privacy='internal')
        self.assertEqual(result['verdict'], 'REDACTED')
        self.assertIsNone(result['candidates'][0]['target']['id'])

    def test_016_timezone_translation(self):
        mod = load_implementation(16)
        result = mod.translate_timestamp('2026-07-27T16:00:00Z', target_timezone='Europe/Amsterdam')
        self.assertIn('+02:00', result['target'])

    def test_016_naive_time_requires_assumption(self):
        mod = load_implementation(16)
        with self.assertRaises(ValueError):
            mod.translate_timestamp('2026-07-27T16:00:00', target_timezone='UTC')

    def test_016_frame_time_exact(self):
        mod = load_implementation(16)
        self.assertEqual(mod.frame_time(25, frames_per_second=25)['seconds_decimal'], '1')

    def test_016_validity_end_is_exclusive(self):
        mod = load_implementation(16)
        result = mod.validity_contains('2026-01-02T00:00:00Z', valid_until='2026-01-02T00:00:00Z')
        self.assertFalse(result['contains'])

    def test_017_screen_to_cartesian(self):
        mod = load_implementation(17)
        source = {'axes': {'x': 'right', 'y': 'down'}, 'unit': 'px', 'meters_per_pixel': 0.01}
        target = {'axes': {'x': 'right', 'y': 'up'}, 'unit': 'm'}
        result = mod.run({'x': 100, 'y': 50}, source, target)
        self.assertEqual(result['point'], {'x': 1, 'y': -0.5})

    def test_017_axis_swap(self):
        mod = load_implementation(17)
        source = {'axes': {'x': 'right', 'y': 'up', 'z': 'forward'}, 'unit': 'm'}
        target = {'axes': {'x': 'right', 'y': 'forward', 'z': 'up'}, 'unit': 'm'}
        result = mod.run({'x': 1, 'y': 2, 'z': 3}, source, target)
        self.assertEqual(result['point'], {'x': 1, 'y': 3, 'z': 2})

    def test_017_geospatial_refuses(self):
        mod = load_implementation(17)
        result = mod.run({'x': 1}, {'frame_type': 'geospatial', 'axes': {'x': 'right'}}, {'axes': {'x': 'right'}})
        self.assertFalse(result['ok'])

    def test_018_nfc_normalization_visible(self):
        mod = load_implementation(18)
        result = mod.normalize_text('Cafe\u0301', form='NFC')
        self.assertEqual(result['text'], 'Café')
        self.assertTrue(result['changed'])

    def test_018_localized_decimal(self):
        mod = load_implementation(18)
        result = mod.parse_number('1.234,50', decimal_separator=',', group_separator='.')
        self.assertEqual(result['exact_decimal'], '1234.50')

    def test_018_rejects_ambiguous_grouping(self):
        mod = load_implementation(18)
        with self.assertRaises(ValueError):
            mod.parse_number('12.34,50', decimal_separator=',', group_separator='.')

    def test_019_distinguishes_missing_and_null(self):
        mod = load_implementation(19)
        self.assertEqual(mod.classify({}, 'x')['state'], 'missing')
        self.assertEqual(mod.classify({'x': None}, 'x')['state'], 'null')

    def test_019_sidecar_preserves_unsupported_state(self):
        mod = load_implementation(19)
        result = mod.run({}, 'x', target_supported_states=['value', 'null'], fallback='sidecar')
        self.assertEqual(result['status'], 'PRESERVED_IN_SIDECAR')
        self.assertEqual(result['sidecar']['state'], 'missing')

    def test_019_collapse_is_blocking(self):
        mod = load_implementation(19)
        envelope = mod.semantic_value('redacted', reason='private')
        result = mod.adapt(envelope, target_supported_states=['value'], fallback='collapse')
        self.assertFalse(result['ok'])
        self.assertTrue(result['loss']['summary']['has_blocking_loss'])


if __name__ == '__main__':
    unittest.main()
