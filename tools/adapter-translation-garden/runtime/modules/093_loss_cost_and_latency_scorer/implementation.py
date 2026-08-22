from __future__ import annotations
from typing import Any

_BENEFITS={'unknown_retention','quality','privacy','reversibility','proof'}
_COSTS={'semantic_loss','compute','latency','energy'}


def score(route: dict[str, Any], weights: dict[str,float]) -> dict[str, Any]:
    metrics=route.get('metrics',{}); contributions={}; errors=[]; total=0.0
    for name,weight in weights.items():
        if name not in _BENEFITS|_COSTS: errors.append(f'unknown metric:{name}'); continue
        if name not in metrics: errors.append(f'missing metric:{name}'); continue
        value=metrics[name]
        if not isinstance(value,(int,float)) or isinstance(value,bool) or value<0 or value>1: errors.append(f'out of range:{name}'); continue
        contribution=float(weight)*float(value)*(1 if name in _BENEFITS else -1); contributions[name]=round(contribution,9); total+=contribution
    return {'id':route.get('id'),'score':round(total,9),'contributions':contributions,'errors':errors,'metrics':metrics}


def run(routes: list[dict[str, Any]], *, weights: dict[str,float]) -> dict[str, Any]:
    scored=[score(route,weights) for route in routes]; valid=[x for x in scored if not x['errors']]; invalid=[x for x in scored if x['errors']]
    valid.sort(key=lambda x:(-x['score'],str(x['id']))); top=[x for x in valid if valid and x['score']==valid[0]['score']]
    return {'schema':'axm.translation.route-scores/v1','verdict':'SCORED' if valid else 'REFUSE','ranked':valid,'invalid':invalid,'tie_at_top':len(top)>1,'formula':{'benefits':sorted(_BENEFITS),'costs':sorted(_COSTS),'weights':weights},'executed':False}
