from __future__ import annotations
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'shared')]
from tools.module_loader import load_implementation

queue_mod=load_implementation(76)
package_mod=load_implementation(77)
select_mod=load_implementation(79)

q=queue_mod.enqueue([],{'note':'local AXM handoff'},item_id='item-1',idempotency_key='note-1',sequence=1,created_at='2026-07-27T00:00:00Z')['queue']
plan=queue_mod.plan_replay(q)
package=package_mod.create_package(str(plan['items'][0]['payload']).encode(),package_id='handoff-1',chunk_size=8)
verification=package_mod.verify_package(package)
selection=select_mod.run([
    {'id':'full','bandwidth_kbps':600,'power_cost':.8,'quality':1,'fidelity':1},
    {'id':'compact','bandwidth_kbps':80,'power_cost':.2,'quality':.7,'fidelity':.8},
],bandwidth_kbps=100,power_budget=.4)
print('AXM OFFLINE HANDOFF DEMO')
print('- replay items:',plan['count'])
print('- package chunks:',len(package['chunks']))
print('- integrity valid:',verification['valid'])
print('- selected representation:',selection['selected']['id'])
print('- network used: False')
