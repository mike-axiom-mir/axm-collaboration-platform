from __future__ import annotations
import hashlib
from .registry_v6 import load_registry_v6
from .runner_v5 import run_all_v5
from .delegation_closure_v6 import ChildDelegation,evaluate_parent_close
from .authority_epoch_v6 import AuthorityPacket,validate_packet
from .evidence_custody_v6 import EvidenceRecord,commit,disclose,verify_view
from .partial_failure_v6 import Step,plan_recovery
from .proof_compaction_v6 import build_merkle,inclusion_proof,verify,changed_branches
from .review_session_v6 import ReviewSession,checkpoint_digest,review_next,resume
from .causal_reconciliation_v6 import VersionedPacket,reconcile
from .proof_summary_v6 import make_summary,validate_summary,evidence_digest
from .sandbox_intake_v6 import rehearse
from .readiness_gate_v6 import evaluate_readiness
from .scenarios_v6 import run_scenarios_v6

METRICS=[
'parent_closure_valid','active_child_blocks_close','missing_receipt_blocks_close','orphan_blocks_close',
'current_epoch_authorized','stale_epoch_rejected','expired_packet_rejected','clock_reset_no_revive',
'authorized_disclosure_valid','forbidden_field_rejected','custody_tamper_detected','source_commitment_preserved',
'independent_success_preserved','dependent_step_rolled_back','irreversible_failure_held','compensation_ledger_complete',
'merkle_root_built','inclusion_proof_valid','tampered_proof_rejected','semantic_branch_change_detected',
'review_session_progressed','digest_mismatch_held','fatigue_pause_preserved','emergency_not_autoapproved',
'causal_dominance_selected','concurrent_conflict_held','stale_epoch_reconciliation_rejected','equal_payload_reconciled',
'proof_summary_valid','unsupported_claim_rejected','omitted_limitation_rejected','reconstruction_mismatch_rejected',
'sandbox_rehearsal_passed','path_traversal_rejected','manifest_mismatch_rejected','rollback_cleanup_passed',
'readiness_candidate_passed','incomplete_bundle_held','runtime_claim_rejected_v6','canon_claim_rejected_v6','self_approval_rejected_v6','no_novel_delta_rejected_v6']

