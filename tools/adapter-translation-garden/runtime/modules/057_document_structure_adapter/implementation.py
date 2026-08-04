from __future__ import annotations
import copy
from typing import Any


def run(document: dict[str, Any], *, supported_types: list[str], unsupported_policy: str = 'sidecar') -> dict[str, Any]:
    allowed = set(supported_types)
    sidecar: list[dict[str, Any]] = []
    blocking: list[dict[str, Any]] = []

    def walk(node: Any, path: str) -> Any:
        if isinstance(node, list):
            out = []
            for i, item in enumerate(node):
                mapped = walk(item, f'{path}[{i}]')
                if mapped is not None: out.append(mapped)
            return out
        if not isinstance(node, dict): return copy.deepcopy(node)
        node_type = node.get('type')
        if node_type and node_type not in allowed:
            record = {'path': path, 'node': copy.deepcopy(node), 'reason': 'unsupported_node_type'}
            if unsupported_policy == 'refuse': blocking.append(record)
            elif unsupported_policy == 'sidecar': sidecar.append(record)
            elif unsupported_policy != 'drop': raise ValueError('unsupported_policy must be sidecar, refuse, or drop')
            return None
        out = {}
        for key, value in node.items():
            out[key] = walk(value, f'{path}.{key}') if key in {'children', 'content', 'rows', 'cells'} else copy.deepcopy(value)
        return out

    translated = walk(document, '$')
    verdict = 'REFUSE' if blocking else ('PARTIAL' if sidecar else 'PASS')
    return {'schema': 'axm.translation.document-structure/v1', 'verdict': verdict, 'document': None if blocking else translated, 'sidecar': sidecar, 'blocking': blocking, 'source_unchanged': True}
