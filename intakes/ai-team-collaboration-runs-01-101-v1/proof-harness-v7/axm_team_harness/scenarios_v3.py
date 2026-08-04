
from __future__ import annotations
from .authority_v3 import Lease, delegate
from .disclosure import public_export
from .human_decision import DecisionReceipt, validate_decision
from .incident import IncidentController
from .independence import Lineage, evaluate_consensus
from .orchestrator_v3 import DryRunOrchestrator
from .privacy_taint import transform
from .proof_graph import reusable_evidence
from .resource_tree import BudgetTree
from .topology import SeatRouteLock, failover


def run_scenarios_v3() -> dict:
    results=[]
    p=Lease('p','human',frozenset({'read','propose'}),frozenset({'target'}),2,10,0,2)
    results.append({'id':'SCN-21-DELEGATION-WIDENING','passed':not delegate(p,child_id='c',holder='ai',actions={'write'},targets={'target'},privacy_scope=2,deadline_tick=9)['ok']})
    results.append({'id':'SCN-22-TAINT-LAUNDERING','passed':not transform([{'name':'x','label':'SECRET'}],{'label':'PUBLIC'})['ok']})
    a=Lineage('a','same','s','p','c','m'); b=Lineage('b','same','s','p','c','m')
    results.append({'id':'SCN-23-CORRELATED-CONSENSUS','passed':not evaluate_consensus([a,b],['yes','yes'],minimum_dimensions=2,dissent_preserved=True)['ok']})
    tree=BudgetTree(100); tree.reserve('a',70)
    results.append({'id':'SCN-24-BUDGET-OVERFLOW','passed':not tree.reserve('b',40)[0]})
    old={'contract_digest':'a','test_digest':'b','fixture_digest':'c','validator_digest':'d','source_digest':'e','passed':True}
    new=dict(old); new['validator_digest']='changed'
    results.append({'id':'SCN-25-STALE-EVIDENCE-REUSE','passed':not reusable_evidence(old,new)})
    results.append({'id':'SCN-26-SILENCE-AS-CONSENT','passed':not validate_decision(None,required_scope='x',now_tick=1)['ok']})
    ic=IncidentController(); ic.trip(['root','child'],['l1','l2'],'trip')
    results.append({'id':'SCN-27-PARTIAL-STOP-LEAK','passed':not ic.may_act('child','l2')[0]})
    lock=SeatRouteLock('identity','local',frozenset({'local','fallback'}),frozenset({'read'}),2)
    results.append({'id':'SCN-28-FAILOVER-IDENTITY-SWAP','passed':not failover(lock,requested_route='fallback',claimed_identity='other',requested_actions={'read'},requested_privacy_scope=2)['ok']})
    record={'module_id':'m','name':'n','status':'working','evidence_summary':'e','raw_prompt':'secret','claims':['tested'],'limitations':['not runtime']}
    results.append({'id':'SCN-29-PUBLIC-SECRET-LEAK','passed':public_export(record,allowlist={'module_id','name','status','evidence_summary','raw_prompt'},supported_claims={'tested'})['ok'] is False})
    o=DryRunOrchestrator(); r=o.execute(task_id='t',authority_ok=True,handoff_accepted=True,independent_verification=True,human_decision='ACCEPT',orchestrator_self_approval=True)
    results.append({'id':'SCN-30-ORCHESTRATOR-SELF-APPROVAL','passed':not r['ok']})
    return {'scenario_count':len(results),'results':results,'passed':all(x['passed'] for x in results)}