def run_all_v6()->dict:
    reg=load_registry_v6(); counts={k:0 for k in METRICS}; per=[]
    for e in reg['entries']:
        n=e['seed_number']; mid=e['module_id']; ps=e['proof_slice_id']
        # 82 delegation closure
        good=[ChildDelegation('c','p','COMPLETED',f'r{n}',True,True)]
        cg=evaluate_parent_close('p',good)
        ca=evaluate_parent_close('p',[ChildDelegation('c','p','ACTIVE',f'r{n}',True,True)])
        cm=evaluate_parent_close('p',[ChildDelegation('c','p','COMPLETED',None,True,True)])
        co=evaluate_parent_close('p',[ChildDelegation('c','missing','COMPLETED',f'r{n}',True,True)])
        counts['parent_closure_valid']+=int(cg['ok']); counts['active_child_blocks_close']+=int(not ca['ok']); counts['missing_receipt_blocks_close']+=int(not cm['ok']); counts['orphan_blocks_close']+=int(not co['ok'])
        # 83 epochs
        ep=e['authority_epoch_profile']; epoch=ep['epoch']; p=AuthorityPacket(f'p{n}',epoch,10,20,'read')
        vg=validate_packet(p,current_epoch=epoch,current_seq=11,allowed_actions={'read'})
        vs=validate_packet(p,current_epoch=epoch+1,current_seq=11,allowed_actions={'read'})
        vx=validate_packet(p,current_epoch=epoch,current_seq=21,allowed_actions={'read'})
        vr=validate_packet(AuthorityPacket(f'r{n}',epoch-1,1,99,'read'),current_epoch=epoch,current_seq=1,allowed_actions={'read'})
        counts['current_epoch_authorized']+=int(vg['ok']); counts['stale_epoch_rejected']+=int(not vs['ok']); counts['expired_packet_rejected']+=int(not vx['ok']); counts['clock_reset_no_revive']+=int(not vr['ok'])
        # 84 evidence custody
        payload={'claim':mid,'source_digest':ps,'limitations':['not runtime'],'status':'WORKING','private_memory':'private','secret_note':'secret'}; rec=EvidenceRecord(f'e{n}',payload,'human'); cmt=commit(rec)
        vd=disclose(rec,allowed_fields={'claim','source_digest','limitations','status'},requested_fields={'claim','source_digest','limitations'},redaction_reason='minimum necessary')
        vf=disclose(rec,allowed_fields={'claim','source_digest','limitations','status'},requested_fields={'private_memory'},redaction_reason='bad')
        tam=disclose(rec,allowed_fields={'claim','source_digest'},requested_fields={'claim'},redaction_reason='min'); tam['view']['claim']='changed'; vt=verify_view(rec,tam)
        counts['authorized_disclosure_valid']+=int(vd['ok'] and verify_view(rec,vd)['ok']); counts['forbidden_field_rejected']+=int(not vf['ok']); counts['custody_tamper_detected']+=int(not vt['ok']); counts['source_commitment_preserved']+=int(cmt['commitment']==vd['receipt']['source_commitment'])
        # 85 partial failure
        steps=[Step('a',(),True,True,True),Step('b',(),True,False,True),Step('c',('b',),True,True,True),Step('d',(),True,False,False)]
        pf=plan_recovery(steps)
        counts['independent_success_preserved']+=int('a' in pf['preserve']); counts['dependent_step_rolled_back']+=int('c' in pf['rollback']); counts['irreversible_failure_held']+=int('d' in pf['held']); counts['compensation_ledger_complete']+=int(pf['ledger_complete'])
        # 86 compaction
        vals=[mid,ps,e['critical_invariant'],e['hold_rule']]; tree=build_merkle(vals); proof=inclusion_proof(tree,1)
        counts['merkle_root_built']+=int(len(tree['root'])==64); counts['inclusion_proof_valid']+=int(verify(ps,1,proof,tree['root'])); counts['tampered_proof_rejected']+=int(not verify(ps+'x',1,proof,tree['root'])); counts['semantic_branch_change_detected']+=int(changed_branches(vals,[mid,ps,e['critical_invariant']+' changed',e['hold_rule']])==[2])
        # 87 review sessions
        rs=ReviewSession(f's{n}','human',(mid,'limitations'),0,2); rr=review_next(rs,'REVIEWED',effort=1); bad=resume(rr['session'],'bad'); fatigue=review_next(rr['session'],'REVIEWED',effort=2); emergency=review_next(rs,'REVIEWED',effort=1,emergency_priority=True)
        counts['review_session_progressed']+=int(rr['ok'] and rr['session'].cursor==1); counts['digest_mismatch_held']+=int(not bad['ok']); counts['fatigue_pause_preserved']+=int(not fatigue['ok'] and fatigue['session'].paused); counts['emergency_not_autoapproved']+=int(emergency['ok'] and not emergency['approved'])
        # 88 causal reconciliation
        epoch=ep['epoch']; a=VersionedPacket('a',{'a':2,'b':1},epoch,ps); b=VersionedPacket('b',{'a':1,'b':1},epoch,mid); dom=reconcile(a,b,current_epoch=epoch)
        con=reconcile(VersionedPacket('a',{'a':1,'b':0},epoch,'x'),VersionedPacket('b',{'a':0,'b':1},epoch,'y'),current_epoch=epoch)
        stale=reconcile(VersionedPacket('a',{'a':1},epoch-1,'x'),VersionedPacket('b',{'a':1},epoch,'x'),current_epoch=epoch)
        eq=reconcile(VersionedPacket('a',{'a':1},epoch,'x'),VersionedPacket('b',{'a':1},epoch,'x'),current_epoch=epoch)
        counts['causal_dominance_selected']+=int(dom['ok'] and dom['selected']=='A'); counts['concurrent_conflict_held']+=int(not con['ok']); counts['stale_epoch_reconciliation_rejected']+=int(not stale['ok']); counts['equal_payload_reconciled']+=int(eq['ok'])
        # 89 proof summaries
        evidence={'contract':ps,'negative':mid,'limitations':['not runtime']}; goodsm=make_summary(claim='deterministic proof passed',support_refs=[ps],limitations=['not runtime'],unknowns=['AXM runtime'],status='WORKING',evidence=evidence)
        vsm=validate_summary(goodsm,evidence=evidence,supported_claims={'deterministic proof passed'},required_limitations={'not runtime'})
        unsupported={**goodsm,'claim':'runtime proven'}; vu=validate_summary(unsupported,evidence=evidence,supported_claims={'deterministic proof passed'},required_limitations={'not runtime'})
        omit={**goodsm,'limitations':[]}; vo=validate_summary(omit,evidence=evidence,supported_claims={'deterministic proof passed'},required_limitations={'not runtime'})
        mismatch={**goodsm,'reconstruction_digest':'0'*64}; vm=validate_summary(mismatch,evidence=evidence,supported_claims={'deterministic proof passed'},required_limitations={'not runtime'})
        counts['proof_summary_valid']+=int(vsm['ok']); counts['unsupported_claim_rejected']+=int(not vu['ok']); counts['omitted_limitation_rejected']+=int(not vo['ok']); counts['reconstruction_mismatch_rejected']+=int(not vm['ok'])
        # 90 sandbox intake
        data=(mid+'\n').encode(); manifest={'seed.txt':hashlib.sha256(data).hexdigest()}; sb=rehearse({'seed.txt':data},manifest,[('output/result.txt',ps.encode())]); tr=rehearse({'seed.txt':data},manifest,[('../escape.txt',b'x')]); mm=rehearse({'seed.txt':data},{'seed.txt':'0'*64},[])
        counts['sandbox_rehearsal_passed']+=int(sb['ok']); counts['path_traversal_rejected']+=int(not tr['ok']); counts['manifest_mismatch_rejected']+=int(not mm['ok']); counts['rollback_cleanup_passed']+=int(sb['rollback_clean'])
        # 91 readiness
        req={k:f'{k}:{n}' for k in ['delegation_closure','authority_epoch','evidence_custody','partial_failure','proof_compaction','review_session','causal_reconciliation','proof_summary','sandbox_intake','limitations']}
        base={'evidence':req,'runtime_proven':False,'canon':False,'producer_id':f'p{n}','approval_actor':'human','approval_actor_kind':'HUMAN','novelty_status':'NOVEL_DELTA','rollback_clean':True}
        rg=evaluate_readiness(base); ri=evaluate_readiness({**base,'evidence':{'delegation_closure':'x'}}); rruntime=evaluate_readiness({**base,'runtime_proven':True}); rcanon=evaluate_readiness({**base,'canon':True}); rself=evaluate_readiness({**base,'approval_actor':f'p{n}'}); rno=evaluate_readiness({**base,'novelty_status':'NO_NOVEL_DELTA'})
        counts['readiness_candidate_passed']+=int(rg['ok']); counts['incomplete_bundle_held']+=int(not ri['ok']); counts['runtime_claim_rejected_v6']+=int(not rruntime['ok']); counts['canon_claim_rejected_v6']+=int(not rcanon['ok']); counts['self_approval_rejected_v6']+=int(not rself['ok']); counts['no_novel_delta_rejected_v6']+=int(not rno['ok'])
        per.append({'seed_number':n,'module_id':mid,'proof_slice_id':ps,
          'run82':cg['ok'] and not ca['ok'] and not cm['ok'] and not co['ok'],
          'run83':vg['ok'] and not vs['ok'] and not vx['ok'] and not vr['ok'],
          'run84':vd['ok'] and not vf['ok'] and not vt['ok'] and cmt['commitment']==vd['receipt']['source_commitment'],
          'run85':'a' in pf['preserve'] and 'c' in pf['rollback'] and 'd' in pf['held'] and pf['ledger_complete'],
          'run86':len(tree['root'])==64 and verify(ps,1,proof,tree['root']) and not verify(ps+'x',1,proof,tree['root']),
          'run87':rr['ok'] and not bad['ok'] and not fatigue['ok'] and emergency['ok'] and not emergency['approved'],
          'run88':dom['ok'] and not con['ok'] and not stale['ok'] and eq['ok'],
          'run89':vsm['ok'] and not vu['ok'] and not vo['ok'] and not vm['ok'],
          'run90':sb['ok'] and not tr['ok'] and not mm['ok'] and sb['rollback_clean'],
          'run91':rg['ok'] and not ri['ok'] and not rruntime['ok'] and not rcanon['ok'] and not rself['ok'] and not rno['ok']})
    v5=run_all_v5(); scenarios=run_scenarios_v6(); passed=all(v==100 for v in counts.values()) and all(all(r[f'run{x}'] for x in range(82,92)) for r in per) and v5['passed'] and scenarios['passed']
    return {'harness_version':'0.6.0','registry_digest':reg['registry_digest'],'seed_count':100,'counts':counts,'per_seed':per,'scenario_suite_v6':scenarios,'v5_regression_passed':v5['passed'],'passed':passed,'canon':False,'axm_runtime_integrated':False,'max_status':'READY_FOR_HUMAN_REVIEWED_LOCAL_SANDBOX_BINDING_CANDIDATE'}
