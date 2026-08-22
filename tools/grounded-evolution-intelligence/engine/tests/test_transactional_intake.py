from __future__ import annotations
import json,sys,unittest
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'transactional_intake'))
from package_probe import probe
from transactional_intake import run
class TransactionalIntakeTests(unittest.TestCase):
    def test_compatible_rehearsal_passes_without_commit(self):
        r=run(BASE/'transactional_intake/fixtures/compatible');q=r['receipt'];self.assertEqual(q['status'],'REHEARSAL_PASS');self.assertTrue(q['rehearsal_passed']);self.assertFalse(q['commit_eligible']);self.assertTrue(q['baseline']['canonical_unchanged']);self.assertTrue(all(a['hash_matches_manifest'] for a in q['artifacts']))
    def test_tampered_package_rejects_but_does_not_mutate(self):
        r=run(BASE/'transactional_intake/fixtures/tampered');q=r['receipt'];self.assertEqual(q['status'],'ACTIVE_MERGE_REJECTED');self.assertFalse(q['rehearsal_passed']);self.assertFalse(q['commit_eligible']);self.assertTrue(q['baseline']['canonical_unchanged']);self.assertTrue(any(not a['hash_matches_manifest'] for a in q['artifacts']))
    def test_unsafe_archive_path_rejects_even_when_hash_matches(self):
        r=run(BASE/'transactional_intake/fixtures/unsafe');q=r['receipt'];self.assertEqual(q['status'],'ACTIVE_MERGE_REJECTED');a=next(x for x in q['artifacts'] if x['module_id']=='axm:module:human-capability-atlas');self.assertTrue(a['hash_matches_manifest']);self.assertFalse(a['probe']['active_merge_safe']);self.assertTrue(any('traversal' in x.lower() for x in a['probe']['blockers']))
    def test_record_collision_holds_transaction(self):
        r=run(BASE/'transactional_intake/fixtures/conflict');self.assertEqual(r['receipt']['status'],'MERGE_HOLD');self.assertFalse(r['receipt']['commit_eligible']);self.assertTrue(r['receipt']['baseline']['canonical_unchanged'])
    def test_compatibility_matrix_has_cross_module_checks(self):
        m=run(BASE/'transactional_intake/fixtures/compatible')['matrix'];ids={x['check_id'] for x in m['checks']};self.assertIn('atlas-to-interface-capabilities',ids);self.assertIn('atlas-to-evolution-capabilities',ids);self.assertIn('interface-to-evolution-interfaces',ids);self.assertIn('record-collisions',ids);self.assertTrue(m['compatible'])
if __name__=='__main__':unittest.main()
