from __future__ import annotations
import json,subprocess,sys,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PACKS=sorted((ROOT/'selective_packs').glob('*.zip'))
class Run44SelectivePackTests(unittest.TestCase):
    def test_90_packs(self): self.assertEqual(len(PACKS),90)
    def test_all_zip_integrity(self):
        for p in PACKS:
            with self.subTest(pack=p.name),zipfile.ZipFile(p) as z: self.assertIsNone(z.testzip())
    def test_all_one_root(self):
        for p in PACKS:
            with zipfile.ZipFile(p) as z: self.assertEqual(len({n.split('/')[0] for n in z.namelist()}),1)
    def test_required_pack_files(self):
        for p in PACKS:
            with self.subTest(pack=p.name),zipfile.ZipFile(p) as z:
                names=z.namelist(); self.assertTrue(any(n.endswith('/PACK_MANIFEST.json') for n in names)); self.assertTrue(any(n.endswith('/PACK_CHECKSUMS.sha256') for n in names)); self.assertTrue(any(n.endswith('/SMOKE_TEST.py') for n in names)); self.assertTrue(any(n.endswith('/ASSURANCE_PROFILE.json') for n in names))
    def test_no_unsafe_paths(self):
        for p in PACKS:
            with zipfile.ZipFile(p) as z:
                for n in z.namelist(): self.assertNotIn('..',Path(n).parts)
    def test_no_bytecode(self):
        for p in PACKS:
            with zipfile.ZipFile(p) as z: self.assertFalse(any('__pycache__' in n or n.endswith('.pyc') for n in z.namelist()))
    def test_pack_audit_passed(self):
        report=json.loads((ROOT/'SELECTIVE_PACK_AUDIT.json').read_text(encoding='utf-8')); self.assertEqual(report['smoke_passed'],90); self.assertEqual(report['failed'],[])
    def test_pack_manifests_default_disabled(self):
        for p in PACKS:
            with zipfile.ZipFile(p) as z:
                name=next(n for n in z.namelist() if n.endswith('/PACK_MANIFEST.json')); manifest=json.loads(z.read(name)); self.assertFalse(manifest['default_enabled'])
if __name__=='__main__': unittest.main()
