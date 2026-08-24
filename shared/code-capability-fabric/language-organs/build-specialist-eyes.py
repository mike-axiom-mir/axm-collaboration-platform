#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ORGANS = ROOT / "organs"
HUMAN = ROOT / "human-developer-perspective.json"

FAMILY_HINTS = {
    "web": ["browser surface", "user interface", "web runtime", "accessibility", "client-server boundary"],
    "data-config": ["configuration contract", "data interchange", "schema shape", "machine-readable document"],
    "shell": ["automation", "process orchestration", "environment setup", "command pipeline"],
    "sql-query": ["data query", "analytics", "data model", "set-oriented transformation", "transaction boundary"],
    "build": ["build graph", "dependency graph", "reproducible build", "generated artifact"],
    "infrastructure": ["deployment", "infrastructure", "environment configuration", "resource graph"],
    "native": ["systems boundary", "performance-sensitive code", "memory layout", "ABI", "native library"],
    "jvm": ["JVM service", "enterprise application", "managed runtime", "JVM dependency graph"],
    "dotnet": [".NET application", "managed runtime", "Windows integration", "assembly boundary"],
    "scripting": ["automation", "glue code", "rapid iteration", "embedded scripting"],
    "mobile-app": ["mobile application", "cross-platform UI", "device application"],
    "api-schema": ["API contract", "schema evolution", "cross-language contract", "generated client"],
    "beam": ["fault tolerance", "distributed concurrency", "actor process", "supervision"],
    "functional": ["immutable transformation", "algebraic data model", "functional pipeline", "property-based reasoning"],
    "lisp": ["macro system", "symbolic transformation", "interactive language", "code-as-data"],
    "logic": ["rule system", "inference", "constraint search", "declarative logic"],
    "gpu-shader": ["GPU", "parallel compute", "graphics pipeline", "shader stage"],
    "wasm": ["portable sandbox", "WebAssembly", "cross-language module", "browser-native binary"],
    "scientific": ["numerical computing", "scientific model", "statistics", "matrix computation"],
    "blockchain": ["smart contract", "on-chain state", "resource ownership", "transactional asset"],
    "enterprise": ["enterprise platform", "business object", "platform metadata", "managed cloud runtime"],
    "hardware": ["digital hardware", "RTL", "timing", "signal", "industrial control"],
    "pattern": ["structural search", "pattern matching", "capture", "syntax query"],
}

