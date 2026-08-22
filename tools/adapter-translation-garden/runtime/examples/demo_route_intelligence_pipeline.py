from __future__ import annotations
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "shared")]
from tools.module_loader import load_implementation

registry=load_implementation(91)
planner=load_implementation(92)
scorer=load_implementation(93)
fallback=load_implementation(95)

graph=registry.run(
    [{'id':'json','kind':'format'},{'id':'canon','kind':'schema'},{'id':'local','kind':'runtime'}],
    [
        {'id':'json-canon','source':'json','target':'canon','verified':True,'enabled':True,'authority_mode':'decision_only','capabilities':['preserve_ids']},
        {'id':'canon-local','source':'canon','target':'local','verified':True,'enabled':True,'authority_mode':'decision_only','capabilities':['preserve_ids']},
    ],
)['graph']
routes=planner.run(graph,'json','local',required_capabilities=['preserve_ids'])['routes']
scored=scorer.run([{'id':'route-1','metrics':{'semantic_loss':0.05,'unknown_retention':1.0,'quality':0.9,'compute':0.2,'latency':0.1,'energy':0.1,'privacy':1.0,'reversibility':0.9,'proof':0.8}}],weights={'semantic_loss':2,'unknown_retention':1,'quality':1,'compute':0.5,'latency':0.5,'energy':0.25,'privacy':1,'reversibility':1,'proof':1})
selected=fallback.run([{'id':'route-1','preserved_semantics':['ids'],'degradations':[],'quality':0.9,'cost':0.1,'latency':0.1}],required_semantics=['ids'],allowed_degradations=[])
print(json.dumps({'routes':routes,'scores':scored['ranked'],'fallback':selected['selected'],'executed':False},indent=2))
