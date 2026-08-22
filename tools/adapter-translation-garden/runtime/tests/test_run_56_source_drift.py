import unittest
from axm_translation_core import build_source_snapshot, compare_source_snapshots, lineage_continuity_decision, summarize_source_drift
H='a'*64; J='b'*64
class SourceDriftTests(unittest.TestCase):
    def snap(self, records, t=10): return build_source_snapshot(records,'seed-pack',t)
    def test_unchanged_passes(self):
        a=self.snap([{'path':'a.txt','sha256':H,'size_bytes':1}]); self.assertEqual(compare_source_snapshots(a,a)['verdict'],'PASS')
    def test_changed_holds(self):
        a=self.snap([{'path':'a.txt','sha256':H,'size_bytes':1}]); b=self.snap([{'path':'a.txt','sha256':J,'size_bytes':1}]); self.assertEqual(compare_source_snapshots(a,b)['verdict'],'HOLD')
    def test_reviewed_change_can_pass_non_exact(self):
        a=self.snap([{'path':'a.txt','sha256':H,'size_bytes':1}]); b=self.snap([{'path':'a.txt','sha256':J,'size_bytes':1}]); r=compare_source_snapshots(a,b,[{'path':'a.txt','change':'CHANGED'}]); self.assertEqual(lineage_continuity_decision(r,False)['decision'],'CONTINUOUS')
    def test_exact_gate_still_holds_reviewed_change(self):
        a=self.snap([{'path':'a.txt','sha256':H,'size_bytes':1}]); b=self.snap([{'path':'a.txt','sha256':J,'size_bytes':1}]); r=compare_source_snapshots(a,b,[{'path':'a.txt','change':'CHANGED'}]); self.assertEqual(lineage_continuity_decision(r,True)['decision'],'HOLD')
    def test_added_removed_counted(self):
        a=self.snap([{'path':'a.txt','sha256':H,'size_bytes':1}]); b=self.snap([{'path':'b.txt','sha256':H,'size_bytes':1}]); s=summarize_source_drift(compare_source_snapshots(a,b)); self.assertEqual((s['added'],s['removed']),(1,1))
    def test_duplicate_refused(self):
        with self.assertRaises(ValueError): self.snap([{'path':'a','sha256':H,'size_bytes':1},{'path':'a','sha256':H,'size_bytes':1}])
    def test_unsafe_path_refused(self):
        with self.assertRaises(ValueError): self.snap([{'path':'../a','sha256':H,'size_bytes':1}])
if __name__=='__main__': unittest.main()
