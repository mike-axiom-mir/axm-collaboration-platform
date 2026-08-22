from __future__ import annotations
from typing import Any

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}


def run(document: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(document, dict):
        raise TypeError("document must be a dictionary")
    kind = "generic_contract"
    operations: list[dict[str, Any]] = []
    schemas: list[str] = []
    permissions: list[str] = []
    versions: list[str] = []

    if "openapi" in document:
        kind = "openapi"
        versions.append(str(document["openapi"]))
        for path, item in document.get("paths", {}).items():
            if not isinstance(item, dict):
                continue
            for method, operation in item.items():
                if method.lower() in HTTP_METHODS and isinstance(operation, dict):
                    operations.append({
                        "operation_id": operation.get("operationId") or f"{method.lower()} {path}",
                        "method": method.upper(),
                        "path": path,
                        "summary": operation.get("summary"),
                    })
        schemas = sorted(document.get("components", {}).get("schemas", {}).keys())
    elif "$schema" in document or "properties" in document:
        kind = "json_schema"
        if "$schema" in document:
            versions.append(str(document["$schema"]))
        schemas = sorted(document.get("properties", {}).keys())
        operations.append({"operation_id": "validate", "method": "LOCAL", "path": "$"})
    else:
        raw_ops = document.get("operations", [])
        for op in raw_ops if isinstance(raw_ops, list) else []:
            operations.append(op if isinstance(op, dict) else {"operation_id": str(op)})
        permissions = sorted(str(x) for x in document.get("permissions", []))
        version = document.get("version")
        if version is not None:
            versions.append(str(version))

    return {
        "descriptor_kind": kind,
        "operations": operations,
        "schemas": schemas,
        "permissions": permissions,
        "versions": versions,
        "limitations": ["Prototype harvests declared structure only; it does not execute the interface."],
    }
