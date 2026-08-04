from __future__ import annotations
import json,math,unittest
from pathlib import Path
from axm_translation_core import inspect_json_value
ROOT=Path(__file__).resolve().parents[1]
CORPUS=json.loads((ROOT/'fixtures'/'adversarial_corpus.json').read_text(encoding='utf-8'))['cases']
class Run39InputBoundsTests(unittest.TestCase):
    def test_reviewed_corpus_all_matches(self):
        for case in CORPUS:
            with self.subTest(case=case['id']): self.assertEqual(inspect_json_value(case['value'],case['budget'])['verdict'],case['expected'])
    def test_nan_refused(self): self.assertEqual(inspect_json_value(float('nan'))['verdict'],'REFUSE')
    def test_inf_refused(self): self.assertEqual(inspect_json_value(float('inf'))['verdict'],'REFUSE')
    def test_tuple_refused(self): self.assertEqual(inspect_json_value((1,2))['verdict'],'REFUSE')
    def test_non_string_key_refused(self): self.assertEqual(inspect_json_value({1:'x'})['verdict'],'REFUSE')
    def test_default_accepts_normal(self): self.assertEqual(inspect_json_value({'a':[1,2,None]})['verdict'],'ACCEPT')
    def test_command_text_not_executed(self): self.assertEqual(inspect_json_value({'x':'$(touch /tmp/no)'})['verdict'],'ACCEPT')
    def test_stats_count_root(self): self.assertEqual(inspect_json_value({})['stats']['nodes'],1)
    def test_stats_depth(self): self.assertEqual(inspect_json_value({'a':[1]})['stats']['max_depth'],2)
    def test_utf8_bytes_count(self): self.assertEqual(inspect_json_value('😀')['stats']['string_bytes'],4)
    def test_input_unchanged(self):
        value={'a':[1]}; before=json.dumps(value); inspect_json_value(value); self.assertEqual(json.dumps(value),before)
    def test_node_limit_visible(self): self.assertIn('max_nodes_exceeded',[e['reason'] for e in inspect_json_value(list(range(10)),{'max_nodes':3})['errors']])
    def test_depth_limit_visible(self): self.assertIn('max_depth_exceeded',[e['reason'] for e in inspect_json_value({'a':{'b':1}},{'max_depth':1})['errors']])
    def test_string_limit_visible(self): self.assertIn('max_string_bytes_exceeded',[e['reason'] for e in inspect_json_value('abcdef',{'max_string_bytes':3})['errors']])
    def test_no_execution_claim(self): self.assertFalse(inspect_json_value({})['executed'])
if __name__=='__main__': unittest.main()
