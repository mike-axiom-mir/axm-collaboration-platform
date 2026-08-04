import json,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; PACKS=sorted((ROOT/'selective_packs').glob('*.zip'))
CURRENT_REVISION=json.loads((ROOT/'garden_manifest.json').read_text())['selective_pack_revision']
class SelectivePackLineageTests(unittest.TestCase):
    def data(self,p):
        with zipfile.ZipFile(p) as z:
            root=z.namelist()[0].split('/')[0]; return json.loads(z.read(root+'/PACK_MANIFEST.json')),json.loads(z.read(root+'/CAPABILITY_PROFILE.json')),json.loads(z.read(root+'/COMPOSITION_HINT.json')),json.loads(z.read(root+'/EFFECTIVENESS_PROFILE.json'))
    def test_90_current_revision(self): self.assertEqual(sum(self.data(p)[0]['pack_revision']==CURRENT_REVISION for p in PACKS),90)
    def test_capability_profiles_preserved(self): self.assertTrue(all(self.data(p)[1]['module_id']==self.data(p)[0]['module_id'] for p in PACKS))
    def test_composition_is_plan_only(self): self.assertTrue(all(self.data(p)[2]['automatic_execution'] is False for p in PACKS))
    def test_effectiveness_is_heuristic(self): self.assertTrue(all(self.data(p)[3]['heuristic_only'] is True for p in PACKS))
    def test_revision_lineage_is_forward(self): self.assertTrue(all(self.data(p)[0]['previous_pack_revision']==CURRENT_REVISION-1 for p in PACKS))
    def test_no_install(self): self.assertTrue(all(self.data(p)[0]['automatic_install'] is False for p in PACKS))
    def test_audit_counts(self):
        a=json.loads((ROOT/'SELECTIVE_PACK_AUDIT.json').read_text()); self.assertEqual(a['packs'],90); self.assertEqual(a['smoke_passed'],90); self.assertEqual(a['checksum_passed'],90); self.assertEqual(a['baseline_compatible'],90)
if __name__=='__main__': unittest.main()
