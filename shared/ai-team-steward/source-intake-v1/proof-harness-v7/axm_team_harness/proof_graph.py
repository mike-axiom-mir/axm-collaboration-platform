
from __future__ import annotations
from dataclasses import dataclass, field

ROOT_KINDS = {'root_policy','authority','privacy','emergency_stop','human_merge_gate','canon_boundary'}

@dataclass
class ProofGraph:
    nodes: dict[str, dict] = field(default_factory=dict)
    edges: dict[str, set[str]] = field(default_factory=dict)

    def add(self, node_id: str, *, digest: str, kind: str, fresh: bool = True) -> None:
        self.nodes[node_id] = {'digest': digest, 'kind': kind, 'fresh': fresh}
        self.edges.setdefault(node_id, set())

    def depends_on(self, node_id: str, dependency: str) -> None:
        self.edges.setdefault(node_id, set()).add(dependency)

    def stale_closure(self, changed: set[str]) -> set[str]:
        stale = set(changed)
        progress = True
        while progress:
            progress = False
            for node, deps in self.edges.items():
                if node not in stale and deps & stale:
                    stale.add(node); progress = True
        return stale

    def select_tests(self, changed: set[str], all_tests: set[str]) -> dict:
        kinds = {self.nodes[x]['kind'] for x in changed if x in self.nodes}
        if kinds & ROOT_KINDS:
            return {'selected': sorted(all_tests), 'forced_full': True}
        stale = self.stale_closure(changed)
        selected = sorted(x for x in stale if x.startswith('test:'))
        return {'selected': selected, 'forced_full': False}


def reusable_evidence(prior: dict, current: dict) -> bool:
    keys = ('contract_digest','test_digest','fixture_digest','validator_digest','source_digest')
    return all(prior.get(k) == current.get(k) for k in keys) and bool(prior.get('passed'))
