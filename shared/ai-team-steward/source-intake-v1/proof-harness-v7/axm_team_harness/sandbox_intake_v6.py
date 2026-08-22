from __future__ import annotations
import hashlib, json, shutil, tempfile
from pathlib import Path

def digest_file(path:Path)->str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def rehearse(files:dict[str,bytes],manifest:dict[str,str],operations:list[tuple[str,bytes]])->dict:
    errors=[]; rolled_back=False; written=[]
    with tempfile.TemporaryDirectory(prefix='axm-intake-') as td:
        root=Path(td).resolve(); source=root/'source'; scratch=root/'scratch'; source.mkdir(); scratch.mkdir()
        for rel,data in files.items():
            p=(source/rel).resolve()
            if source not in p.parents: errors.append('SOURCE_PATH_TRAVERSAL'); continue
            p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(data)
        for rel,expected in manifest.items():
            p=(source/rel).resolve()
            if not p.exists() or digest_file(p)!=expected: errors.append('MANIFEST_MISMATCH')
        for rel,data in operations:
            p=(scratch/rel).resolve()
            if scratch not in p.parents: errors.append('OUTSIDE_SANDBOX_WRITE'); continue
            p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(data); written.append(str(p.relative_to(scratch)))
        shutil.rmtree(scratch); rolled_back=not scratch.exists()
    return {'ok':not errors and rolled_back,'errors':sorted(set(errors)),'written':sorted(written),'rollback_clean':rolled_back,'runtime_integrated':False}
