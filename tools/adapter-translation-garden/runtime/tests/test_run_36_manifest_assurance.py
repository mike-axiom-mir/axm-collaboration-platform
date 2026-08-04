from __future__ import annotations
import json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
INDEX=json.loads((ROOT/'ASSURANCE_INDEX.json').read_text(encoding='utf-8'))
ENTRIES=INDEX['entries']
class Run36ManifestAssuranceTests(unittest.TestCase):
    def test_100_entries(self): self.assertEqual(len(ENTRIES),100)
    def test_numbers_exact(self): self.assertEqual({e['number'] for e in ENTRIES},set(range(1,101)))
    def test_ids_unique(self): self.assertEqual(len({e['id'] for e in ENTRIES}),100)
    def test_source_hash_locked(self): self.assertEqual(INDEX['source_sha256'],'b5c2a77acd863ded821735d4ecb43f499dbbe73c66457238888817b88fc86277')
    def test_source_records_match_numbers(self): self.assertTrue(all(e['source_record_number']==e['number'] for e in ENTRIES))
    def test_source_pack_preserved(self): self.assertTrue(all(e['source_pack']=='AXM_ADAPTERS_TRANSLATION_100_SEED_PACK.zip' for e in ENTRIES))
    def test_hash_shapes(self): self.assertTrue(all(re.fullmatch(r'[0-9a-f]{64}',e['manifest_contract_sha256']) for e in ENTRIES))
    def test_boundary_hash_shapes(self): self.assertTrue(all(re.fullmatch(r'[0-9a-f]{64}',e['boundaries_sha256']) for e in ENTRIES))
    def test_prototypes_have_implementation_hash(self): self.assertTrue(all(e['implementation_sha256'] for e in ENTRIES if e['status']=='LOCAL_PROTOTYPE'))
    def test_shadow_has_no_implementation_hash(self): self.assertTrue(all(e['implementation_sha256'] is None for e in ENTRIES if e['authority_mode']=='shadow_only'))
    def test_prototypes_have_public_api(self): self.assertTrue(all(e['public_api'] for e in ENTRIES if e['status']=='LOCAL_PROTOTYPE'))
    def test_shadow_has_empty_api(self): self.assertTrue(all(e['public_api']==[] for e in ENTRIES if e['authority_mode']=='shadow_only'))
    def test_folder_prefix_matches_number(self): self.assertTrue(all(e['folder'].startswith(f"{e['number']:03d}_") for e in ENTRIES))
    def test_no_bytecode_in_index(self): self.assertTrue(all(not any('__pycache__' in p or p.endswith('.pyc') for p in e['capsule_files_sha256']) for e in ENTRIES))
    def test_index_counts(self): self.assertEqual((INDEX['prototype_count'],INDEX['shadow_count']),(90,10))
if __name__=='__main__': unittest.main()
