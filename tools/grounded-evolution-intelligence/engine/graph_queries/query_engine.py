#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parents[1]
DEFAULT_GRAPH = BASE / 'graphs' / 'full_graph.json'


def load_graph(path: Path = DEFAULT_GRAPH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding='utf-8'))


def indexes(graph: dict[str, Any]):
    nodes = {n['id']: n for n in graph['nodes']}
    outgoing = defaultdict(list)
    incoming = defaultdict(list)
    for e in graph['edges']:
        outgoing[e['source']].append(e)
        incoming[e['target']].append(e)
    return nodes, outgoing, incoming


def reverse_module_dependents(graph: dict[str, Any], starting_modules: set[str]) -> set[str]:
    nodes, outgoing, incoming = indexes(graph)
    dependency_types = {'REQUIRES', 'DEPENDS_ON_REFERENCE'}
    seen = set(starting_modules)
    queue = deque(sorted(starting_modules))
    while queue:
        current = queue.popleft()
        for edge in incoming[current]:
            if edge['relationship'] in dependency_types and nodes.get(edge['source'], {}).get('type') == 'MODULE':
                if edge['source'] not in seen:
                    seen.add(edge['source'])
                    queue.append(edge['source'])
    return seen


def capability_dependents(graph: dict[str, Any], capability_id: str) -> dict[str, Any]:
    nodes, outgoing, incoming = indexes(graph)
    if capability_id not in nodes or nodes[capability_id]['type'] != 'CAPABILITY':
        return {'query': 'capability_dependents', 'capability_id': capability_id, 'error': 'Capability not found'}
    direct = sorted({e['source'] for e in incoming[capability_id] if e['relationship'] == 'CONSUMES_CAPABILITY'})
    transitive = sorted(reverse_module_dependents(graph, set(direct)) - set(direct))
    return {
        'query': 'capability_dependents',
        'capability_id': capability_id,
        'capability_label': nodes[capability_id]['label'],
        'direct_modules': [{'module_id': x, 'label': nodes[x]['label']} for x in direct],
        'transitive_modules': [{'module_id': x, 'label': nodes[x]['label']} for x in transitive],
        'truth_boundary': 'Consumers are declared graph relationships; runtime dependence was not reproduced in Phase 2.',
    }


def tokens(value: str) -> set[str]:
    stop = {'and', 'the', 'for', 'with', 'from', 'into', 'view', 'local', 'shared', 'live'}
    return {x for x in re.split(r'[^a-z0-9]+', value.lower()) if len(x) > 2 and x not in stop}


def overlapping_providers(graph: dict[str, Any], term: str) -> dict[str, Any]:
    nodes = {n['id']: n for n in graph['nodes']}
    wanted = tokens(term)
    matches = []
    for n in graph['nodes']:
        if n['type'] != 'MODULE':
            continue
        declarations = n['attributes'].get('declared_provides', [])
        hit = []
        for declaration in declarations:
            dt = tokens(declaration)
            score = len(wanted & dt) / max(1, len(wanted))
            normalized = declaration.replace('-', ' ').lower()
            if wanted and (score >= 0.5 or all(t in normalized for t in wanted)):
                hit.append({'declaration': declaration, 'match_score': round(score, 4)})
        if hit:
            matches.append({'module_id': n['id'], 'label': n['label'], 'matches': sorted(hit, key=lambda x: (-x['match_score'], x['declaration']))})
    matches.sort(key=lambda x: (-max(m['match_score'] for m in x['matches']), x['module_id']))
    return {
        'query': 'overlapping_providers',
        'term': term,
        'normalized_tokens': sorted(wanted),
        'providers': matches,
        'overlap_count': len(matches),
        'truth_boundary': 'Overlap is deterministic lexical routing over sampled declarations, not proof of interchangeable implementations.',
    }


def top_unproven_blockers(graph: dict[str, Any]) -> dict[str, Any]:
    nodes, outgoing, incoming = indexes(graph)
    ranked = []
    for n in graph['nodes']:
        if n['type'] != 'CAPABILITY' or n['attributes'].get('proof_status') in {'TESTED', 'REPRODUCED'}:
            continue
        direct = {e['source'] for e in incoming[n['id']] if e['relationship'] == 'CONSUMES_CAPABILITY'}
        affected = reverse_module_dependents(graph, direct)
        blocked_need_ids = sorted({e['source'] for module in affected for e in incoming[module] if e['relationship'] == 'BLOCKS_MODULE'})
        ranked.append({
            'component_id': n['id'], 'label': n['label'], 'proof_status': n['attributes'].get('proof_status', 'UNKNOWN'),
            'direct_consumer_count': len(direct), 'affected_module_count': len(affected),
            'affected_modules': sorted(affected), 'blocking_need_count': len(blocked_need_ids),
            'blocking_needs': blocked_need_ids,
        })
    ranked.sort(key=lambda x: (-x['affected_module_count'], -x['direct_consumer_count'], -x['blocking_need_count'], x['component_id']))
    return {
        'query': 'top_unproven_blockers',
        'top': ranked[0] if ranked else None,
        'ranking': ranked,
        'truth_boundary': 'Impact is graph reach over declared relationships, not measured outage or runtime failure.',
    }