LANGUAGE_HINTS_RAW = {
"html":"document structure|semantic markup|accessibility|browser content model",
"python":"automation|data tooling|glue code|machine learning|rapid scripting",
"javascript":"browser runtime|Node.js|event-driven application|dynamic web behavior",
"typescript":"typed JavaScript|frontend architecture|API models|type-safe web code",
"css":"layout|responsive design|visual styling|animation|design tokens",
"json":"data interchange|serialization|machine configuration|API payload",
"yaml":"human-readable configuration|CI configuration|deployment manifest|structured configuration",
"bash-posix-shell":"Unix automation|process pipeline|bootstrap script|portable shell",
"powershell":"Windows automation|object pipeline|system administration|Microsoft environment",
"sql":"relational data|joins|aggregation|window analytics|transactions",
"toml":"typed configuration|package manifest|tool configuration|simple config",
"docker":"container image|reproducible runtime|deployment packaging|build layers",
"go":"network service|concurrency|static binary|cloud service|simple deployment",
"rust":"memory safety|systems programming|safe concurrency|FFI|zero-cost abstraction",
"csharp":".NET service|Unity|Windows application|managed enterprise code",
"java":"JVM service|enterprise backend|Android legacy|portable managed runtime",
"c":"embedded system|ABI|device code|low-level runtime|portable systems code",
"cpp":"game engine|high performance|native library|templates|systems application",
"markdown":"documentation|human-readable technical notes|README|structured prose",
"xml":"namespaced document|enterprise interchange|schema-bound document|legacy protocol",
"makefile":"incremental build|target dependency|simple native build|command build graph",
"cmake":"cross-platform native build|toolchain generation|C/C++ project configuration",
"github-actions":"CI pipeline|GitHub automation|build matrix|repository workflow",
"hcl-terraform":"cloud infrastructure|declarative resource plan|stateful infrastructure|provider graph",
"nix":"reproducible environment|hermetic package|declarative system|dependency pinning",
"kotlin":"Android|JVM modernization|coroutines|null safety|concise JVM code",
"php":"server-rendered web|CMS|web backend|shared hosting",
"ruby":"Rails|developer tooling|DSL|rapid web backend|automation",
"swift":"iOS|macOS|Apple platform|native mobile UI",
"dart":"Flutter|cross-platform mobile UI|single-codebase application",
"lua":"embedded scripting|game scripting|configuration language|small runtime",
"graphql":"typed API|client-selected fields|graph-shaped API|schema-driven endpoint",
"protocol-buffers":"IDL|RPC contract|binary serialization|cross-language messages",
"json-schema":"JSON validation|configuration contract|payload schema|machine validation",
"openapi":"HTTP API contract|client generation|API documentation|endpoint schema",
"bazel-starlark":"large monorepo build|hermetic build|remote cache|build rule DSL",
"gradle-dsl":"JVM build|Android build|plugin build logic|dependency management",
"maven-pom":"JVM dependency lifecycle|enterprise Java build|artifact coordinates",
"kubernetes-manifests":"container orchestration|cluster resource|service deployment|Kubernetes API",
"helm-templates":"templated Kubernetes|chart packaging|environment overlays|reusable deployment",
"ansible":"configuration management|remote automation|fleet setup|idempotent operations",
"r":"statistics|data analysis|visualization|research computing",
"julia":"high-performance numerical work|scientific computing|multiple dispatch|research model",
"scala":"Spark|JVM functional code|distributed data|typed functional service",
"elixir":"fault-tolerant web service|high concurrency|Phoenix|distributed application",
"erlang":"telecom|fault tolerance|distributed actor system|soft real-time service",
"clojure":"immutable JVM data|REPL workflow|macro DSL|data-oriented system",
"fsharp":"typed functional .NET|domain modeling|data transformation|functional service",
"ocaml":"compiler tooling|typed functional system|language tooling|symbolic transformation",
"haskell":"pure functional model|strong types|property testing|compiler or DSL work",
"zig":"explicit systems code|C interop|cross compilation|manual allocation",
"webassembly-wat":"WebAssembly inspection|portable binary module|sandbox boundary|low-level wasm",
"assembly":"CPU instruction|boot code|micro-optimization|architecture-specific routine",
"cuda":"NVIDIA GPU compute|massively parallel kernel|accelerated numerical work",
"opencl":"heterogeneous compute|GPU kernel|portable accelerator|parallel numerical work",
"wgsl":"WebGPU|browser GPU|shader compute|modern web graphics",
"glsl":"OpenGL shader|Vulkan shader|graphics pipeline|GPU rendering",
"hlsl":"DirectX shader|Windows graphics|GPU rendering|compute shader",
"objective-c":"Cocoa legacy|Apple runtime interop|Objective-C framework|older iOS macOS code",
"groovy":"Gradle DSL|Jenkins pipeline|dynamic JVM scripting|testing DSL",
"perl":"text processing|regex-heavy automation|legacy Unix scripting|report processing",
"matlab-octave":"matrix computation|engineering model|signal processing|numerical prototype",
"fortran":"HPC|scientific legacy|numerical simulation|array-intensive compute",
"cobol":"mainframe business|batch records|financial transaction processing|legacy enterprise",
"ada-spark":"safety-critical system|formal contracts|embedded control|high-integrity software",
"visual-basic-dotnet":"legacy .NET|Windows desktop|Office integration|business application",
"delphi-object-pascal":"native desktop|legacy Windows application|Pascal codebase|RAD application",
"common-lisp":"symbolic AI|macro-heavy DSL|interactive image|code transformation",
"scheme-racket":"language design|education|macro DSL|program transformation",
"prolog":"rules|knowledge base|inference|constraint search|logic query",
"solidity":"Ethereum|EVM smart contract|DeFi|on-chain state",
"move":"resource-oriented smart contract|digital asset|blockchain ownership|Aptos Sui style module",
"vyper":"auditable Ethereum contract|minimal smart contract|EVM safety|DeFi contract",
"nim":"compiled scripting|C interop|metaprogramming|small native binary",
"crystal":"Ruby-like compiled service|native web backend|typed scripting style",
"d":"systems programming|native application|metaprogramming|C++ alternative",
"v":"simple systems language|small static binary|C interop|fast compile",
"raku":"text grammar|expressive scripting|language parsing|automation",
"tcl":"embedded command language|EDA scripting|GUI automation|tool scripting",
"smalltalk":"live object system|image-based development|reflective application|object modeling",
"elm":"reliable frontend|functional UI|no-runtime-error web app|model-update-view",
"purescript":"typed functional frontend|JavaScript target|functional web application",
"rescript-reason":"typed JavaScript interop|frontend|OCaml-style web code|safe JS boundary",
"gdscript":"Godot game|gameplay scripting|scene logic|rapid game iteration",
"qml":"Qt UI|declarative desktop UI|embedded interface|property binding",
"apex":"Salesforce|CRM business logic|cloud trigger|Salesforce service",
"abap":"SAP|ERP business logic|internal table|enterprise transaction",
"plsql":"Oracle database logic|stored procedure|data-near computation|database package",
"tsql":"SQL Server|stored procedure|Microsoft data platform|database logic",
"sparql":"RDF|semantic web|knowledge graph|triple query",
"cypher":"property graph|Neo4j|graph traversal|relationship query",
"dax":"Power BI|tabular model|measure|business analytics|filter context",
"power-query-m":"ETL|Power BI ingestion|data shaping|query transformation",
"sas":"regulated analytics|clinical statistics|enterprise statistics|batch analytics",
"stata":"econometrics|social science statistics|panel data|research analysis",
"verilog":"RTL|digital logic|FPGA|ASIC|hardware module",
"systemverilog":"RTL verification|assertion|testbench|hardware verification|ASIC FPGA",
"vhdl":"strongly typed RTL|FPGA|ASIC|digital hardware|simulation",
"plc-structured-text":"industrial automation|PLC|control loop|machine control|IEC 61131-3",
"ladder-logic":"PLC maintenance|relay logic|industrial control|operator-readable control",
"regex":"text validation|extraction|pattern search|log parsing",
"tree-sitter-query":"AST structural search|syntax capture|code indexing|structural pattern",
}
LANGUAGE_HINTS = {k: v.split("|") for k, v in LANGUAGE_HINTS_RAW.items()}

