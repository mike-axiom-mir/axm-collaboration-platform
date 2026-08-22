from __future__ import annotations
REQUIRED={'purpose','start','stop','rollback','truth_boundary','checksums','human_decision'}
def validate_handoff_kit(kit:dict)->dict:
    errors=[]; sections=kit.get('sections',{})
    missing=sorted(REQUIRED-set(sections))
    if missing: errors.append('MISSING_SECTIONS:'+','.join(missing))
    if kit.get('auto_execute'): errors.append('AUTO_EXECUTE_FORBIDDEN')
    if kit.get('start_file_count')!=1: errors.append('ONE_START_FILE_REQUIRED')
    if not kit.get('beginner_safe_language'): errors.append('BEGINNER_SAFE_LANGUAGE_REQUIRED')
    if sections.get('human_decision') in {None,'AUTO','IMPLIED'}: errors.append('EXPLICIT_HUMAN_DECISION_REQUIRED')
    return {'ok':not errors,'errors':errors,'state':'HANDOFF_READY' if not errors else 'HELD'}
