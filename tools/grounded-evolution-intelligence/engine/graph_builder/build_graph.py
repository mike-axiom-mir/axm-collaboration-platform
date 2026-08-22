#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape as xml_escape

BASE = Path(__file__).resolve().parents[1]
phase0_evidence_id = 'axm:evidence:phase0-contract-foundation'


def canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def sha256_obj(obj: Any) -> str:
    return 'sha256:' + hashlib.sha256(canonical(obj)).hexdigest()


def load_jsons(folder: Path) -> list[dict[str, Any]]:
    return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(folder.glob('*.json'))]


def edge_id(source: str, relationship: str, target: str, source_record: str | None = None) -> str:
    seed = {'source': source, 'relationship': relationship, 'target': target, 'source_record': source_record}
    return 'axm:edge:derived-' + hashlib.sha256(canonical(seed)).hexdigest()[:24]


def tokenize(value: str) -> list[str]:
    return [x for x in re.split(r'[^a-z0-9]+', value.lower()) if len(x) > 1]


def build() -> dict[str, Any]:
    config = json.loads((BASE / 'graph_builder' / 'build_config.json').read_text(encoding='utf-8'))
    snapshot = json.loads((BASE / 'intake' / 'GITHUB_SNAPSHOT.json').read_text(encoding='utf-8'))
    raw_sources = snapshot.get('sampled_module_sources', {})

    modules = load_jsons(BASE / 'registry' / 'module_passports')
    external_modules = load_jsons(BASE / 'registry' / 'external_references' / 'modules')
    capabilities = load_jsons(BASE / 'registry' / 'capabilities')
    external_capabilities = load_jsons(BASE / 'registry' / 'external_references' / 'capabilities')
    evidence = load_jsons(BASE / 'registry' / 'evidence')
    dependencies = load_jsons(BASE / 'registry' / 'dependencies')
    needs = load_jsons(BASE / 'registry' / 'needs')
    research = load_jsons(BASE / 'registry' / 'research')
    directions = load_jsons(BASE / 'registry' / 'directions')
    interfaces = load_jsons(BASE / 'registry' / 'external_references' / 'interfaces')

    nodes: dict[str, dict[str, Any]] = {}
    edges: dict[str, dict[str, Any]] = {}

    def add_node(node_id: str, node_type: str, label: str, truth_state: str,
                 freshness_status: str = 'UNKNOWN', local_or_external: str = 'LOCAL',
                 source_record: str | None = None, attributes: dict[str, Any] | None = None) -> None:
        candidate = {
            'id': node_id,
            'type': node_type,
            'label': label,
            'truth_state': truth_state,
            'freshness_status': freshness_status,
            'local_or_external': local_or_external,
            'source_record': source_record,
            'attributes': attributes or {},
        }
        if node_id in nodes and nodes[node_id] != candidate:
            raise ValueError(f'Conflicting node definition: {node_id}')
        nodes[node_id] = candidate

    def add_edge(source: str, relationship: str, target: str, truth_state: str,
                 evidence_refs: list[str] | None = None, source_record: str | None = None,
                 attributes: dict[str, Any] | None = None) -> None:
        eid = edge_id(source, relationship, target, source_record)
        candidate = {
            'id': eid,
            'source': source,
            'target': target,
            'relationship': relationship,
            'truth_state': truth_state,
            'evidence': sorted(set(evidence_refs or [])),
            'source_record': source_record,
            'attributes': attributes or {},
        }
        if eid in edges and edges[eid] != candidate:
            raise ValueError(f'Conflicting edge definition: {eid}')
        edges[eid] = candidate

    for m in modules + external_modules:
        slug = m['module_id'].split(':')[-1]
        raw = raw_sources.get(slug, {})
        add_node(
            m['module_id'], 'MODULE', m['canonical_name'], m['truth_state'],
            m.get('freshness_status', 'UNKNOWN'),
            'EXTERNAL_REFERENCE' if m in external_modules else 'LOCAL',
            f"module_passport:{m['module_id']}",
            {
                'version': m['version'],
                'lifecycle_status': m['lifecycle_status'],
                'purpose': m['purpose'],
                'declared_capability_ids': m.get('declared_capabilities', []),
                'proven_capability_ids': m.get('proven_capabilities', []),
                'open_needs': m.get('open_needs', []),
                'current_blockers': m.get('current_blockers', []),
                'declared_provides': raw.get('provides', []),
                'declared_consumes': raw.get('consumes', []),
                'source_status': m.get('resource_requirements', {}).get('source_status'),
                'risk': m.get('resource_requirements', {}).get('risk'),
            },
        )

    for c in capabilities + external_capabilities:
        add_node(
            c['capability_id'], 'CAPABILITY', c['name'], c['declared_status'], 'UNKNOWN',
            'EXTERNAL_REFERENCE' if c in external_capabilities else 'LOCAL',
            f"capability_record:{c['capability_id']}",
            {
                'summary': c['plain_language_summary'],
                'proof_status': c['proof_status'],
                'providers': c['provider_modules'],
                'consumers': c['consumer_modules'],
                'constraints': c['constraints'],
            },
        )

    for e in evidence:
        add_node(
            e['evidence_id'], 'EVIDENCE', e['evidence_id'].split(':')[-1].replace('-', ' ').title(),
            e['truth_state'], 'CURRENT', 'LOCAL', f"evidence_record:{e['evidence_id']}",
            {
                'source_type': e['source_type'],
                'captured_at': e['captured_at'],
                'confidence': e['confidence'],
                'limitations': e['limitations'],
                'supports_claims': e['supports_claims'],
            },
        )

    for n in needs:
        add_node(
            n['need_id'], 'IMPROVEMENT_NEED', n['observed_problem'], n['truth_state'], 'CURRENT', 'LOCAL',
            f"improvement_need:{n['need_id']}",
            {
                'severity': n['severity'], 'ecosystem_reach': n['ecosystem_reach'],
                'status': n['status'], 'dimensions': n['improvement_dimensions'],
                'verification_method': n['verification_method'],
            },
        )

    for r in research:
        add_node(
            r['research_id'], 'RESEARCH_NEED', r['research_question'], r['truth_state'], 'CURRENT', 'LOCAL',
            f"research_need:{r['research_id']}",
            {'status': r['status'], 'unknowns': r['unknowns'], 'expected_decision_unlocked': r['expected_decision_unlocked']},
        )

    for d in directions:
        add_node(
            d['direction_id'], 'DIRECTION', d['rationale'], d['truth_state'], 'CURRENT', 'LOCAL',
            f"evolution_direction:{d['direction_id']}",
            {
                'action_type': d['action_type'], 'steward_status': d['steward_status'],
                'execution_status': d['execution_status'],
                'advisory_score': d['priority_components']['advisory_score'],
            },
        )

    for i in interfaces:
        add_node(
            i['interface_record_id'], 'INTERFACE', i['interface_pattern'], i['truth_state'], 'CURRENT',
            'EXTERNAL_REFERENCE', f"interface_intelligence_reference:{i['interface_record_id']}",
            {
                'target_humans': i['target_humans'], 'beginner_layer': i['beginner_layer'],
                'interaction_modes': i['interaction_modes'], 'confidence': i['confidence'],
            },
        )

    platform_id = 'axm:module:workshop-public-snapshot'
    gei_id = 'axm:module:grounded-evolution-intelligence'
    atlas_id = 'axm:module:human-capability-atlas'
    hii_id = 'axm:module:human-interface-intelligence'

    # System containment gives the module view a truthful whole/sibling relation.
    for m in modules:
        if m['module_id'] != platform_id:
            add_edge(platform_id, 'CONTAINS', m['module_id'], 'OBSERVED', m.get('evidence_references', []), 'phase2:containment')

    # Observed and inferred dependency/reuse edges from Phase 1.
    for dep in dependencies:
        add_edge(
            dep['source_node'], dep['relationship_type'], dep['target_node'], dep['truth_state'],
            dep['evidence'], f"dependency_edge:{dep['edge_id']}",
            {
                'required_or_optional': dep['required_or_optional'],
                'current_state': dep['current_state'],
                'last_verified': dep['last_verified'],
                'version_constraints': dep['version_constraints'],
                'failure_consequence': dep['failure_consequence'],
            },
        )

    # Explicit Phase 0 interop references.
    add_edge(gei_id, 'DEPENDS_ON_REFERENCE', atlas_id, 'DECLARED', [phase0_evidence_id], 'phase0:three-module-interop')
    add_edge(gei_id, 'DEPENDS_ON_REFERENCE', hii_id, 'DECLARED', [phase0_evidence_id], 'phase0:three-module-interop')
    add_edge(hii_id, 'DEPENDS_ON_REFERENCE', atlas_id, 'DECLARED', [phase0_evidence_id], 'phase0:three-module-interop')

    for c in capabilities + external_capabilities:
        for provider in c['provider_modules']:
            add_edge(provider, 'PROVIDES_CAPABILITY', c['capability_id'], c['declared_status'], c['evidence'], f"capability:{c['capability_id']}")
        for consumer in c['consumer_modules']:
            add_edge(consumer, 'CONSUMES_CAPABILITY', c['capability_id'], 'DECLARED', c['evidence'], f"capability:{c['capability_id']}")
        for evid in c['evidence']:
            add_edge(c['capability_id'], 'SUPPORTED_BY', evid, 'DECLARED', [evid], f"capability:{c['capability_id']}")

    # Each local capability is linked to the Atlas and HII only as a candidate route.
    for c in capabilities:
        add_edge(c['capability_id'], 'INTERPRETED_BY_ATLAS', atlas_id, 'HYPOTHESIS', [phase0_evidence_id], 'phase2:atlas-link')
        add_edge(c['capability_id'], 'INTERFACE_ANALYSIS_CANDIDATE', hii_id, 'HYPOTHESIS', [phase0_evidence_id], 'phase2:hii-link')

    for m in modules + external_modules:
        for evid in m.get('evidence_references', []):
            add_edge(m['module_id'], 'SUPPORTED_BY', evid, m['truth_state'], [evid], f"module:{m['module_id']}")
        for need in m.get('open_needs', []):
            add_edge(m['module_id'], 'HAS_OPEN_NEED', need, 'OBSERVED', m.get('evidence_references', []), f"module:{m['module_id']}")
        for blocker in m.get('current_blockers', []):
            add_edge(blocker, 'BLOCKS_MODULE', m['module_id'], 'OBSERVED', m.get('evidence_references', []), f"module:{m['module_id']}")

    for n in needs:
        for target in n['affected_scope']:
            if target in nodes:
                add_edge(n['need_id'], 'AFFECTS', target, n['truth_state'], n['evidence'], f"need:{n['need_id']}")
        for evid in n['evidence']:
            add_edge(n['need_id'], 'SUPPORTED_BY', evid, n['truth_state'], [evid], f"need:{n['need_id']}")
        for direction in n['assigned_direction_ids']:
            add_edge(direction, 'ADDRESSES', n['need_id'], 'HYPOTHESIS', n['evidence'], f"need:{n['need_id']}")

    for d in directions:
        for module in d['affected_modules']:
            add_edge(d['direction_id'], 'TARGETS_MODULE', module, 'HYPOTHESIS', d['evidence'], f"direction:{d['direction_id']}")
        for evid in d['evidence']:
            add_edge(d['direction_id'], 'SUPPORTED_BY', evid, 'HYPOTHESIS', [evid], f"direction:{d['direction_id']}")

    for r in research:
        add_edge(r['research_id'], 'TRIGGERED_BY', r['triggering_gap'], r['truth_state'], [], f"research:{r['research_id']}")
        for module in r['affected_modules']:
            add_edge(r['research_id'], 'AFFECTS', module, r['truth_state'], [], f"research:{r['research_id']}")
        for evid in r['result_evidence']:
            add_edge(r['research_id'], 'SUPPORTED_BY', evid, r['truth_state'], [evid], f"research:{r['research_id']}")

    for i in interfaces:
        add_edge(i['source_module_id'], 'PROVIDES_INTERFACE', i['interface_record_id'], i['truth_state'], i['evidence_references'], f"interface:{i['interface_record_id']}")
        add_edge(i['interface_record_id'], 'SERVES_CAPABILITY', i['capability_id'], i['truth_state'], i['evidence_references'], f"interface:{i['interface_record_id']}")
        for evid in i['evidence_references']:
            add_edge(i['interface_record_id'], 'SUPPORTED_BY', evid, i['truth_state'], [evid], f"interface:{i['interface_record_id']}")

    # Deterministic statistics.
    node_list = [nodes[k] for k in sorted(nodes)]
    edge_list = [edges[k] for k in sorted(edges)]
    stats = {
        'node_count': len(node_list),
        'edge_count': len(edge_list),
        'nodes_by_type': dict(sorted(Counter(n['type'] for n in node_list).items())),
        'edges_by_relationship': dict(sorted(Counter(e['relationship'] for e in edge_list).items())),
        'nodes_by_truth_state': dict(sorted(Counter(n['truth_state'] for n in node_list).items())),
        'external_reference_nodes': sum(1 for n in node_list if n['local_or_external'] == 'EXTERNAL_REFERENCE'),
    }
    graph = {
        'schema': 'axm.gei.graph-snapshot/v1',
        'package_version': config['package_version'],
        'contract_version': config['contract_version'],
        'built_at': config['built_at'],
        'source_state_hash': config['source_state_hash'],
        'honesty_boundary': config['honesty_boundary'],
        'nodes': node_list,
        'edges': edge_list,
        'statistics': stats,
    }
    graph['graph_hash'] = sha256_obj(graph)
    return graph