def largest_verified_scope_improvement(graph: dict[str, Any]) -> dict[str, Any]:
    nodes, outgoing, incoming = indexes(graph)
    ranked = []
    for n in graph['nodes']:
        if n['type'] != 'IMPROVEMENT_NEED':
            continue
        affected = sorted({e['target'] for e in outgoing[n['id']] if e['relationship'] == 'AFFECTS'})
        evid = sorted({e['target'] for e in outgoing[n['id']] if e['relationship'] == 'SUPPORTED_BY'})
        evidence_conf = [nodes[x]['attributes'].get('confidence', 0.0) for x in evid if x in nodes]
        current_evidence = [x for x in evid if nodes.get(x, {}).get('freshness_status') == 'CURRENT']
        verified_scope = len(affected) if current_evidence else 0
        ranked.append({
            'need_id': n['id'], 'problem': n['label'], 'affected_scope_count': len(affected),
            'verified_scope_count': verified_scope, 'affected_scope': affected,
            'current_evidence_count': len(current_evidence),
            'mean_evidence_confidence': round(sum(evidence_conf) / max(1, len(evidence_conf)), 4),
            'severity': n['attributes'].get('severity'), 'ecosystem_reach': n['attributes'].get('ecosystem_reach'),
        })
    ranked.sort(key=lambda x: (-x['verified_scope_count'], -x['affected_scope_count'], -x['current_evidence_count'], x['need_id']))
    return {
        'query': 'largest_verified_scope_improvement',
        'top': ranked[0] if ranked else None,
        'ranking': ranked,
        'truth_boundary': 'Verified scope means the affected nodes are linked to current retained evidence; it does not mean the proposed improvement outcome is proven.',
    }


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)


def modules_without_current_evidence(graph: dict[str, Any], stale_after_days: int = 30) -> dict[str, Any]:
    nodes, outgoing, incoming = indexes(graph)
    reference_time = parse_time(json.loads((BASE / 'graph_builder' / 'build_config.json').read_text())['reference_time'])
    missing = []
    for n in graph['nodes']:
        if n['type'] != 'MODULE':
            continue
        refs = [e['target'] for e in outgoing[n['id']] if e['relationship'] == 'SUPPORTED_BY' and nodes.get(e['target'], {}).get('type') == 'EVIDENCE']
        current = []
        for eid in refs:
            captured = nodes[eid]['attributes'].get('captured_at')
            if not captured:
                continue
            age = (reference_time - parse_time(captured)).total_seconds() / 86400
            if age <= stale_after_days and nodes[eid]['truth_state'] != 'OBSOLETE':
                current.append(eid)
        if not current:
            missing.append({'module_id': n['id'], 'label': n['label'], 'all_evidence_refs': refs})
    return {
        'query': 'modules_without_current_evidence',
        'stale_after_days': stale_after_days,
        'modules': sorted(missing, key=lambda x: x['module_id']),
        'count': len(missing),
        'truth_boundary': 'Current means a retained non-obsolete evidence record captured within the configured window, not independent runtime reproduction.',
    }


def shortest_path(graph: dict[str, Any], source: str, target: str) -> dict[str, Any]:
    nodes, outgoing, incoming = indexes(graph)
    if source not in nodes or target not in nodes:
        return {'query': 'shortest_path', 'source': source, 'target': target, 'error': 'Source or target not found'}
    queue = deque([source])
    prior = {source: None}
    prior_edge = {}
    while queue:
        cur = queue.popleft()
        if cur == target:
            break
        for e in sorted(outgoing[cur], key=lambda x: (x['target'], x['relationship'])):
            if e['target'] not in prior:
                prior[e['target']] = cur
                prior_edge[e['target']] = e
                queue.append(e['target'])
    if target not in prior:
        return {'query': 'shortest_path', 'source': source, 'target': target, 'path': None}
    path_nodes = []
    path_edges = []
    cur = target
    while cur is not None:
        path_nodes.append(cur)
        if cur in prior_edge:
            path_edges.append(prior_edge[cur])
        cur = prior[cur]
    path_nodes.reverse(); path_edges.reverse()
    return {'query': 'shortest_path', 'source': source, 'target': target, 'nodes': path_nodes, 'edges': path_edges}


def main() -> None:
    parser = argparse.ArgumentParser(description='Query the deterministic AXM GEI graph.')
    parser.add_argument('--graph', type=Path, default=DEFAULT_GRAPH)
    sub = parser.add_subparsers(dest='command', required=True)
    a = sub.add_parser('capability-dependents'); a.add_argument('capability_id')
    a = sub.add_parser('overlap'); a.add_argument('term')
    sub.add_parser('top-unproven-blocker')
    sub.add_parser('largest-scope-improvement')
    a = sub.add_parser('modules-without-current-evidence'); a.add_argument('--days', type=int, default=30)
    a = sub.add_parser('path'); a.add_argument('source'); a.add_argument('target')
    args = parser.parse_args()
    graph = load_graph(args.graph)
    if args.command == 'capability-dependents': result = capability_dependents(graph, args.capability_id)
    elif args.command == 'overlap': result = overlapping_providers(graph, args.term)
    elif args.command == 'top-unproven-blocker': result = top_unproven_blockers(graph)
    elif args.command == 'largest-scope-improvement': result = largest_verified_scope_improvement(graph)
    elif args.command == 'modules-without-current-evidence': result = modules_without_current_evidence(graph, args.days)
    elif args.command == 'path': result = shortest_path(graph, args.source, args.target)
    else: raise AssertionError(args.command)
    print(json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == '__main__':
    main()