PRESSURE_REASONS = {
    "speed": "SPEED_PRESSURE_DECLARED",
    "time-pressure": "TIME_PRESSURE_DECLARED",
    "knowledge-gap": "KNOWLEDGE_GAP_DECLARED",
    "unknown-option": "OPTION_NOT_KNOWN_DECLARED",
    "default-stack": "DEFAULT_STACK_BIAS_DECLARED",
    "tooling-unavailable": "TOOLING_UNAVAILABLE_DECLARED",
    "legacy-constraint": "LEGACY_CONSTRAINT_DECLARED",
    "compatibility": "COMPATIBILITY_PRESSURE_DECLARED",
}


def canon(v):
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def digest_obj(v) -> str:
    return hashlib.sha256(canon(v).encode("utf-8")).hexdigest()


def uniq(xs):
    seen = set()
    out = []
    for x in xs:
        if not isinstance(x, str):
            continue
        x = x.strip()
        if x and x.lower() not in seen:
            seen.add(x.lower())
            out.append(x)
    return out


def question_set(p):
    unit = p["grammar"]["compilationOrDocumentUnit"]
    paradigm = p["grammar"]["paradigm"]
    hazards = p["analysis"]["semanticHazards"]
    first_hazard = hazards[0]
    return [
        f"What system goal is this {unit} serving, not merely what syntax does it contain?",
        f"Does the current design actually benefit from {paradigm}, or is the grammar being used by habit?",
        f"Where does {first_hazard} change the risk or impact model?",
        "Which callers, schemas, build steps, runtime boundaries, timing assumptions, or generated artifacts change with this decision?",
        "What credible alternative grammar or architecture should be compared before locking the implementation shape?",
        "Which native verifier or counterexample would most quickly falsify this eye's current hypothesis?",
        "What non-obvious rationale should be preserved for the next maintainer?",
    ]


