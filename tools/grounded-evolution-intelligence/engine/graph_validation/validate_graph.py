#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE / 'scripts'))
from rebuild_state import rebuild


def canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def sha256_obj(obj: Any) -> str:
    return 'sha256:' + hashlib.sha256(canonical(obj)).hexdigest()


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)


def strongly_connected(nodes: list[str], adjacency: dict[str, list[str]]) -> list[list[str]]:
    index = 0
    stack = []
    on_stack = set()
    indexes = {}
    low = {}
    result = []

    def visit(v: str):
        nonlocal index
        indexes[v] = low[v] = index; index += 1
        stack.append(v); on_stack.add(v)
        for w in adjacency.get(v, []):
            if w not in indexes:
                visit(w); low[v] = min(low[v], low[w])
            elif w in on_stack:
                low[v] = min(low[v], indexes[w])
        if low[v] == indexes[v]:
            component = []
            while True:
                w = stack.pop(); on_stack.remove(w); component.append(w)
                if w == v: break
            result.append(sorted(component))

    for v in sorted(nodes):
        if v not in indexes:
            visit(v)
    return sorted(result, key=lambda x: (len(x), x))


def validate() -> dict[str, Any]:
    config = json.loads((BASE / 'graph_builder' / 'build_config.json').read_text())
    graph = json.loads((BASE / 'graphs' / 'full_graph.json').read_text())
    nodes = {n['id']: n for n in graph['nodes']}
    edge_ids = [e['id'] for e in graph['edges']]
    dangling = [e['id'] for e in graph['edges'] if e['source'] not in nodes or e['target'] not in nodes]
    duplicate_nodes = len(nodes) != len(graph['nodes'])
    duplicate_edges = len(set(edge_ids)) != len(edge_ids)
    copy = dict(graph); stored_hash = copy.pop('graph_hash')
    graph_hash_valid = stored_hash == sha256_obj(copy)

    # Cycle detection only on execution-like dependencies, not containment or reuse suggestions.
    dep_types = set(config['dependency_relationships'])
    module_ids = sorted(n['id'] for n in graph['nodes'] if n['type'] == 'MODULE')
    adjacency = defaultdict(list)
    self_loops = []
    for e in graph['edges']:
        if e['relationship'] in dep_types:
            adjacency[e['source']].append(e['target'])
            if e['source'] == e['target']:
                self_loops.append(e['id'])
    components = strongly_connected(module_ids, adjacency)
    cycles = [c for c in components if len(c) > 1]

    # Evidence nodes are connected by support links; other entity types need at least
    # one non-evidence relationship so a passport is not counted alive merely because
    # a source file exists.
    meaningful = defaultdict(int)
    total_degree = defaultdict(int)
    for e in graph['edges']:
        total_degree[e['source']] += 1; total_degree[e['target']] += 1
        if e['relationship'] != 'SUPPORTED_BY':
            meaningful[e['source']] += 1; meaningful[e['target']] += 1
    orphans = sorted(
        nid for nid, node in nodes.items()
        if (total_degree[nid] == 0 if node['type'] == 'EVIDENCE' else meaningful[nid] == 0)
    )

    conflicts = []
    for n in graph['nodes']:
        if n['truth_state'] == 'CONFLICTED':
            conflicts.append({'node_id': n['id'], 'reason': 'truth_state CONFLICTED'})
        version = str(n['attributes'].get('version', ''))
        if 'manifest:' in version and '|contract:' in version:
            conflicts.append({'node_id': n['id'], 'reason': f'version mapping requires repair or explicit compatibility: {version}'})

    reference_time = parse_time(config['reference_time'])
    stale_edges = []
    unverified_edges = []
    for e in graph['edges']:
        if e['relationship'] not in {'REQUIRES', 'CAN_REUSE'}:
            continue
        last = e['attributes'].get('last_verified')
        if not last:
            unverified_edges.append(e['id'])
        else:
            age = (reference_time - parse_time(last)).total_seconds() / 86400
            if age > config['stale_after_days']:
                stale_edges.append({'edge_id': e['id'], 'age_days': round(age, 2)})

    local_caps = [n['id'] for n in graph['nodes'] if n['type'] == 'CAPABILITY' and n['local_or_external'] == 'LOCAL']
    atlas_links = {e['source'] for e in graph['edges'] if e['relationship'] == 'INTERPRETED_BY_ATLAS'}
    hii_links = {e['source'] for e in graph['edges'] if e['relationship'] == 'INTERFACE_ANALYSIS_CANDIDATE'}
    missing_atlas_links = sorted(set(local_caps) - atlas_links)
    missing_hii_links = sorted(set(local_caps) - hii_links)

    # Validate shared-contract external and research records.
    schema_map = {
        BASE / 'registry' / 'research': BASE / 'schemas' / 'research_need.schema.json',
        BASE / 'registry' / 'external_references' / 'modules': BASE / 'schemas' / 'module_passport.schema.json',
        BASE / 'registry' / 'external_references' / 'capabilities': BASE / 'schemas' / 'capability_record.schema.json',
        BASE / 'registry' / 'external_references' / 'interfaces': BASE / 'schemas' / 'interface_intelligence_reference.schema.json',
    }
    contract_validation = []
    for folder, schema_path in schema_map.items():
        validator = Draft202012Validator(json.loads(schema_path.read_text()))
        for path in sorted(folder.glob('*.json')):
            try:
                validator.validate(json.loads(path.read_text()))
                contract_validation.append({'record': str(path.relative_to(BASE)), 'valid': True, 'error': None})
            except Exception as exc:
                contract_validation.append({'record': str(path.relative_to(BASE)), 'valid': False, 'error': str(exc)})

    # Validate continuous event reconstruction.
    event_schema = json.loads((BASE / 'schemas' / 'event_envelope.schema.json').read_text())
    event_validator = Draft202012Validator(event_schema)
    event_schema_valid = True; event_error = None
    try:
        for line in (BASE / 'event_log' / 'phase2_full_events.jsonl').read_text().splitlines():
            if line.strip(): event_validator.validate(json.loads(line))
        state1 = rebuild(BASE / 'event_log' / 'phase2_full_events.jsonl')
        state2 = rebuild(BASE / 'event_log' / 'phase2_full_events.jsonl')
        event_deterministic = state1['state_hash'] == state2['state_hash']
    except Exception as exc:
        event_schema_valid = False; event_error = str(exc); event_deterministic = False
        state1 = {'state_hash': 'sha256:' + '0' * 64, 'event_count': 0, 'entities': {}}

    acceptance = (
        not dangling and not duplicate_nodes and not duplicate_edges and graph_hash_valid
        and not self_loops and not cycles and not orphans
        and not missing_atlas_links and not missing_hii_links
        and all(x['valid'] for x in contract_validation)
        and event_schema_valid and event_deterministic
    )
    return {
        'schema': 'axm.gei.graph-validation-report/v1',
        'package_version': config['package_version'],
        'contract_version': config['contract_version'],
        'generated_at': config['built_at'],
        'source_graph_hash': graph['graph_hash'],
        'graph_hash_valid': graph_hash_valid,
        'dangling_edge_ids': dangling,
        'duplicate_node_ids': duplicate_nodes,
        'duplicate_edge_ids': duplicate_edges,
        'dependency_self_loops': self_loops,
        'dependency_cycles': cycles,
        'orphan_node_ids': orphans,
        'conflicts': conflicts,
        'stale_dependency_edges': stale_edges,
        'unverified_dependency_edges': sorted(unverified_edges),
        'missing_atlas_links': missing_atlas_links,
        'missing_hii_links': missing_hii_links,
        'contract_record_validation': contract_validation,
        'event_chain_valid': event_schema_valid,
        'event_chain_error': event_error,
        'event_rebuild_deterministic': event_deterministic,
        'event_count': state1['event_count'],
        'event_state_hash': state1['state_hash'],
        'acceptance_passed': acceptance,
        'truth_boundary': [
            'Zero detected cycles means no cycle exists in the current sampled dependency graph, not in every unsampled AXM module.',
            'Unverified edges are kept distinct from stale verified edges.',
            'Conflicts remain visible and do not fail graph construction unless they create invalid structure.',
        ],
    }


def main() -> None:
    report = validate()
    (BASE / 'generated' / 'phase2_graph_validation_report.json').write_text(json.dumps(report, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'PASS' if report['acceptance_passed'] else 'FAIL', **{k: report[k] for k in ['source_graph_hash','graph_hash_valid','dependency_cycles','orphan_node_ids','missing_atlas_links','missing_hii_links','event_count','event_state_hash']}}, indent=2))
    raise SystemExit(0 if report['acceptance_passed'] else 1)


if __name__ == '__main__':
    main()
