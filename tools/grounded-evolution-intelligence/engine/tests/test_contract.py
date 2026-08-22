import json, subprocess, sys, unittest
from pathlib import Path
from jsonschema import Draft202012Validator
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'scripts'))
from rebuild_state import rebuild

class ContractTests(unittest.TestCase):
    def test_all_schemas_are_valid(self):
        for p in (BASE/'schemas').glob('*.json'):
            Draft202012Validator.check_schema(json.loads(p.read_text()))

    def test_validation_script_passes(self):
        result=subprocess.run([sys.executable,str(BASE/'scripts/validate_contract.py')],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)

    def test_rebuild_is_deterministic(self):
        a=rebuild(BASE/'examples/event_stream.jsonl')
        b=rebuild(BASE/'examples/event_stream.jsonl')
        self.assertEqual(a,b)
        self.assertEqual(a['event_count'],11)

    def test_truth_state_separation(self):
        cap=json.loads((BASE/'examples/capability_record.json').read_text())
        iface=json.loads((BASE/'examples/interface_intelligence_reference.json').read_text())
        self.assertEqual(cap['declared_status'],'DECLARED')
        self.assertEqual(cap['proof_status'],'UNKNOWN')
        self.assertEqual(iface['truth_state'],'HYPOTHESIS')

if __name__=='__main__': unittest.main()