def build_eye(p, human_digest, human_dimensions):
    lid = p["languageId"]
    family = p["family"]
    native = uniq(
        LANGUAGE_HINTS.get(lid, [])
        + FAMILY_HINTS.get(family, [])
        + [p["grammar"]["paradigm"], p["grammar"]["compilationOrDocumentUnit"]]
        + p["grammar"]["constructs"][:8]
        + p["analysis"]["semanticHazards"][:6]
    )
    body = {
        "schema": "axm.code.language-specialist-eye.v1",
        "version": "1.0.0",
        "status": "TEST",
        "priority": p["priority"],
        "eyeId": f"code.eye.{lid}.v1",
        "organId": p["organId"],
        "languageId": lid,
        "displayName": p["displayName"],
        "family": family,
        "kind": p["kind"],
        "organDigest": p["organDigest"],
        "grammarProfileDigest": p["profileSha256"],
        "humanPerspectiveDigest": human_digest,
        "perspective": {
            "paradigm": p["grammar"]["paradigm"],
            "nativeUnit": p["grammar"]["compilationOrDocumentUnit"],
            "dialectsOrVariants": p["grammar"]["dialectsOrVariants"],
            "seesFirst": p["grammar"]["constructs"],
            "dependencyAnchors": p["grammar"]["dependencyForms"],
            "semanticHazards": p["analysis"]["semanticHazards"],
            "verifierInstincts": p["verification"]["focus"],
            "opportunitySignals": native,
        },
        "humanDeveloperLens": {
            "inherits": human_dimensions,
            "nativeQuestions": question_set(p),
            "reviewPurpose": "Understand goals, system context, patterns, alternatives, impact, evidence and rationale through this grammar's native perspective.",
        },
        "capabilityGap": {
            "detects": [
                "NATIVE_GRAMMAR_GAP",
                "VERIFICATION_GAP",
                "MISSING_LANGUAGE_NATIVE_ABSTRACTION",
                "CROSS_LANGUAGE_OPPORTUNITY",
                "SEMANTIC_HAZARD_EXPOSURE",
                "UNRESOLVED_DEPENDENCY_BOUNDARY",
            ],
            "routePolicy": {
                "nativePresent": "REUSE_AND_REVIEW",
                "adjacentOpportunity": "DISCOVER_AND_COMPARE",
                "weakSignal": "HOLD_FOR_MORE_EVIDENCE",
                "unsupported": "NOT_RELEVANT",
            },
            "automaticRepair": False,
            "automaticLanguageSwitch": False,
        },
        "discoverySeam": {
            "schema": "axm.code-native-discovery-seam/v1",
            "states": ["NATIVE_REVIEW", "DISCOVERY_CANDIDATE", "WEAK_SIGNAL", "NOT_RELEVANT"],
            "opportunitySignals": native,
            "declaredPressureReasons": PRESSURE_REASONS,
            "reasonInferenceWithoutCallerEvidence": "FORBIDDEN",
            "candidateIsDecision": False,
            "candidateRequiresComparison": True,
            "candidateRequiresEvidence": True,
        },
        "policy": {
            "workspaceRead": False,
            "workspaceMutation": False,
            "toolExecution": False,
            "network": False,
            "install": False,
            "automaticRepair": False,
            "automaticDependencyInstall": False,
            "automaticLanguageSwitch": False,
            "automaticPromotion": False,
            "automaticCanon": False,
            "capabilityIsNotAuthority": True,
            "authority": "NONE",
        },
    }
    body["eyeSha256"] = digest_obj(body)
    return body


def expected():
    human = json.loads(HUMAN.read_text(encoding="utf-8"))
    human_digest = digest_bytes(HUMAN.read_bytes())
    dims = [x["id"] for x in human["reviewDimensions"]]
    profiles = []
    for d in sorted(x for x in ORGANS.iterdir() if x.is_dir()):
        pp = d / "grammar.profile.json"
        if not pp.exists():
            raise SystemExit(f"GRAMMAR_PROFILE_MISSING:{d.name}")
        p = json.loads(pp.read_text(encoding="utf-8"))
        profiles.append((d, p))
    if len(profiles) != 102:
        raise SystemExit(f"EXPECTED_102_GRAMMAR_PROFILES:{len(profiles)}")
    missing_hints = [p["languageId"] for _, p in profiles if p["languageId"] not in LANGUAGE_HINTS]
    if missing_hints:
        raise SystemExit("LANGUAGE_OPPORTUNITY_HINTS_MISSING:" + ",".join(missing_hints))
    return [(d, build_eye(p, human_digest, dims)) for d, p in profiles]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if not args.write and not args.check:
        args.check = True
    rows = expected()
    drift = []
    for d, eye in rows:
        target = d / "specialist.eye.json"
        text = json.dumps(eye, indent=2, ensure_ascii=False) + "\n"
        if args.write:
            target.write_text(text, encoding="utf-8")
        if args.check:
            if not target.exists() or target.read_text(encoding="utf-8") != text:
                drift.append(str(target.relative_to(ROOT)))
    if drift:
        print(json.dumps({"ok": False, "driftCount": len(drift), "drift": drift[:20]}, indent=2))
        raise SystemExit(2)
    print(json.dumps({
        "ok": True,
        "specialistEyeCount": len(rows),
        "languageOpportunityHintCount": len(LANGUAGE_HINTS),
        "humanPerspectiveDigest": digest_bytes(HUMAN.read_bytes()),
        "authority": "NONE"
    }, indent=2))


if __name__ == "__main__":
    main()
