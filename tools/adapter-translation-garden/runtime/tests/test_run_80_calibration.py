import unittest
from axm_translation_core import build_calibration_report,calibrate_confidence,calibration_gate
class CalibrationTests(unittest.TestCase):
    def good(self): return [{'confidence':.9,'outcome':1} for _ in range(18)]+[{'confidence':.1,'outcome':0} for _ in range(18)]
    def test_report(self): self.assertEqual(build_calibration_report(self.good())['valid_observations'],36)
    def test_good_gate(self): self.assertEqual(calibration_gate(build_calibration_report(self.good()),max_ece=.2,minimum_observations=20)['decision'],'REVIEWABLE')
    def test_low_count_holds(self): self.assertIn('insufficient_observations',calibration_gate(build_calibration_report(self.good()[:2]))['holds'])
    def test_bad_calibration_holds(self):
        bad=[{'confidence':1,'outcome':0} for _ in range(30)]; self.assertIn('calibration_error_high',calibration_gate(build_calibration_report(bad),max_ece=.1)['holds'])
    def test_invalid_visible(self): self.assertEqual(build_calibration_report([{'confidence':2,'outcome':1}])['invalid_observation_indices'],[0])
    def test_calibrates(self): self.assertEqual(calibrate_confidence(.9,build_calibration_report(self.good()))['decision'],'EVIDENCE_CALIBRATED')
    def test_insufficient_bin(self): self.assertEqual(calibrate_confidence(.5,build_calibration_report(self.good()))['decision'],'INSUFFICIENT_EVIDENCE')
    def test_invalid_raw(self):
        with self.assertRaises(ValueError): calibrate_confidence(2,build_calibration_report(self.good()))
    def test_no_override(self): self.assertFalse(calibration_gate(build_calibration_report(self.good()))['automatic_confidence_override'])
if __name__=='__main__': unittest.main()
