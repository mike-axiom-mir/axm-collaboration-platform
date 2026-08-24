#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

TMP = Path(tempfile.mkdtemp(prefix="axm-last-mile-"))
REPORT = Path(os.environ.get("AXM_LAST_MILE_REPORT", "last-mile-census.json"))
NODE_ROOT = Path(os.environ.get("AXM_NODE_PROBE_ROOT", "/tmp/axm-node-probe"))
STATA_GRAMMAR = NODE_ROOT / "node_modules" / "tree-sitter-stata"
TREE_SITTER = NODE_ROOT / "node_modules" / ".bin" / "tree-sitter"


def write(relative: str, text: str) -> Path:
    p = TMP / relative
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


def run(name: str, evidence: str, command: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None):
    started = time.monotonic()
    try:
        cp = subprocess.run(
            command,
            cwd=str(cwd or TMP),
            env={**os.environ, **(env or {})},
            text=True,
            capture_output=True,
            timeout=60,
            check=False,
        )
        return {
            "languageId": name,
            "evidenceClass": evidence,
            "pass": cp.returncode == 0,
            "command": command,
            "exitCode": cp.returncode,
            "durationMs": round((time.monotonic() - started) * 1000),
            "stdout": cp.stdout[-1800:],
            "stderr": cp.stderr[-1800:],
            "error": None,
        }
    except Exception as exc:
        return {
            "languageId": name,
            "evidenceClass": evidence,
            "pass": False,
            "command": command,
            "exitCode": None,
            "durationMs": round((time.monotonic() - started) * 1000),
            "stdout": "",
            "stderr": "",
            "error": str(exc)[:800],
        }


results = []

# 1. Vyper: actual compiler front-end on a bounded contract.
vyper = write(
    "probe.vy",
    "# pragma version 0.4.3\n"
    "@external\n"
    "@pure\n"
    "def add(a: uint256, b: uint256) -> uint256:\n"
    "    return a + b\n",
)
results.append(run("vyper", "COMPILER", ["vyper", "-f", "abi", str(vyper)]))

# 2. Raku: interpreter/compiler syntax check.
raku = write("probe.raku", "sub add($a,$b){$a+$b}; die unless add(2,3)==5;\n")
results.append(run("raku", "COMPILER_PARSE", ["raku", "-c", str(raku)]))

# 3. ABAP: abaplint parser + explicit check_syntax rule.
abap_root = TMP / "abap"
(abap_root / "src").mkdir(parents=True, exist_ok=True)
(abap_root / "src" / "zprobe.prog.abap").write_text(
    "REPORT zprobe.\nDATA lv_x TYPE i VALUE 1.\nWRITE lv_x.\n",
    encoding="utf-8",
)
(abap_root / "abaplint.json").write_text(
    json.dumps({
        "global": {"files": "/src/**/*.*"},
        "syntax": {"version": "v758", "errorNamespace": "^(Y|Z)"},
        "rules": {"check_syntax": True},
    }),
    encoding="utf-8",
)
results.append(run("abap", "PARSER_SYNTAX_CHECK", ["abaplint", "abaplint.json"], cwd=abap_root))

# 4. DAX: dedicated ANTLR-derived lexer evidence. This is deliberately not called a full parser.
dax_script = write(
    "probe_dax.py",
    "from daxparser import get_columns_or_measures\n"
    "x=get_columns_or_measures(\"CALCULATE(SUM('Sales'[Amount]), 'Sales'[Region]=\\\"EU\\\")\")\n"
    "assert len(x)==2\n"
    "assert x[0].table=='Sales' and x[0].col_name=='Amount'\n"
    "assert x[1].table=='Sales' and x[1].col_name=='Region'\n",
)
results.append(run("dax", "DEDICATED_LEXER", ["python", str(dax_script)]))

# 5. Power Query M: Microsoft's parser must reach parse-stage OK.
pq_script = NODE_ROOT / "probe-powerquery.cjs"
pq_script.write_text(
    "const {DefaultSettings,TaskUtils}=require('@microsoft/powerquery-parser');\n"
    "(async()=>{const t=await TaskUtils.tryLexParse(DefaultSettings,'let x = 1, y = x + 4 in y');"
    "if(!TaskUtils.isParseStageOk(t)){console.error(t.error?.message||'parse failed');process.exit(1);}" 
    "if(!t.ast){process.exit(2);} console.log('POWER_QUERY_PARSE_OK');})().catch(e=>{console.error(e);process.exit(3);});\n",
    encoding="utf-8",
)
results.append(run("power-query-m", "PARSER_AST", ["node", str(pq_script)], cwd=NODE_ROOT))

# 6. Stata: dedicated pinned Tree-sitter grammar, not the broad language pack.
stata = write("probe.do", "clear\nset obs 1\ngenerate x = 1\nsummarize x\n")
results.append(
    run(
        "stata",
        "TREE_SITTER_GRAMMAR",
        [str(TREE_SITTER), "parse", "--grammar-path", str(STATA_GRAMMAR), str(stata)],
        cwd=STATA_GRAMMAR,
    )
)

# 7. PLC Structured Text: dedicated IEC 61131-3 grammar with Python bindings.
plc_script = write(
    "probe_plc.py",
    "import tree_sitter, tree_sitter_iec61131_3_st as st\n"
    "lang=tree_sitter.Language(st.language())\n"
    "p=tree_sitter.Parser(lang)\n"
    "src=b'PROGRAM Probe\\nVAR x : INT; END_VAR\\nx := 1;\\nEND_PROGRAM\\n'\n"
    "t=p.parse(src)\n"
    "assert not t.root_node.has_error, t.root_node.sexp() if hasattr(t.root_node,'sexp') else str(t.root_node)\n",
)
results.append(run("plc-structured-text", "IEC61131_TREE_SITTER_GRAMMAR", ["python", str(plc_script)]))

# 8. COBOL: actual GnuCOBOL compiler front-end syntax proof.
cobol = write(
    "probe.cob",
    "IDENTIFICATION DIVISION.\n"
    "PROGRAM-ID. PROBE.\n"
    "DATA DIVISION.\n"
    "WORKING-STORAGE SECTION.\n"
    "01 X PIC 9 VALUE 1.\n"
    "PROCEDURE DIVISION.\n"
    "DISPLAY X.\n"
    "STOP RUN.\n",
)
results.append(run("cobol", "COMPILER_PARSE", ["cobc", "-free", "-fsyntax-only", str(cobol)]))

# 9. T-SQL: SQLFluff parser with its T-SQL dialect selected explicitly.
tsql = write("probe.sql", "DECLARE @x INT = 1; SELECT TOP (1) @x AS value;\n")
results.append(run("tsql", "DIALECT_PARSER", ["sqlfluff", "parse", "--dialect", "tsql", str(tsql)]))

summary = {
    "schema": "axm.code-language-last-mile-census/v1",
    "status": "TEST",
    "targetCount": 9,
    "passCount": sum(1 for r in results if r["pass"]),
    "failCount": sum(1 for r in results if not r["pass"]),
    "passingOrgans": [r["languageId"] for r in results if r["pass"]],
    "failedOrgans": [r["languageId"] for r in results if not r["pass"]],
    "daxFullParserClaimed": False,
    "semanticCorrectnessClaimed": False,
    "runtimeCorrectnessClaimed": False,
    "authority": "NONE",
}
REPORT.write_text(json.dumps({"summary": summary, "results": results}, indent=2) + "\n", encoding="utf-8")
print(json.dumps(summary, indent=2))
print(f"AXM_LAST_MILE_REPORT={REPORT}")
# Trial census: preserve failures as evidence; the union gate decides readiness.
