#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, io, json, stat, zipfile
from pathlib import Path, PurePosixPath
from typing import Any


def sha256_bytes(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):
            h.update(chunk)
    return "sha256:"+h.hexdigest()


def _normalize(name: str) -> str:
    return str(PurePosixPath(name.replace("\\","/")))


def _probe_zip(z: zipfile.ZipFile, label: str, depth: int, max_depth: int) -> dict[str, Any]:
    blockers=[]; warnings=[]; entries=[]; seen={}; case_seen={}; total=0; max_ratio=0.0
    for info in z.infolist():
        raw=info.filename; norm=_normalize(raw); parts=PurePosixPath(norm).parts
        is_abs=raw.startswith("/") or (len(raw)>=3 and raw[1:3]==":/")
        traversal=".." in parts
        mode=(info.external_attr>>16)&0xFFFF
        symlink=stat.S_ISLNK(mode)
        encrypted=bool(info.flag_bits & 0x1)
        ratio=(info.file_size/max(info.compress_size,1)) if info.file_size else 0.0
        total+=info.file_size; max_ratio=max(max_ratio,ratio)
        rec={"path":raw,"normalized_path":norm,"size":info.file_size,"compressed_size":info.compress_size,
             "absolute_path":is_abs,"parent_traversal":traversal,"symlink":symlink,"encrypted":encrypted,
             "compression_ratio":round(ratio,4),"is_directory":info.is_dir()}
        entries.append(rec)
        if is_abs: blockers.append(f"{label}: absolute path: {raw}")
        if traversal: blockers.append(f"{label}: parent traversal: {raw}")
        if symlink: blockers.append(f"{label}: symbolic link: {raw}")
        if encrypted: blockers.append(f"{label}: encrypted entry: {raw}")
        if ratio>250 and info.file_size>1024*1024: blockers.append(f"{label}: suspicious compression ratio: {raw}")
        if norm in seen: blockers.append(f"{label}: duplicate normalized path: {norm}")
        seen[norm]=raw
        cf=norm.casefold()
        if cf in case_seen and case_seen[cf]!=norm: blockers.append(f"{label}: case-fold collision: {case_seen[cf]} <> {norm}")
        case_seen[cf]=norm
    if len(entries)>20000: blockers.append(f"{label}: entry count exceeds 20,000")
    if total>2*1024*1024*1024: blockers.append(f"{label}: uncompressed size exceeds 2 GiB")
    return {"label":label,"depth":depth,"entries":entries,"metrics":{"entry_count":len(entries),"total_uncompressed_bytes":total,"max_compression_ratio":round(max_ratio,4)},"blockers":sorted(set(blockers)),"warnings":sorted(set(warnings))}


def probe_module1_bundle(path: Path, profile: dict[str, Any], max_depth: int = 2) -> dict[str, Any]:
    expected_outer=profile["packages"]["final_intake_bundle"]["sha256"]
    expected_nested={
        profile["packages"]["module_payload"]["path"]:profile["packages"]["module_payload"]["sha256"],
        profile["packages"]["stable_anchor"]["path"]:profile["packages"]["stable_anchor"]["sha256"],
        profile["packages"]["handoff_status_addendum"]["path"]:profile["packages"]["handoff_status_addendum"]["sha256"],
    }
    result={"schema":"axm.gei.module1-nested-bundle-probe/v1","artifact":str(path),"artifact_present":path.exists(),
            "expected_outer_sha256":expected_outer,"actual_outer_sha256":None,"outer_hash_matches":False,
            "outer_probe":None,"nested":[],"required_layout":{},"blockers":[],"warnings":[],"active_package_admission_safe":False}
    if not path.exists():
        result["blockers"].append("Module 1 outer bundle bytes are not present.")
        result["report_hash"]=_digest(result);return result
    actual=sha256_file(path);result["actual_outer_sha256"]=actual;result["outer_hash_matches"]=actual==expected_outer
    if not result["outer_hash_matches"]: result["blockers"].append("Outer bundle SHA-256 does not match the stable handoff.")
    if not zipfile.is_zipfile(path):
        result["blockers"].append("Outer bundle is not a readable ZIP archive.")
        result["report_hash"]=_digest(result);return result
    with zipfile.ZipFile(path,"r") as z:
        outer=_probe_zip(z,"outer",0,max_depth);result["outer_probe"]=outer;result["blockers"]+=outer["blockers"]
        names=set(z.namelist())
        required=["INTAKE_MANIFEST.json","INTAKE_BUNDLE_FILE_INVENTORY_SHA256.json","CHECKSUMS_SHA256.txt",*expected_nested]
        for req in required:
            present=req in names; result["required_layout"][req]=present
            if not present: result["blockers"].append(f"Required outer entry missing: {req}")
        for nested_path, expected_hash in expected_nested.items():
            if nested_path not in names: continue
            data=z.read(nested_path); actual_hash=sha256_bytes(data)
            nested_rec={"path":nested_path,"expected_sha256":expected_hash,"actual_sha256":actual_hash,
                        "hash_matches":actual_hash==expected_hash,"zip_readable":False,"probe":None}
            if actual_hash!=expected_hash: result["blockers"].append(f"Nested artifact hash mismatch: {nested_path}")
            if zipfile.is_zipfile(io.BytesIO(data)):
                nested_rec["zip_readable"]=True
                with zipfile.ZipFile(io.BytesIO(data),"r") as nz:
                    pr=_probe_zip(nz,nested_path,1,max_depth);nested_rec["probe"]=pr;result["blockers"]+=pr["blockers"]
            else:
                result["blockers"].append(f"Nested artifact is not a readable ZIP: {nested_path}")
            result["nested"].append(nested_rec)
    result["blockers"]=sorted(set(result["blockers"]));result["warnings"]=sorted(set(result["warnings"]))
    result["active_package_admission_safe"]=not result["blockers"]
    result["report_hash"]=_digest(result);return result


def _canon(x: Any) -> bytes:
    return json.dumps(x,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()


def _digest(x: Any) -> str:
    return "sha256:"+hashlib.sha256(_canon(x)).hexdigest()


def main() -> None:
    ap=argparse.ArgumentParser();ap.add_argument("bundle",type=Path);ap.add_argument("--profile",type=Path,default=Path(__file__).with_name("MODULE1_INTAKE_PROFILE.json"));ap.add_argument("--out",type=Path)
    a=ap.parse_args();profile=json.loads(a.profile.read_text(encoding="utf-8"));r=probe_module1_bundle(a.bundle,profile)
    if a.out:a.out.write_text(json.dumps(r,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps({"status":"PASS" if r["active_package_admission_safe"] else "HOLD","artifact_present":r["artifact_present"],"outer_hash_matches":r["outer_hash_matches"],"blockers":r["blockers"],"report_hash":r["report_hash"]},indent=2))
    raise SystemExit(0 if r["active_package_admission_safe"] else 2)


if __name__=="__main__":main()
