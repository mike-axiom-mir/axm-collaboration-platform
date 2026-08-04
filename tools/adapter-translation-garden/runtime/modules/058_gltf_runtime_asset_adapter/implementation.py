from __future__ import annotations
from pathlib import PurePosixPath
from urllib.parse import urlparse
from typing import Any


def _safe_uri(uri: str) -> bool:
    parsed = urlparse(uri)
    if parsed.scheme:
        return parsed.scheme == 'data'
    p = PurePosixPath(uri.replace('\\', '/'))
    return not p.is_absolute() and '..' not in p.parts


def run(document: dict[str, Any]) -> dict[str, Any]:
    errors, warnings = [], []
    asset = document.get('asset', {})
    if str(asset.get('version')) != '2.0': errors.append('asset.version must be 2.0')
    nodes = document.get('nodes', [])
    scenes = document.get('scenes', [])
    meshes = document.get('meshes', [])
    materials = document.get('materials', [])
    for si, scene in enumerate(scenes):
        for ref in scene.get('nodes', []):
            if not isinstance(ref, int) or ref < 0 or ref >= len(nodes): errors.append(f'scenes[{si}] has invalid node reference {ref!r}')
    for ni, node in enumerate(nodes):
        if 'mesh' in node and (not isinstance(node['mesh'], int) or node['mesh'] < 0 or node['mesh'] >= len(meshes)):
            errors.append(f'nodes[{ni}] has invalid mesh reference')
        for child in node.get('children', []):
            if not isinstance(child, int) or child < 0 or child >= len(nodes): errors.append(f'nodes[{ni}] has invalid child reference')
    blocked_uris = []
    for collection in ('buffers', 'images'):
        for i, item in enumerate(document.get(collection, [])):
            uri = item.get('uri')
            if isinstance(uri, str) and not _safe_uri(uri): blocked_uris.append({'path': f'$.{collection}[{i}].uri', 'uri': uri})
    used = set(document.get('extensionsUsed', []))
    required = set(document.get('extensionsRequired', []))
    known = {'KHR_materials_unlit', 'KHR_texture_transform', 'KHR_lights_punctual'}
    unknown = sorted(used - known)
    if required - known: warnings.append('required extensions are declared but unsupported by this inspector')
    ok = not errors and not blocked_uris
    return {'schema': 'axm.translation.gltf-inspection/v1', 'ok': ok, 'verdict': 'PASS' if ok and not warnings else ('REFUSE' if not ok else 'PARTIAL'), 'errors': errors, 'warnings': warnings, 'blocked_uris': blocked_uris, 'unknown_extensions': unknown, 'runtime_descriptor': {'scenes': len(scenes), 'nodes': len(nodes), 'meshes': len(meshes), 'materials': len(materials), 'animations': len(document.get('animations', []))}, 'external_resources_fetched': False}
