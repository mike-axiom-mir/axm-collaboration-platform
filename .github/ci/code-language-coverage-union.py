#!/usr/bin/env python3
"""Fail closed unless every one of the exact 102 AXM language organs has bounded evidence."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ORGAN_ROOT = REPO / "shared" / "code-capability-fabric" / "language-organs" / "organs"
EVIDENCE_ROOT = Path(os.environ.get("AXM_EVIDENCE_ROOT", "evidence"))
REPORT = Path(os.environ.get("AXM_UNION_REPORT", "code-language-coverage-union.json"))


def load_json(path: Path):
    if not path.is_file():
        raise SystemExit(f"MISSING_EVIDENCE:{path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_expected():
    organs = []
    for p in sorted(ORGAN_ROOT.glob("*/organ.json")):
        organ = json.loads(p.read_text(encoding="utf-8"))
        organs.append({
            "priority": organ["priority"],
            "organId": organ["organId"],
            "languageId": organ["languageId"],
            "descriptorSha256": organ["sha256"],
        })
    if len(organs) != 102:
        raise SystemExit(f"EXPECTED_102_ORGANS_GOT:{len(organs)}")
    ids = [o["languageId"] for o in organs]
    if len(ids) != len(set(ids)):
        raise SystemExit("DUPLICATE_EXPECTED_LANGUAGE_ID")
    return organs


def digest_json(value) -> str:
    data = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


expected = load_expected()
expected_ids = {o["languageId"] for o in expected}

toolchain = load_json(EVIDENCE_ROOT / "toolchain" / "toolchain-census.json")
grammar = load_json(EVIDENCE_ROOT / "grammar" / "tree-sitter-grammar-census.json")
last_mile = load_json(EVIDENCE_ROOT / "last-mile" / "last-mile-census.json")

for label, doc in [("toolchain", toolchain), ("grammar", grammar), ("last-mile", last_mile)]:
    if not isinstance(doc.get("results"), list):
        raise SystemExit(f"INVALID_RESULTS:{label}")

observed_ids = {
    r.get("languageId")
    for doc in (toolchain, grammar, last_mile)
    for r in doc["results"]
    if isinstance(r.get("languageId"), str)
}
unknown_ids = sorted(observed_ids - expected_ids)
if unknown_ids:
    raise SystemExit("UNKNOWN_EVIDENCE_LANGUAGE_IDS:" + ",".join(unknown_ids))

by_language = {language_id: [] for language_id in expected_ids}
for r in toolchain["results"]:
    if r.get("languageId") in by_language and r.get("smokePass") is True:
        evidence_class = ((r.get("smoke") or {}).get("probeClass") or "NATIVE_SMOKE")
        by_language[r["languageId"]].append({
            "source": "stock-native-toolchain",
            "evidenceClass": evidence_class,
        })
for r in grammar["results"]:
    if r.get("languageId") in by_language and r.get("pass") is True:
        by_language[r["languageId"]].append({
            "source": "tree-sitter-language-pack-1.14.3",
            "evidenceClass": r.get("representation") or "STRUCTURAL_GRAMMAR",
            "grammar": r.get("grammarSelected"),
        })
for r in last_mile["results"]:
    if r.get("languageId") in by_language and r.get("pass") is True:
        by_language[r["languageId"]].append({
            "source": "last-mile-pinned-front-end",
            "evidenceClass": r.get("evidenceClass") or "LAST_MILE",
        })

uncovered = sorted([language_id for language_id, evidence in by_language.items() if not evidence])

# DAX cannot close the 102 gate on lexer-only evidence. Require the full ANTLR parser proof.
dax_classes = {e["evidenceClass"] for e in by_language.get("dax", [])}
if "ANTLR_FULL_PARSER" not in dax_classes:
    uncovered = sorted(set(uncovered + ["dax"]))

rows = []
for organ in expected:
    rows.append({
        **organ,
        "covered": organ["languageId"] not in uncovered,
        "evidence": by_language[organ["languageId"]],
    })

summary = {
    "schema": "axm.code-language-evidence-union/v1",
    "status": "TEST",
    "expectedOrganCount": 102,
    "coveredCount": 102 - len(uncovered),
    "uncoveredCount": len(uncovered),
    "uncoveredOrgans": uncovered,
    "stockNativeSmokePassCount": sum(1 for r in toolchain["results"] if r.get("smokePass") is True),
    "grammarPackPassCount": sum(1 for r in grammar["results"] if r.get("pass") is True),
    "lastMilePassCount": sum(1 for r in last_mile["results"] if r.get("pass") is True),
    "daxFullParserEvidence": "ANTLR_FULL_PARSER" in dax_classes,
    "semanticCorrectnessClaimed": False,
    "runtimeCorrectnessClaimed": False,
    "allAreLiteralCompilersClaimed": False,
    "authority": "NONE",
}
summary["coverageDigest"] = digest_json(rows)
REPORT.write_text(json.dumps({"summary": summary, "organs": rows}, indent=2) + "\n", encoding="utf-8")
print(json.dumps(summary, indent=2))
print(f"AXM_UNION_REPORT={REPORT}")
if uncovered:
    raise SystemExit(1)