def view(graph: dict[str, Any], name: str, node_types: set[str], relationships: set[str]) -> dict[str, Any]:
    selected_edges = [e for e in graph['edges'] if e['relationship'] in relationships]
    endpoint_ids = {x for e in selected_edges for x in (e['source'], e['target'])}
    selected_nodes = [n for n in graph['nodes'] if n['type'] in node_types and (n['id'] in endpoint_ids or not relationships)]
    allowed = {n['id'] for n in selected_nodes}
    selected_edges = [e for e in selected_edges if e['source'] in allowed and e['target'] in allowed]
    result = {
        'schema': 'axm.gei.graph-view/v1',
        'name': name,
        'source_graph_hash': graph['graph_hash'],
        'nodes': sorted(selected_nodes, key=lambda x: x['id']),
        'edges': sorted(selected_edges, key=lambda x: x['id']),
    }
    result['view_hash'] = sha256_obj(result)
    return result


def export_graph(graph: dict[str, Any]) -> None:
    out = BASE / 'graph_exports'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'nodes.jsonl').write_text('\n'.join(json.dumps(n, sort_keys=True, ensure_ascii=False) for n in graph['nodes']) + '\n', encoding='utf-8')
    (out / 'edges.jsonl').write_text('\n'.join(json.dumps(e, sort_keys=True, ensure_ascii=False) for e in graph['edges']) + '\n', encoding='utf-8')

    # DOT
    dot = ['digraph AXM_GEI {', '  rankdir=LR;']
    for n in graph['nodes']:
        label = n['label'].replace('"', "'")[:100]
        dot.append(f'  "{n["id"]}" [label="{label}\\n[{n["type"]}]"];')
    for e in graph['edges']:
        dot.append(f'  "{e["source"]}" -> "{e["target"]}" [label="{e["relationship"]}"];')
    dot.append('}')
    (out / 'full_graph.dot').write_text('\n'.join(dot) + '\n', encoding='utf-8')

    # Mermaid
    safe_ids = {n['id']: f"N{i:04d}" for i, n in enumerate(graph['nodes'], 1)}
    mermaid = ['flowchart LR']
    for n in graph['nodes']:
        label = n['label'].replace('"', "'").replace('[', '(').replace(']', ')')[:80]
        mermaid.append(f'  {safe_ids[n["id"]]}["{label}\\n{n["type"]}"]')
    for e in graph['edges']:
        mermaid.append(f'  {safe_ids[e["source"]]} -->|{e["relationship"]}| {safe_ids[e["target"]]}')
    (out / 'full_graph.mmd').write_text('\n'.join(mermaid) + '\n', encoding='utf-8')

    # GraphML (portable, no external library).
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
        '  <key id="label" for="node" attr.name="label" attr.type="string"/>',
        '  <key id="type" for="node" attr.name="type" attr.type="string"/>',
        '  <key id="relationship" for="edge" attr.name="relationship" attr.type="string"/>',
        '  <graph id="AXM_GEI" edgedefault="directed">',
    ]
    for n in graph['nodes']:
        lines.append(f'    <node id="{xml_escape(n["id"])}"><data key="label">{xml_escape(n["label"])}</data><data key="type">{n["type"]}</data></node>')
    for e in graph['edges']:
        lines.append(f'    <edge id="{e["id"]}" source="{xml_escape(e["source"])}" target="{xml_escape(e["target"])}"><data key="relationship">{e["relationship"]}</data></edge>')
    lines.extend(['  </graph>', '</graphml>'])
    (out / 'full_graph.graphml').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> None:
    graph = build()
    target = BASE / 'graphs' / 'full_graph.json'
    target.write_text(json.dumps(graph, indent=2, sort_keys=True, ensure_ascii=False) + '\n', encoding='utf-8')

    views = {
        'module_graph': ({'MODULE'}, {'CONTAINS', 'REQUIRES', 'CAN_REUSE', 'DEPENDS_ON_REFERENCE'}),
        'capability_graph': ({'MODULE', 'CAPABILITY'}, {'PROVIDES_CAPABILITY', 'CONSUMES_CAPABILITY', 'INTERPRETED_BY_ATLAS', 'INTERFACE_ANALYSIS_CANDIDATE'}),
        'dependency_graph': ({'MODULE'}, {'REQUIRES', 'CAN_REUSE', 'DEPENDS_ON_REFERENCE'}),
        'evidence_graph': ({'MODULE', 'CAPABILITY', 'EVIDENCE', 'IMPROVEMENT_NEED', 'DIRECTION', 'INTERFACE', 'RESEARCH_NEED'}, {'SUPPORTED_BY'}),
        'improvement_need_graph': ({'IMPROVEMENT_NEED', 'DIRECTION', 'MODULE', 'CAPABILITY', 'EVIDENCE'}, {'AFFECTS', 'ADDRESSES', 'TARGETS_MODULE', 'SUPPORTED_BY', 'BLOCKS_MODULE', 'HAS_OPEN_NEED'}),
        'research_need_graph': ({'RESEARCH_NEED', 'IMPROVEMENT_NEED', 'MODULE', 'EVIDENCE'}, {'TRIGGERED_BY', 'AFFECTS', 'SUPPORTED_BY'}),
        'interface_graph': ({'INTERFACE', 'MODULE', 'CAPABILITY', 'EVIDENCE'}, {'PROVIDES_INTERFACE', 'SERVES_CAPABILITY', 'INTERFACE_ANALYSIS_CANDIDATE', 'INTERPRETED_BY_ATLAS', 'SUPPORTED_BY'}),
    }
    for name, (node_types, relationships) in views.items():
        v = view(graph, name, node_types, relationships)
        (BASE / 'graphs' / f'{name}.json').write_text(json.dumps(v, indent=2, sort_keys=True, ensure_ascii=False) + '\n', encoding='utf-8')

    export_graph(graph)
    print(json.dumps({'status': 'PASS', 'graph_hash': graph['graph_hash'], **graph['statistics']}, indent=2))


if __name__ == '__main__':
    main()
