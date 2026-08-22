from __future__ import annotations
import copy
from .adapter import check_conformance
from .concurrency import ArtifactCell, has_wait_cycle
from .impact_cache import EvidenceCache
from .intake import IntakeEvidence, evaluate_intake
from .lifecycle import transition
from .migration import adapt_payload
from .observability import evaluate_service
from .offline import BoundedOfflineQueue, reconcile

def run_scenarios_v2() -> dict[str, object]:
    results = []
    def add(sid: str, passed: bool, observed: str) -> None:
        results.append({'scenario_id': sid, 'passed': bool(passed), 'observed': observed})
    add('SCN-11-ILLEGAL-STATE-JUMP', not transition('DRAFT', 'MERGED').ok, 'illegal jump denied')
    c = ArtifactCell(); c.acquire('A', 'L1'); c.cas_write('A', 'L1', 0, 'v1', 'k1')
    add('SCN-12-STALE-CAS', not c.cas_write('A', 'L1', 0, 'v2', 'k2')['ok'], 'stale revision denied')
    loss = adapt_payload({'module_id':'m','authority':{},'privacy':{}}, {'module_id'}, {'module_id','authority'})
    add('SCN-13-LOSSY-MIGRATION', not loss['ok'], 'required loss held')
    conflict = reconcile({'packet_id':'a','base_revision':1,'revision':2,'value':'L'}, {'packet_id':'b','base_revision':1,'revision':2,'value':'R'})
    add('SCN-14-OFFLINE-CONFLICT', not conflict['ok'], 'divergent same-base held')
    source = {'module_id':'m','proof_slice_id':'p','authority':{'allowed_actions':['read']},'privacy':{'classification':'private'},'evidence':{}}
    output = copy.deepcopy(source); output['authority']['allowed_actions'].append('write')
    add('SCN-15-ADAPTER-WIDENING', not check_conformance(source, output, required_fields=set(source))['ok'], 'authority widening denied')
    slo = evaluate_service(10, 100, False, [])
    add('SCN-16-SLO-FALSE-PROOF', not slo['accepted'], 'fast response not accepted as correct')
    cache = EvidenceCache(); _, first = cache.execute({'x':1}, 'v1', lambda: {'ok':True}); _, second = cache.execute({'x':1}, 'v1', lambda: {'ok':False})
    _, changed = cache.execute({'x':2}, 'v1', lambda: {'ok':True})
    add('SCN-17-CACHE-INVALIDATION', first == 'CACHE_MISS' and second == 'CACHE_HIT' and changed == 'CACHE_MISS', 'content change invalidated cache')
    held = evaluate_intake(IntakeEvidence(True, True, True, True, True, True, None))
    add('SCN-18-INTAKE-WITHOUT-OWNER', held['status'] == 'HELD_FOR_INTAKE', 'ownerless intake held')
    q = BoundedOfflineQueue(2); a=q.enqueue({'packet_id':'p1'}); b=q.enqueue({'packet_id':'p1'})
    add('SCN-19-DUPLICATE-REPLAY', a[0] and b == (True, 'DUPLICATE_SUPPRESSED') and len(q.packets)==1, 'duplicate suppressed')
    add('SCN-20-DEADLOCK-CYCLE', has_wait_cycle({'A':{'B'}, 'B':{'A'}}), 'wait cycle detected')
    return {'scenario_count': len(results), 'passed_count': sum(int(r['passed']) for r in results), 'passed': all(r['passed'] for r in results), 'results': results}
