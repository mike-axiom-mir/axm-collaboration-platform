#!/usr/bin/env python3
"""Bounded structural grammar probe for the 102 AXM code-language organs.

This is CI evidence only. A grammar parse proves structural parser availability,
not runtime correctness, semantic correctness, compiler availability, or authority.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from tree_sitter_language_pack import get_parser, has_language

REPO = Path(__file__).resolve().parents[2]
ORGAN_ROOT = REPO / "shared" / "code-capability-fabric" / "language-organs" / "organs"
REPORT = Path(os.environ.get("AXM_GRAMMAR_REPORT", "tree-sitter-grammar-census.json"))

EXTRA_ALIASES = {
    "bash-posix-shell": ["bash", "shell"],
    "powershell": ["powershell"],
    "docker": ["dockerfile", "docker"],
    "cpp": ["cpp", "c++"],
    "csharp": ["c_sharp", "csharp"],
    "fsharp": ["fsharp", "f_sharp"],
    "github-actions": ["yaml"],
    "hcl-terraform": ["hcl", "terraform"],
    "protocol-buffers": ["proto", "protobuf"],
    "json-schema": ["json"],
    "openapi": ["json", "yaml"],
    "bazel-starlark": ["starlark", "python"],
    "gradle-dsl": ["groovy", "kotlin"],
    "maven-pom": ["xml"],
    "kubernetes-manifests": ["yaml"],
    "helm-templates": ["gotmpl", "go_template", "yaml"],
    "ansible": ["yaml"],
    "webassembly-wat": ["wat", "wasm"],
    "assembly": ["asm", "nasm", "gas"],
    "objective-c": ["objc", "objective_c"],
    "matlab-octave": ["matlab"],
    "ada-spark": ["ada"],
    "visual-basic-dotnet": ["vb", "visual_basic", "visual_basic_dotnet"],
    "delphi-object-pascal": ["pascal"],
    "common-lisp": ["commonlisp", "common_lisp"],
    "scheme-racket": ["scheme", "racket"],
    "rescript-reason": ["rescript", "reason"],
    "plsql": ["plsql", "sql"],
    "tsql": ["tsql", "sql"],
    "power-query-m": ["powerquery", "power_query", "m"],
    "systemverilog": ["systemverilog", "verilog"],
    "plc-structured-text": ["iecst", "structured_text", "st"],
    "ladder-logic": ["xml"],
    "tree-sitter-query": ["query", "tree_sitter_query"],
}

FIXTURES = {
    "html": "<p>x</p>\n",
    "python": "x = 1\n",
    "javascript": "const x = 1;\n",
    "typescript": "const x: number = 1;\n",
    "css": "a { color: red; }\n",
    "json": '{"x":1}\n',
    "yaml": "x: 1\n",
    "bash-posix-shell": "x=1\n",
    "powershell": "$x = 1\n",
    "sql": "SELECT 1;\n",
    "toml": "x = 1\n",
    "docker": "FROM scratch\n",
    "go": "package p\nvar X = 1\n",
    "rust": "fn main() {}\n",
    "csharp": "class X {}\n",
    "java": "class X {}\n",
    "c": "int x;\n",
    "cpp": "int x;\n",
    "markdown": "# x\n",
    "xml": "<x/>\n",
    "makefile": "all:\n\t@true\n",
    "cmake": "set(X 1)\n",
    "github-actions": "name: x\non: [push]\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n",
    "hcl-terraform": "locals { x = 1 }\n",
    "nix": "{ x = 1; }\n",
    "kotlin": "val x: Int = 1\n",
    "php": "<?php $x = 1;\n",
    "ruby": "x = 1\n",
    "swift": "let x = 1\n",
    "dart": "final x = 1;\n",
    "lua": "local x = 1\n",
    "graphql": "type Query { x: Int }\n",
    "protocol-buffers": 'syntax = "proto3"; message X {}\n',
    "json-schema": '{"type":"object"}\n',
    "openapi": '{"openapi":"3.1.0","info":{"title":"x","version":"1"},"paths":{}}\n',
    "bazel-starlark": "x = 1\n",
    "gradle-dsl": "def x = 1\n",
    "maven-pom": "<project><modelVersion>4.0.0</modelVersion></project>\n",
    "kubernetes-manifests": "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: x\n",
    "helm-templates": "x: 1\n",
    "ansible": "- hosts: all\n  gather_facts: false\n  tasks: []\n",
    "r": "x <- 1\n",
    "julia": "x = 1\n",
    "scala": "val x = 1\n",
    "elixir": "x = 1\n",
    "erlang": "-module(x).\n",
    "clojure": "(def x 1)\n",
    "fsharp": "let x = 1\n",
    "ocaml": "let x = 1\n",
    "haskell": "x = 1\n",
    "zig": "const x: i32 = 1;\n",
    "webassembly-wat": "(module)\n",
    "assembly": "mov eax, 1\n",
    "cuda": "__global__ void k() {}\n",
    "opencl": "__kernel void k() {}\n",
    "wgsl": "@compute @workgroup_size(1) fn main() {}\n",
    "glsl": "void main() {}\n",
    "hlsl": "float4 main() : SV_Target { return 1; }\n",
    "objective-c": "@interface X @end\n",
    "groovy": "def x = 1\n",
    "perl": "my $x = 1;\n",
    "matlab-octave": "x = 1;\n",
    "fortran": "program x\nend program x\n",
    "cobol": "IDENTIFICATION DIVISION.\nPROGRAM-ID. X.\nPROCEDURE DIVISION.\nSTOP RUN.\n",
    "ada-spark": "procedure X is begin null; end X;\n",
    "visual-basic-dotnet": "Module X\nEnd Module\n",
    "delphi-object-pascal": "program X; begin end.\n",
    "common-lisp": "(defparameter *x* 1)\n",
    "scheme-racket": "(define x 1)\n",
    "prolog": "x(1).\n",
    "solidity": "pragma solidity ^0.8.0; contract X {}\n",
    "move": "module 0x1::x {}\n",
    "vyper": "x: uint256\n",
    "nim": "let x = 1\n",
    "crystal": "x = 1\n",
    "d": "int x = 1;\n",
    "v": "fn main() { x := 1; _ = x }\n",
    "raku": "my $x = 1;\n",
    "tcl": "set x 1\n",
    "smalltalk": "| x | x := 1.\n",
    "elm": "module Main exposing (..)\nx = 1\n",
    "purescript": "module Main where\nx = 1\n",
    "rescript-reason": "let x = 1\n",
    "gdscript": "var x = 1\n",
    "qml": "import QtQuick 2.0\nItem {}\n",
    "apex": "public class X {}\n",
    "abap": "REPORT zx.\nDATA x TYPE i.\n",
    "plsql": "BEGIN NULL; END;\n",
    "tsql": "SELECT 1;\n",
    "sparql": "SELECT * WHERE { ?s ?p ?o }\n",
    "cypher": "MATCH (n) RETURN n\n",
    "dax": "X = 1\n",
    "power-query-m": "let x = 1 in x\n",
    "sas": "data x; x=1; run;\n",
    "stata": "generate x = 1\n",
    "verilog": "module x; endmodule\n",
    "systemverilog": "module x; logic a; endmodule\n",
    "vhdl": "entity x is end entity; architecture a of x is begin end architecture;\n",
    "plc-structured-text": "PROGRAM X\nVAR x : INT; END_VAR\nEND_PROGRAM\n",
    "ladder-logic": '<pou pouType="program"><body><LD/></body></pou>\n',
    "regex": "^(axm)-[0-9]+$\n",
    "tree-sitter-query": "(identifier) @id\n",
}


def load_organs():
    out = []
    for p in sorted(ORGAN_ROOT.glob("*/organ.json")):
        out.append(json.loads(p.read_text(encoding="utf-8")))
    return out


def aliases(language_id: str):
    raw = [language_id, language_id.replace("-", "_"), language_id.replace("-", "")]
    return list(dict.fromkeys(EXTRA_ALIASES.get(language_id, []) + raw))


def representation(language_id: str, grammar: str):
    if language_id == "ladder-logic" and grammar == "xml":
        return "PLCOPEN_XML_SURFACE"
    if language_id in {"github-actions", "kubernetes-manifests", "ansible"} and grammar == "yaml":
        return "YAML_SURFACE"
    if language_id == "helm-templates" and grammar == "yaml":
        return "YAML_SURFACE_ONLY_TEMPLATE_SEMANTICS_UNPROVEN"
    if language_id == "maven-pom" and grammar == "xml":
        return "XML_SURFACE"
    if language_id in {"json-schema", "openapi"} and grammar in {"json", "yaml"}:
        return f"{grammar.upper()}_SURFACE"
    if language_id == "gradle-dsl" and grammar in {"groovy", "kotlin"}:
        return "HOST_LANGUAGE_SURFACE"
    if language_id in {"plsql", "tsql"} and grammar == "sql":
        return "SQL_FALLBACK_SURFACE"
    return "LANGUAGE_GRAMMAR"


def main():
    organs = load_organs()
    results = []
    for organ in organs:
        lid = organ["languageId"]
        fixture = FIXTURES.get(lid)
        chosen = None
        attempted = []
        error = None
        root_type = None
        has_error = None
        for name in aliases(lid):
            try:
                supported = bool(has_language(name))
            except Exception as exc:
                attempted.append({"name": name, "supported": None, "error": str(exc)[:300]})
                continue
            attempted.append({"name": name, "supported": supported})
            if not supported:
                continue
            chosen = name
            if fixture is None:
                error = "NO_NONEMPTY_FIXTURE"
                break
            try:
                parser = get_parser(name)
                tree = parser.parse(fixture.encode("utf-8"))
                root = tree.root_node
                root_type = getattr(root, "type", None)
                has_error = bool(getattr(root, "has_error", True))
                if root_type == "ERROR":
                    has_error = True
            except Exception as exc:
                error = str(exc)[:600]
                has_error = True
            break
        passed = bool(chosen and fixture and has_error is False and not error)
        results.append({
            "priority": organ["priority"],
            "organId": organ["organId"],
            "languageId": lid,
            "displayName": organ["displayName"],
            "grammarSelected": chosen,
            "representation": representation(lid, chosen) if chosen else None,
            "fixtureSha256": hashlib.sha256((fixture or "").encode("utf-8")).hexdigest() if fixture else None,
            "rootType": root_type,
            "hasError": has_error,
            "pass": passed,
            "error": error,
            "attempted": attempted,
        })

    passed = [r for r in results if r["pass"]]
    direct = [r for r in passed if r["representation"] == "LANGUAGE_GRAMMAR"]
    surface = [r for r in passed if r["representation"] != "LANGUAGE_GRAMMAR"]
    unsupported = [r for r in results if r["grammarSelected"] is None]
    parse_failed = [r for r in results if r["grammarSelected"] and not r["pass"]]
    summary = {
        "schema": "axm.code-language-grammar-census/v1",
        "status": "TEST",
        "organCount": len(results),
        "grammarParsePassCount": len(passed),
        "directLanguageGrammarPassCount": len(direct),
        "surfaceRepresentationPassCount": len(surface),
        "unsupportedGrammarCount": len(unsupported),
        "selectedGrammarParseFailCount": len(parse_failed),
        "semanticCorrectnessClaimed": False,
        "compilerAvailabilityClaimed": False,
        "authority": "NONE",
        "passingOrgans": [r["languageId"] for r in passed],
        "surfaceOnlyOrgans": [r["languageId"] for r in surface],
        "unsupportedOrgans": [r["languageId"] for r in unsupported],
        "parseFailedOrgans": [r["languageId"] for r in parse_failed],
    }
    REPORT.write_text(json.dumps({"summary": summary, "results": results}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    print(f"AXM_GRAMMAR_REPORT={REPORT}")
    if len(results) != 102:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
