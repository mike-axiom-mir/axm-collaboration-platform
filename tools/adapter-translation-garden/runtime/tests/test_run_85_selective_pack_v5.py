import json,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; CURRENT=json.loads((ROOT/'garden_manifest.json').read_text())['selective_pack_revision']
class PackAdaptiveLineageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.packs=sorted((ROOT/'selective_packs').glob('*.zip'))
    def data(self,p):
        with zipfile.ZipFile(p) as z:
            r=z.namelist()[0].split('/')[0]; return r,z,json.loads(z.read(r+'/PACK_MANIFEST.json'))
    def test_count(self): self.assertEqual(len(self.packs),90)
    def test_current_revision(self):
        for p in self.packs:
            with zipfile.ZipFile(p) as z:
                r=z.namelist()[0].split('/')[0]; self.assertEqual(json.loads(z.read(r+'/PACK_MANIFEST.json'))['pack_revision'],CURRENT)
    def test_adaptive_profiles_preserved(self):
        for p in self.packs:
            with zipfile.ZipFile(p) as z:
                r=z.namelist()[0].split('/')[0]; a=json.loads(z.read(r+'/ADAPTIVE_PROFILE.json')); self.assertFalse(a['automatic_routing']); self.assertFalse(a['automatic_degradation'])
    def test_forward_delta(self):
        for p in self.packs:
            with zipfile.ZipFile(p) as z:
                r=z.namelist()[0].split('/')[0]; d=json.loads(z.read(r+'/EVIDENCE_DELTA.json')); self.assertTrue(d['lossless']); self.assertEqual(d['to_pack_revision'],CURRENT); self.assertEqual(d['from_pack_revision'],CURRENT-1)
    def test_no_automatic_install(self):
        for p in self.packs:
            with zipfile.ZipFile(p) as z:
                r=z.namelist()[0].split('/')[0]; self.assertFalse(json.loads(z.read(r+'/PACK_MANIFEST.json'))['automatic_install'])
if __name__=='__main__': unittest.main()
