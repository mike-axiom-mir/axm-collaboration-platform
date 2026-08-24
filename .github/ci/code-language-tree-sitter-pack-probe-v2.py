#!/usr/bin/env python3
"""Corrections/additions layered over the v1 grammar census harness."""
from __future__ import annotations

import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "code-language-tree-sitter-pack-probe.py"
spec = importlib.util.spec_from_file_location("axm_tslp_probe_v1", SOURCE)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)

# Four v1 failures were fixture/representation issues, not reasons to discard the grammar.
mod.FIXTURES["cobol"] = (
    "IDENTIFICATION DIVISION.\n"
    "PROGRAM-ID. X.\n"
    "DATA DIVISION.\n"
    "WORKING-STORAGE SECTION.\n"
    "01 VALUE-X PIC 9 VALUE 1.\n"
    "PROCEDURE DIVISION.\n"
    "DISPLAY VALUE-X.\n"
    "STOP RUN.\n"
)
mod.FIXTURES["v"] = "fn main() { println('x') }\n"
mod.FIXTURES["smalltalk"] = "add: a to: b\n    ^a + b\n"
# SQL fallback is explicitly surface-only when a dedicated PL/SQL grammar is absent.
mod.FIXTURES["plsql"] = "SELECT 1;\n"

# Alias expansion for newer/less-standard grammar registry names.
mod.EXTRA_ALIASES["qml"] = ["qml", "qmljs"]
mod.EXTRA_ALIASES["plc-structured-text"] = [
    "iec61131",
    "iec_61131_3",
    "iec61131_3",
    "structured_text",
    "structuredtext",
    "iecst",
    "st",
]
mod.EXTRA_ALIASES["power-query-m"] = ["powerquery", "power_query", "powerquery_m", "m"]
mod.EXTRA_ALIASES["cypher"] = ["cypher", "neo4j_cypher"]
mod.EXTRA_ALIASES["raku"] = ["raku", "perl6"]
mod.EXTRA_ALIASES["opencl"] = ["opencl", "opencl_c"]

if __name__ == "__main__":
    mod.main()
