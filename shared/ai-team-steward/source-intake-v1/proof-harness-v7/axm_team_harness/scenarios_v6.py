from __future__ import annotations
from .delegation_closure_v6 import ChildDelegation,evaluate_parent_close
from .authority_epoch_v6 import AuthorityPacket,validate_packet
from .evidence_custody_v6 import EvidenceRecord,disclose,verify_view
from .partial_failure_v6 import Step,plan_recovery
from .proof_compaction_v6 import build_merkle,inclusion_proof,verify
from .review_session_v6 import ReviewSession,checkpoint_digest,resume
from .causal_reconciliation_v6 import VersionedPacket,reconcile
from .proof_summary_v6 import make_summary,validate_summary
from .sandbox_intake_v6 import rehearse
from .readiness_gate_v6 import evaluate_readiness
import hashlib

def run_scenarios_v6()->dict:
    outcomes=[]
    outcomes.append(('orphan_child_blocks_close',not evaluate_parent_close('p',[ChildDelegation('c','missing','COMPLETED','r',True,True)])['ok']))
    p=AuthorityPacket('x',1,1,10,'read'); outcomes.append(('old_epoch_not_revived_after_clock_reset',not validate_packet(p,current_epoch=2,current_seq=1,allowed_actions={'read'})['ok']))
    rec=EvidenceRecord('e',{'claim':'x','source_digest':'s','limitations':['l'],'private_memory':'secret'},'h'); d=disclose(rec,allowed_fields={'claim','source_digest','limitations'},requested_fields={'claim'},redaction_reason='minimize'); d['view']['claim']='tampered'; outcomes.append(('disclosure_tamper_detected',not verify_view(rec,d)['ok']))
    pf=plan_recovery([Step('a',(),True,False,False),Step('b',('a',),True,True,True)]); outcomes.append(('irreversible_partial_failure_held',pf['status']=='HELD_RECOVERY_REQUIRED'))
    vals=['a','b','c','d']; t=build_merkle(vals); pr=inclusion_proof(t,1); outcomes.append(('merkle_tamper_rejected',not verify('changed',1,pr,t['root'])))
    s=ReviewSession('s','h',('i',),0,1); outcomes.append(('review_resume_digest_mismatch_held',not resume(s,'bad')['ok']))
    a=VersionedPacket('a',{'a':1,'b':0},2,'x'); b=VersionedPacket('b',{'a':0,'b':1},2,'y'); outcomes.append(('concurrent_packets_held',not reconcile(a,b,current_epoch=2)['ok']))
    ev={'a':'b'}; sm=make_summary(claim='unsupported',support_refs=['a'],limitations=['l'],unknowns=[],status='WORKING',evidence=ev); outcomes.append(('unsupported_summary_rejected',not validate_summary(sm,evidence=ev,supported_claims={'supported'},required_limitations={'l'})['ok']))
    data=b'x'; manifest={'a.txt':hashlib.sha256(data).hexdigest()}; outcomes.append(('sandbox_escape_rejected',not rehearse({'a.txt':data},manifest,[('../escape.txt',b'x')])['ok']))
    req={k:'x' for k in ['delegation_closure','authority_epoch','evidence_custody','partial_failure','proof_compaction','review_session','causal_reconciliation','proof_summary','sandbox_intake','limitations']}; rb={'evidence':req,'runtime_proven':False,'canon':False,'producer_id':'p','approval_actor':'p','approval_actor_kind':'HUMAN','novelty_status':'NOVEL_DELTA','rollback_clean':True}; outcomes.append(('self_approved_readiness_rejected',not evaluate_readiness(rb)['ok']))
    return {'scenario_count':len(outcomes),'passed':all(v for _,v in outcomes),'outcomes':[{'scenario':k,'passed':v} for k,v in outcomes]}
