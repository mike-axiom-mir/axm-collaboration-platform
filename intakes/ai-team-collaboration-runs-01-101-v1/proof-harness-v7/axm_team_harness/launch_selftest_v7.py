from __future__ import annotations
import hashlib, json, os, platform, sys, tempfile
from pathlib import Path

def environment_fingerprint()->str:
    stable={'python_major_minor':list(sys.version_info[:2]),'implementation':platform.python_implementation(),'stdlib_only':True,'network_required':False}
    return hashlib.sha256(json.dumps(stable,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def run_launch_selftest()->dict:
    errors=[]
    if sys.version_info<(3,10): errors.append('PYTHON_TOO_OLD')
    try:
        payload={'b':2,'a':1}; a=json.dumps(payload,sort_keys=True,separators=(',',':')); b=json.dumps(payload,sort_keys=True,separators=(',',':'))
        if a!=b: errors.append('NONDETERMINISTIC_JSON')
        with tempfile.TemporaryDirectory(prefix='axm_launch_') as d:
            p=Path(d)/'probe.txt'; p.write_text('probe',encoding='utf-8')
            if p.read_text(encoding='utf-8')!='probe': errors.append('SCRATCH_IO_FAILED')
    except Exception: errors.append('SELFTEST_EXCEPTION')
    return {'ok':not errors,'errors':errors,'fingerprint':environment_fingerprint(),'stdlib_only':True,'network_used':False}
