#!/usr/bin/env python3
from __future__ import annotations
import argparse, json
from pathlib import Path
from typing import Any

UNKNOWN_REVISIONS = {None, "", "unknown", "UNKNOWN", "not_applicable"}


def _explicit_revision(value: Any) -> bool:
    return value not in UNKNOWN_REVISIONS


def classify_pair(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    aid, bid = a.get("capability_id"), b.get("capability_id")
    ar, br = a.get("capability_revision"), b.get("capability_revision")
    asem, bsem = a.get("normalized_source_semantic_sha256"), b.get("normalized_source_semantic_sha256")
    afull, bfull = a.get("capability_card_canonical_sha256"), b.get("capability_card_canonical_sha256")

    if aid != bid:
        cls, action, hold = "separate_identity", "KEEP_SEPARATE", False
    elif asem == bsem:
        if ar == br:
            if afull == bfull:
                cls, action, hold = "exact_duplicate", "PRESERVE_OCCURRENCES_DEDUPLICATE_INDEX", False
            else:
                cls, action, hold = "run_metadata_variant", "IDENTICAL_SEMANTIC_SHARED_PRESERVE_RECEIPTS", False
        else:
            cls, action, hold = "revision_only", "PRESERVE_REVISION_LABELS_REVIEW_LINEAGE", False
    else:
        if ar == br and _explicit_revision(ar):
            cls, action, hold = "conflicting_duplicate", "CONFLICT_HOLD", True
        elif _explicit_revision(ar) and _explicit_revision(br) and ar != br:
            cls, action, hold = "revision_family", "PRESERVE_VERSIONED_FAMILY", False
        else:
            cls, action, hold = "ambiguous_duplicate", "CONFLICT_HOLD", True

    return {
        "schema": "axm.gei.module1-semantic-identity-classification/v1",
        "classification": cls,
        "recommended_action": action,
        "merge_hold": hold,
        "capability_id_a": aid,
        "capability_id_b": bid,
        "revision_a": ar,
        "revision_b": br,
        "semantic_digest_equal": asem == bsem,
        "full_card_digest_equal": afull == bfull,
        "truth_boundary": [
            "A differing full-card digest can be volatile run metadata rather than semantic conflict.",
            "Different capability IDs never auto-merge by similarity.",
            "Conflicting and ambiguous duplicates require explicit review.",
        ],
    }


def classify_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out=[]
    for i in range(len(records)):
        for k in range(i+1,len(records)):
            x=classify_pair(records[i],records[k])
            x["index_a"],x["index_b"]=i,k
            out.append(x)
    return out


def main() -> None:
    ap=argparse.ArgumentParser()
    ap.add_argument("records", type=Path)
    ap.add_argument("--out", type=Path)
    args=ap.parse_args()
    obj=json.loads(args.records.read_text(encoding="utf-8"))
    records=obj["records"] if isinstance(obj,dict) else obj
    result={"schema":"axm.gei.module1-semantic-identity-report/v1","record_count":len(records),"pairs":classify_records(records)}
    if args.out:
        args.out.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2,sort_keys=True))


if __name__ == "__main__":
    main()
