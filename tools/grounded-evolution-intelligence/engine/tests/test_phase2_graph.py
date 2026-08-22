from __future__ import annotations
import json, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE / 'graph_builder'))
sys.path.insert(0, str(BASE / 'graph_queries'))
from build_graph import build
from query_engine import load_graph, capability_dependents, overlapping_providers, top_unproven_blockers, largest_verified_scope_improvement, modules_without_current_evidence

class Phase2GraphTests(unittest.TestCase):
    def test_graph_build_is_deterministic(self):
        first = build(); second = build()
        self.assertEqual(first['graph_hash'], second['graph_hash'])
        stored = json.loads((BASE / 'graphs' / 'full_graph.json').read_text())
        self.assertEqual(first['graph_hash'], stored['graph_hash'])

    def test_graph_validator_passes(self):
        result = subprocess.run([sys.executable, str(BASE / 'graph_validation' / 'validate_graph.py')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, msg=result.stdout + '\n' + result.stderr)
        report = json.loads((BASE / 'generated' / 'phase2_graph_validation_report.json').read_text())
        self.assertTrue(report['acceptance_passed'])
        self.assertEqual(report['dependency_cycles'], [])
        self.assertEqual(report['orphan_node_ids'], [])

    def test_proof_gate_queries_answer(self):
        graph = load_graph()
        deps = capability_dependents(graph, 'axm:capability:live-technical-ground-truth')
        ids = {x['module_id'] for x in deps['direct_modules']}
        self.assertIn('axm:module:ai-team', ids)
        self.assertIn('axm:module:grounded-evolution-intelligence', ids)
        overlap = overlapping_providers(graph, 'technical ground truth')
        providers = {x['module_id'] for x in overlap['providers']}
        self.assertIn('axm:module:ai-team', providers)
        self.assertIn('axm:module:technical-glasses', providers)
        self.assertIsNotNone(top_unproven_blockers(graph)['top'])
        self.assertEqual(largest_verified_scope_improvement(graph)['top']['need_id'], 'axm:need:build-capability-proof-ladder')
        self.assertEqual(modules_without_current_evidence(graph)['count'], 0)

    def test_atlas_and_interface_coverage(self):
        graph = load_graph()
        local_caps = {n['id'] for n in graph['nodes'] if n['type'] == 'CAPABILITY' and n['local_or_external'] == 'LOCAL'}
        atlas = {e['source'] for e in graph['edges'] if e['relationship'] == 'INTERPRETED_BY_ATLAS'}
        hii = {e['source'] for e in graph['edges'] if e['relationship'] == 'INTERFACE_ANALYSIS_CANDIDATE'}
        self.assertEqual(local_caps, atlas)
        self.assertEqual(local_caps, hii)

    def test_continuous_event_log_extends_phase1(self):
        phase1 = [json.loads(x) for x in (BASE / 'event_log' / 'phase1_events.jsonl').read_text().splitlines() if x.strip()]
        phase2 = [json.loads(x) for x in (BASE / 'event_log' / 'phase2_full_events.jsonl').read_text().splitlines() if x.strip()]
        self.assertGreater(len(phase2), len(phase1))
        self.assertEqual(phase2[:len(phase1)], phase1)
        self.assertEqual(phase2[len(phase1)]['previous_event_hash'], phase1[-1]['event_hash'])

if __name__ == '__main__':
    unittest.main()
