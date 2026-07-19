#!/usr/bin/env python3
"""Bounded second-implementation validators for AXM reference receipts."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
from pathlib import Path
import sys


def package_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def emit(value: dict) -> int:
    print(json.dumps(value, ensure_ascii=True, separators=(",", ":")))
    return 0


def bounded(value: object, maximum: int = 500) -> str:
    return " ".join(str(value).split())[:maximum]


def local_name(value: str) -> str:
    return value.rsplit("}", 1)[-1]


def musicxml_structure(filename: Path) -> dict:
    from lxml import etree

    parser = etree.XMLParser(
        resolve_entities=False,
        no_network=True,
        recover=False,
        huge_tree=False,
        remove_comments=False,
    )
    checks: list[dict] = []
    facts: dict = {}
    try:
        document = etree.parse(str(filename), parser)
        root = document.getroot()
        root_name = local_name(root.tag)
        notes = root.xpath("//*[local-name()='note']")
        parts = root.xpath("/*[local-name()='score-partwise']/*[local-name()='part']")
        measures = root.xpath("//*[local-name()='measure']")
        divisions = root.xpath("//*[local-name()='divisions'][number(text()) > 0]")
        duration_nodes = root.xpath("//*[local-name()='note']/*[local-name()='duration'][number(text()) >= 0]")
        part_ids = {node.get("id") for node in parts if node.get("id")}
        declared_parts = {
            node.get("id")
            for node in root.xpath("//*[local-name()='part-list']/*[local-name()='score-part']")
            if node.get("id")
        }
        checks = [
            {"name": "well-formed-xml", "pass": True},
            {
                "name": "musicxml-root",
                "pass": root_name in {"score-partwise", "score-timewise"},
                "details": root_name,
            },
            {
                "name": "version-4-declaration",
                "pass": str(root.get("version") or "") == "4.0",
                "details": root.get("version"),
            },
            {"name": "part-list", "pass": bool(declared_parts)},
            {
                "name": "declared-parts-resolve",
                "pass": bool(parts) and part_ids.issubset(declared_parts),
                "details": {"declared": len(declared_parts), "used": len(part_ids)},
            },
            {"name": "measures-present", "pass": bool(measures)},
            {"name": "positive-divisions", "pass": bool(divisions)},
            {"name": "notes-present", "pass": bool(notes)},
            {
                "name": "note-durations",
                "pass": bool(notes) and len(duration_nodes) == len(notes),
                "details": {"notes": len(notes), "durations": len(duration_nodes)},
            },
            {
                "name": "no-doctype-or-entities",
                "pass": not bool(document.docinfo.doctype),
            },
        ]
        facts = {
            "root": root_name,
            "version": root.get("version"),
            "parts": len(parts),
            "measures": len(measures),
            "notes": len(notes),
        }
    except (OSError, etree.XMLSyntaxError, ValueError) as exc:
        checks = [
            {
                "name": "well-formed-xml",
                "pass": False,
                "details": bounded(exc),
            }
        ]
    return {
        "ok": bool(checks) and all(item["pass"] for item in checks),
        "implementation": "lxml",
        "implementation_version": package_version("lxml"),
        "checks": checks,
        "facts": facts,
    }


class LocalMusicXmlResolver:
    def __init__(self, etree_module, root: Path):
        self.etree = etree_module
        self.root = root.resolve()

    def instance(self):
        owner = self

        class Resolver(owner.etree.Resolver):
            def resolve(self, url, public_id, context):
                name = Path(str(url).replace("\\", "/")).name
                candidate = (owner.root / name).resolve()
                if candidate.parent == owner.root and candidate.is_file():
                    return self.resolve_filename(str(candidate), context)
                return None

        return Resolver()


def musicxml_xsd(filename: Path, xsd: Path) -> dict:
    from lxml import etree

    checks: list[dict] = []
    messages: list[str] = []
    try:
        xsd = xsd.resolve(strict=True)
        parser = etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=False)
        parser.resolvers.add(LocalMusicXmlResolver(etree, xsd.parent).instance())
        schema = etree.XMLSchema(etree.parse(str(xsd), parser))
        document = etree.parse(
            str(filename),
            etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=False),
        )
        valid = schema.validate(document)
        messages = [
            bounded(f"line {entry.line}: {entry.message}")
            for entry in list(schema.error_log)[:20]
        ]
        checks = [
            {"name": "w3c-musicxml-4-xsd", "pass": bool(valid), "details": messages}
        ]
    except (OSError, etree.XMLSyntaxError, etree.XMLSchemaParseError) as exc:
        checks = [
            {"name": "w3c-musicxml-4-xsd", "pass": False, "details": [bounded(exc)]}
        ]
    return {
        "ok": all(item["pass"] for item in checks),
        "implementation": "lxml.XMLSchema",
        "implementation_version": package_version("lxml"),
        "checks": checks,
        "facts": {"schema": "MusicXML 4.0 W3C XSD", "errors": messages},
    }


def dereference(value):
    return value.get_object() if hasattr(value, "get_object") else value


def pdf_structure(filename: Path) -> dict:
    from pypdf import PdfReader

    checks: list[dict] = []
    facts: dict = {}
    try:
        reader = PdfReader(str(filename), strict=True)
        root = dereference(reader.trailer.get("/Root"))
        pages = list(reader.pages)
        first = pages[0] if pages else {}
        resources = dereference(first.get("/Resources", {})) if pages else {}
        mark_info = dereference(root.get("/MarkInfo", {})) if root else {}
        structure = dereference(root.get("/StructTreeRoot")) if root else None
        output_intents = root.get("/OutputIntents", []) if root else []
        output_intents = [dereference(item) for item in output_intents]
        output_subtypes = [str(item.get("/S", "")) for item in output_intents]
        has_profile = any(item.get("/DestOutputProfile") is not None for item in output_intents)
        metadata = reader.metadata or {}
        pdfx_info = str(metadata.get("/GTS_PDFXVersion", ""))
        active_keys = {"/OpenAction", "/AA"}
        checks = [
            {"name": "strict-pdf-parse", "pass": True},
            {"name": "page-tree", "pass": bool(pages), "details": len(pages)},
            {
                "name": "no-catalog-active-actions",
                "pass": not any(key in root for key in active_keys),
            },
        ]
        facts = {
            "pages": len(pages),
            "pdf_header": str(getattr(reader, "pdf_header", "")),
            "tagged": bool(structure) and bool(mark_info.get("/Marked")),
            "structure_tree": bool(structure),
            "marked": bool(mark_info.get("/Marked")),
            "language": str(root.get("/Lang", "")) if root else "",
            "output_intents": len(output_intents),
            "output_intent_subtypes": output_subtypes,
            "destination_output_profile": has_profile,
            "pdfx_info": pdfx_info,
            "media_box": [float(value) for value in first.mediabox] if pages else [],
            "trim_box": [float(value) for value in first.trimbox] if pages else [],
            "bleed_box": [float(value) for value in first.bleedbox] if pages else [],
            "font_resources": len(dereference(resources.get("/Font", {}))) if resources else 0,
        }
    except Exception as exc:  # pypdf exposes several parser-specific exception types
        checks = [
            {"name": "strict-pdf-parse", "pass": False, "details": bounded(exc)}
        ]
    return {
        "ok": bool(checks) and all(item["pass"] for item in checks),
        "implementation": "pypdf",
        "implementation_version": package_version("pypdf"),
        "checks": checks,
        "facts": facts,
    }


def openusd_compliance(filename: Path) -> dict:
    from pxr import UsdUtils

    try:
        checker = UsdUtils.ComplianceChecker(
            arkit=False,
            skipARKitRootLayerCheck=False,
            rootPackageOnly=False,
            skipVariants=False,
            verbose=False,
            assetLevelChecks=True,
        )
        checker.CheckCompliance(str(filename))
        errors = [bounded(item) for item in checker.GetErrors()[:30]]
        failed = [bounded(item) for item in checker.GetFailedChecks()[:30]]
        warnings = [bounded(item) for item in checker.GetWarnings()[:30]]
        passed = not errors and not failed
        checks = [
            {
                "name": "openusd-compliance-checker",
                "pass": passed,
                "details": {
                    "errors": len(errors),
                    "failed_checks": len(failed),
                    "warnings": len(warnings),
                },
            }
        ]
        return {
            "ok": passed,
            "implementation": "pxr.UsdUtils.ComplianceChecker",
            "implementation_version": package_version("usd-core"),
            "checks": checks,
            "facts": {"errors": errors, "failed_checks": failed, "warnings": warnings},
        }
    except Exception as exc:
        return {
            "ok": False,
            "implementation": "pxr.UsdUtils.ComplianceChecker",
            "implementation_version": package_version("usd-core"),
            "checks": [{"name": "openusd-compliance-checker", "pass": False, "details": bounded(exc)}],
            "facts": {},
        }


def probe(mode: str) -> dict:
    package = "pypdf" if mode == "pdf-structure" else "usd-core" if mode == "openusd-compliance" else "lxml"
    version = package_version(package)
    return {
        "ok": version is not None,
        "implementation": package,
        "implementation_version": version,
        "checks": [{"name": package + "-installed", "pass": version is not None}],
        "facts": {"python": sys.version.split()[0]},
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=["pdf-structure", "musicxml-structure", "musicxml-xsd", "openusd-compliance"])
    parser.add_argument("--input", type=Path)
    parser.add_argument("--xsd", type=Path)
    parser.add_argument("--probe", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.probe:
        return emit(probe(args.mode))
    if not args.input or not args.input.is_file():
        return emit({"ok": False, "checks": [{"name": "input-file", "pass": False}], "facts": {}})
    if args.input.stat().st_size > 50_000_000:
        return emit({"ok": False, "checks": [{"name": "input-budget", "pass": False}], "facts": {}})
    if args.mode == "pdf-structure":
        return emit(pdf_structure(args.input))
    if args.mode == "musicxml-structure":
        return emit(musicxml_structure(args.input))
    if args.mode == "openusd-compliance":
        return emit(openusd_compliance(args.input))
    if not args.xsd:
        return emit({"ok": False, "checks": [{"name": "configured-xsd", "pass": False}], "facts": {}})
    return emit(musicxml_xsd(args.input, args.xsd))


if __name__ == "__main__":
    raise SystemExit(main())
