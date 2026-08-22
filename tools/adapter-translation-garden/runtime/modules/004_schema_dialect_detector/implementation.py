from __future__ import annotations
from typing import Any


def run(document: Any) -> dict[str, Any]:
    if isinstance(document, dict):
        if "openapi" in document:
            return {"family": "OpenAPI", "dialect": str(document["openapi"]), "confidence": "declared"}
        if "asyncapi" in document:
            return {"family": "AsyncAPI", "dialect": str(document["asyncapi"]), "confidence": "declared"}
        if "$schema" in document:
            uri = str(document["$schema"])
            return {"family": "JSON Schema", "dialect": uri, "confidence": "declared"}
        if document.get("type") == "record" and "fields" in document:
            return {"family": "Avro", "dialect": "record-schema", "confidence": "observed"}
        if "properties" in document or "required" in document:
            return {"family": "JSON Schema", "dialect": "unspecified", "confidence": "observed"}
    if isinstance(document, str) and ("syntax =" in document or "message " in document):
        return {"family": "Protocol Buffers", "dialect": "proto-text", "confidence": "observed"}
    return {"family": "unknown", "dialect": None, "confidence": "insufficient", "refusal": "No exact dialect could be identified"}
